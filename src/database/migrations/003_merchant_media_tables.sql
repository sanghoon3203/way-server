-- 상인 미디어 테이블 생성 마이그레이션
-- 파일명: 003_merchant_media_tables.sql

-- 상인 미디어 (로컬 파일 경로 저장)
CREATE TABLE IF NOT EXISTS merchant_media (
    id TEXT PRIMARY KEY,
    merchant_id TEXT NOT NULL,
    media_type TEXT NOT NULL, -- 'face_image', 'animation_gif'
    emotion TEXT, -- 'happy', 'sad', 'angry', 'surprised', 'neutral', 'idle', 'talking', 'celebrating'
    file_path TEXT NOT NULL, -- 로컬 파일 경로
    file_name TEXT NOT NULL,
    file_size INTEGER,
    mime_type TEXT,
    is_active BOOLEAN DEFAULT TRUE,
    upload_admin_id TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (merchant_id) REFERENCES merchants(id)
);

-- 상인 대화 시스템
CREATE TABLE IF NOT EXISTS merchant_dialogues (
    id TEXT PRIMARY KEY,
    merchant_id TEXT NOT NULL,
    trigger_type TEXT NOT NULL, -- 'greeting', 'trade_start', 'trade_end', 'special_event'
    trigger_condition TEXT DEFAULT '{}', -- JSON 형태의 조건
    dialogue_text TEXT NOT NULL,
    dialogue_order INTEGER DEFAULT 0,
    emotion TEXT DEFAULT 'neutral',
    is_active BOOLEAN DEFAULT TRUE,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (merchant_id) REFERENCES merchants(id)
);

-- 상인 대화 로그 (플레이어와의 대화 기록)
CREATE TABLE IF NOT EXISTS merchant_dialogue_logs (
    id TEXT PRIMARY KEY,
    player_id TEXT NOT NULL,
    merchant_id TEXT NOT NULL,
    dialogue_id TEXT,
    interaction_type TEXT, -- 'auto_greeting', 'manual_chat', 'trade_related'
    message_text TEXT,
    merchant_emotion TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (player_id) REFERENCES players(id),
    FOREIGN KEY (merchant_id) REFERENCES merchants(id),
    FOREIGN KEY (dialogue_id) REFERENCES merchant_dialogues(id)
);

-- 인덱스 생성
CREATE INDEX IF NOT EXISTS idx_merchant_media_merchant_id ON merchant_media(merchant_id);
CREATE INDEX IF NOT EXISTS idx_merchant_media_type_emotion ON merchant_media(media_type, emotion);
CREATE INDEX IF NOT EXISTS idx_merchant_dialogues_merchant_id ON merchant_dialogues(merchant_id);
CREATE INDEX IF NOT EXISTS idx_merchant_dialogues_trigger ON merchant_dialogues(trigger_type);
CREATE INDEX IF NOT EXISTS idx_merchant_dialogue_logs_merchant_player ON merchant_dialogue_logs(merchant_id, player_id);
CREATE INDEX IF NOT EXISTS idx_merchant_dialogue_logs_created_at ON merchant_dialogue_logs(created_at);