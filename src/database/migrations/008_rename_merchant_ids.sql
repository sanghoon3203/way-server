-- 008_rename_merchant_ids.sql
-- 기존 상인 ID를 world 설정집과 일치하도록 `merchant_` 프리픽스가 붙은 형태로 정규화

-- 1) 신규 ID가 존재하지 않는 경우 기존 레코드를 복사하여 삽입
INSERT OR IGNORE INTO merchants (
    id, name, title, merchant_type, personality, district,
    lat, lng, required_license, price_modifier,
    negotiation_difficulty, reputation_requirement,
    is_active, last_restocked,
    image_filename, story_role, initial_story_node, has_active_story
)
SELECT
    'merchant_seoyena',
    name, title, merchant_type, personality, district,
    lat, lng, required_license, price_modifier,
    negotiation_difficulty, reputation_requirement,
    is_active, last_restocked,
    COALESCE(image_filename, NULL),
    COALESCE(story_role, 'vendor_only'),
    COALESCE(initial_story_node, NULL),
    COALESCE(has_active_story, 0)
FROM merchants
WHERE LOWER(id) = 'seoyena'
  AND NOT EXISTS (SELECT 1 FROM merchants WHERE id = 'merchant_seoyena');

INSERT OR IGNORE INTO merchants (
    id, name, title, merchant_type, personality, district,
    lat, lng, required_license, price_modifier,
    negotiation_difficulty, reputation_requirement,
    is_active, last_restocked,
    image_filename, story_role, initial_story_node, has_active_story
)
SELECT
    'merchant_alicegang',
    name, title, merchant_type, personality, district,
    lat, lng, required_license, price_modifier,
    negotiation_difficulty, reputation_requirement,
    is_active, last_restocked,
    COALESCE(image_filename, NULL),
    COALESCE(story_role, 'vendor_only'),
    COALESCE(initial_story_node, NULL),
    COALESCE(has_active_story, 0)
FROM merchants
WHERE LOWER(id) = 'alicegang'
  AND NOT EXISTS (SELECT 1 FROM merchants WHERE id = 'merchant_alicegang');

INSERT OR IGNORE INTO merchants (
    id, name, title, merchant_type, personality, district,
    lat, lng, required_license, price_modifier,
    negotiation_difficulty, reputation_requirement,
    is_active, last_restocked,
    image_filename, story_role, initial_story_node, has_active_story
)
SELECT
    'merchant_anipark',
    name, title, merchant_type, personality, district,
    lat, lng, required_license, price_modifier,
    negotiation_difficulty, reputation_requirement,
    is_active, last_restocked,
    COALESCE(image_filename, NULL),
    COALESCE(story_role, 'vendor_only'),
    COALESCE(initial_story_node, NULL),
    COALESCE(has_active_story, 0)
FROM merchants
WHERE LOWER(id) = 'anipark'
  AND NOT EXISTS (SELECT 1 FROM merchants WHERE id = 'merchant_anipark');

INSERT OR IGNORE INTO merchants (
    id, name, title, merchant_type, personality, district,
    lat, lng, required_license, price_modifier,
    negotiation_difficulty, reputation_requirement,
    is_active, last_restocked,
    image_filename, story_role, initial_story_node, has_active_story
)
SELECT
    'merchant_jinbaekho',
    name, title, merchant_type, personality, district,
    lat, lng, required_license, price_modifier,
    negotiation_difficulty, reputation_requirement,
    is_active, last_restocked,
    COALESCE(image_filename, NULL),
    COALESCE(story_role, 'vendor_only'),
    COALESCE(initial_story_node, NULL),
    COALESCE(has_active_story, 0)
FROM merchants
WHERE LOWER(id) = 'jinbaekho'
  AND NOT EXISTS (SELECT 1 FROM merchants WHERE id = 'merchant_jinbaekho');

INSERT OR IGNORE INTO merchants (
    id, name, title, merchant_type, personality, district,
    lat, lng, required_license, price_modifier,
    negotiation_difficulty, reputation_requirement,
    is_active, last_restocked,
    image_filename, story_role, initial_story_node, has_active_story
)
SELECT
    'merchant_jubulsu',
    name, title, merchant_type, personality, district,
    lat, lng, required_license, price_modifier,
    negotiation_difficulty, reputation_requirement,
    is_active, last_restocked,
    COALESCE(image_filename, NULL),
    COALESCE(story_role, 'vendor_only'),
    COALESCE(initial_story_node, NULL),
    COALESCE(has_active_story, 0)
FROM merchants
WHERE LOWER(id) = 'jubulsu'
  AND NOT EXISTS (SELECT 1 FROM merchants WHERE id = 'merchant_jubulsu');

INSERT OR IGNORE INTO merchants (
    id, name, title, merchant_type, personality, district,
    lat, lng, required_license, price_modifier,
    negotiation_difficulty, reputation_requirement,
    is_active, last_restocked,
    image_filename, story_role, initial_story_node, has_active_story
)
SELECT
    'merchant_kimsehwui',
    name, title, merchant_type, personality, district,
    lat, lng, required_license, price_modifier,
    negotiation_difficulty, reputation_requirement,
    is_active, last_restocked,
    COALESCE(image_filename, NULL),
    COALESCE(story_role, 'vendor_only'),
    COALESCE(initial_story_node, NULL),
    COALESCE(has_active_story, 0)
FROM merchants
WHERE LOWER(id) = 'kimsehwui'
  AND NOT EXISTS (SELECT 1 FROM merchants WHERE id = 'merchant_kimsehwui');

INSERT OR IGNORE INTO merchants (
    id, name, title, merchant_type, personality, district,
    lat, lng, required_license, price_modifier,
    negotiation_difficulty, reputation_requirement,
    is_active, last_restocked,
    image_filename, story_role, initial_story_node, has_active_story
)
SELECT
    'merchant_catarinachoi',
    name, title, merchant_type, personality, district,
    lat, lng, required_license, price_modifier,
    negotiation_difficulty, reputation_requirement,
    is_active, last_restocked,
    COALESCE(image_filename, NULL),
    COALESCE(story_role, 'vendor_only'),
    COALESCE(initial_story_node, NULL),
    COALESCE(has_active_story, 0)
FROM merchants
WHERE LOWER(id) = 'catarinachoi'
  AND NOT EXISTS (SELECT 1 FROM merchants WHERE id = 'merchant_catarinachoi');

INSERT OR IGNORE INTO merchants (
    id, name, title, merchant_type, personality, district,
    lat, lng, required_license, price_modifier,
    negotiation_difficulty, reputation_requirement,
    is_active, last_restocked,
    image_filename, story_role, initial_story_node, has_active_story
)
SELECT
    'merchant_kijuri',
    name, title, merchant_type, personality, district,
    lat, lng, required_license, price_modifier,
    negotiation_difficulty, reputation_requirement,
    is_active, last_restocked,
    COALESCE(image_filename, NULL),
    COALESCE(story_role, 'vendor_only'),
    COALESCE(initial_story_node, NULL),
    COALESCE(has_active_story, 0)
FROM merchants
WHERE LOWER(id) = 'kijuri'
  AND NOT EXISTS (SELECT 1 FROM merchants WHERE id = 'merchant_kijuri');

INSERT OR IGNORE INTO merchants (
    id, name, title, merchant_type, personality, district,
    lat, lng, required_license, price_modifier,
    negotiation_difficulty, reputation_requirement,
    is_active, last_restocked,
    image_filename, story_role, initial_story_node, has_active_story
)
SELECT
    'merchant_mari',
    name, title, merchant_type, personality, district,
    lat, lng, required_license, price_modifier,
    negotiation_difficulty, reputation_requirement,
    is_active, last_restocked,
    COALESCE(image_filename, NULL),
    COALESCE(story_role, 'vendor_only'),
    COALESCE(initial_story_node, NULL),
    COALESCE(has_active_story, 0)
FROM merchants
WHERE LOWER(id) = 'mari'
  AND NOT EXISTS (SELECT 1 FROM merchants WHERE id = 'merchant_mari');

-- 2) 관련 테이블의 참조 ID 업데이트
WITH mapping(old_slug, new_id) AS (
    VALUES
        ('seoyena', 'merchant_seoyena'),
        ('alicegang', 'merchant_alicegang'),
        ('anipark', 'merchant_anipark'),
        ('jinbaekho', 'merchant_jinbaekho'),
        ('jubulsu', 'merchant_jubulsu'),
        ('kimsehwui', 'merchant_kimsehwui'),
        ('catarinachoi', 'merchant_catarinachoi'),
        ('kijuri', 'merchant_kijuri'),
        ('mari', 'merchant_mari')
)
UPDATE merchant_inventory
SET merchant_id = (
    SELECT new_id FROM mapping WHERE old_slug = LOWER(merchant_inventory.merchant_id)
)
WHERE EXISTS (
    SELECT 1 FROM mapping WHERE old_slug = LOWER(merchant_inventory.merchant_id)
);

WITH mapping(old_slug, new_id) AS (
    VALUES
        ('seoyena', 'merchant_seoyena'),
        ('alicegang', 'merchant_alicegang'),
        ('anipark', 'merchant_anipark'),
        ('jinbaekho', 'merchant_jinbaekho'),
        ('jubulsu', 'merchant_jubulsu'),
        ('kimsehwui', 'merchant_kimsehwui'),
        ('catarinachoi', 'merchant_catarinachoi'),
        ('kijuri', 'merchant_kijuri'),
        ('mari', 'merchant_mari')
)
UPDATE merchant_preferences
SET merchant_id = (
    SELECT new_id FROM mapping WHERE old_slug = LOWER(merchant_preferences.merchant_id)
)
WHERE EXISTS (
    SELECT 1 FROM mapping WHERE old_slug = LOWER(merchant_preferences.merchant_id)
);

WITH mapping(old_slug, new_id) AS (
    VALUES
        ('seoyena', 'merchant_seoyena'),
        ('alicegang', 'merchant_alicegang'),
        ('anipark', 'merchant_anipark'),
        ('jinbaekho', 'merchant_jinbaekho'),
        ('jubulsu', 'merchant_jubulsu'),
        ('kimsehwui', 'merchant_kimsehwui'),
        ('catarinachoi', 'merchant_catarinachoi'),
        ('kijuri', 'merchant_kijuri'),
        ('mari', 'merchant_mari')
)
UPDATE merchant_relationships
SET merchant_id = (
    SELECT new_id FROM mapping WHERE old_slug = LOWER(merchant_relationships.merchant_id)
)
WHERE EXISTS (
    SELECT 1 FROM mapping WHERE old_slug = LOWER(merchant_relationships.merchant_id)
);

WITH mapping(old_slug, new_id) AS (
    VALUES
        ('seoyena', 'merchant_seoyena'),
        ('alicegang', 'merchant_alicegang'),
        ('anipark', 'merchant_anipark'),
        ('jinbaekho', 'merchant_jinbaekho'),
        ('jubulsu', 'merchant_jubulsu'),
        ('kimsehwui', 'merchant_kimsehwui'),
        ('catarinachoi', 'merchant_catarinachoi'),
        ('kijuri', 'merchant_kijuri'),
        ('mari', 'merchant_mari')
)
UPDATE merchant_relationship_quest_log
SET merchant_id = (
    SELECT new_id FROM mapping WHERE old_slug = LOWER(merchant_relationship_quest_log.merchant_id)
)
WHERE EXISTS (
    SELECT 1 FROM mapping WHERE old_slug = LOWER(merchant_relationship_quest_log.merchant_id)
);

WITH mapping(old_slug, new_id) AS (
    VALUES
        ('seoyena', 'merchant_seoyena'),
        ('alicegang', 'merchant_alicegang'),
        ('anipark', 'merchant_anipark'),
        ('jinbaekho', 'merchant_jinbaekho'),
        ('jubulsu', 'merchant_jubulsu'),
        ('kimsehwui', 'merchant_kimsehwui'),
        ('catarinachoi', 'merchant_catarinachoi'),
        ('kijuri', 'merchant_kijuri'),
        ('mari', 'merchant_mari')
)
UPDATE merchant_media
SET merchant_id = (
    SELECT new_id FROM mapping WHERE old_slug = LOWER(merchant_media.merchant_id)
)
WHERE EXISTS (
    SELECT 1 FROM mapping WHERE old_slug = LOWER(merchant_media.merchant_id)
);

WITH mapping(old_slug, new_id) AS (
    VALUES
        ('seoyena', 'merchant_seoyena'),
        ('alicegang', 'merchant_alicegang'),
        ('anipark', 'merchant_anipark'),
        ('jinbaekho', 'merchant_jinbaekho'),
        ('jubulsu', 'merchant_jubulsu'),
        ('kimsehwui', 'merchant_kimsehwui'),
        ('catarinachoi', 'merchant_catarinachoi'),
        ('kijuri', 'merchant_kijuri'),
        ('mari', 'merchant_mari')
)
UPDATE merchant_dialogues
SET merchant_id = (
    SELECT new_id FROM mapping WHERE old_slug = LOWER(merchant_dialogues.merchant_id)
)
WHERE EXISTS (
    SELECT 1 FROM mapping WHERE old_slug = LOWER(merchant_dialogues.merchant_id)
);

WITH mapping(old_slug, new_id) AS (
    VALUES
        ('seoyena', 'merchant_seoyena'),
        ('alicegang', 'merchant_alicegang'),
        ('anipark', 'merchant_anipark'),
        ('jinbaekho', 'merchant_jinbaekho'),
        ('jubulsu', 'merchant_jubulsu'),
        ('kimsehwui', 'merchant_kimsehwui'),
        ('catarinachoi', 'merchant_catarinachoi'),
        ('kijuri', 'merchant_kijuri'),
        ('mari', 'merchant_mari')
)
UPDATE merchant_dialogue_logs
SET merchant_id = (
    SELECT new_id FROM mapping WHERE old_slug = LOWER(merchant_dialogue_logs.merchant_id)
)
WHERE EXISTS (
    SELECT 1 FROM mapping WHERE old_slug = LOWER(merchant_dialogue_logs.merchant_id)
);

WITH mapping(old_slug, new_id) AS (
    VALUES
        ('seoyena', 'merchant_seoyena'),
        ('alicegang', 'merchant_alicegang'),
        ('anipark', 'merchant_anipark'),
        ('jinbaekho', 'merchant_jinbaekho'),
        ('jubulsu', 'merchant_jubulsu'),
        ('kimsehwui', 'merchant_kimsehwui'),
        ('catarinachoi', 'merchant_catarinachoi'),
        ('kijuri', 'merchant_kijuri'),
        ('mari', 'merchant_mari')
)
UPDATE trade_records
SET merchant_id = (
    SELECT new_id FROM mapping WHERE old_slug = LOWER(trade_records.merchant_id)
)
WHERE EXISTS (
    SELECT 1 FROM mapping WHERE old_slug = LOWER(trade_records.merchant_id)
);

WITH mapping(old_slug, new_id) AS (
    VALUES
        ('seoyena', 'merchant_seoyena'),
        ('alicegang', 'merchant_alicegang'),
        ('anipark', 'merchant_anipark'),
        ('jinbaekho', 'merchant_jinbaekho'),
        ('jubulsu', 'merchant_jubulsu'),
        ('kimsehwui', 'merchant_kimsehwui'),
        ('catarinachoi', 'merchant_catarinachoi'),
        ('kijuri', 'merchant_kijuri'),
        ('mari', 'merchant_mari')
)
UPDATE story_nodes
SET merchant_id = (
    SELECT new_id FROM mapping WHERE old_slug = LOWER(story_nodes.merchant_id)
)
WHERE merchant_id IS NOT NULL
  AND EXISTS (
    SELECT 1 FROM mapping WHERE old_slug = LOWER(story_nodes.merchant_id)
);

-- 3) 퀘스트 템플릿 참조 업데이트
WITH mapping(old_slug, new_id) AS (
    VALUES
        ('seoyena', 'merchant_seoyena'),
        ('alicegang', 'merchant_alicegang'),
        ('anipark', 'merchant_anipark'),
        ('jinbaekho', 'merchant_jinbaekho'),
        ('jubulsu', 'merchant_jubulsu'),
        ('kimsehwui', 'merchant_kimsehwui'),
        ('catarinachoi', 'merchant_catarinachoi'),
        ('kijuri', 'merchant_kijuri'),
        ('mari', 'merchant_mari')
)
UPDATE quest_templates
SET required_merchant = (
    SELECT new_id FROM mapping WHERE old_slug = LOWER(quest_templates.required_merchant)
)
WHERE required_merchant IS NOT NULL
  AND EXISTS (
    SELECT 1 FROM mapping WHERE old_slug = LOWER(quest_templates.required_merchant)
);

UPDATE quest_templates
SET objectives = REPLACE(objectives, '"target":"mari"', '"target":"merchant_mari"')
WHERE objectives LIKE '%"target":"mari"%';

UPDATE quest_templates
SET objectives = REPLACE(objectives, '"target":"catarinachoi"', '"target":"merchant_catarinachoi"')
WHERE objectives LIKE '%"target":"catarinachoi"%';

UPDATE quest_templates
SET objectives = REPLACE(objectives, '"target":"kimsehwui"', '"target":"merchant_kimsehwui"')
WHERE objectives LIKE '%"target":"kimsehwui"%';

-- 4) 구형 상인 레코드 삭제
DELETE FROM merchants WHERE LOWER(id) IN (
    'seoyena',
    'alicegang',
    'anipark',
    'jinbaekho',
    'jubulsu',
    'kimsehwui',
    'catarinachoi',
    'kijuri',
    'mari'
);
