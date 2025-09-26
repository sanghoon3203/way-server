// 📁 src/services/game/QuestPlayerService.js - 플레이어 퀘스트 오버뷰 생성 로직
const DatabaseManager = require('../../database/DatabaseManager');
const logger = require('../../config/logger');

function normalizeRewards(rawRewards = {}) {
    let rewards = rawRewards;

    if (typeof rawRewards === 'string') {
        try {
            rewards = JSON.parse(rawRewards);
        } catch (error) {
            logger.warn('퀘스트 보상 JSON 파싱 실패', { rawRewards, error: error.message });
            rewards = {};
        }
    }

    const experience = Number(rewards.experience ?? rewards.exp ?? 0);
    const money = Number(rewards.money ?? 0);
    const trustPoints = Number(rewards.trustPoints ?? rewards.trust ?? 0);

    const items = Array.isArray(rewards.items)
        ? rewards.items.map(item => ({
            itemId: String(item.itemId ?? item.id ?? ''),
            quantity: Number(item.quantity ?? 1)
        })).filter(item => item.itemId.length > 0)
        : [];

    return {
        experience,
        money,
        trustPoints,
        items
    };
}

function parseJSON(data, fallback) {
    if (!data) return fallback;
    if (typeof data === 'object') return data;

    try {
        return JSON.parse(data);
    } catch (error) {
        logger.warn('JSON 파싱 실패', { data, error: error.message });
        return fallback;
    }
}

function formatDateTime(value) {
    if (!value) return null;
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return null;
    return date.toISOString();
}

function toPriority(sortOrder) {
    const order = Number(sortOrder ?? 0);
    if (Number.isNaN(order)) return 1;
    return order + 1;
}

async function getQuestOverview(playerId) {
    const player = await DatabaseManager.get(`
        SELECT level, current_license FROM players WHERE id = ?
    `, [playerId]);

    if (!player) {
        const error = new Error('플레이어를 찾을 수 없습니다');
        error.status = 404;
        error.code = 'PLAYER_NOT_FOUND';
        throw error;
    }

    const activeQuests = await DatabaseManager.all(`
        SELECT
            pq.*,
            qt.name as title,
            qt.description,
            qt.category,
            qt.type as questType,
            qt.objectives,
            qt.rewards,
            qt.time_limit,
            qt.level_requirement as minLevel,
            qt.required_license as requiredLicense,
            qt.sort_order,
            COALESCE(qt.cooldown_hours, 0) as cooldown_hours,
            qt.repeatable as template_repeatable
        FROM player_quests pq
        JOIN quest_templates qt ON pq.quest_template_id = qt.id
        WHERE pq.player_id = ? AND pq.status = 'active'
        ORDER BY pq.accepted_at ASC
    `, [playerId]);

    const completedQuests = await DatabaseManager.all(`
        SELECT
            pq.*,
            qt.name as title,
            qt.description,
            qt.category,
            qt.type as questType,
            qt.objectives,
            qt.rewards,
            qt.sort_order,
            COALESCE(qt.cooldown_hours, 0) as cooldown_hours,
            qt.repeatable as template_repeatable
        FROM player_quests pq
        JOIN quest_templates qt ON pq.quest_template_id = qt.id
        WHERE pq.player_id = ? AND pq.status = 'completed'
        ORDER BY pq.completed_at DESC
        LIMIT 20
    `, [playerId]);

    const activeQuestIds = activeQuests.map(q => q.quest_template_id);
    const completedQuestIds = completedQuests.map(q => q.quest_template_id);

    const availableQuestTemplates = await DatabaseManager.all(`
        SELECT * FROM quest_templates
        WHERE is_active = 1
        AND level_requirement <= ?
        AND required_license <= ?
        ORDER BY sort_order ASC, category, level_requirement
    `, [player.level, player.current_license]);

    const availableQuests = [];
    for (const quest of availableQuestTemplates) {
        if (activeQuestIds.includes(quest.id)) continue;
        if (!quest.repeatable && completedQuestIds.includes(quest.id)) continue;

        const prerequisites = parseJSON(quest.prerequisites, []);
        const hasAllPrerequisites = prerequisites.every(pr => completedQuestIds.includes(pr));
        if (!hasAllPrerequisites) continue;

        const objectives = parseJSON(quest.objectives, []);

        availableQuests.push({
            id: quest.id,
            title: quest.name,
            description: quest.description,
            category: quest.category,
            questType: quest.type,
            maxProgress: objectives.length || 1,
            currentProgress: 0,
            rewards: normalizeRewards(parseJSON(quest.rewards, {})),
            requirements: {
                minLevel: quest.level_requirement,
                requiredLicense: quest.required_license,
                requiredItems: null,
                reputationRequirement: null,
                requiredMoney: null
            },
            isRepeatable: !!quest.repeatable,
            cooldownHours: quest.cooldown_hours ?? 0,
            priority: toPriority(quest.sort_order),
            status: 'available',
            acceptedAt: null,
            completedAt: null,
            expiresAt: null,
            rewardClaimed: false
        });
    }

    const formattedActiveQuests = activeQuests.map(quest => {
        const objectives = parseJSON(quest.objectives, []);
        const progress = parseJSON(quest.progress, {});

        let currentProgress = 0;
        objectives.forEach((_, index) => {
            const progressKey = `objective_${index}`;
            if (progress[progressKey]) {
                currentProgress += Number(progress[progressKey]) || 0;
            }
        });

        const maxProgress = Math.max(objectives.length, 1);

        return {
            id: quest.quest_template_id,
            title: quest.title,
            description: quest.description,
            category: quest.category,
            questType: quest.questType,
            maxProgress,
            currentProgress: Math.min(currentProgress, maxProgress),
            rewards: normalizeRewards(parseJSON(quest.rewards, {})),
            requirements: {
                minLevel: quest.minLevel,
                requiredLicense: quest.requiredLicense,
                requiredItems: null,
                reputationRequirement: null,
                requiredMoney: null
            },
            isRepeatable: !!quest.template_repeatable,
            cooldownHours: quest.cooldown_hours ?? 0,
            priority: toPriority(quest.sort_order),
            status: quest.status || 'active',
            acceptedAt: formatDateTime(quest.accepted_at ?? quest.started_at),
            completedAt: formatDateTime(quest.completed_at),
            expiresAt: formatDateTime(quest.expires_at),
            rewardClaimed: !!quest.reward_claimed
        };
    });

    const formattedCompletedQuests = completedQuests.map(quest => {
        const objectives = parseJSON(quest.objectives, []);

        return {
            id: quest.quest_template_id,
            title: quest.title,
            description: quest.description,
            category: quest.category,
            questType: quest.questType,
            maxProgress: Math.max(objectives.length, 1),
            currentProgress: Math.max(objectives.length, 1),
            rewards: normalizeRewards(parseJSON(quest.rewards, {})),
            requirements: null,
            isRepeatable: !!quest.template_repeatable,
            cooldownHours: quest.cooldown_hours ?? 0,
            priority: toPriority(quest.sort_order),
            status: quest.status || 'completed',
            acceptedAt: formatDateTime(quest.accepted_at ?? quest.started_at),
            completedAt: formatDateTime(quest.completed_at),
            expiresAt: null,
            rewardClaimed: !!quest.reward_claimed
        };
    });

    const claimedQuests = formattedCompletedQuests.filter(quest => quest.rewardClaimed);

    return {
        playerId,
        playerLevel: player.level,
        playerLicense: player.current_license,
        totalQuests: availableQuests.length + formattedActiveQuests.length + formattedCompletedQuests.length,
        questsByStatus: {
            available: availableQuests,
            active: formattedActiveQuests,
            completed: formattedCompletedQuests,
            claimed: claimedQuests
        },
        summary: {
            available: availableQuests.length,
            active: formattedActiveQuests.length,
            completed: formattedCompletedQuests.length,
            claimed: claimedQuests.length
        }
    };
}

module.exports = {
    getQuestOverview
};
