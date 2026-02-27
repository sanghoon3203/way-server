// 📁 src/routes/api/quests.js - 퀘스트 API
const express = require('express');
const router = express.Router();
const DatabaseManager = require('../../database/DatabaseManager');
const { authenticateToken } = require('../../middleware/auth');
const logger = require('../../config/logger');

// 모든 퀘스트 라우트에 인증 필요
router.use(authenticateToken);

/**
 * GET / — 퀘스트 목록 (status별 분류)
 * 클라이언트 QuestListResponse 형식에 맞춤
 */
router.get('/', async (req, res) => {
    try {
        const playerId = req.user.playerId;

        // 플레이어 정보
        const player = await DatabaseManager.get(
            'SELECT id, level, name FROM players WHERE id = ?',
            [playerId]
        );

        if (!player) {
            return res.status(404).json({ success: false, error: '플레이어를 찾을 수 없습니다' });
        }

        // 모든 활성 퀘스트 템플릿 가져오기
        const templates = await DatabaseManager.all(
            'SELECT * FROM quest_templates WHERE is_active = 1 ORDER BY sort_order ASC'
        );

        // 플레이어의 퀘스트 진행 상태 가져오기
        const playerQuests = await DatabaseManager.all(
            'SELECT * FROM player_quests WHERE player_id = ?',
            [playerId]
        );

        const playerQuestMap = {};
        for (const pq of playerQuests) {
            playerQuestMap[pq.quest_id] = pq;
        }

        const available = [];
        const active = [];
        const completed = [];
        const claimed = [];

        for (const t of templates) {
            const pq = playerQuestMap[t.id];
            const rewards = safeParseJSON(t.rewards, {});
            const objectives = safeParseJSON(t.objectives, []);
            const maxProgress = objectives.length > 0 ? (objectives[0].count || 1) : 1;

            const questData = {
                id: t.id,
                title: t.name,
                description: t.description || '',
                category: t.category || 'side_quest',
                questType: t.type || 'trade',
                maxProgress: pq ? pq.max_progress : maxProgress,
                currentProgress: pq ? pq.current_progress : 0,
                rewards: {
                    experience: rewards.experience || rewards.exp || 0,
                    money: rewards.money || 0,
                    trustPoints: rewards.trustPoints || 0,
                    items: rewards.items || []
                },
                requirements: {
                    minLevel: t.level_requirement,
                    requiredLicense: t.required_license
                },
                isRepeatable: !!t.repeatable,
                cooldownHours: t.cooldown_hours || 0,
                priority: t.priority || 1,
                status: pq ? pq.status : 'available',
                acceptedAt: pq ? pq.accepted_at : null,
                completedAt: pq ? pq.completed_at : null,
                expiresAt: pq ? pq.expires_at : null,
                rewardClaimed: pq ? !!pq.reward_claimed : false
            };

            // 레벨 요구사항 체크
            if (!pq && t.level_requirement > player.level) {
                continue; // 레벨 미달 퀘스트는 표시하지 않음
            }

            switch (questData.status) {
                case 'active':
                    active.push(questData);
                    break;
                case 'completed':
                    if (questData.rewardClaimed) {
                        claimed.push(questData);
                    } else {
                        completed.push(questData);
                    }
                    break;
                case 'claimed':
                    claimed.push(questData);
                    break;
                default:
                    available.push(questData);
                    break;
            }
        }

        res.json({
            success: true,
            data: {
                playerId: playerId,
                playerLevel: player.level,
                playerLicense: 0,
                totalQuests: templates.length,
                questsByStatus: { available, active, completed, claimed },
                summary: {
                    available: available.length,
                    active: active.length,
                    completed: completed.length,
                    claimed: claimed.length
                }
            }
        });

    } catch (error) {
        logger.error('퀘스트 목록 조회 실패:', error);
        res.status(500).json({ success: false, error: '퀘스트 목록을 가져올 수 없습니다' });
    }
});

/**
 * POST /:id/accept — 퀘스트 수락
 */
router.post('/:id/accept', async (req, res) => {
    try {
        const playerId = req.user.playerId;
        const questId = req.params.id;

        // 템플릿 확인
        const template = await DatabaseManager.get(
            'SELECT * FROM quest_templates WHERE id = ? AND is_active = 1',
            [questId]
        );

        if (!template) {
            return res.status(404).json({ success: false, error: '퀘스트를 찾을 수 없습니다' });
        }

        // 이미 수락했는지 확인
        const existing = await DatabaseManager.get(
            'SELECT * FROM player_quests WHERE player_id = ? AND quest_id = ?',
            [playerId, questId]
        );

        if (existing && existing.status === 'active') {
            return res.status(400).json({ success: false, error: '이미 진행 중인 퀘스트입니다' });
        }

        const objectives = safeParseJSON(template.objectives, []);
        const maxProgress = objectives.length > 0 ? (objectives[0].count || 1) : 1;
        const now = new Date().toISOString();
        const expiresAt = template.time_limit
            ? new Date(Date.now() + template.time_limit * 1000).toISOString()
            : null;

        if (existing) {
            // 반복 퀘스트 재수락
            await DatabaseManager.run(
                `UPDATE player_quests SET status = 'active', current_progress = 0,
                 max_progress = ?, accepted_at = ?, completed_at = NULL,
                 expires_at = ?, reward_claimed = 0, updated_at = ?
                 WHERE player_id = ? AND quest_id = ?`,
                [maxProgress, now, expiresAt, now, playerId, questId]
            );
        } else {
            await DatabaseManager.run(
                `INSERT INTO player_quests (player_id, quest_id, status, current_progress, max_progress, accepted_at, expires_at)
                 VALUES (?, ?, 'active', 0, ?, ?, ?)`,
                [playerId, questId, maxProgress, now, expiresAt]
            );
        }

        res.json({
            success: true,
            data: {
                questId: questId,
                title: template.name,
                description: template.description,
                status: 'active',
                acceptedAt: now,
                expiresAt: expiresAt
            },
            message: '퀘스트를 수락했습니다'
        });

    } catch (error) {
        logger.error('퀘스트 수락 실패:', error);
        res.status(500).json({ success: false, error: '퀘스트 수락에 실패했습니다' });
    }
});

/**
 * POST /:id/claim — 보상 수령
 */
router.post('/:id/claim', async (req, res) => {
    try {
        const playerId = req.user.playerId;
        const questId = req.params.id;

        const pq = await DatabaseManager.get(
            'SELECT * FROM player_quests WHERE player_id = ? AND quest_id = ? AND status = ?',
            [playerId, questId, 'completed']
        );

        if (!pq) {
            return res.status(400).json({ success: false, error: '완료된 퀘스트가 아닙니다' });
        }

        if (pq.reward_claimed) {
            return res.status(400).json({ success: false, error: '이미 보상을 수령했습니다' });
        }

        const template = await DatabaseManager.get(
            'SELECT * FROM quest_templates WHERE id = ?',
            [questId]
        );

        const rewards = safeParseJSON(template.rewards, {});

        // 보상 지급
        if (rewards.money) {
            await DatabaseManager.run(
                'UPDATE players SET money = money + ? WHERE id = ?',
                [rewards.money, playerId]
            );
        }
        if (rewards.experience || rewards.exp) {
            const exp = rewards.experience || rewards.exp;
            await DatabaseManager.run(
                'UPDATE players SET exp = exp + ? WHERE id = ?',
                [exp, playerId]
            );
        }

        // 보상 수령 완료 표시
        await DatabaseManager.run(
            `UPDATE player_quests SET reward_claimed = 1, status = 'claimed', updated_at = ?
             WHERE player_id = ? AND quest_id = ?`,
            [new Date().toISOString(), playerId, questId]
        );

        res.json({
            success: true,
            data: {
                questId: questId,
                title: template.name,
                rewards: {
                    experience: rewards.experience || rewards.exp || 0,
                    money: rewards.money || 0,
                    trustPoints: rewards.trustPoints || 0,
                    items: rewards.items || []
                }
            },
            message: '보상을 수령했습니다'
        });

    } catch (error) {
        logger.error('보상 수령 실패:', error);
        res.status(500).json({ success: false, error: '보상 수령에 실패했습니다' });
    }
});

/**
 * POST /progress — 퀘스트 진행 업데이트
 */
router.post('/progress', async (req, res) => {
    try {
        const playerId = req.user.playerId;
        const { actionType, metadata } = req.body;

        // 활성 퀘스트 중 해당 actionType에 해당하는 퀘스트 찾기
        const activeQuests = await DatabaseManager.all(
            `SELECT pq.*, qt.objectives, qt.auto_complete, qt.name as title
             FROM player_quests pq
             JOIN quest_templates qt ON pq.quest_id = qt.id
             WHERE pq.player_id = ? AND pq.status = 'active'`,
            [playerId]
        );

        const updatedQuests = [];

        for (const quest of activeQuests) {
            const objectives = safeParseJSON(quest.objectives, []);
            const matchingObj = objectives.find(o => o.type === actionType);

            if (matchingObj) {
                const newProgress = Math.min(quest.current_progress + 1, quest.max_progress);
                const isCompleted = newProgress >= quest.max_progress;

                await DatabaseManager.run(
                    `UPDATE player_quests SET current_progress = ?,
                     status = ?, completed_at = ?, updated_at = ?
                     WHERE player_id = ? AND quest_id = ?`,
                    [
                        newProgress,
                        isCompleted ? 'completed' : 'active',
                        isCompleted ? new Date().toISOString() : null,
                        new Date().toISOString(),
                        playerId,
                        quest.quest_id
                    ]
                );

                updatedQuests.push({
                    questId: quest.quest_id,
                    title: quest.title,
                    oldProgress: quest.current_progress,
                    newProgress: newProgress,
                    maxProgress: quest.max_progress,
                    isCompleted: isCompleted,
                    progressDelta: 1
                });
            }
        }

        res.json({
            success: true,
            data: {
                actionType: actionType,
                updatedQuests: updatedQuests,
                questsUpdated: updatedQuests.length
            }
        });

    } catch (error) {
        logger.error('퀘스트 진행 업데이트 실패:', error);
        res.status(500).json({ success: false, error: '퀘스트 진행 업데이트에 실패했습니다' });
    }
});

/**
 * GET /history — 퀘스트 히스토리
 */
router.get('/history', async (req, res) => {
    try {
        const playerId = req.user.playerId;
        const limit = parseInt(req.query.limit) || 20;
        const offset = parseInt(req.query.offset) || 0;

        const quests = await DatabaseManager.all(
            `SELECT pq.*, qt.name as title, qt.description, qt.category, qt.type as questType, qt.rewards
             FROM player_quests pq
             JOIN quest_templates qt ON pq.quest_id = qt.id
             WHERE pq.player_id = ?
             ORDER BY pq.updated_at DESC
             LIMIT ? OFFSET ?`,
            [playerId, limit, offset]
        );

        const total = await DatabaseManager.get(
            'SELECT COUNT(*) as count FROM player_quests WHERE player_id = ?',
            [playerId]
        );

        res.json({
            success: true,
            data: {
                quests: quests.map(q => ({
                    questId: q.quest_id,
                    title: q.title,
                    description: q.description,
                    category: q.category,
                    questType: q.questType,
                    status: q.status,
                    currentProgress: q.current_progress,
                    acceptedAt: q.accepted_at,
                    completedAt: q.completed_at,
                    rewardClaimed: !!q.reward_claimed,
                    rewards: safeParseJSON(q.rewards, {})
                })),
                pagination: {
                    total: total.count,
                    limit: limit,
                    offset: offset,
                    hasMore: offset + limit < total.count
                }
            }
        });

    } catch (error) {
        logger.error('퀘스트 히스토리 조회 실패:', error);
        res.status(500).json({ success: false, error: '퀘스트 히스토리를 가져올 수 없습니다' });
    }
});

// 유틸리티
function safeParseJSON(str, fallback) {
    if (!str) return fallback;
    if (typeof str === 'object') return str;
    try {
        return JSON.parse(str);
    } catch {
        return fallback;
    }
}

module.exports = router;
