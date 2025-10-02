-- 📁 src/database/seeds/story_nodes_sample.sql
-- 샘플 스토리 노드 데이터 (테스트용)
-- 메인 스토리: "잊혀진 보물" - 3개 노드 체인

-- 샘플 상인 생성 (이미 merchants 테이블에 데이터가 있다면 스킵)
-- 강남 지역의 골동품상 "김사장"
INSERT OR IGNORE INTO merchants (
    id, name, title, type, personality, district,
    location_lat, location_lng, required_license,
    price_modifier, negotiation_difficulty,
    reputation_requirement, is_active,
    story_role, initial_story_node, has_active_story
) VALUES (
    'merchant_story_01',
    '김사장',
    '강남의 골동품 전문가',
    'antique',
    'wise',
    'gangnam',
    37.4979, 127.0276,
    1,
    1.2, 4,
    0, 1,
    'main',
    'story_node_001',
    1
);

-- ============================================
-- Story Node 1: 첫 만남과 의뢰
-- ============================================
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
    'story_node_001',
    'dialogue',
    'merchant_story_01',
    NULL,
    json_object(
        'speaker', '김사장',
        'text', '오, 자네가 소문으로만 듣던 그 신예 상인인가? 때마침 잘 왔네. 자네에게 부탁할 일이 하나 있는데... 관심 있나?',
        'emotion', 'thoughtful'
    ),
    json_array(
        json_object(
            'id', 'choice_001_yes',
            'text', '어떤 일인지 들어보겠습니다.',
            'next_node', 'story_node_002'
        ),
        json_object(
            'id', 'choice_001_no',
            'text', '지금은 바쁩니다. 나중에...',
            'next_node', NULL
        )
    ),
    json_object(
        'level_min', 1
    ),
    json_array('story_node_002'),
    NULL,
    json_object(
        'chapter', 1,
        'title', '잊혀진 보물',
        'story_type', 'main'
    )
);

-- ============================================
-- Story Node 2: 보물 이야기
-- ============================================
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
    'story_node_002',
    'dialogue',
    'merchant_story_01',
    NULL,
    json_object(
        'speaker', '김사장',
        'text', '좋아! 사실 내가 오래전부터 찾고 있는 물건이 하나 있다네. 조선시대 백자 항아리인데, 최근 강북 어딘가에 나타났다는 소문을 들었어. 자네가 대신 찾아줄 수 있겠나? 보상은 후하게 하지.',
        'emotion', 'excited'
    ),
    json_array(
        json_object(
            'id', 'choice_002_accept',
            'text', '흥미롭네요. 맡겨주세요!',
            'next_node', 'story_node_003'
        ),
        json_object(
            'id', 'choice_002_ask',
            'text', '왜 직접 가지 않으시죠?',
            'next_node', 'story_node_003'
        )
    ),
    json_object(
        'story_flags', json_object('met_kim', true)
    ),
    json_array('story_node_003'),
    json_object(
        'exp', 50,
        'reputation', 5
    ),
    json_object(
        'chapter', 1,
        'title', '잊혀진 보물',
        'story_flags', json_object('treasure_quest_started', true)
    )
);

-- ============================================
-- Story Node 3: 퀘스트 시작
-- ============================================
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
    'story_node_003',
    'decision',
    'merchant_story_01',
    NULL,
    json_object(
        'speaker', '김사장',
        'text', '허허, 내 나이가 있어서 말이야... 어쨌든 강북 쪽 상인들을 찾아보게. 분명 단서가 있을 걸세. 찾으면 바로 나에게 알려주게!',
        'emotion', 'hopeful'
    ),
    json_array(
        json_object(
            'id', 'choice_003_ok',
            'text', '알겠습니다. 기대하세요!',
            'next_node', NULL
        )
    ),
    json_object(
        'story_flags', json_object('met_kim', true)
    ),
    NULL,
    json_object(
        'exp', 100,
        'reputation', 10,
        'money', 5000
    ),
    json_object(
        'chapter', 1,
        'title', '잊혀진 보물',
        'story_flags', json_object('treasure_quest_active', true),
        'triggers_quest', 'quest_treasure_hunt_01'
    )
);

-- ============================================
-- 샘플 사이드 스토리 (간단한 1개 노드)
-- ============================================

-- 사이드 스토리용 상인
INSERT OR IGNORE INTO merchants (
    id, name, title, type, personality, district,
    location_lat, location_lng, required_license,
    price_modifier, negotiation_difficulty,
    reputation_requirement, is_active,
    story_role, initial_story_node, has_active_story
) VALUES (
    'merchant_side_01',
    '이상인',
    '홍대 예술가',
    'artist',
    'creative',
    'hongdae',
    37.5563, 126.9236,
    1,
    0.9, 2,
    10, 1,
    'side',
    'side_story_001',
    1
);

-- 사이드 스토리 노드
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
    'side_story_001',
    'dialogue',
    'merchant_side_01',
    NULL,
    json_object(
        'speaker', '이상인',
        'text', '안녕하세요! 혹시 저희 전시회에 관심 있으신가요? 요즘 젊은 예술가들의 작품을 모아놨는데... 특별히 당신께 할인가로 드릴게요!',
        'emotion', 'friendly'
    ),
    json_array(
        json_object(
            'id', 'side_001_interested',
            'text', '구경해보겠습니다.',
            'next_node', NULL
        ),
        json_object(
            'id', 'side_001_pass',
            'text', '다음에 올게요.',
            'next_node', NULL
        )
    ),
    json_object(
        'level_min', 1,
        'reputation', 10
    ),
    NULL,
    json_object(
        'reputation', 5
    ),
    json_object(
        'chapter', 1,
        'title', '예술가의 초대',
        'story_type', 'side'
    )
);
