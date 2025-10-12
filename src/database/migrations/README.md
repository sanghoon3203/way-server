# Database Migrations

이 디렉토리는 WAY3 게임 데이터베이스의 마이그레이션 스크립트를 포함합니다.

## 적용 방법

### 방법 1: SQLite CLI 사용

```bash
# WAY-SERVER 루트 디렉토리에서 실행
sqlite3 ./src/database/way3.db < ./src/database/migrations/update_merchant_coordinates.sql
```

### 방법 2: Node.js 스크립트 사용

```bash
# WAY-SERVER 루트 디렉토리에서 실행
node -e "const sqlite3 = require('sqlite3'); const fs = require('fs'); const db = new sqlite3.Database('./src/database/way3.db'); const sql = fs.readFileSync('./src/database/migrations/update_merchant_coordinates.sql', 'utf8'); db.exec(sql, (err) => { if (err) console.error(err); else console.log('Migration applied successfully!'); db.close(); });"
```

### 방법 3: DatabaseManager를 통한 적용

```javascript
// WAY-SERVER/src/database/applyMigration.js 파일 생성 후 실행

const DatabaseManager = require('./DatabaseManager');
const fs = require('fs');
const path = require('path');

const dbManager = new DatabaseManager();

const migrationFile = path.join(__dirname, 'migrations', 'update_merchant_coordinates.sql');
const sql = fs.readFileSync(migrationFile, 'utf8');

dbManager.db.exec(sql, (err) => {
    if (err) {
        console.error('❌ Migration failed:', err);
    } else {
        console.log('✅ Merchant coordinates updated successfully!');
    }
    dbManager.close();
});
```

그 후 실행:
```bash
cd WAY-SERVER/src/database
node applyMigration.js
```

## 현재 마이그레이션

### update_merchant_coordinates.sql
- **작성일**: 2025-10-10
- **목적**: 9명 상인의 GPS 좌표를 실제 서울 지역 기반으로 정확하게 업데이트
- **영향받는 테이블**: `merchants`
- **영향받는 레코드**: 9개 (모든 현재 상인)

#### 업데이트 내역:
- **강남권 (6명)**: 서예나, 앨리스 강, 애니박, 진백호, 주블수, 김세휘
- **서북권 (3명)**: 카타리나 최, 기주리, 마리

## 백업 권장사항

마이그레이션 적용 전 데이터베이스 백업을 권장합니다:

```bash
# 백업 생성
cp ./src/database/way3.db ./src/database/way3.db.backup.$(date +%Y%m%d_%H%M%S)

# 또는 Windows에서:
copy src\database\way3.db src\database\way3.db.backup
```

## 롤백 방법

마이그레이션 적용 후 문제가 발생하면 백업에서 복원:

```bash
# 백업에서 복원
cp ./src/database/way3.db.backup.20251010_000000 ./src/database/way3.db

# 또는 Windows에서:
copy src\database\way3.db.backup src\database\way3.db
```

## 검증 방법

마이그레이션 적용 후 확인:

```bash
sqlite3 ./src/database/way3.db "SELECT id, name, district, lat, lng FROM merchants WHERE id LIKE 'merchant_%' ORDER BY district, name;"
```

예상 결과:
```
merchant_alicegang|앨리스 강|서초구|37.491451|127.003281
merchant_seoyena|서예나|강남구|37.527941|127.038806
merchant_anipark|애니박|송파구|37.511169|127.098242
merchant_jinbaekho|진백호|강동구|37.540264|127.123698
merchant_jubulsu|주블수|강동구|37.540764|127.124198
merchant_kimsehwui|김세휘|관악구|37.460369|126.95175
merchant_catarinachoi|카타리나 최|중구|37.563605|126.986893
merchant_kijuri|기주리|종로구|37.575911|126.976863
merchant_mari|마리|마포구|37.548748|126.92207
```
