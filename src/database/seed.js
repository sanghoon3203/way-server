// 📁 src/database/seed.js - 기본 샘플 데이터 추가
const fs = require('fs');
const path = require('path');
const DatabaseManager = require('./DatabaseManager');
const { randomUUID } = require('crypto');
const logger = require('../config/logger');

const CATEGORY_TRIGGER_MAP = {
    greeting: 'greeting',
    trading: 'trade',
    goodbye: 'goodbye',
    relationship: 'relationship',
    special: 'special_event'
};

const RARITY_GRADE_MAP = {
    f: 0,
    e: 0,
    d: 0,
    c: 0,
    b: 1,
    a: 2,
    r: 3,
    s: 4,
    sr: 4,
    ssr: 5,
    u: 4,
    ur: 5,
    l: 5,
    legendary: 5
};

const DEFAULT_CATEGORY_BY_TYPE = {
    electronics: 'electronics',
    fashion: 'clothing',
    enhancement: 'arts',
    technology: 'electronics',
    fantasy: 'antiques',
    religious: 'antiques',
    beverages: 'food',
    weapons: 'weapons',
    temporal: 'electronics',
    financial: 'electronics',
    cultural: 'arts',
    antique: 'antiques',
    artist: 'arts',
    craftsman: 'arts',
    scholar: 'antiques',
    food_master: 'food',
    trader: 'clothing',
    importer: 'electronics'
};

const MERCHANT_DATA_DIR = path.join(__dirname, 'merchant_data');
const merchantProfiles = loadMerchantProfiles();

function loadMerchantProfiles() {
    const profiles = new Map();

    if (!fs.existsSync(MERCHANT_DATA_DIR)) {
        logger.warn(`상인 데이터 디렉터리를 찾을 수 없습니다: ${MERCHANT_DATA_DIR}`);
        return profiles;
    }

    const entries = fs.readdirSync(MERCHANT_DATA_DIR);
    for (const entry of entries) {
        const folderPath = path.join(MERCHANT_DATA_DIR, entry);
        if (!fs.statSync(folderPath).isDirectory()) {
            continue;
        }

        const jsonFile = fs.readdirSync(folderPath).find(file => file.toLowerCase().endsWith('.json'));
        if (!jsonFile) {
            continue;
        }

        const filePath = path.join(folderPath, jsonFile);

        try {
            const raw = fs.readFileSync(filePath, 'utf8');
            const parsed = JSON.parse(raw);
            const npcEntries = Object.entries(parsed.npcs || {});
            if (npcEntries.length === 0) {
                continue;
            }

            const [npcKey, npcData] = npcEntries[0];
            const slug = (npcData.id || npcKey || entry).toLowerCase();

            const nameKey = (npcData.name || '').replace(/\s+/g, '').toLowerCase();

            profiles.set(slug, {
                slug,
                npcKey,
                npcData,
                nameKey,
                location: npcData.location || '',
                profileText: npcData.profile || '',
                shopItems: Array.isArray(npcData.shop_items) ? npcData.shop_items : [],
                dialogues: npcData.dialogues || {},
                fallbackDialogues: Array.isArray(npcData.dialogue) ? npcData.dialogue : [],
                sourcePath: filePath
            });
        } catch (error) {
            logger.warn(`상인 JSON 파싱 실패 (${filePath}): ${error.message}`);
        }
    }

    return profiles;
}

function getMerchantProfile(identifier) {
    if (!identifier) {
        return undefined;
    }

    const normalized = String(identifier).toLowerCase().replace(/\s+/g, '');
    if (merchantProfiles.has(normalized)) {
        return merchantProfiles.get(normalized);
    }

    for (const profile of merchantProfiles.values()) {
        if (profile.slug === normalized || profile.nameKey === normalized) {
            return profile;
        }
    }

    return undefined;
}

function mapCategoryToTrigger(category) {
    return CATEGORY_TRIGGER_MAP[category] || 'special_event';
}

function getGradeFromRarity(rarity) {
    if (!rarity) {
        return 0;
    }

    const tokens = String(rarity)
        .split(/[\s,\/]+/)
        .map(token => token.trim().toLowerCase())
        .filter(Boolean);

    if (tokens.length === 0) {
        return 0;
    }

    let grade = 0;
    for (const token of tokens) {
        grade = Math.max(grade, RARITY_GRADE_MAP[token] ?? 0);
    }

    return grade;
}

function getDefaultCategory(merchantType) {
    const normalized = (merchantType || '').toLowerCase();
    return DEFAULT_CATEGORY_BY_TYPE[normalized] || 'general';
}

function splitSentences(text) {
    if (!text) {
        return [];
    }
    return text
        .replace(/\s+/g, ' ')
        .split(/[.!?…]/)
        .map(sentence => sentence.trim())
        .filter(sentence => sentence.length > 0);
}

function buildSentence(base, fallback) {
    return base && base.length > 0 ? base : fallback;
}

function generateDialoguesFromProfile(profile) {
    const dialogues = {
        greeting: [],
        trading: [],
        goodbye: [],
        relationship: [],
        special: []
    };

    const name = profile?.npcData?.name || '상인';
    const location = profile?.location || '이곳';
    const profileText = profile?.profileText || '';
    const sentences = splitSentences(profileText);

    const defaultGreeting = `${location}에 오신 것을 환영합니다.`;
    const defaultTrading = '필요하신 상품이 있다면 말씀해 주세요. 최선을 다해 도와드릴게요.';
    const defaultGoodbye = '다음에 또 찾아주세요. 항상 기다리고 있겠습니다.';
    const defaultRelationship = `${name}와의 인연이 깊어질수록 더 많은 기회가 열릴 거예요.`;
    const defaultSpecial = '특별한 손님을 위한 비밀 상품도 준비되어 있습니다.';

    const highlights = sentences.slice(0, 3);

    dialogues.greeting.push(buildSentence(highlights[0], `${defaultGreeting} 저는 ${name}입니다.`));
    dialogues.trading.push(buildSentence(highlights[1], defaultTrading));
    dialogues.goodbye.push(buildSentence(highlights[2], defaultGoodbye));
    dialogues.relationship.push(defaultRelationship);
    dialogues.special.push(defaultSpecial);

    return dialogues;
}

function mergeDialogues(base, extra) {
    const result = { ...base };
    if (!extra) {
        return result;
    }

    for (const [category, lines] of Object.entries(extra)) {
        if (!Array.isArray(lines) || lines.length === 0) {
            continue;
        }
        result[category] = [...lines];
    }

    return result;
}

async function seedDatabase(options = {}) {
    const { reuseConnection = false, force = false } = options;
    const seededTables = [];

    try {
        logger.info('샘플 데이터 생성 준비 중...');

        if (!reuseConnection) {
            await DatabaseManager.initialize();
        }

        if (force) {
            logger.warn('force 옵션이 활성화되어 기존 시드 데이터를 초기화합니다.');
            await clearSeedTables();
        }

        await seedIfNeeded('item_templates', seedItemTemplates, '아이템 템플릿', { force, seededTables });
        await seedIfNeeded('merchants', seedMerchants, '상인', { force, seededTables });
        await seedIfNeeded('merchant_dialogues', seedMerchantDialogues, '상인 대화', { force, seededTables });
        await seedIfNeeded('merchant_inventory', seedMerchantInventory, '상인 인벤토리', { force, seededTables });
        await seedIfNeeded('story_nodes', seedStoryNodes, '스토리 노드', { force, seededTables });
        await seedIfNeeded('quest_templates', seedQuestTemplates, '퀘스트 템플릿', { force, seededTables });
        await seedIfNeeded('quest_templates', seedStoryQuests, '스토리 퀘스트', { force, seededTables });
        await seedIfNeeded('skill_templates', seedSkillTemplates, '스킬 템플릿', { force, seededTables });
        await seedIfNeeded('achievement_templates', seedAchievements, '성취 템플릿', { force, seededTables });
        await seedIfNeeded('users', seedTestPlayers, '테스트 플레이어', { force, seededTables });

        if (seededTables.length > 0) {
            logger.info(`샘플 데이터 생성 완료! (새로 채워진 테이블: ${seededTables.join(', ')})`);
        } else {
            logger.info('샘플 데이터가 이미 존재하여 자동 시드를 건너뛰었습니다.');
        }

        return seededTables;

    } catch (error) {
        logger.error('샘플 데이터 생성 실패:', error);
        throw error;
    } finally {
        if (!reuseConnection) {
            await DatabaseManager.close();
        }
    }
}

async function seedIfNeeded(tableName, seedFn, label, { force, seededTables }) {
    if (force || await isTableEmpty(tableName)) {
        await seedFn();
        seededTables.push(label);
    } else {
        logger.info(`${label} 데이터가 이미 존재합니다. 시드를 건너뜁니다.`);
    }
}

async function isTableEmpty(tableName) {
    const row = await DatabaseManager.get(`SELECT COUNT(*) as count FROM ${tableName}`);
    return !row || row.count === 0;
}

async function clearSeedTables() {
    const tablesInDeleteOrder = [
        'merchant_dialogue_logs',
        'merchant_dialogues',
        'merchant_inventory',
        'merchant_preferences',
        'merchant_relationship_quest_log',
        'merchant_relationships',
        'trade_records',
        'player_items',
        'player_sessions',
        'players',
        'users',
        'merchants',
        'item_templates',
        'quest_templates',
        'skill_templates',
        'achievement_templates'
    ];

    for (const table of tablesInDeleteOrder) {
        await DatabaseManager.run(`DELETE FROM ${table}`);
    }

    logger.info('기존 시드 테이블 데이터를 초기화했습니다.');
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
        { name: '고가구', category: 'antiques', grade: 4, basePrice: 1500000, description: '조선시대 가구' },

        // 무기/장비 카테고리
        { name: '강철 검', category: 'weapons', grade: 3, basePrice: 450000, description: '숙련 대장장이의 작품' },
        { name: '이중 도끼', category: 'weapons', grade: 2, basePrice: 320000, description: '균형 잡힌 전투 도끼' },
        { name: '방어구 세트', category: 'weapons', grade: 4, basePrice: 600000, description: '강화 합금 방어구 세트' },
        { name: '권총 개조 키트', category: 'weapons', grade: 2, basePrice: 280000, description: '개인화된 무기 개조 키트' },
        { name: '강화 탄환 팩', category: 'weapons', grade: 1, basePrice: 120000, description: '고성능 탄환 팩' }
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

    const merchantColumns = await DatabaseManager.all("PRAGMA table_info(merchants)");
    const hasImageFilenameColumn = merchantColumns.some(column => column.name === 'image_filename');
    const hasStoryColumns = merchantColumns.some(column => column.name === 'story_role');

    if (!hasImageFilenameColumn) {
        logger.warn('merchants 테이블에 image_filename 컬럼이 없습니다. 마이그레이션 실행을 권장하며, 기본 이미지 없이 시드를 진행합니다.');
    }

    if (!hasStoryColumns) {
        logger.warn('merchants 테이블에 story_role 컬럼이 없습니다. 스토리 시스템 마이그레이션(005)이 실행되지 않았을 수 있습니다.');
    }
    
    const merchants = [
        // 마포 크레이티브 허브 - 천사혈통 염력 전문가 (Tier 1: 메인 스토리)
        {
            id: 'mari',
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
            imageFileName: 'Mari.png',
            storyRole: 'main',
            initialStoryNode: 'story_mari_01',
            hasActiveStory: 1
        },

        // 메트로 폴리스 - 성스러운 아이템 전문가 (Tier 2: 사이드 스토리)
        {
            id: 'catarinachoi',
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
            imageFileName: 'Catarinachoi.png',
            storyRole: 'side',
            initialStoryNode: 'story_katarina_01',
            hasActiveStory: 1
        },

        // 아카데믹 가든 - 과학 임플란트 전문가 (Tier 2: 사이드 스토리)
        {
            id: 'kimsehwui',
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
            imageFileName: 'Kimsehwui.png',
            storyRole: 'side',
            initialStoryNode: 'story_kim_01',
            hasActiveStory: 1
        },

        // 네오 시부야 - 사이버펑크 스타일 (거래 전용)
        {
            id: 'seoyena',
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
            imageFileName: 'Seoyena.png',
            storyRole: 'vendor_only',
            initialStoryNode: null,
            hasActiveStory: 0
        },

        // 레이크사이드 원더랜드 - 드림크리스탈 전문가 (거래 전용)
        {
            id: 'anipark',
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
            imageFileName: 'Anipark.png',
            storyRole: 'vendor_only',
            initialStoryNode: null,
            hasActiveStory: 0
        },

        // 이스트리버빌리지 - 커피하우스 운영 (거래 전용)
        {
            id: 'jinbaekho',
            name: '진백호',
            title: '테라 커피하우스 주인',
            type: 'beverages',
            personality: 'cunning',
            district: 'eastriver',
            lat: 37.5217,  // 올림픽공원 근처
            lng: 127.1224,
            priceModifier: 1.6,
            negotiationDifficulty: 4,
            reputationRequirement: 75,
            imageFileName: 'Jinbaekho.png',
            storyRole: 'vendor_only',
            initialStoryNode: null,
            hasActiveStory: 0
        },

        // 이스트리버빌리지 - 대장장이 무기 제작 (거래 전용)
        {
            id: 'jubulsu',
            name: '주불수',
            title: '크래프트타운 대장장이',
            type: 'weapons',
            personality: 'tough',
            district: 'eastriver',
            lat: 37.5217,  // 올림픽공원 근처
            lng: 127.1224,
            priceModifier: 2.2,
            negotiationDifficulty: 5,
            reputationRequirement: 150,
            requiredLicense: 1,
            imageFileName: 'Jubulsu.png',
            storyRole: 'vendor_only',
            initialStoryNode: null,
            hasActiveStory: 0
        },

        // 시간의 회랑 - 시간 보안 장비 (거래 전용)
        {
            id: 'kijuri',
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
            imageFileName: 'Kijuri.png',
            storyRole: 'vendor_only',
            initialStoryNode: null,
            hasActiveStory: 0
        },

        // 서래 가든 타운 - 회복 물약 전문가 (거래 전용)
        {
            id: 'alicegang',
            name: '앨리스 강',
            title: '프렌치 아포테케리',
            type: 'cultural',
            personality: 'gentle',
            district: 'seorae',
            lat: 37.4878,
            lng: 127.0100,
            priceModifier: 2.0,
            negotiationDifficulty: 3,
            reputationRequirement: 100,
            requiredLicense: 1,
            imageFileName: 'Alicegang.png',
            storyRole: 'vendor_only',
            initialStoryNode: null,
            hasActiveStory: 0
        }
    ];
    
    for (const merchant of merchants) {
        const columns = [];
        const placeholders = [];
        const params = [];

        const addColumn = (column, value, { raw = false } = {}) => {
            columns.push(column);
            if (raw) {
                placeholders.push(value);
            } else {
                placeholders.push('?');
                params.push(value);
            }
        };

        addColumn('id', merchant.id || randomUUID());
        addColumn('name', merchant.name);
        addColumn('title', merchant.title);
        addColumn('merchant_type', merchant.type);
        addColumn('personality', merchant.personality);
        addColumn('district', merchant.district);
        addColumn('lat', merchant.lat);
        addColumn('lng', merchant.lng);
        addColumn('required_license', merchant.requiredLicense || 0);
        addColumn('price_modifier', merchant.priceModifier);
        addColumn('negotiation_difficulty', merchant.negotiationDifficulty);
        addColumn('reputation_requirement', merchant.reputationRequirement);

        if (hasImageFilenameColumn) {
            addColumn('image_filename', merchant.imageFileName || null);
        }

        if (hasStoryColumns) {
            addColumn('story_role', merchant.storyRole || 'vendor_only');
            addColumn('initial_story_node', merchant.initialStoryNode || null);
            addColumn('has_active_story', merchant.hasActiveStory || 0);
        }

        addColumn('is_active', 1);
        addColumn('last_restocked', 'CURRENT_TIMESTAMP', { raw: true });

        const sql = `INSERT INTO merchants (${columns.join(', ')}) VALUES (${placeholders.join(', ')})`;
        await DatabaseManager.run(sql, params);
    }
    
    logger.info(`${merchants.length}개의 상인 데이터 생성 완료`);
}

async function seedMerchantInventory() {
    logger.info('상인 인벤토리 생성...');

    const merchants = await DatabaseManager.all('SELECT id, name, merchant_type, required_license FROM merchants');
    const existingTemplates = await DatabaseManager.all('SELECT id, name, category, grade, required_license, base_price, icon_id FROM item_templates');

    const itemsByName = new Map();
    let maxIconId = 0;

    for (const template of existingTemplates) {
        itemsByName.set(template.name, template);
        if (typeof template.icon_id === 'number') {
            maxIconId = Math.max(maxIconId, template.icon_id);
        }
    }

    let insertedCount = 0;

    for (const merchant of merchants) {
        const profile = getMerchantProfile(merchant.id) || getMerchantProfile(merchant.name);
        const shopItems = profile?.shopItems ?? [];

        if (shopItems.length === 0) {
            logger.warn('상인 JSON에 shop_items 항목이 없습니다. 무작위 아이템을 사용할 수 없습니다.', { merchant: merchant.name, merchantId: merchant.id });
            continue;
        }

        const insertedTemplateIds = new Set();

        for (const item of shopItems) {
            const itemName = (item.name || '').trim();
            if (!itemName) {
                continue;
            }

            let template = itemsByName.get(itemName);

            if (!template) {
                const category = (item.category || getDefaultCategory(merchant.merchant_type)).trim();
                const grade = getGradeFromRarity(item.rarity);
                const basePrice = Number.isFinite(Number(item.basePrice)) ? Number(item.basePrice) : Number(item.price) || 10000;
                const requiredLicense = Number.isFinite(Number(item.requiredLicense)) ? Number(item.requiredLicense) : (grade >= 3 ? 1 : 0);
                const description = item.description || '';

                maxIconId += 1;

                const templateId = randomUUID();
                await DatabaseManager.run(`
                    INSERT INTO item_templates (id, name, category, grade, required_license, base_price, weight, description, icon_id)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
                `, [
                    templateId,
                    itemName,
                    category,
                    grade,
                    requiredLicense,
                    basePrice,
                    1.0,
                    description,
                    maxIconId
                ]);

                template = {
                    id: templateId,
                    name: itemName,
                    category,
                    grade,
                    required_license: requiredLicense,
                    base_price: basePrice,
                    icon_id: maxIconId
                };

                itemsByName.set(itemName, template);
            }

            if (insertedTemplateIds.has(template.id)) {
                continue;
            }
            insertedTemplateIds.add(template.id);

            const currentPrice = Number(item.price) || template.base_price || 10000;
            const quantity = Math.max(1, Number.isFinite(Number(item.quantity)) ? Number(item.quantity) : 1);

            await DatabaseManager.run(`
                INSERT INTO merchant_inventory (id, merchant_id, item_template_id, quantity, current_price, last_updated)
                VALUES (?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
            `, [
                randomUUID(),
                merchant.id,
                template.id,
                quantity,
                currentPrice
            ]);

            insertedCount += 1;
        }
    }

    logger.info(`상인 인벤토리 ${insertedCount}건 생성 완료`);
}

async function seedMerchantDialogues() {
    logger.info('상인 대화 데이터 생성...');

    const merchants = await DatabaseManager.all('SELECT id, name FROM merchants');
    let insertedCount = 0;

    for (const merchant of merchants) {
        const profile = getMerchantProfile(merchant.id) || getMerchantProfile(merchant.name);

        if (!profile) {
            logger.warn('상인 JSON을 찾지 못했습니다. 대사 시드를 건너뜁니다.', { merchant: merchant.name, merchantId: merchant.id });
            continue;
        }

        let combinedDialogues = mergeDialogues(generateDialoguesFromProfile(profile), profile.dialogues);

        if ((!combinedDialogues.greeting || combinedDialogues.greeting.length === 0) && profile.fallbackDialogues.length > 0) {
            combinedDialogues.greeting = [...profile.fallbackDialogues];
        }

        const categories = Object.entries(combinedDialogues).filter(([, lines]) => Array.isArray(lines) && lines.length > 0);

        for (const [category, lines] of categories) {
            const triggerType = mapCategoryToTrigger(category);

            for (let index = 0; index < lines.length; index += 1) {
                const line = lines[index];
                if (!line) {
                    continue;
                }

                await DatabaseManager.run(`
                    INSERT INTO merchant_dialogues (id, merchant_id, trigger_type, trigger_condition, dialogue_text, dialogue_order, emotion, is_active)
                    VALUES (?, ?, ?, ?, ?, ?, ?, 1)
                `, [
                    randomUUID(),
                    merchant.id,
                    triggerType,
                    '{}',
                    line,
                    index,
                    null
                ]);

                insertedCount += 1;
            }
        }
    }

    logger.info(`상인 대화 ${insertedCount}건 생성 완료`);
}

async function seedStoryNodes() {
    logger.info('스토리 노드 생성...');

    const storyNodes = [
        // 마리 메인 스토리 노드들
        {
            id: 'story_mari_01',
            node_type: 'dialogue',
            merchant_id: 'mari',
            content: JSON.stringify({
                speaker: '마리',
                text: '어머, 새로운 얼굴이네요! 이 동네에서 처음 보는 것 같은데... 혹시 거래하러 오신 건가요?',
                context: 'tutorial_intro'
            }),
            choices: JSON.stringify([
                {
                    id: 'choice_mari_01_a',
                    text: '네, 처음입니다. 여기서 무엇을 할 수 있나요?',
                    next_node: 'story_mari_02'
                },
                {
                    id: 'choice_mari_01_b',
                    text: '그냥 둘러보는 중입니다.',
                    next_node: 'story_mari_02'
                }
            ]),
            prerequisites: JSON.stringify({
                player_level_min: 1
            }),
            next_nodes: JSON.stringify(['story_mari_02']),
            rewards: null,
            metadata: JSON.stringify({
                story_arc: 'mari_tutorial',
                sequence: 1
            })
        },
        {
            id: 'story_mari_02',
            node_type: 'dialogue',
            merchant_id: 'mari',
            content: JSON.stringify({
                speaker: '마리',
                text: '저는 염력 부여 전문가예요. 평범한 물건에 특별한 힘을 불어넣어 드리죠. 아, 물론 거래도 하고요!',
                context: 'tutorial_explanation'
            }),
            choices: JSON.stringify([
                {
                    id: 'choice_mari_02_a',
                    text: '염력 부여요? 흥미롭네요. 더 알려주실 수 있나요?',
                    next_node: 'story_mari_03'
                }
            ]),
            prerequisites: null,
            next_nodes: JSON.stringify(['story_mari_03']),
            rewards: null,
            metadata: JSON.stringify({
                story_arc: 'mari_tutorial',
                sequence: 2
            })
        },
        {
            id: 'story_mari_03',
            node_type: 'quest_gate',
            merchant_id: 'mari',
            content: JSON.stringify({
                speaker: '마리',
                text: '그럼 간단한 거래부터 시작해볼까요? 제가 첫 거래는 특별 할인해드릴게요!',
                context: 'tutorial_quest_start'
            }),
            choices: JSON.stringify([
                {
                    id: 'choice_mari_03_a',
                    text: '좋아요, 해볼게요!',
                    quest_trigger: 'quest_tutorial_001',
                    next_node: null
                }
            ]),
            prerequisites: null,
            next_nodes: null,
            rewards: JSON.stringify({
                reputation: 5,
                gold: 1000
            }),
            metadata: JSON.stringify({
                story_arc: 'mari_tutorial',
                sequence: 3,
                triggers_quest: 'quest_tutorial_001'
            })
        },

        // 카타리나 최 사이드 스토리 노드들
        {
            id: 'story_katarina_01',
            node_type: 'dialogue',
            merchant_id: 'catarinachoi',
            content: JSON.stringify({
                speaker: '카타리나 최',
                text: '신의 축복이 함께 하기를. 어떤 일로 성당을 찾아주셨나요?',
                context: 'religious_greeting'
            }),
            choices: JSON.stringify([
                {
                    id: 'choice_katarina_01_a',
                    text: '성스러운 아이템을 찾고 있습니다.',
                    next_node: 'story_katarina_02',
                    prerequisites: { reputation_min: 25 }
                },
                {
                    id: 'choice_katarina_01_b',
                    text: '그냥 구경하러 왔어요.',
                    next_node: null
                }
            ]),
            prerequisites: JSON.stringify({
                reputation_min: 25
            }),
            next_nodes: JSON.stringify(['story_katarina_02']),
            rewards: null,
            metadata: JSON.stringify({
                story_arc: 'katarina_faith',
                sequence: 1
            })
        },
        {
            id: 'story_katarina_02',
            node_type: 'dialogue',
            merchant_id: 'catarinachoi',
            content: JSON.stringify({
                speaker: '카타리나 최',
                text: '성스러운 힘은 순수한 마음을 가진 이들에게만 응답합니다. 당신의 마음이 진실하다면, 제가 도와드리겠습니다.',
                context: 'religious_test'
            }),
            choices: JSON.stringify([
                {
                    id: 'choice_katarina_02_a',
                    text: '저는 진심으로 도움이 필요합니다.',
                    next_node: null
                }
            ]),
            prerequisites: null,
            next_nodes: null,
            rewards: JSON.stringify({
                reputation: 10,
                unlock_items: ['holy_water', 'blessing_charm']
            }),
            metadata: JSON.stringify({
                story_arc: 'katarina_faith',
                sequence: 2
            })
        },

        // 김세휘 사이드 스토리 노드들
        {
            id: 'story_kim_01',
            node_type: 'dialogue',
            merchant_id: 'kimsehwui',
            content: JSON.stringify({
                speaker: '김세휘',
                text: '실험실에 찾아온 사람이 있다니 드물군요. 임플란트 기술에 관심이 있으신가요?',
                context: 'tech_intro'
            }),
            choices: JSON.stringify([
                {
                    id: 'choice_kim_01_a',
                    text: '네, 과학 임플란트에 대해 알고 싶습니다.',
                    next_node: 'story_kim_02',
                    prerequisites: { reputation_min: 50, license_min: 1 }
                },
                {
                    id: 'choice_kim_01_b',
                    text: '아니요, 그냥 구경하러 왔어요.',
                    next_node: null
                }
            ]),
            prerequisites: JSON.stringify({
                reputation_min: 50,
                license_min: 1
            }),
            next_nodes: JSON.stringify(['story_kim_02']),
            rewards: null,
            metadata: JSON.stringify({
                story_arc: 'kim_technology',
                sequence: 1
            })
        },
        {
            id: 'story_kim_02',
            node_type: 'dialogue',
            merchant_id: 'kimsehwui',
            content: JSON.stringify({
                speaker: '김세휘',
                text: '임플란트는 인간의 한계를 넘어서는 기술입니다. 하지만 책임감 없이 사용하면 위험할 수 있죠. 당신은 그럴 준비가 되어 있나요?',
                context: 'tech_warning'
            }),
            choices: JSON.stringify([
                {
                    id: 'choice_kim_02_a',
                    text: '책임감을 가지고 사용하겠습니다.',
                    next_node: null
                }
            ]),
            prerequisites: null,
            next_nodes: null,
            rewards: JSON.stringify({
                reputation: 15,
                unlock_items: ['neural_implant', 'bio_chip']
            }),
            metadata: JSON.stringify({
                story_arc: 'kim_technology',
                sequence: 2
            })
        }
    ];

    let insertedCount = 0;
    for (const node of storyNodes) {
        await DatabaseManager.run(`
            INSERT INTO story_nodes (
                id, node_type, merchant_id, content, choices,
                prerequisites, next_nodes, rewards, metadata
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        `, [
            node.id,
            node.node_type,
            node.merchant_id,
            node.content,
            node.choices,
            node.prerequisites,
            node.next_nodes,
            node.rewards,
            node.metadata
        ]);
        insertedCount++;
    }

    logger.info(`${insertedCount}개의 스토리 노드 생성 완료`);
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
            rewards: JSON.stringify({ money: 5000, experience: 100, trustPoints: 10, items: [] }),
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
            rewards: JSON.stringify({ money: 15000, experience: 250, trustPoints: 25, items: [] }),
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
            rewards: JSON.stringify({ money: 20000, experience: 300, trustPoints: 30, items: [] }),
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
            rewards: JSON.stringify({ money: 50000, experience: 500, trustPoints: 100, items: [] }),
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
            rewards: JSON.stringify({ money: 25000, experience: 200, trustPoints: 50, items: [] }),
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
            rewards: JSON.stringify({ money: 150000, experience: 1200, trustPoints: 250, items: [] }),
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
            rewards: JSON.stringify({ money: 100000, experience: 800, trustPoints: 200, items: [] }),
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
            rewards: JSON.stringify({ money: 200000, experience: 1000, trustPoints: 300, items: [] }),
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

async function seedStoryQuests() {
    logger.info('스토리 퀘스트 생성...');

    const storyQuests = [
        // 마리 튜토리얼 퀘스트
        {
            id: 'quest_story_mari_tutorial',
            name: '마리와의 첫 만남',
            description: '마리와 대화하고 염력 부여에 대해 배워보세요',
            category: 'story',
            type: 'dialogue',
            level_requirement: 1,
            required_merchant: 'mari',
            objectives: JSON.stringify([
                {
                    type: 'visit_merchant',
                    target: 'mari',
                    count: 1,
                    description: '마리 방문하기'
                },
                {
                    type: 'complete_dialogue',
                    target: 'story_mari_03',
                    count: 1,
                    description: '마리와 대화 완료하기'
                }
            ]),
            rewards: JSON.stringify({
                gold: 1000,
                reputation: 5,
                experience: 50
            }),
            is_repeatable: 0,
            cooldown_hours: null,
            expires_at: null,
            story_arc: 'mari_tutorial'
        },

        // 카타리나 최 신앙의 시험 퀘스트
        {
            id: 'quest_story_katarina_faith',
            name: '신앙의 시험',
            description: '카타리나 최에게 당신의 진심을 증명하세요',
            category: 'story',
            type: 'dialogue',
            level_requirement: 5,
            required_merchant: 'catarinachoi',
            prerequisites: JSON.stringify({
                reputation_min: 25,
                completed_quests: ['quest_story_mari_tutorial']
            }),
            objectives: JSON.stringify([
                {
                    type: 'visit_merchant',
                    target: 'catarinachoi',
                    count: 1,
                    description: '카타리나 최 방문하기'
                },
                {
                    type: 'complete_dialogue',
                    target: 'story_katarina_02',
                    count: 1,
                    description: '신앙의 시험 통과하기'
                }
            ]),
            rewards: JSON.stringify({
                gold: 2500,
                reputation: 10,
                experience: 150,
                unlock_items: ['holy_water', 'blessing_charm']
            }),
            is_repeatable: 0,
            cooldown_hours: null,
            expires_at: null,
            story_arc: 'katarina_faith'
        },

        // 김세휘 기술의 대가 퀘스트
        {
            id: 'quest_story_kim_technology',
            name: '기술의 대가',
            description: '김세휘에게 임플란트 기술의 책임감에 대해 배우세요',
            category: 'story',
            type: 'dialogue',
            level_requirement: 10,
            required_merchant: 'kimsehwui',
            prerequisites: JSON.stringify({
                reputation_min: 50,
                license_min: 1,
                completed_quests: ['quest_story_mari_tutorial']
            }),
            objectives: JSON.stringify([
                {
                    type: 'visit_merchant',
                    target: 'kimsehwui',
                    count: 1,
                    description: '김세휘 방문하기'
                },
                {
                    type: 'complete_dialogue',
                    target: 'story_kim_02',
                    count: 1,
                    description: '기술의 책임감 배우기'
                }
            ]),
            rewards: JSON.stringify({
                gold: 5000,
                reputation: 15,
                experience: 300,
                unlock_items: ['neural_implant', 'bio_chip']
            }),
            is_repeatable: 0,
            cooldown_hours: null,
            expires_at: null,
            story_arc: 'kim_technology'
        }
    ];

    let insertedCount = 0;
    for (const quest of storyQuests) {
        await DatabaseManager.run(`
            INSERT INTO quest_templates (
                id, name, description, category, type,
                level_requirement, required_merchant, prerequisites, objectives,
                rewards, is_repeatable, cooldown_hours, expires_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `, [
            quest.id,
            quest.name,
            quest.description,
            quest.category,
            quest.type,
            quest.level_requirement,
            quest.required_merchant,
            quest.prerequisites || null,
            quest.objectives,
            quest.rewards,
            quest.is_repeatable,
            quest.cooldown_hours,
            quest.expires_at
        ]);
        insertedCount++;
    }

    logger.info(`${insertedCount}개의 스토리 퀘스트 생성 완료`);
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
    (async () => {
        try {
            await seedDatabase();
            logger.info('✅ 시드 스크립트 성공적으로 완료');
            process.exit(0);
        } catch (error) {
            logger.error('❌ 시드 스크립트 실패:', error);
            process.exit(1);
        }
    })();
}

module.exports = { seedDatabase };
