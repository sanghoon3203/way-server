# Way Server 온보딩 & 초기화 가이드

## 1. 프로젝트 개요
- **역할**: 모바일/웹 클라이언트를 위한 Way Trading Game 백엔드. Express 기반 REST API, Socket.IO 실시간 채널, 어드민 대시보드를 제공한다.
- **주요 스택**: Node.js (>=18), Express, Socket.IO, SQLite3, EJS, Winston, dotenv.
- **데이터 저장소**: SQLite 파일(`./data/way_game.sqlite` 기본값). `DatabaseManager`가 테이블/인덱스 생성과 연결 관리를 담당하며, Admin 확장 스키마를 통해 퀘스트/성취/스킬/메트릭/어드민 관련 테이블을 자동 생성한다.
- **모듈 구성**:
  - `src/server.js`: 서버 진입점. DB 초기화 → 마이그레이션 → 시드 → HTTP 서버/Socket.IO 구동 → 메트릭 수집 시작.
  - `src/app.js`: Express 설정과 미들웨어, 라우트 매핑, 공용 응답 처리 담당.
  - `src/routes/**`: REST API(유저, 플레이어, 상인, 거래, 퀘스트, 성취, 스킬, 개인 아이템)와 게임/어드민 전용 라우트.
  - `src/socket/handlers/**`: 위치·거래·채팅 이벤트를 처리하는 Socket.IO 네임스페이스.
  - `src/services/**`: 어드민용 CRUD/메트릭/폼 생성 서비스 및 게임 퀘스트/스토리 서비스.
  - `src/database/**`: DB 관리자, 마이그레이션, 시드, 관리자 전용 확장 로직.

## 2. 빠른 시작
### 요구사항
- Node.js 18 이상, npm
- SQLite3 (동봉된 `sqlite3` 패키지가 바이너리를 설치)
- `.env` 작성 (필수 키: `JWT_SECRET`, `JWT_REFRESH_SECRET`, `SESSION_SECRET`)

### 설치 & 초기화
```bash
npm install
npm run migrate   # sqlite 파일과 모든 테이블 생성
npm run seed      # 기본 상인/퀘스트/스토리 데이터 시드
```
> `npm run build`는 `migrate` 후 `seed`를 순차 실행한다. `RUN_SEED=true` 환경변수로 서버 구동 시 강제 리시드 가능.

### 실행
```bash
npm run dev   # nodemon 기반 개발 서버
npm start     # 프로덕션 모드 (dotenv 로드)
```
- 서버 기동 시 `console.info`로 핵심 ENV 존재 여부, DB 경로, 환경 정보를 로그한다.
- 종료 시그널(SIGINT/SIGTERM) 수신 시 Socket/DB/메트릭을 정리하며 우아하게 종료.

## 3. 디렉토리 맵
| 경로 | 설명 |
| --- | --- |
| `src/app.js` | Express 앱 생성, 보안/세션/CORS/정적/에러 미들웨어 구성 |
| `src/server.js` | HTTP + Socket.IO 초기화, DB 마이그레이션 & 시드 실행, 메트릭 수집 시작 |
| `src/config/logger.js` | Winston 로거 설정 (파일 및 콘솔, 로그 폴더 자동 생성) |
| `src/constants/merchantDialogues.js` | 상인 대화 스크립트 기본값 |
| `src/controllers/**` | 어드민/대시보드용 컨트롤러, EJS 렌더링 |
| `src/database/**` | DB 접속(`DatabaseManager`), 어드민 확장 스키마(`AdminExtensions`), 마이그레이션·시드 스크립트 |
| `src/middleware/**` | 인증(`auth`/`adminAuth`), 오류 처리, 업로드 처리 |
| `src/routes/api/**` | 도메인별 REST API |
| `src/routes/game/quests.js` | 모바일(iOS) 전용 퀘스트 API |
| `src/routes/admin/**` | 어드민 라우트, HTML/JSON 혼합 응답 |
| `src/services/admin/**` | 어드민 CRUD/메트릭/폼/미디어 서비스 |
| `src/services/game/**` | 퀘스트·스토리 로직 (클라이언트와 공유) |
| `src/socket/handlers/**` | 위치/거래/채팅 실시간 이벤트 |
| `src/utils/**` | 메트릭 수집기(`MetricsCollector`), 표준 응답 도우미 |
| `public/**` | 정적 자산, 어드민 프론트(JS/CSS), 상인 이미지 업로드 경로 |
| `scripts/update_merchant_json.js` | 상인 JSON 갱신 유틸 스크립트 |
| `data/` | SQLite DB 파일 저장소 |
| `logs/` | Winston 로그 파일 (`combined.log`, `error.log`) |

## 4. 환경 변수
| 변수 | 설명 | 기본값 |
| --- | --- | --- |
| `NODE_ENV` | `production`일 경우 `trust proxy`, secure 쿠키, 콘솔 로그 제외 | `development` |
| `PORT` | Express/Socket.IO 포트 | `3000` |
| `DB_PATH` | SQLite 파일 경로 | `./data/way_game.sqlite` |
| `JWT_SECRET` | 액세스 토큰 서명 키 | _필수_ |
| `JWT_REFRESH_SECRET` | 리프레시 토큰 서명 키 | _필수_ |
| `JWT_EXPIRES_IN` | 액세스 토큰 만료 기간 | `1h` |
| `JWT_REFRESH_EXPIRES_IN` | 리프레시 토큰 만료 기간 | `7d` |
| `SESSION_SECRET` | 어드민 세션 서명 키 | `way3-admin-secret-key` |
| `ALLOWED_ORIGINS` | CORS 허용 origin 목록 (`,` 구분) | `http://localhost:3000` |
| `RATE_LIMIT_WINDOW_MS` | API rate limit 윈도우(ms) | `900000` (15분) |
| `RATE_LIMIT_MAX_REQUESTS` | 윈도우당 허용 요청 수 | `100` |
| `LOG_LEVEL` | Winston 최소 로그 레벨 | `info` |
| `RUN_SEED` | 서버 구동 시 강제 시드 실행 여부 | `false` |
| `PASSWORD_RESET_EXPIRY_MINUTES` | 비밀번호 재설정 토큰 만료 | `10` |

## 5. npm 스크립트 & 유틸
| 스크립트 | 목적 |
| --- | --- |
| `npm start` | 프로덕션 모드 서버 기동 (`node src/server.js`) |
| `npm run dev` | Nodemon 개발 서버 |
| `npm run test` | Jest 테스트 (현재 구현 없음) |
| `npm run migrate` | `src/database/migrate.js` 실행 → 마이그레이션 SQL 적용 |
| `npm run seed` | `src/database/seed.js` 실행 → 기본 데이터 삽입 |
| `npm run build` | 마이그레이션 후 시드 실행 (배포 초기화 용도) |
| `scripts/update_merchant_json.js` | 상인 JSON/미디어 동기화 보조 스크립트 |

## 6. 데이터베이스
### 마이그레이션 & 시드
- `src/database/migrate.js`: `src/database/migrations/*.sql` 순차 실행. 확장 스키마(`AdminExtensions`)까지 포함.
- `src/database/seed.js`: 상인, 아이템, 퀘스트, 스토리 등 기본 데이터 삽입. 이미 데이터가 있으면 skip, `force` 옵션 시 재시드.
- `src/database/merchant_data/` 및 `seeds/` 디렉터리가 JSON/SQL 시드를 제공.

### 핵심 테이블 요약
- **코어**: `users`, `players`, `item_templates`, `player_items`, `merchants`, `merchant_inventory`, `merchant_relationships`, `trade_records`, `player_sessions`, `activity_logs`, `password_reset_tokens`.
- **퀘스트 & 스토리**: `quest_templates`, `player_quests`, `quest_completions`, `story_nodes`, `story_branches` 등(마이그레이션/시드).
- **스킬**: `skill_templates`, `player_skills`, `skill_usage_logs`.
- **성취**: `achievement_templates`, `player_achievements`, `achievement_completions`.
- **어드민 & 분석**: `admin_users`, `admin_action_logs`, `system_settings`, `game_events`, `player_analytics`, `economy_analytics`, `server_metrics`, `merchant_dialogues`, `merchant_dialogue_logs` 등.
- **인덱스**: 주요 FK/조회 필드에 대한 인덱스가 `DatabaseManager.createIndexes` 및 `AdminExtensions`에서 자동 생성된다.

## 7. 런타임 구성 요소
### 서버 & Express층
- **HTTP 서버**: `http.createServer(app)` 후 Socket.IO attach. pingInterval/pingTimeout 튜닝 및 모바일 친화적 transport(`websocket`, `polling`) 허용.
- **CORS**: 모바일 origin이 없는 경우 허용, 로컬 IP 패턴(192/10/172) 자동 허용.
- **Helmet & RateLimit**: 보안 헤더 + `/api/` prefix에 rate limit 적용.
- **세션**: 어드민 EJS 뷰 보호용 익스프레스 세션. 프로덕션에서 secure 쿠키 강제.
- **정적 파일**: `/public`(공용), `/admin`(어드민 프론트), `/uploads`(상인 미디어) 서빙.
- **로깅**: 요청마다 응답 완료 시 Winston info 로그 남김.
- **헬스체크**: `GET /` 기본 상태, `GET /health` 상세 프로세스 메트릭.

### 미들웨어
- `middleware/auth.js`: JWT 인증. `Authorization: Bearer` 헤더 파싱, payload(`userId`,`playerId`) 검증.
- `middleware/adminAuth.js`: 어드민 세션/JWT 검증(추후 토큰 가드 예정).
- `middleware/errorHandler.js`: NotFound/에러 응답 표준화 및 검증.
- `middleware/uploadMiddleware.js`: Multer 기반 업로드 (상인 이미지 등).

### 서비스 레이어
- `services/admin/EnhancedMetricsService`: 대시보드/모니터링/경제/플레이어 분석 메트릭 집계 & 캐싱, 캐시 삭제 기능 제공.
- `services/admin/CRUDService`: DB CRUD 헬퍼(어드민 폼/테이블 관리용).
- `services/admin/MerchantMediaService`: 상인 이미지/미디어 업로드 관리.
- `services/admin/QuestService`, `SkillService`: 어드민 퀘스트/스킬 관리 지원.
- `services/game/QuestPlayerService`: 플레이어 퀘스트 오버뷰/프로그레스 조합 로직.
- `services/game/StoryService`: 스토리/대화 노드 조회 로직.

### 메트릭 & 로깅
- `utils/MetricsCollector`: 5분 간격 서버/게임 메트릭 수집, 30초마다 배치 플러시. `server_metrics` 및 `activity_logs` 테이블 사용.
- Winston 파일 로그(`logs/combined.log`, `logs/error.log`) + 개발 콘솔 출력.

## 8. REST API 개요
> 모든 `/api/**` 엔드포인트는 JSON 응답 표준(`success`, `data`, `error`)을 따른다. 인증 필요 여부는 JWT 헤더 기준.

### 인증 (`src/routes/api/auth.js`)
| 메서드 & 경로 | 인증 | 설명 |
| --- | --- | --- |
| `POST /api/auth/register` | ❌ | 이메일/비밀번호/플레이어명 등록, 기본 플레이어 생성 |
| `POST /api/auth/login` | ❌ | 이메일+비밀번호 로그인, JWT & 리프레시 토큰 발급 |
| `POST /api/auth/refresh` | ❌ | 리프레시 토큰으로 액세스 토큰 재발급 |
| `POST /api/auth/logout` | ✅(선택) | 논리적 로그아웃 응답 (블랙리스트 미구현) |
| `POST /api/auth/password/reset/request` | ❌ | 비밀번호 재설정 토큰 발급 (SHA256 해시 저장) |
| `POST /api/auth/password/reset/verify` | ❌ | 토큰 검증 후 새 비밀번호 설정 |

### 플레이어 (`src/routes/api/player.js`)
| 메서드 & 경로 | 인증 | 설명 |
| --- | --- | --- |
| `GET /api/player/profile` | ✅ | 플레이어 상세, 인벤토리, 최근 거래, 통계 조회 |
| `PUT /api/player/location` | ✅ | 현재 위치 업데이트 + 활동 로그 |
| `POST /api/player/increase-stat` | ✅ | 능력치 포인트 분배 (`strength/intelligence/charisma/luck`) |
| `POST /api/player/increase-skill` | ✅ | 스킬 포인트 분배 (`trading/negotiation/appraisal`) |
| `POST /api/player/create-profile` | ✅ | 최초 가입 직후 프로필 확정(나이/성별/성격) |
| `PUT /api/player/profile` | ✅ | 프로필 필드 업데이트 |
| `POST /api/player/upgrade-license` | ✅ | 라이선스 등급 업그레이드 (비용/신뢰도 차감) |

### 상인 (`src/routes/api/merchants.js`)
| 메서드 & 경로 | 인증 | 설명 |
| --- | --- | --- |
| `GET /api/merchants/nearby?lat&lng&radius` | ✅ | 반경 내 상인 목록 + 거래 가능 여부 |
| `GET /api/merchants/:merchantId` | ✅ | 상인 상세, 인벤토리, 관계/선호도, 스토리 상태 |
| `GET /api/merchants/:merchantId/dialogues` | ✅ | 대화 스크립트(트리거별), fallback 포함 |
| `GET /api/merchants` | ✅ | 모든 활성 상인 목록 (관리 뷰용) |

### 거래 (`src/routes/api/trade.js`)
| 메서드 & 경로 | 인증 | 설명 |
| --- | --- | --- |
| `POST /api/trade/execute` | ✅ | 플레이어↔상인 거래 실행(구매/판매, 재고/자금/협상 로직) |
| `GET /api/trade/history` *(파일 내 구현 시)* | ✅ | 최근 거래 기록, 요약 (존재 시) |
| `GET /api/trade/pricing` *(조건부)* | ✅ | 아이템 가격/시장 데이터 (파일 내 구현 여부 확인) |
> `trade.js`는 거래 기록 생성, 경험치/수익 계산, 활동 로그 기록 포함. 실패 시 적절한 오류 응답 제공.

### 퀘스트 (`src/routes/api/quests.js`)
| 메서드 & 경로 | 인증 | 설명 |
| --- | --- | --- |
| `GET /api/quests` | ✅ | 플레이어 퀘스트 오버뷰(진행/완료 상태 포함) |
| `GET /api/quests/available` | ✅ | 수행 가능 퀘스트 리스트(레벨/라이선스/선행 조건 필터) |
| `GET /api/quests/active` | ✅ | 진행 중 퀘스트 상세 |
| `POST /api/quests/:questId/accept` | ✅ | 퀘스트 수락 (중복/조건 검사) |
| `POST /api/quests/:questId/abandon` | ✅ | 퀘스트 포기 |
| `POST /api/quests/:questId/complete` | ✅ | 조건 충족 시 완료 처리 |
| `POST /api/quests/:questId/claim` | ✅ | 완료된 퀘스트 보상 수령 |
| `POST /api/quests/:questId/progress` | ✅ | 진행률 업데이트 (이벤트 기반) |

### 성취 (`src/routes/api/achievements.js`)
| 메서드 & 경로 | 인증 | 설명 |
| --- | --- | --- |
| `GET /api/achievements` | ✅ | 카테고리별 성취 목록 + 진행 통계 |
| `GET /api/achievements/:id` | ✅ | 특정 성취 상세 (비밀 성취 마스킹) |
| `POST /api/achievements/progress` | ✅ | 성취 진행 업데이트 (게임 로직 연동용) |

### 스킬 (`src/routes/api/skills.js`)
| 메서드 & 경로 | 인증 | 설명 |
| --- | --- | --- |
| `GET /api/skills/tree` | ✅ | 스킬 트리 목록 (티어/요구조건/효과) |
| `GET /api/skills/player` | ✅ | 플레이어 스킬 보유 상황 |
| `POST /api/skills/learn` | ✅ | 스킬 해금/업그레이드 |
| `POST /api/skills/use` | ✅ | 스킬 사용 기록 저장 |

### 개인 아이템 (`src/routes/api/personal-items.js`)
| 메서드 & 경로 | 인증 | 설명 |
| --- | --- | --- |
| `GET /api/personal-items` | ✅ | 플레이어 개인화 아이템 목록 |
| `POST /api/personal-items` | ✅ | 아이템 생성/저장 |
| `PUT /api/personal-items/:id` | ✅ | 아이템 업데이트 |
| `DELETE /api/personal-items/:id` | ✅ | 아이템 삭제 |

### 게임 클라이언트 전용 (`src/routes/game/quests.js`)
| 메서드 & 경로 | 인증 | 설명 |
| --- | --- | --- |
| `GET /game/quests` | ✅ | iOS용 퀘스트 오버뷰 (API와 동일 응답) |
| `POST /game/quests/:questId/accept` | ✅ | 퀘스트 수락 |
| `POST /game/quests/:questId/claim` | ✅ | 보상 수령 |
| `POST /game/quests/:questId/progress` | ✅ | 진행률 업데이트 |

### 기타 공용 라우트
| 경로 | 설명 |
| --- | --- |
| `GET /` | 서버 상태/버전/엔드포인트 안내 |
| `GET /health` | 업타임, 메모리, Node 버전 반환 |

## 9. Socket.IO 이벤트 개요
> 모든 소켓 연결은 `handshake.auth.token` JWT 검증 후 진행. 플레이어별 룸(`player:{id}`)과 구역 룸(`district:{name}`)에 가입한다.

### 공통
- `connection:success` (서버→클라이언트): 연결 성공 알림
- `ping` / `pong`: 연결 상태 체크
- `player:status_update` (클라이언트→서버): 활동 상태, 동일 구역 플레이어에게 `player:status_changed`
- `disconnect`: 활동 로그 작성, 구역 퇴장 브로드캐스트
- `system:announcement` (서버→모두): 서버 종료/공지 브로드캐스트

### 위치(`locationHandler`)
- `location:update`: 위·경도 갱신 → DB 저장, 구역 이동 시 `location:district_changed`, 주변 상인 목록 제공
- `players:get_nearby`: 반경 내 온라인 플레이어 목록 → `players:nearby_list`
- 브로드캐스트: `player:location_update`, `player:entered_district`, `player:left_district`

### 거래(`tradeHandler`)
- `trade:completed`: 거래 완료시 동일 구역 플레이어에 `trade:nearby_activity`, 시장 가격 변동 시 `market:price_update`
- `trade:offer`: 플레이어 간 거래 제안, 대상에게 `trade:offer_received`
- `market:get_prices`: 최근 거래 기반 가격 통계 → `market:price_data`

### 채팅(`chatHandler`)
- `chat:district_message`: 구역 채팅 브로드캐스트
- `chat:private_message`: 귓속말 송수신 (`chat:private_message_received`, `chat:private_message_sent`)
- `chat:system_announcement`: (향후) 관리자 공지 브로드캐스트

## 10. 어드민 & 모니터링
- **라우트**: `/admin` 루트는 `UnifiedAdminController`가 HTML 스트링을 직접 렌더링.
  - `/admin` 메인 대시보드: 주요 메트릭 요약.
  - `/admin/monitoring`: 실시간 서버/플레이어/경제 모니터.
  - `/admin/analytics/players`, `/admin/analytics/economy`: 기간(range)별 분석.
  - `/admin/api/metrics?type=`: JSON 메트릭 반환 (`dashboard`, `monitoring`, `players`, `economy`).
  - `/admin/api/live`: 빠른 상태 요약 (활성 플레이어, 서버 상태, 알림).
  - `/admin/api/cache/clear`: 메트릭 캐시 삭제 (pattern 옵션).
- **템플릿**: `src/views/**`에 EJS 템플릿. 정적 자산은 `public/admin/**`.
- **세션**: Express-session 기반. 프로덕션에서 secure 쿠키.
- **미디어**: `MerchantMediaService`가 `/uploads`에 상인 이미지 저장, `public/merchants`로 제공.

## 11. 로깅 & 메트릭 파이프라인
- **Winston**: JSON 로그를 파일 저장, 개발 시 컬러 콘솔 출력. 에러 스택 포함.
- **MetricsCollector**: 5분 간격으로 서버/플레이어/경제/활동 메트릭을 계산해 `server_metrics`에 저장, 이벤트 큐를 `activity_logs`에 플러시.
- **요청 로그**: 모든 HTTP 요청 응답 후 `method url status duration` 형식으로 info 로그.
- **활동 로그**: 주요 도메인 동작(위치 업데이트, 거래, 채팅, 프로필 변경 등)마다 `activity_logs`에 JSON 세부정보 저장.

## 12. 로컬 리소스 & 작업 흐름
- **DB 위치**: 기본 `./data/way_game.sqlite`. 로컬 개발 시 `data/` 폴더가 자동 생성.
- **로그**: `logs/combined.log`, `logs/error.log`는 자동 롤링(5MB, 다중 파일) 설정.
- **업로드**: `/uploads` 폴더에 상인 미디어 저장. 버전 관리에서 제외되었는지 확인 필요.
- **스크립트**: `start_server.sh`는 배포 환경에서 서버 실행/백그라운드 관리용.
- **테스트**: Jest 설정은 있으나 테스트 없음. 새 기능 추가 시 도메인별 테스트 작성 권장.

## 13. 개발 체크리스트 & 다음 단계
1. **환경 변수 템플릿 작성**: `.env.example` 추가 고려 (JWT/DB/세션 키 안내).
2. **테스트 보강**: 인증/거래/퀘스트 흐름에 대한 통합 테스트 도입 (sqlite 메모리모드).
3. **어드민 인증 강화**: `AdminAuth.authenticateToken` 적용 및 관리자 로그인 흐름 구현 필요.
4. **Socket 보안**: `chat:system_announcement` 관리자 권한 검증 구현.
5. **데이터 정합성**: 시드/마이그레이션 실행 여부를 CI나 start 스크립트에서 검증.
6. **모바일 연동 문서화**: Socket 이벤트 및 REST 호출 시퀀스를 모바일 팀과 공유.

---
이 문서는 Way Server 검토 결과를 토대로 작성되었다. 신규 기여자는 위 내용을 순서대로 따라 하면 로컬 환경을 구성하고 주요 도메인 로직을 빠르게 이해할 수 있다. 변경 사항이 생기면 본 파일(`claudedocs/Way_Server_Onboarding.md`)을 최신화해 팀 공유용으로 활용하자.
