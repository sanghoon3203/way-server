# 서버 슬림화 + 진행도 동기화 설계

**날짜**: 2026-02-26
**프로젝트**: connect:seoul (way-server)
**접근법**: A — 서버 역할 명확히 분리 + 스토리 진행도 동기화 추가

---

## 1. 서버 역할 분리

### 서버 저장 (Source of Truth)

| 데이터 | 테이블 |
|--------|--------|
| 계정/인증 | `users`, `password_reset_tokens` |
| 플레이어 스탯 | `players` |
| 인벤토리/창고 | `player_items` |
| 거래 이력 | `trade_records` |
| 상인 관계도 | `merchant_relationships` |
| 스토리 진행도 (신규) | `player_story_progress` |
| 상인/아이템 정의 | `merchants`, `item_templates`, `merchant_inventory` |
| 어드민 | `admin_users`, `admin_action_logs`, `system_settings`, `game_events` |
| 상인 선호도 | `merchant_preferences` |

### 앱 로컬 유지 (변경 없음)

| 데이터 | 위치 |
|--------|------|
| VNNode JSON | `way3/StoryData/` |
| 퀘스트/챕터 정의 | `way3/GameData/` |
| 세부 퀘스트 진행 (오프라인) | `ProgressManager` |

### player_story_progress 스키마

```sql
CREATE TABLE IF NOT EXISTS player_story_progress (
  player_id            TEXT PRIMARY KEY REFERENCES players(id),
  completed_chapters   TEXT DEFAULT '[]',
  completed_episodes   TEXT DEFAULT '[]',
  completed_sub_quests TEXT DEFAULT '[]',
  unlocked_episodes    TEXT DEFAULT '[]',
  key_items            TEXT DEFAULT '[]',
  last_synced_at       DATETIME DEFAULT CURRENT_TIMESTAMP
);
```

앱의 `PlayerProgress` 구조체와 1:1 매핑.

---

## 2. 제거할 테이블

| 테이블 | 이유 |
|--------|------|
| `skills` | 앱에 스킬 시스템 없음 |
| `story_nodes` | 앱은 JSON 파일 기반, 서버 버전 미사용 |
| `merchant_dialogues` | `DialogueDataManager`가 로컬 JSON 처리 |
| `quest_templates` | 앱은 `GameData/main_quests.json` 기반 |
| `player_quests` | 앱 `ProgressManager`와 완전히 분리 |
| `quest_completions` | 동일 |
| `achievement_templates` | 앱에서 서버 연동 없음 |
| `player_achievements` | 동일 |
| `achievement_completions` | 동일 |
| `economy_analytics` | 미사용 |
| `player_analytics` | 미사용 |
| `server_metrics` | 미사용 |
| `player_sessions` | JWT가 세션 역할 대체 |
| `activity_logs` | `admin_action_logs`와 중복, 앱에서 기록 안 함 |

## 제거할 라우트/코드

| 파일 | 처리 |
|------|------|
| `routes/api/quests.js` | 제거 |
| `routes/api/achievements.js` | 제거 |
| `routes/api/story.js` | 진행도 동기화 전용으로 재작성 |

## 제거할 패키지

| 패키지 | 대체 |
|--------|------|
| `moment` | Node.js 내장 `Date` |
| `express-session` | 불필요 (Bearer 토큰 방식) |

---

## 3. 신규 API

```
GET  /api/story/progress   → 서버에서 진행도 fetch
POST /api/story/sync       → 앱 → 서버 동기화
     body: {
       completedChapters,
       completedEpisodes,
       completedSubQuests,
       unlockedEpisodes,
       keyItems
     }
```

### 동기화 흐름

```
앱 시작
  → 로컬 ProgressManager 즉시 로드 (오프라인 가능)
  → 백그라운드 GET /api/story/progress
  → 서버 last_synced_at > 로컬이면 덮어쓰기

챕터/에피소드 완료
  → 로컬 저장
  → POST /api/story/sync (백그라운드)
```

---

## 4. 어드민 인증 수정

- EC2 `.env`에 `ADMIN_SECRET=<강력한 값>` 명시
- `public/admin.html` 로그인 후 토큰을 localStorage에 저장, 모든 `/admin/api/*` 요청에 `Authorization: Bearer <token>` 헤더 포함하도록 수정

---

## 5. JWT 미들웨어 경량화

현재: 매 요청마다 `users` + `players` 2번 DB 조회
개선: JWT payload에 필요한 정보 포함, DB 조회 최소화

---

## 6. S3 백업 전략 (EC2 crontab)

```bash
# EC2 crontab -e 등록
# 매일 새벽 3시 SQLite → S3 백업
0 3 * * * aws s3 cp ~/way-server/data/way_game.sqlite \
  s3://projects-data/way-server/backups/way_game_$(date +\%Y\%m\%d).sqlite

# 매일 새벽 4시 7일 이전 백업 삭제
0 4 * * * aws s3 ls s3://projects-data/way-server/backups/ | \
  awk '{print $4}' | sort | head -n -7 | \
  xargs -I{} aws s3 rm s3://projects-data/way-server/backups/{}
```

복구:
```bash
aws s3 cp s3://projects-data/way-server/backups/way_game_YYYYMMDD.sqlite \
  ~/way-server/data/way_game.sqlite
pm2 restart way-server  # 또는 node 재시작
```

---

## 구현 순서

1. 제거할 테이블 DROP 마이그레이션 작성
2. `player_story_progress` 테이블 생성 마이그레이션
3. `routes/api/story.js` 재작성 (sync API)
4. `routes/api/quests.js`, `achievements.js` 제거
5. `app.js`에서 제거된 라우트 연결 해제
6. `moment`, `express-session` 패키지 제거
7. 어드민 HTML 인증 수정
8. JWT 미들웨어 경량화
9. iOS 앱 — `NetworkManager`에 story sync 호출 추가
10. EC2 crontab S3 백업 등록
