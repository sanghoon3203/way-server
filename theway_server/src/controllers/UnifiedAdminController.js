// 📁 src/controllers/UnifiedAdminController.js - 통합 어드민 컨트롤러
const express = require('express');
const EnhancedMetricsService = require('../services/admin/EnhancedMetricsService');
const DatabaseManager = require('../database/DatabaseManager');
const { AdminAuth } = require('../middleware/adminAuth');
const logger = require('../config/logger');

const router = express.Router();

// 개발 환경에서는 인증 우회 (추후 제거)
// router.use(AdminAuth.authenticateToken);

// ================================
// 메인 대시보드 라우트들
// ================================

/**
 * 통합 메인 대시보드
 * GET /admin
 */
router.get('/', async (req, res) => {
    try {
        const metrics = await EnhancedMetricsService.getDashboardMetrics();

        res.send(generateMainDashboard(metrics));

    } catch (error) {
        logger.error('메인 대시보드 로드 실패:', error);
        res.status(500).send(generateErrorPage('메인 대시보드를 로드할 수 없습니다', error.message));
    }
});

/**
 * 실시간 모니터링 대시보드
 * GET /admin/monitoring
 */
router.get('/monitoring', async (req, res) => {
    try {
        const metrics = await EnhancedMetricsService.getMonitoringMetrics();

        res.send(generateMonitoringDashboard(metrics));

    } catch (error) {
        logger.error('모니터링 대시보드 로드 실패:', error);
        res.status(500).send(generateErrorPage('모니터링 대시보드를 로드할 수 없습니다', error.message));
    }
});

/**
 * 플레이어 분석 대시보드
 * GET /admin/analytics/players
 */
router.get('/analytics/players', async (req, res) => {
    try {
        const timeRange = req.query.range || '7d';
        const metrics = await EnhancedMetricsService.getPlayerAnalytics(timeRange);

        res.send(generatePlayerAnalyticsDashboard(metrics));

    } catch (error) {
        logger.error('플레이어 분석 대시보드 로드 실패:', error);
        res.status(500).send(generateErrorPage('플레이어 분석을 로드할 수 없습니다', error.message));
    }
});

/**
 * 경제 분석 대시보드
 * GET /admin/analytics/economy
 */
router.get('/analytics/economy', async (req, res) => {
    try {
        const timeRange = req.query.range || '7d';
        const metrics = await EnhancedMetricsService.getEconomyAnalytics(timeRange);

        res.send(generateEconomyAnalyticsDashboard(metrics));

    } catch (error) {
        logger.error('경제 분석 대시보드 로드 실패:', error);
        res.status(500).send(generateErrorPage('경제 분석을 로드할 수 없습니다', error.message));
    }
});

// ================================
// API 엔드포인트들
// ================================

/**
 * 통합 메트릭 API
 * GET /admin/api/metrics
 */
router.get('/api/metrics', async (req, res) => {
    try {
        const type = req.query.type || 'dashboard';
        const timeRange = req.query.range || '7d';

        let metrics;
        switch (type) {
            case 'dashboard':
                metrics = await EnhancedMetricsService.getDashboardMetrics();
                break;
            case 'monitoring':
                metrics = await EnhancedMetricsService.getMonitoringMetrics();
                break;
            case 'players':
                metrics = await EnhancedMetricsService.getPlayerAnalytics(timeRange);
                break;
            case 'economy':
                metrics = await EnhancedMetricsService.getEconomyAnalytics(timeRange);
                break;
            default:
                return res.status(400).json({
                    success: false,
                    error: '알 수 없는 메트릭 타입입니다'
                });
        }

        res.json({
            success: true,
            data: metrics,
            type,
            timestamp: new Date().toISOString()
        });

    } catch (error) {
        logger.error('통합 메트릭 API 실패:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

/**
 * 실시간 업데이트 API (빠른 응답)
 * GET /admin/api/live
 */
router.get('/api/live', async (req, res) => {
    try {
        const quickMetrics = await EnhancedMetricsService.getMonitoringMetrics();

        // 빠른 응답을 위해 핵심 데이터만 전송
        const liveData = {
            timestamp: new Date().toISOString(),
            server: {
                uptime: quickMetrics.server.uptime,
                memory: quickMetrics.server.memory,
                status: quickMetrics.server.memory.usage > 80 ? 'warning' : 'healthy'
            },
            players: {
                active: quickMetrics.game?.players?.active || 0,
                total: quickMetrics.game?.players?.total || 0
            },
            alerts: quickMetrics.alerts || []
        };

        res.json({
            success: true,
            data: liveData
        });

    } catch (error) {
        logger.error('실시간 API 실패:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

/**
 * 캐시 관리 API
 * POST /admin/api/cache/clear
 */
router.post('/api/cache/clear', async (req, res) => {
    try {
        const pattern = req.body.pattern || null;

        EnhancedMetricsService.clearCache(pattern);

        res.json({
            success: true,
            message: pattern ? `${pattern} 패턴 캐시가 삭제되었습니다` : '모든 캐시가 삭제되었습니다'
        });

    } catch (error) {
        logger.error('캐시 삭제 실패:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// ================================
// 레거시 호환성 라우트들
// ================================

/**
 * 레거시 플레이어 페이지 (호환성)
 * GET /admin/players
 */
router.get('/players', async (req, res) => {
    try {
        const players = await DatabaseManager.all(`
            SELECT
                id, name, level, money, current_license, total_trades,
                created_at, last_active
            FROM players
            ORDER BY last_active DESC
            LIMIT 50
        `);

        let tableRows = players.map(player => `
            <tr>
                <td>${player.name}</td>
                <td>${player.level}</td>
                <td>Level ${player.current_license}</td>
                <td>${player.money.toLocaleString()}원</td>
                <td>${player.total_trades}</td>
                <td>${new Date(player.last_active).toLocaleString()}</td>
            </tr>
        `).join('');

        res.send(generateLegacyPlayerPage(players, tableRows));

    } catch (error) {
        logger.error('레거시 플레이어 페이지 로드 실패:', error);
        res.status(500).send(generateErrorPage('플레이어 정보를 로드할 수 없습니다', error.message));
    }
});

// ================================
// HTML 생성 함수들
// ================================

function generateMainDashboard(metrics) {
    const alerts = metrics.alerts || [];
    const alertsHTML = alerts.length > 0 ? `
        <div class="alerts-section">
            <h2>🚨 시스템 알림 (${alerts.length}개)</h2>
            ${alerts.map(alert => `
                <div class="alert alert-${alert.level}">
                    <strong>${alert.type.toUpperCase()}:</strong> ${alert.message}
                    ${alert.value ? `(현재: ${alert.value}${alert.unit || ''})` : ''}
                </div>
            `).join('')}
        </div>
    ` : '';

    return `
        <!DOCTYPE html>
        <html>
        <head>
            <title>Way Game Admin - 통합 대시보드</title>
            <meta charset="utf-8">
            <meta name="viewport" content="width=device-width, initial-scale=1">
            ${getCommonStyles()}
        </head>
        <body>
            <div class="container">
                ${getNavigation('dashboard')}

                <div class="header">
                    <h1>🎮 Way Game 통합 관리자 대시보드</h1>
                    <div class="last-update">
                        마지막 업데이트: ${new Date(metrics.timestamp).toLocaleString()}
                        (수집시간: ${metrics.collectionTime})
                    </div>
                </div>

                ${alertsHTML}

                <!-- 주요 메트릭 카드들 -->
                <div class="metrics-grid">
                    ${generateMetricCard('🖥️ 서버 상태', [
                        { label: '업타임', value: metrics.server.uptime.formatted },
                        { label: '메모리 사용률', value: `${metrics.server.memory.usage}%`, status: getMemoryStatus(metrics.server.memory.usage) },
                        { label: '시스템 상태', value: metrics.system.status, status: metrics.system.status }
                    ])}

                    ${generateMetricCard('👥 플레이어', [
                        { label: '총 플레이어', value: metrics.players.total },
                        { label: '활성 플레이어', value: metrics.players.active },
                        { label: '신규 가입 (오늘)', value: metrics.players.newToday },
                        { label: '온라인율', value: `${metrics.players.onlineRate}%`, status: getPlayerStatus(metrics.players.onlineRate) }
                    ])}

                    ${generateMetricCard('💰 거래', [
                        { label: '오늘 거래', value: metrics.trades.today.count },
                        { label: '오늘 거래량', value: `${metrics.trades.today.volume.toLocaleString()}원` },
                        { label: '일평균 거래', value: `${metrics.trades.avgPerDay}회` },
                        { label: '평균 거래금액', value: `${metrics.trades.avgValue.toLocaleString()}원` }
                    ])}

                    ${generateMetricCard('🎯 콘텐츠', [
                        { label: '활성 상인', value: `${metrics.server.merchants?.active || 0}명` },
                        { label: '활성 퀘스트', value: `${metrics.server.content?.quests?.active || 0}개` },
                        { label: '총 스킬', value: `${metrics.server.content?.skills?.total || 0}개` },
                        { label: '시스템 로드', value: `${metrics.system.loadAverage?.toFixed(2) || 'N/A'}` }
                    ])}
                </div>

                <!-- 빠른 액션 메뉴 -->
                <div class="quick-actions">
                    <h2>🛠️ 빠른 작업</h2>
                    <div class="action-grid">
                        <a href="/admin/monitoring" class="action-item monitoring">
                            <h3>📊 실시간 모니터링</h3>
                            <p>서버 상태 실시간 감시</p>
                        </a>
                        <a href="/admin/analytics/players" class="action-item analytics">
                            <h3>👥 플레이어 분석</h3>
                            <p>플레이어 활동 및 분포 분석</p>
                        </a>
                        <a href="/admin/analytics/economy" class="action-item economics">
                            <h3>💰 경제 분석</h3>
                            <p>거래 트렌드 및 경제 지표</p>
                        </a>
                        <a href="/admin/players" class="action-item management">
                            <h3>⚙️ 데이터 관리</h3>
                            <p>플레이어 및 게임 데이터 관리</p>
                        </a>
                    </div>
                </div>

                ${getFooter()}
            </div>

            <script>
                // 30초마다 자동 새로고침
                setTimeout(() => {
                    window.location.reload();
                }, 30000);

                // 실시간 업데이트 (WebSocket 향후 구현)
                function updateLiveData() {
                    fetch('/admin/api/live')
                        .then(response => response.json())
                        .then(data => {
                            if (data.success) {
                                // DOM 업데이트 로직
                                console.log('Live data updated:', data.data);
                            }
                        })
                        .catch(error => logger.error('Live update failed:', error));
                }

                // 5초마다 실시간 데이터 업데이트
                setInterval(updateLiveData, 5000);
            </script>
        </body>
        </html>
    `;
}

function generateMonitoringDashboard(metrics) {
    // 기존 monitoring.js의 HTML 생성 로직과 유사하지만 통합된 스타일 적용
    return `
        <!DOCTYPE html>
        <html>
        <head>
            <title>실시간 모니터링 - Way Game Admin</title>
            <meta charset="utf-8">
            <meta name="viewport" content="width=device-width, initial-scale=1">
            ${getCommonStyles()}
            ${getMonitoringStyles()}
        </head>
        <body>
            <div class="container">
                ${getNavigation('monitoring')}

                <div class="header">
                    <h1><span class="live-indicator"></span>실시간 시스템 모니터링</h1>
                    <div class="last-update">
                        마지막 업데이트: ${new Date(metrics.timestamp).toLocaleString()}
                    </div>
                </div>

                ${generateMonitoringContent(metrics)}
                ${getFooter()}
            </div>

            <script>
                // 실시간 업데이트 로직
                setTimeout(() => window.location.reload(), 30000);
            </script>
        </body>
        </html>
    `;
}

function generatePlayerAnalyticsDashboard(metrics) {
    return `
        <!DOCTYPE html>
        <html>
        <head>
            <title>플레이어 분석 - Way Game Admin</title>
            <meta charset="utf-8">
            <meta name="viewport" content="width=device-width, initial-scale=1">
            ${getCommonStyles()}
        </head>
        <body>
            <div class="container">
                ${getNavigation('analytics')}

                <div class="header">
                    <h1>👥 플레이어 분석 대시보드</h1>
                    <div class="time-range-selector">
                        <select onchange="changeTimeRange(this.value)">
                            <option value="1d" ${metrics.timeRange === '1d' ? 'selected' : ''}>최근 1일</option>
                            <option value="7d" ${metrics.timeRange === '7d' ? 'selected' : ''}>최근 7일</option>
                            <option value="30d" ${metrics.timeRange === '30d' ? 'selected' : ''}>최근 30일</option>
                        </select>
                    </div>
                </div>

                ${generatePlayerAnalyticsContent(metrics)}
                ${getFooter()}
            </div>

            <script>
                function changeTimeRange(range) {
                    window.location.href = '/admin/analytics/players?range=' + range;
                }
            </script>
        </body>
        </html>
    `;
}

function generateEconomyAnalyticsDashboard(metrics) {
    return `
        <!DOCTYPE html>
        <html>
        <head>
            <title>경제 분석 - Way Game Admin</title>
            <meta charset="utf-8">
            <meta name="viewport" content="width=device-width, initial-scale=1">
            ${getCommonStyles()}
        </head>
        <body>
            <div class="container">
                ${getNavigation('analytics')}

                <div class="header">
                    <h1>💰 경제 분석 대시보드</h1>
                    <div class="time-range-selector">
                        <select onchange="changeTimeRange(this.value)">
                            <option value="1d" ${metrics.timeRange === '1d' ? 'selected' : ''}>최근 1일</option>
                            <option value="7d" ${metrics.timeRange === '7d' ? 'selected' : ''}>최근 7일</option>
                            <option value="30d" ${metrics.timeRange === '30d' ? 'selected' : ''}>최근 30일</option>
                        </select>
                    </div>
                </div>

                ${generateEconomyAnalyticsContent(metrics)}
                ${getFooter()}
            </div>

            <script>
                function changeTimeRange(range) {
                    window.location.href = '/admin/analytics/economy?range=' + range;
                }
            </script>
        </body>
        </html>
    `;
}

function generateLegacyPlayerPage(players, tableRows) {
    return `
        <!DOCTYPE html>
        <html>
        <head>
            <title>플레이어 관리 - Way Game Admin</title>
            <meta charset="utf-8">
            <meta name="viewport" content="width=device-width, initial-scale=1">
            ${getCommonStyles()}
        </head>
        <body>
            <div class="container">
                ${getNavigation('management')}

                <div class="header">
                    <h1>👥 플레이어 관리</h1>
                    <p>총 ${players.length}명의 플레이어 (최근 50명)</p>
                </div>

                <div class="table-container">
                    <table class="data-table">
                        <thead>
                            <tr>
                                <th>이름</th>
                                <th>레벨</th>
                                <th>라이센스</th>
                                <th>보유금</th>
                                <th>거래횟수</th>
                                <th>최종 접속</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${tableRows}
                        </tbody>
                    </table>
                </div>

                ${getFooter()}
            </div>
        </body>
        </html>
    `;
}

function generateErrorPage(title, message) {
    return `
        <!DOCTYPE html>
        <html>
        <head>
            <title>오류 - Way Game Admin</title>
            <meta charset="utf-8">
            ${getCommonStyles()}
        </head>
        <body>
            <div class="container">
                ${getNavigation('')}

                <div class="error-page">
                    <h1>❌ ${title}</h1>
                    <p class="error-message">${message}</p>
                    <a href="/admin" class="btn btn-primary">대시보드로 돌아가기</a>
                </div>

                ${getFooter()}
            </div>
        </body>
        </html>
    `;
}

// ================================
// 공통 UI 컴포넌트들
// ================================

function getNavigation(current) {
    const items = [
        { key: 'dashboard', label: '대시보드', url: '/admin' },
        { key: 'monitoring', label: '모니터링', url: '/admin/monitoring' },
        { key: 'analytics', label: '분석', url: '/admin/analytics/players' },
        { key: 'management', label: '관리', url: '/admin/players' }
    ];

    return `
        <nav class="main-nav">
            <div class="nav-brand">
                <h2>🎮 Way Game Admin</h2>
            </div>
            <div class="nav-items">
                ${items.map(item => `
                    <a href="${item.url}" class="nav-item ${current === item.key ? 'active' : ''}">
                        ${item.label}
                    </a>
                `).join('')}
            </div>
        </nav>
    `;
}

function generateMetricCard(title, metrics) {
    return `
        <div class="metric-card">
            <div class="metric-title">${title}</div>
            ${metrics.map(metric => `
                <div class="metric-item">
                    <div class="metric-label">${metric.label}</div>
                    <div class="metric-value ${metric.status ? 'status-' + metric.status : ''}">${metric.value}</div>
                </div>
            `).join('')}
        </div>
    `;
}

function getMemoryStatus(usage) {
    if (usage > 80) return 'critical';
    if (usage > 60) return 'warning';
    return 'healthy';
}

function getPlayerStatus(rate) {
    if (rate < 20) return 'critical';
    if (rate < 50) return 'warning';
    return 'healthy';
}

function generateMonitoringContent(metrics) {
    // 기존 monitoring.js의 generateMonitoringDashboard 로직 재사용
    return `<div>실시간 모니터링 콘텐츠 (상세 구현 필요)</div>`;
}

function generatePlayerAnalyticsContent(metrics) {
    return `<div>플레이어 분석 콘텐츠 (상세 구현 필요)</div>`;
}

function generateEconomyAnalyticsContent(metrics) {
    return `<div>경제 분석 콘텐츠 (상세 구현 필요)</div>`;
}

function getCommonStyles() {
    return `
        <style>
            body {
                font-family: 'Arial', sans-serif;
                margin: 0;
                background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                min-height: 100vh;
                color: #333;
            }
            .container {
                max-width: 1400px;
                margin: 0 auto;
                padding: 20px;
                background: rgba(255, 255, 255, 0.95);
                min-height: calc(100vh - 40px);
                border-radius: 10px;
                box-shadow: 0 10px 30px rgba(0,0,0,0.1);
            }

            .main-nav {
                display: flex;
                justify-content: space-between;
                align-items: center;
                padding: 15px 0;
                border-bottom: 2px solid #f0f0f0;
                margin-bottom: 30px;
            }
            .nav-brand h2 { margin: 0; color: #667eea; }
            .nav-items { display: flex; gap: 20px; }
            .nav-item {
                padding: 10px 20px;
                text-decoration: none;
                color: #666;
                border-radius: 25px;
                transition: all 0.3s ease;
            }
            .nav-item:hover, .nav-item.active {
                background: #667eea;
                color: white;
            }

            .header {
                display: flex;
                justify-content: space-between;
                align-items: center;
                margin-bottom: 30px;
                padding: 20px;
                background: linear-gradient(45deg, #f8f9fa, #e9ecef);
                border-radius: 10px;
            }
            .header h1 { margin: 0; color: #333; }
            .last-update { color: #666; font-size: 14px; }

            .alerts-section {
                background: #fff3cd;
                border: 1px solid #ffeaa7;
                border-radius: 8px;
                padding: 20px;
                margin-bottom: 30px;
            }
            .alert {
                padding: 10px 15px;
                margin: 10px 0;
                border-radius: 5px;
                border-left: 4px solid;
            }
            .alert-warning {
                background: #fff3cd;
                border-color: #ffc107;
                color: #856404;
            }
            .alert-critical {
                background: #f8d7da;
                border-color: #dc3545;
                color: #721c24;
            }

            .metrics-grid {
                display: grid;
                grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
                gap: 20px;
                margin-bottom: 30px;
            }
            .metric-card {
                background: white;
                border-radius: 10px;
                padding: 20px;
                box-shadow: 0 4px 15px rgba(0,0,0,0.1);
                border-left: 4px solid #667eea;
            }
            .metric-title {
                font-size: 18px;
                font-weight: bold;
                margin-bottom: 15px;
                color: #667eea;
            }
            .metric-item {
                display: flex;
                justify-content: space-between;
                align-items: center;
                padding: 8px 0;
                border-bottom: 1px solid #f0f0f0;
            }
            .metric-item:last-child { border-bottom: none; }
            .metric-label { color: #666; }
            .metric-value {
                font-weight: bold;
                font-size: 16px;
            }
            .status-healthy { color: #28a745; }
            .status-warning { color: #ffc107; }
            .status-critical { color: #dc3545; }

            .quick-actions h2 {
                margin-bottom: 20px;
                color: #333;
            }
            .action-grid {
                display: grid;
                grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
                gap: 20px;
            }
            .action-item {
                display: block;
                padding: 20px;
                background: white;
                border-radius: 10px;
                text-decoration: none;
                color: #333;
                box-shadow: 0 4px 15px rgba(0,0,0,0.1);
                transition: all 0.3s ease;
                border-left: 4px solid;
            }
            .action-item:hover {
                transform: translateY(-5px);
                box-shadow: 0 8px 25px rgba(0,0,0,0.15);
            }
            .action-item h3 { margin: 0 0 10px 0; }
            .action-item p { margin: 0; color: #666; font-size: 14px; }
            .action-item.monitoring { border-color: #28a745; }
            .action-item.analytics { border-color: #17a2b8; }
            .action-item.economics { border-color: #ffc107; }
            .action-item.management { border-color: #6f42c1; }

            .table-container {
                background: white;
                border-radius: 10px;
                overflow: hidden;
                box-shadow: 0 4px 15px rgba(0,0,0,0.1);
            }
            .data-table {
                width: 100%;
                border-collapse: collapse;
            }
            .data-table th, .data-table td {
                padding: 12px;
                text-align: left;
                border-bottom: 1px solid #f0f0f0;
            }
            .data-table th {
                background: #f8f9fa;
                font-weight: bold;
                color: #495057;
            }

            .time-range-selector select {
                padding: 8px 12px;
                border: 1px solid #ddd;
                border-radius: 5px;
                background: white;
                font-size: 14px;
            }

            .error-page {
                text-align: center;
                padding: 60px 20px;
            }
            .error-page h1 {
                color: #dc3545;
                margin-bottom: 20px;
            }
            .error-message {
                color: #666;
                font-size: 16px;
                margin-bottom: 30px;
            }
            .btn {
                display: inline-block;
                padding: 12px 24px;
                text-decoration: none;
                border-radius: 5px;
                font-weight: bold;
                transition: all 0.3s ease;
            }
            .btn-primary {
                background: #667eea;
                color: white;
            }
            .btn-primary:hover {
                background: #5a6fd8;
            }

            .footer {
                margin-top: 40px;
                padding: 20px 0;
                border-top: 1px solid #f0f0f0;
                text-align: center;
                color: #666;
                font-size: 14px;
            }
        </style>
    `;
}

function getMonitoringStyles() {
    return `
        <style>
            .live-indicator {
                display: inline-block;
                width: 8px;
                height: 8px;
                background: #28a745;
                border-radius: 50%;
                margin-right: 8px;
                animation: pulse 2s infinite;
            }
            @keyframes pulse {
                0%, 100% { opacity: 1; }
                50% { opacity: 0.5; }
            }
        </style>
    `;
}

function getFooter() {
    return `
        <div class="footer">
            <p>Way Game Admin Dashboard v2.0 | 마지막 업데이트: ${new Date().toLocaleString()}</p>
        </div>
    `;
}

module.exports = router;