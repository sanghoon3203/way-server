const express = require('express');
const router = express.Router();

// Controllers
const dashboardController = require('../controllers/admin/dashboardController');

// Middleware
const adminAuth = require('../middleware/adminAuth');

// Apply admin authentication to all routes
router.use(adminAuth);

// === Dashboard Routes ===
router.get('/', dashboardController.renderDashboard);
router.get('/dashboard', (req, res) => res.redirect('/admin'));

// === Dashboard API Routes ===
router.get('/api/dashboard/stats', dashboardController.getStats);
router.get('/api/dashboard/counts', dashboardController.getCounts);
router.get('/api/dashboard/activity-chart', dashboardController.getActivityChart);
router.get('/api/dashboard/activity-log', dashboardController.getActivityLog);
router.get('/api/system/status', dashboardController.getSystemStatus);

// === Merchants Routes ===
router.get('/merchants', (req, res) => {
    res.render('admin/merchants/index', {
        title: '상인 관리',
        currentPath: req.path,
        breadcrumbs: [
            { title: '상인 관리', url: '/admin/merchants' }
        ]
    });
});

router.get('/merchants/create', (req, res) => {
    res.render('admin/merchants/create', {
        title: '새 상인 추가',
        currentPath: req.path,
        breadcrumbs: [
            { title: '상인 관리', url: '/admin/merchants' },
            { title: '새 상인 추가', url: '/admin/merchants/create' }
        ]
    });
});

router.get('/merchants/:id', (req, res) => {
    res.render('admin/merchants/detail', {
        title: '상인 상세',
        currentPath: req.path,
        breadcrumbs: [
            { title: '상인 관리', url: '/admin/merchants' },
            { title: '상인 상세', url: req.path }
        ],
        merchantId: req.params.id
    });
});

router.get('/merchants/:id/edit', (req, res) => {
    res.render('admin/merchants/edit', {
        title: '상인 수정',
        currentPath: req.path,
        breadcrumbs: [
            { title: '상인 관리', url: '/admin/merchants' },
            { title: '상인 상세', url: `/admin/merchants/${req.params.id}` },
            { title: '수정', url: req.path }
        ],
        merchantId: req.params.id
    });
});

// === Media Routes ===
router.get('/media', (req, res) => {
    res.render('admin/media/index', {
        title: '미디어 관리',
        currentPath: req.path,
        breadcrumbs: [
            { title: '미디어 관리', url: '/admin/media' }
        ]
    });
});

// === Quests Routes ===
router.get('/quests', (req, res) => {
    res.render('admin/quests/index', {
        title: '퀘스트 관리',
        currentPath: req.path,
        breadcrumbs: [
            { title: '퀘스트 관리', url: '/admin/quests' }
        ]
    });
});

router.get('/quests/create', (req, res) => {
    res.render('admin/quests/create', {
        title: '새 퀘스트 추가',
        currentPath: req.path,
        breadcrumbs: [
            { title: '퀘스트 관리', url: '/admin/quests' },
            { title: '새 퀘스트 추가', url: '/admin/quests/create' }
        ]
    });
});

router.get('/quests/:id', (req, res) => {
    res.render('admin/quests/detail', {
        title: '퀘스트 상세',
        currentPath: req.path,
        breadcrumbs: [
            { title: '퀘스트 관리', url: '/admin/quests' },
            { title: '퀘스트 상세', url: req.path }
        ],
        questId: req.params.id
    });
});

router.get('/quests/:id/edit', (req, res) => {
    res.render('admin/quests/edit', {
        title: '퀘스트 수정',
        currentPath: req.path,
        breadcrumbs: [
            { title: '퀘스트 관리', url: '/admin/quests' },
            { title: '퀘스트 상세', url: `/admin/quests/${req.params.id}` },
            { title: '수정', url: req.path }
        ],
        questId: req.params.id
    });
});

// === Skills Routes ===
router.get('/skills', (req, res) => {
    res.render('admin/skills/index', {
        title: '스킬 관리',
        currentPath: req.path,
        breadcrumbs: [
            { title: '스킬 관리', url: '/admin/skills' }
        ]
    });
});

router.get('/skills/create', (req, res) => {
    res.render('admin/skills/create', {
        title: '새 스킬 추가',
        currentPath: req.path,
        breadcrumbs: [
            { title: '스킬 관리', url: '/admin/skills' },
            { title: '새 스킬 추가', url: '/admin/skills/create' }
        ]
    });
});

router.get('/skills/:id', (req, res) => {
    res.render('admin/skills/detail', {
        title: '스킬 상세',
        currentPath: req.path,
        breadcrumbs: [
            { title: '스킬 관리', url: '/admin/skills' },
            { title: '스킬 상세', url: req.path }
        ],
        skillId: req.params.id
    });
});

router.get('/skills/:id/edit', (req, res) => {
    res.render('admin/skills/edit', {
        title: '스킬 수정',
        currentPath: req.path,
        breadcrumbs: [
            { title: '스킬 관리', url: '/admin/skills' },
            { title: '스킬 상세', url: `/admin/skills/${req.params.id}` },
            { title: '수정', url: req.path }
        ],
        skillId: req.params.id
    });
});

// === Players Routes ===
router.get('/players', (req, res) => {
    res.render('admin/players/index', {
        title: '플레이어 관리',
        currentPath: req.path,
        breadcrumbs: [
            { title: '플레이어 관리', url: '/admin/players' }
        ]
    });
});

router.get('/players/:id', (req, res) => {
    res.render('admin/players/detail', {
        title: '플레이어 상세',
        currentPath: req.path,
        breadcrumbs: [
            { title: '플레이어 관리', url: '/admin/players' },
            { title: '플레이어 상세', url: req.path }
        ],
        playerId: req.params.id
    });
});

// === Monitoring Routes ===
router.get('/monitoring', (req, res) => {
    res.render('admin/monitoring/index', {
        title: '모니터링',
        currentPath: req.path,
        breadcrumbs: [
            { title: '모니터링', url: '/admin/monitoring' }
        ]
    });
});

// === Settings Routes ===
router.get('/settings', (req, res) => {
    res.render('admin/settings/index', {
        title: '시스템 설정',
        currentPath: req.path,
        breadcrumbs: [
            { title: '시스템 설정', url: '/admin/settings' }
        ]
    });
});

// === Profile Routes ===
router.get('/profile', (req, res) => {
    res.render('admin/profile/index', {
        title: '프로필',
        currentPath: req.path,
        breadcrumbs: [
            { title: '프로필', url: '/admin/profile' }
        ]
    });
});

// === Notifications Routes ===
router.get('/notifications', (req, res) => {
    res.render('admin/notifications/index', {
        title: '알림',
        currentPath: req.path,
        breadcrumbs: [
            { title: '알림', url: '/admin/notifications' }
        ]
    });
});

// === Search API ===
router.get('/api/search', (req, res) => {
    // 전역 검색 API 구현 예정
    res.json({
        success: false,
        message: '검색 기능 구현 예정'
    });
});

// === Notifications API ===
router.get('/api/notifications', (req, res) => {
    // 알림 API 구현 예정
    res.json({
        success: true,
        data: {
            unread: 0,
            recent: []
        }
    });
});

// === Auth Routes ===
router.get('/logout', (req, res) => {
    req.session.destroy((err) => {
        if (err) {
            console.error('Session destroy error:', err);
        }
        res.redirect('/admin/login');
    });
});

// Login page (no auth required)
router.get('/login', (req, res) => {
    if (req.session.adminAuthenticated) {
        return res.redirect('/admin');
    }

    res.render('admin/auth/login', {
        title: '관리자 로그인',
        layout: false // 로그인 페이지는 별도 레이아웃 사용
    });
});

router.post('/login', (req, res) => {
    // 임시 인증 로직 (나중에 실제 인증으로 교체)
    const { username, password } = req.body;

    if (username === 'admin' && password === 'admin123') {
        req.session.adminAuthenticated = true;
        req.session.adminUser = { username: 'admin', role: 'admin' };
        res.redirect('/admin');
    } else {
        res.render('admin/auth/login', {
            title: '관리자 로그인',
            layout: false,
            error: '잘못된 사용자명 또는 비밀번호입니다.'
        });
    }
});

module.exports = router;