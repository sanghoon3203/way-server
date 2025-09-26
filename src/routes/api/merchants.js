// 📁 src/routes/api/merchants.js - 상인 관련 API 라우트
const express = require('express');
const { query, validationResult } = require('express-validator');
const { randomUUID } = require('crypto');
const DatabaseManager = require('../../database/DatabaseManager');
const { authenticateToken } = require('../../middleware/auth');
const logger = require('../../config/logger');
const merchantDialogueLibrary = require('../../constants/merchantDialogues');

const router = express.Router();

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

                // 거래 가능 여부 확인
                const canTrade = player.current_license >= merchant.required_license 
                    && player.reputation >= merchant.reputation_requirement;

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
                    requiredLicense: merchant.required_license,
                    reputationRequirement: merchant.reputation_requirement,
                    priceModifier: merchant.price_modifier,
                    negotiationDifficulty: merchant.negotiation_difficulty,
                    inventoryCount: merchant.inventory_count,
                    lastRestocked: merchant.last_restocked,
                    imageFileName: merchant.image_filename,
                    imagePath: merchant.image_filename ? `/public/merchants/${merchant.image_filename}` : null
                };
            })
            .filter(merchant => merchant.distance <= radius)
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
                
                // 관계 정보
                relationship: relationship ? {
                    friendshipPoints: relationship.friendship_points,
                    trustLevel: relationship.trust_level,
                    totalTrades: relationship.total_trades,
                    totalSpent: relationship.total_spent,
                    lastInteraction: relationship.last_interaction,
                    notes: relationship.notes
                } : {
                    friendshipPoints: 0,
                    trustLevel: 0,
                    totalTrades: 0,
                    totalSpent: 0,
                    lastInteraction: null,
                    notes: null
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
                    id: "Alicegang",
                    name: "애니박",
                    title: null,
                    type: "retail",
                    personality: "neutral",
                    district: "jung",
                    location: { lat: 37.5636, lng: 126.9979 },
                    requiredLicense: 1,
                    reputationRequirement: 0,
                    priceModifier: 1,
                    negotiationDifficulty: 3,
                    inventory: []
                },
                {
                    id: "nacho",
                    name: "카타리나 최",
                    title: null,
                    type: "retail",
                    personality: "neutral",
                    district: "jung",
                    location: { lat: 37.5636, lng: 126.9979 },
                    requiredLicense: 1,
                    reputationRequirement: 0,
                    priceModifier: 1,
                    negotiationDifficulty: 3,
                    inventory: []
                },
                {
                    id: "corea",
                    name: "진백호",
                    title: null,
                    type: "cafe",
                    personality: "neutral",
                    district: "gangdong",
                    location: { lat: 37.5301, lng: 127.1238 },
                    requiredLicense: 1,
                    reputationRequirement: 0,
                    priceModifier: 1,
                    negotiationDifficulty: 3,
                    inventory: []
                },
                {
                    id: "joo",
                    name: "주블수",
                    title: null,
                    type: "weaponsmith",
                    personality: "neutral",
                    district: "gangdong",
                    location: { lat: 37.5301, lng: 127.1238 },
                    requiredLicense: 1,
                    reputationRequirement: 0,
                    priceModifier: 1,
                    negotiationDifficulty: 3,
                    inventory: []
                },
                {
                    id: "Seongbok",
                    name: "김세휘",
                    title: null,
                    type: "retail",
                    personality: "neutral",
                    district: "jung",
                    location: { lat: 37.5636, lng: 126.9979 },
                    requiredLicense: 1,
                    reputationRequirement: 0,
                    priceModifier: 1,
                    negotiationDifficulty: 3,
                    inventory: []
                },
                {
                    id: "mariapple",
                    name: "마리",
                    title: null,
                    type: "retail",
                    personality: "neutral",
                    district: "jung",
                    location: { lat: 37.5636, lng: 126.9979 },
                    requiredLicense: 1,
                    reputationRequirement: 0,
                    priceModifier: 1,
                    negotiationDifficulty: 3,
                    inventory: []
                },
                {
                    id: "seoye",
                    name: "서예나",
                    title: null,
                    type: "auction",
                    personality: "neutral",
                    district: "gangnam",
                    location: { lat: 37.5172, lng: 127.0473 },
                    requiredLicense: 1,
                    reputationRequirement: 0,
                    priceModifier: 1,
                    negotiationDifficulty: 3,
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
