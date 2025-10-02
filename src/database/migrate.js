// 📁 src/database/migrate.js - 데이터베이스 마이그레이션 실행
const DatabaseManager = require('./DatabaseManager');
const logger = require('../config/logger');
const fs = require('fs');
const path = require('path');

async function runMigrations(options = {}) {
    const { reuseConnection = false } = options;
    try {
        logger.info(reuseConnection ? '마이그레이션 시작 (기존 연결 재사용)...' : '마이그레이션 시작...');

        if (!reuseConnection) {
            await DatabaseManager.initialize();
        }

        // 마이그레이션 폴더에서 SQL 파일들 찾기
        const migrationsDir = path.join(__dirname, 'migrations');
        if (!fs.existsSync(migrationsDir)) {
            logger.warn(`마이그레이션 디렉터리를 찾을 수 없습니다: ${migrationsDir}`);
            return;
        }

        const migrationFiles = fs.readdirSync(migrationsDir)
            .filter(file => file.endsWith('.sql'))
            .sort(); // 파일명으로 정렬하여 순서대로 실행

        logger.info(`${migrationFiles.length}개의 마이그레이션 파일 발견`);

        for (const file of migrationFiles) {
            const filePath = path.join(migrationsDir, file);
            const sql = fs.readFileSync(filePath, 'utf8');

            // SQL을 세미콜론으로 분리하여 각각 실행
            const statements = sql
                .split(';')
                .map(stmt => stmt.trim())
                .filter(stmt => stmt.length > 0);

            logger.info(`마이그레이션 실행 중: ${file}`);

            for (const statement of statements) {
                try {
                    await DatabaseManager.run(statement);
                } catch (error) {
                    // 이미 존재하는 테이블/컬럼 오류는 무시
                    if (!error.message.includes('already exists') &&
                        !error.message.includes('duplicate column name')) {
                        throw error;
                    }
                    logger.warn(`마이그레이션 경고 (무시됨): ${error.message}`);
                }
            }

            logger.info(`마이그레이션 완료: ${file}`);
        }

        logger.info('모든 마이그레이션 완료!');

    } catch (error) {
        logger.error('마이그레이션 실패:', error);
        process.exit(1);
    } finally {
        if (!reuseConnection) {
            await DatabaseManager.close();
        }
    }
}

// 스크립트 실행
if (require.main === module) {
    (async () => {
        try {
            await runMigrations();
            logger.info('✅ 마이그레이션 스크립트 성공적으로 완료');
            process.exit(0);
        } catch (error) {
            logger.error('❌ 마이그레이션 스크립트 실패:', error);
            process.exit(1);
        }
    })();
}

module.exports = { runMigrations };
