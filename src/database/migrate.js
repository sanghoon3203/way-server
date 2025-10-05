// 📁 src/database/migrate.js - 데이터베이스 마이그레이션 실행
const DatabaseManager = require('./DatabaseManager');
const fs = require('fs');
const path = require('path');

async function runMigrations(options = {}) {
    const { reuseConnection = false } = options;
    let connectionOpened = false;

    try {
        console.log('📋 Migration process starting...');
        console.log(reuseConnection ? '마이그레이션 시작 (기존 연결 재사용)...' : '마이그레이션 시작...');

        if (!reuseConnection) {
            console.log('🔌 Connecting to database...');

            // Ensure data directory exists
            const dbPath = process.env.DB_PATH || './data/way_game.sqlite';
            const dataDir = path.dirname(dbPath);

            console.log(`📂 Database path: ${dbPath}`);
            console.log(`📂 Data directory: ${dataDir}`);

            if (!fs.existsSync(dataDir)) {
                console.log(`📁 Creating data directory: ${dataDir}`);
                fs.mkdirSync(dataDir, { recursive: true });
            }

            // Only connect to database, don't create tables
            // The migration SQL files will create all schema
            await DatabaseManager.connect();
            connectionOpened = true;
            console.log('✅ Database connected');
        }

        // 마이그레이션 폴더에서 SQL 파일들 찾기
        const migrationsDir = path.join(__dirname, 'migrations');
        console.log(`📂 Looking for migrations in: ${migrationsDir}`);

        if (!fs.existsSync(migrationsDir)) {
            const errorMsg = `마이그레이션 디렉터리를 찾을 수 없습니다: ${migrationsDir}`;
            console.warn(`⚠️ ${errorMsg}`);
            return;
        }

        const migrationFiles = fs.readdirSync(migrationsDir)
            .filter(file => file.endsWith('.sql'))
            .sort(); // 파일명으로 정렬하여 순서대로 실행

        console.log(`📄 Found ${migrationFiles.length} migration files`);

        for (const file of migrationFiles) {
            const filePath = path.join(migrationsDir, file);
            console.log(`\n🔄 Running migration: ${file}`);
            const sql = fs.readFileSync(filePath, 'utf8');

            // SQL을 세미콜론으로 분리하여 각각 실행
            const statements = sql
                .split(';')
                .map(stmt => stmt.trim())
                .filter(stmt => {
                    // 빈 문자열 제거
                    if (stmt.length === 0) return false;
                    // 주석만 있는 구문 제거 (-- 로 시작하거나 모든 라인이 주석인 경우)
                    const lines = stmt.split('\n').filter(line => line.trim().length > 0);
                    const nonCommentLines = lines.filter(line => !line.trim().startsWith('--'));
                    return nonCommentLines.length > 0;
                });


            for (const statement of statements) {
                try {
                    await DatabaseManager.run(statement);
                } catch (error) {
                    // 이미 존재하는 테이블/컬럼 오류, 또는 존재하지 않는 컬럼 오류는 무시
                    // (멱등성 보장: 마이그레이션을 여러 번 실행해도 안전)
                    if (!error.message.includes('already exists') &&
                        !error.message.includes('duplicate column name') &&
                        !error.message.includes('no such column')) {
                        console.error(`❌ SQL execution failed in ${file}`);
                        console.error(`Statement: ${statement.substring(0, 100)}...`);
                        throw error;
                    }
                    console.log(`⚠️ Warning (ignored): ${error.message}`);
                }
            }

            console.log(`✅ Migration completed: ${file}`);
        }

        console.log('\n🎉 All migrations completed successfully!');

    } catch (error) {
        console.error('\n❌ Migration failed with error:');
        console.error('Message:', error.message);
        console.error('Stack:', error.stack);
        throw error; // Re-throw to be caught by outer catch
    } finally {
        if (!reuseConnection && connectionOpened) {
            console.log('🔌 Closing database connection...');
            await DatabaseManager.close();
        }
    }
}

// 스크립트 실행
if (require.main === module) {
    (async () => {
        try {
            console.log('🔄 Starting migration script...');
            await runMigrations();
            console.log('✅ Migration script completed successfully');
            process.exit(0);
        } catch (error) {
            console.error('❌ Migration script failed!');
            console.error('Error details:', error);
            console.error('Stack trace:', error.stack);
            process.exit(1);
        }
    })();
}

module.exports = { runMigrations };
