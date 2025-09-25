# Way3 게임 통합 어드민 관리 시스템 설계서

## 🏗️ 시스템 아키텍처 개요

### 현재 상황 분석
- **백엔드**: 완전히 구현됨 ✅
- **데이터베이스**: 모든 테이블과 관계 구성 완료 ✅
- **API 엔드포인트**: 모든 CRUD 작업 지원 ✅
- **파일 관리**: 로컬 저장 시스템 구현 ✅
- **프론트엔드**: 어드민 UI 누락 ❌

### 설계 목표
1. **직관적인 관리 인터페이스** 제공
2. **상인 미디어 자산** (이미지/GIF) 통합 관리
3. **퀘스트/스킬** 쉬운 생성 및 편집
4. **실시간 게임 데이터** 모니터링

---

## 📱 프론트엔드 어드민 대시보드 설계

### 1. 메인 대시보드 (`/admin`)
```
┌─────────────────────────────────────────────┐
│  Way3 Game Admin Dashboard                  │
├─────────────┬─────────────┬─────────────────┤
│   퀘스트     │    스킬     │     상인        │
│  (Quests)   │  (Skills)   │  (Merchants)    │
├─────────────┼─────────────┼─────────────────┤
│   플레이어   │   미디어    │    모니터링     │
│ (Players)   │  (Media)    │ (Monitoring)    │
└─────────────┴─────────────┴─────────────────┘
```

### 2. 상인 관리 페이지 (`/admin/merchants`)
```
┌─────────────────────────────────────────────┐
│  상인 목록                         [+새상인] │
├─────────────────────────────────────────────┤
│ ID  │ 이름      │ 타입    │ 지역  │ 미디어  │
├─────┼──────────┼────────┼──────┼────────┤
│ M01 │ 김상인    │ 도매업  │ 강남  │ 3개    │
│ M02 │ 박상인    │ 소매업  │ 홍대  │ 5개    │
└─────┴──────────┴────────┴──────┴────────┘
```

### 3. 미디어 관리 페이지 (`/admin/media`)
```
┌─────────────────────────────────────────────┐
│  상인 미디어 관리                           │
├─────────────────────────────────────────────┤
│  상인 선택: [김상인 ▼]                      │
├─────────────────────────────────────────────┤
│  얼굴 이미지                                │
│  ┌─────────┐ ┌─────────┐ ┌─────────┐       │
│  │  기본    │  행복    │  화남    │ [+추가]│
│  │ [IMG]   │ [IMG]   │ [IMG]   │       │
│  └─────────┘ └─────────┘ └─────────┘       │
├─────────────────────────────────────────────┤
│  애니메이션 GIF                             │
│  ┌─────────┐ ┌─────────┐                   │
│  │  대화중  │  거래완료 │              [+추가]│
│  │ [GIF]   │ [GIF]   │                   │
│  └─────────┘ └─────────┘                   │
└─────────────────────────────────────────────┘
```

---

## 🗂️ 파일 저장 시스템 설계

### 디렉토리 구조
```
/uploads/
├── merchants/
│   ├── images/
│   │   ├── m001_happy.jpg
│   │   ├── m001_sad.jpg
│   │   └── m001_neutral.jpg
│   ├── gifs/
│   │   ├── m001_talking.gif
│   │   ├── m001_celebrating.gif
│   │   └── m001_idle.gif
│   └── thumbnails/
│       ├── m001_happy_thumb.jpg
│       └── m001_talking_thumb.jpg
├── quests/
│   └── icons/
└── skills/
    └── icons/
```

### 파일 명명 규칙
```
이미지: {merchant_id}_{emotion}_{timestamp}.{ext}
GIF:   {merchant_id}_{animation}_{timestamp}.{ext}
썸네일: {original_name}_thumb.{ext}
```

### 지원 파일 형식
- **이미지**: JPG, PNG, WEBP (최대 2MB)
- **GIF**: GIF, WEBP (최대 5MB)
- **자동 최적화**: 썸네일 생성, 파일 압축

---

## 🔧 기술 스택 및 구현 방식

### 프론트엔드 옵션

#### 옵션 1: 서버사이드 렌더링 (추천)
```javascript
// Express + EJS/Handlebars
// 장점: 빠른 개발, 기존 코드와 통합 용이
// 현재 media.js에서 이미 HTML 생성 중

app.get('/admin', (req, res) => {
  res.render('admin/dashboard', {
    title: 'Way3 Admin Dashboard'
  });
});
```

#### 옵션 2: React SPA
```javascript
// React + Vite + Tailwind CSS
// 장점: 더 나은 UX, 현대적 UI
// 단점: 개발 시간 더 필요

const AdminDashboard = () => {
  return (
    <div className="admin-container">
      <Dashboard />
    </div>
  );
};
```

### 백엔드 API 확장
```javascript
// 상인 관리 API 추가
router.get('/api/merchants', MerchantController.list);
router.post('/api/merchants', MerchantController.create);
router.put('/api/merchants/:id', MerchantController.update);
router.delete('/api/merchants/:id', MerchantController.delete);

// 미디어 업로드 API (이미 구현됨)
router.post('/api/media/upload', uploadSingle, MediaController.upload);
router.delete('/api/media/:id', MediaController.delete);
```

---

## 🎨 UI/UX 설계 원칙

### 1. 직관적인 네비게이션
- 좌측 사이드바: 주요 메뉴
- 브레드크럼: 현재 위치 표시
- 검색/필터: 빠른 데이터 접근

### 2. 효율적인 데이터 관리
- **일괄 작업**: 여러 항목 동시 수정
- **드래그 앤 드롭**: 파일 업로드
- **인라인 편집**: 클릭으로 바로 수정
- **실시간 미리보기**: 변경사항 즉시 확인

### 3. 반응형 디자인
- 데스크톱 우선 (어드민 특성상)
- 태블릿에서도 사용 가능
- 모바일 기본 기능 지원

### 4. 성능 최적화
- **이미지 레이지 로딩**: 대용량 미디어 처리
- **페이지네이션**: 대량 데이터 효율적 표시
- **캐싱**: 자주 사용되는 데이터 캐시

---

## 🔐 보안 및 권한 관리

### 인증 시스템
```javascript
// 이미 구현된 adminAuth.js 활용
const AdminAuth = require('../middleware/adminAuth');

// 권한 레벨 정의
const ADMIN_ROLES = {
  SUPER_ADMIN: 'super_admin',    // 모든 권한
  CONTENT_ADMIN: 'content_admin', // 퀘스트/스킬/상인 관리
  MEDIA_ADMIN: 'media_admin'      // 미디어 관리만
};
```

### 파일 업로드 보안
- **파일 타입 검증**: MIME 타입 + 확장자
- **파일 크기 제한**: 이미지 2MB, GIF 5MB
- **바이러스 스캔**: 업로드 파일 검사
- **경로 보안**: 디렉토리 트래버설 방지

---

## 📊 데이터베이스 최적화

### 추가 인덱스 생성
```sql
-- 상인 검색 최적화
CREATE INDEX IF NOT EXISTS idx_merchants_name_type ON merchants(name, type);
CREATE INDEX IF NOT EXISTS idx_merchants_district ON merchants(district);

-- 미디어 검색 최적화
CREATE INDEX IF NOT EXISTS idx_merchant_media_merchant_type ON merchant_media(merchant_id, media_type);
CREATE INDEX IF NOT EXISTS idx_merchant_media_active ON merchant_media(is_active);
```

### 캐싱 전략
```javascript
// Redis 또는 메모리 캐시 활용
const cache = new Map();

// 자주 조회되는 데이터 캐싱
const getCachedMerchants = async () => {
  if (cache.has('merchants')) {
    return cache.get('merchants');
  }

  const merchants = await db.all('SELECT * FROM merchants WHERE is_active = 1');
  cache.set('merchants', merchants, { ttl: 300 }); // 5분
  return merchants;
};
```

---

## 🚀 구현 로드맵

### Phase 1: 기본 어드민 인터페이스 (1주)
1. **메인 대시보드** 페이지 생성
2. **상인 관리** CRUD 인터페이스
3. **기본 미디어 업로드** 기능
4. **퀘스트/스킬 목록** 보기

### Phase 2: 고급 미디어 관리 (1주)
1. **드래그 앤 드롭** 파일 업로드
2. **이미지 크롭/리사이즈** 도구
3. **미디어 미리보기** 및 관리
4. **감정별 미디어** 분류 시스템

### Phase 3: 고급 기능 (1주)
1. **일괄 작업** 기능
2. **데이터 가져오기/내보내기**
3. **실시간 모니터링** 대시보드
4. **권한 관리** 시스템

### Phase 4: 최적화 및 폴리시 (3일)
1. **성능 최적화**
2. **UI/UX 개선**
3. **테스팅 및 버그 수정**
4. **문서화**

---

## 💻 개발 환경 설정

### 추가 패키지 설치
```bash
# 이미지 처리
npm install sharp multer

# 프론트엔드 (SSR 방식)
npm install ejs express-validator

# 또는 React SPA 방식
npm install react react-dom vite @vitejs/plugin-react
npm install tailwindcss postcss autoprefixer
```

### 개발 스크립트 추가
```json
{
  "scripts": {
    "admin:dev": "nodemon src/server.js --watch src/routes/admin",
    "admin:build": "npm run build:frontend",
    "admin:deploy": "npm run build && pm2 restart way3-admin"
  }
}
```

---

## 🎯 예상 결과물

### 1. 관리자 경험 (Admin UX)
- **5분 내** 새로운 상인 생성 + 미디어 등록
- **원클릭** 퀘스트/스킬 활성화/비활성화
- **실시간** 게임 데이터 모니터링
- **직관적** 미디어 파일 관리

### 2. 시스템 성능
- **로딩 시간**: 페이지당 2초 이하
- **파일 업로드**: 동시 10개 파일 처리
- **데이터베이스**: 1000+ 레코드 즉시 검색
- **저장 효율성**: 자동 이미지 최적화

### 3. 유지보수성
- **모듈화된 코드**: 기능별 독립 개발
- **표준화된 API**: RESTful 설계 원칙
- **자동화된 백업**: 데이터/미디어 파일
- **로그 시스템**: 모든 관리 작업 추적

---

이 설계를 바탕으로 **서버사이드 렌더링** 방식으로 빠르게 구현하거나, **React SPA**로 더 현대적인 인터페이스를 만들 수 있습니다. 어떤 방식을 선호하시나요?