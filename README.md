# WAY-SERVER (connect:seoul 게임 서버)

네오-서울을 무대로 한 connect:seoul 트레이딩 게임의 백엔드입니다. Express 기반 REST API, SQLite 데이터베이스, 관리자용 EJS 뷰, Gemini AI 상인 채팅을 한 프로젝트 안에서 제공하며 Railway 등 컨테이너 환경을 염두에 두고 설계되었습니다.

**최종 업데이트**: 2026-02-20

## 기술 스택

- **런타임**: Node.js 18+
- **프레임워크**: Express 4
- **데이터베이스**: SQLite3 (파일 경로 기본값 `./data/way_game.sqlite`)
- **보안/미들웨어**: Helmet, CORS, express-session, express-rate-limit, bcrypt, JWT
- **AI**: Google Generative AI (Gemini 1.5 Flash) — 상인 채팅
- **로깅 & 유틸리티**: Winston, dotenv, uuid, moment, multer/sharp(이미지 업로드)

## 주요 폴더

| 경로 | 설명 |
| --- | --- |
| `src/app.js` | Express 앱 설정, 공통 미들웨어, 정적 리소스 제공 |
| `src/server.js` | 서버 진입점. DB 초기화, 마이그레이션/시드 실행, 종료 시그널 처리 |
| `src/routes/api/` | REST API 라우트 (auth, player, merchants, trade, quests, merchant-chat 등) |
| `src/routes/admin/` | 관리자용 라우트 (EJS 렌더링) |
| `src/controllers/` `src/services/` | 도메인 로직 분리. 컨트롤러 ↔ 서비스 ↔ DB 계층 구조 |
| `src/constants/merchantPersonas.js` | 상인 9명 AI 인격 정의 (Gemini 시스템 프롬프트 + 언락 트리거) |
| `src/services/merchantChatService.js` | Gemini API 연동 채팅 서비스 |
| `src/database/` | SQLite 매니저(`DatabaseManager`), 마이그레이션/시드 스크립트 |
| `public/admin` | 관리자 대시보드 정적 자원 |
| `scripts/` | 로그/데이터 정리 등의 보조 스크립트 |
| `claudedocs/` | API·시스템 설계 문서 모음 |
| `data/` | SQLite 파일이 저장되는 기본 디렉터리 (`DB_PATH` 변경 가능) |

## 설치 & 실행

```bash
cd way-server
npm install

# (최초 1회) 마이그레이션 & 시드
npm run migrate
npm run seed

# 개발 모드
npm run dev

# 또는 프로덕션 실행
npm start
```

> `npm run build` 는 CI/배포 환경용으로 `migrate → seed` 를 자동 수행하도록 묶어두었습니다.

## 환경 변수 (.env 예시)

```env
NODE_ENV=development
PORT=3000
DB_PATH=./data/way_game.sqlite
JWT_SECRET=change-me
JWT_REFRESH_SECRET=change-me-again
SESSION_SECRET=way3-admin-secret-key
ALLOWED_ORIGINS=http://localhost:5173,http://localhost:3000
RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_MAX_REQUESTS=100
RUN_SEED=false

# Gemini AI (상인 채팅)
GEMINI_API_KEY=your_gemini_api_key_here
```

- **`GEMINI_API_KEY`**: Google AI Studio(https://aistudio.google.com/app/apikey)에서 발급. AI 상인 채팅에 필수.
- **`PORT`**: Express 포트. 기본 3000
- **`DB_PATH`**: SQLite 파일 경로. 컨테이너 배포 시 볼륨 매핑 권장
- **`JWT_SECRET`, `JWT_REFRESH_SECRET`**: Access / Refresh 토큰 서명용
- **`SESSION_SECRET`**: 관리자 세션 쿠키 서명
- **`ALLOWED_ORIGINS`**: CORS 허용 오리진(콤마 구분). 모바일 앱 요청은 origin 없이도 허용
- **`RUN_SEED`**: `true` 설정 시 서버 기동 때마다 강제 시드

## API 엔드포인트

```
/api/auth
  POST /login, /register, /refresh, /logout
  POST /password/reset/request, /password/reset/verify

/api/player
  GET  /profile
  POST /create-profile
  PUT  /profile, /location

/api/merchants
  GET  /               — 전체 상인 목록
  GET  /:id            — 상인 상세
  GET  /nearby         — 근처 상인 (lat, lng, radius)
  POST /:id/relationship/progress
  POST /:id/permit/upgrade
  GET  /:id/story
  POST /:id/story/progress

/api/merchant-chat          ← AI 상인 채팅 (Gemini)
  POST /               — { merchantId, message, history } → { reply, unlockedEpisode }

/api/trade
  POST /execute        — 거래 실행
  GET  /history        — 거래 기록
  GET  /market-prices  — 시장 시세

/api/quests
  GET  /
  POST /:id/start, /:id/complete

/api/personal-items
  GET  /
  POST /use, /equip
  GET  /effects

/api/achievements
  GET  /
  POST /:id/claim
```

## AI 상인 채팅 시스템

`POST /api/merchant-chat` — Gemini 1.5 Flash 기반 캐릭터 자유대화.

**Request** (Bearer Token 필수)
```json
{
  "merchantId": "seoyena",
  "message": "오늘 날씨 참 좋네요",
  "history": [{ "role": "user", "text": "..." }, { "role": "model", "text": "..." }]
}
```

**Response**
```json
{
  "reply": "그러게요, 압구정 봄바람이 참 좋죠.",
  "unlockedEpisode": null
}
```

`unlockedEpisode`가 non-null이면 VN 에피소드 언락 발생.

관련 파일:
- `src/constants/merchantPersonas.js` — 상인 9명 인격 + 언락 트리거 정의
- `src/services/merchantChatService.js` — Gemini API 호출 + 트리거 처리
- `src/routes/api/merchant-chat.js` — Express 라우트

## 데이터베이스 & 마이그레이션

- SQLite 파일 기반. `DatabaseManager.js`가 디렉터리 자동 생성 및 외래키 제약 활성화.
- 마이그레이션 파일: `src/database/migrations/` (숫자 prefix 순서)
- `npm run seed`: 기본 상인/아이템/스토리/성취 데이터 삽입

## 관리자/정적 자원

- `public/admin` → `/admin` 경로로 서빙
- EJS 뷰(`src/views`)에서 관리자 대시보드 렌더링
- 세션: `express-session` + `SESSION_SECRET` 기반 쿠키

## 배포 팁

- Railway 배포 템플릿(`railway.toml`) 포함
- SQLite 파일(`data/way_game.sqlite`)을 영구 스토리지에 매핑하지 않으면 컨테이너 재시작 시 데이터 초기화
- `npm run build` 단계에서 마이그레이션/시드 수행

## 자주 발생하는 이슈

| 증상 | 해결책 |
| --- | --- |
| `no such table: personal_item_templates` | `npm run migrate` 실행 (007번 이후 마이그레이션 확인) |
| `SQLITE_BUSY: database is locked` | 다른 프로세스가 같은 DB 파일 사용 중인지 확인 |
| CORS 차단 log | `.env`의 `ALLOWED_ORIGINS`에 클라이언트 주소 추가 |
| AI 채팅 500 오류 | `.env`의 `GEMINI_API_KEY` 설정 확인 |

## 참고 문서

- `claudedocs/Way_Server_Onboarding.md`: 온보딩 가이드 (DB 스키마, 인증 흐름)
- `claudedocs/Way3_Server_Architecture_Guide.md`: 서버 아키텍처 상세
- `ADMIN_REFACTOR.md`, `CLEANUP_PLAN.md`: 레거시 정리 및 리팩터 계획
