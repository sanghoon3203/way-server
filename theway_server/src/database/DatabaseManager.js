// 📁 src/database/DatabaseManager.js - SQLite 데이터베이스 관리
const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fs = require('fs').promises;
const logger = require('../config/logger');
const AdminExtensions = require('./AdminExtensions');

class DatabaseManager {
    constructor() {
        this.db = null;
        this.dbPath = process.env.DB_PATH || './data/way_game.sqlite';
    }

    /**
     * 데이터베이스 연결 및 초기화
     */
    async initialize() {
        try {
            // 데이터 디렉토리 생성
            const dataDir = path.dirname(this.dbPath);
            await fs.mkdir(dataDir, { recursive: true });

            // SQLite 연결
            await this.connect();
            
            // 기본 테이블 생성
            await this.createTables();
            
            // 확장 테이블 생성 (퀘스트, 스킬, 어드민)
            await AdminExtensions.createAllExtendedTables(this);
            
            // 인덱스 생성
            await this.createIndexes();
            
            logger.info('데이터베이스 초기화 완료');
            
        } catch (error) {
            logger.error('데이터베이스 초기화 실패:', error);
            throw error;
        }
    }

    /**
     * 데이터베이스 연결
     */
    connect() {
        return new Promise((resolve, reject) => {
            this.db = new sqlite3.Database(this.dbPath, (err) => {
                if (err) {
                    logger.error('데이터베이스 연결 실패:', err);
                    reject(err);
                } else {
                    logger.info(`데이터베이스 연결됨: ${this.dbPath}`);
                    
                    // 외래키 제약 조건 활성화
                    this.db.run('PRAGMA foreign_keys = ON');
                    
                    resolve();
                }
            });
        });
    }

    /**
     * 테이블 생성
     */
    async createTables() {
        const tables = [
            // 사용자 테이블
            `CREATE TABLE IF NOT EXISTS users (
                id TEXT PRIMARY KEY,
                email TEXT UNIQUE NOT NULL,
                password_hash TEXT NOT NULL,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                is_active BOOLEAN DEFAULT TRUE
            )`,

            // 플레이어 테이블
            `CREATE TABLE IF NOT EXISTS players (
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
                FOREIGN KEY (user_id) REFERENCES users(id)
            )`,

            // 아이템 템플릿 테이블
            `CREATE TABLE IF NOT EXISTS item_templates (
                id TEXT PRIMARY KEY,
                name TEXT NOT NULL,
                category TEXT NOT NULL,
                grade INTEGER NOT NULL,
                required_license INTEGER DEFAULT 0,
                base_price INTEGER NOT NULL,
                weight REAL DEFAULT 1.0,
                description TEXT,
                icon_id INTEGER DEFAULT 1
            )`,

            // 플레이어 아이템 인스턴스
            `CREATE TABLE IF NOT EXISTS player_items (
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
            )`,

            // 상인 테이블
            `CREATE TABLE IF NOT EXISTS merchants (
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
            )`,

            // 상인 선호도
            `CREATE TABLE IF NOT EXISTS merchant_preferences (
                id TEXT PRIMARY KEY,
                merchant_id TEXT NOT NULL,
                category TEXT NOT NULL,
                preference_type TEXT NOT NULL,
                FOREIGN KEY (merchant_id) REFERENCES merchants(id)
            )`,

            // 상인 인벤토리
            `CREATE TABLE IF NOT EXISTS merchant_inventory (
                id TEXT PRIMARY KEY,
                merchant_id TEXT NOT NULL,
                item_template_id TEXT NOT NULL,
                quantity INTEGER DEFAULT 1,
                current_price INTEGER NOT NULL,
                last_updated DATETIME DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (merchant_id) REFERENCES merchants(id),
                FOREIGN KEY (item_template_id) REFERENCES item_templates(id)
            )`,

            // 상인 관계
            `CREATE TABLE IF NOT EXISTS merchant_relationships (
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
            )`,

            // 거래 기록
            `CREATE TABLE IF NOT EXISTS trade_records (
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
            )`,

            // 플레이어 세션
            `CREATE TABLE IF NOT EXISTS player_sessions (
                id TEXT PRIMARY KEY,
                player_id TEXT NOT NULL,
                session_token TEXT UNIQUE NOT NULL,
                device_info TEXT,
                ip_address TEXT,
                started_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                last_activity DATETIME DEFAULT CURRENT_TIMESTAMP,
                ended_at DATETIME,
                FOREIGN KEY (player_id) REFERENCES players(id)
            )`,

            // 활동 로그
            `CREATE TABLE IF NOT EXISTS activity_logs (
                id TEXT PRIMARY KEY,
                player_id TEXT,
                action_type TEXT NOT NULL,
                details TEXT,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (player_id) REFERENCES players(id)
            )`
        ];

        for (const tableQuery of tables) {
            await this.run(tableQuery);
        }

        logger.info('모든 테이블 생성 완료');
    }

    /**
     * 인덱스 생성
     */
    async createIndexes() {
        const indexes = [
            'CREATE INDEX IF NOT EXISTS idx_players_user_id ON players(user_id)',
            'CREATE INDEX IF NOT EXISTS idx_players_last_active ON players(last_active)',
            'CREATE INDEX IF NOT EXISTS idx_player_items_player_id ON player_items(player_id)',
            'CREATE INDEX IF NOT EXISTS idx_merchant_inventory_merchant_id ON merchant_inventory(merchant_id)',
            'CREATE INDEX IF NOT EXISTS idx_trade_records_player_id ON trade_records(player_id)',
            'CREATE INDEX IF NOT EXISTS idx_trade_records_created_at ON trade_records(created_at)',
            'CREATE INDEX IF NOT EXISTS idx_activity_logs_player_id ON activity_logs(player_id)',
            'CREATE INDEX IF NOT EXISTS idx_activity_logs_created_at ON activity_logs(created_at)',
        ];

        for (const indexQuery of indexes) {
            await this.run(indexQuery);
        }

        logger.info('모든 인덱스 생성 완료');
    }

    /**
     * SQL 실행 (Promise 래퍼)
     */
    run(sql, params = []) {
        return new Promise((resolve, reject) => {
            this.db.run(sql, params, function(err) {
                if (err) {
                    logger.error('SQL 실행 실패:', { sql, params, error: err.message });
                    reject(err);
                } else {
                    resolve({ id: this.lastID, changes: this.changes });
                }
            });
        });
    }

    /**
     * 단일 행 조회
     */
    get(sql, params = []) {
        return new Promise((resolve, reject) => {
            this.db.get(sql, params, (err, row) => {
                if (err) {
                    logger.error('SQL 조회 실패:', { sql, params, error: err.message });
                    reject(err);
                } else {
                    resolve(row);
                }
            });
        });
    }

    /**
     * 다중 행 조회
     */
    all(sql, params = []) {
        return new Promise((resolve, reject) => {
            this.db.all(sql, params, (err, rows) => {
                if (err) {
                    logger.error('SQL 조회 실패:', { sql, params, error: err.message });
                    reject(err);
                } else {
                    resolve(rows || []);
                }
            });
        });
    }

    /**
     * 트랜잭션 실행
     */
    async transaction(queries) {
        await this.run('BEGIN TRANSACTION');
        
        try {
            const results = [];
            
            for (const { sql, params } of queries) {
                const result = await this.run(sql, params);
                results.push(result);
            }
            
            await this.run('COMMIT');
            return results;
            
        } catch (error) {
            await this.run('ROLLBACK');
            throw error;
        }
    }

    /**
     * 데이터베이스 연결 종료
     */
    close() {
        return new Promise((resolve) => {
            if (this.db) {
                this.db.close((err) => {
                    if (err) {
                        logger.error('데이터베이스 종료 중 오류:', err);
                    } else {
                        logger.info('데이터베이스 연결 종료됨');
                    }
                    resolve();
                });
            } else {
                resolve();
            }
        });
    }

    /**
     * 데이터베이스 인스턴스 반환
     */
    getDb() {
        return this.db;
    }
}

// 싱글톤 인스턴스
const dbManager = new DatabaseManager();

module.exports = dbManager;