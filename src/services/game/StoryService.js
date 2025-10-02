// 📁 src/services/game/StoryService.js - Story progression service
const DatabaseManager = require('../../database/DatabaseManager');
const logger = require('../../config/logger');
const { randomUUID } = require('crypto');

class StoryService {

    /**
     * Get player's current story progress
     */
    static async getPlayerStoryProgress(playerId) {
        let progress = await DatabaseManager.get(`
            SELECT * FROM player_story_progress WHERE player_id = ?
        `, [playerId]);

        if (!progress) {
            // Initialize story progress for new player
            progress = await this.initializePlayerStory(playerId);
        }

        return {
            currentNodeId: progress.current_node_id,
            visitedNodes: JSON.parse(progress.visited_nodes || '[]'),
            storyFlags: JSON.parse(progress.story_flags || '{}'),
            lastInteraction: progress.last_interaction
        };
    }

    /**
     * Initialize story progress for new player
     */
    static async initializePlayerStory(playerId) {
        const id = randomUUID();

        await DatabaseManager.run(`
            INSERT INTO player_story_progress (
                id, player_id, current_node_id, visited_nodes, story_flags
            ) VALUES (?, ?, NULL, '[]', '{}')
        `, [id, playerId]);

        return await DatabaseManager.get(`
            SELECT * FROM player_story_progress WHERE id = ?
        `, [id]);
    }

    /**
     * Get story node by ID
     */
    static async getStoryNode(nodeId) {
        const node = await DatabaseManager.get(`
            SELECT * FROM story_nodes WHERE id = ?
        `, [nodeId]);

        if (!node) {
            throw new Error(`Story node not found: ${nodeId}`);
        }

        return node;
    }

    /**
     * Check if player meets prerequisites for a node
     */
    static async checkPrerequisites(playerId, prerequisitesJson) {
        if (!prerequisitesJson) {
            return { success: true };
        }

        const prerequisites = JSON.parse(prerequisitesJson);
        const missing = [];

        // Check level requirement
        if (prerequisites.level_min) {
            const player = await DatabaseManager.get(
                'SELECT level FROM players WHERE id = ?',
                [playerId]
            );
            if (player.level < prerequisites.level_min) {
                missing.push(`레벨 ${prerequisites.level_min} 필요`);
            }
        }

        // Check location requirement
        if (prerequisites.location) {
            // Location check would be done by client before calling API
            // Server just validates the call came from correct location
        }

        // Check story flags
        if (prerequisites.story_flags) {
            const progress = await this.getPlayerStoryProgress(playerId);
            for (const [flag, requiredValue] of Object.entries(prerequisites.story_flags)) {
                if (progress.storyFlags[flag] !== requiredValue) {
                    missing.push(`스토리 진행 조건 미달성`);
                }
            }
        }

        // Check completed quests
        if (prerequisites.quests_completed && prerequisites.quests_completed.length > 0) {
            for (const questId of prerequisites.quests_completed) {
                const completed = await DatabaseManager.get(`
                    SELECT id FROM player_quests
                    WHERE player_id = ? AND quest_template_id = ? AND status = 'completed'
                `, [playerId, questId]);

                if (!completed) {
                    missing.push(`필요 퀘스트 미완료`);
                }
            }
        }

        return {
            success: missing.length === 0,
            missing
        };
    }

    /**
     * Filter available choices based on player state
     */
    static async filterChoices(playerId, choicesJson) {
        if (!choicesJson) {
            return [];
        }

        const choices = JSON.parse(choicesJson);
        const available = [];

        for (const choice of choices) {
            // Check if choice has requirements
            if (choice.requirements) {
                const meetsRequirements = await this.checkPrerequisites(
                    playerId,
                    JSON.stringify(choice.requirements)
                );
                if (meetsRequirements.success) {
                    available.push(choice);
                }
            } else {
                // No requirements, always available
                available.push(choice);
            }
        }

        return available;
    }

    /**
     * Progress story by completing a node
     */
    static async progressStory(playerId, nodeId, choiceId) {
        const node = await this.getStoryNode(nodeId);
        const progress = await this.getPlayerStoryProgress(playerId);

        // Add to visited nodes
        const visitedNodes = progress.visitedNodes;
        if (!visitedNodes.includes(nodeId)) {
            visitedNodes.push(nodeId);
        }

        // Update story flags based on node effects
        const storyFlags = progress.storyFlags;
        if (node.metadata) {
            const metadata = JSON.parse(node.metadata);
            if (metadata.story_flags) {
                Object.assign(storyFlags, metadata.story_flags);
            }
        }

        // Determine next node based on choice
        let nextNodeId = null;
        if (choiceId && node.choices) {
            const choices = JSON.parse(node.choices);
            const selectedChoice = choices.find(c => c.id === choiceId);
            if (selectedChoice && selectedChoice.next_node) {
                nextNodeId = selectedChoice.next_node;
            }
        } else if (node.next_nodes) {
            // No choice, take first next node
            const nextNodes = JSON.parse(node.next_nodes);
            if (nextNodes.length > 0) {
                nextNodeId = nextNodes[0];
            }
        }

        // Update progress
        await DatabaseManager.run(`
            UPDATE player_story_progress
            SET current_node_id = ?,
                visited_nodes = ?,
                story_flags = ?,
                last_interaction = CURRENT_TIMESTAMP
            WHERE player_id = ?
        `, [
            nextNodeId,
            JSON.stringify(visitedNodes),
            JSON.stringify(storyFlags),
            playerId
        ]);

        // Grant rewards if any
        let rewards = null;
        if (node.rewards) {
            rewards = await this.grantRewards(playerId, node.rewards);
        }

        logger.info('Story progressed', {
            playerId,
            completedNode: nodeId,
            nextNode: nextNodeId,
            choiceId
        });

        return {
            completedNode: nodeId,
            nextNode: nextNodeId,
            rewards
        };
    }

    /**
     * Grant rewards to player
     */
    static async grantRewards(playerId, rewardsJson) {
        const rewards = JSON.parse(rewardsJson);

        if (rewards.exp) {
            await DatabaseManager.run(`
                UPDATE players SET experience = experience + ? WHERE id = ?
            `, [rewards.exp, playerId]);
        }

        if (rewards.reputation) {
            await DatabaseManager.run(`
                UPDATE players SET reputation = reputation + ? WHERE id = ?
            `, [rewards.reputation, playerId]);
        }

        if (rewards.money) {
            await DatabaseManager.run(`
                UPDATE players SET money = money + ? WHERE id = ?
            `, [rewards.money, playerId]);
        }

        logger.info('Story rewards granted', { playerId, rewards });

        return rewards;
    }

    /**
     * Set story flag for player
     */
    static async setStoryFlag(playerId, flagKey, value) {
        const progress = await this.getPlayerStoryProgress(playerId);
        const storyFlags = progress.storyFlags;
        storyFlags[flagKey] = value;

        await DatabaseManager.run(`
            UPDATE player_story_progress
            SET story_flags = ?
            WHERE player_id = ?
        `, [JSON.stringify(storyFlags), playerId]);
    }

    /**
     * Get story flag value
     */
    static async getStoryFlag(playerId, flagKey) {
        const progress = await this.getPlayerStoryProgress(playerId);
        return progress.storyFlags[flagKey];
    }
}

module.exports = StoryService;
