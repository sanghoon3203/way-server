// 📁 src/routes/api/auth.js - 인증 관련 API 라우트
const express = require('express');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const { body, validationResult } = require('express-validator');
const { randomUUID } = require('crypto');
const DatabaseManager = require('../../database/DatabaseManager');
const logger = require('../../config/logger');
const StandardResponse = require('../../utils/StandardResponse');
const { ConflictError, ValidationError, InvalidCredentialsError } = require('../../errors/CustomErrors');
const { asyncHandler } = require('../../middleware/errorHandler');

const router = express.Router();

/**
 * 회원가입
 * POST /api/auth/register
 */
router.post('/register', [
    body('email')
        .isEmail()
        .normalizeEmail()
        .withMessage('유효한 이메일 주소를 입력해주세요'),
    body('password')
        .isLength({ min: 6 })
        .withMessage('비밀번호는 최소 6자 이상이어야 합니다'),
    body('playerName')
        .trim()
        .isLength({ min: 2, max: 20 })
        .withMessage('플레이어 이름은 2-20자 사이여야 합니다')
], asyncHandler(async (req, res) => {
        // 유효성 검사
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return StandardResponse.validationFailed(res, {
                validationErrors: errors.array(),
                error: '입력 데이터가 유효하지 않습니다'
            });
        }

        const { email, password, playerName } = req.body;

        // 이메일 중복 확인
        const existingUser = await DatabaseManager.get(
            'SELECT id FROM users WHERE email = ?',
            [email]
        );

        if (existingUser) {
            throw new ConflictError('이미 존재하는 이메일입니다', 'EMAIL_ALREADY_EXISTS');
        }

        // 비밀번호 해시화
        const saltRounds = 12;
        const passwordHash = await bcrypt.hash(password, saltRounds);

        // UUID 생성
        const userId = randomUUID();
        const playerId = randomUUID();

        // 트랜잭션으로 사용자 및 플레이어 생성
        await DatabaseManager.transaction([
            {
                sql: `INSERT INTO users (id, email, password_hash) VALUES (?, ?, ?)`,
                params: [userId, email, passwordHash]
            },
            {
                sql: `INSERT INTO players (id, user_id, name) VALUES (?, ?, ?)`,
                params: [playerId, userId, playerName]
            }
        ]);

        // JWT 토큰 생성
        const token = jwt.sign(
            { userId, playerId },
            process.env.JWT_SECRET,
            { expiresIn: process.env.JWT_EXPIRES_IN || '1h' }
        );

        const refreshToken = jwt.sign(
            { userId, playerId },
            process.env.JWT_REFRESH_SECRET,
            { expiresIn: process.env.JWT_REFRESH_EXPIRES_IN || '7d' }
        );

        logger.info('새 사용자 등록:', { userId, email, playerName });

        return StandardResponse.created(res, {
            data: {
                userId,
                playerId,
                token,
                refreshToken
            },
            message: '회원가입이 완료되었습니다'
        });
}));

/**
 * 로그인
 * POST /api/auth/login
 */
router.post('/login', [
    body('email')
        .isEmail()
        .normalizeEmail()
        .withMessage('유효한 이메일 주소를 입력해주세요'),
    body('password')
        .notEmpty()
        .withMessage('비밀번호를 입력해주세요')
], async (req, res) => {
    try {
        // 유효성 검사
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({
                success: false,
                error: '입력 데이터가 유효하지 않습니다',
                details: errors.array()
            });
        }

        const { email, password } = req.body;

        // 사용자 조회
        const user = await DatabaseManager.get(
            'SELECT id, password_hash, is_active FROM users WHERE email = ?',
            [email]
        );

        if (!user) {
            return res.status(401).json({
                success: false,
                error: '이메일 또는 비밀번호가 올바르지 않습니다'
            });
        }

        if (!user.is_active) {
            return res.status(401).json({
                success: false,
                error: '비활성화된 계정입니다'
            });
        }

        // 비밀번호 검증
        const isPasswordValid = await bcrypt.compare(password, user.password_hash);
        if (!isPasswordValid) {
            return res.status(401).json({
                success: false,
                error: '이메일 또는 비밀번호가 올바르지 않습니다'
            });
        }

        // 플레이어 정보 조회
        const player = await DatabaseManager.get(
            'SELECT * FROM players WHERE user_id = ?',
            [user.id]
        );

        if (!player) {
            return res.status(404).json({
                success: false,
                error: '플레이어 정보를 찾을 수 없습니다'
            });
        }

        // 마지막 접속 시간 업데이트
        await DatabaseManager.run(
            'UPDATE players SET last_active = CURRENT_TIMESTAMP WHERE id = ?',
            [player.id]
        );

        // JWT 토큰 생성
        const token = jwt.sign(
            { userId: user.id, playerId: player.id },
            process.env.JWT_SECRET,
            { expiresIn: process.env.JWT_EXPIRES_IN || '1h' }
        );

        const refreshToken = jwt.sign(
            { userId: user.id, playerId: player.id },
            process.env.JWT_REFRESH_SECRET,
            { expiresIn: process.env.JWT_REFRESH_EXPIRES_IN || '7d' }
        );

        logger.info('사용자 로그인:', { userId: user.id, playerId: player.id, email });

        res.json({
            success: true,
            message: '로그인 성공',
            data: {
                userId: user.id,
                playerId: player.id,
                token,
                refreshToken,
                player: {
                    id: player.id,
                    name: player.name,
                    level: player.level,
                    money: player.money,
                    currentLicense: player.current_license
                }
            }
        });

    } catch (error) {
        logger.error('로그인 실패:', error);
        res.status(500).json({
            success: false,
            error: '서버 오류가 발생했습니다'
        });
    }
});

/**
 * 토큰 갱신
 * POST /api/auth/refresh
 */
router.post('/refresh', [
    body('refreshToken')
        .notEmpty()
        .withMessage('갱신 토큰이 필요합니다')
], async (req, res) => {
    try {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({
                success: false,
                error: '갱신 토큰이 필요합니다'
            });
        }

        const { refreshToken } = req.body;

        // 리프레시 토큰 검증
        const decoded = jwt.verify(refreshToken, process.env.JWT_REFRESH_SECRET);
        
        // 새로운 액세스 토큰 생성
        const newToken = jwt.sign(
            { userId: decoded.userId, playerId: decoded.playerId },
            process.env.JWT_SECRET,
            { expiresIn: process.env.JWT_EXPIRES_IN || '1h' }
        );

        res.json({
            success: true,
            data: {
                token: newToken
            }
        });

    } catch (error) {
        if (error.name === 'JsonWebTokenError' || error.name === 'TokenExpiredError') {
            return res.status(401).json({
                success: false,
                error: '유효하지 않은 갱신 토큰입니다'
            });
        }

        logger.error('토큰 갱신 실패:', error);
        res.status(500).json({
            success: false,
            error: '서버 오류가 발생했습니다'
        });
    }
});

/**
 * 로그아웃
 * POST /api/auth/logout
 */
router.post('/logout', async (req, res) => {
    try {
        // 실제로는 토큰을 블랙리스트에 추가하거나 세션을 무효화해야 하지만
        // 현재는 간단하게 성공 응답만 반환
        res.json({
            success: true,
            message: '로그아웃 되었습니다'
        });

    } catch (error) {
        logger.error('로그아웃 실패:', error);
        res.status(500).json({
            success: false,
            error: '서버 오류가 발생했습니다'
        });
    }
});

module.exports = router;