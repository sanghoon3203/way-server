// 📁 src/routes/api/story.js - 스토리 진행/보상 관련 API
const express = require('express');
const { body, validationResult } = require('express-validator');
const { randomUUID } = require('crypto');
const DatabaseManager = require('../../database/DatabaseManager');
const { authenticateToken } = require('../../middleware/auth');
const StoryService = require('../../services/game/StoryService');
const logger = require('../../config/logger');

const router = express.Router();

router.use(authenticateToken);

router.post('/chapter/reward', [
    body('chapterId').isString().notEmpty().withMessage('chapterId는 필수입니다'),
    body('money').optional().isInt({ min: 0 }).withMessage('money는 0 이상의 정수여야 합니다'),
    body('experience').optional().isInt({ min: 0 }).withMessage('experience는 0 이상의 정수여야 합니다'),
    body('personalItemTemplateId').optional().isString().notEmpty().withMessage('personalItemTemplateId가 올바르지 않습니다'),
    body('keyItemName').optional().isString().notEmpty().withMessage('keyItemName이 올바르지 않습니다')
], async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({
            success: false,
            error: '잘못된 요청 데이터',
            details: errors.array()
        });
    }

    const playerId = req.user.playerId;
    const {
        chapterId,
        money = 0,
        experience = 0,
        personalItemTemplateId,
        keyItemName
    } = req.body;

    try {
        const progress = await StoryService.getPlayerStoryProgress(playerId);
        const flagKey = `chapter_reward_${chapterId}`;

        if (progress.storyFlags?.[flagKey]) {
            return res.status(409).json({
                success: false,
                error: '이미 보상을 수령한 챕터입니다'
            });
        }

        const rewardSummary = {
            moneyAdded: 0,
            experienceAdded: 0,
            personalItemGranted: null,
            keyItemFlag: null
        };

        if (money > 0) {
            await DatabaseManager.run(`
                UPDATE players SET money = money + ? WHERE id = ?
            `, [money, playerId]);
            rewardSummary.moneyAdded = money;
        }

        if (experience > 0) {
            await DatabaseManager.run(`
                UPDATE players SET experience = experience + ? WHERE id = ?
            `, [experience, playerId]);
            rewardSummary.experienceAdded = experience;
        }

        if (personalItemTemplateId) {
            const template = await DatabaseManager.get(`
                SELECT id, name FROM personal_item_templates WHERE id = ?
            `, [personalItemTemplateId]);

            if (!template) {
                return res.status(400).json({
                    success: false,
                    error: '유효하지 않은 personalItemTemplateId 입니다'
                });
            }

            const existingItem = await DatabaseManager.get(`
                SELECT id FROM player_personal_items
                WHERE player_id = ? AND item_template_id = ?
            `, [playerId, personalItemTemplateId]);

            if (existingItem) {
                rewardSummary.personalItemGranted = {
                    itemId: existingItem.id,
                    itemTemplateId: personalItemTemplateId,
                    name: template.name,
                    alreadyOwned: true
                };
            } else {
                const itemId = randomUUID();
                await DatabaseManager.run(`
                    INSERT INTO player_personal_items (
                        id, player_id, item_template_id, quantity, is_equipped
                    ) VALUES (?, ?, ?, 1, 0)
                `, [itemId, playerId, personalItemTemplateId]);

                rewardSummary.personalItemGranted = {
                    itemId,
                    itemTemplateId: personalItemTemplateId,
                    name: template.name,
                    alreadyOwned: false
                };
            }
        }

        if (keyItemName) {
            await StoryService.setStoryFlag(playerId, `key_item_${keyItemName}`, true);
            rewardSummary.keyItemFlag = keyItemName;
        }

        await StoryService.setStoryFlag(playerId, flagKey, true);

        res.json({
            success: true,
            data: {
                chapterId,
                rewardSummary
            }
        });
    } catch (error) {
        logger.error('챕터 보상 지급 실패', { error, playerId, chapterId });
        res.status(500).json({
            success: false,
            error: '서버 오류가 발생했습니다'
        });
    }
});

module.exports = router;
