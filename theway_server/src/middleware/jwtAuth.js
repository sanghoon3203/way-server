// 📁 src/middleware/jwtAuth.js - JWT 인증 미들웨어
const jwt = require('jsonwebtoken');
const DatabaseManager = require('../database/DatabaseManager');
const logger = require('../config/logger');

class JWTAuth {
    /**
     * JWT 토큰 검증 미들웨어
     */
    static authenticateToken(req, res, next) {
        const authHeader = req.headers['authorization'];
        const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN

        if (!token) {
            return res.status(401).json({
                success: false,
                error: '인증 토큰이 필요합니다'
            });
        }

        jwt.verify(token, process.env.JWT_SECRET, async (err, decoded) => {
            if (err) {
                if (err.name === 'TokenExpiredError') {
                    return res.status(401).json({
                        success: false,
                        error: '토큰이 만료되었습니다',
                        errorCode: 'TOKEN_EXPIRED'
                    });
                }
                
                return res.status(401).json({
                    success: false,
                    error: '유효하지 않은 토큰입니다'
                });
            }

            try {
                // 사용자 및 플레이어 정보 조회
                const user = await DatabaseManager.get(
                    'SELECT * FROM users WHERE id = ? AND is_active = 1',
                    [decoded.userId]
                );

                if (!user) {
                    return res.status(401).json({
                        success: false,
                        error: '유효하지 않은 사용자입니다'
                    });
                }

                const player = await DatabaseManager.get(
                    'SELECT * FROM players WHERE id = ?',
                    [decoded.playerId]
                );

                if (!player) {
                    return res.status(401).json({
                        success: false,
                        error: '플레이어 정보를 찾을 수 없습니다'
                    });
                }

                // 요청 객체에 사용자 정보 추가
                req.user = user;
                req.player = player;
                next();

            } catch (error) {
                logger.error('JWT 인증 중 오류:', error);
                res.status(500).json({
                    success: false,
                    error: '서버 오류가 발생했습니다'
                });
            }
        });
    }

    /**
     * 선택적 인증 미들웨어 (토큰이 있으면 인증, 없어도 통과)
     */
    static optionalAuth(req, res, next) {
        const authHeader = req.headers['authorization'];
        const token = authHeader && authHeader.split(' ')[1];

        if (!token) {
            req.user = null;
            req.player = null;
            return next();
        }

        jwt.verify(token, process.env.JWT_SECRET, async (err, decoded) => {
            if (err) {
                req.user = null;
                req.player = null;
                return next();
            }

            try {
                const user = await DatabaseManager.get(
                    'SELECT * FROM users WHERE id = ? AND is_active = 1',
                    [decoded.userId]
                );

                const player = await DatabaseManager.get(
                    'SELECT * FROM players WHERE id = ?',
                    [decoded.playerId]
                );

                req.user = user || null;
                req.player = player || null;
                next();

            } catch (error) {
                logger.error('선택적 인증 중 오류:', error);
                req.user = null;
                req.player = null;
                next();
            }
        });
    }

    /**
     * 관리자 권한 확인 미들웨어
     */
    static requireAdmin(req, res, next) {
        if (!req.user || !req.user.is_admin) {
            return res.status(403).json({
                success: false,
                error: '관리자 권한이 필요합니다'
            });
        }
        next();
    }

    /**
     * 토큰에서 사용자 정보 추출
     */
    static extractUserFromToken(token) {
        try {
            return jwt.verify(token, process.env.JWT_SECRET);
        } catch (error) {
            return null;
        }
    }
}

module.exports = JWTAuth;