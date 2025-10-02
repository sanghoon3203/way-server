-- 📁 002_merchants_schema.sql - 상인 및 거래 시스템 스키마

-- 상인 테이블
CREATE TABLE IF NOT EXISTS merchants (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    title TEXT,
    merchant_type TEXT NOT NULL,
    personality TEXT DEFAULT 'calm',
    district TEXT NOT NULL,
    lat REAL NOT NULL,
    lng REAL NOT NULL,
    required_license INTEGER DEFAULT 0,
    price_modifier REAL DEFAULT 1.0,
    negotiation_difficulty INTEGER DEFAULT 3,
    reputation_requirement INTEGER DEFAULT 0,
    is_active BOOLEAN DEFAULT TRUE,
    last_restocked DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 상인 선호도
CREATE TABLE IF NOT EXISTS merchant_preferences (
    id TEXT PRIMARY KEY,
    merchant_id TEXT NOT NULL,
    category TEXT NOT NULL,
    preference_type TEXT NOT NULL,
    FOREIGN KEY (merchant_id) REFERENCES merchants(id)
);

-- 상인 인벤토리
CREATE TABLE IF NOT EXISTS merchant_inventory (
    id TEXT PRIMARY KEY,
    merchant_id TEXT NOT NULL,
    item_template_id TEXT NOT NULL,
    quantity INTEGER DEFAULT 1,
    current_price INTEGER NOT NULL,
    last_updated DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (merchant_id) REFERENCES merchants(id),
    FOREIGN KEY (item_template_id) REFERENCES item_templates(id)
);

-- 상인 관계
CREATE TABLE IF NOT EXISTS merchant_relationships (
    id TEXT PRIMARY KEY,
    player_id TEXT NOT NULL,
    merchant_id TEXT NOT NULL,
    friendship_points INTEGER DEFAULT 0,
    trust_level INTEGER DEFAULT 0,
    total_trades INTEGER DEFAULT 0,
    total_spent INTEGER DEFAULT 0,
    last_interaction DATETIME,
    notes TEXT,
    FOREIGN KEY (player_id) REFERENCES players(id),
    FOREIGN KEY (merchant_id) REFERENCES merchants(id),
    UNIQUE(player_id, merchant_id)
);

-- 거래 기록
CREATE TABLE IF NOT EXISTS trade_records (
    id TEXT PRIMARY KEY,
    player_id TEXT NOT NULL,
    merchant_id TEXT NOT NULL,
    item_template_id TEXT NOT NULL,
    trade_type TEXT NOT NULL,
    quantity INTEGER NOT NULL,
    unit_price INTEGER NOT NULL,
    total_price INTEGER NOT NULL,
    profit INTEGER DEFAULT 0,
    experience_gained INTEGER DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (player_id) REFERENCES players(id),
    FOREIGN KEY (merchant_id) REFERENCES merchants(id),
    FOREIGN KEY (item_template_id) REFERENCES item_templates(id)
);

-- 인덱스 생성
CREATE INDEX IF NOT EXISTS idx_merchant_inventory_merchant_id ON merchant_inventory(merchant_id);
CREATE INDEX IF NOT EXISTS idx_trade_records_player_id ON trade_records(player_id);
CREATE INDEX IF NOT EXISTS idx_trade_records_created_at ON trade_records(created_at);
