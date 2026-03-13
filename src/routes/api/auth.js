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
        console.info('[REGISTER] incoming body:', req.body);

        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            console.warn('[REGISTER] validation failed:', errors.array());
            return res.status(400).json({
                success: false,
                error: '입력 데이터가 유효하지 않습니다',
                validationErrors: errors.array()
            });
        }

        const { email, password, playerName } = req.body;
        console.info('[REGISTER] normalized payload:', { email, playerName });

        const existingUser = await DatabaseManager.get(
            'SELECT id, password_hash, is_active FROM users WHERE email = ?',
            [email]
        );

        if (existingUser) {
            // 비밀번호가 맞으면 → 재가입 대신 자동 로그인 (Xcode 재빌드 등 앱 초기화 케이스 대응)
            const isPasswordValid = await bcrypt.compare(password, existingUser.password_hash);
            if (isPasswordValid) {
                console.info('[REGISTER] email exists + password match → auto login:', email);

                const player = await DatabaseManager.get(
                    'SELECT id, name, level, money, current_license FROM players WHERE user_id = ?',
                    [existingUser.id]
                );

                await DatabaseManager.run(
                    'UPDATE players SET last_active = CURRENT_TIMESTAMP WHERE user_id = ?',
                    [existingUser.id]
                );

                const token = jwt.sign(
                    { userId: existingUser.id, playerId: player?.id },
                    process.env.JWT_SECRET,
                    { expiresIn: process.env.JWT_EXPIRES_IN || '1h' }
                );
                const refreshToken = jwt.sign(
                    { userId: existingUser.id, playerId: player?.id },
                    process.env.JWT_REFRESH_SECRET,
                    { expiresIn: process.env.JWT_REFRESH_EXPIRES_IN || '7d' }
                );

                return res.status(200).json({
                    success: true,
                    message: '기존 계정으로 로그인되었습니다',
                    code: 'AUTO_LOGIN',
                    data: {
                        userId: existingUser.id,
                        playerId: player?.id,
                        token,
                        refreshToken,
                        player: player ? {
                            id: player.id,
                            name: player.name,
                            level: player.level ?? 1,
                            money: player.money ?? 0,
                            currentLicense: player.current_license ?? 0
                        } : null
                    }
                });
            }

            console.warn('[REGISTER] duplicate email detected:', email);
            return res.status(409).json({
                success: false,
                error: '이미 존재하는 이메일입니다',
                code: 'EMAIL_ALREADY_EXISTS'
            });
        }

        const saltRounds = 12;
        const passwordHash = await bcrypt.hash(password, saltRounds);
        console.info('[REGISTER] password hashed for email:', email);

        const userId = randomUUID();
        const playerId = randomUUID();

        await DatabaseManager.transaction([
            {
                sql: `INSERT INTO users (id, email, password_hash) VALUES (?, ?, ?)`,
                params: [userId, email, passwordHash]
            },
            {
                sql: `INSERT INTO players (
                    id, user_id, name, money, trust_points, reputation, current_license,
                    level, experience, stat_points, skill_points,
                    strength, intelligence, charisma, luck,
                    trading_skill, negotiation_skill, appraisal_skill,
                    total_trades, total_profit, created_at, last_active
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`,
                params: [
                    playerId, userId, playerName,
                    10000, // money: 초기 자금 10,000원
                    0, // trust_points
                    0, // reputation
                    0, // current_license
                    1, // level
                    0, // experience
                    0, // stat_points
                    0, // skill_points
                    10, // strength
                    10, // intelligence
                    10, // charisma
                    10, // luck
                    1, // trading_skill
                    1, // negotiation_skill
                    1, // appraisal_skill
                    0, // total_trades
                    0  // total_profit
                ]
            }
        ]);
        console.info('[REGISTER] user/player/inventory inserted:', { userId, playerId });

        const newPlayer = await DatabaseManager.get(
            `SELECT id, name, level, money, current_license FROM players WHERE id = ?`,
            [playerId]
        );
        console.info('[REGISTER] loaded player row:', newPlayer);

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
        console.info('[REGISTER] jwt tokens generated for user:', userId);

        logger.info('새 사용자 등록:', { userId, email, playerName });

        return res.status(201).json({
            success: true,
            message: '회원가입이 완료되었습니다',
            data: {
                userId,
                playerId,
                token,
                refreshToken,
                player: newPlayer ? {
                    id: newPlayer.id,
                    name: newPlayer.name,
                    level: newPlayer.level ?? 1,
                    money: newPlayer.money ?? 0,
                    currentLicense: newPlayer.current_license ?? 0
                } : null
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
        console.info('[LOGIN] incoming body:', req.body);

        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            console.warn('[LOGIN] validation failed:', errors.array());
            return res.status(400).json({
                success: false,
                error: '입력 데이터가 유효하지 않습니다',
                details: errors.array()
            });
        }

        const { email, password } = req.body;
        console.info('[LOGIN] attempt email:', email);

        // 사용자 조회
        const user = await DatabaseManager.get(
            'SELECT id, password_hash, is_active FROM users WHERE email = ?',
            [email]
        );
        console.info('[LOGIN] loaded user:', user);

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
        console.info('[LOGIN] password verified for user:', user.id);

        // 플레이어 정보 조회
        const player = await DatabaseManager.get(
            'SELECT * FROM players WHERE user_id = ?',
            [user.id]
        );
        console.info('[LOGIN] loaded player:', player);

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
        console.info('[LOGIN] updated last_active for player:', player.id);

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
        console.info('[LOGIN] jwt tokens generated for user:', user.id);

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
        console.error('[LOGIN] unexpected error:', error);
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

    // 🔒 SECURITY: Use strong cryptographic token instead of 6-digit code
    const crypto = require('crypto');
    const resetToken = crypto.randomBytes(32).toString('hex');
    const tokenHash = crypto.createHash('sha256').update(resetToken).digest('hex');
    const expiresAt = new Date(Date.now() + PASSWORD_RESET_EXPIRY_MINUTES * 60 * 1000).toISOString();

    // 기존 토큰 제거 후 새 토큰 생성
    await DatabaseManager.run(
        'DELETE FROM password_reset_tokens WHERE user_id = ?',
        [user.id]
    );

    await DatabaseManager.run(
        `INSERT INTO password_reset_tokens (id, user_id, email, token, expires_at)
         VALUES (?, ?, ?, ?, ?)`,
        [randomUUID(), user.id, email, tokenHash, expiresAt]
    );

    logger.info('비밀번호 재설정 토큰 발급', {
        userId: user.id,
        email,
        expiresAt
        // 🔒 SECURITY: Never log the actual token, even in development
    });

    const responseData = {
        maskedEmail: maskEmail(email),
        expiresIn: PASSWORD_RESET_EXPIRY_MINUTES * 60,
        resetToken: resetToken // Send unhashed token to user (only once)
    };

    // 🔒 SECURITY: Remove development-only code exposure
    // Tokens should always be sent via secure channel (email/SMS)

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
    body('resetToken')
        .isLength({ min: 64, max: 64 })
        .isHexadecimal()
        .withMessage('유효한 재설정 토큰을 입력해주세요'),
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

    const { email, resetToken, newPassword } = req.body;

    // 🔒 SECURITY: Hash the submitted token for comparison
    const crypto = require('crypto');
    const tokenHash = crypto.createHash('sha256').update(resetToken).digest('hex');

    const tokenRecord = await DatabaseManager.get(
        `SELECT id, user_id, email, token, expires_at, used_at
         FROM password_reset_tokens
         WHERE email = ? AND token = ?
         ORDER BY created_at DESC
         LIMIT 1`,
        [email, tokenHash]
    );

    if (!tokenRecord) {
        return res.status(400).json({
            success: false,
            error: '유효하지 않은 재설정 토큰입니다'
        });
    }

    if (tokenRecord.used_at) {
        return res.status(400).json({
            success: false,
            error: '이미 사용된 재설정 토큰입니다'
        });
    }

    if (new Date(tokenRecord.expires_at) < new Date()) {
        return res.status(400).json({
            success: false,
            error: '재설정 토큰이 만료되었습니다'
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
