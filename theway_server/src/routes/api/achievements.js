// 📁 src/routes/api/achievements.js - 성취 시스템 API
const express = require('express');
const { authenticateToken } = require('../../middleware/auth');
const DatabaseManager = require('../../database/DatabaseManager');
const logger = require('../../config/logger');
const metricsCollector = require('../../utils/MetricsCollector');

const router = express.Router();
router.use(authenticateToken);

/**
 * 플레이어의 성취 목록 조회
 * GET /api/achievements
 */
router.get('/', async (req, res) => {
    try {
        const playerId = req.user.id;
        const { category, status } = req.query;

        let whereClause = 'WHERE at.is_active = 1';
        let params = [];

        if (category) {
            whereClause += ' AND at.category = ?';
            params.push(category);
        }

        // 플레이어의 성취 진행상황과 함께 성취 목록 조회
        const achievements = await DatabaseManager.all(`
            SELECT 
                at.id,
                at.name,
                at.description,
                at.category,
                at.type,
                at.points,
                at.rarity,
                at.icon_id,
                at.is_secret,
                COALESCE(pa.status, 'locked') as status,
                COALESCE(pa.current_value, 0) as current_value,
                COALESCE(pa.target_value, 1) as target_value,
                pa.progress,
                pa.unlocked_at,
                pa.completed_at,
                CASE 
                    WHEN at.is_secret = 1 AND COALESCE(pa.status, 'locked') = 'locked' THEN '???'
                    ELSE at.name
                END as display_name,
                CASE 
                    WHEN at.is_secret = 1 AND COALESCE(pa.status, 'locked') = 'locked' THEN '숨겨진 성취입니다.'
                    ELSE at.description
                END as display_description
            FROM achievement_templates at
            LEFT JOIN player_achievements pa ON at.id = pa.achievement_template_id AND pa.player_id = ?
            ${whereClause}
            ORDER BY at.category, at.sort_order, at.name
        `, [playerId, ...params]);

        // 상태별 필터링
        let filteredAchievements = achievements;
        if (status) {
            filteredAchievements = achievements.filter(ach => ach.status === status);
        }

        // 성취 통계 계산
        const stats = {
            total: achievements.length,
            completed: achievements.filter(a => a.status === 'completed').length,
            inProgress: achievements.filter(a => a.status === 'in_progress').length,
            locked: achievements.filter(a => a.status === 'locked').length,
            totalPoints: achievements
                .filter(a => a.status === 'completed')
                .reduce((sum, a) => sum + a.points, 0)
        };

        // 카테고리별 그룹화
        const categories = {};
        filteredAchievements.forEach(achievement => {
            if (!categories[achievement.category]) {
                categories[achievement.category] = [];
            }
            categories[achievement.category].push({
                id: achievement.id,
                name: achievement.display_name,
                description: achievement.display_description,
                category: achievement.category,
                type: achievement.type,
                points: achievement.points,
                rarity: achievement.rarity,
                icon_id: achievement.icon_id,
                is_secret: achievement.is_secret,
                status: achievement.status,
                progress: {
                    current: achievement.current_value,
                    target: achievement.target_value,
                    percentage: Math.min(100, Math.round((achievement.current_value / achievement.target_value) * 100))
                },
                unlocked_at: achievement.unlocked_at,
                completed_at: achievement.completed_at
            });
        });

        res.json({
            success: true,
            data: {
                achievements: categories,
                stats,
                message: `총 ${achievements.length}개의 성취가 있습니다.`
            }
        });

    } catch (error) {
        logger.error('성취 목록 조회 실패:', error);
        res.status(500).json({
            success: false,
            error: '서버 오류가 발생했습니다'
        });
    }
});

/**
 * 특정 성취 상세 정보 조회
 * GET /api/achievements/:achievementId
 */
router.get('/:achievementId', async (req, res) => {
    try {
        const playerId = req.user.id;
        const { achievementId } = req.params;

        const achievement = await DatabaseManager.get(`
            SELECT 
                at.*,
                COALESCE(pa.status, 'locked') as status,
                COALESCE(pa.current_value, 0) as current_value,
                COALESCE(pa.target_value, 1) as target_value,
                pa.progress,
                pa.unlocked_at,
                pa.completed_at
            FROM achievement_templates at
            LEFT JOIN player_achievements pa ON at.id = pa.achievement_template_id AND pa.player_id = ?
            WHERE at.id = ? AND at.is_active = 1
        `, [playerId, achievementId]);

        if (!achievement) {
            return res.status(404).json({
                success: false,
                error: '성취를 찾을 수 없습니다'
            });
        }

        // 숨겨진 성취인 경우 정보 마스킹
        let displayData = { ...achievement };
        if (achievement.is_secret && achievement.status === 'locked') {
            displayData.name = '???';
            displayData.description = '숨겨진 성취입니다.';
            displayData.unlock_condition = null;
            displayData.rewards = null;
        } else {
            displayData.unlock_condition = JSON.parse(achievement.unlock_condition || '{}');
            displayData.rewards = JSON.parse(achievement.rewards || '{}');
        }

        displayData.progress = {
            current: achievement.current_value,
            target: achievement.target_value,
            percentage: Math.min(100, Math.round((achievement.current_value / achievement.target_value) * 100))
        };

        res.json({
            success: true,
            data: { achievement: displayData }
        });

    } catch (error) {
        logger.error('성취 상세 조회 실패:', error);
        res.status(500).json({
            success: false,
            error: '서버 오류가 발생했습니다'
        });
    }
});

/**
 * 성취 진행상황 업데이트 (게임 내부 호출용)
 * POST /api/achievements/progress
 */
router.post('/progress', async (req, res) => {
    try {
        const playerId = req.user.id;
        const { achievementId, value, context } = req.body;

        if (!achievementId) {
            return res.status(400).json({
                success: false,
                error: '성취 ID가 필요합니다'
            });
        }

        const result = await updateAchievementProgress(playerId, achievementId, value || 1, context);
        
        res.json({
            success: true,
            data: result
        });

    } catch (error) {
        logger.error('성취 진행상황 업데이트 실패:', error);
        res.status(500).json({
            success: false,
            error: '서버 오류가 발생했습니다'
        });
    }
});

/**
 * 성취 보상 수령
 * POST /api/achievements/:achievementId/claim
 */
router.post('/:achievementId/claim', async (req, res) => {
    try {
        const playerId = req.user.id;
        const { achievementId } = req.params;

        // 성취 완료 확인
        const playerAchievement = await DatabaseManager.get(`
            SELECT pa.*, at.rewards, at.name
            FROM player_achievements pa
            JOIN achievement_templates at ON pa.achievement_template_id = at.id
            WHERE pa.player_id = ? AND pa.achievement_template_id = ? AND pa.status = 'completed'
        `, [playerId, achievementId]);

        if (!playerAchievement) {
            return res.status(400).json({
                success: false,
                error: '완료되지 않은 성취입니다'
            });
        }

        // 이미 보상 수령했는지 확인
        const completion = await DatabaseManager.get(`
            SELECT * FROM achievement_completions 
            WHERE player_id = ? AND achievement_template_id = ?
        `, [playerId, achievementId]);

        if (completion) {
            return res.status(400).json({
                success: false,
                error: '이미 보상을 수령했습니다'
            });
        }

        // 보상 지급
        const rewards = JSON.parse(playerAchievement.rewards || '{}');
        let rewardSummary = [];

        if (rewards.money) {
            await DatabaseManager.run(`
                UPDATE players SET money = money + ? WHERE id = ?
            `, [rewards.money, playerId]);
            rewardSummary.push(`금화 ${rewards.money.toLocaleString()}원`);
        }

        if (rewards.exp) {
            await DatabaseManager.run(`
                UPDATE players SET experience = experience + ? WHERE id = ?
            `, [rewards.exp, playerId]);
            rewardSummary.push(`경험치 ${rewards.exp}`);
        }

        // 성취 완료 기록
        await DatabaseManager.run(`
            INSERT INTO achievement_completions (
                id, player_id, achievement_template_id, total_points
            ) VALUES (?, ?, ?, ?)
        `, [
            require('crypto').randomUUID(),
            playerId,
            achievementId,
            playerAchievement.points || 0
        ]);

        // 메트릭 기록
        metricsCollector.recordEvent('achievement_claimed', {
            achievementId,
            achievementName: playerAchievement.name,
            points: playerAchievement.points,
            rewards
        }, playerId);

        res.json({
            success: true,
            data: {
                achievement: playerAchievement.name,
                rewards: rewardSummary,
                points: playerAchievement.points,
                message: `성취 "${playerAchievement.name}" 보상을 수령했습니다!`
            }
        });

    } catch (error) {
        logger.error('성취 보상 수령 실패:', error);
        res.status(500).json({
            success: false,
            error: '서버 오류가 발생했습니다'
        });
    }
});

/**
 * 성취 진행상황 업데이트 함수
 */
async function updateAchievementProgress(playerId, achievementId, incrementValue = 1, context = {}) {
    try {
        // 성취 템플릿 조회
        const template = await DatabaseManager.get(`
            SELECT * FROM achievement_templates WHERE id = ? AND is_active = 1
        `, [achievementId]);

        if (!template) {
            return { success: false, error: '성취를 찾을 수 없습니다' };
        }

        const unlockCondition = JSON.parse(template.unlock_condition || '{}');
        const targetValue = unlockCondition.target || 1;

        // 현재 진행상황 조회 또는 생성
        let playerAchievement = await DatabaseManager.get(`
            SELECT * FROM player_achievements 
            WHERE player_id = ? AND achievement_template_id = ?
        `, [playerId, achievementId]);

        if (!playerAchievement) {
            // 새 성취 진행상황 생성
            const achievementUuid = require('crypto').randomUUID();
            await DatabaseManager.run(`
                INSERT INTO player_achievements (
                    id, player_id, achievement_template_id, status, current_value, target_value, unlocked_at
                ) VALUES (?, ?, ?, 'in_progress', 0, ?, CURRENT_TIMESTAMP)
            `, [achievementUuid, playerId, achievementId, targetValue]);

            playerAchievement = {
                id: achievementUuid,
                player_id: playerId,
                achievement_template_id: achievementId,
                status: 'in_progress',
                current_value: 0,
                target_value: targetValue,
                unlocked_at: new Date().toISOString()
            };
        }

        // 이미 완료된 성취인 경우 스킵
        if (playerAchievement.status === 'completed') {
            return { success: true, message: '이미 완료된 성취입니다', completed: false };
        }

        // 진행도 업데이트
        const newValue = Math.min(targetValue, playerAchievement.current_value + incrementValue);
        const isCompleted = newValue >= targetValue;
        const newStatus = isCompleted ? 'completed' : 'in_progress';

        await DatabaseManager.run(`
            UPDATE player_achievements 
            SET current_value = ?, status = ?, completed_at = ?
            WHERE id = ?
        `, [newValue, newStatus, isCompleted ? new Date().toISOString() : null, playerAchievement.id]);

        // 완료 시 메트릭 기록
        if (isCompleted) {
            metricsCollector.recordEvent('achievement_completed', {
                achievementId,
                achievementName: template.name,
                category: template.category,
                points: template.points,
                rarity: template.rarity
            }, playerId);

            logger.info(`성취 완료: ${playerId} - ${template.name}`);
        }

        return {
            success: true,
            completed: isCompleted,
            achievement: {
                id: achievementId,
                name: template.name,
                current_value: newValue,
                target_value: targetValue,
                progress_percentage: Math.round((newValue / targetValue) * 100)
            },
            message: isCompleted ? `성취 "${template.name}" 완료!` : '성취 진행도가 업데이트되었습니다'
        };

    } catch (error) {
        logger.error('성취 진행상황 업데이트 실패:', error);
        return { success: false, error: '성취 업데이트 중 오류가 발생했습니다' };
    }
}

// 유틸리티 함수 export
router.updateAchievementProgress = updateAchievementProgress;

module.exports = router;