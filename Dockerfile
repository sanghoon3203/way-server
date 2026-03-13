FROM node:18-alpine

# sqlite3, bcrypt 빌드에 필요한 네이티브 도구 설치
RUN apk add --no-cache python3 make g++ sqlite

WORKDIR /app

# 의존성 먼저 복사 (레이어 캐시 최적화)
COPY package*.json ./
RUN npm ci --only=production

# 소스 복사
COPY . .

# 데이터/로그 디렉토리 생성
RUN mkdir -p data logs

# DB 마이그레이션 + 어드민 초기화
RUN node src/database/migrate.js

EXPOSE 3000

CMD ["node", "src/server.js"]
