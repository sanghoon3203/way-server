# WAY-SERVER (WAY3 게임 서버)

네오-서울을 무대로 한 WAY3 트레이딩 게임의 백엔드입니다. Express 기반 REST API와 Socket.IO 실시간 채널, SQLite 데이터베이스, 관리자용 EJS 뷰를 한 프로젝트 안에서 제공하며 Railway 등 컨테이너 환경을 염두에 두고 설계되었습니다.

## 기술 스택

- **런타임**: Node.js 18+
- **프레임워크**: Express 4, Socket.IO 4
- **데이터베이스**: SQLite3 (파일 경로 기본값 `./data/way_game.sqlite`)
- **보안/미들웨어**: Helmet, CORS, express-session, express-rate-limit, bcrypt, JWT(JSON Web Token)
- **로깅 & 유틸리티**: Winston, dotenv, uuid, moment, multer/sharp(이미지 업로드)

## 주요 폴더

| 경로 | 설명 |
| --- | --- |
| `src/app.js` | Express 앱 설정, 공통 미들웨어, 정적 리소스 제공 |
| `src/server.js` | 서버 진입점. DB 초기화, 마이그레이션/시드 실행, Socket.IO 설정, 종료 시그널 처리 |
| `src/routes` | REST API 라우트 (auth, player, merchants, trade, quests 등)와 관리자용 라우트 |
| `src/controllers` / `src/services` | 도메인 로직 분리. 컨트롤러 ↔ 서비스 ↔ DB 계층 구조 |
| `src/database` | SQLite 매니저(`DatabaseManager`), 마이그레이션/시드 스크립트, JSON 데이터 |
| `src/socket` | 실시간 위치·거래 알림 등 Socket.IO 이벤트 핸들러 |
| `public/admin` | 관리자 대시보드 정적 자원(EJS에서 불러오는 JS/CSS) |
| `scripts` | 로그/데이터 정리 등의 보조 스크립트 |
| `claudedocs/` | API·시스템 설계 문서 모음 (Claude 기반) |
| `data/` | SQLite 파일이 저장되는 기본 디렉터리 (`DB_PATH` 변경 가능) |
| `logs/`, `migrate.log` | 실행 로그 및 마이그레이션 기록 |

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
```

- **`PORT`**: Express/Socket.IO 포트. 기본 3000  
- **`DB_PATH`**: SQLite 파일 경로. 컨테이너 배포 시 `./data/way_game.sqlite`를 볼륨에 매핑하는 것을 권장  
- **`JWT_SECRET`, `JWT_REFRESH_SECRET`**: Access / Refresh 토큰 서명용  
- **`SESSION_SECRET`**: 관리자 세션 쿠키 서명  
- **`ALLOWED_ORIGINS`**: CORS 및 Socket.IO 허용 오리진(콤마 구분). 모바일 앱(WKWebView) 요청은 origin 없이도 허용  
- **`RATE_LIMIT_*`**: `/api/*` 레이트리밋 창과 최대 요청 수  
- **`RUN_SEED`**: `true` 설정 시 서버 기동 때마다 강제 시드(기존 데이터 초기화 후 재삽입)

## 데이터베이스 & 마이그레이션

- SQLite를 파일 기반으로 사용합니다. DB 매니저(`src/database/DatabaseManager.js`)가 데이터 디렉터리를 자동 생성하고 외래키 제약을 활성화합니다.
- 마이그레이션 파일은 `src/database/migrations`에 숫자 prefix로 정렬되어 있으며 `npm run migrate`가 순서대로 실행합니다.
  - `007_personal_items_schema.sql` 이후에 `010_temp_license_item.sql`을 실행해야 `personal_item_templates` 관련 에러가 나지 않습니다. `migrate` 스크립트는 항상 모든 파일을 순회하므로 추가 조치가 필요 없지만, 수동으로 실행한다면 순서에 유의하세요.
- `npm run seed`는 기본 상인/아이템/스토리 데이터를 채워 넣습니다. `RUN_SEED=true` 환경 변수를 주면 서버 기동 시에도 강제 시드를 수행합니다.

## API & 실시간 채널

- REST API는 `/api/*` 경로에 위치하며 인증, 플레이어, 상인, 거래, 퀘스트, 업적, 스킬 등으로 모듈화되어 있습니다.
- Socket.IO 서버는 동일 포트에서 실행되며 위치 추적, 거래 알림 등 실시간 이벤트를 제공합니다. 모바일 환경을 고려해 origin 이 없는 요청과 로컬 네트워크 IP 패턴을 허용하도록 설정되어 있습니다.

## 관리자/정적 자원

- `public/admin` 이하의 정적 파일을 `/admin` 경로로 서빙하며, EJS 뷰(`src/views`)에서 관리자 대시보드를 렌더링합니다.
- 로그인 세션은 `express-session`과 `SESSION_SECRET` 기반 쿠키로 관리합니다.

## 배포 팁

- Railway 배포 템플릿(`railway.toml`)이 포함되어 있습니다.  
- SQLite 파일(`data/way_game.sqlite`)을 영구 스토리지 또는 외부 볼륨에 매핑하지 않으면 컨테이너 재시작 시 데이터가 초기화됩니다.  
- `npm run build` 단계에서 마이그레이션/시드를 수행하므로, fail-safe를 위해 환경 변수(특히 JWT 관련)와 데이터 디렉터리 권한을 반드시 세팅하세요.

## 자주 발생하는 이슈

| 증상 | 해결책 |
| --- | --- |
| `no such table: personal_item_templates` | `npm run migrate`를 실행해 007번 이후 마이그레이션이 적용되었는지 확인 |
| `SQLITE_BUSY: database is locked` | 다른 프로세스가 같은 DB 파일을 사용 중인지 확인. 개발 환경에서는 nodemon 중복 실행을 중지 |
| CORS 차단 log | `.env`의 `ALLOWED_ORIGINS`에 클라이언트 주소를 추가하거나, 모바일 테스트 시 origin이 비어 있는지 확인 |

## 참고 문서

- `claudedocs/way-server_controllers_routes.md`: 컨트롤러별 상세 설명  
- `claudedocs/Game_System_Restructure_Plan.md`: 게임 시스템/데이터 구조 레퍼런스  
- `ADMIN_REFACTOR.md`, `CLEANUP_PLAN.md`: 레거시 정리 및 리팩터 계획

필요에 따라 `start_server.sh`(개발 편의용 스크립트)나 `scripts/` 디렉터리를 참고하여 로그 정리, 백업 등을 자동화할 수 있습니다. Bugs/개선 요청은 GitHub Issues 또는 팀 커뮤니케이션 채널로 공유해주세요.
