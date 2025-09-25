# Way3 어드민 시스템 구현 계획서

## 🎯 프로젝트 개요

Way3 게임의 누락된 어드민 관리 인터페이스를 복구하고, 상인 미디어 자산 관리 기능을 강화하는 통합 어드민 시스템 구현 프로젝트입니다.

### 핵심 목표
- ✅ **기존 백엔드 활용**: 이미 구현된 API와 데이터베이스 최대 활용
- 🎨 **직관적인 UI**: 관리자가 쉽게 사용할 수 있는 웹 인터페이스
- 🖼️ **미디어 관리**: 상인 얼굴 이미지/GIF 통합 관리 시스템
- ⚡ **빠른 개발**: 2-3주 내 완성 가능한 실용적 접근

---

## 🛠️ 기술 스택 결정

### 권장 기술 스택 (빠른 개발)

#### 옵션 1: 서버사이드 렌더링 (추천) ⭐
```javascript
// 프론트엔드
- Express.js (기존 서버 확장)
- EJS 템플릿 엔진
- Bootstrap 5 + Custom CSS
- Vanilla JavaScript + fetch API

// 백엔드 (기존 활용)
- Node.js + Express.js
- SQLite 데이터베이스
- Multer (파일 업로드)
- Sharp (이미지 처리)

// 개발 시간: 약 2주
// 장점: 기존 코드와 완벽 통합, 빠른 개발, 안정성
// 단점: 현대적 UX 제한
```

#### 옵션 2: React SPA (고급 UI 원할 경우)
```javascript
// 프론트엔드
- React 18 + Vite
- Tailwind CSS
- React Query (서버 상태 관리)
- React Hook Form (폼 관리)

// 개발 시간: 약 3주
// 장점: 현대적 UX, 뛰어난 사용성
// 단점: 추가 개발 시간 필요
```

### 최종 권장사항
**서버사이드 렌더링(Option 1)**을 추천합니다. 이유:
- 기존 media.js에서 이미 HTML을 생성하고 있어 확장 용이
- 빠른 개발과 배포 가능
- 어드민 시스템 특성상 복잡한 상호작용보다는 안정성과 기능성이 중요

---

## 📅 구현 로드맵 (총 3주)

### Phase 1: 기본 인프라 구축 (1주차)

#### Day 1-2: 프로젝트 설정
```bash
# 필요 패키지 설치
npm install ejs express-validator bootstrap
npm install sharp multer --save
npm install nodemon --save-dev

# 디렉토리 구조 생성
mkdir -p src/views/admin/{layouts,partials,pages}
mkdir -p public/admin/{css,js,images}
mkdir -p uploads/merchants/{images,animations,thumbnails}
```

**📋 주요 작업:**
- [x] 기존 백엔드 분석 완료
- [ ] 프론트엔드 템플릿 구조 설정
- [ ] Bootstrap 5 + 커스텀 테마 적용
- [ ] 기본 레이아웃 및 네비게이션 구축

#### Day 3-4: 메인 대시보드
```javascript
// src/views/admin/pages/dashboard.ejs
// 구현 기능:
- 전체 통계 요약 (플레이어, 상인, 퀘스트, 스킬 수)
- 최근 활동 로그
- 시스템 상태 모니터링
- 빠른 액션 버튼들
```

#### Day 5-7: 상인 관리 페이지
```javascript
// src/views/admin/pages/merchants/
// 구현 기능:
- 상인 목록 보기 (페이지네이션, 검색, 필터)
- 상인 상세 정보 모달
- 상인 생성/편집 폼
- 상인 활성화/비활성화
- 벌크 작업 (일괄 수정/삭제)
```

**🎯 Week 1 목표:**
- 기본 어드민 인터페이스 동작
- 상인 CRUD 완전 기능
- 반응형 디자인 적용

### Phase 2: 미디어 관리 시스템 (2주차)

#### Day 8-10: 미디어 업로드 시스템
```javascript
// 구현 기능:
- 드래그 앤 드롭 파일 업로드
- 실시간 업로드 진행률
- 이미지 미리보기
- 파일 유효성 검사
- 자동 썸네일 생성
```

**핵심 구현 파일:**
```javascript
// src/services/MerchantMediaProcessor.js
class MerchantMediaProcessor {
  async processImage(file, merchantId, emotion) {
    // 1. 파일 해시 생성 (중복 방지)
    // 2. 이미지 최적화 (Sharp 사용)
    // 3. 썸네일 생성
    // 4. 데이터베이스 저장
  }

  async processAnimation(file, merchantId, animationType) {
    // GIF 처리 및 첫 프레임 썸네일 생성
  }
}
```

#### Day 11-12: 미디어 관리 인터페이스
```javascript
// src/views/admin/pages/media/
// 구현 기능:
- 상인별 미디어 갤러리 뷰
- 감정/상황별 미디어 분류
- 미디어 메타데이터 편집
- 미디어 교체/삭제
- 일괄 미디어 관리
```

#### Day 13-14: 미디어 최적화 및 관리 도구
```javascript
// 구현 기능:
- 미디어 사용량 통계
- 중복 파일 탐지 및 정리
- 자동 백업 시스템
- 저장공간 모니터링
- 미사용 파일 정리 도구
```

**🎯 Week 2 목표:**
- 완전한 미디어 업로드/관리 시스템
- 자동 최적화 파이프라인
- 미디어 분석 및 통계 기능

### Phase 3: 퀘스트/스킬 관리 및 고급 기능 (3주차)

#### Day 15-16: 퀘스트 관리 복구
```javascript
// src/views/admin/pages/quests/
// 기존 backend/admin/quests.js 활용하여 구현:
- 퀘스트 목록 및 상세 보기
- 퀘스트 생성/편집 폼 (복잡한 JSON 구조 처리)
- 퀘스트 활성화/비활성화
- 퀘스트 통계 및 완료율 분석
```

#### Day 17-18: 스킬 관리 복구
```javascript
// src/views/admin/pages/skills/
// 기존 backend/admin/skills.js 활용:
- 스킬 트리 시각화
- 스킬 템플릿 생성/편집
- 스킬 밸런싱 도구
- 플레이어별 스킬 통계
```

#### Day 19-20: 고급 기능 및 시스템 통합
```javascript
// 구현 기능:
- 데이터 가져오기/내보내기 (JSON/CSV)
- 실시간 모니터링 대시보드
- 플레이어 관리 도구
- 권한 관리 시스템
- 시스템 로그 뷰어
```

#### Day 21: 테스팅, 최적화, 배포
- 전체 시스템 테스트
- 성능 최적화
- 문서화 완료
- 프로덕션 배포 준비

**🎯 Week 3 목표:**
- 모든 관리 기능 완전 복구
- 고급 분석 및 모니터링 도구
- 프로덕션 준비 완료

---

## 📁 프로젝트 구조

### 디렉토리 구조 설계
```
theway_server/
├── src/
│   ├── views/admin/           # EJS 템플릿
│   │   ├── layouts/
│   │   │   ├── main.ejs      # 기본 레이아웃
│   │   │   └── auth.ejs      # 인증 페이지 레이아웃
│   │   ├── partials/
│   │   │   ├── header.ejs    # 상단 네비게이션
│   │   │   ├── sidebar.ejs   # 좌측 메뉴
│   │   │   ├── footer.ejs    # 하단
│   │   │   └── modals/       # 재사용 모달들
│   │   └── pages/
│   │       ├── dashboard.ejs
│   │       ├── merchants/
│   │       ├── media/
│   │       ├── quests/
│   │       ├── skills/
│   │       └── players/
│   ├── controllers/
│   │   └── admin/
│   │       ├── DashboardController.js
│   │       ├── MerchantController.js
│   │       ├── MediaController.js (기존 확장)
│   │       ├── QuestController.js (기존 연동)
│   │       └── SkillController.js (기존 연동)
│   └── services/admin/
│       ├── MerchantMediaProcessor.js
│       ├── MediaOptimizer.js
│       └── AdminAnalytics.js
├── public/admin/             # 정적 파일
│   ├── css/
│   │   ├── admin.css        # 커스텀 스타일
│   │   └── themes/
│   ├── js/
│   │   ├── admin.js         # 공통 JavaScript
│   │   ├── media-upload.js  # 파일 업로드 처리
│   │   └── dashboard.js     # 대시보드 기능
│   └── images/
│       └── admin/           # 어드민 전용 이미지
└── uploads/merchants/       # 미디어 파일 저장
    ├── images/
    ├── animations/
    └── thumbnails/
```

### 코드 스타일 및 규칙
```javascript
// 1. 파일명 규칙
// Controllers: PascalCase (MerchantController.js)
// Views: kebab-case (merchant-list.ejs)
// Services: PascalCase (MediaProcessor.js)

// 2. 라우트 규칙
// GET /admin - 대시보드
// GET /admin/merchants - 상인 목록
// GET /admin/media - 미디어 관리
// POST /admin/api/* - API 엔드포인트

// 3. CSS 클래스명 규칙
// BEM 방법론 적용
.admin-dashboard {}
.admin-dashboard__header {}
.admin-dashboard__content {}
.admin-dashboard__content--loading {}
```

---

## 🔧 핵심 구현 가이드

### 1. 메인 레이아웃 템플릿
```html
<!-- src/views/admin/layouts/main.ejs -->
<!DOCTYPE html>
<html lang="ko">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title><%- title %> - Way3 Admin</title>

    <!-- Bootstrap 5 CSS -->
    <link href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.0/dist/css/bootstrap.min.css" rel="stylesheet">
    <!-- Bootstrap Icons -->
    <link href="https://cdn.jsdelivr.net/npm/bootstrap-icons@1.10.0/font/bootstrap-icons.css" rel="stylesheet">
    <!-- Custom Admin CSS -->
    <link href="/admin/css/admin.css" rel="stylesheet">

    <%- typeof additionalCSS !== 'undefined' ? additionalCSS : '' %>
</head>
<body class="admin-body">
    <div class="admin-wrapper">
        <!-- Sidebar -->
        <%- include('../partials/sidebar') %>

        <!-- Main Content -->
        <div class="admin-content">
            <!-- Header -->
            <%- include('../partials/header') %>

            <!-- Page Content -->
            <main class="admin-main">
                <%- body %>
            </main>

            <!-- Footer -->
            <%- include('../partials/footer') %>
        </div>
    </div>

    <!-- Modals Container -->
    <div id="modals-container"></div>

    <!-- Scripts -->
    <script src="https://cdn.jsdelivr.net/npm/bootstrap@5.3.0/dist/js/bootstrap.bundle.min.js"></script>
    <script src="/admin/js/admin.js"></script>
    <%- typeof additionalJS !== 'undefined' ? additionalJS : '' %>
</body>
</html>
```

### 2. 드래그 앤 드롭 파일 업로드
```javascript
// public/admin/js/media-upload.js
class MediaUploader {
    constructor(containerId, options = {}) {
        this.container = document.getElementById(containerId);
        this.options = {
            maxFiles: 10,
            maxFileSize: 5 * 1024 * 1024, // 5MB
            acceptedTypes: ['image/jpeg', 'image/png', 'image/webp', 'image/gif'],
            ...options
        };

        this.init();
    }

    init() {
        this.createUploadArea();
        this.bindEvents();
    }

    createUploadArea() {
        this.container.innerHTML = `
            <div class="upload-area" id="uploadArea">
                <div class="upload-content">
                    <i class="bi bi-cloud-upload fs-1 text-muted"></i>
                    <h5>파일을 여기로 드래그하거나 클릭하여 선택</h5>
                    <p class="text-muted">최대 ${this.options.maxFiles}개 파일, ${this.formatFileSize(this.options.maxFileSize)} 이하</p>
                    <input type="file" id="fileInput" multiple accept="${this.options.acceptedTypes.join(',')}" hidden>
                    <button type="button" class="btn btn-primary" onclick="document.getElementById('fileInput').click()">
                        파일 선택
                    </button>
                </div>
            </div>
            <div class="upload-progress" id="uploadProgress" style="display: none;"></div>
        `;
    }

    bindEvents() {
        const uploadArea = this.container.querySelector('#uploadArea');
        const fileInput = this.container.querySelector('#fileInput');

        // 드래그 앤 드롭 이벤트
        uploadArea.addEventListener('dragenter', this.handleDragEnter.bind(this));
        uploadArea.addEventListener('dragover', this.handleDragOver.bind(this));
        uploadArea.addEventListener('dragleave', this.handleDragLeave.bind(this));
        uploadArea.addEventListener('drop', this.handleDrop.bind(this));

        // 파일 선택 이벤트
        fileInput.addEventListener('change', this.handleFileSelect.bind(this));
    }

    async uploadFiles(files, merchantId, emotion) {
        const formData = new FormData();
        formData.append('merchantId', merchantId);
        formData.append('emotion', emotion);

        Array.from(files).forEach(file => {
            formData.append('files', file);
        });

        try {
            const response = await fetch(`/admin/api/merchants/${merchantId}/media`, {
                method: 'POST',
                body: formData,
                onUploadProgress: this.handleUploadProgress.bind(this)
            });

            if (response.ok) {
                const result = await response.json();
                this.onUploadSuccess(result);
            } else {
                throw new Error('Upload failed');
            }
        } catch (error) {
            this.onUploadError(error);
        }
    }

    formatFileSize(bytes) {
        if (bytes === 0) return '0 Bytes';
        const k = 1024;
        const sizes = ['Bytes', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    }
}

// 사용 예시
document.addEventListener('DOMContentLoaded', function() {
    const uploader = new MediaUploader('mediaUploadContainer', {
        onUploadSuccess: function(result) {
            // 업로드 성공 처리
            refreshMediaGallery();
            showToast('파일이 성공적으로 업로드되었습니다.', 'success');
        },
        onUploadError: function(error) {
            showToast('업로드 중 오류가 발생했습니다: ' + error.message, 'error');
        }
    });
});
```

### 3. 실시간 데이터 테이블
```javascript
// public/admin/js/data-table.js
class AdminDataTable {
    constructor(tableId, options = {}) {
        this.table = document.getElementById(tableId);
        this.options = {
            apiEndpoint: '',
            columns: [],
            pageSize: 20,
            searchable: true,
            sortable: true,
            ...options
        };

        this.currentPage = 1;
        this.currentSort = null;
        this.currentSearch = '';

        this.init();
    }

    init() {
        this.createTableHeader();
        this.createTableBody();
        this.createPagination();
        this.bindEvents();
        this.loadData();
    }

    async loadData() {
        try {
            const params = new URLSearchParams({
                page: this.currentPage,
                limit: this.options.pageSize,
                search: this.currentSearch,
                ...(this.currentSort && {
                    sort: this.currentSort.column,
                    order: this.currentSort.direction
                })
            });

            const response = await fetch(`${this.options.apiEndpoint}?${params}`);
            const data = await response.json();

            if (data.success) {
                this.renderTableBody(data.data);
                this.updatePagination(data.data.pagination);
            }
        } catch (error) {
            console.error('데이터 로딩 실패:', error);
            this.showError('데이터를 불러오는 중 오류가 발생했습니다.');
        }
    }

    renderTableBody(data) {
        const tbody = this.table.querySelector('tbody');
        tbody.innerHTML = '';

        data.items.forEach(item => {
            const row = document.createElement('tr');
            row.innerHTML = this.options.columns.map(column => {
                if (typeof column.render === 'function') {
                    return `<td>${column.render(item[column.key], item)}</td>`;
                } else {
                    return `<td>${item[column.key] || '-'}</td>`;
                }
            }).join('');

            tbody.appendChild(row);
        });
    }

    // 검색, 정렬, 페이지네이션 등 추가 메서드들...
}

// 사용 예시
const merchantsTable = new AdminDataTable('merchantsTable', {
    apiEndpoint: '/admin/api/merchants',
    columns: [
        { key: 'id', title: 'ID', sortable: true },
        { key: 'name', title: '이름', sortable: true },
        { key: 'type', title: '타입', sortable: true },
        { key: 'district', title: '지역', sortable: true },
        {
            key: 'isActive',
            title: '상태',
            render: (value) => value ?
                '<span class="badge bg-success">활성</span>' :
                '<span class="badge bg-secondary">비활성</span>'
        },
        {
            key: 'actions',
            title: '작업',
            render: (value, item) => `
                <button class="btn btn-sm btn-outline-primary" onclick="editMerchant('${item.id}')">
                    <i class="bi bi-pencil"></i>
                </button>
                <button class="btn btn-sm btn-outline-danger" onclick="deleteMerchant('${item.id}')">
                    <i class="bi bi-trash"></i>
                </button>
            `
        }
    ]
});
```

---

## 🚀 배포 및 운영

### 개발 환경 설정
```bash
# .env 파일 설정
NODE_ENV=development
PORT=3000
DB_PATH=./data/way_game.sqlite

# 관리자 계정
ADMIN_USERNAME=admin
ADMIN_PASSWORD=your_secure_password
JWT_SECRET=your_jwt_secret

# 파일 업로드 설정
UPLOAD_MAX_SIZE=5242880  # 5MB
UPLOAD_PATH=./uploads
```

### 프로덕션 배포
```bash
# PM2를 사용한 프로덕션 배포
npm install -g pm2

# ecosystem.config.js 생성
module.exports = {
  apps: [{
    name: 'way3-admin',
    script: './src/server.js',
    instances: 1,
    autorestart: true,
    watch: false,
    max_memory_restart: '1G',
    env: {
      NODE_ENV: 'production',
      PORT: 3000
    }
  }]
};

# 배포 실행
pm2 start ecosystem.config.js
pm2 save
pm2 startup
```

### 백업 전략
```bash
# 자동 백업 스크립트 (backup.sh)
#!/bin/bash
DATE=$(date +%Y%m%d_%H%M%S)
BACKUP_DIR="./backups/$DATE"

# 데이터베이스 백업
mkdir -p "$BACKUP_DIR"
cp ./data/way_game.sqlite "$BACKUP_DIR/"

# 미디어 파일 백업
tar -czf "$BACKUP_DIR/uploads.tar.gz" ./uploads/

# 7일 이상된 백업 파일 삭제
find ./backups -type d -mtime +7 -exec rm -rf {} \;

# 크론탭에 등록 (매일 새벽 2시)
# 0 2 * * * /path/to/backup.sh
```

---

## 📊 성능 최적화 및 모니터링

### 성능 최적화 체크리스트
```javascript
// 1. 이미지 최적화
const optimizeImage = async (inputPath, outputPath, options = {}) => {
    await sharp(inputPath)
        .webp({
            quality: options.quality || 80,
            effort: 6
        })
        .resize(options.width, options.height, {
            fit: 'cover',
            withoutEnlargement: true
        })
        .toFile(outputPath);
};

// 2. 데이터베이스 쿼리 최적화
// 인덱스 추가
const optimizeDatabase = async () => {
    await db.run('CREATE INDEX IF NOT EXISTS idx_merchants_type_active ON merchants(type, is_active)');
    await db.run('CREATE INDEX IF NOT EXISTS idx_media_merchant_emotion ON merchant_media(merchant_id, emotion)');
    await db.run('CREATE INDEX IF NOT EXISTS idx_quests_category_level ON quest_templates(category, level_requirement)');
};

// 3. 캐싱 전략
const cache = new Map();
const CACHE_TTL = 5 * 60 * 1000; // 5분

const getCachedData = async (key, fetchFn) => {
    const cached = cache.get(key);
    if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
        return cached.data;
    }

    const data = await fetchFn();
    cache.set(key, { data, timestamp: Date.now() });
    return data;
};
```

### 모니터링 설정
```javascript
// src/middleware/monitoring.js
const monitoringMiddleware = (req, res, next) => {
    const startTime = process.hrtime();

    res.on('finish', () => {
        const [seconds, nanoseconds] = process.hrtime(startTime);
        const responseTime = seconds * 1000 + nanoseconds / 1000000;

        // 로그 기록
        logger.info({
            method: req.method,
            url: req.url,
            statusCode: res.statusCode,
            responseTime: `${responseTime.toFixed(2)}ms`,
            userAgent: req.get('User-Agent')
        });

        // 성능 메트릭 수집
        if (responseTime > 1000) { // 1초 이상 걸린 요청
            logger.warn(`Slow request: ${req.method} ${req.url} took ${responseTime}ms`);
        }
    });

    next();
};
```

---

## ✅ 최종 체크리스트

### 개발 완료 기준
- [ ] **대시보드**: 전체 통계 및 시스템 상태 표시
- [ ] **상인 관리**: CRUD + 검색/필터 + 일괄 작업
- [ ] **미디어 관리**: 업로드 + 분류 + 최적화 + 통계
- [ ] **퀘스트 관리**: 기존 API 연동 + UI 구축
- [ ] **스킬 관리**: 기존 API 연동 + 트리 시각화
- [ ] **플레이어 관리**: 목록 조회 + 상세 정보 + 데이터 수정
- [ ] **시스템 모니터링**: 실시간 로그 + 성능 메트릭
- [ ] **권한 관리**: 어드민 로그인 + 권한별 접근 제어
- [ ] **반응형 디자인**: 모바일/태블릿 호환
- [ ] **성능 최적화**: 이미지 압축 + 쿼리 최적화 + 캐싱

### 품질 보증
- [ ] **브라우저 호환성**: Chrome, Firefox, Safari, Edge
- [ ] **보안 검사**: XSS 방지, CSRF 보호, 파일 업로드 보안
- [ ] **성능 테스트**: 페이지 로딩 2초 이하, 파일 업로드 안정성
- [ ] **사용성 테스트**: 직관적인 UI/UX, 오류 메시지 명확성
- [ ] **문서화**: API 문서, 사용자 매뉴얼, 운영 가이드

### 배포 준비
- [ ] **환경 변수**: 프로덕션 설정 검증
- [ ] **백업 시스템**: 데이터베이스 + 미디어 파일 백업
- [ ] **모니터링**: 에러 트래킹, 성능 모니터링 설정
- [ ] **SSL 인증서**: HTTPS 적용 (프로덕션)
- [ ] **액세스 로그**: 관리 작업 이력 추적

---

## 🎉 기대 효과

### 관리 효율성 향상
- **상인 생성 시간**: 기존 DB 직접 조작 → **5분 내 GUI로 완료**
- **미디어 관리**: 수동 파일 업로드 → **드래그 앤 드롭으로 즉시 업로드**
- **퀘스트 관리**: JSON 직접 편집 → **폼 기반 직관적 편집**
- **데이터 모니터링**: 로그 파일 확인 → **실시간 대시보드**

### 게임 콘텐츠 품질 향상
- **상인 개성화**: 감정별 얼굴 표정으로 몰입감 증대
- **애니메이션 GIF**: 상호작용 시 생동감 있는 움직임
- **컨텐츠 관리**: 퀘스트/스킬 밸런싱 데이터 기반 조정
- **빠른 업데이트**: 새로운 상인/퀘스트 신속한 추가

### 운영 안정성
- **자동 백업**: 데이터 손실 방지
- **파일 최적화**: 저장공간 효율성
- **모니터링**: 시스템 이상 조기 감지
- **권한 관리**: 안전한 관리자 접근 제어

---

이 구현 계획을 따라 진행하면 **2-3주 내에** 완전히 기능하는 어드민 시스템을 구축할 수 있습니다. 특히 **1단계(서버사이드 렌더링)** 접근 방식으로 빠르고 안정적인 결과물을 얻을 수 있습니다.