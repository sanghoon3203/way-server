# Way3 상인 미디어 자산 관리 시스템

## 🎯 시스템 개요

상인들에게 개성 있는 얼굴 이미지와 애니메이션 GIF를 제공하여 게임의 몰입감을 높이는 로컬 미디어 저장 및 관리 시스템입니다.

### 핵심 기능
- **감정별 얼굴 이미지**: 행복, 슬픔, 화남, 놀람, 평온 등
- **상황별 애니메이션 GIF**: 대화 중, 거래 완료, 기다림, 축하 등
- **자동 최적화**: 썸네일 생성, 파일 압축, 포맷 변환
- **효율적인 저장**: 중복 방지, 버전 관리, 백업 시스템

---

## 📁 파일 시스템 구조

### 디렉토리 설계
```
/uploads/merchants/
├── images/                 # 정적 이미지
│   ├── portraits/         # 기본 초상화
│   ├── emotions/          # 감정별 이미지
│   └── thumbnails/        # 자동 생성된 썸네일
├── animations/            # GIF 애니메이션
│   ├── interactions/      # 상호작용 애니메이션
│   ├── idle/             # 대기 애니메이션
│   └── celebrations/      # 축하/거래완료 애니메이션
├── temp/                  # 임시 업로드 파일
└── backup/               # 백업 파일
    ├── daily/
    └── weekly/
```

### 파일 명명 규칙
```javascript
// 이미지 파일 명명
const generateImageFileName = (merchantId, mediaType, emotion, timestamp) => {
  return `${merchantId}_${mediaType}_${emotion}_${timestamp}.${extension}`;
};

// 예시:
// m001_portrait_neutral_1694123456789.jpg
// m001_emotion_happy_1694123456789.png
// m001_animation_talking_1694123456789.gif
```

### 지원 파일 형식
```javascript
const SUPPORTED_FORMATS = {
  images: {
    input: ['jpg', 'jpeg', 'png', 'webp'],
    output: 'webp', // 최적화를 위해 WebP로 변환
    maxSize: 2 * 1024 * 1024, // 2MB
    dimensions: {
      portrait: { width: 400, height: 400 },
      emotion: { width: 200, height: 200 },
      thumbnail: { width: 100, height: 100 }
    }
  },
  animations: {
    input: ['gif', 'webp'],
    output: 'gif', // GIF 유지 (호환성)
    maxSize: 5 * 1024 * 1024, // 5MB
    dimensions: {
      interaction: { width: 300, height: 300 },
      idle: { width: 200, height: 200 }
    }
  }
};
```

---

## 🗃️ 데이터베이스 스키마 확장

### 현재 스키마 (이미 구현됨)
```sql
-- 기존 merchant_media 테이블
CREATE TABLE merchant_media (
    id TEXT PRIMARY KEY,
    merchant_id TEXT NOT NULL,
    media_type TEXT NOT NULL,     -- 'face_image', 'animation_gif'
    emotion TEXT,                 -- 감정/상황 태그
    file_path TEXT NOT NULL,      -- 로컬 파일 경로
    file_size INTEGER,            -- 파일 크기 (바이트)
    mime_type TEXT,              -- MIME 타입
    dimensions TEXT,              -- JSON: {"width": 400, "height": 400}
    is_active BOOLEAN DEFAULT TRUE,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (merchant_id) REFERENCES merchants(id)
);
```

### 추가 최적화 필드 제안
```sql
-- 미디어 메타데이터 확장
ALTER TABLE merchant_media
ADD COLUMN file_hash TEXT;           -- 중복 파일 방지용 해시
ADD COLUMN thumbnail_path TEXT;       -- 썸네일 경로
ADD COLUMN original_filename TEXT;    -- 원본 파일명
ADD COLUMN usage_count INTEGER DEFAULT 0;  -- 사용 빈도 추적
ADD COLUMN last_used_at DATETIME;     -- 마지막 사용 시간

-- 인덱스 추가
CREATE INDEX idx_merchant_media_hash ON merchant_media(file_hash);
CREATE INDEX idx_merchant_media_usage ON merchant_media(usage_count DESC);
```

---

## 🔧 파일 처리 서비스 설계

### MerchantMediaProcessor 클래스
```javascript
// src/services/MerchantMediaProcessor.js
const sharp = require('sharp');
const fs = require('fs').promises;
const path = require('path');
const crypto = require('crypto');

class MerchantMediaProcessor {
  constructor() {
    this.uploadDir = './uploads/merchants';
    this.tempDir = './uploads/temp';
  }

  /**
   * 이미지 업로드 및 처리
   */
  async processImage(file, merchantId, emotion = 'neutral') {
    try {
      // 1. 파일 해시 생성 (중복 방지)
      const fileHash = await this.generateFileHash(file.buffer);

      // 2. 중복 파일 확인
      const existingFile = await this.findByHash(fileHash);
      if (existingFile) {
        return this.linkExistingFile(existingFile, merchantId, emotion);
      }

      // 3. 이미지 최적화 및 리사이징
      const processedImages = await this.optimizeImage(file, merchantId, emotion);

      // 4. 데이터베이스에 저장
      const mediaRecord = await this.saveToDatabase({
        merchantId,
        emotion,
        fileHash,
        ...processedImages
      });

      return mediaRecord;

    } catch (error) {
      logger.error('이미지 처리 실패:', error);
      throw error;
    }
  }

  /**
   * 이미지 최적화 (여러 크기 생성)
   */
  async optimizeImage(file, merchantId, emotion) {
    const timestamp = Date.now();
    const baseFileName = `${merchantId}_${emotion}_${timestamp}`;

    const results = {};

    // 원본 크기 (WebP로 변환)
    const originalPath = path.join(this.uploadDir, 'images', `${baseFileName}.webp`);
    await sharp(file.buffer)
      .webp({ quality: 80 })
      .resize(400, 400, { fit: 'cover' })
      .toFile(originalPath);
    results.originalPath = originalPath;

    // 썸네일 생성
    const thumbnailPath = path.join(this.uploadDir, 'images/thumbnails', `${baseFileName}_thumb.webp`);
    await sharp(file.buffer)
      .webp({ quality: 70 })
      .resize(100, 100, { fit: 'cover' })
      .toFile(thumbnailPath);
    results.thumbnailPath = thumbnailPath;

    // 메타데이터 추출
    const metadata = await sharp(file.buffer).metadata();
    results.dimensions = {
      width: metadata.width,
      height: metadata.height
    };

    return results;
  }

  /**
   * GIF 애니메이션 처리
   */
  async processAnimation(file, merchantId, animationType = 'idle') {
    try {
      const timestamp = Date.now();
      const fileName = `${merchantId}_${animationType}_${timestamp}.gif`;
      const filePath = path.join(this.uploadDir, 'animations', fileName);

      // GIF 크기 제한 및 최적화
      if (file.size > SUPPORTED_FORMATS.animations.maxSize) {
        throw new Error('GIF 파일 크기가 너무 큽니다 (최대 5MB)');
      }

      // 파일 저장
      await fs.writeFile(filePath, file.buffer);

      // 썸네일 생성 (첫 번째 프레임)
      const thumbnailPath = path.join(this.uploadDir, 'animations/thumbnails', `${fileName.replace('.gif', '_thumb.jpg')}`);
      await sharp(file.buffer)
        .jpeg({ quality: 80 })
        .resize(100, 100, { fit: 'cover' })
        .toFile(thumbnailPath);

      return {
        filePath,
        thumbnailPath,
        fileSize: file.size
      };

    } catch (error) {
      logger.error('GIF 처리 실패:', error);
      throw error;
    }
  }

  /**
   * 중복 파일 방지를 위한 해시 생성
   */
  async generateFileHash(buffer) {
    return crypto.createHash('sha256').update(buffer).digest('hex');
  }

  /**
   * 파일 정리 (사용하지 않는 파일 삭제)
   */
  async cleanupUnusedFiles() {
    const cutoffDate = new Date();
    cutoffDate.setMonth(cutoffDate.getMonth() - 3); // 3개월 전

    const unusedFiles = await db.all(`
      SELECT file_path, thumbnail_path
      FROM merchant_media
      WHERE last_used_at < ? OR usage_count = 0
    `, cutoffDate);

    for (const file of unusedFiles) {
      try {
        await fs.unlink(file.file_path);
        if (file.thumbnail_path) {
          await fs.unlink(file.thumbnail_path);
        }
      } catch (error) {
        logger.warn(`파일 삭제 실패: ${file.file_path}`, error);
      }
    }

    logger.info(`정리된 파일 수: ${unusedFiles.length}`);
  }
}

module.exports = MerchantMediaProcessor;
```

---

## 🎨 감정/상황별 미디어 분류 시스템

### 감정 카테고리
```javascript
const EMOTION_CATEGORIES = {
  // 기본 감정
  neutral: { name: '평온', color: '#gray', priority: 1 },
  happy: { name: '행복', color: '#green', priority: 2 },
  sad: { name: '슬픔', color: '#blue', priority: 3 },
  angry: { name: '화남', color: '#red', priority: 4 },
  surprised: { name: '놀람', color: '#yellow', priority: 5 },

  // 거래 관련
  greeting: { name: '인사', color: '#purple', priority: 6 },
  negotiating: { name: '협상 중', color: '#orange', priority: 7 },
  satisfied: { name: '만족', color: '#green', priority: 8 },
  disappointed: { name: '실망', color: '#gray', priority: 9 },

  // 특별 상황
  celebrating: { name: '축하', color: '#gold', priority: 10 },
  thinking: { name: '생각 중', color: '#blue', priority: 11 },
  busy: { name: '바쁨', color: '#red', priority: 12 }
};

const ANIMATION_CATEGORIES = {
  // 대기 상태
  idle: { name: '대기 중', duration: 'loop' },
  breathing: { name: '호흡', duration: 'loop' },

  // 상호작용
  talking: { name: '대화 중', duration: '3-5s' },
  listening: { name: '듣기', duration: '2-4s' },

  // 거래 관련
  examining: { name: '물건 살펴보기', duration: '4-6s' },
  counting_money: { name: '돈 세기', duration: '3-5s' },
  handshake: { name: '악수', duration: '2-3s' },

  // 감정 표현
  laughing: { name: '웃기', duration: '2-4s' },
  sighing: { name: '한숨', duration: '2-3s' },
  celebrating: { name: '축하하기', duration: '3-5s' }
};
```

---

## 🔄 미디어 최적화 및 CDN 전략

### 자동 최적화 파이프라인
```javascript
// 이미지 최적화 전략
const OPTIMIZATION_PIPELINE = {
  // 단계 1: 형식 변환
  formatConversion: {
    jpeg: 'webp',  // WebP로 변환하여 40% 크기 감소
    png: 'webp',
    gif: 'gif'     // GIF는 호환성을 위해 유지
  },

  // 단계 2: 크기 최적화
  resizing: {
    portrait: { width: 400, height: 400, quality: 80 },
    emotion: { width: 200, height: 200, quality: 85 },
    thumbnail: { width: 100, height: 100, quality: 70 },
    mobile: { width: 150, height: 150, quality: 75 }
  },

  // 단계 3: 압축
  compression: {
    webp: { quality: 80, effort: 6 },
    gif: { colors: 256, optimizationLevel: 3 }
  }
};

// 자동 최적화 스케줄러
class MediaOptimizer {
  async scheduleOptimization() {
    // 매일 밤 2시에 실행
    cron.schedule('0 2 * * *', async () => {
      await this.optimizeAllMedia();
      await this.generateMissingThumbnails();
      await this.cleanupTempFiles();
    });
  }

  async optimizeAllMedia() {
    const unoptimizedMedia = await db.all(`
      SELECT * FROM merchant_media
      WHERE thumbnail_path IS NULL
      OR updated_at < datetime('now', '-7 days')
    `);

    for (const media of unoptimizedMedia) {
      await this.reprocessMedia(media);
    }
  }
}
```

### 로컬 CDN 시뮬레이션
```javascript
// 정적 파일 서빙 최적화
app.use('/media', express.static('uploads', {
  maxAge: '30d',  // 30일 캐시
  etag: true,     // ETag 사용
  lastModified: true
}));

// 이미지 즉시 리사이징 (요청 시)
app.get('/media/resize/:width/:height/:filename', async (req, res) => {
  const { width, height, filename } = req.params;
  const originalPath = path.join('uploads', filename);

  // 캐시된 리사이즈 버전 확인
  const cacheKey = `${filename}_${width}x${height}`;
  const cachedPath = path.join('uploads/cache', cacheKey);

  if (await fs.exists(cachedPath)) {
    return res.sendFile(cachedPath);
  }

  // 실시간 리사이징
  const resizedBuffer = await sharp(originalPath)
    .resize(parseInt(width), parseInt(height), { fit: 'cover' })
    .webp({ quality: 80 })
    .toBuffer();

  await fs.writeFile(cachedPath, resizedBuffer);
  res.type('webp').send(resizedBuffer);
});
```

---

## 📊 사용량 추적 및 분석

### 미디어 사용량 모니터링
```javascript
// 미디어 사용량 추적
class MediaAnalytics {
  async trackUsage(mediaId, context = 'game') {
    await db.run(`
      UPDATE merchant_media
      SET usage_count = usage_count + 1,
          last_used_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `, mediaId);

    // 상세 사용 로그 기록
    await db.run(`
      INSERT INTO media_usage_logs (media_id, context, timestamp)
      VALUES (?, ?, CURRENT_TIMESTAMP)
    `, mediaId, context);
  }

  async getUsageAnalytics() {
    const analytics = await db.get(`
      SELECT
        COUNT(*) as total_media,
        AVG(usage_count) as avg_usage,
        MAX(usage_count) as max_usage,
        COUNT(CASE WHEN usage_count = 0 THEN 1 END) as unused_media,
        SUM(file_size) as total_storage_bytes
      FROM merchant_media
      WHERE is_active = 1
    `);

    const topUsedMedia = await db.all(`
      SELECT m.*, mm.merchant_name
      FROM merchant_media m
      JOIN merchants mm ON m.merchant_id = mm.id
      ORDER BY m.usage_count DESC
      LIMIT 10
    `);

    return {
      overview: analytics,
      topUsed: topUsedMedia,
      storageUsage: this.formatBytes(analytics.total_storage_bytes)
    };
  }
}
```

### 자동 백업 시스템
```javascript
// 일일 백업 스케줄러
class MediaBackupService {
  constructor() {
    this.backupDir = './uploads/backup';

    // 매일 오전 3시에 백업
    cron.schedule('0 3 * * *', () => this.performDailyBackup());

    // 매주 일요일에 전체 백업
    cron.schedule('0 4 * * 0', () => this.performWeeklyBackup());
  }

  async performDailyBackup() {
    const today = new Date().toISOString().split('T')[0];
    const backupPath = path.join(this.backupDir, 'daily', today);

    // 오늘 업데이트된 파일들만 백업
    const recentFiles = await db.all(`
      SELECT file_path, thumbnail_path
      FROM merchant_media
      WHERE DATE(updated_at) = DATE('now')
    `);

    await this.copyFiles(recentFiles, backupPath);
    logger.info(`일일 백업 완료: ${recentFiles.length}개 파일`);
  }

  async performWeeklyBackup() {
    const week = this.getWeekString();
    const backupPath = path.join(this.backupDir, 'weekly', week);

    // 전체 미디어 파일 백업
    const allFiles = await db.all(`
      SELECT file_path, thumbnail_path
      FROM merchant_media
      WHERE is_active = 1
    `);

    await this.copyFiles(allFiles, backupPath);

    // 압축하여 저장공간 절약
    await this.compressBackup(backupPath);

    logger.info(`주간 백업 완료: ${allFiles.length}개 파일`);
  }
}
```

---

## 🎮 게임 내 미디어 활용 시나리오

### 1. 상인과의 대화 시스템
```javascript
// 대화 상황에 맞는 미디어 선택
class MerchantInteractionSystem {
  async getMerchantMedia(merchantId, situation, playerReputation) {
    const baseQuery = `
      SELECT * FROM merchant_media
      WHERE merchant_id = ? AND is_active = 1
    `;

    // 상황별 미디어 선택
    let emotionFilter = '';
    switch (situation) {
      case 'greeting':
        emotionFilter = playerReputation > 50 ? 'happy' : 'neutral';
        break;
      case 'negotiating':
        emotionFilter = 'thinking';
        break;
      case 'deal_success':
        emotionFilter = 'celebrating';
        break;
      case 'deal_failed':
        emotionFilter = 'disappointed';
        break;
      default:
        emotionFilter = 'neutral';
    }

    const media = await db.get(`
      ${baseQuery} AND emotion = ?
      ORDER BY usage_count ASC  -- 덜 사용된 것 우선 (다양성)
      LIMIT 1
    `, merchantId, emotionFilter);

    // 해당 감정의 미디어가 없으면 기본 이미지 사용
    return media || await this.getDefaultMedia(merchantId);
  }
}
```

### 2. 동적 미디어 로딩
```javascript
// 게임 클라이언트에서의 미디어 로딩
class GameMediaManager {
  constructor() {
    this.mediaCache = new Map();
    this.preloadQueue = [];
  }

  // 미디어 프리로딩 (게임 시작 시)
  async preloadMerchantMedia(nearbyMerchants) {
    for (const merchant of nearbyMerchants) {
      // 기본 감정들만 미리 로딩
      const essentialEmotions = ['neutral', 'happy', 'greeting'];

      for (const emotion of essentialEmotions) {
        const mediaUrl = `/api/merchants/${merchant.id}/media/${emotion}`;
        await this.loadAndCache(mediaUrl);
      }
    }
  }

  // 적응형 품질 (네트워크 상태에 따라)
  getOptimalMediaUrl(merchantId, emotion, connectionSpeed) {
    const baseUrl = `/media/merchants/${merchantId}`;

    if (connectionSpeed === 'slow') {
      return `${baseUrl}/thumbnails/${emotion}.webp`;
    } else if (connectionSpeed === 'medium') {
      return `${baseUrl}/compressed/${emotion}.webp`;
    } else {
      return `${baseUrl}/original/${emotion}.webp`;
    }
  }
}
```

---

## 🔧 관리자 도구 인터페이스

### 미디어 업로드 컴포넌트
```javascript
// React 컴포넌트 예시
const MerchantMediaUploader = ({ merchantId }) => {
  const [dragActive, setDragActive] = useState(false);
  const [uploadProgress, setUploadProgress] = useState({});

  const handleFileUpload = async (files, emotion) => {
    const formData = new FormData();
    formData.append('merchantId', merchantId);
    formData.append('emotion', emotion);

    for (let file of files) {
      formData.append('files', file);
    }

    try {
      const response = await fetch('/admin/api/media/upload', {
        method: 'POST',
        body: formData,
        onUploadProgress: (progressEvent) => {
          const percentCompleted = Math.round(
            (progressEvent.loaded * 100) / progressEvent.total
          );
          setUploadProgress(prev => ({
            ...prev,
            [file.name]: percentCompleted
          }));
        }
      });

      if (response.ok) {
        toast.success('파일 업로드 성공!');
        refreshMediaList();
      }
    } catch (error) {
      toast.error('업로드 실패: ' + error.message);
    }
  };

  return (
    <div className="media-uploader">
      <div
        className={`drop-zone ${dragActive ? 'active' : ''}`}
        onDragEnter={handleDragEnter}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
      >
        <p>파일을 드래그하거나 클릭하여 업로드</p>
        <input
          type="file"
          multiple
          accept="image/*,.gif"
          onChange={handleFileSelect}
        />
      </div>

      {Object.keys(uploadProgress).length > 0 && (
        <div className="upload-progress">
          {Object.entries(uploadProgress).map(([filename, progress]) => (
            <div key={filename} className="progress-item">
              <span>{filename}</span>
              <div className="progress-bar">
                <div
                  className="progress-fill"
                  style={{ width: `${progress}%` }}
                />
              </div>
              <span>{progress}%</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
```

---

이 설계서를 바탕으로 상인 미디어 자산을 효율적으로 관리할 수 있는 완전한 시스템을 구축할 수 있습니다. 특히 **로컬 저장**, **자동 최적화**, **감정별 분류**가 핵심 기능입니다.