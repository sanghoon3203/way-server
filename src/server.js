// 📁 src/server.js - Way Game Server 진입점
require('dotenv').config();
const app = require('./app');
const http = require('http');
const DatabaseManager = require('./database/DatabaseManager');
const logger = require('./config/logger');
const metricsCollector = require('./utils/MetricsCollector');
const { runMigrations } = require('./database/migrate');
const s3Backup = require('./services/S3BackupService');

console.info('[ENV CHECK] JWT_SECRET exists:', !!process.env.JWT_SECRET);
console.info('[ENV CHECK] JWT_REFRESH_SECRET exists:', !!process.env.JWT_REFRESH_SECRET);

const PORT = process.env.PORT || 3000;

// HTTP 서버 생성
const server = http.createServer(app);

// 데이터베이스 초기화 및 서버 시작
async function startServer() {
    try {
        // S3에서 DB 복원 시도 (데이터베이스 초기화 전)
        const restored = await s3Backup.restore();
        if (restored) {
            logger.info('S3에서 데이터베이스 복원 완료');
        }

        // 데이터베이스 연결 및 테이블 생성
        await DatabaseManager.initialize();
        logger.info('데이터베이스 초기화 완료');

        await runMigrations({ reuseConnection: true });

        const { seedDatabase } = require('./database/seed');

        const seededTables = await seedDatabase({ reuseConnection: true });
        if (seededTables.length > 0) {
            logger.info(`자동 시드 완료: ${seededTables.join(', ')}`);
        } else {
            logger.info('자동 시드: 기존 데이터가 존재하여 작업을 건너뜁니다.');
        }

        // 환경변수로 시드 실행 제어 (강제 리시드)
        if (process.env.RUN_SEED === 'true') {
            logger.warn('RUN_SEED=true 감지: 기존 데이터 초기화 후 시드를 다시 실행합니다.');
            const forcedTables = await seedDatabase({ reuseConnection: true, force: true });
            logger.info(`강제 시드 실행 완료: ${forcedTables.join(', ')}`);
        }

        // 서버 시작
        server.listen(PORT, () => {
            logger.info(`🚀 Way Game Server 시작됨 - 포트: ${PORT}`);
            logger.info(`📱 환경: ${process.env.NODE_ENV}`);
            logger.info(`🗄️  데이터베이스: ${process.env.DB_PATH}`);

            // 메트릭 수집 시작
            metricsCollector.start();
            logger.info('📊 실시간 메트릭 수집 시작됨');

            // S3 자동 백업 시작
            s3Backup.startAutoBackup();
            logger.info('☁️  S3 자동 백업 활성화됨');

            logger.info('='.repeat(50));
        });

    } catch (error) {
        logger.error('서버 시작 실패:', error);
        process.exit(1);
    }
}

// 우아한 종료 처리
async function gracefulShutdown(signal) {
    logger.info(`${signal} 신호 받음. 서버를 종료합니다...`);

    server.close(async () => {
        metricsCollector.stop();
        await s3Backup.shutdown(); // S3에 최종 백업 후 종료
        await DatabaseManager.close();
        logger.info('서버가 정상적으로 종료되었습니다.');
        process.exit(0);
    });
}

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

// 처리되지 않은 오류 처리
process.on('unhandledRejection', (reason, promise) => {
    logger.error('Unhandled Rejection at:', promise, 'reason:', reason);
});

process.on('uncaughtException', (error) => {
    logger.error('Uncaught Exception:', error);
    process.exit(1);
});

// 서버 시작
startServer();
