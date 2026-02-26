-- 013_player_story_progress.sql
-- iOS PlayerProgress와 1:1 매핑하는 진행도 동기화 테이블

CREATE TABLE IF NOT EXISTS player_story_progress (
  player_id            TEXT PRIMARY KEY,
  completed_chapters   TEXT NOT NULL DEFAULT '[]',
  completed_episodes   TEXT NOT NULL DEFAULT '[]',
  completed_sub_quests TEXT NOT NULL DEFAULT '[]',
  unlocked_episodes    TEXT NOT NULL DEFAULT '[]',
  key_items            TEXT NOT NULL DEFAULT '[]',
  last_synced_at       DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (player_id) REFERENCES players(id)
);

CREATE INDEX IF NOT EXISTS idx_story_progress_player
  ON player_story_progress(player_id);
