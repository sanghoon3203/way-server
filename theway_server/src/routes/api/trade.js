// 📁 src/routes/api/trade.js - 거래 관련 API 라우트
const express = require('express');
const { body, validationResult } = require('express-validator');
const { randomUUID } = require('crypto');
const DatabaseManager = require('../../database/DatabaseManager');
const { authenticateToken } = require('../../middleware/auth');
const logger = require('../../config/logger');

const router = express.Router();

// 모든 거래 라우트에 인증 미들웨어 적용
router.use(authenticateToken);

/**
 * 거래 실행 (구매/판매)
 * POST /api/trade/execute
 */
router.post('/execute', [
    body('merchantId').notEmpty().withMessage('상인 ID가 필요합니다'),
    body('itemTemplateId').notEmpty().withMessage('아이템 ID가 필요합니다'),
    body('tradeType').isIn(['buy', 'sell']).withMessage('거래 타입은 buy 또는 sell이어야 합니다'),
    body('quantity').isInt({ min: 1 }).withMessage('수량은 1 이상이어야 합니다'),
    body('proposedPrice').isInt({ min: 1 }).withMessage('제안 가격이 필요합니다')
], async (req, res) => {
    try {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({
                success: false,
                error: '입력 데이터가 유효하지 않습니다',
                details: errors.array()
            });
        }

        const { merchantId, itemTemplateId, tradeType, quantity, proposedPrice } = req.body;
        const playerId = req.user.playerId;

        // 플레이어 정보 조회
        const player = await DatabaseManager.get(
            'SELECT * FROM players WHERE id = ?',
            [playerId]
        );

        // 상인 정보 조회
        const merchant = await DatabaseManager.get(
            'SELECT * FROM merchants WHERE id = ? AND is_active = 1',
            [merchantId]
        );

        if (!merchant) {
            return res.status(404).json({
                success: false,
                error: '상인을 찾을 수 없습니다'
            });
        }

        // 거래 권한 확인
        if (player.current_license < merchant.required_license) {
            return res.status(403).json({
                success: false,
                error: '라이센스 레벨이 부족합니다'
            });
        }

        if (player.reputation < merchant.reputation_requirement) {
            return res.status(403).json({
                success: false,
                error: '평판이 부족합니다'
            });
        }

        // 아이템 템플릿 정보 조회
        const itemTemplate = await DatabaseManager.get(
            'SELECT * FROM item_templates WHERE id = ?',
            [itemTemplateId]
        );

        if (!itemTemplate) {
            return res.status(404).json({
                success: false,
                error: '아이템을 찾을 수 없습니다'
            });
        }

        let finalPrice, experienceGained, profit = 0;
        let tradeQueries = [];

        if (tradeType === 'buy') {
            // === 구매 로직 ===
            
            // 상인 인벤토리에서 아이템 확인
            const merchantItem = await DatabaseManager.get(
                'SELECT * FROM merchant_inventory WHERE merchant_id = ? AND item_template_id = ? AND quantity >= ?',
                [merchantId, itemTemplateId, quantity]
            );

            if (!merchantItem) {
                return res.status(400).json({
                    success: false,
                    error: '상인이 해당 아이템을 충분히 보유하고 있지 않습니다'
                });
            }

            // 가격 계산 (상인의 가격 수정자 적용)
            finalPrice = Math.round(merchantItem.current_price * quantity * merchant.price_modifier);
            
            // 협상 시뮬레이션 (간단한 버전)
            const negotiationSuccess = Math.random() < (player.negotiation_skill / 100) * 0.3;
            if (negotiationSuccess && proposedPrice < finalPrice) {
                finalPrice = Math.max(proposedPrice, Math.round(finalPrice * 0.85));
            }

            // 플레이어 돈 확인
            if (player.money < finalPrice) {
                return res.status(400).json({
                    success: false,
                    error: '돈이 부족합니다'
                });
            }

            // 인벤토리 공간 확인
            const currentInventoryCount = await DatabaseManager.get(
                'SELECT COUNT(*) as count FROM player_items WHERE player_id = ? AND storage_type = ?',
                [playerId, 'inventory']
            );

            if (currentInventoryCount.count >= player.max_inventory_size) {
                return res.status(400).json({
                    success: false,
                    error: '인벤토리가 가득 찼습니다'
                });
            }

            experienceGained = Math.round(finalPrice / 1000) + quantity;

            tradeQueries = [
                // 플레이어 돈 차감 및 경험치 추가
                {
                    sql: 'UPDATE players SET money = money - ?, experience = experience + ?, total_trades = total_trades + 1 WHERE id = ?',
                    params: [finalPrice, experienceGained, playerId]
                },
                // 상인 인벤토리에서 아이템 차감
                {
                    sql: 'UPDATE merchant_inventory SET quantity = quantity - ? WHERE id = ?',
                    params: [quantity, merchantItem.id]
                },
                // 플레이어 인벤토리에 아이템 추가
                {
                    sql: `INSERT INTO player_items (id, player_id, item_template_id, quantity, storage_type, purchase_price, purchase_date)
                          VALUES (?, ?, ?, ?, 'inventory', ?, CURRENT_TIMESTAMP)`,
                    params: [randomUUID(), playerId, itemTemplateId, quantity, Math.round(finalPrice / quantity)]
                }
            ];

        } else {
            // === 판매 로직 ===
            
            // 플레이어가 해당 아이템을 보유하고 있는지 확인
            const playerItem = await DatabaseManager.get(
                'SELECT * FROM player_items WHERE player_id = ? AND item_template_id = ? AND quantity >= ?',
                [playerId, itemTemplateId, quantity]
            );

            if (!playerItem) {
                return res.status(400).json({
                    success: false,
                    error: '해당 아이템을 충분히 보유하고 있지 않습니다'
                });
            }

            // 판매 가격 계산 (보통 구매가보다 낮음)
            finalPrice = Math.round(itemTemplate.base_price * quantity * merchant.price_modifier * 0.8);
            
            // 협상 시뮬레이션
            const negotiationSuccess = Math.random() < (player.negotiation_skill / 100) * 0.3;
            if (negotiationSuccess && proposedPrice > finalPrice) {
                finalPrice = Math.min(proposedPrice, Math.round(finalPrice * 1.2));
            }

            // 수익 계산
            if (playerItem.purchase_price) {
                profit = finalPrice - (playerItem.purchase_price * quantity);
            }

            experienceGained = Math.round(finalPrice / 1500) + quantity;

            tradeQueries = [
                // 플레이어 돈 추가 및 경험치 추가
                {
                    sql: 'UPDATE players SET money = money + ?, experience = experience + ?, total_trades = total_trades + 1, total_profit = total_profit + ? WHERE id = ?',
                    params: [finalPrice, experienceGained, profit, playerId]
                }
            ];

            // 아이템 제거 또는 수량 감소
            if (playerItem.quantity <= quantity) {
                tradeQueries.push({
                    sql: 'DELETE FROM player_items WHERE id = ?',
                    params: [playerItem.id]
                });
            } else {
                tradeQueries.push({
                    sql: 'UPDATE player_items SET quantity = quantity - ? WHERE id = ?',
                    params: [quantity, playerItem.id]
                });
            }

            // 상인 인벤토리에 아이템 추가 또는 업데이트
            const existingMerchantItem = await DatabaseManager.get(
                'SELECT * FROM merchant_inventory WHERE merchant_id = ? AND item_template_id = ?',
                [merchantId, itemTemplateId]
            );

            if (existingMerchantItem) {
                tradeQueries.push({
                    sql: 'UPDATE merchant_inventory SET quantity = quantity + ?, current_price = ?, last_updated = CURRENT_TIMESTAMP WHERE id = ?',
                    params: [quantity, itemTemplate.base_price, existingMerchantItem.id]
                });
            } else {
                tradeQueries.push({
                    sql: `INSERT INTO merchant_inventory (id, merchant_id, item_template_id, quantity, current_price)
                          VALUES (?, ?, ?, ?, ?)`,
                    params: [randomUUID(), merchantId, itemTemplateId, quantity, itemTemplate.base_price]
                });
            }
        }

        // 거래 기록 추가
        const tradeRecordId = randomUUID();
        tradeQueries.push({
            sql: `INSERT INTO trade_records (id, player_id, merchant_id, item_template_id, trade_type, quantity, unit_price, total_price, profit, experience_gained)
                  VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            params: [tradeRecordId, playerId, merchantId, itemTemplateId, tradeType, quantity, Math.round(finalPrice / quantity), finalPrice, profit, experienceGained]
        });

        // 상인 관계 업데이트
        const relationshipChange = { friendship: tradeType === 'buy' ? 2 : 1, trust: 1 };
        tradeQueries.push({
            sql: `INSERT OR REPLACE INTO merchant_relationships 
                  (id, player_id, merchant_id, friendship_points, trust_level, total_trades, total_spent, last_interaction)
                  VALUES (?, ?, ?, 
                         COALESCE((SELECT friendship_points FROM merchant_relationships WHERE player_id = ? AND merchant_id = ?), 0) + ?,
                         COALESCE((SELECT trust_level FROM merchant_relationships WHERE player_id = ? AND merchant_id = ?), 0) + ?,
                         COALESCE((SELECT total_trades FROM merchant_relationships WHERE player_id = ? AND merchant_id = ?), 0) + 1,
                         COALESCE((SELECT total_spent FROM merchant_relationships WHERE player_id = ? AND merchant_id = ?), 0) + ?,
                         CURRENT_TIMESTAMP)`,
            params: [
                randomUUID(), playerId, merchantId,
                playerId, merchantId, relationshipChange.friendship,
                playerId, merchantId, relationshipChange.trust,
                playerId, merchantId,
                playerId, merchantId, tradeType === 'buy' ? finalPrice : 0
            ]
        });

        // 트랜잭션 실행
        await DatabaseManager.transaction(tradeQueries);

        logger.info('거래 완료:', { 
            playerId, merchantId, itemTemplateId, tradeType, quantity, finalPrice, profit 
        });

        res.json({
            success: true,
            message: '거래가 완료되었습니다',
            data: {
                tradeId: tradeRecordId,
                tradeType,
                itemName: itemTemplate.name,
                quantity,
                finalPrice,
                profit,
                experienceGained,
                relationshipChange,
                timestamp: new Date().toISOString()
            }
        });

    } catch (error) {
        logger.error('거래 실행 실패:', error);
        res.status(500).json({
            success: false,
            error: '거래 처리 중 오류가 발생했습니다'
        });
    }
});

/**
 * 거래 이력 조회
 * GET /api/trade/history
 */
router.get('/history', async (req, res) => {
    try {
        const playerId = req.user.playerId;
        const { page = 1, limit = 20, type = 'all' } = req.query;

        let whereClause = 'WHERE tr.player_id = ?';
        let queryParams = [playerId];

        if (type !== 'all' && ['buy', 'sell'].includes(type)) {
            whereClause += ' AND tr.trade_type = ?';
            queryParams.push(type);
        }

        const offset = (page - 1) * limit;

        // 거래 이력 조회
        const trades = await DatabaseManager.all(`
            SELECT 
                tr.*,
                it.name as item_name,
                it.category,
                it.icon_id,
                m.name as merchant_name,
                m.district
            FROM trade_records tr
            JOIN item_templates it ON tr.item_template_id = it.id
            JOIN merchants m ON tr.merchant_id = m.id
            ${whereClause}
            ORDER BY tr.created_at DESC
            LIMIT ? OFFSET ?
        `, [...queryParams, parseInt(limit), offset]);

        // 전체 개수 조회
        const totalResult = await DatabaseManager.get(`
            SELECT COUNT(*) as total
            FROM trade_records tr
            ${whereClause}
        `, queryParams);

        const totalPages = Math.ceil(totalResult.total / limit);

        res.json({
            success: true,
            data: {
                trades: trades.map(trade => ({
                    id: trade.id,
                    tradeType: trade.trade_type,
                    itemName: trade.item_name,
                    category: trade.category,
                    iconId: trade.icon_id,
                    merchantName: trade.merchant_name,
                    district: trade.district,
                    quantity: trade.quantity,
                    unitPrice: trade.unit_price,
                    totalPrice: trade.total_price,
                    profit: trade.profit,
                    experienceGained: trade.experience_gained,
                    createdAt: trade.created_at
                })),
                pagination: {
                    currentPage: parseInt(page),
                    totalPages,
                    totalItems: totalResult.total,
                    itemsPerPage: parseInt(limit),
                    hasNextPage: page < totalPages,
                    hasPrevPage: page > 1
                }
            }
        });

    } catch (error) {
        logger.error('거래 이력 조회 실패:', error);
        res.status(500).json({
            success: false,
            error: '서버 오류가 발생했습니다'
        });
    }
});

/**
 * 시장 가격 정보 조회
 * GET /api/trade/market-prices
 */
router.get('/market-prices', async (req, res) => {
    try {
        const { category, district } = req.query;

        let whereClause = '';
        let queryParams = [];

        if (category) {
            whereClause += ' WHERE it.category = ?';
            queryParams.push(category);
        }

        if (district) {
            const districtClause = category ? ' AND m.district = ?' : ' WHERE m.district = ?';
            whereClause += districtClause;
            queryParams.push(district);
        }

        // 최근 거래 기반 시장 가격 계산
        const marketPrices = await DatabaseManager.all(`
            SELECT 
                it.id,
                it.name,
                it.category,
                it.base_price,
                AVG(tr.unit_price) as average_price,
                MIN(tr.unit_price) as min_price,
                MAX(tr.unit_price) as max_price,
                COUNT(tr.id) as trade_count,
                MAX(tr.created_at) as last_trade
            FROM item_templates it
            LEFT JOIN trade_records tr ON it.id = tr.item_template_id 
            LEFT JOIN merchants m ON tr.merchant_id = m.id
            ${whereClause}
            GROUP BY it.id, it.name, it.category, it.base_price
            HAVING trade_count > 0
            ORDER BY trade_count DESC, it.name
        `, queryParams);

        // 가격 트렌드 계산 (간단한 버전)
        const pricesWithTrend = marketPrices.map(item => {
            let trend = 'stable';
            if (item.average_price > item.base_price * 1.1) {
                trend = 'rising';
            } else if (item.average_price < item.base_price * 0.9) {
                trend = 'falling';
            }

            return {
                itemId: item.id,
                name: item.name,
                category: item.category,
                basePrice: item.base_price,
                averagePrice: Math.round(item.average_price),
                priceRange: {
                    min: item.min_price,
                    max: item.max_price
                },
                trend,
                tradeVolume: item.trade_count,
                lastTrade: item.last_trade
            };
        });

        res.json({
            success: true,
            data: {
                marketPrices: pricesWithTrend,
                total: pricesWithTrend.length,
                filters: { category, district }
            }
        });

    } catch (error) {
        logger.error('시장 가격 조회 실패:', error);
        res.status(500).json({
            success: false,
            error: '서버 오류가 발생했습니다'
        });
    }
});

module.exports = router;