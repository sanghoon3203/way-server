# Way3 어드민 API 명세서

## 🚀 API 개요

Way3 게임의 통합 어드민 관리 시스템을 위한 RESTful API 명세서입니다.

### Base URL
```
개발 환경: http://localhost:3000/admin/api
운영 환경: https://api.way3game.com/admin/api
```

### 인증 방식
```javascript
// JWT Bearer Token
Authorization: Bearer <admin_jwt_token>

// 또는 개발 환경에서는 인증 우회 가능
NODE_ENV=development
```

---

## 📊 상인 관리 API

### 1. 상인 목록 조회
```http
GET /admin/api/merchants
```

**Query Parameters:**
```javascript
{
  page: 1,                    // 페이지 번호 (기본: 1)
  limit: 20,                  // 페이지당 항목 수 (기본: 20, 최대: 100)
  search: "상인명",           // 상인명 검색
  type: "retail",             // 상인 타입 필터
  district: "gangnam",        // 지역 필터
  active: true,               // 활성 상태 필터
  sort: "created_at",         // 정렬 필드
  order: "desc"               // 정렬 순서 (asc/desc)
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "merchants": [
      {
        "id": "m001",
        "name": "김상인",
        "title": "베테랑 도매업자",
        "type": "wholesale",
        "district": "gangnam",
        "coordinate": {
          "latitude": 37.5665,
          "longitude": 126.9780
        },
        "requiredLicense": 2,
        "priceModifier": 0.85,
        "negotiationDifficulty": 3,
        "isActive": true,
        "mediaCount": 5,
        "createdAt": "2024-01-15T09:30:00Z",
        "updatedAt": "2024-01-20T14:22:00Z"
      }
    ],
    "pagination": {
      "page": 1,
      "limit": 20,
      "total": 156,
      "totalPages": 8,
      "hasNext": true,
      "hasPrev": false
    }
  }
}
```

### 2. 상인 상세 조회
```http
GET /admin/api/merchants/:merchantId
```

**Response:**
```json
{
  "success": true,
  "data": {
    "id": "m001",
    "name": "김상인",
    "title": "베테랑 도매업자",
    "type": "wholesale",
    "personality": "friendly",
    "district": "gangnam",
    "coordinate": {
      "latitude": 37.5665,
      "longitude": 126.9780
    },
    "requiredLicense": 2,
    "inventory": [
      {
        "id": "item001",
        "name": "고급 실크",
        "category": "textile",
        "basePrice": 15000,
        "stock": 50
      }
    ],
    "priceModifier": 0.85,
    "negotiationDifficulty": 3,
    "preferredItems": ["textile", "jewelry"],
    "dislikedItems": ["food"],
    "reputationRequirement": 100,
    "specialOffers": [],
    "isActive": true,
    "media": [
      {
        "id": "media001",
        "mediaType": "face_image",
        "emotion": "happy",
        "filePath": "/uploads/merchants/images/m001_happy_1694123456789.webp",
        "thumbnailPath": "/uploads/merchants/images/thumbnails/m001_happy_1694123456789_thumb.webp"
      }
    ],
    "stats": {
      "totalTransactions": 1250,
      "averageRating": 4.2,
      "lastActiveAt": "2024-01-20T14:22:00Z"
    }
  }
}
```

### 3. 상인 생성
```http
POST /admin/api/merchants
```

**Request Body:**
```json
{
  "name": "새로운 상인",
  "title": "신입 상인",
  "type": "retail",
  "personality": "neutral",
  "district": "hongdae",
  "coordinate": {
    "latitude": 37.5563,
    "longitude": 126.9233
  },
  "requiredLicense": 1,
  "priceModifier": 1.0,
  "negotiationDifficulty": 2,
  "preferredItems": ["electronics"],
  "dislikedItems": ["antique"],
  "reputationRequirement": 50,
  "inventory": [
    {
      "itemId": "item002",
      "stock": 30,
      "customPrice": 12000
    }
  ]
}
```

**Response:**
```json
{
  "success": true,
  "message": "상인이 성공적으로 생성되었습니다.",
  "data": {
    "id": "m157",
    "name": "새로운 상인",
    "createdAt": "2024-01-21T10:15:00Z"
  }
}
```

### 4. 상인 수정
```http
PUT /admin/api/merchants/:merchantId
```

### 5. 상인 삭제
```http
DELETE /admin/api/merchants/:merchantId
```

---

## 🎨 미디어 관리 API

### 1. 상인 미디어 목록 조회
```http
GET /admin/api/merchants/:merchantId/media
```

**Query Parameters:**
```javascript
{
  mediaType: "face_image",    // face_image, animation_gif
  emotion: "happy",           // 감정 필터
  active: true                // 활성 상태
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "media": [
      {
        "id": "media001",
        "merchantId": "m001",
        "mediaType": "face_image",
        "emotion": "happy",
        "filePath": "/uploads/merchants/images/m001_happy_1694123456789.webp",
        "thumbnailPath": "/uploads/merchants/images/thumbnails/m001_happy_1694123456789_thumb.webp",
        "fileSize": 156780,
        "mimeType": "image/webp",
        "dimensions": {
          "width": 400,
          "height": 400
        },
        "fileHash": "a1b2c3d4e5f6...",
        "originalFilename": "merchant_happy.jpg",
        "usageCount": 42,
        "lastUsedAt": "2024-01-20T14:22:00Z",
        "isActive": true,
        "createdAt": "2024-01-15T09:30:00Z"
      }
    ],
    "statistics": {
      "totalMedia": 12,
      "faceImages": 8,
      "animationGifs": 4,
      "totalStorageBytes": 5242880
    }
  }
}
```

### 2. 미디어 업로드
```http
POST /admin/api/merchants/:merchantId/media
```

**Content-Type:** `multipart/form-data`

**Form Fields:**
```javascript
{
  files: File[],              // 업로드할 파일들 (최대 10개)
  mediaType: "face_image",    // face_image 또는 animation_gif
  emotion: "happy",           // 감정/상황 태그
  description: "설명"         // 선택사항
}
```

**Response:**
```json
{
  "success": true,
  "message": "미디어 파일이 성공적으로 업로드되었습니다.",
  "data": {
    "uploadedFiles": [
      {
        "id": "media158",
        "originalFilename": "happy_face.jpg",
        "filePath": "/uploads/merchants/images/m001_happy_1694123456789.webp",
        "thumbnailPath": "/uploads/merchants/images/thumbnails/m001_happy_1694123456789_thumb.webp",
        "fileSize": 156780,
        "processed": true
      }
    ],
    "skippedFiles": [
      {
        "filename": "duplicate.jpg",
        "reason": "이미 동일한 파일이 존재합니다.",
        "existingId": "media001"
      }
    ]
  }
}
```

### 3. 미디어 삭제
```http
DELETE /admin/api/media/:mediaId
```

**Response:**
```json
{
  "success": true,
  "message": "미디어 파일이 삭제되었습니다.",
  "data": {
    "deletedFiles": [
      "/uploads/merchants/images/m001_happy_1694123456789.webp",
      "/uploads/merchants/images/thumbnails/m001_happy_1694123456789_thumb.webp"
    ]
  }
}
```

### 4. 미디어 일괄 처리
```http
POST /admin/api/media/batch
```

**Request Body:**
```json
{
  "action": "delete",         // delete, activate, deactivate
  "mediaIds": ["media001", "media002", "media003"]
}
```

---

## 🎯 퀘스트 관리 API

### 1. 퀘스트 템플릿 목록 조회
```http
GET /admin/api/quests
```

**Query Parameters:**
```javascript
{
  page: 1,
  limit: 20,
  category: "main_story",     // main_story, side_quest, daily, weekly
  type: "trade",              // kill, collect, trade, visit, talk
  level: 5,                   // 레벨 요구사항 필터
  active: true,
  search: "퀘스트명"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "quests": [
      {
        "id": "quest001",
        "name": "첫 거래",
        "description": "상인과 첫 거래를 완료하세요",
        "category": "main_story",
        "type": "trade",
        "levelRequirement": 1,
        "requiredLicense": 0,
        "prerequisites": [],
        "objectives": [
          {
            "type": "trade_complete",
            "target": "any_merchant",
            "quantity": 1,
            "description": "아무 상인과 거래 1회 완료"
          }
        ],
        "rewards": {
          "money": 5000,
          "experience": 100,
          "items": [],
          "reputation": 10
        },
        "autoComplete": false,
        "repeatable": false,
        "timeLimit": null,
        "isActive": true,
        "sortOrder": 1,
        "stats": {
          "activeCount": 145,
          "completedCount": 1832,
          "completionRate": 0.92
        },
        "createdAt": "2024-01-01T00:00:00Z",
        "updatedAt": "2024-01-15T10:30:00Z"
      }
    ],
    "pagination": {
      "page": 1,
      "limit": 20,
      "total": 48,
      "totalPages": 3
    }
  }
}
```

### 2. 퀘스트 생성
```http
POST /admin/api/quests
```

**Request Body:**
```json
{
  "name": "새로운 퀘스트",
  "description": "퀘스트 설명",
  "category": "side_quest",
  "type": "collect",
  "levelRequirement": 3,
  "requiredLicense": 1,
  "prerequisites": ["quest001"],
  "objectives": [
    {
      "type": "collect_item",
      "target": "silk",
      "quantity": 5,
      "description": "실크 5개 수집"
    }
  ],
  "rewards": {
    "money": 10000,
    "experience": 200,
    "items": ["item003"],
    "reputation": 20
  },
  "autoComplete": false,
  "repeatable": true,
  "timeLimit": 86400,
  "sortOrder": 10
}
```

### 3. 퀘스트 수정/삭제
```http
PUT /admin/api/quests/:questId
DELETE /admin/api/quests/:questId
```

### 4. 퀘스트 통계 조회
```http
GET /admin/api/quests/analytics
```

**Response:**
```json
{
  "success": true,
  "data": {
    "overview": {
      "totalQuests": 48,
      "activeQuests": 45,
      "completedToday": 156,
      "averageCompletionRate": 0.78
    },
    "topQuests": [
      {
        "questId": "quest001",
        "name": "첫 거래",
        "completionCount": 1832,
        "completionRate": 0.92
      }
    ],
    "categories": {
      "main_story": { "count": 12, "completionRate": 0.95 },
      "side_quest": { "count": 24, "completionRate": 0.73 },
      "daily": { "count": 8, "completionRate": 0.64 },
      "weekly": { "count": 4, "completionRate": 0.51 }
    }
  }
}
```

---

## ⚡ 스킬 관리 API

### 1. 스킬 템플릿 목록 조회
```http
GET /admin/api/skills
```

**Query Parameters:**
```javascript
{
  page: 1,
  limit: 20,
  category: "trading",        // trading, social, exploration, combat, crafting
  tier: 2,                    // 1-5
  active: true,
  search: "스킬명"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "skills": [
      {
        "id": "skill001",
        "name": "고급 협상술",
        "description": "상인과의 협상에서 더 좋은 조건을 이끌어냅니다",
        "category": "trading",
        "tier": 2,
        "maxLevel": 10,
        "prerequisites": ["skill000"],
        "unlockRequirements": {
          "level": 5,
          "skillPoints": 3,
          "items": ["negotiation_book"]
        },
        "effects": [
          {
            "level": 1,
            "priceReduction": 0.05,
            "successRate": 0.1
          },
          {
            "level": 10,
            "priceReduction": 0.25,
            "successRate": 0.5
          }
        ],
        "costPerLevel": [
          { "level": 1, "skillPoints": 1 },
          { "level": 5, "skillPoints": 2 },
          { "level": 10, "skillPoints": 3, "items": ["master_certificate"] }
        ],
        "iconId": 15,
        "isActive": true,
        "sortOrder": 5,
        "stats": {
          "totalLearners": 245,
          "averageLevel": 3.2,
          "maxLevelCount": 12
        }
      }
    ],
    "pagination": {
      "page": 1,
      "limit": 20,
      "total": 32
    }
  }
}
```

### 2. 스킬 생성/수정/삭제
```http
POST /admin/api/skills
PUT /admin/api/skills/:skillId
DELETE /admin/api/skills/:skillId
```

---

## 👥 플레이어 관리 API

### 1. 플레이어 목록 조회
```http
GET /admin/api/players
```

**Query Parameters:**
```javascript
{
  page: 1,
  limit: 20,
  search: "플레이어명",
  level: 10,                  // 레벨 필터
  license: 2,                 // 라이센스 레벨
  active: true,               // 활성 상태
  lastLoginAfter: "2024-01-01",
  sort: "level",              // level, money, reputation, lastLogin
  order: "desc"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "players": [
      {
        "id": "p001",
        "name": "게이머123",
        "level": 15,
        "money": 150000,
        "trustPoints": 85,
        "reputation": 230,
        "currentLicense": 2,
        "stats": {
          "strength": 15,
          "intelligence": 18,
          "charisma": 12,
          "luck": 14
        },
        "skills": {
          "tradingSkill": 5,
          "negotiationSkill": 3,
          "appraisalSkill": 4
        },
        "isActive": true,
        "lastLoginAt": "2024-01-20T14:22:00Z",
        "createdAt": "2023-12-15T09:30:00Z"
      }
    ],
    "pagination": {
      "page": 1,
      "limit": 20,
      "total": 2847
    }
  }
}
```

### 2. 플레이어 상세 조회
```http
GET /admin/api/players/:playerId
```

### 3. 플레이어 데이터 수정
```http
PUT /admin/api/players/:playerId
```

**Request Body:**
```json
{
  "money": 200000,
  "trustPoints": 100,
  "reputation": 300,
  "currentLicense": 3,
  "adminNote": "관리자 조정 - 이벤트 보상"
}
```

---

## 📊 시스템 모니터링 API

### 1. 대시보드 통계
```http
GET /admin/api/dashboard/stats
```

**Response:**
```json
{
  "success": true,
  "data": {
    "overview": {
      "totalPlayers": 2847,
      "activePlayers": 1542,
      "totalMerchants": 156,
      "totalQuests": 48,
      "totalSkills": 32
    },
    "activity": {
      "todayLogins": 456,
      "todayTransactions": 1234,
      "todayQuestCompletions": 567
    },
    "growth": {
      "newPlayersThisWeek": 89,
      "retentionRate7d": 0.73,
      "retentionRate30d": 0.52
    },
    "revenue": {
      "totalTransactionValue": 45678900,
      "averageTransactionValue": 12500
    }
  }
}
```

### 2. 실시간 활동 로그
```http
GET /admin/api/monitoring/activity
```

**Query Parameters:**
```javascript
{
  limit: 50,                  // 최대 100
  type: "transaction",        // transaction, quest, login, error
  playerId: "p001",          // 특정 플레이어 필터
  since: "2024-01-20T00:00:00Z"
}
```

### 3. 시스템 상태 확인
```http
GET /admin/api/monitoring/health
```

**Response:**
```json
{
  "success": true,
  "data": {
    "server": {
      "status": "healthy",
      "uptime": 1234567,
      "memory": {
        "used": 512,
        "total": 2048,
        "usage": 0.25
      }
    },
    "database": {
      "status": "healthy",
      "connections": 5,
      "responseTime": 45
    },
    "storage": {
      "status": "healthy",
      "used": "2.3GB",
      "available": "47.7GB",
      "usage": 0.046
    }
  }
}
```

---

## 🔐 인증 및 권한 API

### 1. 어드민 로그인
```http
POST /admin/api/auth/login
```

**Request Body:**
```json
{
  "username": "admin",
  "password": "secure_password"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "expiresIn": 86400,
    "user": {
      "id": "admin001",
      "username": "admin",
      "role": "super_admin",
      "permissions": [
        "merchants.read",
        "merchants.write",
        "quests.read",
        "quests.write",
        "players.read",
        "players.write"
      ]
    }
  }
}
```

### 2. 토큰 갱신
```http
POST /admin/api/auth/refresh
```

### 3. 로그아웃
```http
POST /admin/api/auth/logout
```

---

## 📁 파일/미디어 서빙 API

### 1. 미디어 파일 접근
```http
GET /media/merchants/:merchantId/:type/:filename
```

**예시:**
```
GET /media/merchants/m001/images/happy.webp
GET /media/merchants/m001/thumbnails/happy_thumb.webp
GET /media/merchants/m001/animations/talking.gif
```

### 2. 동적 이미지 리사이징
```http
GET /media/resize/:width/:height/:merchantId/:filename
```

**예시:**
```
GET /media/resize/150/150/m001/happy.webp
```

---

## 🚨 오류 처리

### 표준 오류 응답 형식
```json
{
  "success": false,
  "error": {
    "code": "MERCHANT_NOT_FOUND",
    "message": "지정된 상인을 찾을 수 없습니다.",
    "details": {
      "merchantId": "invalid_id",
      "timestamp": "2024-01-21T10:15:00Z"
    }
  }
}
```

### 주요 오류 코드
```javascript
const ERROR_CODES = {
  // 인증/권한
  UNAUTHORIZED: 401,
  FORBIDDEN: 403,
  TOKEN_EXPIRED: 401,

  // 리소스
  MERCHANT_NOT_FOUND: 404,
  QUEST_NOT_FOUND: 404,
  SKILL_NOT_FOUND: 404,
  PLAYER_NOT_FOUND: 404,
  MEDIA_NOT_FOUND: 404,

  // 검증
  VALIDATION_ERROR: 400,
  INVALID_FILE_TYPE: 400,
  FILE_TOO_LARGE: 413,

  // 서버
  INTERNAL_SERVER_ERROR: 500,
  DATABASE_ERROR: 500,
  FILE_SYSTEM_ERROR: 500
};
```

---

## 🔧 API 클라이언트 예시

### JavaScript/TypeScript 클라이언트
```typescript
class Way3AdminAPI {
  constructor(private baseURL: string, private token: string) {}

  // 상인 관리
  async getMerchants(params?: MerchantListParams): Promise<MerchantListResponse> {
    return this.request('GET', '/merchants', { params });
  }

  async createMerchant(data: CreateMerchantData): Promise<MerchantResponse> {
    return this.request('POST', '/merchants', { data });
  }

  // 미디어 업로드
  async uploadMerchantMedia(
    merchantId: string,
    files: File[],
    metadata: MediaMetadata
  ): Promise<MediaUploadResponse> {
    const formData = new FormData();
    formData.append('merchantId', merchantId);
    formData.append('mediaType', metadata.mediaType);
    formData.append('emotion', metadata.emotion);

    files.forEach(file => formData.append('files', file));

    return this.request('POST', `/merchants/${merchantId}/media`, {
      data: formData,
      headers: { 'Content-Type': 'multipart/form-data' }
    });
  }

  private async request(method: string, endpoint: string, options: RequestOptions = {}) {
    const url = `${this.baseURL}${endpoint}`;
    const config = {
      method,
      headers: {
        'Authorization': `Bearer ${this.token}`,
        'Content-Type': 'application/json',
        ...options.headers
      },
      ...options
    };

    const response = await fetch(url, config);

    if (!response.ok) {
      const error = await response.json();
      throw new AdminAPIError(error.error.code, error.error.message);
    }

    return response.json();
  }
}

// 사용 예시
const adminAPI = new Way3AdminAPI('http://localhost:3000/admin/api', 'your-jwt-token');

// 상인 목록 조회
const merchants = await adminAPI.getMerchants({
  page: 1,
  limit: 20,
  type: 'retail'
});

// 미디어 업로드
const files = document.querySelector('input[type=file]').files;
await adminAPI.uploadMerchantMedia('m001', files, {
  mediaType: 'face_image',
  emotion: 'happy'
});
```

---

이 API 명세서를 바탕으로 어드민 시스템의 프론트엔드와 백엔드 간의 완전한 통신이 가능합니다. 모든 엔드포인트는 RESTful 설계 원칙을 따르며, 확장성과 유지보수성을 고려하여 설계되었습니다.