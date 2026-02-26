# 서버 슬림화 + 진행도 동기화 Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** way-server에서 앱이 실제로 사용하지 않는 테이블/라우트/패키지를 제거하고, 스토리 진행도 서버 동기화 API와 S3 백업을 추가한다.

**Architecture:** SQLite 단일 파일 DB를 유지하되 미사용 테이블을 DROP 마이그레이션으로 정리. 신규 `player_story_progress` 테이블로 iOS `PlayerProgress`와 1:1 동기화. 어드민은 Bearer 토큰 방식 그대로 유지하되 HTML 버그 수정.

**Tech Stack:** Node.js 18+, Express, SQLite3, JWT, AWS CLI (S3 백업), Swift/SwiftUI (iOS 클라이언트)

**참고 설계 문서:** `docs/plans/2026-02-26-server-cleanup-design.md`

---

## Task 1: DROP 마이그레이션 파일 작성

**Files:**
- Create: `src/database/migrations/012_cleanup_unused_tables.sql`

**Step 1: 마이그레이션 파일 생성**

```sql
-- 012_cleanup_unused_tables.sql
-- 앱에서 사용하지 않는 테이블 제거

DROP TABLE IF EXISTS economy_analytics;
DROP TABLE IF EXISTS player_analytics;
DROP TABLE IF EXISTS server_metrics;
DROP TABLE IF EXISTS player_sessions;
DROP TABLE IF EXISTS activity_logs;
DROP TABLE IF EXISTS achievement_completions;
DROP TABLE IF EXISTS player_achievements;
DROP TABLE IF EXISTS achievement_templates;
DROP TABLE IF EXISTS quest_completions;
DROP TABLE IF EXISTS player_quests;
DROP TABLE IF EXISTS quest_templates;
DROP TABLE IF EXISTS merchant_dialogues;
DROP TABLE IF EXISTS story_nodes;
DROP TABLE IF EXISTS skills;
```

**Step 2: 마이그레이션 실행**

```bash
cd ~/Documents/GitHub/way-server
node src/database/migrate.js
```

예상 출력: `✅ Migration completed: 012_cleanup_unused_tables.sql`

**Step 3: DB 확인**

```bash
sqlite3 data/way_game.sqlite ".tables"
```

제거된 테이블이 목록에 없는지 확인.

**Step 4: 커밋**

```bash
git add src/database/migrations/012_cleanup_unused_tables.sql
git commit -m "chore: drop unused tables (skills, story_nodes, quests, achievements, analytics)"
```

---

## Task 2: player_story_progress 테이블 추가

**Files:**
- Create: `src/database/migrations/013_player_story_progress.sql`

**Step 1: 마이그레이션 파일 생성**

```sql
-- 013_player_story_progress.sql
-- iOS PlayerProgress와 1:1 매핑하는 진행도 동기화 테이블

CREATE TABLE IF NOT EXISTS player_story_progress (
  player_id            TEXT PRIMARY KEY,
  completed_chapters   TEXT NOT NULL DEFAULT '[]',
  completed_episodes   TEXT NOT NULL DEFAULT '[]',
  completed_sub_quests TEXT NOT NULL DEFAULT '[]',
  unlocked_episodes    TEXT NOT NULL DEFAULT '[]',
  key_items            TEXT NOT NULL DEFAULT '[]',
  last_synced_at       DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (player_id) REFERENCES players(id)
);

CREATE INDEX IF NOT EXISTS idx_story_progress_player
  ON player_story_progress(player_id);
```

**Step 2: 마이그레이션 실행**

```bash
node src/database/migrate.js
```

**Step 3: DB 확인**

```bash
sqlite3 data/way_game.sqlite ".schema player_story_progress"
```

**Step 4: 커밋**

```bash
git add src/database/migrations/013_player_story_progress.sql
git commit -m "feat: add player_story_progress table for iOS sync"
```

---

## Task 3: story.js 라우트 재작성 (진행도 동기화 API)

**Files:**
- Modify: `src/routes/api/story.js` (전체 재작성)

**Step 1: story.js 재작성**

```javascript
// src/routes/api/story.js
const express = require('express');
const router = express.Router();
const { v4: uuidv4 } = require('uuid');
const db = require('../../database/DatabaseManager');
const { authenticateToken } = require('../../middleware/auth');
const logger = require('../../config/logger');

// GET /api/story/progress — 서버에서 진행도 fetch
router.get('/progress', authenticateToken, async (req, res) => {
    try {
        const row = await db.get(
            'SELECT * FROM player_story_progress WHERE player_id = ?',
            [req.user.playerId]
        );

        if (!row) {
            return res.json({
                success: true,
                data: {
                    completedChapters: [],
                    completedEpisodes: [],
                    completedSubQuests: [],
                    unlockedEpisodes: [],
                    keyItems: [],
                    lastSyncedAt: null
                }
            });
        }

        res.json({
            success: true,
            data: {
                completedChapters:   JSON.parse(row.completed_chapters),
                completedEpisodes:   JSON.parse(row.completed_episodes),
                completedSubQuests:  JSON.parse(row.completed_sub_quests),
                unlockedEpisodes:    JSON.parse(row.unlocked_episodes),
                keyItems:            JSON.parse(row.key_items),
                lastSyncedAt:        row.last_synced_at
            }
        });
    } catch (error) {
        logger.error('story progress fetch 오류:', error);
        res.status(500).json({ success: false, error: '서버 오류' });
    }
});

// POST /api/story/sync — 앱 → 서버 동기화
router.post('/sync', authenticateToken, async (req, res) => {
    try {
        const {
            completedChapters = [],
            completedEpisodes = [],
            completedSubQuests = [],
            unlockedEpisodes = [],
            keyItems = []
        } = req.body;

        const now = new Date().toISOString();

        await db.run(
            `INSERT INTO player_story_progress
               (player_id, completed_chapters, completed_episodes,
                completed_sub_quests, unlocked_episodes, key_items, last_synced_at)
             VALUES (?, ?, ?, ?, ?, ?, ?)
             ON CONFLICT(player_id) DO UPDATE SET
               completed_chapters   = excluded.completed_chapters,
               completed_episodes   = excluded.completed_episodes,
               completed_sub_quests = excluded.completed_sub_quests,
               unlocked_episodes    = excluded.unlocked_episodes,
               key_items            = excluded.key_items,
               last_synced_at       = excluded.last_synced_at`,
            [
                req.user.playerId,
                JSON.stringify(completedChapters),
                JSON.stringify(completedEpisodes),
                JSON.stringify(completedSubQuests),
                JSON.stringify(unlockedEpisodes),
                JSON.stringify(keyItems),
                now
            ]
        );

        res.json({ success: true, lastSyncedAt: now });
    } catch (error) {
        logger.error('story sync 오류:', error);
        res.status(500).json({ success: false, error: '서버 오류' });
    }
});

module.exports = router;
```

**Step 2: 수동 테스트 (curl)**

서버 실행 후:
```bash
# 로그인해서 토큰 획득
TOKEN=$(curl -s -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"test@test.com","password":"test1234"}' | \
  python3 -c "import sys,json; print(json.load(sys.stdin)['data']['token'])")

# sync
curl -X POST http://localhost:3000/api/story/sync \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"completedChapters":["ch0_prologue"],"completedEpisodes":["ep_001"],"completedSubQuests":[],"unlockedEpisodes":["ep_002"],"keyItems":[]}'

# fetch
curl http://localhost:3000/api/story/progress \
  -H "Authorization: Bearer $TOKEN"
```

**Step 3: 커밋**

```bash
git add src/routes/api/story.js
git commit -m "feat: rewrite story.js as progress sync API (GET /progress, POST /sync)"
```

---

## Task 4: 미사용 라우트 제거

**Files:**
- Delete: `src/routes/api/quests.js`
- Delete: `src/routes/api/achievements.js`
- Modify: `src/app.js`

**Step 1: 라우트 파일 삭제**

```bash
rm src/routes/api/quests.js
rm src/routes/api/achievements.js
```

**Step 2: app.js에서 라우트 연결 제거**

`src/app.js`에서 다음 두 줄 삭제:
```javascript
app.use('/api/quests', require('./routes/api/quests'));
app.use('/api/achievements', require('./routes/api/achievements'));
```

**Step 3: 서버 재시작 확인**

```bash
npm run dev
```

에러 없이 시작되면 정상.

**Step 4: 커밋**

```bash
git add src/app.js
git rm src/routes/api/quests.js src/routes/api/achievements.js
git commit -m "chore: remove unused quests and achievements routes"
```

---

## Task 5: 패키지 제거 (moment, express-session)

**Files:**
- Modify: `package.json`

**Step 1: 패키지 제거**

```bash
npm uninstall moment express-session
```

**Step 2: moment 사용처 확인 및 교체**

```bash
grep -r "moment" src/ --include="*.js" -l
```

발견된 파일에서 `moment()`를 `new Date().toISOString()` 또는 `new Date().toLocaleDateString()` 으로 교체.

**Step 3: express-session 사용처 확인**

```bash
grep -r "express-session\|session(" src/ --include="*.js" -l
```

`src/app.js`의 session 미들웨어 블록 제거:
```javascript
// 아래 블록 삭제
const session = require('express-session');
app.use(session({
    secret: process.env.SESSION_SECRET || 'way3-admin-secret-key',
    resave: false,
    saveUninitialized: false,
    cookie: { ... }
}));
```

**Step 4: 서버 재시작 확인**

```bash
npm run dev
```

**Step 5: 커밋**

```bash
git add package.json package-lock.json src/app.js
git commit -m "chore: remove moment and express-session dependencies"
```

---

## Task 6: 어드민 HTML 인증 버그 수정

**Files:**
- Modify: `src/public/admin.html`

**Step 1: 현재 로그인 코드 확인**

```bash
grep -n "auth\|token\|Bearer\|localStorage" src/public/admin.html | head -30
```

**Step 2: 토큰 저장 및 헤더 전송 로직 수정**

로그인 폼 submit 핸들러에서:
```javascript
// 로그인 성공 시
const res = await fetch('/admin/api/auth', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ password })
});
const data = await res.json();
if (data.ok) {
    localStorage.setItem('adminToken', data.token);
    showDashboard();
}

// 모든 /admin/api/* 요청에서 헤더 포함하는 헬퍼 함수 추가
function adminFetch(url, options = {}) {
    const token = localStorage.getItem('adminToken');
    return fetch(url, {
        ...options,
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`,
            ...(options.headers || {})
        }
    });
}
// 이후 fetch('/admin/api/stats') → adminFetch('/admin/api/stats') 로 일괄 교체
```

**Step 3: 브라우저에서 확인**

```
http://localhost:3000/admin
→ 비밀번호 입력 → 대시보드 표시 확인
```

**Step 4: EC2 .env에 ADMIN_SECRET 설정 확인**

EC2 서버에서:
```bash
grep ADMIN_SECRET ~/way-server/.env
# 없으면 추가:
echo "ADMIN_SECRET=<강력한_비밀번호>" >> ~/way-server/.env
```

**Step 5: 커밋**

```bash
git add src/public/admin.html
git commit -m "fix: admin panel auth — properly send Bearer token on all API calls"
```

---

## Task 7: JWT 미들웨어 경량화

**Files:**
- Modify: `src/middleware/auth.js`
- Modify: `src/routes/api/auth.js` (토큰 발급 시 payload 확장)

**Step 1: auth.js 토큰 발급 시 playerId 포함 확인**

```bash
grep -n "jwt.sign\|playerId" src/routes/api/auth.js
```

토큰 발급 코드가 다음처럼 되어 있는지 확인:
```javascript
jwt.sign({ userId: user.id, playerId: player.id }, process.env.JWT_SECRET, { expiresIn: '15m' })
```

**Step 2: middleware/auth.js 경량화**

```javascript
const authenticateToken = async (req, res, next) => {
    try {
        const token = req.headers.authorization?.split(' ')[1];
        if (!token) return res.status(401).json({ success: false, error: '인증 토큰이 필요합니다' });

        const decoded = jwt.verify(token, process.env.JWT_SECRET);

        // DB 조회를 user 확인 1회로 줄임 (player 정보는 payload에서)
        const user = await DatabaseManager.get(
            'SELECT id, is_active FROM users WHERE id = ?',
            [decoded.userId]
        );

        if (!user?.is_active) {
            return res.status(401).json({ success: false, error: '유효하지 않은 사용자입니다' });
        }

        req.user = {
            userId: decoded.userId,
            playerId: decoded.playerId   // ← DB 조회 제거
        };

        next();
    } catch (error) {
        if (error.name === 'JsonWebTokenError')
            return res.status(401).json({ success: false, error: '유효하지 않은 토큰입니다' });
        if (error.name === 'TokenExpiredError')
            return res.status(401).json({ success: false, error: '만료된 토큰입니다' });
        res.status(500).json({ success: false, error: '서버 오류' });
    }
};
```

> 주의: `req.user.player` 전체 객체를 사용하는 라우트가 있으면 해당 라우트에서 직접 DB 조회하도록 수정.

**Step 3: player 객체 참조 확인**

```bash
grep -rn "req\.user\.player\b" src/routes/ --include="*.js"
```

발견된 곳에서 `req.user.player` → `await db.get('SELECT * FROM players WHERE id = ?', [req.user.playerId])` 로 교체.

**Step 4: 서버 재시작 + 로그인 테스트**

```bash
npm run dev
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"test@test.com","password":"test1234"}'
```

**Step 5: 커밋**

```bash
git add src/middleware/auth.js
git commit -m "perf: reduce JWT middleware DB queries from 2 to 1"
```

---

## Task 8: iOS 앱 — 스토리 진행도 동기화 추가

**Files:**
- Modify: `way3/way3/Core/NetworkManager.swift` (또는 신규 StoryProgressService.swift)
- Modify: `way3/way3/Managers/StoryFlowManager.swift`

**Step 1: NetworkManager에 story sync 메서드 추가**

```swift
// NetworkManager.swift 에 추가

struct StoryProgressPayload: Codable {
    let completedChapters: [String]
    let completedEpisodes: [String]
    let completedSubQuests: [String]
    let unlockedEpisodes: [String]
    let keyItems: [String]
}

func syncStoryProgress(_ progress: PlayerProgress) async {
    guard let url = URL(string: "\(NetworkConfiguration.baseURL)/api/story/sync") else { return }
    let payload = StoryProgressPayload(
        completedChapters: progress.completedChapters,
        completedEpisodes: progress.completedEpisodes,
        completedSubQuests: progress.completedSubQuests,
        unlockedEpisodes: progress.unlockedEpisodes,
        keyItems: progress.keyItems
    )
    do {
        var request = URLRequest(url: url)
        request.httpMethod = "POST"
        request.allHTTPHeaderFields = authHeaders()
        request.httpBody = try JSONEncoder().encode(payload)
        _ = try await URLSession.shared.data(for: request)
        GameLogger.shared.logInfo("스토리 진행도 서버 동기화 완료", category: .network)
    } catch {
        GameLogger.shared.logError("스토리 동기화 실패: \(error.localizedDescription)", category: .network)
    }
}

func fetchStoryProgress() async -> StoryProgressPayload? {
    guard let url = URL(string: "\(NetworkConfiguration.baseURL)/api/story/progress") else { return nil }
    var request = URLRequest(url: url)
    request.allHTTPHeaderFields = authHeaders()
    do {
        let (data, _) = try await URLSession.shared.data(for: request)
        let response = try JSONDecoder().decode(APIResponse<StoryProgressPayload>.self, from: data)
        return response.data
    } catch {
        GameLogger.shared.logError("스토리 진행도 fetch 실패: \(error.localizedDescription)", category: .network)
        return nil
    }
}
```

**Step 2: StoryFlowManager 완료 핸들러에 sync 호출 추가**

`makeCompletionHandler()` 내부에서 `ProgressManager.markEpisodeComplete()` 호출 직후:
```swift
Task {
    await NetworkManager.shared.syncStoryProgress(progressManager.currentProgress)
}
```

**Step 3: 앱 시작 시 서버 진행도 fetch**

`ContentView.swift` 또는 `GameManager`의 onAppear/init에서:
```swift
Task {
    if let serverProgress = await NetworkManager.shared.fetchStoryProgress() {
        progressManager.mergeFromServer(serverProgress)
    }
}
```

**Step 4: Xcode 빌드 확인**

```bash
xcodebuild -scheme way3 -destination 'platform=iOS Simulator,name=iPhone 15' build
```

**Step 5: 커밋**

```bash
git add way3/way3/Core/NetworkManager.swift way3/way3/Managers/StoryFlowManager.swift
git commit -m "feat: add story progress sync to server (GET /progress, POST /sync)"
```

---

## Task 9: EC2 S3 백업 크론잡 등록

**EC2에서 직접 실행 (코드 변경 없음)**

**Step 1: AWS CLI 설치 확인**

```bash
aws --version
# 없으면: sudo apt install awscli 또는 pip install awscli
```

**Step 2: AWS 자격증명 설정**

```bash
aws configure
# Access Key, Secret Key, Region (ap-northeast-2) 입력
```

**Step 3: S3 버킷 연결 테스트**

```bash
aws s3 ls s3://projects-data/
```

**Step 4: crontab 등록**

```bash
crontab -e
```

추가할 내용:
```
# 매일 새벽 3시 SQLite 백업
0 3 * * * aws s3 cp ~/way-server/data/way_game.sqlite s3://projects-data/way-server/backups/way_game_$(date +\%Y\%m\%d).sqlite >> ~/way-server/logs/s3-backup.log 2>&1

# 매일 새벽 4시 7일 이전 백업 삭제
0 4 * * * aws s3 ls s3://projects-data/way-server/backups/ | awk '{print $4}' | sort | head -n -7 | xargs -I{} aws s3 rm s3://projects-data/way-server/backups/{} >> ~/way-server/logs/s3-backup.log 2>&1
```

**Step 5: 수동 실행 테스트**

```bash
aws s3 cp ~/way-server/data/way_game.sqlite \
  s3://projects-data/way-server/backups/way_game_test.sqlite
aws s3 ls s3://projects-data/way-server/backups/
```

---

## 구현 완료 체크리스트

- [ ] Task 1: 미사용 테이블 DROP 마이그레이션
- [ ] Task 2: player_story_progress 테이블 추가
- [ ] Task 3: story.js sync API 재작성
- [ ] Task 4: quests.js, achievements.js 제거
- [ ] Task 5: moment, express-session 패키지 제거
- [ ] Task 6: 어드민 HTML 인증 버그 수정
- [ ] Task 7: JWT 미들웨어 경량화
- [ ] Task 8: iOS 앱 스토리 동기화 추가
- [ ] Task 9: EC2 S3 크론잡 등록
