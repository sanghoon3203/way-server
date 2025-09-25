// 📁 src/routes/admin/index.js - 통합 어드민 라우트
const express = require('express');
const UnifiedAdminController = require('../../controllers/UnifiedAdminController');

const router = express.Router();

// ================================
// 통합 어드민 컨트롤러 (메인)
// ================================
router.use('/', UnifiedAdminController);

// ================================
// 레거시 서브 라우트들 (호환성 유지)
// ================================

// 어드민 인증 라우트
const authRouter = require('./auth');
router.use('/auth', authRouter);

// CRUD 라우트
const crudRouter = require('./crud');
router.use('/crud', crudRouter);

// 퀘스트 관리 라우트
const questsRouter = require('./quests');
router.use('/quests', questsRouter);

// 스킬 관리 라우트
const skillsRouter = require('./skills');
router.use('/skills', skillsRouter);

// 📌 미디어 관리 라우트 (새로 추가)
const mediaRouter = require('./media');
router.use('/media', mediaRouter);

// ================================
// 레거시 라우트들 (단계적 제거 예정)
// ================================

// 기존 모니터링 라우트 (호환성)
const legacyMonitoringRouter = require('./monitoring');
router.use('/legacy/monitoring', legacyMonitoringRouter);

// 기존 메트릭 API 라우트 (호환성)
const legacyMetricsRouter = require('./metrics');
router.use('/legacy/api/metrics', legacyMetricsRouter);

// ================================
// 레거시 대시보드 (향후 제거 예정)
// ================================
// 모든 기능은 UnifiedAdminController로 이동됨

module.exports = router;