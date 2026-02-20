// 📁 src/routes/api/merchant-chat.js
// AI 상인 채팅 엔드포인트
// POST /api/merchant-chat

const express = require('express');
const { body, validationResult } = require('express-validator');
const { authenticateToken } = require('../../middleware/auth');
const { sendMerchantChat } = require('../../services/merchantChatService');
const logger = require('../../config/logger');

const router = express.Router();

const VALID_MERCHANT_IDS = [
    'seoyena', 'alicegang', 'anipark', 'jinbaekho', 'jubulsu',
    'gijuri', 'katarinaChoi', 'mari', 'kimSehwi'
];

// POST /api/merchant-chat
router.post(
    '/',
    authenticateToken,
    [
        body('merchantId')
            .isString()
            .isIn(VALID_MERCHANT_IDS)
            .withMessage('유효하지 않은 상인 ID'),
        body('message')
            .isString()
            .trim()
            .notEmpty()
            .isLength({ max: 500 })
            .withMessage('메시지는 1~500자'),
        body('history')
            .optional()
            .isArray({ max: 20 })
            .withMessage('히스토리는 최대 20개')
    ],
    async (req, res) => {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({ error: errors.array()[0].msg });
        }

        const { merchantId, message, history = [] } = req.body;
        const userId = req.user?.userId;

        try {
            // 플레이어 컨텍스트는 간소화 (추후 DB 조회로 확장 가능)
            const playerContext = {
                level: req.user?.level ?? 1,
                completedEpisodes: [],
                relationshipLevel: 0
            };

            const result = await sendMerchantChat(merchantId, message, history, playerContext);

            res.json({
                reply: result.reply,
                unlockedEpisode: result.unlockedEpisode ?? null
            });
        } catch (error) {
            logger.error(`[merchant-chat] 오류 (user: ${userId}, merchant: ${merchantId}): ${error.message}`);

            if (error.message?.includes('알 수 없는 상인')) {
                return res.status(404).json({ error: '상인을 찾을 수 없습니다.' });
            }

            res.status(500).json({ error: 'AI 응답 생성에 실패했습니다. 잠시 후 다시 시도해주세요.' });
        }
    }
);

module.exports = router;
