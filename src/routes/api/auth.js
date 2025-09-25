// 📁 src/routes/api/auth.js - 인증 관련 API 라우트
const express = require('express');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const { body, validationResult } = require('express-validator');
const { randomUUID } = require('crypto');
const DatabaseManager = require('../../database/DatabaseManager');
const logger = require('../../config/logger');
const { asyncHandler } = require('../../middleware/errorHandler');

const router = express.Router();
const PASSWORD_RESET_EXPIRY_MINUTES = parseInt(process.env.PASSWORD_RESET_EXPIRY_MINUTES, 10) || 10;

function generateVerificationCode() {
    return Math.floor(100000 + Math.random() * 900000).toString();
}

function maskEmail(email) {
    const [localPart, domain] = email.split('@');
    if (!domain) return email;

    if (localPart.length <= 2) {
        return `${'*'.repeat(localPart.length)}@${domain}`;
    }

    const visible = localPart.slice(0, 2);
    const masked = '*'.repeat(localPart.length - 2);
    return `${visible}${masked}@${domain}`;
}

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
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({
                success: false,
                error: '입력 데이터가 유효하지 않습니다',
                validationErrors: errors.array()
            });
        }

        const { email, password, playerName } = req.body;

        const existingUser = await DatabaseManager.get(
            'SELECT id FROM users WHERE email = ?',
            [email]
        );

        if (existingUser) {
            return res.status(409).json({
                success: false,
                error: '이미 존재하는 이메일입니다',
                code: 'EMAIL_ALREADY_EXISTS'
            });
        }

        const saltRounds = 12;
        const passwordHash = await bcrypt.hash(password, saltRounds);

        const userId = randomUUID();
        const playerId = randomUUID();

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

        return res.status(201).json({
            success: true,
            message: '회원가입이 완료되었습니다',
            data: {
                userId,
                playerId,
                token,
                refreshToken
            }
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

/**
 * 비밀번호 재설정 코드 발급
 * POST /api/auth/password/reset/request
 */
router.post('/password/reset/request', [
    body('email')
        .isEmail()
        .normalizeEmail()
        .withMessage('유효한 이메일 주소를 입력해주세요')
], asyncHandler(async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({
            success: false,
            error: '입력 데이터가 유효하지 않습니다',
            details: errors.array()
        });
    }

    const { email } = req.body;

    const user = await DatabaseManager.get(
        'SELECT id, email FROM users WHERE email = ?',
        [email]
    );

    // 이메일 존재 여부와 관계없이 동일한 응답을 반환하여 정보 노출 방지
    if (!user) {
        return res.json({
            success: true,
            message: '비밀번호 재설정 코드가 전송되었습니다',
            data: {
                maskedEmail: maskEmail(email),
                expiresIn: PASSWORD_RESET_EXPIRY_MINUTES * 60
            }
        });
    }

    const verificationCode = generateVerificationCode();
    const expiresAt = new Date(Date.now() + PASSWORD_RESET_EXPIRY_MINUTES * 60 * 1000).toISOString();

    // 기존 토큰 제거 후 새 토큰 생성
    await DatabaseManager.run(
        'DELETE FROM password_reset_tokens WHERE user_id = ?',
        [user.id]
    );

    await DatabaseManager.run(
        `INSERT INTO password_reset_tokens (id, user_id, email, token, expires_at)
         VALUES (?, ?, ?, ?, ?)` ,
        [randomUUID(), user.id, email, verificationCode, expiresAt]
    );

    logger.info('비밀번호 재설정 코드 발급', {
        userId: user.id,
        email,
        expiresAt,
        // 개발 환경에서만 코드 로깅
        ...(process.env.NODE_ENV !== 'production' && { verificationCode })
    });

    const responseData = {
        maskedEmail: maskEmail(email),
        expiresIn: PASSWORD_RESET_EXPIRY_MINUTES * 60
    };

    if (process.env.NODE_ENV !== 'production') {
        responseData.verificationCode = verificationCode;
    }

    return res.json({
        success: true,
        message: '비밀번호 재설정 코드가 전송되었습니다',
        data: responseData
    });
}));

/**
 * 비밀번호 재설정 수행
 * POST /api/auth/password/reset/verify
 */
router.post('/password/reset/verify', [
    body('email')
        .isEmail()
        .normalizeEmail()
        .withMessage('유효한 이메일 주소를 입력해주세요'),
    body('verificationCode')
        .isLength({ min: 6, max: 6 })
        .withMessage('6자리 인증번호를 입력해주세요'),
    body('newPassword')
        .isLength({ min: 6 })
        .withMessage('비밀번호는 최소 6자 이상이어야 합니다')
], asyncHandler(async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({
            success: false,
            error: '입력 데이터가 유효하지 않습니다',
            details: errors.array()
        });
    }

    const { email, verificationCode, newPassword } = req.body;

    const tokenRecord = await DatabaseManager.get(
        `SELECT id, user_id, email, token, expires_at, used_at
         FROM password_reset_tokens
         WHERE email = ? AND token = ?
         ORDER BY created_at DESC
         LIMIT 1`,
        [email, verificationCode]
    );

    if (!tokenRecord) {
        return res.status(400).json({
            success: false,
            error: '유효하지 않은 인증번호입니다'
        });
    }

    if (tokenRecord.used_at) {
        return res.status(400).json({
            success: false,
            error: '이미 사용된 인증번호입니다'
        });
    }

    if (new Date(tokenRecord.expires_at) < new Date()) {
        return res.status(400).json({
            success: false,
            error: '인증번호가 만료되었습니다'
        });
    }

    const passwordHash = await bcrypt.hash(newPassword, 12);

    await DatabaseManager.run(
        'UPDATE users SET password_hash = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
        [passwordHash, tokenRecord.user_id]
    );

    await DatabaseManager.run(
        'UPDATE password_reset_tokens SET used_at = CURRENT_TIMESTAMP WHERE id = ?',
        [tokenRecord.id]
    );

    // 동일 사용자에 대한 다른 토큰 정리
    await DatabaseManager.run(
        'DELETE FROM password_reset_tokens WHERE user_id = ? AND used_at IS NULL',
        [tokenRecord.user_id]
    );

    logger.info('비밀번호 재설정 완료', {
        userId: tokenRecord.user_id,
        email
    });

    return res.json({
        success: true,
        message: '비밀번호가 성공적으로 변경되었습니다'
    });
}));

module.exports = router;
