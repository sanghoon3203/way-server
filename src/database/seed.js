// 📁 src/database/seed.js - 기본 샘플 데이터 추가
const DatabaseManager = require('./DatabaseManager');
const { randomUUID } = require('crypto');
const logger = require('../config/logger');

async function seedDatabase() {
    try {
        logger.info('샘플 데이터 생성 시작...');
        
        await DatabaseManager.initialize();
        
        // 아이템 템플릿 추가
        await seedItemTemplates();
        
        // 상인 추가
        await seedMerchants();
        
        // 상인 인벤토리 추가
        await seedMerchantInventory();
        
        // 퀘스트 템플릿 추가
        await seedQuestTemplates();
        
        // 스킬 템플릿 추가
        await seedSkillTemplates();
        
        // 성취 시스템 시드 데이터
        await seedAchievements();
        
        // 테스트 플레이어 추가
        await seedTestPlayers();
        
        logger.info('샘플 데이터 생성 완료!');
        
    } catch (error) {
        logger.error('샘플 데이터 생성 실패:', error);
    } finally {
        await DatabaseManager.close();
    }
}

async function seedItemTemplates() {
    logger.info('아이템 템플릿 생성...');
    
    const itemTemplates = [
        // 전자제품 카테고리
        { name: '스마트폰', category: 'electronics', grade: 2, basePrice: 800000, description: '최신 스마트폰' },
        { name: '노트북', category: 'electronics', grade: 3, basePrice: 1500000, description: '고성능 노트북' },
        { name: '이어폰', category: 'electronics', grade: 1, basePrice: 150000, description: '무선 이어폰' },
        { name: '태블릿', category: 'electronics', grade: 2, basePrice: 600000, description: '터치스크린 태블릿' },
        { name: '게임 콘솔', category: 'electronics', grade: 3, basePrice: 500000, description: '게임 전용기' },
        
        // 의류 카테고리
        { name: '정장', category: 'clothing', grade: 2, basePrice: 300000, description: '고급 정장' },
        { name: '운동화', category: 'clothing', grade: 1, basePrice: 120000, description: '편안한 운동화' },
        { name: '가방', category: 'clothing', grade: 1, basePrice: 80000, description: '실용적인 백팩' },
        { name: '시계', category: 'clothing', grade: 3, basePrice: 1200000, description: '고급 시계' },
        { name: '모자', category: 'clothing', grade: 0, basePrice: 25000, description: '캐주얼 모자' },
        
        // 음식 카테고리
        { name: '김치', category: 'food', grade: 0, basePrice: 15000, description: '전통 김치' },
        { name: '고급 한우', category: 'food', grade: 4, basePrice: 300000, description: '프리미엄 한우' },
        { name: '인삼', category: 'food', grade: 3, basePrice: 150000, description: '6년근 인삼' },
        { name: '녹차', category: 'food', grade: 1, basePrice: 45000, description: '제주 녹차' },
        { name: '막걸리', category: 'food', grade: 1, basePrice: 12000, description: '전통 막걸리' },
        
        // 예술품 카테고리
        { name: '도자기', category: 'arts', grade: 3, basePrice: 500000, description: '전통 도자기' },
        { name: '서예 작품', category: 'arts', grade: 2, basePrice: 200000, description: '명필 서예' },
        { name: '한지', category: 'arts', grade: 1, basePrice: 30000, description: '전통 한지' },
        { name: '목공예품', category: 'arts', grade: 2, basePrice: 180000, description: '수제 목공예' },
        { name: '민화', category: 'arts', grade: 2, basePrice: 250000, description: '전통 민화' },
        
        // 골동품 카테고리
        { name: '고서', category: 'antiques', grade: 4, basePrice: 800000, description: '조선시대 고서' },
        { name: '청자', category: 'antiques', grade: 5, basePrice: 2000000, description: '고려청자' },
        { name: '백자', category: 'antiques', grade: 4, basePrice: 1200000, description: '조선백자' },
        { name: '나전칠기', category: 'antiques', grade: 3, basePrice: 600000, description: '전통 나전칠기' },
        { name: '고가구', category: 'antiques', grade: 4, basePrice: 1500000, description: '조선시대 가구' }
    ];
    
    for (let i = 0; i < itemTemplates.length; i++) {
        const item = itemTemplates[i];
        await DatabaseManager.run(`
            INSERT INTO item_templates (id, name, category, grade, required_license, base_price, weight, description, icon_id)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        `, [
            randomUUID(),
            item.name,
            item.category,
            item.grade,
            item.grade > 2 ? 1 : 0,  // 고급 아이템은 일반 라이센스 필요
            item.basePrice,
            1.0,
            item.description,
            i + 1
        ]);
    }
    
    logger.info(`${itemTemplates.length}개의 아이템 템플릿 생성 완료`);
}

async function seedMerchants() {
    logger.info('상인 데이터 생성...');
    
    const merchants = [
        // 네오 시부야 - 사이버펑크 스타일
        {
            name: '서예나',
            title: '네오-시티 스타일리스트',
            type: 'fashion',
            personality: 'cold',
            district: 'neo_shibuya',
            lat: 37.5665,
            lng: 126.9780,
            priceModifier: 1.3,
            negotiationDifficulty: 4,
            reputationRequirement: 100,
            imageFileName: 'Seoyena.png'
        },

        // 마포 크레이티브 허브 - 천사혈통 염력 전문가
        {
            name: '마리',
            title: '염력 부여 전문가',
            type: 'enhancement',
            personality: 'cheerful',
            district: 'mapo',
            lat: 37.5219,
            lng: 126.8954,
            priceModifier: 1.4,
            negotiationDifficulty: 2,
            reputationRequirement: 0,
            imageFileName: 'Mari.png'
        },

        // 아카데믹 가든 - 과학 임플란트 전문가
        {
            name: '김세휘',
            title: '임플란트 연구자',
            type: 'technology',
            personality: 'intellectual',
            district: 'academic',
            lat: 37.5636,
            lng: 126.9970,
            priceModifier: 2.5,
            negotiationDifficulty: 3,
            reputationRequirement: 50,
            requiredLicense: 1,
            imageFileName: 'Kimsehwui.png'
        },

        // 레이크사이드 원더랜드 - 드림크리스탈 전문가
        {
            name: '애니박',
            title: '드림크리스탈 공주',
            type: 'fantasy',
            personality: 'dreamy',
            district: 'lakeside',
            lat: 37.5311,
            lng: 127.1011,
            priceModifier: 3.0,
            negotiationDifficulty: 2,
            reputationRequirement: 200,
            requiredLicense: 2,
            imageFileName: 'Anipark.png'
        },

        // 메트로 폴리스 - 성스러운 아이템 전문가
        {
            name: '카타리나 최',
            title: '성당 프리스트',
            type: 'religious',
            personality: 'protective',
            district: 'metro',
            lat: 37.5012,
            lng: 127.0396,
            priceModifier: 1.8,
            negotiationDifficulty: 1,
            reputationRequirement: 25,
            imageFileName: 'Catarinachoi.png'
        },

        // 이스트리버빌리지 - 커피하우스 운영
        {
            name: '진백호',
            title: '테라 커피하우스 주인',
            type: 'beverages',
            personality: 'cunning',
            district: 'eastriver',
            lat: 37.5384,
            lng: 127.0594,
            priceModifier: 1.6,
            negotiationDifficulty: 4,
            reputationRequirement: 75,
            imageFileName: 'Jinbaekho.png'
        },

        // 이스트리버빌리지 - 대장장이 무기 제작
        {
            name: '주불수',
            title: '크래프트타운 대장장이',
            type: 'weapons',
            personality: 'tough',
            district: 'eastriver',
            lat: 37.5249,
            lng: 127.0512,
            priceModifier: 2.2,
            negotiationDifficulty: 5,
            reputationRequirement: 150,
            requiredLicense: 1,
            imageFileName: 'Jubulsu.png'
        },

        // 시간의 회랑 - 시간 보안 장비
        {
            name: '기주리',
            title: '시간 보안관',
            type: 'temporal',
            personality: 'strict',
            district: 'time_corridor',
            lat: 37.5729,
            lng: 126.9794,
            priceModifier: 2.8,
            negotiationDifficulty: 5,
            reputationRequirement: 300,
            requiredLicense: 2,
            imageFileName: 'Kijuri.png'
        }
    ];
    
    for (const merchant of merchants) {
        await DatabaseManager.run(`
            INSERT INTO merchants (
                id, name, title, merchant_type, personality, district,
                lat, lng, required_license, price_modifier, negotiation_difficulty,
                reputation_requirement, image_filename, is_active, last_restocked
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
        `, [
            randomUUID(),
            merchant.name,
            merchant.title,
            merchant.type,
            merchant.personality,
            merchant.district,
            merchant.lat,
            merchant.lng,
            merchant.requiredLicense || 0,
            merchant.priceModifier,
            merchant.negotiationDifficulty,
            merchant.reputationRequirement,
            merchant.imageFileName,
            1
        ]);
    }
    
    logger.info(`${merchants.length}개의 상인 데이터 생성 완료`);
}

async function seedMerchantInventory() {
    logger.info('상인 인벤토리 생성...');
    
    // 모든 상인과 아이템 조회
    const merchants = await DatabaseManager.all('SELECT id, merchant_type FROM merchants');
    const items = await DatabaseManager.all('SELECT id, category, base_price FROM item_templates');
    
    // 상인 타입별 선호 카테고리 매핑
    const merchantCategories = {
        'electronics': ['electronics'],
        'financial': ['electronics', 'arts', 'antiques'],
        'cultural': ['arts', 'food'],
        'antique': ['antiques', 'arts'],
        'artist': ['arts'],
        'craftsman': ['arts', 'clothing'],
        'scholar': ['antiques', 'arts'],
        'food_master': ['food'],
        'trader': ['electronics', 'clothing', 'food'],
        'importer': ['electronics', 'clothing']
    };
    
    for (const merchant of merchants) {
        const preferredCategories = merchantCategories[merchant.merchant_type] || ['electronics', 'clothing', 'food'];
        
        // 각 상인별로 5-10개의 랜덤 아이템 추가
        const itemCount = Math.floor(Math.random() * 6) + 5;
        const selectedItems = items
            .filter(item => preferredCategories.includes(item.category))
            .sort(() => 0.5 - Math.random())
            .slice(0, itemCount);
        
        for (const item of selectedItems) {
            // 가격 변동 (기본 가격의 80% ~ 120%)
            const priceVariation = 0.8 + Math.random() * 0.4;
            const currentPrice = Math.round(item.base_price * priceVariation);
            
            // 재고 수량 (1-5개)
            const quantity = Math.floor(Math.random() * 5) + 1;
            
            await DatabaseManager.run(`
                INSERT INTO merchant_inventory (id, merchant_id, item_template_id, quantity, current_price, last_updated)
                VALUES (?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
            `, [
                randomUUID(),
                merchant.id,
                item.id,
                quantity,
                currentPrice
            ]);
        }
    }
    
    logger.info('상인 인벤토리 생성 완료');
}

async function seedQuestTemplates() {
    logger.info('퀘스트 템플릿 생성...');
    
    const questTemplates = [
        {
            id: 'quest_tutorial_001',
            name: '첫 거래 완성하기',
            description: '상인과 첫 거래를 성공적으로 완료하세요',
            category: 'main_story',
            type: 'trade',
            level_requirement: 1,
            required_license: 0,
            prerequisites: JSON.stringify([]),
            objectives: JSON.stringify([
                { type: 'trade', target: 'any_merchant', count: 1, description: '상인과 거래하기' }
            ]),
            rewards: JSON.stringify({ money: 5000, exp: 100, trust: 10 }),
            auto_complete: true,
            repeatable: false,
            time_limit: null,
            is_active: true,
            sort_order: 1
        },
        {
            id: 'quest_collection_001',
            name: '아이템 수집가',
            description: '다양한 카테고리의 아이템을 수집하세요',
            category: 'side_quest',
            type: 'collect',
            level_requirement: 2,
            required_license: 0,
            prerequisites: JSON.stringify(['quest_tutorial_001']),
            objectives: JSON.stringify([
                { type: 'collect_categories', count: 5, description: '5개 카테고리 아이템 수집' }
            ]),
            rewards: JSON.stringify({ money: 15000, exp: 250, trust: 25 }),
            auto_complete: false,
            repeatable: false,
            time_limit: null,
            is_active: true,
            sort_order: 2
        },
        {
            id: 'quest_exploration_001',
            name: '위치 탐험가',
            description: '다른 지역을 방문하여 거래해보세요',
            category: 'side_quest',
            type: 'visit',
            level_requirement: 3,
            required_license: 0,
            prerequisites: JSON.stringify([]),
            objectives: JSON.stringify([
                { type: 'visit_districts', count: 3, description: '3개 지역 방문하여 거래' }
            ]),
            rewards: JSON.stringify({ money: 20000, exp: 300, trust: 30 }),
            auto_complete: false,
            repeatable: false,
            time_limit: null,
            is_active: true,
            sort_order: 3
        },
        {
            id: 'quest_profit_001',
            name: '수익성 전문가',
            description: '총 50만원 이상의 수익을 달성하세요',
            category: 'side_quest',
            type: 'trade',
            level_requirement: 5,
            required_license: 1,
            prerequisites: JSON.stringify([]),
            objectives: JSON.stringify([
                { type: 'total_profit', amount: 500000, description: '총 수익 50만원 달성' }
            ]),
            rewards: JSON.stringify({ money: 50000, exp: 500, trust: 100 }),
            auto_complete: false,
            repeatable: false,
            time_limit: null,
            is_active: true,
            sort_order: 4
        },
        {
            id: 'quest_daily_001',
            name: '연속 거래왕',
            description: '하루에 10회 이상 거래하세요',
            category: 'daily',
            type: 'trade',
            level_requirement: 3,
            required_license: 0,
            prerequisites: JSON.stringify([]),
            objectives: JSON.stringify([
                { type: 'daily_trades', count: 10, description: '하루 10회 거래' }
            ]),
            rewards: JSON.stringify({ money: 25000, exp: 200, trust: 50 }),
            auto_complete: false,
            repeatable: true,
            time_limit: 86400,
            is_active: true,
            sort_order: 5
        },
        {
            id: 'quest_weekly_001',
            name: '주간 거래 목표',
            description: '이번 주에 50회 거래를 달성하세요',
            category: 'weekly',
            type: 'trade',
            level_requirement: 5,
            required_license: 0,
            prerequisites: JSON.stringify([]),
            objectives: JSON.stringify([
                { type: 'weekly_trades', count: 50, description: '주간 50회 거래' }
            ]),
            rewards: JSON.stringify({ money: 150000, exp: 1200, trust: 250 }),
            auto_complete: false,
            repeatable: true,
            time_limit: 604800,
            is_active: true,
            sort_order: 6
        },
        {
            id: 'quest_specialty_001',
            name: '골동품 감정사',
            description: '골동품 카테고리 아이템을 10개 이상 거래하세요',
            category: 'side_quest',
            type: 'trade',
            level_requirement: 8,
            required_license: 2,
            prerequisites: JSON.stringify([]),
            objectives: JSON.stringify([
                { type: 'category_trades', category: 'antiques', count: 10, description: '골동품 10개 거래' }
            ]),
            rewards: JSON.stringify({ money: 100000, exp: 800, trust: 200 }),
            auto_complete: false,
            repeatable: false,
            time_limit: null,
            is_active: true,
            sort_order: 7
        },
        {
            id: 'quest_mastery_001',
            name: '마스터 트레이더',
            description: '모든 카테고리에서 거래를 완성하세요',
            category: 'achievement',
            type: 'trade',
            level_requirement: 10,
            required_license: 2,
            prerequisites: JSON.stringify([]),
            objectives: JSON.stringify([
                { type: 'all_categories', count: 6, description: '모든 카테고리 거래 완성' }
            ]),
            rewards: JSON.stringify({ money: 200000, exp: 1000, trust: 300 }),
            auto_complete: false,
            repeatable: false,
            time_limit: null,
            is_active: true,
            sort_order: 8
        }
    ];
    
    for (const quest of questTemplates) {
        await DatabaseManager.run(`
            INSERT INTO quest_templates (
                id, name, description, category, type, level_requirement,
                required_license, prerequisites, objectives, rewards,
                auto_complete, repeatable, time_limit, is_active, sort_order
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `, [
            quest.id,
            quest.name,
            quest.description,
            quest.category,
            quest.type,
            quest.level_requirement,
            quest.required_license,
            quest.prerequisites,
            quest.objectives,
            quest.rewards,
            quest.auto_complete,
            quest.repeatable,
            quest.time_limit,
            quest.is_active,
            quest.sort_order
        ]);
    }
    
    logger.info(`${questTemplates.length}개의 퀘스트 템플릿 생성 완료`);
}

async function seedSkillTemplates() {
    logger.info('스킬 템플릿 생성...');
    
    const skillTemplates = [
        // 거래 스킬 트리
        {
            name: '기본 거래술',
            description: '기본적인 거래 기술을 익힙니다',
            category: 'trading',
            skillType: 'passive',
            tier: 1,
            maxLevel: 10,
            baseCost: 1,
            costMultiplier: 1.2,
            effects: JSON.stringify({
                trade_success_rate: { base: 5, perLevel: 2 },
                negotiation_bonus: { base: 1, perLevel: 1 }
            }),
            prerequisites: null
        },
        {
            name: '가격 감정',
            description: '아이템의 정확한 가치를 파악할 수 있습니다',
            category: 'appraisal',
            skillType: 'active',
            tier: 1,
            maxLevel: 5,
            baseCost: 2,
            costMultiplier: 1.5,
            effects: JSON.stringify({
                price_accuracy: { base: 10, perLevel: 5 },
                hidden_info_chance: { base: 15, perLevel: 10 }
            }),
            prerequisites: null
        },
        {
            name: '고급 협상술',
            description: '더 유리한 조건으로 거래할 수 있습니다',
            category: 'negotiation',
            skillType: 'passive',
            tier: 2,
            maxLevel: 8,
            baseCost: 3,
            costMultiplier: 1.3,
            effects: JSON.stringify({
                price_discount: { base: 3, perLevel: 2 },
                merchant_friendship_bonus: { base: 5, perLevel: 3 }
            }),
            prerequisites: JSON.stringify(['기본 거래술'])
        },
        {
            name: '시장 분석',
            description: '시장 동향을 파악하여 최적의 거래 시점을 찾습니다',
            category: 'analysis',
            skillType: 'active',
            tier: 2,
            maxLevel: 6,
            baseCost: 4,
            costMultiplier: 1.4,
            effects: JSON.stringify({
                market_prediction: { base: 20, perLevel: 10 },
                trend_detection: { base: 1, perLevel: 1 }
            }),
            prerequisites: JSON.stringify(['가격 감정'])
        },
        
        // 운반 스킬 트리
        {
            name: '인벤토리 확장',
            description: '더 많은 아이템을 보관할 수 있습니다',
            category: 'storage',
            skillType: 'passive',
            tier: 1,
            maxLevel: 5,
            baseCost: 2,
            costMultiplier: 2.0,
            effects: JSON.stringify({
                inventory_slots: { base: 2, perLevel: 1 },
                weight_capacity: { base: 10, perLevel: 5 }
            }),
            prerequisites: null
        },
        {
            name: '효율적 포장',
            description: '아이템을 더 효율적으로 포장하여 공간을 절약합니다',
            category: 'storage',
            skillType: 'passive',
            tier: 2,
            maxLevel: 4,
            baseCost: 3,
            costMultiplier: 1.8,
            effects: JSON.stringify({
                storage_efficiency: { base: 15, perLevel: 10 },
                fragile_protection: { base: 20, perLevel: 15 }
            }),
            prerequisites: JSON.stringify(['인벤토리 확장'])
        },
        
        // 관계 스킬 트리
        {
            name: '사교술',
            description: '상인들과 더 좋은 관계를 맺을 수 있습니다',
            category: 'social',
            skillType: 'passive',
            tier: 1,
            maxLevel: 7,
            baseCost: 1,
            costMultiplier: 1.3,
            effects: JSON.stringify({
                relationship_gain: { base: 20, perLevel: 10 },
                introduction_bonus: { base: 1, perLevel: 1 }
            }),
            prerequisites: null
        },
        {
            name: '신뢰 구축',
            description: '상인들의 신뢰를 더 빠르게 얻을 수 있습니다',
            category: 'social',
            skillType: 'passive',
            tier: 2,
            maxLevel: 5,
            baseCost: 4,
            costMultiplier: 1.6,
            effects: JSON.stringify({
                trust_gain_multiplier: { base: 1.2, perLevel: 0.2 },
                reputation_bonus: { base: 5, perLevel: 3 }
            }),
            prerequisites: JSON.stringify(['사교술'])
        },
        
        // 전문화 스킬
        {
            name: '골동품 전문가',
            description: '골동품 거래에 특화된 지식을 습득합니다',
            category: 'specialization',
            skillType: 'passive',
            tier: 3,
            maxLevel: 3,
            baseCost: 8,
            costMultiplier: 2.0,
            effects: JSON.stringify({
                antique_bonus: { base: 25, perLevel: 15 },
                authenticity_detection: { base: 30, perLevel: 20 }
            }),
            prerequisites: JSON.stringify(['고급 협상술', '시장 분석'])
        },
        {
            name: '전자제품 마스터',
            description: '전자제품 거래의 달인이 됩니다',
            category: 'specialization',
            skillType: 'passive',
            tier: 3,
            maxLevel: 3,
            baseCost: 8,
            costMultiplier: 2.0,
            effects: JSON.stringify({
                electronics_bonus: { base: 25, perLevel: 15 },
                tech_trend_prediction: { base: 40, perLevel: 20 }
            }),
            prerequisites: JSON.stringify(['고급 협상술', '시장 분석'])
        }
    ];
    
    for (const skill of skillTemplates) {
        await DatabaseManager.run(`
            INSERT INTO skill_templates (
                id, name, description, category, tier, max_level,
                prerequisites, unlock_requirements, effects, cost_per_level,
                icon_id, is_active, sort_order
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `, [
            randomUUID(),
            skill.name,
            skill.description,
            skill.category,
            skill.tier,
            skill.maxLevel,
            skill.prerequisites,
            JSON.stringify({ skill_points: skill.baseCost }),
            skill.effects,
            JSON.stringify(Array(skill.maxLevel).fill().map((_, i) => ({ skill_points: skill.baseCost * Math.pow(skill.costMultiplier, i) }))),
            skill.tier,
            1,
            skill.tier * 10
        ]);
    }
    
    logger.info(`${skillTemplates.length}개의 스킬 템플릿 생성 완료`);
}

async function seedAchievements() {
    logger.info('성취 시스템 생성...');
    
    const achievements = [
        // 거래 관련 성취
        {
            name: '첫 걸음',
            description: '첫 거래를 성공적으로 완료했습니다',
            category: 'trading',
            achievementType: 'trade_count',
            targetValue: 1,
            rewardExp: 50,
            rewardMoney: 5000,
            rewardTrust: 10,
            tier: 'bronze',
            isSecret: false
        },
        {
            name: '거래의 달인',
            description: '100회 거래를 달성했습니다',
            category: 'trading',
            achievementType: 'trade_count',
            targetValue: 100,
            rewardExp: 500,
            rewardMoney: 50000,
            rewardTrust: 100,
            tier: 'silver',
            isSecret: false
        },
        {
            name: '거래 마스터',
            description: '1000회 거래를 달성했습니다',
            category: 'trading',
            achievementType: 'trade_count',
            targetValue: 1000,
            rewardExp: 2000,
            rewardMoney: 200000,
            rewardTrust: 500,
            tier: 'gold',
            isSecret: false
        },
        
        // 수익 관련 성취
        {
            name: '첫 수익',
            description: '첫 수익을 달성했습니다',
            category: 'profit',
            achievementType: 'total_profit',
            targetValue: 10000,
            rewardExp: 100,
            rewardMoney: 10000,
            rewardTrust: 20,
            tier: 'bronze',
            isSecret: false
        },
        {
            name: '백만장자',
            description: '총 수익 1,000,000원을 달성했습니다',
            category: 'profit',
            achievementType: 'total_profit',
            targetValue: 1000000,
            rewardExp: 1000,
            rewardMoney: 100000,
            rewardTrust: 200,
            tier: 'gold',
            isSecret: false
        },
        
        // 탐험 관련 성취
        {
            name: '방랑자',
            description: '5개 지역을 모두 방문했습니다',
            category: 'exploration',
            achievementType: 'districts_visited',
            targetValue: 5,
            rewardExp: 300,
            rewardMoney: 30000,
            rewardTrust: 75,
            tier: 'silver',
            isSecret: false
        },
        
        // 관계 관련 성취
        {
            name: '인기쟁이',
            description: '5명의 상인과 친구가 되었습니다',
            category: 'social',
            achievementType: 'merchant_friends',
            targetValue: 5,
            rewardExp: 400,
            rewardMoney: 40000,
            rewardTrust: 100,
            tier: 'silver',
            isSecret: false
        },
        
        // 컬렉션 관련 성취
        {
            name: '수집가',
            description: '모든 카테고리의 아이템을 수집했습니다',
            category: 'collection',
            achievementType: 'item_categories',
            targetValue: 6,
            rewardExp: 600,
            rewardMoney: 60000,
            rewardTrust: 150,
            tier: 'gold',
            isSecret: false
        },
        
        // 비밀 성취
        {
            name: '행운의 거래',
            description: '한 번에 500% 이상의 수익을 얻었습니다',
            category: 'special',
            achievementType: 'single_trade_profit',
            targetValue: 500,
            rewardExp: 1000,
            rewardMoney: 100000,
            rewardTrust: 200,
            tier: 'legendary',
            isSecret: true
        },
        {
            name: '자정의 거래왕',
            description: '자정(00:00)에 거래를 완료했습니다',
            category: 'special',
            achievementType: 'midnight_trade',
            targetValue: 1,
            rewardExp: 300,
            rewardMoney: 25000,
            rewardTrust: 50,
            tier: 'silver',
            isSecret: true
        }
    ];
    
    for (const achievement of achievements) {
        await DatabaseManager.run(`
            INSERT INTO achievement_templates (
                id, name, description, category, type, unlock_condition,
                rewards, points, rarity, is_secret, sort_order, created_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
        `, [
            randomUUID(),
            achievement.name,
            achievement.description,
            achievement.category,
            'progressive', // type
            JSON.stringify({ type: achievement.achievementType, target: achievement.targetValue }),
            JSON.stringify({ 
                money: achievement.rewardMoney, 
                exp: achievement.rewardExp,
                trust: achievement.rewardTrust
            }),
            Math.floor(achievement.rewardExp / 10), // points calculation
            achievement.tier === 'bronze' ? 'common' : 
                achievement.tier === 'silver' ? 'rare' : 
                achievement.tier === 'gold' ? 'epic' : 'legendary',
            achievement.isSecret,
            0 // sort_order
        ]);
    }
    
    logger.info(`${achievements.length}개의 성취 템플릿 생성 완료`);
}

async function seedTestPlayers() {
    logger.info('테스트 플레이어 생성...');
    
    const bcrypt = require('bcrypt');
    
    const testUsers = [
        {
            email: 'test1@waygame.com',
            password: 'test123!',
            playerName: '김거래왕',
            level: 5,
            money: 150000,
            trustPoints: 120,
            reputation: 85,
            currentLicense: 1
        },
        {
            email: 'test2@waygame.com', 
            password: 'test123!',
            playerName: '이수집가',
            level: 3,
            money: 75000,
            trustPoints: 60,
            reputation: 45,
            currentLicense: 0
        },
        {
            email: 'test3@waygame.com',
            password: 'test123!',
            playerName: '박탐험가',
            level: 7,
            money: 250000,
            trustPoints: 200,
            reputation: 150,
            currentLicense: 2
        }
    ];
    
    for (const testUser of testUsers) {
        const userId = randomUUID();
        const playerId = randomUUID();
        const passwordHash = await bcrypt.hash(testUser.password, 12);
        
        // 사용자 생성
        await DatabaseManager.run(`
            INSERT INTO users (id, email, password_hash, created_at, updated_at, is_active)
            VALUES (?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, 1)
        `, [userId, testUser.email, passwordHash]);
        
        // 플레이어 생성
        await DatabaseManager.run(`
            INSERT INTO players (
                id, user_id, name, money, trust_points, reputation, current_license,
                level, experience, stat_points, skill_points,
                strength, intelligence, charisma, luck,
                trading_skill, negotiation_skill, appraisal_skill,
                total_trades, total_profit, created_at, last_active
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
        `, [
            playerId, userId, testUser.playerName, testUser.money, testUser.trustPoints,
            testUser.reputation, testUser.currentLicense, testUser.level,
            testUser.level * 100, testUser.level * 2, testUser.level * 1,
            10 + testUser.level, 10 + testUser.level, 10 + testUser.level, 10 + testUser.level,
            1 + Math.floor(testUser.level / 2), 1 + Math.floor(testUser.level / 3), 1 + Math.floor(testUser.level / 4),
            testUser.level * 10, testUser.money / 2
        ]);
    }
    
    logger.info(`${testUsers.length}명의 테스트 플레이어 생성 완료`);
}

// 스크립트 실행
if (require.main === module) {
    seedDatabase();
}

module.exports = { seedDatabase };