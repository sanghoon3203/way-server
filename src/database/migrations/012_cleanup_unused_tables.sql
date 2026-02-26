-- 012_cleanup_unused_tables.sql
-- 앱에서 사용하지 않는 테이블 제거

DROP TABLE IF EXISTS economy_analytics;
DROP TABLE IF EXISTS player_analytics;
DROP TABLE IF EXISTS server_metrics;
DROP TABLE IF EXISTS player_sessions;
DROP TABLE IF EXISTS activity_logs;
DROP TABLE IF EXISTS achievement_completions;
DROP TABLE IF EXISTS player_achievements;
DROP TABLE IF EXISTS achievement_templates;
DROP TABLE IF EXISTS quest_completions;
DROP TABLE IF EXISTS player_quests;
DROP TABLE IF EXISTS quest_templates;
DROP TABLE IF EXISTS merchant_dialogues;
DROP TABLE IF EXISTS story_nodes;
DROP TABLE IF EXISTS player_story_progress;
DROP TABLE IF EXISTS skills;
