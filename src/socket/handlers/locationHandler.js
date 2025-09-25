// 📁 src/socket/handlers/locationHandler.js - 위치 관련 Socket.IO 이벤트
const DatabaseManager = require('../../database/DatabaseManager');
const logger = require('../../config/logger');

/**
 * 위치를 기반으로 서울 구 구분
 */
function getDistrictFromLocation(lat, lng) {
    if (lat >= 37.5 && lat < 37.6 && lng >= 127.0 && lng < 127.1) {
        return 'gangnam';
    } else if (lat >= 37.5 && lat < 37.6 && lng >= 126.9 && lng < 127.0) {
        return 'jung';
    } else if (lat >= 37.5 && lat < 37.6 && lng >= 126.8 && lng < 126.9) {
        return 'mapo';
    } else if (lat >= 37.6 && lat < 37.7 && lng >= 126.9 && lng < 127.0) {
        return 'jongno';
    } else {
        return 'other';
    }
}

/**
 * 거리 계산 (하버사인 공식)
 */
function calculateDistance(lat1, lng1, lat2, lng2) {
    const R = 6371e3;
    const φ1 = lat1 * Math.PI/180;
    const φ2 = lat2 * Math.PI/180;
    const Δφ = (lat2-lat1) * Math.PI/180;
    const Δλ = (lng2-lng1) * Math.PI/180;

    const a = Math.sin(Δφ/2) * Math.sin(Δφ/2) +
              Math.cos(φ1) * Math.cos(φ2) *
              Math.sin(Δλ/2) * Math.sin(Δλ/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));

    return R * c;
}

/**
 * 위치 관련 이벤트 핸들러
 */
module.exports = (socket, io) => {
    
    /**
     * 플레이어 위치 업데이트
     */
    socket.on('location:update', async (data) => {
        try {
            const { lat, lng } = data;

            // 위치 유효성 검사
            if (!lat || !lng || lat < -90 || lat > 90 || lng < -180 || lng > 180) {
                socket.emit('error:location', {
                    code: 'INVALID_LOCATION',
                    message: '유효하지 않은 위치 정보입니다'
                });
                return;
            }

            // 데이터베이스에 위치 업데이트
            await DatabaseManager.run(`
                UPDATE players 
                SET current_lat = ?, current_lng = ?, last_active = CURRENT_TIMESTAMP
                WHERE id = ?
            `, [lat, lng, socket.playerId]);

            // 이전 구역과 새 구역 확인
            const oldDistrict = socket.currentDistrict;
            const newDistrict = getDistrictFromLocation(lat, lng);

            // 구역이 변경된 경우
            if (oldDistrict !== newDistrict) {
                // 이전 구역에서 나가기
                if (oldDistrict) {
                    socket.leave(`district:${oldDistrict}`);
                    socket.to(`district:${oldDistrict}`).emit('player:left_district', {
                        playerId: socket.playerId,
                        playerName: socket.playerData.name,
                        district: oldDistrict
                    });
                }

                // 새 구역에 참여
                socket.join(`district:${newDistrict}`);
                socket.currentDistrict = newDistrict;

                // 새 구역의 근처 상인 정보 조회
                const nearbyMerchants = await DatabaseManager.all(`
                    SELECT id, name, merchant_type, lat, lng, is_active
                    FROM merchants 
                    WHERE district = ? AND is_active = 1
                `, [newDistrict]);

                // 구역 변경 이벤트 전송
                socket.emit('location:district_changed', {
                    oldDistrict,
                    newDistrict,
                    nearbyMerchants: nearbyMerchants.map(m => ({
                        id: m.id,
                        name: m.name,
                        type: m.merchant_type,
                        location: { lat: m.lat, lng: m.lng },
                        distance: Math.round(calculateDistance(lat, lng, m.lat, m.lng))
                    })).filter(m => m.distance <= 1000) // 1km 이내만
                });

                // 새 구역의 다른 플레이어들에게 새 플레이어 입장 알림
                socket.to(`district:${newDistrict}`).emit('player:entered_district', {
                    playerId: socket.playerId,
                    playerName: socket.playerData.name,
                    district: newDistrict,
                    location: { lat, lng }
                });
            }

            // 같은 구역의 다른 플레이어들에게 위치 업데이트 전송
            socket.to(`district:${newDistrict}`).emit('player:location_update', {
                playerId: socket.playerId,
                playerName: socket.playerData.name,
                location: { lat, lng },
                timestamp: new Date().toISOString()
            });

            // 클라이언트에게 성공 응답
            socket.emit('location:update_success', {
                location: { lat, lng },
                district: newDistrict,
                timestamp: new Date().toISOString()
            });

            // 활동 로그 기록
            await DatabaseManager.run(`
                INSERT INTO activity_logs (player_id, action_type, details)
                VALUES (?, 'location_update', ?)
            `, [socket.playerId, JSON.stringify({ lat, lng, district: newDistrict })]);

        } catch (error) {
            logger.error('위치 업데이트 실패:', error);
            socket.emit('error:location', {
                code: 'UPDATE_FAILED',
                message: '위치 업데이트에 실패했습니다'
            });
        }
    });

    /**
     * 근처 플레이어 검색
     */
    socket.on('players:get_nearby', async (data) => {
        try {
            const { lat, lng, radius = 1000 } = data;

            if (!lat || !lng) {
                socket.emit('error:location', {
                    code: 'MISSING_LOCATION',
                    message: '위치 정보가 필요합니다'
                });
                return;
            }

            // 현재 온라인 플레이어들의 위치 정보 조회
            const onlinePlayers = [];
            const sockets = await io.fetchSockets();
            
            for (const otherSocket of sockets) {
                if (otherSocket.playerId !== socket.playerId && 
                    otherSocket.playerData.current_lat && 
                    otherSocket.playerData.current_lng) {
                    
                    const distance = calculateDistance(
                        lat, lng,
                        otherSocket.playerData.current_lat,
                        otherSocket.playerData.current_lng
                    );

                    if (distance <= radius) {
                        onlinePlayers.push({
                            playerId: otherSocket.playerId,
                            playerName: otherSocket.playerData.name,
                            level: otherSocket.playerData.level,
                            location: {
                                lat: otherSocket.playerData.current_lat,
                                lng: otherSocket.playerData.current_lng
                            },
                            distance: Math.round(distance)
                        });
                    }
                }
            }

            socket.emit('players:nearby_list', {
                players: onlinePlayers.sort((a, b) => a.distance - b.distance),
                total: onlinePlayers.length,
                searchRadius: radius
            });

        } catch (error) {
            logger.error('근처 플레이어 검색 실패:', error);
            socket.emit('error:location', {
                code: 'SEARCH_FAILED',
                message: '근처 플레이어 검색에 실패했습니다'
            });
        }
    });

    /**
     * 상인과의 거리 확인
     */
    socket.on('merchant:check_distance', async (data) => {
        try {
            const { merchantId, playerLat, playerLng } = data;

            if (!merchantId || !playerLat || !playerLng) {
                socket.emit('error:location', {
                    code: 'MISSING_DATA',
                    message: '필요한 데이터가 누락되었습니다'
                });
                return;
            }

            // 상인 위치 조회
            const merchant = await DatabaseManager.get(
                'SELECT id, name, lat, lng FROM merchants WHERE id = ? AND is_active = 1',
                [merchantId]
            );

            if (!merchant) {
                socket.emit('error:merchant', {
                    code: 'MERCHANT_NOT_FOUND',
                    message: '상인을 찾을 수 없습니다'
                });
                return;
            }

            const distance = calculateDistance(
                playerLat, playerLng,
                merchant.lat, merchant.lng
            );

            const canTrade = distance <= 400; // 400m 이내에서만 거래 가능

            socket.emit('merchant:distance_checked', {
                merchantId,
                merchantName: merchant.name,
                distance: Math.round(distance),
                canTrade,
                maxDistance: 400
            });

        } catch (error) {
            logger.error('상인 거리 확인 실패:', error);
            socket.emit('error:location', {
                code: 'DISTANCE_CHECK_FAILED',
                message: '거리 확인에 실패했습니다'
            });
        }
    });

};