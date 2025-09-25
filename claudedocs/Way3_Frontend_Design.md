# Way3 Mobile App - Pokemon GO Style Location Trading Game

## Design Overview
위치 기반 실시간 무역 게임으로, 사용자가 실제 위치를 이동하며 상인들과 거래하는 Pokemon GO 스타일의 모바일 앱입니다.

## 1. 📱 Core UI Components

### 1.1 메인 맵 인터페이스 (Main Map Interface)
**Design Philosophy**: Pokemon GO의 맵 스타일을 차용하되, 무역 게임에 특화된 시각적 요소 적용

```
┌─────────────────────────────┐
│ 🏪    ⚡ 157  💰 2,450     │ ← Status Bar
├─────────────────────────────┤
│                             │
│    🏪 (상인 아이콘)          │
│       🎒 (플레이어)          │
│                   🏪       │
│          📦                │
│                             │
│     🏪            🏪       │
│                             │
├─────────────────────────────┤
│ [📍] [👤] [📦] [⚙️]        │ ← Navigation Bar
└─────────────────────────────┘
```

**Key Features**:
- **실시간 GPS 기반 맵**: 사용자 위치 중심으로 주변 상인들 표시
- **상인 아이콘**: 거리별로 크기 조절 (가까울수록 크게)
- **거래 가능 표시**: 상인별 특수 효과로 거래 가능 여부 표시
- **아이템 드롭 표시**: 맵상에 무작위로 나타나는 아이템들

### 1.2 상인 발견 시스템 (Merchant Discovery)
**Interaction Flow**: 
1. 상인 근처 접근 → 진동 + 알림
2. 상인 터치 → 정보 팝업 표시
3. 거래 버튼 → 거래 인터페이스 진입

```
┌─────────────────────────────┐
│     🏪 김씨 상점            │
│   "고급 향신료 전문"         │
│                             │
│ 📍 50m 거리                │
│ 💰 평균 가격: 보통          │
│ ⭐ 신뢰도: 4.2/5           │
│                             │
│ 주요 취급 품목:             │
│ • 🌶️ 고춧가루 (재고: 25)   │
│ • 🧄 마늘 (재고: 40)       │
│ • 🧂 천일염 (재고: 15)     │
│                             │
│    [거래하기] [정보더보기]   │
└─────────────────────────────┘
```

### 1.3 거래 인터페이스 (Trading Interface)
**Design**: 카드 기반 스와이프 인터페이스로 직관적인 거래 경험 제공

```
┌─────────────────────────────┐
│ 🏪 김씨 상점과의 거래        │
├─────────────────────────────┤
│                             │
│  구매 가능                   │
│ ┌─────────┐ ┌─────────┐     │
│ │🌶️ 고춧가루│ │🧄 마늘  │     │
│ │ 120원   │ │ 80원    │     │
│ │재고: 25 │ │재고: 40 │     │
│ └─────────┘ └─────────┘     │
│                             │
│  판매 가능                   │
│ ┌─────────┐ ┌─────────┐     │
│ │🍎 사과   │ │🥕 당근  │     │
│ │ 150원   │ │ 95원    │     │
│ │보유: 12 │ │보유: 8  │     │
│ └─────────┘ └─────────┘     │
│                             │
│    💰 예상 수익: +380원     │
│        [거래 완료]          │
└─────────────────────────────┘
```

## 2. 🎨 Visual Design System

### 2.1 색상 팔레트 (Color Palette)
```css
/* Primary Colors */
--primary-blue: #2E86AB      /* 메인 브랜드 컬러 */
--primary-gold: #F6A323      /* 돈/수익 표시 */
--primary-green: #49A078     /* 성공/이익 */
--primary-red: #DC143C       /* 경고/손실 */

/* Secondary Colors */
--bg-light: #F8F9FA         /* 밝은 배경 */
--bg-dark: #1A1A1A          /* 다크모드 배경 */
--text-primary: #2D3748     /* 기본 텍스트 */
--text-secondary: #718096   /* 보조 텍스트 */

/* Merchant Types */
--merchant-food: #FF6B6B    /* 식료품 상인 */
--merchant-craft: #4ECDC4   /* 공예품 상인 */
--merchant-luxury: #9B59B6  /* 명품 상인 */
--merchant-general: #95A5A6 /* 일반 상인 */
```

### 2.2 타이포그래피 (Typography)
**기본 폰트**: ChosunCentennial_otf
```css
/* 폰트 계층 구조 */
.font-heading-1 {
    font-family: 'ChosunCentennial', sans-serif;
    font-size: 24px;
    font-weight: bold;
    line-height: 1.2;
}

.font-heading-2 {
    font-family: 'ChosunCentennial', sans-serif;
    font-size: 20px;
    font-weight: 600;
    line-height: 1.3;
}

.font-body {
    font-family: 'ChosunCentennial', sans-serif;
    font-size: 16px;
    font-weight: 400;
    line-height: 1.5;
}

.font-caption {
    font-family: 'ChosunCentennial', sans-serif;
    font-size: 14px;
    font-weight: 300;
    line-height: 1.4;
}
```

### 2.3 아이콘 시스템 (Icon System)
**상인 카테고리별 아이콘**:
- 🏪 일반 상점
- 🍽️ 식당/카페
- 🛠️ 공예품점
- 💎 귀금속점
- 🌾 농산물 상인
- 🐟 수산물 상인

**상태 표시 아이콘**:
- ⚡ 에너지/활동력
- 💰 소지금
- 🎯 경험치
- 📊 거래 기록
- 🏆 업적

## 3. 🚀 핵심 기능 설계

### 3.1 위치 기반 상인 발견
```javascript
// 상인 발견 로직
const NearbyMerchants = {
    searchRadius: 500,  // 500m 반경
    updateInterval: 30000,  // 30초마다 업데이트
    
    discoveryTriggers: {
        proximity: 50,  // 50m 이내 접근시 알림
        vibration: true,
        notification: true
    }
}
```

### 3.2 실시간 가격 변동 시스템
```javascript
// 시장 가격 변동
const PriceSystem = {
    basePrice: 100,
    volatility: 0.1,  // 10% 변동폭
    updateFrequency: 300000,  // 5분마다
    
    factors: {
        supply: 0.3,      // 공급량 영향
        demand: 0.4,      // 수요량 영향
        location: 0.2,    // 지역별 가격차
        time: 0.1         // 시간대별 변동
    }
}
```

### 3.3 퀘스트 연동 시스템
**일일 퀘스트 예시**:
- "3명의 다른 상인과 거래하기"
- "1km 이상 이동하여 거래하기"
- "수익 1000원 이상 달성하기"
- "새로운 아이템 5개 발견하기"

## 4. 🔧 기술적 구현 사항

### 4.1 Swift/iOS 연동 구조
```swift
// 메인 뷰 컨트롤러
class MapViewController: UIViewController {
    @IBOutlet weak var mapView: MKMapView!
    @IBOutlet weak var statusBar: UIView!
    @IBOutlet weak var navigationBar: UITabBar!
    
    // WebSocket 연결
    var socketManager: SocketManager!
    
    // 위치 서비스
    var locationManager: CLLocationManager!
}
```

### 4.2 서버 API 연동
```javascript
// API 엔드포인트 연동
const APIEndpoints = {
    merchants: '/api/merchants/nearby',
    trade: '/api/trade',
    player: '/api/player/profile',
    quests: '/api/quests/active'
}

// WebSocket 이벤트
const SocketEvents = {
    locationUpdate: 'player:location:update',
    merchantDiscover: 'merchant:discover',
    tradeComplete: 'trade:complete',
    priceUpdate: 'market:price:update'
}
```

### 4.3 오프라인 지원
- **로컬 캐싱**: Core Data를 사용한 거래 기록 저장
- **동기화**: 온라인 복귀시 자동 서버 동기화
- **오프라인 모드**: 기본적인 인벤토리 관리 가능

## 5. 📊 사용자 경험 플로우

### 5.1 첫 실행 온보딩
1. **위치 권한 요청** → GPS 사용 설명
2. **게임 튜토리얼** → 첫 상인과의 거래 체험
3. **캐릭터 생성** → 닉네임 설정 및 초기 아이템 지급

### 5.2 일반적인 게임플레이 루프
1. **맵 확인** → 주변 상인 탐색
2. **이동** → 목표 상인에게 이동
3. **거래** → 아이템 구매/판매
4. **수익 확인** → 거래 결과 분석
5. **퀘스트 확인** → 진행상황 체크

### 5.3 소셜 기능
- **친구 시스템**: 같은 지역 플레이어들과 네트워킹
- **길드 기능**: 협력하여 대규모 거래 진행
- **랭킹 시스템**: 지역별/전국 수익 순위

## 6. 🎯 성과 지표 (KPI)

### 6.1 사용자 참여도
- **일일 활성 사용자 (DAU)**
- **평균 세션 시간**
- **거래 완료율**
- **위치 이동 거리**

### 6.2 게임 경제
- **일일 거래량**
- **평균 거래 수익**
- **아이템 인플레이션율**
- **상인별 거래 빈도**

### 6.3 유저 리텐션
- **7일 리텐션율**
- **30일 리텐션율**
- **퀘스트 완료율**
- **레벨업 소요시간**

---

## 다음 단계
1. **프로토타입 제작**: Figma에서 주요 화면 디자인
2. **기술적 검증**: GPS 정확도 및 배터리 최적화 테스트
3. **사용자 테스트**: 초기 사용자 그룹 대상 베타 테스트
4. **서버 최적화**: 실시간 위치 업데이트 성능 개선