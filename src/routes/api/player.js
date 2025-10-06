// 📁 src/routes/api/player.js - 플레이어 관련 API 라우트
const express = require('express');
const { body, validationResult } = require('express-validator');
const { randomUUID } = require('crypto');
const DatabaseManager = require('../../database/DatabaseManager');
const JWTAuth = require('../../middleware/auth');
const logger = require('../../config/logger');

const router = express.Router();

// 모든 플레이어 라우트에 인증 미들웨어 적용
router.use(JWTAuth.authenticateToken);

let cachedPlayerItemsTableExists = null;

async function playerItemsTableExists() {
    if (cachedPlayerItemsTableExists !== null) {
        return cachedPlayerItemsTableExists;
    }

    try {
        const row = await DatabaseManager.get(
            `SELECT name FROM sqlite_master WHERE type = 'table' AND name = ?`,
            ['player_items']
        );

        cachedPlayerItemsTableExists = !!row;
    } catch (error) {
        logger.warn('player_items 테이블 존재 여부 확인 실패, 레거시 스키마로 간주합니다.', error);
        cachedPlayerItemsTableExists = false;
    }

    return cachedPlayerItemsTableExists;
}

function parseLegacyCollection(raw) {
    if (!raw) {
        return [];
    }

    if (Array.isArray(raw)) {
        return raw;
    }

    if (typeof raw === 'string') {
        try {
            const parsed = JSON.parse(raw);
            if (Array.isArray(parsed)) {
                return parsed;
            }
            if (parsed && Array.isArray(parsed.items)) {
                return parsed.items;
            }
            if (parsed && Array.isArray(parsed.inventory)) {
                return parsed.inventory;
            }
        } catch (error) {
            logger.warn('레거시 인벤토리 JSON 파싱 실패', error);
        }
        return [];
    }

    if (typeof raw === 'object') {
        if (Array.isArray(raw.items)) {
            return raw.items;
        }
        if (Array.isArray(raw.inventory)) {
            return raw.inventory;
        }

        // 객체의 값들 중 배열/객체만 추려서 반환
        return Object.values(raw).filter((value) => typeof value === 'object');
    }

    return [];
}

function normalizeLegacyItem(item, { playerId, fallbackStorageType }) {
    if (!item || typeof item !== 'object') {
        return null;
    }

    const quantity = Number(item.quantity ?? item.qty ?? 1) || 1;
    const storageType = item.storage_type || item.storageType || fallbackStorageType || 'inventory';
    const basePrice = item.base_price ?? item.basePrice ?? item.price ?? 0;
    const currentPrice = item.current_price ?? item.currentPrice ?? item.price ?? basePrice;

    const gradeValue = item.grade ?? item.grade_value ?? item.gradeValue ?? item.gradeId ?? item.grade_id;
    const requiredLicenseValue = item.required_license ?? item.requiredLicense ?? item.license ?? item.licenseLevel;

    return {
        id: item.id || item.item_instance_id || item.itemInstanceId || randomUUID(),
        player_id: item.player_id || playerId,
        item_template_id:
            item.item_template_id ||
            item.itemTemplateId ||
            item.templateId ||
            item.template_id ||
            item.itemId ||
            randomUUID(),
        quantity,
        storage_type: storageType,
        purchase_price: item.purchase_price ?? item.purchasePrice ?? null,
        purchase_date: item.purchase_date ?? item.purchaseDate ?? null,
        created_at: item.created_at ?? item.createdAt ?? new Date().toISOString(),
        name: item.name ?? item.itemName ?? item.title ?? 'Unknown Item',
        category: item.category ?? item.itemCategory ?? 'general',
        grade: gradeValue ?? 0,
        base_price: basePrice,
        current_price: currentPrice,
        weight: item.weight ?? 1,
        description: item.description ?? '',
        icon_id: item.icon_id ?? item.iconId ?? 1,
        required_license: requiredLicenseValue ?? 0
    };
}

function extractLegacyInventory(playerRow) {
    const inventoryKeys = ['inventory', 'inventory_json', 'inventoryData', 'inventory_data', 'inventory_items'];
    const storageKeys = ['storageItems', 'storage_items', 'storage_inventory', 'storageInventory', 'warehouse_items'];

    const rawInventory = inventoryKeys.map((key) => playerRow?.[key]).find((value) => value !== undefined);
    const rawStorage = storageKeys.map((key) => playerRow?.[key]).find((value) => value !== undefined);

    const parsedInventory = parseLegacyCollection(rawInventory)
        .map((item) => normalizeLegacyItem(item, { playerId: playerRow.id, fallbackStorageType: 'inventory' }))
        .filter((item) => !!item);

    const parsedStorage = parseLegacyCollection(rawStorage)
        .map((item) => normalizeLegacyItem(item, { playerId: playerRow.id, fallbackStorageType: 'storage' }))
        .filter((item) => !!item);

    return {
        inventory: parsedInventory,
        storageItems: parsedStorage,
        inventoryCount: parsedInventory.length,
        storageCount: parsedStorage.length
    };
}

/**
 * 플레이어 프로필 조회
 * GET /api/player/profile
 */
router.get('/profile', async (req, res) => {
    try {
        const playerId = req.user?.playerId;

        if (!playerId) {
            return res.status(401).json({
                success: false,
                error: '플레이어 정보를 찾을 수 없습니다'
            });
        }
        const hasPlayerItemsTable = await playerItemsTableExists();

        let player;
        let inventory = [];
        let storageItems = [];
        let inventoryCount = 0;
        let storageCount = 0;

        if (hasPlayerItemsTable) {
            player = await DatabaseManager.get(`
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

            try {
                inventory = await DatabaseManager.all(`
                    SELECT 
                        pi.*,
                        it.name, it.category, it.grade, it.base_price, it.weight, it.description, it.icon_id
                    FROM player_items pi
                    JOIN item_templates it ON pi.item_template_id = it.id
                    WHERE pi.player_id = ? AND pi.storage_type = 'inventory'
                    ORDER BY pi.created_at DESC
                `, [playerId]);
            } catch (error) {
                logger.warn('인벤토리 조회 실패 - 빈 배열로 대체합니다.', error);
                inventory = [];
            }

            try {
                storageItems = await DatabaseManager.all(`
                    SELECT 
                        pi.*,
                        it.name, it.category, it.grade, it.base_price, it.weight, it.description, it.icon_id
                    FROM player_items pi
                    JOIN item_templates it ON pi.item_template_id = it.id
                    WHERE pi.player_id = ? AND pi.storage_type = 'storage'
                    ORDER BY pi.created_at DESC
                `, [playerId]);
            } catch (error) {
                logger.warn('창고 아이템 조회 실패 - 빈 배열로 대체합니다.', error);
                storageItems = [];
            }

            inventoryCount = player.inventory_count ?? inventory.length;
            storageCount = player.storage_count ?? storageItems.length;
        } else {
            player = await DatabaseManager.get(`
                SELECT * FROM players WHERE id = ?
            `, [playerId]);

            if (!player) {
                return res.status(404).json({
                    success: false,
                    error: '플레이어를 찾을 수 없습니다'
                });
            }

            const legacy = extractLegacyInventory(player);
            inventory = legacy.inventory;
            storageItems = legacy.storageItems;
            inventoryCount = legacy.inventoryCount;
            storageCount = legacy.storageCount;
        }

        let recentTrades = [];
        try {
            recentTrades = await DatabaseManager.all(`
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
        } catch (error) {
            logger.warn('최근 거래 조회 실패 - 빈 배열로 대체합니다.', error);
            recentTrades = [];
        }

        res.json({
            success: true,
            data: {
                id: player.id,
                name: player.name,
                level: player.level ?? 1,
                experience: player.experience ?? 0,
                money: player.money ?? 0,
                trustPoints: player.trust_points ?? 0,
                reputation: player.reputation ?? 0,
                currentLicense: player.current_license ?? 0,
                maxInventorySize: player.max_inventory_size ?? 5,
                maxStorageSize: player.max_storage_size ?? 50,

                // 스탯
                statPoints: player.stat_points ?? 0,
                skillPoints: player.skill_points ?? 0,
                strength: player.strength ?? 10,
                intelligence: player.intelligence ?? 10,
                charisma: player.charisma ?? 10,
                luck: player.luck ?? 10,

                // 스킬
                tradingSkill: player.trading_skill ?? 1,
                negotiationSkill: player.negotiation_skill ?? 1,
                appraisalSkill: player.appraisal_skill ?? 1,

                // 위치 정보
                currentLocation: player.current_lat && player.current_lng
                    ? { lat: player.current_lat, lng: player.current_lng }
                    : null,

                // 거래 통계
                totalTrades: player.total_trades ?? 0,
                totalProfit: player.total_profit ?? 0,

                // 시간 정보
                createdAt: player.created_at ?? null,
                lastActive: player.last_active ?? null,
                totalPlayTime: player.total_play_time ?? 0,

                // 인벤토리 정보
                inventoryCount,
                storageCount,
                inventory,
                storageItems,

                // 최근 거래
                recentTrades
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

        // 🔒 SECURITY: Use safe column mapping instead of string interpolation
        const statColumnMap = {
            'strength': 'strength',
            'intelligence': 'intelligence',
            'charisma': 'charisma',
            'luck': 'luck'
        };

        const safeColumn = statColumnMap[statType];
        if (!safeColumn) {
            return res.status(400).json({
                success: false,
                error: '유효하지 않은 스탯 타입입니다'
            });
        }

        // 스탯 증가 (안전한 컬럼명 사용)
        const updateQuery = `
            UPDATE players
            SET ${safeColumn} = ${safeColumn} + 1, stat_points = stat_points - 1
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

        // 🔒 SECURITY: Use safe column mapping instead of string interpolation
        const skillColumnMap = {
            'trading': 'trading_skill',
            'negotiation': 'negotiation_skill',
            'appraisal': 'appraisal_skill'
        };

        const skillColumn = skillColumnMap[skillType];
        if (!skillColumn) {
            return res.status(400).json({
                success: false,
                error: '유효하지 않은 스킬 타입입니다'
            });
        }

        // 현재 플레이어 정보 조회 (안전한 컬럼명 사용)
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
