// 📁 src/services/admin/MerchantMediaService.js
const fs = require('fs').promises;
const path = require('path');
const sharp = require('sharp');
const { v4: uuidv4 } = require('uuid');
const DatabaseManager = require('../../database/DatabaseManager');
const logger = require('../../config/logger');

class MerchantMediaService {
    static UPLOAD_DIR = path.join(process.cwd(), 'uploads', 'merchants');
    static ALLOWED_EMOTIONS = ['default', 'happy', 'sad', 'angry', 'surprised', 'neutral'];
    static ALLOWED_ANIMATIONS = ['idle', 'talking', 'celebrating'];

    /**
     * 디렉토리 초기화
     */
    static async initializeDirectories() {
        try {
            await fs.mkdir(this.UPLOAD_DIR, { recursive: true });
            await fs.mkdir(path.join(this.UPLOAD_DIR, 'templates'), { recursive: true });
            await fs.mkdir(path.join(this.UPLOAD_DIR, 'backup'), { recursive: true });
            logger.info('상인 미디어 디렉토리 초기화 완료');
        } catch (error) {
            logger.error('디렉토리 초기화 실패:', error);
            throw error;
        }
    }

    /**
     * 상인별 디렉토리 생성
     */
    static async createMerchantDirectories(merchantId) {
        const merchantDir = path.join(this.UPLOAD_DIR, merchantId);
        const facesDir = path.join(merchantDir, 'faces');
        const animationsDir = path.join(merchantDir, 'animations');
        const tempDir = path.join(merchantDir, 'temp');

        try {
            await fs.mkdir(merchantDir, { recursive: true });
            await fs.mkdir(facesDir, { recursive: true });
            await fs.mkdir(animationsDir, { recursive: true });
            await fs.mkdir(tempDir, { recursive: true });

            logger.info(`상인 ${merchantId} 디렉토리 생성 완료`);
            return { merchantDir, facesDir, animationsDir, tempDir };
        } catch (error) {
            logger.error('상인 디렉토리 생성 실패:', error);
            throw error;
        }
    }

    /**
     * 얼굴 이미지 업로드 및 처리
     */
    static async uploadFaceImage(merchantId, emotion, file, adminId = 'system') {
        if (!this.ALLOWED_EMOTIONS.includes(emotion)) {
            throw new Error(`지원하지 않는 감정입니다: ${emotion}`);
        }

        try {
            await this.createMerchantDirectories(merchantId);

            const fileName = `${emotion}.png`;
            const filePath = path.join(this.UPLOAD_DIR, merchantId, 'faces', fileName);
            const relativePath = `uploads/merchants/${merchantId}/faces/${fileName}`;

            // 이미지 리사이징 및 최적화 (256x256)
            await sharp(file.buffer)
                .resize(256, 256, {
                    fit: 'cover',
                    position: 'center'
                })
                .png({ quality: 90 })
                .toFile(filePath);

            // 기존 미디어 정보 확인 (업데이트 vs 새 생성)
            const existingMedia = await DatabaseManager.get(`
                SELECT id FROM merchant_media
                WHERE merchant_id = ? AND media_type = 'face_image' AND emotion = ?
            `, [merchantId, emotion]);

            let mediaId;

            if (existingMedia) {
                // 기존 미디어 업데이트
                mediaId = existingMedia.id;
                await DatabaseManager.run(`
                    UPDATE merchant_media
                    SET file_path = ?, file_name = ?, file_size = ?, mime_type = ?,
                        upload_admin_id = ?, updated_at = CURRENT_TIMESTAMP
                    WHERE id = ?
                `, [
                    relativePath,
                    fileName,
                    file.size,
                    'image/png',
                    adminId,
                    mediaId
                ]);
                logger.info(`상인 ${merchantId} 얼굴 이미지 업데이트: ${emotion}`);
            } else {
                // 새 미디어 생성
                mediaId = uuidv4();
                await DatabaseManager.run(`
                    INSERT INTO merchant_media
                    (id, merchant_id, media_type, emotion, file_path, file_name, file_size, mime_type, upload_admin_id)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
                `, [
                    mediaId,
                    merchantId,
                    'face_image',
                    emotion,
                    relativePath,
                    fileName,
                    file.size,
                    'image/png',
                    adminId
                ]);
                logger.info(`상인 ${merchantId} 얼굴 이미지 생성: ${emotion}`);
            }

            return {
                id: mediaId,
                filePath: relativePath,
                fileName,
                emotion,
                url: `/uploads/merchants/${merchantId}/faces/${fileName}` // 웹 접근 URL
            };

        } catch (error) {
            logger.error('얼굴 이미지 업로드 실패:', error);
            throw error;
        }
    }

    /**
     * 애니메이션 GIF 업로드
     */
    static async uploadAnimation(merchantId, animationType, file, adminId = 'system') {
        if (!this.ALLOWED_ANIMATIONS.includes(animationType)) {
            throw new Error(`지원하지 않는 애니메이션 타입입니다: ${animationType}`);
        }

        try {
            await this.createMerchantDirectories(merchantId);

            const fileName = `${animationType}.gif`;
            const filePath = path.join(this.UPLOAD_DIR, merchantId, 'animations', fileName);
            const relativePath = `uploads/merchants/${merchantId}/animations/${fileName}`;

            // GIF 파일 저장 (원본 유지, 최적화 없음)
            await fs.writeFile(filePath, file.buffer);

            // 기존 미디어 정보 확인
            const existingMedia = await DatabaseManager.get(`
                SELECT id FROM merchant_media
                WHERE merchant_id = ? AND media_type = 'animation_gif' AND emotion = ?
            `, [merchantId, animationType]);

            let mediaId;

            if (existingMedia) {
                // 기존 미디어 업데이트
                mediaId = existingMedia.id;
                await DatabaseManager.run(`
                    UPDATE merchant_media
                    SET file_path = ?, file_name = ?, file_size = ?, mime_type = ?,
                        upload_admin_id = ?, updated_at = CURRENT_TIMESTAMP
                    WHERE id = ?
                `, [
                    relativePath,
                    fileName,
                    file.size,
                    file.mimetype,
                    adminId,
                    mediaId
                ]);
                logger.info(`상인 ${merchantId} 애니메이션 업데이트: ${animationType}`);
            } else {
                // 새 미디어 생성
                mediaId = uuidv4();
                await DatabaseManager.run(`
                    INSERT INTO merchant_media
                    (id, merchant_id, media_type, emotion, file_path, file_name, file_size, mime_type, upload_admin_id)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
                `, [
                    mediaId,
                    merchantId,
                    'animation_gif',
                    animationType, // emotion 필드에 애니메이션 타입 저장
                    relativePath,
                    fileName,
                    file.size,
                    file.mimetype,
                    adminId
                ]);
                logger.info(`상인 ${merchantId} 애니메이션 생성: ${animationType}`);
            }

            return {
                id: mediaId,
                filePath: relativePath,
                fileName,
                animationType,
                url: `/uploads/merchants/${merchantId}/animations/${fileName}`
            };

        } catch (error) {
            logger.error('애니메이션 업로드 실패:', error);
            throw error;
        }
    }

    /**
     * 상인의 모든 미디어 조회
     */
    static async getMerchantMedia(merchantId) {
        try {
            const media = await DatabaseManager.all(`
                SELECT * FROM merchant_media
                WHERE merchant_id = ? AND is_active = 1
                ORDER BY media_type, emotion
            `, [merchantId]);

            return media.map(item => ({
                id: item.id,
                mediaType: item.media_type,
                emotion: item.emotion,
                fileName: item.file_name,
                fileSize: item.file_size,
                mimeType: item.mime_type,
                url: `/${item.file_path}`, // Express static 경로
                createdAt: item.created_at,
                updatedAt: item.updated_at
            }));

        } catch (error) {
            logger.error('상인 미디어 조회 실패:', error);
            throw error;
        }
    }

    /**
     * 특정 감정의 얼굴 이미지 조회
     */
    static async getFaceImage(merchantId, emotion) {
        try {
            const media = await DatabaseManager.get(`
                SELECT * FROM merchant_media
                WHERE merchant_id = ? AND media_type = 'face_image' AND emotion = ? AND is_active = 1
            `, [merchantId, emotion]);

            if (!media) {
                return null;
            }

            return {
                id: media.id,
                emotion: media.emotion,
                url: `/${media.file_path}`,
                fileName: media.file_name
            };

        } catch (error) {
            logger.error('얼굴 이미지 조회 실패:', error);
            throw error;
        }
    }

    /**
     * 미디어 삭제
     */
    static async deleteMedia(mediaId, adminId = 'system') {
        try {
            // 데이터베이스에서 미디어 정보 조회
            const media = await DatabaseManager.get(`
                SELECT * FROM merchant_media WHERE id = ?
            `, [mediaId]);

            if (!media) {
                throw new Error('미디어를 찾을 수 없습니다');
            }

            // 파일 삭제
            const fullPath = path.join(process.cwd(), media.file_path);
            try {
                await fs.unlink(fullPath);
                logger.info(`파일 삭제 완료: ${fullPath}`);
            } catch (fileError) {
                logger.warn(`파일 삭제 실패 (이미 없을 수 있음): ${fullPath}`);
            }

            // 데이터베이스에서 삭제 (soft delete)
            await DatabaseManager.run(`
                UPDATE merchant_media
                SET is_active = 0, updated_at = CURRENT_TIMESTAMP
                WHERE id = ?
            `, [mediaId]);

            logger.info(`미디어 삭제 완료: ${mediaId}`);
            return true;

        } catch (error) {
            logger.error('미디어 삭제 실패:', error);
            throw error;
        }
    }

    /**
     * 상인 삭제시 모든 미디어 정리
     */
    static async cleanupMerchantMedia(merchantId) {
        try {
            const merchantDir = path.join(this.UPLOAD_DIR, merchantId);

            // 디렉토리 전체 삭제
            try {
                await fs.rm(merchantDir, { recursive: true, force: true });
                logger.info(`상인 ${merchantId} 디렉토리 삭제 완료`);
            } catch (dirError) {
                logger.warn(`디렉토리 삭제 실패: ${merchantDir}`);
            }

            // 데이터베이스에서 미디어 정보 삭제
            await DatabaseManager.run(`
                UPDATE merchant_media
                SET is_active = 0, updated_at = CURRENT_TIMESTAMP
                WHERE merchant_id = ?
            `, [merchantId]);

            logger.info(`상인 ${merchantId} 미디어 정리 완료`);
            return true;

        } catch (error) {
            logger.error('상인 미디어 정리 실패:', error);
            throw error;
        }
    }

    /**
     * 미디어 통계 조회
     */
    static async getMediaStatistics() {
        try {
            const stats = await DatabaseManager.get(`
                SELECT
                    COUNT(*) as total_media,
                    COUNT(CASE WHEN media_type = 'face_image' THEN 1 END) as face_images,
                    COUNT(CASE WHEN media_type = 'animation_gif' THEN 1 END) as animations,
                    COUNT(DISTINCT merchant_id) as merchants_with_media,
                    SUM(file_size) as total_size_bytes
                FROM merchant_media
                WHERE is_active = 1
            `);

            const emotionStats = await DatabaseManager.all(`
                SELECT
                    emotion,
                    COUNT(*) as count
                FROM merchant_media
                WHERE media_type = 'face_image' AND is_active = 1
                GROUP BY emotion
                ORDER BY count DESC
            `);

            return {
                ...stats,
                total_size_mb: Math.round((stats.total_size_bytes || 0) / (1024 * 1024) * 100) / 100,
                emotion_distribution: emotionStats
            };

        } catch (error) {
            logger.error('미디어 통계 조회 실패:', error);
            throw error;
        }
    }
}

module.exports = MerchantMediaService;