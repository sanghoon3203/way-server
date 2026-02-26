// 📁 src/middleware/auth.js - JWT 인증 미들웨어
const jwt = require('jsonwebtoken');
const DatabaseManager = require('../database/DatabaseManager');
const logger = require('../config/logger');

/**
 * JWT 토큰 검증 미들웨어
 */
const authenticateToken = async (req, res, next) => {
    try {
        const authHeader = req.headers.authorization;
        const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN

        if (!token) {
            return res.status(401).json({
                success: false,
                error: '인증 토큰이 필요합니다'
            });
        }

        // JWT 토큰 검증
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        
        // 사용자 존재 여부 확인
        const user = await DatabaseManager.get(
            'SELECT id, is_active FROM users WHERE id = ?',
            [decoded.userId]
        );

        if (!user || !user.is_active) {
            return res.status(401).json({
                success: false,
                error: '유효하지 않은 사용자입니다'
            });
        }

        // playerId는 JWT payload에서 직접 사용 (DB 조회 제거)
        req.user = {
            userId: user.id,
            playerId: decoded.playerId
        };

        next();

    } catch (error) {
        if (error.name === 'JsonWebTokenError') {
            return res.status(401).json({
                success: false,
                error: '유효하지 않은 토큰입니다'
            });
        }

        if (error.name === 'TokenExpiredError') {
            return res.status(401).json({
                success: false,
                error: '만료된 토큰입니다'
            });
        }

        logger.error('인증 미들웨어 오류:', error);
        res.status(500).json({
            success: false,
            error: '서버 오류가 발생했습니다'
        });
    }
};

/**
 * 선택적 인증 미들웨어 (토큰이 있으면 검증, 없어도 통과)
 */
const optionalAuth = async (req, res, next) => {
    try {
        const authHeader = req.headers.authorization;
        const token = authHeader && authHeader.split(' ')[1];

        if (!token) {
            return next();
        }

        // 토큰이 있는 경우 인증 시도
        return authenticateToken(req, res, next);

    } catch (error) {
        // 선택적 인증에서는 에러가 발생해도 계속 진행
        next();
    }
};

module.exports = {
    authenticateToken,
    optionalAuth
};