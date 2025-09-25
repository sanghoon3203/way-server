// 📁 src/socket/handlers/index.js - Socket.IO 핸들러 메인
const jwt = require('jsonwebtoken');
const DatabaseManager = require('../../database/DatabaseManager');
const logger = require('../../config/logger');

// 개별 핸들러 모듈
const locationHandler = require('./locationHandler');
const tradeHandler = require('./tradeHandler');
const chatHandler = require('./chatHandler');

/**
 * Socket.IO 인증 미들웨어
 */
const socketAuth = async (socket, next) => {
    try {
        const token = socket.handshake.auth.token;
        
        if (!token) {
            return next(new Error('Authentication token required'));
        }

        // JWT 토큰 검증
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        
        // 사용자 정보 조회
        const user = await DatabaseManager.get(
            'SELECT id, is_active FROM users WHERE id = ?',
            [decoded.userId]
        );

        if (!user || !user.is_active) {
            return next(new Error('Invalid user'));
        }

        // 플레이어 정보 조회
        const player = await DatabaseManager.get(
            'SELECT * FROM players WHERE id = ?',
            [decoded.playerId]
        );

        if (!player) {
            return next(new Error('Player not found'));
        }

        // 소켓에 사용자 정보 저장
        socket.userId = user.id;
        socket.playerId = player.id;
        socket.playerData = player;
        
        next();

    } catch (error) {
        logger.error('Socket authentication failed:', error);
        next(new Error('Authentication failed'));
    }
};

/**
 * 메인 Socket.IO 핸들러 등록
 */
module.exports = (io) => {
    // 인증 미들웨어 등록
    io.use(socketAuth);

    io.on('connection', (socket) => {
        logger.info('플레이어 연결됨:', {
            socketId: socket.id,
            playerId: socket.playerId,
            playerName: socket.playerData.name
        });

        // 플레이어를 기본 룸에 추가
        socket.join(`player:${socket.playerId}`);
        
        // 플레이어가 위치 정보가 있다면 지역 룸에도 추가
        if (socket.playerData.current_lat && socket.playerData.current_lng) {
            const district = getDistrictFromLocation(
                socket.playerData.current_lat, 
                socket.playerData.current_lng
            );
            socket.join(`district:${district}`);
            socket.currentDistrict = district;
        }

        // 연결 시 환영 메시지
        socket.emit('connection:success', {
            message: '서버에 성공적으로 연결되었습니다',
            playerId: socket.playerId,
            playerName: socket.playerData.name,
            timestamp: new Date().toISOString()
        });

        // =================================================================
        // 핸들러 등록
        // =================================================================

        // 위치 관련 이벤트
        locationHandler(socket, io);

        // 거래 관련 이벤트
        tradeHandler(socket, io);

        // 채팅 관련 이벤트
        chatHandler(socket, io);

        // =================================================================
        // 기본 이벤트 처리
        // =================================================================

        // 핑-퐁 (연결 상태 확인)
        socket.on('ping', () => {
            socket.emit('pong', { timestamp: new Date().toISOString() });
        });

        // 플레이어 상태 업데이트
        socket.on('player:status_update', async (data) => {
            try {
                await DatabaseManager.run(
                    'UPDATE players SET last_active = CURRENT_TIMESTAMP WHERE id = ?',
                    [socket.playerId]
                );

                // 같은 지역의 다른 플레이어들에게 상태 업데이트 전송
                if (socket.currentDistrict) {
                    socket.to(`district:${socket.currentDistrict}`).emit('player:status_changed', {
                        playerId: socket.playerId,
                        playerName: socket.playerData.name,
                        status: data.status,
                        timestamp: new Date().toISOString()
                    });
                }

            } catch (error) {
                logger.error('플레이어 상태 업데이트 실패:', error);
                socket.emit('error:general', {
                    code: 'STATUS_UPDATE_FAILED',
                    message: '상태 업데이트에 실패했습니다'
                });
            }
        });

        // 에러 처리
        socket.on('error', (error) => {
            logger.error(`Socket 에러 - 플레이어 ${socket.playerId}:`, error);
        });

        // 연결 해제 처리
        socket.on('disconnect', async (reason) => {
            logger.info('플레이어 연결 해제:', {
                socketId: socket.id,
                playerId: socket.playerId,
                playerName: socket.playerData.name,
                reason
            });

            try {
                // 마지막 활동 시간 업데이트
                await DatabaseManager.run(
                    'UPDATE players SET last_active = CURRENT_TIMESTAMP WHERE id = ?',
                    [socket.playerId]
                );

                // 지역 채널에서 플레이어 나감 알림
                if (socket.currentDistrict) {
                    socket.to(`district:${socket.currentDistrict}`).emit('player:left', {
                        playerId: socket.playerId,
                        playerName: socket.playerData.name,
                        timestamp: new Date().toISOString()
                    });
                }

                // 활동 로그 기록
                await DatabaseManager.run(
                    'INSERT INTO activity_logs (player_id, action_type, details) VALUES (?, ?, ?)',
                    [socket.playerId, 'disconnect', JSON.stringify({ reason, timestamp: new Date().toISOString() })]
                );

            } catch (error) {
                logger.error('연결 해제 처리 중 오류:', error);
            }
        });
    });

    // 전역 이벤트 (모든 연결된 클라이언트에게)
    const broadcastSystemMessage = (message, type = 'info') => {
        io.emit('system:announcement', {
            message,
            type,
            timestamp: new Date().toISOString()
        });
    };

    // 서버 종료 시 모든 클라이언트에게 알림
    process.on('SIGTERM', () => {
        broadcastSystemMessage('서버가 점검을 위해 곧 종료됩니다.', 'warning');
    });

    return io;
};

/**
 * 위치를 기반으로 서울 구 구분하는 함수 (간단한 예시)
 */
function getDistrictFromLocation(lat, lng) {
    // 실제로는 더 정확한 지역 구분 로직이 필요
    // 여기서는 간단한 예시로 위경도 범위로 구분
    
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