// 📁 src/routes/api/merchants.js - 상인 관련 API 라우트
const express = require('express');
const { query, body, validationResult } = require('express-validator');
const { randomUUID } = require('crypto');
const DatabaseManager = require('../../database/DatabaseManager');
const { authenticateToken } = require('../../middleware/auth');
const logger = require('../../config/logger');
const merchantDialogueLibrary = require('../../constants/merchantDialogues');

const TRADE_DISTANCE_LIMIT_METERS = 400;

const router = express.Router();

const MERCHANT_PERMIT_TEMPLATES = [
    'Merchantpermit_1',
    'Merchantpermit_2',
    'Merchantpermit_3',
    'Merchantpermit_4'
];

const GRADE_CAP_BY_TIER = {
    1: 0,
    2: 1,
    3: 2,
    4: 5
};

const REQUIRED_TIER_FOR_GRADE = {
    0: 1,
    1: 2,
    2: 3,
    3: 4,
    4: 4,
    5: 4
};

const getGradeCapForTier = (tier) => GRADE_CAP_BY_TIER[tier] ?? -1;
const getRequiredTierForGrade = (grade) => REQUIRED_TIER_FOR_GRADE[grade] ?? 4;

const RELATIONSHIP_MAX_STAGE = 4;
const STAGE_REQUIREMENTS = {
    0: 3,
    1: 3,
    2: 5,
    3: 5
};

const clampStage = (stage) => Math.max(0, Math.min(stage ?? 0, RELATIONSHIP_MAX_STAGE));
const getStageRequirement = (stage) => {
    if (stage >= RELATIONSHIP_MAX_STAGE) {
        return 0;
    }
    return STAGE_REQUIREMENTS[stage] ?? 0;
};

// 모든 상인 라우트에 인증 미들웨어 적용
router.use(authenticateToken);

/**
 * 위치 기반 거리 계산 함수 (하버사인 공식)
 */
function calculateDistance(lat1, lng1, lat2, lng2) {
    const R = 6371e3; // 지구 반지름 (미터)
    const φ1 = lat1 * Math.PI/180;
    const φ2 = lat2 * Math.PI/180;
    const Δφ = (lat2-lat1) * Math.PI/180;
    const Δλ = (lng2-lng1) * Math.PI/180;

    const a = Math.sin(Δφ/2) * Math.sin(Δφ/2) +
              Math.cos(φ1) * Math.cos(φ2) *
              Math.sin(Δλ/2) * Math.sin(Δλ/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));

    return R * c; // 미터 단위
}

/**
 * 근처 상인 조회
 * GET /api/merchants/nearby
 */
router.get('/nearby', [
    query('lat')
        .isFloat({ min: -90, max: 90 })
        .withMessage('유효한 위도를 입력해주세요'),
    query('lng')
        .isFloat({ min: -180, max: 180 })
        .withMessage('유효한 경도를 입력해주세요'),
    query('radius')
        .optional()
        .isFloat({ min: 100, max: 5000 })
        .withMessage('반경은 100m ~ 5000m 사이여야 합니다')
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

        const { lat, lng, radius = 1000 } = req.query;
        const playerId = req.user.playerId;

        // 플레이어 정보 조회 (거래 가능 여부 확인용)
        const player = await DatabaseManager.get(
            'SELECT current_license, reputation FROM players WHERE id = ?',
            [playerId]
        );

        // 플레이어 허가증 단계
        const permitRow = await DatabaseManager.get(`
            SELECT MAX(
                CASE item_template_id
                    WHEN 'Merchantpermit_1' THEN 1
                    WHEN 'Merchantpermit_2' THEN 2
                    WHEN 'Merchantpermit_3' THEN 3
                    WHEN 'Merchantpermit_4' THEN 4
                    ELSE 0
                END
            ) AS permitTier
            FROM player_personal_items
            WHERE player_id = ?
              AND item_template_id IN (?, ?, ?, ?)
        `, [playerId, ...MERCHANT_PERMIT_TEMPLATES]);

        const permitTier = Number(permitRow?.permitTier ?? 0);

        // 관계도 맵 구성
        const relationshipRows = await DatabaseManager.all(`
            SELECT merchant_id, trust_level, stage_progress
            FROM merchant_relationships
            WHERE player_id = ?
        `, [playerId]);

        const relationshipMap = new Map();
        for (const row of relationshipRows) {
            relationshipMap.set(row.merchant_id, {
                stage: clampStage(row.trust_level),
                progress: row.stage_progress ?? 0
            });
        }

        // 모든 활성 상인 조회
        const merchants = await DatabaseManager.all(`
            SELECT 
                m.*,
                COUNT(mi.id) as inventory_count
            FROM merchants m
            LEFT JOIN merchant_inventory mi ON m.id = mi.merchant_id AND mi.quantity > 0
            WHERE m.is_active = 1
            GROUP BY m.id
            ORDER BY m.name
        `);

        // 거리 계산 및 필터링
        const nearbyMerchants = merchants
            .map(merchant => {
                const distance = calculateDistance(
                    parseFloat(lat), parseFloat(lng),
                    merchant.lat, merchant.lng
                );

                const relation = relationshipMap.get(merchant.id) || { stage: 0, progress: 0 };
                const relationshipStage = clampStage(relation.stage);
                const stageProgress = relation.progress ?? 0;
                const stageRequirement = getStageRequirement(relationshipStage);
                const relationshipMaxGrade = getGradeCapForTier(relationshipStage);
                const permitMaxGrade = getGradeCapForTier(permitTier);
                const effectiveMaxGrade = (relationshipMaxGrade < 0 || permitMaxGrade < 0)
                    ? -1
                    : Math.min(relationshipMaxGrade, permitMaxGrade);

                const withinTradeDistance = distance <= TRADE_DISTANCE_LIMIT_METERS;
                const meetsRelationship = relationshipStage > 0;
                const meetsPermit = permitTier > 0;
                const canTrade = meetsRelationship && meetsPermit && withinTradeDistance;
                const meetsRequirements = meetsRelationship && meetsPermit;

                return {
                    id: merchant.id,
                    name: merchant.name,
                    title: merchant.title,
                    type: merchant.merchant_type,
                    personality: merchant.personality,
                    district: merchant.district,
                    location: {
                        lat: merchant.lat,
                        lng: merchant.lng
                    },
                    distance: Math.round(distance),
                    canTrade,
                    meetsRequirements,
                    withinTradeDistance,
                    tradeDistanceLimit: TRADE_DISTANCE_LIMIT_METERS,
                    requiredLicense: merchant.required_license,
                    reputationRequirement: merchant.reputation_requirement,
                    priceModifier: merchant.price_modifier,
                    negotiationDifficulty: merchant.negotiation_difficulty,
                    inventoryCount: merchant.inventory_count,
                    lastRestocked: merchant.last_restocked,
                    imageFileName: merchant.image_filename,
                    imagePath: merchant.image_filename ? `/public/merchants/${merchant.image_filename}` : null,

                    // 🆕 Story system fields
                    storyRole: merchant.story_role,
                    hasActiveStory: merchant.has_active_story === 1,
                    initialStoryNode: merchant.initial_story_node,

                    // 관계도 / 허가증 정보
                    relationshipStage,
                    stageProgress,
                    stageRequirement,
                    relationshipMaxGrade,
                    permitTier,
                    permitMaxGrade,
                    effectiveMaxGrade
                };
            })
            .sort((a, b) => a.distance - b.distance);

        res.json({
            success: true,
            data: {
                merchants: nearbyMerchants,
                total: nearbyMerchants.length,
                searchParams: {
                    lat: parseFloat(lat),
                    lng: parseFloat(lng),
                    radius: parseInt(radius)
                }
            }
        });

    } catch (error) {
        logger.error('근처 상인 조회 실패:', error);
        res.status(500).json({
            success: false,
            error: '서버 오류가 발생했습니다'
        });
    }
});

/**
 * 특정 상인 상세 정보
 * GET /api/merchants/:merchantId
 */
router.get('/:merchantId', async (req, res) => {
    try {
        const { merchantId } = req.params;
        const playerId = req.user.playerId;

        // 상인 기본 정보 조회
        const merchant = await DatabaseManager.get(`
            SELECT * FROM merchants WHERE id = ? AND is_active = 1
        `, [merchantId]);

        if (!merchant) {
            return res.status(404).json({
                success: false,
                error: '상인을 찾을 수 없습니다'
            });
        }

        // 상인 인벤토리 조회
        const inventory = await DatabaseManager.all(`
            SELECT 
                mi.*,
                it.name, it.category, it.grade, it.base_price, it.weight, 
                it.description, it.icon_id, it.required_license
            FROM merchant_inventory mi
            JOIN item_templates it ON mi.item_template_id = it.id
            WHERE mi.merchant_id = ? AND mi.quantity > 0
            ORDER BY it.category, it.name
        `, [merchantId]);

        // 플레이어와 상인의 관계 정보 조회
        const relationship = await DatabaseManager.get(`
            SELECT * FROM merchant_relationships 
            WHERE player_id = ? AND merchant_id = ?
        `, [playerId, merchantId]);

        const permitRow = await DatabaseManager.get(`
            SELECT MAX(
                CASE item_template_id
                    WHEN 'Merchantpermit_1' THEN 1
                    WHEN 'Merchantpermit_2' THEN 2
                    WHEN 'Merchantpermit_3' THEN 3
                    WHEN 'Merchantpermit_4' THEN 4
                    ELSE 0
                END
            ) AS permitTier
            FROM player_personal_items
            WHERE player_id = ?
              AND item_template_id IN (?, ?, ?, ?)
        `, [playerId, ...MERCHANT_PERMIT_TEMPLATES]);

        const permitTier = Number(permitRow?.permitTier ?? 0);
        const relationshipStage = relationship
            ? clampStage(relationship.trust_level ?? 0)
            : 0;
        const stageProgress = relationship?.stage_progress ?? 0;
        const stageRequirement = getStageRequirement(relationshipStage);

        const permitMaxGrade = getGradeCapForTier(permitTier);
        const relationshipMaxGrade = getGradeCapForTier(relationshipStage);
        const effectiveMaxGrade = (permitMaxGrade < 0 || relationshipMaxGrade < 0)
            ? -1
            : Math.min(permitMaxGrade, relationshipMaxGrade);
        const canTrade = relationshipStage > 0 && permitTier > 0;

        // 상인 선호도 정보 조회
        const preferences = await DatabaseManager.all(`
            SELECT category, preference_type 
            FROM merchant_preferences 
            WHERE merchant_id = ?
        `, [merchantId]);

        const preferredCategories = preferences
            .filter(p => p.preference_type === 'preferred')
            .map(p => p.category);

        const dislikedCategories = preferences
            .filter(p => p.preference_type === 'disliked')
            .map(p => p.category);

        const relationshipPayload = relationship ? {
            friendshipPoints: relationship.friendship_points,
            trustLevel: relationshipStage,
            stage: relationshipStage,
            stageProgress,
            stageRequirement,
            totalTrades: relationship.total_trades,
            totalSpent: relationship.total_spent,
            lastInteraction: relationship.last_interaction,
            notes: relationship.notes
        } : {
            friendshipPoints: 0,
            trustLevel: 0,
            stage: 0,
            stageProgress: 0,
            stageRequirement: getStageRequirement(0),
            totalTrades: 0,
            totalSpent: 0,
            lastInteraction: null,
            notes: null
        };

        res.json({
            success: true,
            data: {
                id: merchant.id,
                name: merchant.name,
                title: merchant.title,
                type: merchant.merchant_type,
                personality: merchant.personality,
                district: merchant.district,
                location: {
                    lat: merchant.lat,
                    lng: merchant.lng
                },
                requiredLicense: merchant.required_license,
                reputationRequirement: merchant.reputation_requirement,
                priceModifier: merchant.price_modifier,
                negotiationDifficulty: merchant.negotiation_difficulty,
                lastRestocked: merchant.last_restocked,
                imageFileName: merchant.image_filename,
                imagePath: merchant.image_filename ? `/public/merchants/${merchant.image_filename}` : null,

                // 🆕 Story system fields
                storyRole: merchant.story_role,
                hasActiveStory: merchant.has_active_story === 1,
                initialStoryNode: merchant.initial_story_node,

                // 선호도 정보
                preferredCategories,
                dislikedCategories,

                // 인벤토리
                inventory: inventory.map(item => ({
                    id: item.id,
                    itemTemplateId: item.item_template_id,
                    name: item.name,
                    category: item.category,
                    grade: item.grade,
                    basePrice: item.base_price,
                    currentPrice: item.current_price,
                    quantity: item.quantity,
                    weight: item.weight,
                    description: item.description,
                    iconId: item.icon_id,
                    requiredLicense: item.required_license,
                    lastUpdated: item.last_updated
                })),
                
                // 관계 정보 및 접근 제어
                relationship: relationshipPayload,
                accessControl: {
                    relationshipStage,
                    relationshipMaxGrade,
                    stageProgress,
                    stageRequirement,
                    permitTier,
                    permitMaxGrade,
                    effectiveMaxGrade,
                    canTrade,
                    requiredTierForGrade: REQUIRED_TIER_FOR_GRADE
                }
            }
        });

    } catch (error) {
        logger.error('상인 상세 조회 실패:', error);
        res.status(500).json({
            success: false,
            error: '서버 오류가 발생했습니다'
        });
    }
});

/**
 * 상인 관계도 진행 반영 (서브 퀘스트 완료 등)
 * POST /api/merchants/:merchantId/relationship/progress
 */
router.post('/:merchantId/relationship/progress', [
    body('questId').notEmpty().withMessage('퀘스트 ID가 필요합니다')
], async (req, res) => {
    try {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({
                success: false,
                error: '요청 데이터가 유효하지 않습니다',
                details: errors.array()
            });
        }

        const { merchantId } = req.params;
        const { questId } = req.body;
        const playerId = req.user.playerId;

        // 기본 관계 레코드 보장
        await DatabaseManager.run(`
            INSERT OR IGNORE INTO merchant_relationships
            (id, player_id, merchant_id, friendship_points, trust_level, total_trades, total_spent, stage_progress, last_interaction)
            VALUES (?, ?, ?, 0, 0, 0, 0, 0, CURRENT_TIMESTAMP)
        `, [randomUUID(), playerId, merchantId]);

        const relationship = await DatabaseManager.get(`
            SELECT trust_level, stage_progress
            FROM merchant_relationships
            WHERE player_id = ? AND merchant_id = ?
        `, [playerId, merchantId]);

        if (!relationship) {
            return res.status(404).json({
                success: false,
                error: '상인 관계 정보를 찾을 수 없습니다'
            });
        }

        const currentStage = clampStage(relationship.trust_level ?? 0);
        const currentProgress = relationship.stage_progress ?? 0;
        const stageRequirement = getStageRequirement(currentStage);

        // 최대 단계인 경우
        if (currentStage >= RELATIONSHIP_MAX_STAGE) {
            const permitRow = await DatabaseManager.get(`
                SELECT MAX(
                    CASE item_template_id
                        WHEN 'Merchantpermit_1' THEN 1
                        WHEN 'Merchantpermit_2' THEN 2
                        WHEN 'Merchantpermit_3' THEN 3
                        WHEN 'Merchantpermit_4' THEN 4
                        ELSE 0
                    END
                ) AS permitTier
                FROM player_personal_items
                WHERE player_id = ?
                  AND item_template_id IN (?, ?, ?, ?)
            `, [playerId, ...MERCHANT_PERMIT_TEMPLATES]);

            const permitTier = Number(permitRow?.permitTier ?? 0);

            return res.json({
                success: true,
                message: '관계도가 이미 최대 단계입니다.',
                data: {
                    merchantId,
                    questId,
                    relationshipStage: currentStage,
                    stageProgress: 0,
                    stageRequirement: 0,
                    permitTier,
                    canTrade: currentStage > 0 && permitTier > 0
                }
            });
        }

        // 퀘스트 중복 처리 체크
        try {
            await DatabaseManager.run(`
                INSERT INTO merchant_relationship_quest_log (id, player_id, merchant_id, quest_id, stage)
                VALUES (?, ?, ?, ?, ?)
            `, [randomUUID(), playerId, merchantId, questId, currentStage]);
        } catch (error) {
            if (error.message && error.message.includes('UNIQUE')) {
                const permitRow = await DatabaseManager.get(`
                    SELECT MAX(
                        CASE item_template_id
                            WHEN 'Merchantpermit_1' THEN 1
                            WHEN 'Merchantpermit_2' THEN 2
                            WHEN 'Merchantpermit_3' THEN 3
                            WHEN 'Merchantpermit_4' THEN 4
                            ELSE 0
                        END
                    ) AS permitTier
                    FROM player_personal_items
                    WHERE player_id = ?
                      AND item_template_id IN (?, ?, ?, ?)
                `, [playerId, ...MERCHANT_PERMIT_TEMPLATES]);

                const permitTier = Number(permitRow?.permitTier ?? 0);

                return res.json({
                    success: true,
                    message: '이미 반영된 퀘스트입니다.',
                    data: {
                        merchantId,
                        questId,
                        relationshipStage: currentStage,
                        stageProgress: currentProgress,
                        stageRequirement,
                        permitTier,
                        canTrade: currentStage > 0 && permitTier > 0
                    }
                });
            }
            throw error;
        }

        let newStage = currentStage;
        let newProgress = currentProgress + 1;

        if (stageRequirement > 0 && newProgress >= stageRequirement && currentStage < RELATIONSHIP_MAX_STAGE) {
            newStage = currentStage + 1;
            newProgress = 0;
            await DatabaseManager.run(`
                UPDATE merchant_relationships
                SET trust_level = ?, stage_progress = ?, last_interaction = CURRENT_TIMESTAMP
                WHERE player_id = ? AND merchant_id = ?
            `, [newStage, newProgress, playerId, merchantId]);
        } else {
            await DatabaseManager.run(`
                UPDATE merchant_relationships
                SET stage_progress = ?, last_interaction = CURRENT_TIMESTAMP
                WHERE player_id = ? AND merchant_id = ?
            `, [newProgress, playerId, merchantId]);
        }

        const nextStageRequirement = getStageRequirement(newStage);

        const permitRow = await DatabaseManager.get(`
            SELECT MAX(
                CASE item_template_id
                    WHEN 'Merchantpermit_1' THEN 1
                    WHEN 'Merchantpermit_2' THEN 2
                    WHEN 'Merchantpermit_3' THEN 3
                    WHEN 'Merchantpermit_4' THEN 4
                    ELSE 0
                END
            ) AS permitTier
            FROM player_personal_items
            WHERE player_id = ?
              AND item_template_id IN (?, ?, ?, ?)
        `, [playerId, ...MERCHANT_PERMIT_TEMPLATES]);

        const permitTier = Number(permitRow?.permitTier ?? 0);

        res.json({
            success: true,
            data: {
                merchantId,
                questId,
                relationshipStage: newStage,
                stageProgress: newProgress,
                stageRequirement: nextStageRequirement,
                permitTier,
                canTrade: newStage > 0 && permitTier > 0
            }
        });
    } catch (error) {
        logger.error('관계도 진행 업데이트 실패:', error);
        res.status(500).json({
            success: false,
            error: '서버 오류가 발생했습니다'
        });
    }
});

/**
 * 상인 허가증 업그레이드
 * POST /api/merchants/:merchantId/permit/upgrade
 */
router.post('/:merchantId/permit/upgrade', async (req, res) => {
    try {
        const { merchantId } = req.params;
        const playerId = req.user.playerId;

        const permitRow = await DatabaseManager.get(`
            SELECT MAX(
                CASE item_template_id
                    WHEN 'Merchantpermit_1' THEN 1
                    WHEN 'Merchantpermit_2' THEN 2
                    WHEN 'Merchantpermit_3' THEN 3
                    WHEN 'Merchantpermit_4' THEN 4
                    ELSE 0
                END
            ) AS permitTier
            FROM player_personal_items
            WHERE player_id = ?
              AND item_template_id IN (?, ?, ?, ?)
        `, [playerId, ...MERCHANT_PERMIT_TEMPLATES]);

        const currentPermitTier = Number(permitRow?.permitTier ?? 0);
        const targetTier = currentPermitTier + 1;

        if (targetTier > MERCHANT_PERMIT_TEMPLATES.length) {
            return res.status(400).json({
                success: false,
                error: '더 이상 업그레이드할 수 없습니다',
                data: { permitTier: currentPermitTier }
            });
        }

        const relationship = await DatabaseManager.get(`
            SELECT trust_level, stage_progress
            FROM merchant_relationships
            WHERE player_id = ? AND merchant_id = ?
        `, [playerId, merchantId]);

        const relationshipStage = relationship ? clampStage(relationship.trust_level ?? 0) : 0;

        if (relationshipStage < targetTier) {
            return res.status(403).json({
                success: false,
                error: '관계도 단계가 부족합니다',
                code: 'RELATIONSHIP_STAGE_REQUIRED',
                data: {
                    merchantId,
                    requiredRelationshipStage: targetTier,
                    relationshipStage,
                    permitTier: currentPermitTier
                }
            });
        }

        const newPermitTemplate = `Merchantpermit_${targetTier}`;

        await DatabaseManager.transaction([
            {
                sql: `DELETE FROM player_personal_items
                      WHERE player_id = ?
                        AND item_template_id IN (?, ?, ?, ?)`,
                params: [playerId, ...MERCHANT_PERMIT_TEMPLATES]
            },
            {
                sql: `INSERT INTO player_personal_items (id, player_id, item_template_id, quantity)
                      VALUES (?, ?, ?, 1)`,
                params: [randomUUID(), playerId, newPermitTemplate]
            }
        ]);

        res.json({
            success: true,
            message: `상인 허가증이 Lv.${targetTier}로 업그레이드되었습니다.`,
            data: {
                merchantId,
                permitTier: targetTier,
                relationshipStage,
                stageRequirement: getStageRequirement(relationshipStage),
                stageProgress: relationship?.stage_progress ?? 0
            }
        });
    } catch (error) {
        logger.error('상인 허가증 업그레이드 실패:', error);
        res.status(500).json({
            success: false,
            error: '서버 오류가 발생했습니다'
        });
    }
});

/**
 * 상인 대화 데이터 조회
 * GET /api/merchants/:merchantId/dialogues
 */
router.get('/:merchantId/dialogues', async (req, res) => {
    try {
        const { merchantId } = req.params;
        const { triggerType } = req.query;
        const playerId = req.user?.playerId || null;

        const merchant = await DatabaseManager.get(`
            SELECT id, name, merchant_type, personality
            FROM merchants
            WHERE id = ? AND is_active = 1
        `, [merchantId]);

        if (!merchant) {
            return res.status(404).json({
                success: false,
                error: '상인을 찾을 수 없습니다'
            });
        }

        const params = [merchantId];
        let dialogueQuery = `
            SELECT id, trigger_type, dialogue_text, dialogue_order, emotion, updated_at
            FROM merchant_dialogues
            WHERE merchant_id = ? AND is_active = 1
        `;

        if (triggerType) {
            dialogueQuery += ' AND trigger_type = ?';
            params.push(triggerType);
        }

        dialogueQuery += ' ORDER BY trigger_type, dialogue_order, created_at';

        let rows = [];
        try {
            rows = await DatabaseManager.all(dialogueQuery, params);
        } catch (dbError) {
            if (dbError.message && dbError.message.includes('no such table')) {
                logger.warn('merchant_dialogues 테이블이 존재하지 않습니다. 마이그레이션을 실행해주세요.', { merchantId });
            } else {
                throw dbError;
            }
        }

        const dialogueBuckets = initializeDialogueBuckets();
        let latestUpdatedAt = 0;

        for (const row of rows) {
            const category = mapTriggerToCategory(row.trigger_type);
            if (!dialogueBuckets[category]) {
                dialogueBuckets[category] = [];
            }

            dialogueBuckets[category].push(row.dialogue_text);

            if (row.updated_at) {
                const updatedTime = new Date(row.updated_at).getTime();
                if (!Number.isNaN(updatedTime)) {
                    latestUpdatedAt = Math.max(latestUpdatedAt, updatedTime);
                }
            }
        }

        const fallbackDialogues = generateFallbackDialogues(merchant);
        for (const category of Object.keys(dialogueBuckets)) {
            if (!dialogueBuckets[category] || dialogueBuckets[category].length === 0) {
                dialogueBuckets[category] = fallbackDialogues[category] || [];
            }
        }

        const responsePayload = {
            merchantId: merchant.id,
            merchantName: merchant.name,
            personality: merchant.personality || 'neutral',
            dialogues: dialogueBuckets,
            lastUpdated: latestUpdatedAt ? new Date(latestUpdatedAt).toISOString() : new Date().toISOString()
        };

        if (playerId) {
            try {
                await DatabaseManager.run(`
                    INSERT INTO merchant_dialogue_logs (
                        id, player_id, merchant_id, interaction_type, message_text, merchant_emotion
                    ) VALUES (?, ?, ?, 'load_dialogues', NULL, NULL)
                `, [randomUUID(), playerId, merchantId]);
            } catch (logError) {
                logger.warn('상인 대화 로그 기록 실패', { merchantId, playerId, error: logError.message });
            }
        }

        return res.json({
            success: true,
            data: responsePayload
        });

    } catch (error) {
        logger.error('상인 대화 조회 실패:', error);
        return res.status(500).json({
            success: false,
            error: '상인 대화를 불러오는 중 오류가 발생했습니다'
        });
    }
});

/**
 * 모든 상인 목록 조회 (관리용)
 * GET /api/merchants
 */
router.get('/', async (req, res) => {
    try {
        let merchants = await DatabaseManager.all(`
            SELECT
                m.*,
                COUNT(mi.id) as inventory_count
            FROM merchants m
            LEFT JOIN merchant_inventory mi ON m.id = mi.merchant_id
            WHERE m.is_active = 1
            GROUP BY m.id
            ORDER BY m.district, m.name
        `);

        // 데이터베이스가 비어있으면 하드코딩된 fallback 사용
        if (merchants.length === 0) {
            const fallbackData = [
                {
                    id: "merchant_alicegang",
                    name: "앨리스 강",
                    title: "프렌치 아포테케리",
                    type: "cultural",
                    personality: "gentle",
                    district: "서초구",
                    location: { lat: 37.491451, lng: 127.003281 },
                    requiredLicense: 1,
                    reputationRequirement: 0,
                    priceModifier: 1.2,
                    negotiationDifficulty: 3,
                    inventory: []
                },
                {
                    id: "merchant_anipark",
                    name: "애니박",
                    title: "드림크리스탈 공주",
                    type: "fantasy",
                    personality: "dreamy",
                    district: "송파구",
                    location: { lat: 37.511169, lng: 127.098242 },
                    requiredLicense: 2,
                    reputationRequirement: 0,
                    priceModifier: 1.5,
                    negotiationDifficulty: 2,
                    inventory: []
                },
                {
                    id: "merchant_catarinachoi",
                    name: "카타리나 최",
                    title: "성당 프리스트",
                    type: "religious",
                    personality: "protective",
                    district: "중구",
                    location: { lat: 37.563605, lng: 126.986893 },
                    requiredLicense: 1,
                    reputationRequirement: 0,
                    priceModifier: 1.3,
                    negotiationDifficulty: 2,
                    inventory: []
                },
                {
                    id: "merchant_jinbaekho",
                    name: "진백호",
                    title: "테라 커피하우스 주인",
                    type: "beverages",
                    personality: "cunning",
                    district: "강동구",
                    location: { lat: 37.540264, lng: 127.123698 },
                    requiredLicense: 1,
                    reputationRequirement: 0,
                    priceModifier: 1.1,
                    negotiationDifficulty: 4,
                    inventory: []
                },
                {
                    id: "merchant_jubulsu",
                    name: "주불수",
                    title: "크래프트타운 대장장이",
                    type: "weapons",
                    personality: "tough",
                    district: "강동구",
                    location: { lat: 37.540764, lng: 127.124198 },
                    requiredLicense: 1,
                    reputationRequirement: 0,
                    priceModifier: 1.4,
                    negotiationDifficulty: 5,
                    inventory: []
                },
                {
                    id: "merchant_kijuri",
                    name: "기주리",
                    title: "시간 보안관",
                    type: "temporal",
                    personality: "strict",
                    district: "종로구",
                    location: { lat: 37.575911, lng: 126.976863 },
                    requiredLicense: 2,
                    reputationRequirement: 0,
                    priceModifier: 1.6,
                    negotiationDifficulty: 5,
                    inventory: []
                },
                {
                    id: "merchant_kimsehwui",
                    name: "김세휘",
                    title: "임플란트 연구자",
                    type: "technology",
                    personality: "intellectual",
                    district: "관악구",
                    location: { lat: 37.460369, lng: 126.95175 },
                    requiredLicense: 1,
                    reputationRequirement: 0,
                    priceModifier: 1.7,
                    negotiationDifficulty: 3,
                    inventory: []
                },
                {
                    id: "merchant_mari",
                    name: "마리",
                    title: "염력 부여 전문가",
                    type: "enhancement",
                    personality: "cheerful",
                    district: "마포구",
                    location: { lat: 37.548748, lng: 126.92207 },
                    requiredLicense: 0,
                    reputationRequirement: 0,
                    priceModifier: 1.2,
                    negotiationDifficulty: 2,
                    inventory: []
                },
                {
                    id: "merchant_seoyena",
                    name: "서예나",
                    title: "네오-시티 스타일리스트",
                    type: "fashion",
                    personality: "cold",
                    district: "강남구",
                    location: { lat: 37.527941, lng: 127.038806 },
                    requiredLicense: 1,
                    reputationRequirement: 0,
                    priceModifier: 1.3,
                    negotiationDifficulty: 4,
                    inventory: []
                }
            ];

            const merchantsByDistrict = fallbackData.reduce((acc, merchant) => {
                if (!acc[merchant.district]) {
                    acc[merchant.district] = [];
                }
                acc[merchant.district].push({
                    id: merchant.id,
                    name: merchant.name,
                    title: merchant.title,
                    type: merchant.type,
                    personality: merchant.personality,
                    location: merchant.location,
                    requiredLicense: merchant.requiredLicense,
                    reputationRequirement: merchant.reputationRequirement,
                    priceModifier: merchant.priceModifier,
                    negotiationDifficulty: merchant.negotiationDifficulty,
                    inventoryCount: merchant.inventory.length
                });
                return acc;
            }, {});

            return res.json({
                success: true,
                data: {
                    merchants: fallbackData.map(m => ({
                        id: m.id,
                        name: m.name,
                        title: m.title,
                        type: m.type,
                        personality: m.personality,
                        district: m.district,
                        location: m.location,
                        inventoryCount: m.inventory.length
                    })),
                    merchantsByDistrict,
                    total: fallbackData.length,
                    source: 'fallback'
                }
            });
        }

        const merchantsByDistrict = merchants.reduce((acc, merchant) => {
            if (!acc[merchant.district]) {
                acc[merchant.district] = [];
            }
            
            acc[merchant.district].push({
                id: merchant.id,
                name: merchant.name,
                title: merchant.title,
                type: merchant.merchant_type,
                personality: merchant.personality,
                location: {
                    lat: merchant.lat,
                    lng: merchant.lng
                },
                requiredLicense: merchant.required_license,
                reputationRequirement: merchant.reputation_requirement,
                priceModifier: merchant.price_modifier,
                negotiationDifficulty: merchant.negotiation_difficulty,
                inventoryCount: merchant.inventory_count,
                lastRestocked: merchant.last_restocked,
                imageFileName: merchant.image_filename,
                imagePath: merchant.image_filename ? `/public/merchants/${merchant.image_filename}` : null
            });
            
            return acc;
        }, {});

        res.json({
            success: true,
            data: {
                merchants: merchants.map(m => ({
                    id: m.id,
                    name: m.name,
                    title: m.title,
                    type: m.merchant_type,
                    district: m.district,
                    inventoryCount: m.inventory_count
                })),
                merchantsByDistrict,
                total: merchants.length
            }
        });

    } catch (error) {
        logger.error('상인 목록 조회 실패:', error);
        res.status(500).json({
            success: false,
            error: '서버 오류가 발생했습니다'
        });
    }
});

/**
 * 🆕 Get story dialogue for merchant
 * GET /api/merchants/:merchantId/story
 *
 * IMPORTANT: This is SEPARATE from /dialogues endpoint
 * /dialogues: Returns general merchant conversation text
 * /story: Returns story node based dialogue with choices
 */
router.get('/:merchantId/story', async (req, res) => {
    try {
        const { merchantId } = req.params;
        const playerId = req.user.playerId;

        // Check if merchant has story role
        const merchant = await DatabaseManager.get(`
            SELECT id, name, story_role, initial_story_node, has_active_story
            FROM merchants
            WHERE id = ? AND is_active = 1
        `, [merchantId]);

        if (!merchant || !merchant.has_active_story) {
            return res.status(404).json({
                success: false,
                error: 'No active story for this merchant'
            });
        }

        // Get player's story progress
        const StoryService = require('../../services/game/StoryService');
        const progress = await StoryService.getPlayerStoryProgress(playerId);

        // Determine which node to show
        let nodeId;
        if (progress.currentNodeId && progress.currentNodeId.includes(merchantId)) {
            nodeId = progress.currentNodeId;
        } else {
            nodeId = merchant.initial_story_node;
        }

        if (!nodeId) {
            return res.status(404).json({
                success: false,
                error: 'No story node available'
            });
        }

        // Get story node
        const node = await StoryService.getStoryNode(nodeId);

        // Check prerequisites
        const canAccess = await StoryService.checkPrerequisites(playerId, node.prerequisites);
        if (!canAccess.success) {
            return res.json({
                success: false,
                error: 'PREREQUISITES_NOT_MET',
                missing: canAccess.missing,
                fallbackDialogue: "아직 그 이야기를 나눌 때가 아닌 것 같습니다."
            });
        }

        // Filter available choices
        const availableChoices = await StoryService.filterChoices(playerId, node.choices);

        res.json({
            success: true,
            data: {
                node: {
                    id: node.id,
                    type: node.node_type,
                    content: JSON.parse(node.content),
                    choices: availableChoices
                },
                merchantName: merchant.name
            }
        });

    } catch (error) {
        logger.error('Story dialogue fetch failed:', error);
        res.status(500).json({
            success: false,
            error: '서버 오류가 발생했습니다'
        });
    }
});

/**
 * 🆕 Progress story dialogue
 * POST /api/merchants/:merchantId/story/progress
 */
router.post('/:merchantId/story/progress', async (req, res) => {
    try {
        const { merchantId } = req.params;
        const { nodeId, choiceId } = req.body;
        const playerId = req.user.playerId;

        const StoryService = require('../../services/game/StoryService');

        // Progress the story
        const result = await StoryService.progressStory(playerId, nodeId, choiceId);

        // Notify quest system about dialogue completion
        try {
            const activeQuests = await DatabaseManager.all(`
                SELECT pq.*, qt.objectives
                FROM player_quests pq
                JOIN quest_templates qt ON pq.quest_template_id = qt.id
                WHERE pq.player_id = ? AND pq.status = 'active'
            `, [playerId]);

            for (const quest of activeQuests) {
                const objectives = JSON.parse(quest.objectives || '[]');
                const progress = JSON.parse(quest.progress || '{}');
                let updated = false;

                objectives.forEach((obj, index) => {
                    if (obj.type === 'dialogue' &&
                        obj.target_node === nodeId &&
                        obj.merchantId === merchantId) {
                        progress[`objective_${index}`] = 1;
                        updated = true;
                    }
                });

                if (updated) {
                    await DatabaseManager.run(`
                        UPDATE player_quests
                        SET progress = ?, updated_at = CURRENT_TIMESTAMP
                        WHERE id = ?
                    `, [JSON.stringify(progress), quest.id]);

                    // Check if quest is now complete
                    const allComplete = objectives.every((_, i) => progress[`objective_${i}`] === 1);
                    if (allComplete) {
                        await DatabaseManager.run(`
                            UPDATE player_quests
                            SET status = 'completed', completed_at = CURRENT_TIMESTAMP
                            WHERE id = ?
                        `, [quest.id]);
                    }
                }
            }
        } catch (questError) {
            logger.warn('Quest update failed during story progress', questError);
        }

        // Load next node if available
        let nextNodeData = null;
        if (result.nextNode) {
            const nextNode = await StoryService.getStoryNode(result.nextNode);
            nextNodeData = {
                id: nextNode.id,
                type: nextNode.node_type,
                content: JSON.parse(nextNode.content),
                choices: await StoryService.filterChoices(playerId, nextNode.choices)
            };
        }

        res.json({
            success: true,
            data: {
                completedNode: result.completedNode,
                rewards: result.rewards,
                nextNode: nextNodeData
            }
        });

    } catch (error) {
        logger.error('Story progress failed:', error);
        res.status(500).json({
            success: false,
            error: '서버 오류가 발생했습니다'
        });
    }
});

/**
 * 🆕 Get story chapters list for a merchant (Court Record style)
 * GET /api/merchants/:merchantId/stories/chapters
 */
router.get('/:merchantId/stories/chapters', async (req, res) => {
    try {
        const { merchantId } = req.params;
        const playerId = req.user.playerId;

        const StoryService = require('../../services/game/StoryService');

        // Query story nodes grouped by metadata.chapter
        const nodes = await DatabaseManager.all(`
            SELECT DISTINCT
                json_extract(metadata, '$.chapter') as chapter,
                json_extract(metadata, '$.title') as title,
                json_extract(metadata, '$.story_type') as story_type,
                MIN(id) as initial_node_id
            FROM story_nodes
            WHERE merchant_id = ?
            AND json_extract(metadata, '$.chapter') IS NOT NULL
            GROUP BY json_extract(metadata, '$.chapter')
            ORDER BY json_extract(metadata, '$.chapter') ASC
        `, [merchantId]);

        if (!nodes || nodes.length === 0) {
            return res.json({
                success: true,
                data: { chapters: [] }
            });
        }

        // Get player progress to check completion status
        const progress = await StoryService.getPlayerStoryProgress(playerId);
        const visitedNodes = progress.visitedNodes || [];

        const chapters = nodes.map(node => ({
            chapter: parseInt(node.chapter),
            title: node.title,
            storyType: node.story_type,
            initialNodeId: node.initial_node_id,
            completed: visitedNodes.includes(node.initial_node_id)
        }));

        res.json({
            success: true,
            data: { chapters }
        });

    } catch (error) {
        logger.error('Failed to fetch story chapters:', error);
        res.status(500).json({
            success: false,
            error: '서버 오류가 발생했습니다'
        });
    }
});

module.exports = router;
function mapTriggerToCategory(triggerType = '') {
    const normalized = triggerType.toLowerCase();

    if (['greeting', 'hello', 'welcome', 'intro'].includes(normalized)) {
        return 'greeting';
    }

    if (['trade_start', 'trade', 'deal', 'negotiation', 'sales', 'offer'].includes(normalized)) {
        return 'trading';
    }

    if (['trade_end', 'farewell', 'goodbye', 'close', 'thanks', 'bye'].includes(normalized)) {
        return 'goodbye';
    }

    if (['relationship', 'trust', 'friendship', 'loyalty', 'affection'].includes(normalized)) {
        return 'relationship';
    }

    if (['special_event', 'event', 'secret', 'story', 'special'].includes(normalized)) {
        return 'special';
    }

    return 'special';
}

function initializeDialogueBuckets() {
    return {
        greeting: [],
        trading: [],
        goodbye: [],
        relationship: [],
        special: []
    };
}

function generateFallbackDialogues(merchant) {
    const displayName = merchant?.name || '상인';
    const normalizedName = displayName.replace(/\s+/g, '').toLowerCase();
    const type = (merchant?.merchant_type || '').toLowerCase();
    const personality = (merchant?.personality || '').toLowerCase();

    if (merchantDialogueLibrary[normalizedName]) {
        return merchantDialogueLibrary[normalizedName];
    }

    const fallback = {
        greeting: [
            `${displayName}의 가게에 오신 것을 환영합니다!`,
            '오늘도 흥미로운 물건들이 많이 들어왔어요.',
            '편하게 둘러보세요. 마음에 드는 게 있다면 말씀만 주세요.',
            '좋은 손님을 만나는 날은 언제나 즐겁답니다.'
        ],
        trading: [
            '상품을 살펴보고 마음에 드는 것이 있으면 말씀해주세요.',
            '흥정을 하고 싶다면 언제든지 도전해 보세요.',
            '이건 이번 주의 인기 상품이에요.',
            '필요하신 게 있으면 기꺼이 도와드릴게요.'
        ],
        goodbye: [
            '언제든지 다시 들러주세요.',
            '안전한 여정 되시길 바랍니다.',
            '다음에 오시면 더 좋은 소식을 준비해 둘게요.'
        ],
        relationship: [
            '자주 찾아와 주셔서 정말 감사해요.',
            '믿음이 쌓일수록 더 좋은 거래를 준비할게요.',
            '당신과의 거래는 늘 즐겁습니다.'
        ],
        special: [
            '특별한 손님에게만 보여드리는 물건이 있어요.',
            '오늘만 공개하는 비밀 상품을 보고 가세요.',
            '숨겨 둔 보물도 마음만 먹으면 보여드릴 수 있답니다.'
        ]
    };

    if (type.includes('fashion')) {
        fallback.trading.push('최신 스타일의 의상을 직접 골라보세요. 어울리는 코디도 추천해 드릴게요.');
    }

    if (type.includes('technology') || type.includes('tech')) {
        fallback.trading.push('최첨단 장비들이 준비되어 있습니다. 기능 설명이 필요하시면 말씀 주세요.');
    }

    if (type.includes('fantasy') || type.includes('temporal') || type.includes('mystic')) {
        fallback.special.push('시간과 공간을 넘어온 희귀한 아이템이 있어요. 용기가 있다면 구경해볼래요?');
    }

    if (type.includes('beverages') || type.includes('food')) {
        fallback.trading.push('막 도착한 신선한 재료들이 있어요. 향을 한번 맡아보세요.');
    }

    if (personality.includes('cold') || personality.includes('strict')) {
        fallback.greeting.push('필요한 물건이 있으면 간단하게 말해주세요. 효율이 가장 중요하니까요.');
        fallback.goodbye.push('다음에도 실속 있는 거래를 기대하겠습니다.');
    } else if (personality.includes('cheerful') || personality.includes('friendly')) {
        fallback.greeting.push('오셨군요! 오늘도 즐거운 거래가 되길 바라요.');
        fallback.goodbye.push('또 봐요! 좋은 일만 가득했으면 좋겠어요.');
    }

    return fallback;
}
