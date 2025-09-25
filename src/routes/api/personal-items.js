// 📁 src/routes/api/personal-items.js - 개인 아이템 관련 API 라우트
const express = require('express');
const { query, body, validationResult } = require('express-validator');
const DatabaseManager = require('../../database/DatabaseManager');
const { authenticateToken } = require('../../middleware/auth');
const logger = require('../../config/logger');

const router = express.Router();

// 모든 개인 아이템 라우트에 인증 미들웨어 적용
router.use(authenticateToken);

/**
 * 플레이어 개인 아이템 목록 조회
 * GET /api/personal-items
 */
router.get('/', async (req, res) => {
    try {
        const playerId = req.user.playerId;

        // 플레이어의 개인 아이템 조회
        const personalItems = await DatabaseManager.all(`
            SELECT
                ppi.*,
                pit.name,
                pit.type,
                pit.grade,
                pit.max_stack,
                pit.cooldown,
                pit.usage_limit,
                pit.equip_slot,
                pit.description,
                pit.icon_id
            FROM player_personal_items ppi
            JOIN personal_item_templates pit ON ppi.item_template_id = pit.id
            WHERE ppi.player_id = ? AND pit.is_active = 1
            ORDER BY pit.type, pit.grade DESC, pit.name
        `, [playerId]);

        // 각 아이템의 효과 정보 조회
        const itemsWithEffects = await Promise.all(personalItems.map(async (item) => {
            const effects = await DatabaseManager.all(`
                SELECT effect_type, effect_value, duration, description
                FROM item_effects
                WHERE item_template_id = ?
            `, [item.item_template_id]);

            // 쿨타임 확인
            const canUse = await checkItemCooldown(playerId, item.item_template_id);

            // 일일 사용 제한 확인
            const usageToday = await getDailyUsageCount(playerId, item.item_template_id);
            const canUseToday = !item.usage_limit || usageToday < item.usage_limit;

            return {
                id: item.id,
                itemTemplateId: item.item_template_id,
                name: item.name,
                type: item.type,
                grade: item.grade,
                quantity: item.quantity,
                maxStack: item.max_stack,
                cooldown: item.cooldown,
                usageLimit: item.usage_limit,
                isEquipped: Boolean(item.is_equipped),
                equipSlot: item.equip_slot,
                description: item.description,
                iconId: item.icon_id,
                effects: effects.map(effect => ({
                    type: effect.effect_type,
                    value: effect.effect_value,
                    duration: effect.duration,
                    description: effect.description
                })),
                lastUsed: item.last_used,
                canUse: canUse && canUseToday,
                usageToday: usageToday,
                acquiredAt: item.acquired_at
            };
        }));

        res.json({
            success: true,
            data: {
                personalItems: itemsWithEffects,
                total: itemsWithEffects.length
            }
        });

    } catch (error) {
        logger.error('개인 아이템 목록 조회 실패:', error);
        res.status(500).json({
            success: false,
            error: '서버 오류가 발생했습니다'
        });
    }
});

/**
 * 아이템 사용
 * POST /api/personal-items/:itemId/use
 */
router.post('/:itemId/use', [
    body('quantity')
        .optional()
        .isInt({ min: 1, max: 100 })
        .withMessage('수량은 1-100 사이여야 합니다')
], async (req, res) => {
    try {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({
                success: false,
                error: '잘못된 요청 데이터',
                details: errors.array()
            });
        }

        const { itemId } = req.params;
        const { quantity = 1 } = req.body;
        const playerId = req.user.playerId;

        // 아이템 정보 조회
        const item = await DatabaseManager.get(`
            SELECT
                ppi.*,
                pit.name,
                pit.type,
                pit.cooldown,
                pit.usage_limit
            FROM player_personal_items ppi
            JOIN personal_item_templates pit ON ppi.item_template_id = pit.id
            WHERE ppi.id = ? AND ppi.player_id = ?
        `, [itemId, playerId]);

        if (!item) {
            return res.status(404).json({
                success: false,
                error: '아이템을 찾을 수 없습니다'
            });
        }

        // 소비 아이템이 아닌 경우 사용 불가
        if (item.type !== 'consumable') {
            return res.status(400).json({
                success: false,
                error: '이 아이템은 사용할 수 없습니다'
            });
        }

        // 수량 확인
        if (item.quantity < quantity) {
            return res.status(400).json({
                success: false,
                error: '수량이 부족합니다'
            });
        }

        // 쿨타임 확인
        const canUse = await checkItemCooldown(playerId, item.item_template_id);
        if (!canUse) {
            return res.status(400).json({
                success: false,
                error: '아직 쿨타임이 끝나지 않았습니다'
            });
        }

        // 일일 사용 제한 확인
        const usageToday = await getDailyUsageCount(playerId, item.item_template_id);
        if (item.usage_limit && (usageToday + quantity) > item.usage_limit) {
            return res.status(400).json({
                success: false,
                error: '일일 사용 제한을 초과했습니다'
            });
        }

        // 아이템 효과 적용
        const effects = await DatabaseManager.all(`
            SELECT effect_type, effect_value, duration
            FROM item_effects
            WHERE item_template_id = ?
        `, [item.item_template_id]);

        const appliedEffects = [];

        for (const effect of effects) {
            const result = await applyItemEffect(playerId, item.item_template_id, effect, quantity);
            if (result.success) {
                appliedEffects.push(result.effect);
            }
        }

        // 아이템 수량 감소
        const newQuantity = item.quantity - quantity;
        if (newQuantity > 0) {
            await DatabaseManager.run(`
                UPDATE player_personal_items
                SET quantity = ?, last_used = CURRENT_TIMESTAMP
                WHERE id = ?
            `, [newQuantity, itemId]);
        } else {
            // 수량이 0이 되면 아이템 삭제
            await DatabaseManager.run(`
                DELETE FROM player_personal_items WHERE id = ?
            `, [itemId]);
        }

        // 사용 로그 기록
        await DatabaseManager.run(`
            INSERT INTO item_usage_log (player_id, item_template_id, action_type, quantity_used, effect_applied)
            VALUES (?, ?, 'use', ?, ?)
        `, [playerId, item.item_template_id, quantity, JSON.stringify(appliedEffects)]);

        // 일일 사용 횟수 업데이트
        await updateDailyUsageCount(playerId, item.item_template_id, quantity);

        res.json({
            success: true,
            data: {
                message: `${item.name}을(를) ${quantity}개 사용했습니다`,
                appliedEffects: appliedEffects,
                remainingQuantity: newQuantity
            }
        });

    } catch (error) {
        logger.error('아이템 사용 실패:', error);
        res.status(500).json({
            success: false,
            error: '서버 오류가 발생했습니다'
        });
    }
});

/**
 * 장비 아이템 장착/해제
 * POST /api/personal-items/:itemId/equip
 */
router.post('/:itemId/equip', async (req, res) => {
    try {
        const { itemId } = req.params;
        const playerId = req.user.playerId;

        // 아이템 정보 조회
        const item = await DatabaseManager.get(`
            SELECT
                ppi.*,
                pit.name,
                pit.type,
                pit.equip_slot
            FROM player_personal_items ppi
            JOIN personal_item_templates pit ON ppi.item_template_id = pit.id
            WHERE ppi.id = ? AND ppi.player_id = ?
        `, [itemId, playerId]);

        if (!item) {
            return res.status(404).json({
                success: false,
                error: '아이템을 찾을 수 없습니다'
            });
        }

        if (item.type !== 'equipment') {
            return res.status(400).json({
                success: false,
                error: '이 아이템은 장착할 수 없습니다'
            });
        }

        const isCurrentlyEquipped = Boolean(item.is_equipped);
        const targetEquipSlot = item.equip_slot;

        if (isCurrentlyEquipped) {
            // 장착 해제
            await DatabaseManager.run(`
                UPDATE player_personal_items
                SET is_equipped = FALSE, equip_slot = NULL
                WHERE id = ?
            `, [itemId]);

            // 사용 로그 기록
            await DatabaseManager.run(`
                INSERT INTO item_usage_log (player_id, item_template_id, action_type)
                VALUES (?, ?, 'unequip')
            `, [playerId, item.item_template_id]);

            res.json({
                success: true,
                data: {
                    message: `${item.name}을(를) 해제했습니다`,
                    isEquipped: false
                }
            });

        } else {
            // 같은 슬롯에 장착된 다른 아이템 해제
            if (targetEquipSlot) {
                await DatabaseManager.run(`
                    UPDATE player_personal_items
                    SET is_equipped = FALSE, equip_slot = NULL
                    WHERE player_id = ? AND equip_slot = ? AND is_equipped = TRUE
                `, [playerId, targetEquipSlot]);
            }

            // 새 아이템 장착
            await DatabaseManager.run(`
                UPDATE player_personal_items
                SET is_equipped = TRUE, equip_slot = ?
                WHERE id = ?
            `, [targetEquipSlot, itemId]);

            // 사용 로그 기록
            await DatabaseManager.run(`
                INSERT INTO item_usage_log (player_id, item_template_id, action_type)
                VALUES (?, ?, 'equip')
            `, [playerId, item.item_template_id]);

            res.json({
                success: true,
                data: {
                    message: `${item.name}을(를) 장착했습니다`,
                    isEquipped: true,
                    equipSlot: targetEquipSlot
                }
            });
        }

    } catch (error) {
        logger.error('아이템 장착/해제 실패:', error);
        res.status(500).json({
            success: false,
            error: '서버 오류가 발생했습니다'
        });
    }
});

/**
 * 플레이어 활성 효과 조회
 * GET /api/personal-items/active-effects
 */
router.get('/active-effects', async (req, res) => {
    try {
        const playerId = req.user.playerId;

        // 만료된 효과 정리
        await DatabaseManager.run(`
            DELETE FROM player_active_effects
            WHERE expires_at <= DATETIME('now')
        `);

        // 활성 효과 조회
        const activeEffects = await DatabaseManager.all(`
            SELECT
                pae.*,
                pit.name as item_name
            FROM player_active_effects pae
            JOIN personal_item_templates pit ON pae.item_template_id = pit.id
            WHERE pae.player_id = ? AND pae.expires_at > DATETIME('now')
            ORDER BY pae.expires_at ASC
        `, [playerId]);

        // 장착된 아이템의 영구 효과도 포함
        const equippedEffects = await DatabaseManager.all(`
            SELECT
                ie.effect_type,
                ie.effect_value,
                ie.duration,
                pit.name as item_name,
                ppi.item_template_id
            FROM player_personal_items ppi
            JOIN personal_item_templates pit ON ppi.item_template_id = pit.id
            JOIN item_effects ie ON pit.id = ie.item_template_id
            WHERE ppi.player_id = ? AND ppi.is_equipped = TRUE AND ie.duration = -1
        `, [playerId]);

        res.json({
            success: true,
            data: {
                temporaryEffects: activeEffects.map(effect => ({
                    id: effect.id,
                    itemTemplateId: effect.item_template_id,
                    itemName: effect.item_name,
                    effectType: effect.effect_type,
                    effectValue: effect.effect_value,
                    startTime: effect.start_time,
                    duration: effect.duration,
                    expiresAt: effect.expires_at,
                    remainingTime: Math.max(0, Math.floor((new Date(effect.expires_at) - new Date()) / 1000))
                })),
                permanentEffects: equippedEffects.map(effect => ({
                    itemTemplateId: effect.item_template_id,
                    itemName: effect.item_name,
                    effectType: effect.effect_type,
                    effectValue: effect.effect_value,
                    isPermanent: true
                }))
            }
        });

    } catch (error) {
        logger.error('활성 효과 조회 실패:', error);
        res.status(500).json({
            success: false,
            error: '서버 오류가 발생했습니다'
        });
    }
});

// =================== 헬퍼 함수들 ===================

/**
 * 아이템 쿨타임 확인
 */
async function checkItemCooldown(playerId, itemTemplateId) {
    const lastUsage = await DatabaseManager.get(`
        SELECT MAX(used_at) as last_used
        FROM item_usage_log
        WHERE player_id = ? AND item_template_id = ? AND action_type = 'use'
    `, [playerId, itemTemplateId]);

    if (!lastUsage || !lastUsage.last_used) {
        return true; // 처음 사용하는 경우
    }

    const template = await DatabaseManager.get(`
        SELECT cooldown FROM personal_item_templates WHERE id = ?
    `, [itemTemplateId]);

    if (!template || !template.cooldown) {
        return true; // 쿨타임이 없는 경우
    }

    const lastUsedTime = new Date(lastUsage.last_used);
    const now = new Date();
    const cooldownMs = template.cooldown * 1000;

    return (now - lastUsedTime) >= cooldownMs;
}

/**
 * 일일 사용 횟수 조회
 */
async function getDailyUsageCount(playerId, itemTemplateId) {
    const today = new Date().toISOString().split('T')[0];

    const count = await DatabaseManager.get(`
        SELECT COALESCE(SUM(quantity_used), 0) as usage_count
        FROM item_usage_log
        WHERE player_id = ? AND item_template_id = ?
        AND action_type = 'use' AND DATE(used_at) = ?
    `, [playerId, itemTemplateId, today]);

    return count ? count.usage_count : 0;
}

/**
 * 일일 사용 횟수 업데이트
 */
async function updateDailyUsageCount(playerId, itemTemplateId, quantity) {
    const today = new Date().toISOString().split('T')[0];

    await DatabaseManager.run(`
        UPDATE player_personal_items
        SET usage_count_today = usage_count_today + ?,
            usage_reset_date = ?
        WHERE player_id = ? AND item_template_id = ?
        AND usage_reset_date != ?
    `, [quantity, today, playerId, itemTemplateId, today]);
}

/**
 * 아이템 효과 적용
 */
async function applyItemEffect(playerId, itemTemplateId, effect, quantity) {
    try {
        const { effect_type, effect_value, duration } = effect;
        const totalValue = effect_value * quantity;

        switch (effect_type) {
            case 'health_boost':
                // 즉시 체력 회복 (플레이어 테이블에 health 컬럼이 있다고 가정)
                // 실제로는 게임 로직에 맞게 구현
                break;

            case 'movement_speed':
            case 'experience_bonus':
            case 'trade_success_rate':
            case 'negotiation_power':
            case 'appraisal_bonus':
                if (duration > 0) {
                    // 지속시간이 있는 효과는 active_effects 테이블에 저장
                    const expiresAt = new Date(Date.now() + duration * 1000);

                    await DatabaseManager.run(`
                        INSERT INTO player_active_effects
                        (player_id, item_template_id, effect_type, effect_value, duration, expires_at)
                        VALUES (?, ?, ?, ?, ?, ?)
                    `, [playerId, itemTemplateId, effect_type, totalValue, duration, expiresAt.toISOString()]);
                }
                break;

            case 'instant_teleport':
                // 순간이동 로직 (별도 구현 필요)
                break;

            case 'price_visibility':
                // 가격 정보 표시 로직 (별도 구현 필요)
                break;
        }

        return {
            success: true,
            effect: {
                type: effect_type,
                value: totalValue,
                duration: duration
            }
        };

    } catch (error) {
        logger.error('아이템 효과 적용 실패:', error);
        return { success: false, error: error.message };
    }
}

module.exports = router;