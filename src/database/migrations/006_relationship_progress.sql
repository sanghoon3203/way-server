-- 📁 006_relationship_progress.sql - 상인 관계 단계/퀘스트 진행 확장

-- merchant_relationships 테이블에 단계 진행도 컬럼 추가
ALTER TABLE merchant_relationships
    ADD COLUMN stage_progress INTEGER DEFAULT 0;

-- 서브 퀘스트 완료 로그 테이블 (중복 방지)
CREATE TABLE IF NOT EXISTS merchant_relationship_quest_log (
    id TEXT PRIMARY KEY,
    player_id TEXT NOT NULL,
    merchant_id TEXT NOT NULL,
    quest_id TEXT NOT NULL,
    stage INTEGER NOT NULL,
    completed_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (player_id) REFERENCES players(id) ON DELETE CASCADE,
    FOREIGN KEY (merchant_id) REFERENCES merchants(id) ON DELETE CASCADE,
    UNIQUE(player_id, merchant_id, quest_id)
);

CREATE INDEX IF NOT EXISTS idx_relationship_quest_log_player ON merchant_relationship_quest_log(player_id);
CREATE INDEX IF NOT EXISTS idx_relationship_quest_log_merchant ON merchant_relationship_quest_log(merchant_id);
