// 📁 src/routes/game/quests.js - 게임 퀘스트 API (iOS 클라이언트용)
const express = require('express');
const { authenticateToken } = require('../../middleware/auth');
const DatabaseManager = require('../../database/DatabaseManager');
const logger = require('../../config/logger');
const { randomUUID } = require('crypto');
const { getQuestOverview } = require('../../services/game/QuestPlayerService');

const router = express.Router();
router.use(authenticateToken);

/**
 * 전체 퀘스트 목록 조회 (iOS NetworkManager용)
 * GET /game/quests
 */
router.get('/', async (req, res) => {
    try {
        const data = await getQuestOverview(req.user.playerId);
        res.json({ success: true, data });
    } catch (error) {
        logger.error('퀘스트 목록 조회 실패:', error);
        res.status(error.status || 500).json({
            success: false,
            error: {
                code: error.code || 'INTERNAL_SERVER_ERROR',
                message: error.message || '서버 오류가 발생했습니다'
            }
        });
    }
});

/**
 * 퀘스트 수락
 * POST /game/quests/:questId/accept
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
                error: { code: 'QUEST_NOT_FOUND', message: '퀘스트를 찾을 수 없습니다' }
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
                error: { code: 'INSUFFICIENT_REQUIREMENTS', message: '퀘스트 수행 조건을 만족하지 않습니다' }
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
                error: { code: 'QUEST_ALREADY_ACTIVE', message: '이미 진행 중인 퀘스트입니다' }
            });
        }

        // 퀘스트 수락
        const playerQuestId = randomUUID();
        await DatabaseManager.run(`
            INSERT INTO player_quests (
                id, player_id, quest_template_id, status, progress, accepted_at
            ) VALUES (?, ?, ?, 'active', '{}', CURRENT_TIMESTAMP)
        `, [playerQuestId, playerId, questId]);

        logger.info(`퀘스트 수락: 플레이어 ${playerId} - 퀘스트 ${questTemplate.name}`);

        res.json({
            success: true,
            data: {
                questId: questId,
                title: questTemplate.name,
                description: questTemplate.description,
                status: 'active',
                acceptedAt: new Date().toISOString(),
                expiresAt: questTemplate.time_limit ?
                    new Date(Date.now() + questTemplate.time_limit * 1000).toISOString() : null
            },
            message: '퀘스트를 수락했습니다'
        });

    } catch (error) {
        logger.error('퀘스트 수락 실패:', error);
        res.status(500).json({
            success: false,
            error: { code: 'INTERNAL_SERVER_ERROR', message: '서버 오류가 발생했습니다' }
        });
    }
});

/**
 * 퀘스트 보상 수령 (완료된 퀘스트의 보상 클레임)
 * POST /game/quests/:questId/claim
 */
router.post('/:questId/claim', async (req, res) => {
    try {
        const playerId = req.user.playerId;
        const questId = req.params.questId;

        // 완료된 퀘스트 확인
        const quest = await DatabaseManager.get(`
            SELECT
                pq.*,
                qt.name as title,
                qt.rewards
            FROM player_quests pq
            JOIN quest_templates qt ON pq.quest_template_id = qt.id
            WHERE pq.quest_template_id = ? AND pq.player_id = ? AND pq.status = 'completed'
        `, [questId, playerId]);

        if (!quest) {
            return res.status(404).json({
                success: false,
                error: { code: 'QUEST_NOT_COMPLETED', message: '완료된 퀘스트를 찾을 수 없습니다' }
            });
        }

        // 이미 보상을 받았는지 확인
        if (quest.reward_claimed) {
            return res.status(400).json({
                success: false,
                error: { code: 'REWARD_ALREADY_CLAIMED', message: '이미 보상을 받았습니다' }
            });
        }

        let rewards = {};
        try {
            rewards = JSON.parse(quest.rewards || '{}');
        } catch (error) {
            logger.warn('퀘스트 보상 파싱 실패', { questId, error: error.message });
            rewards = {};
        }

        const money = Number(rewards.money ?? 0);
        const experience = Number(rewards.experience ?? rewards.exp ?? 0);
        const trustPoints = Number(rewards.trustPoints ?? rewards.trust ?? 0);

        if (money) {
            await DatabaseManager.run(`
                UPDATE players SET money = money + ? WHERE id = ?
            `, [money, playerId]);
        }

        if (experience) {
            await DatabaseManager.run(`
                UPDATE players SET experience = experience + ? WHERE id = ?
            `, [experience, playerId]);
        }

        if (trustPoints) {
            await DatabaseManager.run(`
                UPDATE players SET trust_points = trust_points + ? WHERE id = ?
            `, [trustPoints, playerId]);
        }

        // 보상 수령 표시
        await DatabaseManager.run(`
            UPDATE player_quests
            SET reward_claimed = 1, reward_claimed_at = CURRENT_TIMESTAMP
            WHERE id = ?
        `, [quest.id]);

        logger.info(`퀘스트 보상 수령: 플레이어 ${playerId} - 퀘스트 ${quest.title}`);

        res.json({
            success: true,
            data: {
                questId: questId,
                title: quest.title,
                rewards: {
                    money,
                    experience,
                    trustPoints,
                    items: Array.isArray(rewards.items) ? rewards.items : []
                }
            },
            message: '퀘스트 보상을 받았습니다'
        });

    } catch (error) {
        logger.error('퀘스트 보상 수령 실패:', error);
        res.status(500).json({
            success: false,
            error: { code: 'INTERNAL_SERVER_ERROR', message: '서버 오류가 발생했습니다' }
        });
    }
});

/**
 * 퀘스트 진행 상황 업데이트
 * POST /game/quests/progress
 */
router.post('/progress', async (req, res) => {
    try {
        const playerId = req.user.playerId;
        const { actionType, actionData } = req.body;

        // 기존 /api/quests/progress와 동일한 로직 사용
        const response = await require('../api/quests').progressHandler(playerId, actionType, actionData);
        res.json(response);

    } catch (error) {
        logger.error('퀘스트 진행도 업데이트 실패:', error);
        res.status(500).json({
            success: false,
            error: { code: 'INTERNAL_SERVER_ERROR', message: '서버 오류가 발생했습니다' }
        });
    }
});

/**
 * 퀘스트 히스토리 조회
 * GET /game/quests/history
 */
router.get('/history', async (req, res) => {
    try {
        const playerId = req.user.playerId;
        const limit = parseInt(req.query.limit) || 20;
        const offset = parseInt(req.query.offset) || 0;

        const historyQuests = await DatabaseManager.all(`
            SELECT
                pq.*,
                qt.name as title,
                qt.description,
                qt.category,
                qt.type as questType,
                qt.rewards
            FROM player_quests pq
            JOIN quest_templates qt ON pq.quest_template_id = qt.id
            WHERE pq.player_id = ?
            ORDER BY pq.accepted_at DESC
            LIMIT ? OFFSET ?
        `, [playerId, limit, offset]);

        const totalCount = await DatabaseManager.get(`
            SELECT COUNT(*) as count FROM player_quests WHERE player_id = ?
        `, [playerId]);

        const formattedQuests = historyQuests.map(quest => {
            const objectives = JSON.parse(quest.objectives || '[]');
            const progress = JSON.parse(quest.progress || '{}');

            let currentProgress = 0;
            for (let i = 0; i < objectives.length; i++) {
                const progressKey = `objective_${i}`;
                if (progress[progressKey]) {
                    currentProgress += progress[progressKey];
                }
            }

            return {
                questId: quest.quest_template_id,
                title: quest.title,
                description: quest.description,
                category: quest.category,
                questType: quest.questType,
                status: quest.status,
                currentProgress: currentProgress,
                acceptedAt: quest.accepted_at,
                completedAt: quest.completed_at,
                rewardClaimed: quest.reward_claimed || false,
                rewards: JSON.parse(quest.rewards || '{}')
            };
        });

        res.json({
            success: true,
            data: {
                quests: formattedQuests,
                pagination: {
                    total: totalCount.count,
                    limit: limit,
                    offset: offset,
                    hasMore: (offset + limit) < totalCount.count
                }
            }
        });

    } catch (error) {
        logger.error('퀘스트 히스토리 조회 실패:', error);
        res.status(500).json({
            success: false,
            error: { code: 'INTERNAL_SERVER_ERROR', message: '서버 오류가 발생했습니다' }
        });
    }
});

module.exports = router;
