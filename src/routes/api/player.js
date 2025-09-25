// 📁 src/routes/api/player.js - 플레이어 관련 API 라우트
const express = require('express');
const { body, validationResult } = require('express-validator');
const DatabaseManager = require('../../database/DatabaseManager');
const JWTAuth = require('../../middleware/jwtAuth');
const logger = require('../../config/logger');

const router = express.Router();

// 모든 플레이어 라우트에 인증 미들웨어 적용
router.use(JWTAuth.authenticateToken);

/**
 * 플레이어 프로필 조회
 * GET /api/player/profile
 */
router.get('/profile', async (req, res) => {
    try {
        const playerId = req.player.id;

        // 플레이어 상세 정보 조회
        const player = await DatabaseManager.get(`
            SELECT 
                p.*,
                COUNT(pi.id) as inventory_count,
                COUNT(CASE WHEN pi.storage_type = 'storage' THEN 1 END) as storage_count
            FROM players p
            LEFT JOIN player_items pi ON p.id = pi.player_id
            WHERE p.id = ?
            GROUP BY p.id
        `, [playerId]);

        if (!player) {
            return res.status(404).json({
                success: false,
                error: '플레이어를 찾을 수 없습니다'
            });
        }

        // 플레이어 인벤토리 조회
        const inventory = await DatabaseManager.all(`
            SELECT 
                pi.*,
                it.name, it.category, it.grade, it.base_price, it.weight, it.description, it.icon_id
            FROM player_items pi
            JOIN item_templates it ON pi.item_template_id = it.id
            WHERE pi.player_id = ? AND pi.storage_type = 'inventory'
            ORDER BY pi.created_at DESC
        `, [playerId]);

        // 창고 아이템 조회
        const storageItems = await DatabaseManager.all(`
            SELECT 
                pi.*,
                it.name, it.category, it.grade, it.base_price, it.weight, it.description, it.icon_id
            FROM player_items pi
            JOIN item_templates it ON pi.item_template_id = it.id
            WHERE pi.player_id = ? AND pi.storage_type = 'storage'
            ORDER BY pi.created_at DESC
        `, [playerId]);

        // 최근 거래 기록
        const recentTrades = await DatabaseManager.all(`
            SELECT 
                tr.*,
                it.name as item_name,
                m.name as merchant_name
            FROM trade_records tr
            JOIN item_templates it ON tr.item_template_id = it.id
            JOIN merchants m ON tr.merchant_id = m.id
            WHERE tr.player_id = ?
            ORDER BY tr.created_at DESC
            LIMIT 10
        `, [playerId]);

        res.json({
            success: true,
            data: {
                id: player.id,
                name: player.name,
                level: player.level,
                experience: player.experience,
                money: player.money,
                trustPoints: player.trust_points,
                reputation: player.reputation,
                currentLicense: player.current_license,
                maxInventorySize: player.max_inventory_size,
                maxStorageSize: player.max_storage_size,
                
                // 스탯
                statPoints: player.stat_points,
                skillPoints: player.skill_points,
                strength: player.strength,
                intelligence: player.intelligence,
                charisma: player.charisma,
                luck: player.luck,
                
                // 스킬
                tradingSkill: player.trading_skill,
                negotiationSkill: player.negotiation_skill,
                appraisalSkill: player.appraisal_skill,
                
                // 위치 정보
                currentLocation: player.current_lat && player.current_lng ? {
                    lat: player.current_lat,
                    lng: player.current_lng
                } : null,
                
                // 거래 통계
                totalTrades: player.total_trades,
                totalProfit: player.total_profit,
                
                // 시간 정보
                createdAt: player.created_at,
                lastActive: player.last_active,
                totalPlayTime: player.total_play_time,
                
                // 인벤토리 정보
                inventoryCount: player.inventory_count,
                storageCount: player.storage_count,
                inventory: inventory,
                storageItems: storageItems,
                
                // 최근 거래
                recentTrades: recentTrades
            }
        });

    } catch (error) {
        logger.error('플레이어 프로필 조회 실패:', error);
        res.status(500).json({
            success: false,
            error: '서버 오류가 발생했습니다'
        });
    }
});

/**
 * 플레이어 위치 업데이트
 * PUT /api/player/location
 */
router.put('/location', [
    body('lat')
        .isFloat({ min: -90, max: 90 })
        .withMessage('유효한 위도를 입력해주세요'),
    body('lng')
        .isFloat({ min: -180, max: 180 })
        .withMessage('유효한 경도를 입력해주세요')
], async (req, res) => {
    try {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({
                success: false,
                error: '위치 정보가 유효하지 않습니다',
                details: errors.array()
            });
        }

        const { lat, lng } = req.body;
        const playerId = req.player.id;

        // 위치 업데이트
        await DatabaseManager.run(`
            UPDATE players 
            SET current_lat = ?, current_lng = ?, last_active = CURRENT_TIMESTAMP
            WHERE id = ?
        `, [lat, lng, playerId]);

        // 활동 로그 기록
        await DatabaseManager.run(`
            INSERT INTO activity_logs (player_id, action_type, details)
            VALUES (?, 'location_update', ?)
        `, [playerId, JSON.stringify({ lat, lng })]);

        res.json({
            success: true,
            message: '위치가 업데이트되었습니다',
            data: { lat, lng }
        });

    } catch (error) {
        logger.error('위치 업데이트 실패:', error);
        res.status(500).json({
            success: false,
            error: '서버 오류가 발생했습니다'
        });
    }
});

/**
 * 스탯 올리기
 * POST /api/player/increase-stat
 */
router.post('/increase-stat', [
    body('statType')
        .isIn(['strength', 'intelligence', 'charisma', 'luck'])
        .withMessage('유효한 스탯 타입을 선택해주세요')
], async (req, res) => {
    try {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({
                success: false,
                error: '스탯 타입이 유효하지 않습니다',
                details: errors.array()
            });
        }

        const { statType } = req.body;
        const playerId = req.player.id;

        // 현재 플레이어 정보 조회
        const player = await DatabaseManager.get(
            'SELECT stat_points, strength, intelligence, charisma, luck FROM players WHERE id = ?',
            [playerId]
        );

        if (!player) {
            return res.status(404).json({
                success: false,
                error: '플레이어를 찾을 수 없습니다'
            });
        }

        if (player.stat_points <= 0) {
            return res.status(400).json({
                success: false,
                error: '사용 가능한 스탯 포인트가 없습니다'
            });
        }

        // 현재 스탯 값 확인 (최대 100)
        const currentStat = player[statType];
        if (currentStat >= 100) {
            return res.status(400).json({
                success: false,
                error: '해당 스탯은 이미 최대치입니다'
            });
        }

        // 스탯 증가
        const updateQuery = `
            UPDATE players 
            SET ${statType} = ${statType} + 1, stat_points = stat_points - 1
            WHERE id = ?
        `;

        await DatabaseManager.run(updateQuery, [playerId]);

        // 업데이트된 정보 조회
        const updatedPlayer = await DatabaseManager.get(
            'SELECT stat_points, strength, intelligence, charisma, luck FROM players WHERE id = ?',
            [playerId]
        );

        logger.info('스탯 증가:', { playerId, statType, newValue: updatedPlayer[statType] });

        res.json({
            success: true,
            message: '스탯이 증가되었습니다',
            data: {
                statType,
                newStatValue: updatedPlayer[statType],
                remainingPoints: updatedPlayer.stat_points
            }
        });

    } catch (error) {
        logger.error('스탯 증가 실패:', error);
        res.status(500).json({
            success: false,
            error: '서버 오류가 발생했습니다'
        });
    }
});

/**
 * 스킬 올리기
 * POST /api/player/increase-skill
 */
router.post('/increase-skill', [
    body('skillType')
        .isIn(['trading', 'negotiation', 'appraisal'])
        .withMessage('유효한 스킬 타입을 선택해주세요')
], async (req, res) => {
    try {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({
                success: false,
                error: '스킬 타입이 유효하지 않습니다',
                details: errors.array()
            });
        }

        const { skillType } = req.body;
        const playerId = req.player.id;
        const skillColumn = `${skillType}_skill`;

        // 현재 플레이어 정보 조회
        const player = await DatabaseManager.get(
            `SELECT skill_points, ${skillColumn} FROM players WHERE id = ?`,
            [playerId]
        );

        if (!player) {
            return res.status(404).json({
                success: false,
                error: '플레이어를 찾을 수 없습니다'
            });
        }

        if (player.skill_points <= 0) {
            return res.status(400).json({
                success: false,
                error: '사용 가능한 스킬 포인트가 없습니다'
            });
        }

        // 현재 스킬 값 확인 (최대 100)
        const currentSkill = player[skillColumn];
        if (currentSkill >= 100) {
            return res.status(400).json({
                success: false,
                error: '해당 스킬은 이미 최대치입니다'
            });
        }

        // 스킬 증가
        const updateQuery = `
            UPDATE players 
            SET ${skillColumn} = ${skillColumn} + 1, skill_points = skill_points - 1
            WHERE id = ?
        `;

        await DatabaseManager.run(updateQuery, [playerId]);

        // 업데이트된 정보 조회
        const updatedPlayer = await DatabaseManager.get(
            `SELECT skill_points, ${skillColumn} FROM players WHERE id = ?`,
            [playerId]
        );

        logger.info('스킬 증가:', { playerId, skillType, newValue: updatedPlayer[skillColumn] });

        res.json({
            success: true,
            message: '스킬이 증가되었습니다',
            data: {
                skillType,
                newSkillValue: updatedPlayer[skillColumn],
                remainingPoints: updatedPlayer.skill_points
            }
        });

    } catch (error) {
        logger.error('스킬 증가 실패:', error);
        res.status(500).json({
            success: false,
            error: '서버 오류가 발생했습니다'
        });
    }
});

/**
 * 플레이어 프로필 생성 (첫 가입 시)
 * POST /api/player/create-profile
 */
router.post('/create-profile', [
    body('name')
        .trim()
        .isLength({ min: 2, max: 20 })
        .withMessage('이름은 2-20자 사이여야 합니다'),
    body('age')
        .isInt({ min: 16, max: 100 })
        .withMessage('나이는 16-100세 사이여야 합니다'),
    body('gender')
        .isIn(['male', 'female'])
        .withMessage('유효한 성별을 선택해주세요'),
    body('personality')
        .isIn(['aggressive', 'careful', 'balanced', 'adventurous', 'analytical'])
        .withMessage('유효한 성격을 선택해주세요')
], async (req, res) => {
    try {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({
                success: false,
                error: '입력 정보가 유효하지 않습니다',
                details: errors.array()
            });
        }

        const { name, age, gender, personality } = req.body;
        const playerId = req.player.id;

        // 이미 프로필이 완성된 플레이어인지 확인
        const existingPlayer = await DatabaseManager.get(
            'SELECT profile_completed FROM players WHERE id = ?',
            [playerId]
        );

        if (existingPlayer && existingPlayer.profile_completed) {
            return res.status(400).json({
                success: false,
                error: '이미 프로필이 설정된 플레이어입니다'
            });
        }

        // 프로필 정보 업데이트
        await DatabaseManager.run(`
            UPDATE players
            SET
                name = ?,
                age = ?,
                gender = ?,
                personality = ?,
                profile_completed = 1,
                last_active = CURRENT_TIMESTAMP
            WHERE id = ?
        `, [name, age, gender, personality, playerId]);

        // 활동 로그 기록
        await DatabaseManager.run(`
            INSERT INTO activity_logs (player_id, action_type, details)
            VALUES (?, 'profile_created', ?)
        `, [playerId, JSON.stringify({ name, age, gender, personality })]);

        logger.info('플레이어 프로필 생성:', { playerId, name, age, gender, personality });

        res.json({
            success: true,
            message: '프로필이 성공적으로 생성되었습니다',
            data: {
                name,
                age,
                gender,
                personality,
                profileCompleted: true
            }
        });

    } catch (error) {
        logger.error('프로필 생성 실패:', error);
        res.status(500).json({
            success: false,
            error: '서버 오류가 발생했습니다'
        });
    }
});

/**
 * 플레이어 프로필 업데이트
 * PUT /api/player/profile
 */
router.put('/profile', [
    body('name')
        .optional()
        .trim()
        .isLength({ min: 2, max: 20 })
        .withMessage('이름은 2-20자 사이여야 합니다'),
    body('age')
        .optional()
        .isInt({ min: 16, max: 100 })
        .withMessage('나이는 16-100세 사이여야 합니다'),
    body('gender')
        .optional()
        .isIn(['male', 'female'])
        .withMessage('유효한 성별을 선택해주세요'),
    body('personality')
        .optional()
        .isIn(['aggressive', 'careful', 'balanced', 'adventurous', 'analytical'])
        .withMessage('유효한 성격을 선택해주세요')
], async (req, res) => {
    try {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({
                success: false,
                error: '입력 정보가 유효하지 않습니다',
                details: errors.array()
            });
        }

        const { name, age, gender, personality } = req.body;
        const playerId = req.player.id;

        // 업데이트할 필드들 동적 구성
        const updateFields = [];
        const updateValues = [];

        if (name !== undefined) {
            updateFields.push('name = ?');
            updateValues.push(name);
        }
        if (age !== undefined) {
            updateFields.push('age = ?');
            updateValues.push(age);
        }
        if (gender !== undefined) {
            updateFields.push('gender = ?');
            updateValues.push(gender);
        }
        if (personality !== undefined) {
            updateFields.push('personality = ?');
            updateValues.push(personality);
        }

        if (updateFields.length === 0) {
            return res.status(400).json({
                success: false,
                error: '업데이트할 정보가 없습니다'
            });
        }

        updateFields.push('last_active = CURRENT_TIMESTAMP');
        updateValues.push(playerId);

        // 프로필 업데이트
        const updateQuery = `
            UPDATE players
            SET ${updateFields.join(', ')}
            WHERE id = ?
        `;

        await DatabaseManager.run(updateQuery, updateValues);

        // 활동 로그 기록
        await DatabaseManager.run(`
            INSERT INTO activity_logs (player_id, action_type, details)
            VALUES (?, 'profile_updated', ?)
        `, [playerId, JSON.stringify({ name, age, gender, personality })]);

        // 업데이트된 플레이어 정보 조회
        const updatedPlayer = await DatabaseManager.get(
            'SELECT name, age, gender, personality FROM players WHERE id = ?',
            [playerId]
        );

        logger.info('플레이어 프로필 업데이트:', { playerId, updates: { name, age, gender, personality } });

        res.json({
            success: true,
            message: '프로필이 성공적으로 업데이트되었습니다',
            data: updatedPlayer
        });

    } catch (error) {
        logger.error('프로필 업데이트 실패:', error);
        res.status(500).json({
            success: false,
            error: '서버 오류가 발생했습니다'
        });
    }
});

/**
 * 라이센스 업그레이드
 * POST /api/player/upgrade-license
 */
router.post('/upgrade-license', async (req, res) => {
    try {
        const playerId = req.player.id;

        // 현재 플레이어 정보 조회
        const player = await DatabaseManager.get(
            'SELECT money, trust_points, current_license, max_inventory_size FROM players WHERE id = ?',
            [playerId]
        );

        if (!player) {
            return res.status(404).json({
                success: false,
                error: '플레이어를 찾을 수 없습니다'
            });
        }

        // 라이센스 업그레이드 조건 확인
        const licenseRequirements = {
            0: { money: 0, trust: 0 },      // 초보자
            1: { money: 100000, trust: 50 }, // 일반
            2: { money: 500000, trust: 200 }, // 전문가
            3: { money: 2000000, trust: 500 } // 마스터
        };

        const currentLicense = player.current_license;
        const nextLicense = currentLicense + 1;

        if (nextLicense >= Object.keys(licenseRequirements).length) {
            return res.status(400).json({
                success: false,
                error: '이미 최고 라이센스입니다'
            });
        }

        const requirement = licenseRequirements[nextLicense];
        
        if (player.money < requirement.money) {
            return res.status(400).json({
                success: false,
                error: `업그레이드에 필요한 금액이 부족합니다 (필요: ${requirement.money.toLocaleString()}원)`
            });
        }

        if (player.trust_points < requirement.trust) {
            return res.status(400).json({
                success: false,
                error: `업그레이드에 필요한 신뢰도가 부족합니다 (필요: ${requirement.trust})`
            });
        }

        // 라이센스 업그레이드 실행
        const newInventorySize = player.max_inventory_size + 2;

        await DatabaseManager.run(`
            UPDATE players 
            SET 
                current_license = ?,
                money = money - ?,
                max_inventory_size = ?
            WHERE id = ?
        `, [nextLicense, requirement.money, newInventorySize, playerId]);

        logger.info('라이센스 업그레이드:', { 
            playerId, 
            from: currentLicense, 
            to: nextLicense,
            cost: requirement.money 
        });

        res.json({
            success: true,
            message: '라이센스가 업그레이드되었습니다',
            data: {
                newLicense: nextLicense,
                newInventorySize: newInventorySize,
                moneySpent: requirement.money
            }
        });

    } catch (error) {
        logger.error('라이센스 업그레이드 실패:', error);
        res.status(500).json({
            success: false,
            error: '서버 오류가 발생했습니다'
        });
    }
});

module.exports = router;