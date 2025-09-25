// 📁 src/app.js - Express 애플리케이션 설정
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const path = require('path');
const session = require('express-session');
const logger = require('./config/logger');

const app = express();

// =============================================================================
// 미들웨어 설정
// =============================================================================

// 보안 헤더 설정
app.use(helmet({
    contentSecurityPolicy: false, // 개발 환경에서는 비활성화
    crossOriginEmbedderPolicy: false
}));

// CORS 설정 (모바일 앱 및 로컬 네트워크 지원)
app.use(cors({
    origin: function(origin, callback) {
        const allowedOrigins = process.env.ALLOWED_ORIGINS?.split(',') || ['http://localhost:3000'];

        // 모바일 앱에서의 요청 허용 (origin이 없는 경우)
        if (!origin) return callback(null, true);

        // 로컬 네트워크 IP 패턴 허용 (Socket.IO와 동일한 패턴)
        const localNetworkPattern = /^http:\/\/(192\.168\.\d+\.\d+|10\.\d+\.\d+\.\d+|172\.(1[6-9]|2\d|3[01])\.\d+\.\d+):3000$/;

        if (allowedOrigins.includes(origin) || localNetworkPattern.test(origin)) {
            callback(null, true);
        } else {
            logger.warn(`API CORS 차단된 origin: ${origin}`);
            callback(new Error('CORS 정책에 의해 차단됨'), false);
        }
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'Accept', 'Origin']
}));

// Rate Limiting (API 남용 방지)
const limiter = rateLimit({
    windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS) || 15 * 60 * 1000, // 15분
    max: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS) || 100,
    message: {
        error: 'Too many requests',
        message: '너무 많은 요청입니다. 잠시 후 다시 시도해주세요.'
    },
    standardHeaders: true,
    legacyHeaders: false,
});

app.use('/api/', limiter);

// 세션 설정 (어드민 인증용)
app.use(session({
    secret: process.env.SESSION_SECRET || 'way3-admin-secret-key',
    resave: false,
    saveUninitialized: false,
    cookie: {
        secure: process.env.NODE_ENV === 'production',
        maxAge: 24 * 60 * 60 * 1000 // 24시간
    }
}));

// EJS 템플릿 엔진 설정
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

// JSON 파싱 설정
app.use(express.json({ 
    limit: '10mb',
    type: 'application/json'
}));

app.use(express.urlencoded({ 
    extended: true, 
    limit: '10mb' 
}));

// 정적 파일 서빙
app.use('/public', express.static(path.join(__dirname, '../public')));

// 어드민 정적 파일 서빙
app.use('/admin', express.static(path.join(__dirname, '../public/admin')));

// 📌 상인 미디어 파일 서빙 (로컬 업로드된 이미지/GIF)
app.use('/uploads', express.static(path.join(__dirname, '../uploads')));

// 데이터베이스 연결을 요청 객체에 추가
app.use(async (req, res, next) => {
    const DatabaseManager = require('./database/DatabaseManager');
    req.app.set('db', DatabaseManager.db);
    next();
});

// 요청 로깅 미들웨어
app.use((req, res, next) => {
    const startTime = Date.now();

    res.on('finish', () => {
        const duration = Date.now() - startTime;
        logger.info(`${req.method} ${req.originalUrl} - ${res.statusCode} [${duration}ms]`);
    });

    next();
});

// =============================================================================
// 라우트 설정
// =============================================================================

// API 라우트
app.use('/api/auth', require('./routes/api/auth'));
app.use('/api/player', require('./routes/api/player'));
app.use('/api/merchants', require('./routes/api/merchants'));
app.use('/api/trade', require('./routes/api/trade'));
app.use('/api/quests', require('./routes/api/quests'));
app.use('/api/achievements', require('./routes/api/achievements'));
app.use('/api/skills', require('./routes/api/skills'));
app.use('/api/personal-items', require('./routes/api/personal-items'));

// 게임 클라이언트 라우트 (iOS/Android)
app.use('/game/quests', require('./routes/game/quests'));

// 어드민 라우트
app.use('/admin', require('./routes/admin'));

// 루트 경로
app.get('/', (req, res) => {
    res.json({
        message: 'Way Trading Game Server',
        version: '1.0.0',
        status: 'running',
        timestamp: new Date().toISOString(),
        endpoints: {
            api: '/api',
            admin: '/admin',
            docs: '/docs'
        }
    });
});

// 헬스체크 엔드포인트
app.get('/health', (req, res) => {
    res.json({
        status: 'healthy',
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
        memory: process.memoryUsage(),
        version: process.version
    });
});

// =============================================================================
// 에러 처리 미들웨어
// =============================================================================

const { errorHandler, notFoundHandler, validateErrorResponse } = require('./middleware/errorHandler');

// 에러 응답 검증 미들웨어 적용
app.use(validateErrorResponse);

// 404 에러 처리
app.use(notFoundHandler);

// 전역 에러 처리
app.use(errorHandler);

module.exports = app;