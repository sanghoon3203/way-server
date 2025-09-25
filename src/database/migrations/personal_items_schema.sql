-- 개인 아이템 시스템 데이터베이스 스키마
-- Way Trading Game - Personal Items System

-- 개인 아이템 템플릿 테이블 (아이템 종류 정의)
CREATE TABLE IF NOT EXISTS personal_item_templates (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    type TEXT NOT NULL CHECK (type IN ('consumable', 'equipment', 'artifact')),
    grade INTEGER NOT NULL CHECK (grade BETWEEN 0 AND 4),
    max_stack INTEGER DEFAULT 1,
    cooldown INTEGER DEFAULT 0,          -- 쿨타임 (초)
    usage_limit INTEGER,                 -- 일일 사용 제한 (NULL = 무제한)
    equip_slot TEXT,                     -- 장착 슬롯 (equipment type만)
    description TEXT,
    icon_id INTEGER DEFAULT 1,
    is_active BOOLEAN DEFAULT TRUE,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 아이템 효과 템플릿 테이블
CREATE TABLE IF NOT EXISTS item_effects (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    item_template_id TEXT NOT NULL,
    effect_type TEXT NOT NULL,           -- health_boost, trade_success_rate 등
    effect_value INTEGER NOT NULL,
    duration INTEGER NOT NULL,           -- 지속시간 (초, 0=즉시, -1=영구)
    description TEXT,
    FOREIGN KEY (item_template_id) REFERENCES personal_item_templates(id) ON DELETE CASCADE
);

-- 플레이어 개인 아이템 인벤토리
CREATE TABLE IF NOT EXISTS player_personal_items (
    id TEXT PRIMARY KEY,
    player_id TEXT NOT NULL,
    item_template_id TEXT NOT NULL,
    quantity INTEGER NOT NULL DEFAULT 1,
    is_equipped BOOLEAN DEFAULT FALSE,
    equip_slot TEXT,                     -- 실제 장착된 슬롯
    acquired_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    last_used DATETIME,
    usage_count_today INTEGER DEFAULT 0,
    usage_reset_date DATE DEFAULT (DATE('now')),
    FOREIGN KEY (player_id) REFERENCES players(id) ON DELETE CASCADE,
    FOREIGN KEY (item_template_id) REFERENCES personal_item_templates(id) ON DELETE CASCADE
);

-- 플레이어 활성 효과 테이블 (지속시간 있는 효과들)
CREATE TABLE IF NOT EXISTS player_active_effects (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    player_id TEXT NOT NULL,
    item_template_id TEXT NOT NULL,
    effect_type TEXT NOT NULL,
    effect_value INTEGER NOT NULL,
    start_time DATETIME DEFAULT CURRENT_TIMESTAMP,
    duration INTEGER NOT NULL,           -- 지속시간 (초)
    expires_at DATETIME NOT NULL,
    FOREIGN KEY (player_id) REFERENCES players(id) ON DELETE CASCADE,
    FOREIGN KEY (item_template_id) REFERENCES personal_item_templates(id) ON DELETE CASCADE
);

-- 아이템 사용 로그 테이블
CREATE TABLE IF NOT EXISTS item_usage_log (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    player_id TEXT NOT NULL,
    item_template_id TEXT NOT NULL,
    action_type TEXT NOT NULL CHECK (action_type IN ('use', 'equip', 'unequip')),
    quantity_used INTEGER DEFAULT 1,
    used_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    effect_applied TEXT,                 -- JSON string of applied effects
    FOREIGN KEY (player_id) REFERENCES players(id) ON DELETE CASCADE,
    FOREIGN KEY (item_template_id) REFERENCES personal_item_templates(id) ON DELETE CASCADE
);

-- 인덱스 생성
CREATE INDEX IF NOT EXISTS idx_player_personal_items_player_id ON player_personal_items(player_id);
CREATE INDEX IF NOT EXISTS idx_player_personal_items_template_id ON player_personal_items(item_template_id);
CREATE INDEX IF NOT EXISTS idx_player_personal_items_equipped ON player_personal_items(player_id, is_equipped);
CREATE INDEX IF NOT EXISTS idx_player_active_effects_player_id ON player_active_effects(player_id);
CREATE INDEX IF NOT EXISTS idx_player_active_effects_expires ON player_active_effects(expires_at);
CREATE INDEX IF NOT EXISTS idx_item_usage_log_player_id ON item_usage_log(player_id);
CREATE INDEX IF NOT EXISTS idx_item_effects_template_id ON item_effects(item_template_id);

-- 기본 개인 아이템 템플릿 데이터 삽입
INSERT OR REPLACE INTO personal_item_templates (id, name, type, grade, max_stack, cooldown, description) VALUES
-- 소비 아이템들
('health_potion_basic', '체력 물약', 'consumable', 1, 10, 300, '체력을 50 회복시켜주는 기본 물약'),
('health_potion_advanced', '고급 체력 물약', 'consumable', 2, 5, 180, '체력을 100 회복시켜주는 고급 물약'),
('energy_drink', '에너지 드링크', 'consumable', 1, 15, 600, '이동 속도를 30% 증가시켜주는 드링크'),
('focus_pill', '집중력 약', 'consumable', 2, 8, 1800, '30분간 경험치 획득량을 50% 증가'),

-- 장비 아이템들
('luck_charm_common', '행운의 부적', 'equipment', 1, 1, 0, '거래 성공률을 5% 증가시키는 부적'),
('luck_charm_rare', '희귀 행운의 부적', 'equipment', 3, 1, 0, '거래 성공률을 10% 증가시키는 희귀한 부적'),
('merchant_seal', '상인의 인장', 'equipment', 4, 1, 0, '가격 협상력을 15% 증가시키는 전설의 인장'),
('trader_gloves', '상인의 장갑', 'equipment', 2, 1, 0, '아이템 감정 능력을 20% 향상시키는 장갑'),

-- 특수 아이템들
('teleport_scroll', '순간이동 스크롤', 'artifact', 3, 3, 7200, '원하는 상인에게 즉시 이동할 수 있는 마법 스크롤'),
('market_analysis', '시장 분석서', 'artifact', 2, 1, 86400, '24시간 동안 모든 상인의 가격 정보를 볼 수 있음');

-- 아이템 효과 데이터 삽입
INSERT OR REPLACE INTO item_effects (item_template_id, effect_type, effect_value, duration, description) VALUES
-- 체력 물약 효과
('health_potion_basic', 'health_boost', 50, 0, '즉시 체력 50 회복'),
('health_potion_advanced', 'health_boost', 100, 0, '즉시 체력 100 회복'),

-- 에너지 드링크 효과
('energy_drink', 'movement_speed', 30, 1800, '30분간 이동속도 30% 증가'),

-- 집중력 약 효과
('focus_pill', 'experience_bonus', 50, 1800, '30분간 경험치 50% 추가 획득'),

-- 행운의 부적 효과
('luck_charm_common', 'trade_success_rate', 5, -1, '거래 성공률 5% 증가 (장착 중)'),
('luck_charm_rare', 'trade_success_rate', 10, -1, '거래 성공률 10% 증가 (장착 중)'),

-- 상인의 인장 효과
('merchant_seal', 'negotiation_power', 15, -1, '가격 협상력 15% 증가 (장착 중)'),

-- 상인의 장갑 효과
('trader_gloves', 'appraisal_bonus', 20, -1, '아이템 감정 능력 20% 향상 (장착 중)'),

-- 순간이동 스크롤 효과
('teleport_scroll', 'instant_teleport', 1, 0, '즉시 원하는 상인에게 이동'),

-- 시장 분석서 효과
('market_analysis', 'price_visibility', 1, 86400, '24시간 동안 모든 상인 가격 정보 표시');