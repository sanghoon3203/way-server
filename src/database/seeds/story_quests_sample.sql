-- 📁 src/database/seeds/story_quests_sample.sql
-- 스토리 시스템과 연동된 샘플 퀘스트
-- story_node_003에서 트리거되는 보물 찾기 퀘스트

INSERT INTO quest_templates (
    id,
    title,
    description,
    category,
    quest_type,
    objectives,
    rewards,
    prerequisites,
    time_limit,
    is_repeatable,
    story_node_id,
    is_story_quest
) VALUES (
    'quest_treasure_hunt_01',
    '잊혀진 백자 항아리',
    '김사장이 찾고 있는 조선시대 백자 항아리를 강북 지역 상인들을 통해 찾아야 합니다.',
    'story',
    'fetch',
    json_array(
        json_object(
            'type', 'dialogue',
            'description', '강북 상인들과 대화하기',
            'target_node', 'gangbuk_merchant_clue_01',
            'merchantId', 'merchant_gangbuk_01',
            'required', 3
        ),
        json_object(
            'type', 'fetch',
            'description', '백자 항아리 획득하기',
            'itemId', 'item_white_porcelain_jar',
            'required', 1
        ),
        json_object(
            'type', 'delivery',
            'description', '김사장에게 항아리 전달하기',
            'merchantId', 'merchant_story_01',
            'itemId', 'item_white_porcelain_jar',
            'required', 1
        )
    ),
    json_object(
        'exp', 500,
        'money', 50000,
        'reputation', 50,
        'items', json_array(
            json_object(
                'itemId', 'special_antique_dealer_token',
                'quantity', 1
            )
        )
    ),
    json_object(
        'level_min', 3,
        'story_flags', json_object('treasure_quest_active', true)
    ),
    NULL,  -- no time limit for story quests
    0,     -- not repeatable
    'story_node_003',  -- triggered by this story node
    1      -- is_story_quest = true
);

-- 사이드 스토리 퀘스트 (간단한 수집 퀘스트)
INSERT INTO quest_templates (
    id,
    title,
    description,
    category,
    quest_type,
    objectives,
    rewards,
    prerequisites,
    time_limit,
    is_repeatable,
    story_node_id,
    is_story_quest
) VALUES (
    'quest_art_collection_01',
    '예술가를 위한 재료 수집',
    '이상인이 다음 작품을 위해 특별한 재료가 필요합니다.',
    'side_story',
    'gather',
    json_array(
        json_object(
            'type', 'gather',
            'description', '특별한 캔버스 3개 구하기',
            'itemId', 'item_special_canvas',
            'required', 3
        ),
        json_object(
            'type', 'gather',
            'description', '고급 물감 세트 1개 구하기',
            'itemId', 'item_premium_paint_set',
            'required', 1
        )
    ),
    json_object(
        'exp', 200,
        'money', 10000,
        'reputation', 15
    ),
    json_object(
        'level_min', 2,
        'reputation', 10
    ),
    86400000,  -- 24 hours time limit
    1,         -- repeatable weekly
    'side_story_001',
    1          -- is_story_quest = true
);

-- 강북 상인 샘플 (단서 제공용)
INSERT OR IGNORE INTO merchants (
    id, name, title, type, personality, district,
    location_lat, location_lng, required_license,
    price_modifier, negotiation_difficulty,
    reputation_requirement, is_active,
    story_role, has_active_story
) VALUES (
    'merchant_gangbuk_01',
    '박수집',
    '강북 수집가',
    'collector',
    'shrewd',
    'gangbuk',
    37.6398, 127.0253,
    2,
    1.1, 3,
    20, 1,
    'side',  -- 서브 캐릭터
    0        -- 별도 스토리 없음
);

-- 강북 상인 대화 노드 (단서 제공)
INSERT INTO story_nodes (
    id,
    node_type,
    merchant_id,
    location_id,
    content,
    choices,
    prerequisites,
    next_nodes,
    rewards,
    metadata
) VALUES (
    'gangbuk_merchant_clue_01',
    'dialogue',
    'merchant_gangbuk_01',
    NULL,
    json_object(
        'speaker', '박수집',
        'text', '백자 항아리? 아, 그 물건... 최근에 이태원 쪽에서 비슷한 걸 봤어. 한번 가보는 게 어때?',
        'emotion', 'knowing'
    ),
    json_array(
        json_object(
            'id', 'clue_thanks',
            'text', '감사합니다!',
            'next_node', NULL
        )
    ),
    json_object(
        'story_flags', json_object('treasure_quest_active', true)
    ),
    NULL,
    json_object(
        'exp', 50
    ),
    json_object(
        'quest_objective', 'dialogue',
        'quest_id', 'quest_treasure_hunt_01'
    )
);
