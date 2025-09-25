// 📁 src/socket/handlers/tradeHandler.js - 거래 관련 Socket.IO 이벤트
const DatabaseManager = require('../../database/DatabaseManager');
const logger = require('../../config/logger');

/**
 * 거래 관련 이벤트 핸들러
 */
module.exports = (socket, io) => {

    /**
     * 거래 완료 알림 브로드캐스트
     */
    socket.on('trade:completed', async (tradeData) => {
        try {
            const { merchantId, itemName, tradeType, finalPrice, profit } = tradeData;

            // 거래 정보 검증
            if (!merchantId || !itemName || !tradeType || !finalPrice) {
                socket.emit('error:trade', {
                    code: 'INVALID_TRADE_DATA',
                    message: '거래 데이터가 올바르지 않습니다'
                });
                return;
            }

            // 상인 정보 조회
            const merchant = await DatabaseManager.get(
                'SELECT name, district FROM merchants WHERE id = ?',
                [merchantId]
            );

            if (!merchant) {
                socket.emit('error:trade', {
                    code: 'MERCHANT_NOT_FOUND',
                    message: '상인 정보를 찾을 수 없습니다'
                });
                return;
            }

            // 같은 지역의 플레이어들에게 거래 활동 알림
            if (socket.currentDistrict) {
                socket.to(`district:${socket.currentDistrict}`).emit('trade:nearby_activity', {
                    playerId: socket.playerId,
                    playerName: socket.playerData.name,
                    merchantName: merchant.name,
                    itemName,
                    tradeType,
                    isProfit: profit > 0,
                    district: merchant.district
                });
            }

            // 시장 가격 변동 시뮬레이션 (간단한 버전)
            const priceChange = Math.random() * 0.1 - 0.05; // -5% ~ +5%
            const trend = priceChange > 0.02 ? 'rising' : (priceChange < -0.02 ? 'falling' : 'stable');

            // 전체 플레이어들에게 시장 가격 업데이트 전송 (선택적)
            if (Math.abs(priceChange) > 0.03) { // 3% 이상 변동시에만
                io.emit('market:price_update', {
                    itemName,
                    priceChange: Math.round(priceChange * 100) / 100,
                    trend,
                    district: merchant.district
                });
            }

            // 활동 로그 기록
            await DatabaseManager.run(
                'INSERT INTO activity_logs (player_id, action_type, details) VALUES (?, ?, ?)',
                [socket.playerId, 'trade_completed', JSON.stringify({
                    merchantId,
                    merchantName: merchant.name,
                    itemName,
                    tradeType,
                    finalPrice,
                    profit
                })]
            );

            logger.info('거래 완료 알림 전송:', {
                playerId: socket.playerId,
                merchantId,
                itemName,
                tradeType,
                finalPrice
            });

        } catch (error) {
            logger.error('거래 완료 처리 실패:', error);
            socket.emit('error:trade', {
                code: 'TRADE_BROADCAST_FAILED',
                message: '거래 알림 전송에 실패했습니다'
            });
        }
    });

    /**
     * 거래 제안 (플레이어 간 거래)
     */
    socket.on('trade:offer', async (data) => {
        try {
            const { targetPlayerId, offeredItems, requestedItems, message } = data;

            if (!targetPlayerId) {
                socket.emit('error:trade', {
                    code: 'MISSING_TARGET',
                    message: '거래 대상을 지정해주세요'
                });
                return;
            }

            // 대상 플레이어가 온라인인지 확인
            const targetSocket = [...io.sockets.sockets.values()]
                .find(s => s.playerId === targetPlayerId);

            if (!targetSocket) {
                socket.emit('error:trade', {
                    code: 'TARGET_OFFLINE',
                    message: '대상 플레이어가 오프라인입니다'
                });
                return;
            }

            // 거래 제안 전송
            targetSocket.emit('trade:offer_received', {
                fromPlayerId: socket.playerId,
                fromPlayerName: socket.playerData.name,
                offeredItems,
                requestedItems,
                message,
                timestamp: new Date().toISOString()
            });

            // 제안한 플레이어에게 확인 메시지
            socket.emit('trade:offer_sent', {
                targetPlayerId,
                targetPlayerName: targetSocket.playerData.name,
                timestamp: new Date().toISOString()
            });

            logger.info('플레이어 간 거래 제안:', {
                from: socket.playerId,
                to: targetPlayerId
            });

        } catch (error) {
            logger.error('거래 제안 처리 실패:', error);
            socket.emit('error:trade', {
                code: 'OFFER_FAILED',
                message: '거래 제안 전송에 실패했습니다'
            });
        }
    });

    /**
     * 시장 가격 정보 요청
     */
    socket.on('market:get_prices', async (data) => {
        try {
            const { itemName, category } = data;

            let whereClause = '';
            let queryParams = [];

            if (itemName) {
                whereClause = 'WHERE it.name LIKE ?';
                queryParams.push(`%${itemName}%`);
            } else if (category) {
                whereClause = 'WHERE it.category = ?';
                queryParams.push(category);
            }

            // 최근 거래 기반 가격 정보 조회
            const priceData = await DatabaseManager.all(`
                SELECT 
                    it.name,
                    it.category,
                    AVG(tr.unit_price) as avg_price,
                    MIN(tr.unit_price) as min_price,
                    MAX(tr.unit_price) as max_price,
                    COUNT(tr.id) as trade_count
                FROM item_templates it
                LEFT JOIN trade_records tr ON it.id = tr.item_template_id 
                    AND tr.created_at > datetime('now', '-7 days')
                ${whereClause}
                GROUP BY it.id, it.name, it.category
                HAVING trade_count > 0
                ORDER BY trade_count DESC
                LIMIT 20
            `, queryParams);

            socket.emit('market:price_data', {
                items: priceData.map(item => ({
                    name: item.name,
                    category: item.category,
                    averagePrice: Math.round(item.avg_price || 0),
                    priceRange: {
                        min: item.min_price || 0,
                        max: item.max_price || 0
                    },
                    tradeVolume: item.trade_count,
                    trend: 'stable' // 추후 트렌드 계산 로직 추가
                })),
                timestamp: new Date().toISOString()
            });

        } catch (error) {
            logger.error('시장 가격 조회 실패:', error);
            socket.emit('error:market', {
                code: 'PRICE_FETCH_FAILED',
                message: '시장 가격 정보를 가져오는데 실패했습니다'
            });
        }
    });

};