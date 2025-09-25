// 📁 src/routes/api/quests.js - 퀘스트 시스템 API
const express = require('express');
const { authenticateToken } = require('../../middleware/auth');
const DatabaseManager = require('../../database/DatabaseManager');
const logger = require('../../config/logger');
const { randomUUID } = require('crypto');

const router = express.Router();
router.use(authenticateToken);

/**
 * 플레이어가 수행 가능한 퀘스트 조회
 * GET /api/quests/available
 */
router.get('/available', async (req, res) => {
    try {
        const playerId = req.user.playerId;
        
        // 플레이어 정보 조회
        const player = await DatabaseManager.get(`
            SELECT level, current_license, reputation FROM players WHERE id = ?
        `, [playerId]);
        
        if (!player) {
            return res.status(404).json({
                success: false,
                error: '플레이어를 찾을 수 없습니다'
            });
        }
        
        // 현재 진행 중인 퀘스트 조회
        const activeQuests = await DatabaseManager.all(`
            SELECT quest_template_id FROM player_quests 
            WHERE player_id = ? AND status = 'active'
        `, [playerId]);
        
        const activeQuestIds = activeQuests.map(q => q.quest_template_id);
        
        // 완료된 퀘스트 조회 (반복 불가능한 퀘스트 제외용)
        const completedQuests = await DatabaseManager.all(`
            SELECT DISTINCT quest_template_id FROM player_quests 
            WHERE player_id = ? AND status = 'completed'
        `, [playerId]);
        
        const completedQuestIds = completedQuests.map(q => q.quest_template_id);
        
        // 수행 가능한 퀘스트 템플릿 조회
        const availableQuests = await DatabaseManager.all(`
            SELECT * FROM quest_templates 
            WHERE is_active = 1 
            AND level_requirement <= ? 
            AND required_license <= ?
            ORDER BY sort_order ASC, category, level_requirement
        `, [player.level, player.current_license]);
        
        // 필터링: 선행 조건, 중복 제거 등
        const filteredQuests = [];
        
        for (const quest of availableQuests) {
            // 이미 진행 중인 퀘스트는 제외
            if (activeQuestIds.includes(quest.id)) continue;
            
            // 반복 불가능한 퀘스트 중 이미 완료한 것은 제외
            if (!quest.repeatable && completedQuestIds.includes(quest.id)) continue;
            
            // 선행 조건 확인
            let prerequisites = [];
            try {
                prerequisites = JSON.parse(quest.prerequisites || '[]');
            } catch (e) {
                prerequisites = [];
            }
            
            let canAccept = true;
            for (const prereqId of prerequisites) {
                if (!completedQuestIds.includes(prereqId)) {
                    canAccept = false;
                    break;
                }
            }
            
            if (canAccept) {
                filteredQuests.push({
                    id: quest.id,
                    name: quest.name,
                    description: quest.description,
                    category: quest.category,
                    type: quest.type,
                    objectives: JSON.parse(quest.objectives || '[]'),
                    rewards: JSON.parse(quest.rewards || '{}'),
                    repeatable: quest.repeatable,
                    timeLimit: quest.time_limit
                });
            }
        }
        
        res.json({
            success: true,
            data: {
                availableQuests: filteredQuests,
                totalCount: filteredQuests.length
            }
        });
        
    } catch (error) {
        logger.error('사용 가능한 퀘스트 조회 실패:', error);
        res.status(500).json({
            success: false,
            error: '서버 오류가 발생했습니다'
        });
    }
});

/**
 * 플레이어의 진행 중인 퀘스트 조회
 * GET /api/quests/active
 */
router.get('/active', async (req, res) => {
    try {
        const playerId = req.user.playerId;
        
        const activeQuests = await DatabaseManager.all(`
            SELECT 
                pq.*,
                qt.name,
                qt.description,
                qt.category,
                qt.type,
                qt.objectives,
                qt.rewards,
                qt.time_limit
            FROM player_quests pq
            JOIN quest_templates qt ON pq.quest_template_id = qt.id
            WHERE pq.player_id = ? AND pq.status = 'active'
            ORDER BY pq.accepted_at ASC
        `, [playerId]);
        
        const formattedQuests = activeQuests.map(quest => ({
            id: quest.id,
            questId: quest.quest_template_id,
            name: quest.name,
            description: quest.description,
            category: quest.category,
            type: quest.type,
            objectives: JSON.parse(quest.objectives || '[]'),
            rewards: JSON.parse(quest.rewards || '{}'),
            progress: JSON.parse(quest.progress || '{}'),
            status: quest.status,
            acceptedAt: quest.accepted_at,
            timeLimit: quest.time_limit,
            isExpired: quest.time_limit && quest.time_limit > 0 ? 
                (Date.now() - new Date(quest.accepted_at).getTime()) > (quest.time_limit * 1000) : false
        }));
        
        res.json({
            success: true,
            data: {
                activeQuests: formattedQuests,
                totalCount: formattedQuests.length
            }
        });
        
    } catch (error) {
        logger.error('진행 중인 퀘스트 조회 실패:', error);
        res.status(500).json({
            success: false,
            error: '서버 오류가 발생했습니다'
        });
    }
});

/**
 * 퀘스트 수락
 * POST /api/quests/:questId/accept
 */
router.post('/:questId/accept', async (req, res) => {
    try {
        const playerId = req.user.playerId;
        const questId = req.params.questId;
        
        // 퀘스트 템플릿 확인
        const questTemplate = await DatabaseManager.get(`
            SELECT * FROM quest_templates WHERE id = ? AND is_active = 1
        `, [questId]);
        
        if (!questTemplate) {
            return res.status(404).json({
                success: false,
                error: '퀘스트를 찾을 수 없습니다'
            });
        }
        
        // 플레이어 정보 확인
        const player = await DatabaseManager.get(`
            SELECT level, current_license FROM players WHERE id = ?
        `, [playerId]);
        
        if (player.level < questTemplate.level_requirement || 
            player.current_license < questTemplate.required_license) {
            return res.status(400).json({
                success: false,
                error: '퀘스트 수행 조건을 만족하지 않습니다'
            });
        }
        
        // 이미 진행 중인지 확인
        const existing = await DatabaseManager.get(`
            SELECT id FROM player_quests 
            WHERE player_id = ? AND quest_template_id = ? AND status = 'active'
        `, [playerId, questId]);
        
        if (existing) {
            return res.status(400).json({
                success: false,
                error: '이미 진행 중인 퀘스트입니다'
            });
        }
        
        // 퀘스트 수락
        const playerQuestId = randomUUID();
        await DatabaseManager.run(`
            INSERT INTO player_quests (
                id, player_id, quest_template_id, status, progress, accepted_at
            ) VALUES (?, ?, ?, 'active', '{}', CURRENT_TIMESTAMP)
        `, [playerQuestId, playerId, questId]);
        
        logger.info(`퀘스트 수락: ${player.name} - ${questTemplate.name}`);
        
        res.json({
            success: true,
            data: {
                questId: playerQuestId,
                message: '퀘스트를 수락했습니다'
            }
        });
        
    } catch (error) {
        logger.error('퀘스트 수락 실패:', error);
        res.status(500).json({
            success: false,
            error: '서버 오류가 발생했습니다'
        });
    }
});

/**
 * 퀘스트 포기
 * POST /api/quests/:questId/abandon
 */
router.post('/:questId/abandon', async (req, res) => {
    try {
        const playerId = req.user.playerId;
        const questId = req.params.questId;
        
        // 진행 중인 퀘스트 확인
        const quest = await DatabaseManager.get(`
            SELECT * FROM player_quests 
            WHERE id = ? AND player_id = ? AND status = 'active'
        `, [questId, playerId]);
        
        if (!quest) {
            return res.status(404).json({
                success: false,
                error: '진행 중인 퀘스트를 찾을 수 없습니다'
            });
        }
        
        // 퀘스트 포기 (삭제)
        await DatabaseManager.run(`
            DELETE FROM player_quests WHERE id = ?
        `, [questId]);
        
        res.json({
            success: true,
            data: {
                message: '퀘스트를 포기했습니다'
            }
        });
        
    } catch (error) {
        logger.error('퀘스트 포기 실패:', error);
        res.status(500).json({
            success: false,
            error: '서버 오류가 발생했습니다'
        });
    }
});

/**
 * 퀘스트 진행 상황 업데이트
 * POST /api/quests/progress
 */
router.post('/progress', async (req, res) => {
    try {
        const playerId = req.user.playerId;
        const { eventType, eventData } = req.body;
        
        // 진행 중인 퀘스트들 조회
        const activeQuests = await DatabaseManager.all(`
            SELECT 
                pq.*,
                qt.objectives,
                qt.rewards,
                qt.auto_complete
            FROM player_quests pq
            JOIN quest_templates qt ON pq.quest_template_id = qt.id
            WHERE pq.player_id = ? AND pq.status = 'active'
        `, [playerId]);
        
        const updatedQuests = [];
        
        for (const quest of activeQuests) {
            const objectives = JSON.parse(quest.objectives || '[]');
            const currentProgress = JSON.parse(quest.progress || '{}');
            
            let hasProgress = false;
            
            // 각 목표 확인 및 진행도 업데이트
            for (let i = 0; i < objectives.length; i++) {
                const objective = objectives[i];
                const progressKey = `objective_${i}`;
                
                if (!currentProgress[progressKey]) {
                    currentProgress[progressKey] = 0;
                }
                
                // 이벤트 타입에 따른 진행도 업데이트
                if (objective.type === eventType) {
                    let increment = 1;
                    
                    if (objective.type === 'total_profit' && eventData.profit) {
                        increment = eventData.profit;
                    }
                    
                    if (objective.category && eventData.category && 
                        objective.category !== eventData.category) {
                        continue;
                    }
                    
                    currentProgress[progressKey] += increment;
                    hasProgress = true;
                }
            }
            
            if (hasProgress) {
                // 진행도 업데이트
                await DatabaseManager.run(`
                    UPDATE player_quests SET progress = ? WHERE id = ?
                `, [JSON.stringify(currentProgress), quest.id]);
                
                // 자동 완료 확인
                let isCompleted = true;
                for (let i = 0; i < objectives.length; i++) {
                    const objective = objectives[i];
                    const progressKey = `objective_${i}`;
                    const target = objective.count || objective.amount || 1;
                    
                    if (currentProgress[progressKey] < target) {
                        isCompleted = false;
                        break;
                    }
                }
                
                if (isCompleted && quest.auto_complete) {
                    await completeQuest(quest.id, playerId);
                    updatedQuests.push({ id: quest.id, status: 'completed' });
                } else {
                    updatedQuests.push({ id: quest.id, status: 'updated', progress: currentProgress });
                }
            }
        }
        
        res.json({
            success: true,
            data: {
                updatedQuests,
                message: '퀘스트 진행도가 업데이트되었습니다'
            }
        });
        
    } catch (error) {
        logger.error('퀘스트 진행도 업데이트 실패:', error);
        res.status(500).json({
            success: false,
            error: '서버 오류가 발생했습니다'
        });
    }
});

/**
 * 퀘스트 완료 내부 함수
 */
async function completeQuest(questId, playerId) {
    try {
        // 퀘스트 정보 조회
        const questInfo = await DatabaseManager.get(`
            SELECT 
                pq.*,
                qt.rewards
            FROM player_quests pq
            JOIN quest_templates qt ON pq.quest_template_id = qt.id
            WHERE pq.id = ?
        `, [questId]);
        
        if (!questInfo) return;
        
        const rewards = JSON.parse(questInfo.rewards || '{}');
        
        // 퀘스트 완료 처리
        await DatabaseManager.run(`
            UPDATE player_quests 
            SET status = 'completed', completed_at = CURRENT_TIMESTAMP 
            WHERE id = ?
        `, [questId]);
        
        // 보상 지급
        if (rewards.money) {
            await DatabaseManager.run(`
                UPDATE players SET money = money + ? WHERE id = ?
            `, [rewards.money, playerId]);
        }
        
        if (rewards.exp) {
            await DatabaseManager.run(`
                UPDATE players SET experience = experience + ? WHERE id = ?
            `, [rewards.exp, playerId]);
        }
        
        if (rewards.trust) {
            await DatabaseManager.run(`
                UPDATE players SET trust_points = trust_points + ? WHERE id = ?
            `, [rewards.trust, playerId]);
        }
        
        logger.info(`퀘스트 완료: 플레이어 ${playerId}, 퀘스트 ${questId}`);
        
    } catch (error) {
        logger.error('퀘스트 완료 처리 실패:', error);
    }
}

module.exports = router;