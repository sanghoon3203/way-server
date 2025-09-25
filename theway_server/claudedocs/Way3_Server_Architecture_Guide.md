# Way3 Trading Game - 서버 아키텍처 & 데이터 구조 가이드

> 클라우드와의 효율적인 협업을 위한 완전한 프로젝트 참조 문서

## 📋 목차

1. [프로젝트 개요](#1-프로젝트-개요)
2. [아키텍처 & 기술 스택](#2-아키텍처--기술-스택)
3. [서버 구조](#3-서버-구조)
4. [데이터베이스 스키마](#4-데이터베이스-스키마)
5. [API 엔드포인트](#5-api-엔드포인트)
6. [게임 시스템 로직](#6-게임-시스템-로직)
7. [상인 캐릭터 정보](#7-상인-캐릭터-정보)
8. [실시간 통신](#8-실시간-통신)
9. [배포 및 환경](#9-배포-및-환경)

---

## 1. 프로젝트 개요

### 🎮 게임 컨셉
**Way3 Trading Game**은 위치 기반 모바일 거래 시뮬레이션 게임입니다.

**핵심 특징:**
- **위치 기반 거래**: GPS를 활용한 실제 위치에서의 상인과의 거래
- **8명의 개성 있는 캐릭터 상인**: 각각 고유한 성격과 거래 특성
- **실시간 퀘스트 시스템**: 일일 퀘스트와 성취 시스템
- **소셜 거래**: 실시간 채팅과 플레이어 간 상호작용

### 🎯 게임 목표
- 다양한 아이템을 거래하여 수익 창출
- 상인들과의 관계 구축 및 신뢰도 향상
- 퀘스트 완료를 통한 경험치 및 보상 획득
- 라이센스 업그레이드로 고급 아이템 거래 접근

---

## 2. 아키텍처 & 기술 스택

### 🏗️ 시스템 아키텍처

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   iOS Client    │◄──►│   Node.js       │◄──►│     SQLite      │
│   (SwiftUI)     │    │   Server        │    │   Database      │
│                 │    │   (Express)     │    │                 │
│ • CoreLocation  │    │ • Socket.IO     │    │ • 8 상인 데이터  │
│ • Socket.IO     │    │ • JWT Auth      │    │ • 플레이어 정보  │
│ • GameManager   │    │ • REST API      │    │ • 아이템 & 퀘스트│
└─────────────────┘    └─────────────────┘    └─────────────────┘
        │                       │                       │
        └───────────────────────┼───────────────────────┘
                                │
                    ┌─────────────────┐
                    │    Railway      │
                    │   (Deployment)  │
                    └─────────────────┘
```

### 💻 클라이언트 기술 스택
- **언어**: Swift
- **UI 프레임워크**: SwiftUI
- **위치 서비스**: CoreLocation
- **실시간 통신**: Socket.IO Client
- **네트워킹**: URLSession + Combine
- **상태 관리**: ObservableObject + @Published

### 🖥️ 서버 기술 스택
- **런타임**: Node.js 18+
- **웹 프레임워크**: Express.js
- **데이터베이스**: SQLite3
- **실시간 통신**: Socket.IO
- **인증**: JWT + bcrypt
- **로깅**: Winston
- **배포**: Railway Platform

### 🔧 주요 패키지 의존성
```json
{
  "express": "^4.18.2",
  "socket.io": "^4.7.2",
  "sqlite3": "^5.1.6",
  "jsonwebtoken": "^9.0.2",
  "bcrypt": "^5.1.1",
  "winston": "^3.10.0",
  "express-validator": "^7.0.1"
}
```

---

## 3. 서버 구조

### 📁 디렉토리 구조

```
theway_server/
├── src/
│   ├── server.js                 # 메인 서버 엔트리포인트
│   ├── app.js                    # Express 앱 설정
│   ├── config/
│   │   └── logger.js            # 로깅 설정
│   ├── database/
│   │   ├── DatabaseManager.js   # SQLite 연결 관리
│   │   ├── seed.js              # 초기 데이터 생성
│   │   ├── migrate.js           # 마이그레이션 실행
│   │   └── migrations/          # SQL 마이그레이션 파일들
│   ├── middleware/
│   │   ├── auth.js              # 기본 인증
│   │   ├── jwtAuth.js           # JWT 인증
│   │   ├── adminAuth.js         # 관리자 인증
│   │   └── errorHandler.js      # 전역 에러 처리
│   ├── routes/
│   │   ├── api/
│   │   │   ├── merchants.js     # 상인 관련 API
│   │   │   ├── player.js        # 플레이어 관련 API
│   │   │   ├── quests.js        # 퀘스트 API
│   │   │   ├── trade.js         # 거래 API
│   │   │   └── auth.js          # 인증 API
│   │   └── admin/               # 관리자 라우트들
│   ├── socket/
│   │   └── handlers/
│   │       ├── index.js         # Socket 핸들러 등록
│   │       ├── chatHandler.js   # 채팅 처리
│   │       ├── tradeHandler.js  # 실시간 거래
│   │       └── locationHandler.js # 위치 업데이트
│   ├── services/                # 비즈니스 로직 서비스들
│   ├── controllers/             # 컨트롤러들
│   └── utils/
│       ├── MetricsCollector.js  # 메트릭 수집
│       └── StandardResponse.js  # 표준 응답 형식
├── public/                      # 정적 파일들
├── claudedocs/                  # 프로젝트 문서들
└── package.json
```

### ⚡ 핵심 컴포넌트

#### **server.js - 메인 서버**
- HTTP 서버 및 Socket.IO 서버 설정
- CORS 정책 (모바일 앱 및 로컬 네트워크 지원)
- 데이터베이스 초기화
- 우아한 종료 처리

#### **DatabaseManager.js - 데이터베이스 관리**
- SQLite 연결 관리
- 테이블 생성 및 스키마 관리
- 쿼리 실행 메서드 (`get`, `all`, `run`)
- 트랜잭션 지원

#### **미들웨어 시스템**
- **auth.js**: 기본 사용자 인증
- **jwtAuth.js**: JWT 토큰 기반 인증
- **errorHandler.js**: 전역 에러 처리 및 응답

---

## 4. 데이터베이스 스키마

### 🗄️ 핵심 테이블 구조

#### **users** - 사용자 계정
```sql
CREATE TABLE users (
    id TEXT PRIMARY KEY,
    email TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    is_active BOOLEAN DEFAULT TRUE
);
```

#### **players** - 플레이어 게임 데이터
```sql
CREATE TABLE players (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    name TEXT NOT NULL,
    money INTEGER DEFAULT 50000,           -- 게임 머니
    trust_points INTEGER DEFAULT 0,       -- 신뢰 포인트
    reputation INTEGER DEFAULT 0,         -- 평판
    current_license INTEGER DEFAULT 0,    -- 현재 라이센스 레벨
    max_inventory_size INTEGER DEFAULT 5, -- 인벤토리 최대 크기
    level INTEGER DEFAULT 1,              -- 플레이어 레벨
    experience INTEGER DEFAULT 0,         -- 경험치

    -- 스탯
    strength INTEGER DEFAULT 10,          -- 힘
    intelligence INTEGER DEFAULT 10,      -- 지능
    charisma INTEGER DEFAULT 10,          -- 매력
    luck INTEGER DEFAULT 10,              -- 운

    -- 스킬
    trading_skill INTEGER DEFAULT 1,      -- 거래 스킬
    negotiation_skill INTEGER DEFAULT 1,  -- 협상 스킬
    appraisal_skill INTEGER DEFAULT 1,    -- 감정 스킬

    FOREIGN KEY (user_id) REFERENCES users(id)
);
```

#### **merchants** - 상인 정보
```sql
CREATE TABLE merchants (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,                   -- 상인 이름
    title TEXT,                           -- 상인 직함
    merchant_type TEXT NOT NULL,          -- 상인 타입
    personality TEXT NOT NULL,            -- 성격 유형
    district TEXT NOT NULL,               -- 서울 구역
    lat REAL NOT NULL,                    -- 위도
    lng REAL NOT NULL,                    -- 경도
    required_license INTEGER DEFAULT 0,   -- 필요 라이센스
    reputation_requirement INTEGER DEFAULT 0, -- 필요 평판
    price_modifier REAL DEFAULT 1.0,     -- 가격 배수
    negotiation_difficulty INTEGER DEFAULT 3, -- 협상 난이도
    image_filename TEXT,                  -- 이미지 파일명
    last_restocked DATETIME DEFAULT CURRENT_TIMESTAMP,
    is_active BOOLEAN DEFAULT TRUE
);
```

#### **item_templates** - 아이템 템플릿
```sql
CREATE TABLE item_templates (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,                   -- 아이템 이름
    category TEXT NOT NULL,               -- 카테고리
    grade INTEGER NOT NULL,               -- 등급 (1-5)
    base_price INTEGER NOT NULL,          -- 기본 가격
    weight REAL DEFAULT 1.0,              -- 무게
    description TEXT,                     -- 설명
    icon_id INTEGER DEFAULT 1,            -- 아이콘 ID
    required_license INTEGER DEFAULT 0,   -- 필요 라이센스
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
```

#### **merchant_inventory** - 상인 인벤토리
```sql
CREATE TABLE merchant_inventory (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    merchant_id TEXT NOT NULL,
    item_template_id INTEGER NOT NULL,
    current_price INTEGER NOT NULL,       -- 현재 판매 가격
    quantity INTEGER NOT NULL,            -- 보유 수량
    last_updated DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (merchant_id) REFERENCES merchants(id),
    FOREIGN KEY (item_template_id) REFERENCES item_templates(id)
);
```

#### **player_items** - 플레이어 아이템
```sql
CREATE TABLE player_items (
    id TEXT PRIMARY KEY,
    player_id TEXT NOT NULL,
    item_template_id INTEGER NOT NULL,
    quantity INTEGER DEFAULT 1,
    storage_type TEXT DEFAULT 'inventory', -- 'inventory' or 'storage'
    acquired_price INTEGER,               -- 취득 가격
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (player_id) REFERENCES players(id),
    FOREIGN KEY (item_template_id) REFERENCES item_templates(id)
);
```

### 🔗 관계 테이블들

#### **merchant_relationships** - 상인과의 관계
```sql
CREATE TABLE merchant_relationships (
    player_id TEXT NOT NULL,
    merchant_id TEXT NOT NULL,
    friendship_points INTEGER DEFAULT 0,  -- 친밀도
    trust_level INTEGER DEFAULT 0,        -- 신뢰 레벨
    total_trades INTEGER DEFAULT 0,       -- 총 거래 횟수
    total_spent INTEGER DEFAULT 0,        -- 총 지출 금액
    last_interaction DATETIME,            -- 마지막 상호작용
    notes TEXT,                          -- 메모
    PRIMARY KEY (player_id, merchant_id)
);
```

#### **quest_templates** - 퀘스트 템플릿
```sql
CREATE TABLE quest_templates (
    id TEXT PRIMARY KEY,
    title TEXT NOT NULL,                  -- 퀘스트 제목
    description TEXT NOT NULL,            -- 설명
    category TEXT NOT NULL,               -- 카테고리
    quest_type TEXT NOT NULL,             -- 퀘스트 타입
    objectives TEXT,                      -- 목표 (JSON)
    rewards TEXT,                         -- 보상 (JSON)
    requirements TEXT,                    -- 요구사항 (JSON)
    level_requirement INTEGER DEFAULT 1,  -- 필요 레벨
    required_license INTEGER DEFAULT 0,   -- 필요 라이센스
    repeatable BOOLEAN DEFAULT FALSE,     -- 반복 가능 여부
    cooldown_hours INTEGER DEFAULT 0,     -- 쿨다운 시간
    priority INTEGER DEFAULT 0,          -- 우선순위
    sort_order INTEGER DEFAULT 0,        -- 정렬 순서
    is_active BOOLEAN DEFAULT TRUE
);
```

#### **player_quests** - 플레이어 퀘스트 진행상황
```sql
CREATE TABLE player_quests (
    id TEXT PRIMARY KEY,
    player_id TEXT NOT NULL,
    quest_template_id TEXT NOT NULL,
    status TEXT DEFAULT 'active',         -- 'active', 'completed', 'failed'
    progress TEXT,                        -- 진행상황 (JSON)
    accepted_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    completed_at DATETIME,
    reward_claimed BOOLEAN DEFAULT FALSE,
    FOREIGN KEY (player_id) REFERENCES players(id),
    FOREIGN KEY (quest_template_id) REFERENCES quest_templates(id)
);
```

---

## 5. API 엔드포인트

### 🔐 인증 시스템

**JWT 토큰 기반 인증**
- **로그인**: `POST /api/auth/login`
- **회원가입**: `POST /api/auth/register`
- **토큰 갱신**: `POST /api/auth/refresh`

**인증 헤더 형식:**
```
Authorization: Bearer <JWT_TOKEN>
```

### 👤 플레이어 API (`/api/player`)

#### **GET /api/player/profile**
플레이어 프로필 및 상세 정보 조회

**응답 구조:**
```json
{
  "success": true,
  "data": {
    "id": "player_id",
    "name": "플레이어명",
    "level": 5,
    "experience": 1250,
    "money": 75000,
    "trustPoints": 120,
    "reputation": 85,
    "currentLicense": 2,
    "maxInventorySize": 8,
    "maxStorageSize": 50,
    "statPoints": 3,
    "skillPoints": 1,
    "strength": 15,
    "intelligence": 12,
    "charisma": 18,
    "luck": 10,
    "tradingSkill": 45,
    "negotiationSkill": 38,
    "appraisalSkill": 22,
    "location": {
      "lat": 37.5665,
      "lng": 126.9780
    },
    "inventory": [...],
    "storageItems": [...],
    "recentTrades": [...]
  }
}
```

### 🏪 상인 API (`/api/merchants`)

#### **GET /api/merchants/nearby**
위치 기반 근처 상인 조회

**쿼리 파라미터:**
- `lat`: 위도 (필수)
- `lng`: 경도 (필수)
- `radius`: 검색 반경 (선택, 기본값 1000m)

**응답 구조:**
```json
{
  "success": true,
  "data": {
    "merchants": [
      {
        "id": "seoye",
        "name": "서예나",
        "title": "네오-시티 스타일리스트",
        "type": "fashion",
        "personality": "cold",
        "district": "neo_shibuya",
        "location": {
          "lat": 37.5665,
          "lng": 126.9780
        },
        "distance": 250,
        "canTrade": true,
        "requiredLicense": 1,
        "reputationRequirement": 0,
        "priceModifier": 1.2,
        "negotiationDifficulty": 4,
        "inventoryCount": 12,
        "lastRestocked": "2024-01-15T08:00:00Z"
      }
    ],
    "total": 3,
    "searchParams": {
      "lat": 37.5665,
      "lng": 126.9780,
      "radius": 1000
    }
  }
}
```

#### **GET /api/merchants/:merchantId**
특정 상인의 상세 정보 및 인벤토리 조회

**응답 구조:**
```json
{
  "success": true,
  "data": {
    "id": "seoye",
    "name": "서예나",
    "title": "네오-시티 스타일리스트",
    "type": "fashion",
    "personality": "cold",
    "district": "neo_shibuya",
    "location": {
      "lat": 37.5665,
      "lng": 126.9780
    },
    "requiredLicense": 1,
    "reputationRequirement": 0,
    "priceModifier": 1.2,
    "negotiationDifficulty": 4,
    "lastRestocked": "2024-01-15T08:00:00Z",
    "preferredCategories": ["fashion", "accessories"],
    "dislikedCategories": ["food"],
    "inventory": [
      {
        "id": "item_001",
        "itemTemplateId": 15,
        "name": "명품 핸드백",
        "category": "fashion",
        "grade": 4,
        "basePrice": 800000,
        "currentPrice": 960000,
        "quantity": 2,
        "weight": 0.8,
        "description": "최고급 가죽으로 제작된 명품 핸드백",
        "iconId": 45,
        "requiredLicense": 2,
        "lastUpdated": "2024-01-15T08:00:00Z"
      }
    ],
    "relationship": {
      "friendshipPoints": 150,
      "trustLevel": 3,
      "totalTrades": 8,
      "totalSpent": 1250000,
      "lastInteraction": "2024-01-14T15:30:00Z",
      "notes": null
    }
  }
}
```

### 📋 퀘스트 API (`/api/quests`)

#### **GET /api/quests/available**
수행 가능한 퀘스트 목록 조회

**응답 구조:**
```json
{
  "success": true,
  "data": {
    "quests": [
      {
        "id": "daily_trade_001",
        "title": "첫 번째 거래",
        "description": "상인과 첫 거래를 완료하세요",
        "category": "tutorial",
        "questType": "trade",
        "maxProgress": 1,
        "currentProgress": 0,
        "rewards": {
          "money": 5000,
          "experience": 100,
          "items": []
        },
        "requirements": {
          "level": 1,
          "license": 0
        },
        "isRepeatable": false,
        "cooldownHours": 0,
        "priority": 1,
        "status": "available"
      }
    ],
    "total": 5
  }
}
```

#### **POST /api/quests/:questId/accept**
퀘스트 수락

#### **POST /api/quests/:questId/complete**
퀘스트 완료 및 보상 수령

### 💰 거래 API (`/api/trade`)

#### **POST /api/trade/buy**
아이템 구매

**요청 구조:**
```json
{
  "merchantId": "seoye",
  "itemId": "item_001",
  "quantity": 1,
  "offeredPrice": 950000
}
```

#### **POST /api/trade/sell**
아이템 판매

**요청 구조:**
```json
{
  "merchantId": "seoye",
  "playerItemId": "player_item_123",
  "quantity": 1,
  "askingPrice": 1000000
}
```

---

## 6. 게임 시스템 로직

### 💎 거래 시스템

#### **가격 계산 로직**
```javascript
function calculateFinalPrice(basePrice, merchant, item, player) {
    let finalPrice = basePrice;

    // 상인의 기본 가격 배수 적용
    finalPrice *= merchant.priceModifier;

    // 선호 카테고리 할인 (10%)
    if (merchant.preferredCategories.includes(item.category)) {
        finalPrice *= 0.9;
    }

    // 비선호 카테고리 할증 (20%)
    if (merchant.dislikedCategories.includes(item.category)) {
        finalPrice *= 1.2;
    }

    // 플레이어 관계도에 따른 할인
    const relationship = getRelationship(player.id, merchant.id);
    const discountRate = Math.min(relationship.trustLevel * 0.02, 0.15); // 최대 15% 할인
    finalPrice *= (1 - discountRate);

    return Math.round(finalPrice);
}
```

#### **거래 성공 조건**
1. **라이센스 검증**: `player.currentLicense >= item.requiredLicense`
2. **자금 확인**: `player.money >= finalPrice` (구매 시)
3. **인벤토리 공간**: `inventory.length < player.maxInventorySize`
4. **상인 재고**: `merchantItem.quantity >= requestedQuantity`

#### **관계도 시스템**
```javascript
function updateMerchantRelationship(playerId, merchantId, tradeAmount) {
    const friendshipGain = Math.floor(tradeAmount / 10000); // 10,000원당 1 포인트
    const trustGain = tradeAmount > 100000 ? 1 : 0; // 10만원 이상 거래시 신뢰도 +1

    updateRelationship(playerId, merchantId, {
        friendship_points: friendshipGain,
        trust_level: trustGain,
        total_trades: 1,
        total_spent: tradeAmount,
        last_interaction: new Date()
    });
}
```

### 🎯 퀘스트 시스템

#### **퀘스트 타입별 처리**
- **trade**: 거래 횟수/금액 달성
- **collect**: 특정 아이템 수집
- **visit**: 특정 상인 방문
- **social**: 플레이어 간 상호작용
- **achievement**: 특정 성취 달성

#### **진행상황 업데이트**
```javascript
async function updateQuestProgress(playerId, action, data) {
    const activeQuests = await getActiveQuests(playerId);

    for (const quest of activeQuests) {
        if (quest.questType === action) {
            const progress = JSON.parse(quest.progress);

            switch (action) {
                case 'trade':
                    progress.tradeCount = (progress.tradeCount || 0) + 1;
                    progress.tradeAmount = (progress.tradeAmount || 0) + data.amount;
                    break;
                case 'collect':
                    progress.itemsCollected = progress.itemsCollected || {};
                    progress.itemsCollected[data.itemId] =
                        (progress.itemsCollected[data.itemId] || 0) + data.quantity;
                    break;
            }

            await updateQuestProgress(quest.id, progress);

            // 완료 조건 확인
            if (isQuestCompleted(quest, progress)) {
                await completeQuest(quest.id);
            }
        }
    }
}
```

### 🗺️ 위치 기반 서비스

#### **거리 계산 (하버사인 공식)**
```javascript
function calculateDistance(lat1, lng1, lat2, lng2) {
    const R = 6371e3; // 지구 반지름 (미터)
    const φ1 = lat1 * Math.PI/180;
    const φ2 = lat2 * Math.PI/180;
    const Δφ = (lat2-lat1) * Math.PI/180;
    const Δλ = (lng2-lng1) * Math.PI/180;

    const a = Math.sin(Δφ/2) * Math.sin(Δφ/2) +
              Math.cos(φ1) * Math.cos(φ2) *
              Math.sin(Δλ/2) * Math.sin(Δλ/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));

    return R * c; // 미터 단위
}
```

#### **근처 상인 필터링**
- 기본 반경: 1,000m
- 최대 반경: 5,000m
- 거리순 정렬
- 거래 가능 여부 표시

---

## 7. 상인 캐릭터 정보

### 👥 8명의 개성 있는 상인들

#### **1. 서예나 (Seoyena) - 네오-시티 스타일리스트**
```json
{
  "id": "seoye",
  "name": "서예나",
  "title": "네오-시티 스타일리스트",
  "type": "fashion",
  "personality": "cold",
  "district": "neo_shibuya",
  "location": { "lat": 37.5665, "lng": 126.9780 },
  "specialties": ["패션", "액세서리", "명품"],
  "priceModifier": 1.2,
  "negotiationDifficulty": 4,
  "preferredCategories": ["fashion", "accessories", "luxury"],
  "dislikedCategories": ["food", "basic_items"],
  "personality_traits": {
    "greeting": "차갑지만 전문적",
    "haggling": "까다롭고 자존심 강함",
    "relationship_building": "실력 인정받아야 친해짐"
  }
}
```

#### **2. 마리 (Mari) - 따뜻한 동네 상점 사장**
```json
{
  "id": "mariapple",
  "name": "마리",
  "title": "정다운 동네 상점 사장",
  "type": "retail",
  "personality": "warm",
  "district": "jung",
  "location": { "lat": 37.5636, "lng": 126.9979 },
  "specialties": ["일용품", "식품", "생필품"],
  "priceModifier": 0.95,
  "negotiationDifficulty": 2,
  "preferredCategories": ["food", "daily_items", "basic"],
  "dislikedCategories": ["luxury", "electronics"],
  "personality_traits": {
    "greeting": "따뜻하고 친근함",
    "haggling": "합리적이고 유연함",
    "relationship_building": "쉽게 친해지고 정이 많음"
  }
}
```

#### **3. 김세휘 (Kimsehwui) - 베테랑 트레이더**
```json
{
  "id": "Seongbok",
  "name": "김세휘",
  "title": "베테랑 트레이더",
  "type": "wholesale",
  "personality": "professional",
  "district": "jung",
  "location": { "lat": 37.5636, "lng": 126.9979 },
  "specialties": ["전자제품", "대량거래", "도매"],
  "priceModifier": 1.1,
  "negotiationDifficulty": 3,
  "preferredCategories": ["electronics", "wholesale", "rare"],
  "dislikedCategories": ["food", "basic_items"],
  "personality_traits": {
    "greeting": "비즈니스라이크하고 전문적",
    "haggling": "논리적이고 계산적",
    "relationship_building": "실력과 신뢰도 중시"
  }
}
```

#### **4. 애니박 (Alicegang) - 아티스트 상인**
```json
{
  "id": "Alicegang",
  "name": "애니박",
  "title": "아티스트 상인",
  "type": "artist",
  "personality": "creative",
  "district": "jung",
  "location": { "lat": 37.5636, "lng": 126.9979 },
  "specialties": ["예술품", "수집품", "독특한 아이템"],
  "priceModifier": 1.3,
  "negotiationDifficulty": 3,
  "preferredCategories": ["art", "collectibles", "unique"],
  "dislikedCategories": ["mass_produced", "basic_items"],
  "personality_traits": {
    "greeting": "독특하고 창의적",
    "haggling": "감성적이고 직관적",
    "relationship_building": "예술적 안목 중시"
  }
}
```

#### **5. 카타리나 최 (Catarina Choi) - 글로벌 바이어**
```json
{
  "id": "nacho",
  "name": "카타리나 최",
  "title": "글로벌 바이어",
  "type": "luxury",
  "personality": "sophisticated",
  "district": "jung",
  "location": { "lat": 37.5636, "lng": 126.9979 },
  "specialties": ["명품", "수입품", "고급 아이템"],
  "priceModifier": 1.4,
  "negotiationDifficulty": 4,
  "preferredCategories": ["luxury", "imported", "premium"],
  "dislikedCategories": ["cheap", "local_basic"],
  "personality_traits": {
    "greeting": "세련되고 국제적",
    "haggling": "고급스럽고 품위 있음",
    "relationship_building": "세련된 취향 중시"
  }
}
```

#### **6. 진백호 (Jinbaekho) - 카페 사장 겸 정보상**
```json
{
  "id": "corea",
  "name": "진백호",
  "title": "카페 사장 겸 정보상",
  "type": "cafe",
  "personality": "friendly",
  "district": "gangdong",
  "location": { "lat": 37.5301, "lng": 127.1238 },
  "specialties": ["정보", "소식", "커뮤니티"],
  "priceModifier": 1.0,
  "negotiationDifficulty": 2,
  "preferredCategories": ["information", "community", "food"],
  "dislikedCategories": ["illegal", "suspicious"],
  "personality_traits": {
    "greeting": "친근하고 사교적",
    "haggling": "합리적이고 상황 파악 빠름",
    "relationship_building": "정보 교환 중시"
  }
}
```

#### **7. 주불수 (Jubulsu) - 무기상**
```json
{
  "id": "joo",
  "name": "주불수",
  "title": "무기상",
  "type": "weaponsmith",
  "personality": "tough",
  "district": "gangdong",
  "location": { "lat": 37.5301, "lng": 127.1238 },
  "specialties": ["무기", "방어구", "전투 아이템"],
  "priceModifier": 1.15,
  "negotiationDifficulty": 3,
  "preferredCategories": ["weapons", "armor", "combat"],
  "dislikedCategories": ["fashion", "food"],
  "personality_traits": {
    "greeting": "거칠지만 솔직함",
    "haggling": "직설적이고 단도직입적",
    "relationship_building": "실력과 담력 중시"
  }
}
```

#### **8. 기주리 (Kijuri) - 시간 경비원**
```json
{
  "id": "Kijuri",
  "name": "기주리",
  "title": "시간 경비원",
  "type": "mystic",
  "personality": "mysterious",
  "district": "special",
  "location": { "lat": 37.5172, "lng": 127.0473 },
  "specialties": ["희귀 아이템", "신비로운 물건", "시간 관련"],
  "priceModifier": 1.5,
  "negotiationDifficulty": 5,
  "preferredCategories": ["rare", "mystic", "time_related"],
  "dislikedCategories": ["common", "mass_produced"],
  "personality_traits": {
    "greeting": "신비롭고 수수께끼 같음",
    "haggling": "예측 불가능하고 독특함",
    "relationship_building": "시간과 운명 중시"
  }
}
```

### 🎭 상인별 거래 특성

#### **가격 정책**
- **마리**: 가장 저렴 (5% 할인)
- **진백호**: 표준 가격
- **김세휘, 주불수**: 약간 비쌈 (+10-15%)
- **서예나, 카타리나**: 비쌈 (+20-40%)
- **기주리**: 가장 비쌈 (+50%)

#### **협상 난이도**
1. **쉬움**: 마리, 진백호
2. **보통**: 김세휘, 애니박, 주불수
3. **어려움**: 서예나, 카타리나
4. **매우 어려움**: 기주리

---

## 8. 실시간 통신

### 🔌 Socket.IO 이벤트 시스템

#### **연결 관리**
```javascript
// 클라이언트 연결
io.on('connection', (socket) => {
    console.log('플레이어 연결:', socket.id);

    // 플레이어 정보 등록
    socket.on('player:register', (playerData) => {
        socket.playerId = playerData.playerId;
        socket.playerName = playerData.playerName;
        socket.join(`player:${playerData.playerId}`);
    });
});
```

#### **위치 업데이트**
```javascript
// 클라이언트 → 서버
socket.emit('location:update', {
    lat: 37.5665,
    lng: 126.9780,
    timestamp: Date.now()
});

// 서버 → 클라이언트
socket.on('location:update', (locationData) => {
    // 근처 상인 검색
    const nearbyMerchants = findNearbyMerchants(locationData);

    // 클라이언트에게 근처 상인 정보 전송
    socket.emit('merchants:nearby', nearbyMerchants);
});
```

#### **실시간 거래**
```javascript
// 거래 요청
socket.emit('trade:request', {
    merchantId: 'seoye',
    itemId: 'item_001',
    type: 'buy',
    offeredPrice: 950000
});

// 거래 응답
socket.on('trade:response', (response) => {
    if (response.success) {
        // 거래 성공 - UI 업데이트
        updateInventory(response.data.updatedInventory);
        updateMoney(response.data.updatedMoney);
    } else {
        // 거래 실패 - 에러 메시지 표시
        showError(response.error);
    }
});
```

#### **채팅 시스템**
```javascript
// 메시지 전송
socket.emit('chat:message', {
    recipientId: 'player_123',
    message: '안녕하세요!',
    timestamp: Date.now()
});

// 메시지 수신
socket.on('chat:message', (messageData) => {
    displayMessage(messageData);
});
```

### 📡 주요 Socket 이벤트 목록

| 이벤트명 | 방향 | 설명 |
|---------|------|------|
| `player:register` | C→S | 플레이어 등록 |
| `location:update` | C→S | 위치 업데이트 |
| `merchants:nearby` | S→C | 근처 상인 정보 |
| `trade:request` | C→S | 거래 요청 |
| `trade:response` | S→C | 거래 응답 |
| `trade:notification` | S→C | 거래 알림 |
| `chat:message` | C↔S | 채팅 메시지 |
| `chat:typing` | C↔S | 타이핑 상태 |
| `quest:update` | S→C | 퀘스트 진행 업데이트 |
| `player:stats_update` | S→C | 플레이어 스탯 변경 |

---

## 9. 배포 및 환경

### 🚀 Railway 배포 설정

#### **환경 변수**
```bash
# 데이터베이스
DB_PATH=./data/way_game.sqlite

# JWT 설정
JWT_SECRET=your_jwt_secret_key
JWT_REFRESH_SECRET=your_refresh_secret_key

# 서버 설정
PORT=3000
NODE_ENV=production

# CORS 설정
ALLOWED_ORIGINS=https://your-app-domain.com,http://localhost:3000

# 시드 데이터 실행 여부
RUN_SEED=true

# 로그 레벨
LOG_LEVEL=info
```

#### **Railway 빌드 스크립트**
```json
{
  "scripts": {
    "build": "npm install",
    "start": "node src/server.js",
    "migrate": "node src/database/migrate.js",
    "seed": "node src/database/seed.js"
  }
}
```

#### **배포 프로세스**
1. **코드 푸시**: Git push to main branch
2. **자동 빌드**: Railway auto-build trigger
3. **의존성 설치**: `npm install`
4. **마이그레이션**: `npm run migrate`
5. **시드 데이터**: `npm run seed` (RUN_SEED=true일 때)
6. **서버 시작**: `npm start`

### 🌐 서버 URL 및 엔드포인트

#### **프로덕션 URL**
- **Base URL**: `https://way3-production.up.railway.app`
- **API Base**: `https://way3-production.up.railway.app/api`
- **Socket URL**: `https://way3-production.up.railway.app`

#### **개발 환경**
- **Local URL**: `http://localhost:3000`
- **API Base**: `http://localhost:3000/api`
- **Socket URL**: `http://localhost:3000`

### 📊 모니터링 및 로깅

#### **로깅 시스템 (Winston)**
```javascript
const winston = require('winston');

const logger = winston.createLogger({
    level: process.env.LOG_LEVEL || 'info',
    format: winston.format.combine(
        winston.format.timestamp(),
        winston.format.errors({ stack: true }),
        winston.format.colorize(),
        winston.format.simple()
    ),
    transports: [
        new winston.transports.Console(),
        new winston.transports.File({
            filename: 'logs/error.log',
            level: 'error'
        }),
        new winston.transports.File({
            filename: 'logs/combined.log'
        })
    ]
});
```

#### **메트릭 수집**
- **연결된 플레이어 수**
- **거래 통계**
- **퀘스트 완료율**
- **서버 응답 시간**
- **에러 발생률**

### 🔧 개발 도구

#### **로컬 개발 환경 설정**
```bash
# 프로젝트 클론
git clone <repository_url>
cd theway_server

# 의존성 설치
npm install

# 환경 변수 설정
cp .env.example .env

# 데이터베이스 마이그레이션
npm run migrate

# 시드 데이터 생성
npm run seed

# 개발 서버 시작
npm run dev
```

#### **유용한 스크립트**
```bash
# 데이터베이스 초기화
npm run migrate && npm run seed

# 프로덕션 빌드
npm run build

# 테스트 실행
npm test

# 로그 확인
tail -f logs/combined.log
```

---

## 📚 추가 참고 자료

### 🔗 관련 문서
- [클라이언트 SwiftUI 구조](./Way3_Frontend_Design.md)
- [관리자 시스템](./Admin_System_Design.md)
- [API 상세 명세](./Admin_API_Specifications.md)

### 💡 개발 팁
1. **데이터베이스 변경 시**: 항상 마이그레이션 파일 생성
2. **새로운 API 추가 시**: 인증, 검증, 에러 처리 필수 구현
3. **Socket 이벤트 추가 시**: 클라이언트와 동기화 확인
4. **배포 전**: 로컬에서 충분한 테스트 진행

### ⚠️ 주의사항
- **JWT 시크릿**: 프로덕션에서는 반드시 강력한 키 사용
- **데이터베이스 백업**: 정기적인 SQLite 파일 백업 권장
- **에러 처리**: 모든 API에서 적절한 에러 메시지 반환
- **로그 관리**: 민감한 정보 로깅 금지

---

## 🎯 결론

이 문서는 Way3 Trading Game의 서버 아키텍처와 데이터 구조에 대한 완전한 가이드입니다.

**이 문서를 통해 클라우드는 다음을 완벽하게 이해할 수 있습니다:**

✅ **프로젝트의 전체적인 구조와 목표**
✅ **8명의 캐릭터 상인 시스템과 각자의 특성**
✅ **데이터베이스 스키마와 테이블 관계**
✅ **API 엔드포인트와 요청/응답 구조**
✅ **실시간 Socket.IO 통신 방식**
✅ **거래, 퀘스트, 위치 기반 게임 로직**
✅ **Railway 배포 환경과 설정**

앞으로 개발 작업 시 이 문서를 참조하여 더욱 정확하고 효율적인 지원을 받으실 수 있습니다.

---

**문서 작성일**: 2024년 1월 16일
**마지막 업데이트**: 2024년 1월 16일
**버전**: 1.0.0