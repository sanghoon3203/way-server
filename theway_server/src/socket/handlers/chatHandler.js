// 📁 src/socket/handlers/chatHandler.js - 채팅 관련 Socket.IO 이벤트
const DatabaseManager = require('../../database/DatabaseManager');
const logger = require('../../config/logger');

/**
 * 채팅 관련 이벤트 핸들러
 */
module.exports = (socket, io) => {

    /**
     * 지역 채팅
     */
    socket.on('chat:district_message', async (data) => {
        try {
            const { message } = data;

            if (!message || message.trim().length === 0) {
                socket.emit('error:chat', {
                    code: 'EMPTY_MESSAGE',
                    message: '메시지를 입력해주세요'
                });
                return;
            }

            if (message.length > 200) {
                socket.emit('error:chat', {
                    code: 'MESSAGE_TOO_LONG',
                    message: '메시지는 200자 이하로 입력해주세요'
                });
                return;
            }

            if (!socket.currentDistrict) {
                socket.emit('error:chat', {
                    code: 'NO_DISTRICT',
                    message: '지역 정보가 없습니다'
                });
                return;
            }

            // 지역 채팅방의 모든 플레이어에게 메시지 전송
            io.to(`district:${socket.currentDistrict}`).emit('chat:district_message', {
                playerId: socket.playerId,
                playerName: socket.playerData.name,
                playerLevel: socket.playerData.level,
                message: message.trim(),
                district: socket.currentDistrict,
                timestamp: new Date().toISOString()
            });

            // 활동 로그 기록
            await DatabaseManager.run(
                'INSERT INTO activity_logs (player_id, action_type, details) VALUES (?, ?, ?)',
                [socket.playerId, 'district_chat', JSON.stringify({
                    district: socket.currentDistrict,
                    message: message.trim()
                })]
            );

        } catch (error) {
            logger.error('지역 채팅 실패:', error);
            socket.emit('error:chat', {
                code: 'CHAT_FAILED',
                message: '채팅 전송에 실패했습니다'
            });
        }
    });

    /**
     * 귓속말
     */
    socket.on('chat:private_message', async (data) => {
        try {
            const { targetPlayerId, message } = data;

            if (!targetPlayerId || !message || message.trim().length === 0) {
                socket.emit('error:chat', {
                    code: 'INVALID_PRIVATE_MESSAGE',
                    message: '대상과 메시지를 모두 입력해주세요'
                });
                return;
            }

            if (message.length > 200) {
                socket.emit('error:chat', {
                    code: 'MESSAGE_TOO_LONG',
                    message: '메시지는 200자 이하로 입력해주세요'
                });
                return;
            }

            // 대상 플레이어가 온라인인지 확인
            const targetSocket = [...io.sockets.sockets.values()]
                .find(s => s.playerId === targetPlayerId);

            if (!targetSocket) {
                socket.emit('error:chat', {
                    code: 'TARGET_OFFLINE',
                    message: '대상 플레이어가 오프라인입니다'
                });
                return;
            }

            // 대상에게 귓속말 전송
            targetSocket.emit('chat:private_message_received', {
                fromPlayerId: socket.playerId,
                fromPlayerName: socket.playerData.name,
                fromPlayerLevel: socket.playerData.level,
                message: message.trim(),
                timestamp: new Date().toISOString()
            });

            // 발신자에게 전송 확인
            socket.emit('chat:private_message_sent', {
                toPlayerId: targetPlayerId,
                toPlayerName: targetSocket.playerData.name,
                message: message.trim(),
                timestamp: new Date().toISOString()
            });

        } catch (error) {
            logger.error('귓속말 전송 실패:', error);
            socket.emit('error:chat', {
                code: 'PRIVATE_MESSAGE_FAILED',
                message: '귓속말 전송에 실패했습니다'
            });
        }
    });

    /**
     * 전체 공지 (관리자용)
     */
    socket.on('chat:system_announcement', async (data) => {
        try {
            // 관리자 권한 확인 (추후 구현)
            const isAdmin = false; // 실제로는 데이터베이스에서 확인

            if (!isAdmin) {
                socket.emit('error:chat', {
                    code: 'NO_PERMISSION',
                    message: '권한이 없습니다'
                });
                return;
            }

            const { message, type = 'info' } = data;

            if (!message || message.trim().length === 0) {
                socket.emit('error:chat', {
                    code: 'EMPTY_ANNOUNCEMENT',
                    message: '공지 내용을 입력해주세요'
                });
                return;
            }

            // 모든 연결된 플레이어에게 공지 전송
            io.emit('chat:system_announcement', {
                message: message.trim(),
                type, // 'info', 'warning', 'event'
                timestamp: new Date().toISOString()
            });

            // 관리자에게 전송 확인
            socket.emit('chat:announcement_sent', {
                message: message.trim(),
                recipientCount: io.sockets.sockets.size
            });

        } catch (error) {
            logger.error('시스템 공지 실패:', error);
            socket.emit('error:chat', {
                code: 'ANNOUNCEMENT_FAILED',
                message: '공지 전송에 실패했습니다'
            });
        }
    });

};