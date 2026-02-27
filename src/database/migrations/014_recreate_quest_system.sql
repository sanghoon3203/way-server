-- 014_recreate_quest_system.sql
-- 퀘스트 시스템 재생성 (012에서 삭제된 테이블 복구)

-- 퀘스트 템플릿 (정의)
CREATE TABLE IF NOT EXISTS quest_templates (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    description TEXT,
    category TEXT DEFAULT 'side_quest',
    type TEXT DEFAULT 'trade',
    level_requirement INTEGER DEFAULT 1,
    required_license INTEGER DEFAULT 0,
    required_merchant TEXT,
    prerequisites TEXT DEFAULT '[]',
    objectives TEXT DEFAULT '[]',
    rewards TEXT DEFAULT '{}',
    auto_complete INTEGER DEFAULT 0,
    repeatable INTEGER DEFAULT 0,
    cooldown_hours INTEGER DEFAULT 0,
    time_limit INTEGER,
    priority INTEGER DEFAULT 1,
    is_active INTEGER DEFAULT 1,
    sort_order INTEGER DEFAULT 0,
    story_node_id TEXT,
    is_story_quest INTEGER DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 플레이어별 퀘스트 진행 상태
CREATE TABLE IF NOT EXISTS player_quests (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    player_id TEXT NOT NULL,
    quest_id TEXT NOT NULL,
    status TEXT DEFAULT 'available',
    current_progress INTEGER DEFAULT 0,
    max_progress INTEGER DEFAULT 1,
    accepted_at DATETIME,
    completed_at DATETIME,
    expires_at DATETIME,
    reward_claimed INTEGER DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (player_id) REFERENCES players(id),
    FOREIGN KEY (quest_id) REFERENCES quest_templates(id),
    UNIQUE(player_id, quest_id)
);

CREATE INDEX IF NOT EXISTS idx_player_quests_player ON player_quests(player_id);
CREATE INDEX IF NOT EXISTS idx_player_quests_status ON player_quests(player_id, status);
CREATE INDEX IF NOT EXISTS idx_quest_templates_category ON quest_templates(category);
CREATE INDEX IF NOT EXISTS idx_quest_templates_active ON quest_templates(is_active);
