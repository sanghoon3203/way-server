// 📁 src/services/S3BackupService.js
// S3 기반 SQLite 데이터베이스 백업/복원 서비스
// EC2 시작 시 S3에서 DB 복원, 종료/주기적으로 S3에 백업

const { S3Client, GetObjectCommand, PutObjectCommand, HeadObjectCommand } = require('@aws-sdk/client-s3');
const fs = require('fs');
const path = require('path');
const logger = require('../config/logger');

class S3BackupService {
    constructor() {
        this.bucket = process.env.S3_BUCKET_NAME || 'projects-data';
        this.dbKey = process.env.S3_DB_KEY || 'way-server/way_game.sqlite';
        this.dbPath = process.env.DB_PATH || './data/way_game.sqlite';
        this.backupInterval = null;
        this.backupIntervalMs = parseInt(process.env.S3_BACKUP_INTERVAL_MS, 10) || 10 * 60 * 1000; // 기본 10분
        this.isEnabled = false;

        // S3 클라이언트 초기화
        // EC2 IAM Role이 있으면 자동 인증, 없으면 환경변수 Access Key 사용
        const clientConfig = {
            region: process.env.AWS_REGION || 'ap-northeast-2'
        };

        // Access Key가 명시적으로 설정된 경우
        if (process.env.AWS_ACCESS_KEY_ID && process.env.AWS_SECRET_ACCESS_KEY) {
            clientConfig.credentials = {
                accessKeyId: process.env.AWS_ACCESS_KEY_ID,
                secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY
            };
        }
        // 그 외에는 EC2 IAM Role / 환경 기본 인증 체인 사용

        this.s3 = new S3Client(clientConfig);
    }

    /**
     * S3에서 DB 파일 존재 여부 확인
     */
    async existsOnS3() {
        try {
            await this.s3.send(new HeadObjectCommand({
                Bucket: this.bucket,
                Key: this.dbKey
            }));
            return true;
        } catch (err) {
            if (err.name === 'NotFound' || err.$metadata?.httpStatusCode === 404) {
                return false;
            }
            throw err;
        }
    }

    /**
     * S3에서 DB 복원 (서버 시작 시 호출)
     * - S3에 백업이 있으면 다운로드
     * - 로컬에 이미 DB가 있으면 S3 버전과 비교하여 최신 것 사용
     */
    async restore() {
        try {
            const s3Exists = await this.existsOnS3();

            if (!s3Exists) {
                logger.info('[S3Backup] S3에 백업이 없습니다. 로컬 DB를 사용합니다.');
                return false;
            }

            const localExists = fs.existsSync(this.dbPath);

            if (localExists) {
                // 로컬 파일과 S3 파일의 최종 수정 시간 비교
                const localStat = fs.statSync(this.dbPath);
                const s3Head = await this.s3.send(new HeadObjectCommand({
                    Bucket: this.bucket,
                    Key: this.dbKey
                }));

                const localTime = localStat.mtimeMs;
                const s3Time = new Date(s3Head.LastModified).getTime();

                if (localTime >= s3Time) {
                    logger.info('[S3Backup] 로컬 DB가 최신입니다. S3 복원을 건너뜁니다.');
                    return false;
                }

                logger.info('[S3Backup] S3 백업이 더 최신입니다. S3에서 복원합니다.');
            }

            // S3에서 다운로드
            const response = await this.s3.send(new GetObjectCommand({
                Bucket: this.bucket,
                Key: this.dbKey
            }));

            // 데이터 디렉토리 확인
            const dataDir = path.dirname(this.dbPath);
            if (!fs.existsSync(dataDir)) {
                fs.mkdirSync(dataDir, { recursive: true });
            }

            // 스트림을 파일로 저장
            const chunks = [];
            for await (const chunk of response.Body) {
                chunks.push(chunk);
            }
            const buffer = Buffer.concat(chunks);
            fs.writeFileSync(this.dbPath, buffer);

            const sizeMB = (buffer.length / 1024 / 1024).toFixed(2);
            logger.info(`[S3Backup] S3에서 DB 복원 완료 (${sizeMB}MB)`);
            return true;

        } catch (error) {
            logger.error('[S3Backup] DB 복원 실패:', error.message);
            // 복원 실패해도 서버는 시작할 수 있도록 에러를 던지지 않음
            return false;
        }
    }

    /**
     * S3에 DB 백업 (종료 시, 주기적으로 호출)
     */
    async backup() {
        try {
            if (!fs.existsSync(this.dbPath)) {
                logger.warn('[S3Backup] 백업할 DB 파일이 없습니다.');
                return false;
            }

            const fileBuffer = fs.readFileSync(this.dbPath);

            await this.s3.send(new PutObjectCommand({
                Bucket: this.bucket,
                Key: this.dbKey,
                Body: fileBuffer,
                ContentType: 'application/x-sqlite3',
                Metadata: {
                    'backup-time': new Date().toISOString(),
                    'server-env': process.env.NODE_ENV || 'development'
                }
            }));

            const sizeMB = (fileBuffer.length / 1024 / 1024).toFixed(2);
            logger.info(`[S3Backup] S3 백업 완료 (${sizeMB}MB) → s3://${this.bucket}/${this.dbKey}`);
            return true;

        } catch (error) {
            logger.error('[S3Backup] S3 백업 실패:', error.message);
            return false;
        }
    }

    /**
     * 주기적 자동 백업 시작
     */
    startAutoBackup() {
        if (this.backupInterval) return;

        this.backupInterval = setInterval(async () => {
            await this.backup();
        }, this.backupIntervalMs);

        const minutes = Math.round(this.backupIntervalMs / 60000);
        logger.info(`[S3Backup] 자동 백업 시작 (${minutes}분 간격)`);
        this.isEnabled = true;
    }

    /**
     * 자동 백업 중지
     */
    stopAutoBackup() {
        if (this.backupInterval) {
            clearInterval(this.backupInterval);
            this.backupInterval = null;
            logger.info('[S3Backup] 자동 백업 중지됨');
        }
    }

    /**
     * 서버 종료 시 마지막 백업 수행
     */
    async shutdown() {
        this.stopAutoBackup();
        logger.info('[S3Backup] 종료 전 최종 백업 실행...');
        await this.backup();
    }
}

// 싱글톤 인스턴스
const s3BackupService = new S3BackupService();

module.exports = s3BackupService;
