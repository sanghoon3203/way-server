-- Story System Schema Migration
-- 파일명: 005_story_system_schema.sql
-- 목적: 스토리 퀘스트 시스템을 위한 데이터베이스 스키마 추가

-- ============================================
-- 1. merchants 테이블 확장
-- ============================================
-- 스토리 역할 컬럼 추가
ALTER TABLE merchants ADD COLUMN story_role TEXT CHECK(story_role IN ('main', 'side', 'vendor_only'));

-- 첫 스토리 노드 ID
ALTER TABLE merchants ADD COLUMN initial_story_node TEXT;

-- 활성 스토리 플래그 (빠른 필터링용)
ALTER TABLE merchants ADD COLUMN has_active_story INTEGER DEFAULT 0;

-- 인덱스 생성
CREATE INDEX IF NOT EXISTS idx_merchants_story_role ON merchants(story_role) WHERE story_role IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_merchants_has_story ON merchants(has_active_story) WHERE has_active_story = 1;

-- 기존 상인들은 기본적으로 vendor_only로 설정
UPDATE merchants SET story_role = 'vendor_only', has_active_story = 0 WHERE story_role IS NULL;

-- ============================================
-- 2. quest_templates 테이블 생성 및 확장
-- ============================================
-- quest_templates 테이블이 없을 경우 생성
CREATE TABLE IF NOT EXISTS quest_templates (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    description TEXT NOT NULL,
    category TEXT NOT NULL,
    type TEXT NOT NULL,
    level_requirement INTEGER DEFAULT 1,
    required_license INTEGER DEFAULT 0,
    prerequisites TEXT DEFAULT '[]',
    objectives TEXT NOT NULL,
    rewards TEXT DEFAULT '{}',
    auto_complete INTEGER DEFAULT 0,
    repeatable INTEGER DEFAULT 0,
    time_limit INTEGER DEFAULT 0,
    cooldown_hours INTEGER DEFAULT 0,
    is_active INTEGER DEFAULT 1,
    sort_order INTEGER DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 스토리 노드 ID 참조
ALTER TABLE quest_templates ADD COLUMN story_node_id TEXT;

-- 스토리 퀘스트 플래그
ALTER TABLE quest_templates ADD COLUMN is_story_quest INTEGER DEFAULT 0;

-- 인덱스 생성
CREATE INDEX IF NOT EXISTS idx_quest_templates_story ON quest_templates(is_story_quest) WHERE is_story_quest = 1;
CREATE INDEX IF NOT EXISTS idx_quest_templates_node ON quest_templates(story_node_id) WHERE story_node_id IS NOT NULL;

-- ============================================
-- 3. story_nodes 테이블 생성 (신규)
-- ============================================
CREATE TABLE IF NOT EXISTS story_nodes (
    id TEXT PRIMARY KEY,
    node_type TEXT NOT NULL CHECK(node_type IN ('dialogue', 'decision', 'quest_gate')),
    merchant_id TEXT REFERENCES merchants(id),
    location_id TEXT,                                 -- 특정 위치 요구사항 (optional)
    content TEXT NOT NULL,                            -- JSON: 대화 내용
    choices TEXT,                                     -- JSON: 플레이어 선택지
    prerequisites TEXT,                               -- JSON: 접근 조건
    next_nodes TEXT,                                  -- JSON: 다음 가능한 노드들
    rewards TEXT,                                     -- JSON: 완료 보상
    metadata TEXT,                                    -- JSON: 챕터 정보 등
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_story_nodes_merchant ON story_nodes(merchant_id);
CREATE INDEX IF NOT EXISTS idx_story_nodes_type ON story_nodes(node_type);
CREATE INDEX IF NOT EXISTS idx_story_nodes_location ON story_nodes(location_id) WHERE location_id IS NOT NULL;

-- ============================================
-- 4. player_story_progress 테이블 생성 (신규)
-- ============================================
CREATE TABLE IF NOT EXISTS player_story_progress (
    id TEXT PRIMARY KEY,
    player_id TEXT NOT NULL REFERENCES players(id),
    current_node_id TEXT,                          -- 현재 활성 스토리 노드
    visited_nodes TEXT DEFAULT '[]',               -- JSON: 방문한 노드 목록
    story_flags TEXT DEFAULT '{}',                 -- JSON: 스토리 플래그
    last_interaction TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(player_id)
);

CREATE INDEX IF NOT EXISTS idx_player_story_player ON player_story_progress(player_id);

-- ============================================
-- 5. merchant_dialogues 테이블 생성 및 확장 (optional)
-- ============================================
-- merchant_dialogues 테이블이 없을 경우 생성
CREATE TABLE IF NOT EXISTS merchant_dialogues (
    id TEXT PRIMARY KEY,
    merchant_id TEXT NOT NULL REFERENCES merchants(id),
    dialogue_key TEXT NOT NULL,
    dialogue_text TEXT NOT NULL,
    conditions TEXT DEFAULT '{}',
    priority INTEGER DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 스토리 노드 참조 추가 (기존 대화 시스템과 연동용)
ALTER TABLE merchant_dialogues ADD COLUMN story_node_id TEXT;

CREATE INDEX IF NOT EXISTS idx_merchant_dialogues_story ON merchant_dialogues(story_node_id) WHERE story_node_id IS NOT NULL;

-- ============================================
-- 마이그레이션 완료
-- ============================================
-- 이 마이그레이션은 기존 시스템에 영향을 주지 않습니다.
-- 모든 변경사항은 additive이며, 기존 기능은 그대로 작동합니다.
