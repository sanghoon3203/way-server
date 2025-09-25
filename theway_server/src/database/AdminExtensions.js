// 📁 src/database/AdminExtensions.js - 확장된 데이터베이스 스키마
const logger = require('../config/logger');

class AdminExtensions {
    
    // 퀘스트 시스템 테이블들
    static getQuestTables() {
        return [
            // 퀘스트 템플릿
            `CREATE TABLE IF NOT EXISTS quest_templates (
                id TEXT PRIMARY KEY,
                name TEXT NOT NULL,
                description TEXT NOT NULL,
                category TEXT NOT NULL, -- main_story, side_quest, daily, weekly, achievement
                type TEXT NOT NULL, -- kill, collect, trade, visit, talk
                level_requirement INTEGER DEFAULT 1,
                required_license INTEGER DEFAULT 0,
                prerequisites TEXT, -- JSON array of prerequisite quest IDs
                objectives TEXT NOT NULL, -- JSON array of objectives
                rewards TEXT, -- JSON object with rewards (money, items, exp, etc)
                auto_complete BOOLEAN DEFAULT FALSE,
                repeatable BOOLEAN DEFAULT FALSE,
                time_limit INTEGER, -- seconds, NULL for no limit
                is_active BOOLEAN DEFAULT TRUE,
                sort_order INTEGER DEFAULT 0,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
            )`,

            // 플레이어별 퀘스트 진행상황
            `CREATE TABLE IF NOT EXISTS player_quests (
                id TEXT PRIMARY KEY,
                player_id TEXT NOT NULL,
                quest_template_id TEXT NOT NULL,
                status TEXT DEFAULT 'active', -- active, completed, failed, abandoned
                progress TEXT, -- JSON object with progress data
                started_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                completed_at DATETIME NULL,
                expires_at DATETIME NULL,
                FOREIGN KEY (player_id) REFERENCES players(id),
                FOREIGN KEY (quest_template_id) REFERENCES quest_templates(id),
                UNIQUE(player_id, quest_template_id)
            )`,

            // 퀘스트 완료 기록
            `CREATE TABLE IF NOT EXISTS quest_completions (
                id TEXT PRIMARY KEY,
                player_id TEXT NOT NULL,
                quest_template_id TEXT NOT NULL,
                completion_count INTEGER DEFAULT 1,
                first_completed_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                last_completed_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                total_rewards TEXT, -- JSON累積 보상 기록
                FOREIGN KEY (player_id) REFERENCES players(id),
                FOREIGN KEY (quest_template_id) REFERENCES quest_templates(id),
                UNIQUE(player_id, quest_template_id)
            )`
        ];
    }

    // 확장된 스킬 시스템 테이블들
    static getSkillTables() {
        return [
            // 스킬 트리 템플릿
            `CREATE TABLE IF NOT EXISTS skill_templates (
                id TEXT PRIMARY KEY,
                name TEXT NOT NULL,
                description TEXT NOT NULL,
                category TEXT NOT NULL, -- trading, social, exploration, combat, crafting
                tier INTEGER NOT NULL, -- 1-5 (기초부터 전문가까지)
                max_level INTEGER DEFAULT 10,
                prerequisites TEXT, -- JSON array of prerequisite skill IDs
                unlock_requirements TEXT, -- JSON object with unlock conditions
                effects TEXT, -- JSON object with skill effects per level
                cost_per_level TEXT, -- JSON array of costs (skill points, items, etc)
                icon_id INTEGER DEFAULT 1,
                is_active BOOLEAN DEFAULT TRUE,
                sort_order INTEGER DEFAULT 0,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP
            )`,

            // 플레이어별 스킬 레벨
            `CREATE TABLE IF NOT EXISTS player_skills (
                id TEXT PRIMARY KEY,
                player_id TEXT NOT NULL,
                skill_template_id TEXT NOT NULL,
                current_level INTEGER DEFAULT 0,
                current_exp INTEGER DEFAULT 0,
                unlocked_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                last_used_at DATETIME,
                usage_count INTEGER DEFAULT 0,
                FOREIGN KEY (player_id) REFERENCES players(id),
                FOREIGN KEY (skill_template_id) REFERENCES skill_templates(id),
                UNIQUE(player_id, skill_template_id)
            )`,

            // 스킬 사용 기록
            `CREATE TABLE IF NOT EXISTS skill_usage_logs (
                id TEXT PRIMARY KEY,
                player_id TEXT NOT NULL,
                skill_template_id TEXT NOT NULL,
                usage_context TEXT, -- trade, negotiation, exploration, etc
                effectiveness REAL, -- 0.0 - 1.0
                exp_gained INTEGER DEFAULT 0,
                used_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                additional_data TEXT, -- JSON with context-specific data
                FOREIGN KEY (player_id) REFERENCES players(id),
                FOREIGN KEY (skill_template_id) REFERENCES skill_templates(id)
            )`
        ];
    }

    // 성취 시스템 테이블들
    static getAchievementTables() {
        return [
            // 성취 템플릿
            `CREATE TABLE IF NOT EXISTS achievement_templates (
                id TEXT PRIMARY KEY,
                name TEXT NOT NULL,
                description TEXT NOT NULL,
                category TEXT NOT NULL, -- trading, exploration, social, progression, special
                type TEXT NOT NULL, -- single, progressive, repeatable
                unlock_condition TEXT NOT NULL, -- JSON object with conditions
                rewards TEXT, -- JSON object with rewards (money, items, exp, titles, etc)
                points INTEGER DEFAULT 0, -- achievement points
                rarity TEXT DEFAULT 'common', -- common, rare, epic, legendary
                icon_id INTEGER DEFAULT 1,
                is_secret BOOLEAN DEFAULT FALSE, -- hidden until unlocked
                is_active BOOLEAN DEFAULT TRUE,
                sort_order INTEGER DEFAULT 0,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
            )`,

            // 플레이어별 성취 진행상황
            `CREATE TABLE IF NOT EXISTS player_achievements (
                id TEXT PRIMARY KEY,
                player_id TEXT NOT NULL,
                achievement_template_id TEXT NOT NULL,
                status TEXT DEFAULT 'locked', -- locked, in_progress, completed
                progress TEXT, -- JSON object with progress data
                current_value INTEGER DEFAULT 0, -- for progressive achievements
                target_value INTEGER DEFAULT 1, -- required value for completion
                unlocked_at DATETIME NULL,
                completed_at DATETIME NULL,
                FOREIGN KEY (player_id) REFERENCES players(id),
                FOREIGN KEY (achievement_template_id) REFERENCES achievement_templates(id),
                UNIQUE(player_id, achievement_template_id)
            )`,

            // 성취 완료 기록
            `CREATE TABLE IF NOT EXISTS achievement_completions (
                id TEXT PRIMARY KEY,
                player_id TEXT NOT NULL,
                achievement_template_id TEXT NOT NULL,
                completion_count INTEGER DEFAULT 1,
                first_completed_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                last_completed_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                total_points INTEGER DEFAULT 0,
                FOREIGN KEY (player_id) REFERENCES players(id),
                FOREIGN KEY (achievement_template_id) REFERENCES achievement_templates(id),
                UNIQUE(player_id, achievement_template_id)
            )`
        ];
    }

    // 어드민 시스템 테이블들
    static getAdminTables() {
        return [
            // 어드민 사용자
            `CREATE TABLE IF NOT EXISTS admin_users (
                id TEXT PRIMARY KEY,
                username TEXT UNIQUE NOT NULL,
                email TEXT UNIQUE NOT NULL,
                password_hash TEXT NOT NULL,
                role TEXT NOT NULL DEFAULT 'moderator', -- super_admin, admin, moderator
                permissions TEXT, -- JSON array of specific permissions
                is_active BOOLEAN DEFAULT TRUE,
                last_login_at DATETIME,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                created_by TEXT,
                FOREIGN KEY (created_by) REFERENCES admin_users(id)
            )`,

            // 어드민 액션 로그
            `CREATE TABLE IF NOT EXISTS admin_action_logs (
                id TEXT PRIMARY KEY,
                admin_user_id TEXT NOT NULL,
                action_type TEXT NOT NULL, -- create, update, delete, view, export
                target_type TEXT NOT NULL, -- player, quest, skill, item, merchant, etc
                target_id TEXT,
                old_data TEXT, -- JSON snapshot before change
                new_data TEXT, -- JSON snapshot after change
                ip_address TEXT,
                user_agent TEXT,
                performed_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (admin_user_id) REFERENCES admin_users(id)
            )`,

            // 시스템 설정
            `CREATE TABLE IF NOT EXISTS system_settings (
                id TEXT PRIMARY KEY,
                category TEXT NOT NULL, -- game, server, admin, maintenance
                key TEXT NOT NULL,
                value TEXT, -- JSON value
                data_type TEXT NOT NULL, -- string, number, boolean, json, array
                description TEXT,
                is_public BOOLEAN DEFAULT FALSE, -- client에서 접근 가능한지
                updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                updated_by TEXT,
                FOREIGN KEY (updated_by) REFERENCES admin_users(id),
                UNIQUE(category, key)
            )`,

            // 게임 이벤트 및 공지
            `CREATE TABLE IF NOT EXISTS game_events (
                id TEXT PRIMARY KEY,
                name TEXT NOT NULL,
                description TEXT,
                event_type TEXT NOT NULL, -- announcement, maintenance, special_event, promotion
                start_date DATETIME,
                end_date DATETIME,
                is_active BOOLEAN DEFAULT TRUE,
                target_audience TEXT, -- all, level_range, specific_players (JSON)
                event_data TEXT, -- JSON with event-specific data
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                created_by TEXT,
                FOREIGN KEY (created_by) REFERENCES admin_users(id)
            )`
        ];
    }

    // 확장된 분석 및 모니터링 테이블들
    static getAnalyticsTables() {
        return [
            // 플레이어 행동 분석
            `CREATE TABLE IF NOT EXISTS player_analytics (
                id TEXT PRIMARY KEY,
                player_id TEXT NOT NULL,
                session_id TEXT,
                event_type TEXT NOT NULL, -- login, logout, trade, quest_complete, skill_use, etc
                event_data TEXT, -- JSON with detailed event information
                location_lat REAL,
                location_lng REAL,
                device_info TEXT, -- JSON with device information
                occurred_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (player_id) REFERENCES players(id)
            )`,

            // 경제 분석 (무역 통계)
            `CREATE TABLE IF NOT EXISTS economy_analytics (
                id TEXT PRIMARY KEY,
                date_recorded DATE NOT NULL,
                item_template_id TEXT,
                merchant_id TEXT,
                metric_type TEXT NOT NULL, -- price_avg, volume, demand, supply
                metric_value REAL NOT NULL,
                additional_data TEXT, -- JSON with extra metrics
                recorded_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (item_template_id) REFERENCES item_templates(id),
                FOREIGN KEY (merchant_id) REFERENCES merchants(id),
                UNIQUE(date_recorded, item_template_id, merchant_id, metric_type)
            )`,

            // 서버 성능 모니터링
            `CREATE TABLE IF NOT EXISTS server_metrics (
                id TEXT PRIMARY KEY,
                metric_name TEXT NOT NULL,
                metric_value REAL NOT NULL,
                metric_unit TEXT, -- ms, mb, count, percent
                recorded_at DATETIME DEFAULT CURRENT_TIMESTAMP
            )`
        ];
    }

    // 모든 확장 테이블 생성
    static async createAllExtendedTables(db) {
        const allTables = [
            ...this.getQuestTables(),
            ...this.getSkillTables(),
            ...this.getAchievementTables(),
            ...this.getAdminTables(),
            ...this.getAnalyticsTables()
        ];

        logger.info('확장 테이블 생성 시작...');
        
        for (const tableQuery of allTables) {
            try {
                await db.run(tableQuery);
            } catch (error) {
                logger.error('테이블 생성 실패:', { query: tableQuery.substring(0, 50) + '...', error });
                throw error;
            }
        }

        // 인덱스 생성
        const indexes = [
            'CREATE INDEX IF NOT EXISTS idx_player_quests_status ON player_quests(player_id, status)',
            'CREATE INDEX IF NOT EXISTS idx_player_skills_level ON player_skills(player_id, current_level)',
            'CREATE INDEX IF NOT EXISTS idx_player_achievements_status ON player_achievements(player_id, status)',
            'CREATE INDEX IF NOT EXISTS idx_achievements_category ON achievement_templates(category, rarity)',
            'CREATE INDEX IF NOT EXISTS idx_admin_logs_action ON admin_action_logs(admin_user_id, action_type, performed_at)',
            'CREATE INDEX IF NOT EXISTS idx_analytics_player ON player_analytics(player_id, event_type, occurred_at)',
            'CREATE INDEX IF NOT EXISTS idx_economy_date ON economy_analytics(date_recorded, item_template_id)'
        ];

        for (const indexQuery of indexes) {
            try {
                await db.run(indexQuery);
            } catch (error) {
                logger.error('인덱스 생성 실패:', { query: indexQuery, error });
                throw error;
            }
        }

        logger.info('모든 확장 테이블 및 인덱스 생성 완료');
    }
}

module.exports = AdminExtensions;