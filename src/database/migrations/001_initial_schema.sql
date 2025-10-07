-- 📁 001_initial_schema.sql - 기본 사용자 및 플레이어 스키마

-- 사용자 테이블
CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    email TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    is_active BOOLEAN DEFAULT TRUE
);

-- 플레이어 테이블
CREATE TABLE IF NOT EXISTS players (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    name TEXT NOT NULL,
    money INTEGER DEFAULT 50000,
    trust_points INTEGER DEFAULT 0,
    reputation INTEGER DEFAULT 0,
    current_license INTEGER DEFAULT 0,
    max_inventory_size INTEGER DEFAULT 5,
    level INTEGER DEFAULT 1,
    experience INTEGER DEFAULT 0,
    stat_points INTEGER DEFAULT 0,
    skill_points INTEGER DEFAULT 0,
    strength INTEGER DEFAULT 10,
    intelligence INTEGER DEFAULT 10,
    charisma INTEGER DEFAULT 10,
    luck INTEGER DEFAULT 10,
    trading_skill INTEGER DEFAULT 1,
    negotiation_skill INTEGER DEFAULT 1,
    appraisal_skill INTEGER DEFAULT 1,
    max_storage_size INTEGER DEFAULT 50,
    current_lat REAL,
    current_lng REAL,
    last_known_lat REAL,
    last_known_lng REAL,
    home_lat REAL,
    home_lng REAL,
    total_trades INTEGER DEFAULT 0,
    total_profit INTEGER DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    last_active DATETIME DEFAULT CURRENT_TIMESTAMP,
    total_play_time INTEGER DEFAULT 0,
    daily_play_time INTEGER DEFAULT 0,
    main_story_progress INTEGER DEFAULT 0,
    FOREIGN KEY (user_id) REFERENCES users(id)
);

-- 아이템 템플릿 테이블
CREATE TABLE IF NOT EXISTS item_templates (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    category TEXT NOT NULL,
    grade INTEGER NOT NULL,
    required_license INTEGER DEFAULT 0,
    base_price INTEGER NOT NULL,
    weight REAL DEFAULT 1.0,
    description TEXT,
    icon_id INTEGER DEFAULT 1
);

-- 플레이어 아이템 인스턴스
CREATE TABLE IF NOT EXISTS player_items (
    id TEXT PRIMARY KEY,
    player_id TEXT NOT NULL,
    item_template_id TEXT NOT NULL,
    quantity INTEGER DEFAULT 1,
    storage_type TEXT DEFAULT 'inventory',
    purchase_price INTEGER,
    purchase_date DATETIME,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (player_id) REFERENCES players(id),
    FOREIGN KEY (item_template_id) REFERENCES item_templates(id)
);

-- 퀘스트 테이블 (대시보드 통계용 최소 스키마)
CREATE TABLE IF NOT EXISTS quests (
    id TEXT PRIMARY KEY,
    title TEXT NOT NULL,
    status TEXT DEFAULT 'active',
    category TEXT DEFAULT 'general',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 스킬 테이블 (대시보드 통계용 최소 스키마)
CREATE TABLE IF NOT EXISTS skills (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    category TEXT DEFAULT 'general',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 플레이어 세션
CREATE TABLE IF NOT EXISTS player_sessions (
    id TEXT PRIMARY KEY,
    player_id TEXT NOT NULL,
    session_token TEXT UNIQUE NOT NULL,
    device_info TEXT,
    ip_address TEXT,
    started_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    last_activity DATETIME DEFAULT CURRENT_TIMESTAMP,
    ended_at DATETIME,
    FOREIGN KEY (player_id) REFERENCES players(id)
);

-- 활동 로그
CREATE TABLE IF NOT EXISTS activity_logs (
    id TEXT PRIMARY KEY,
    player_id TEXT,
    action_type TEXT NOT NULL,
    details TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (player_id) REFERENCES players(id)
);

-- 비밀번호 재설정 토큰
CREATE TABLE IF NOT EXISTS password_reset_tokens (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    email TEXT NOT NULL,
    token TEXT NOT NULL,
    expires_at DATETIME NOT NULL,
    used_at DATETIME,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id)
);

-- 인덱스 생성
CREATE INDEX IF NOT EXISTS idx_players_user_id ON players(user_id);
CREATE INDEX IF NOT EXISTS idx_players_last_active ON players(last_active);
CREATE INDEX IF NOT EXISTS idx_player_items_player_id ON player_items(player_id);
CREATE INDEX IF NOT EXISTS idx_activity_logs_player_id ON activity_logs(player_id);
CREATE INDEX IF NOT EXISTS idx_activity_logs_created_at ON activity_logs(created_at);
CREATE INDEX IF NOT EXISTS idx_password_reset_tokens_email ON password_reset_tokens(email);
CREATE INDEX IF NOT EXISTS idx_password_reset_tokens_user_id ON password_reset_tokens(user_id);
