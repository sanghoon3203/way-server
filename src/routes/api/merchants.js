// 📁 src/routes/api/merchants.js - 상인 관련 API 라우트
const express = require('express');
const { query, validationResult } = require('express-validator');
const DatabaseManager = require('../../database/DatabaseManager');
const { authenticateToken } = require('../../middleware/auth');
const logger = require('../../config/logger');

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
                    lastRestocked: merchant.last_restocked
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
                lastRestocked: merchant.last_restocked
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