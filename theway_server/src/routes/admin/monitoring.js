// 📁 src/routes/admin/monitoring.js - 실시간 모니터링 라우트
const express = require('express');
const MetricsCollector = require('../../utils/MetricsCollector');
const { AdminAuth } = require('../../middleware/adminAuth');
const logger = require('../../config/logger');

const router = express.Router();

// 프로덕션 환경에서는 인증 필수
if (process.env.NODE_ENV === 'production') {
    router.use(AdminAuth.authenticateToken);
}

/**
 * 실시간 모니터링 대시보드
 * GET /admin/monitoring
 */
router.get('/', async (req, res) => {
    try {
        // 간단한 메트릭 수집 (MetricsCollector는 다른 구조)
        const metrics = await collectSimpleMetrics();
        const alerts = [];

        const dashboardHTML = generateMonitoringDashboard(metrics, alerts);
        
        res.send(`
            <!DOCTYPE html>
            <html>
            <head>
                <title>실시간 모니터링 - Way Game Admin</title>
                <meta charset="utf-8">
                <meta name="viewport" content="width=device-width, initial-scale=1">
                <style>
                    body { font-family: Arial, sans-serif; margin: 0; background-color: #1a1a1a; color: #fff; }
                    .container { max-width: 1400px; margin: 0 auto; padding: 20px; }
                    .header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 30px; }
                    .header h1 { margin: 0; color: #4CAF50; }
                    .last-update { color: #888; font-size: 14px; }
                    
                    .metrics-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(300px, 1fr)); gap: 20px; margin-bottom: 30px; }
                    .metric-card { background: #2d2d2d; border-radius: 8px; padding: 20px; border-left: 4px solid #4CAF50; }
                    .metric-card.warning { border-left-color: #FFC107; }
                    .metric-card.critical { border-left-color: #F44336; }
                    
                    .metric-title { font-size: 18px; font-weight: bold; margin-bottom: 15px; color: #4CAF50; }
                    .metric-value { font-size: 24px; font-weight: bold; margin-bottom: 5px; }
                    .metric-label { color: #888; font-size: 14px; }
                    .metric-progress { width: 100%; height: 8px; background: #444; border-radius: 4px; margin-top: 10px; overflow: hidden; }
                    .metric-progress-bar { height: 100%; transition: width 0.3s ease; }
                    .progress-normal { background: #4CAF50; }
                    .progress-warning { background: #FFC107; }
                    .progress-critical { background: #F44336; }
                    
                    .alerts { margin-bottom: 30px; }
                    .alert { background: #2d2d2d; border-radius: 8px; padding: 15px; margin-bottom: 10px; }
                    .alert.warning { border-left: 4px solid #FFC107; }
                    .alert.critical { border-left: 4px solid #F44336; }
                    .alert.info { border-left: 4px solid #2196F3; }
                    
                    .details-section { background: #2d2d2d; border-radius: 8px; padding: 20px; margin-bottom: 20px; }
                    .details-title { font-size: 18px; font-weight: bold; margin-bottom: 15px; color: #4CAF50; }
                    .details-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; }
                    .detail-item { display: flex; justify-content: space-between; padding: 5px 0; border-bottom: 1px solid #444; }
                    .detail-label { color: #888; }
                    .detail-value { font-weight: bold; }
                    
                    .table { width: 100%; border-collapse: collapse; margin-top: 15px; }
                    .table th, .table td { padding: 10px; text-align: left; border-bottom: 1px solid #444; }
                    .table th { background: #333; color: #4CAF50; }
                    
                    .status-online { color: #4CAF50; }
                    .status-offline { color: #F44336; }
                    .status-warning { color: #FFC107; }
                    
                    .nav-link { color: #4CAF50; text-decoration: none; margin-right: 20px; }
                    .nav-link:hover { text-decoration: underline; }
                    
                    @keyframes pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.5; } }
                    .live-indicator { 
                        display: inline-block; width: 8px; height: 8px; 
                        background: #4CAF50; border-radius: 50%; 
                        margin-right: 8px; animation: pulse 2s infinite; 
                    }
                </style>
            </head>
            <body>
                <div class="container">
                    <div class="header">
                        <div>
                            <h1><span class="live-indicator"></span>실시간 시스템 모니터링</h1>
                            <div>
                                <a href="/admin" class="nav-link">대시보드</a>
                                <a href="/admin/crud/players" class="nav-link">플레이어</a>
                                <a href="/admin/crud/merchants" class="nav-link">상인</a>
                                <a href="/admin/crud/quests" class="nav-link">퀘스트</a>
                            </div>
                        </div>
                        <div class="last-update">
                            마지막 업데이트: ${new Date().toLocaleString()} (수집시간: ${metrics.collectionTime})
                        </div>
                    </div>
                    
                    ${dashboardHTML}
                </div>
                
                <script>
                    // 30초마다 자동 새로고침
                    setTimeout(() => {
                        window.location.reload();
                    }, 30000);
                    
                    // WebSocket 연결 (향후 구현)
                    function connectWebSocket() {
                        // const ws = new WebSocket('ws://localhost:3000/admin-metrics');
                        // ws.onmessage = function(event) {
                        //     const data = JSON.parse(event.data);
                        //     updateMetrics(data);
                        // };
                    }
                </script>
            </body>
            </html>
        `);

    } catch (error) {
        logger.error('모니터링 대시보드 로드 실패:', error);
        res.status(500).send(`<h1>오류</h1><p>${error.message}</p>`);
    }
});

/**
 * 메트릭 API (JSON)
 * GET /admin/monitoring/api/metrics
 */
router.get('/api/metrics', async (req, res) => {
    try {
        // 간단한 메트릭 수집 (MetricsCollector는 다른 구조)
        const metrics = await collectSimpleMetrics();
        const alerts = [];

        res.json({
            success: true,
            data: {
                metrics,
                alerts,
                timestamp: new Date().toISOString()
            }
        });

    } catch (error) {
        logger.error('메트릭 API 실패:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

/**
 * 메트릭 히스토리 API
 * GET /admin/monitoring/api/history
 */
router.get('/api/history', async (req, res) => {
    try {
        const hours = parseInt(req.query.hours) || 24;
        // 임시로 빈 히스토리 반환 (향후 구현)
        const history = [];

        res.json({
            success: true,
            data: history
        });

    } catch (error) {
        logger.error('메트릭 히스토리 API 실패:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

/**
 * 메트릭 정리 API
 * POST /admin/monitoring/api/cleanup
 */
router.post('/api/cleanup', AdminAuth.requirePermission('system.maintenance'), async (req, res) => {
    try {
        const daysToKeep = parseInt(req.body.days) || 30;
        // 임시로 0 반환 (향후 구현)
        const deletedCount = 0;

        res.json({
            success: true,
            message: `${deletedCount}개의 오래된 메트릭을 삭제했습니다`,
            deletedCount
        });

    } catch (error) {
        logger.error('메트릭 정리 실패:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// 모니터링 대시보드 HTML 생성
function generateMonitoringDashboard(metrics, alerts) {
    let alertsHTML = '';
    if (alerts.length > 0) {
        alertsHTML = `
            <div class="alerts">
                <h2>🚨 알림</h2>
                ${alerts.map(alert => `
                    <div class="alert ${alert.level}">
                        <strong>${alert.type.toUpperCase()}:</strong> ${alert.message}
                        ${alert.value ? `(현재: ${alert.value}${alert.unit || ''})` : ''}
                    </div>
                `).join('')}
            </div>
        `;
    }

    const memoryUsage = metrics.server.memory.usage;
    const memoryClass = memoryUsage > 80 ? 'critical' : memoryUsage > 60 ? 'warning' : 'normal';
    
    const onlineRate = metrics.players.onlineRate;
    const playerClass = onlineRate < 20 ? 'critical' : onlineRate < 50 ? 'warning' : 'normal';

    return `
        ${alertsHTML}
        
        <!-- 주요 메트릭 카드들 -->
        <div class="metrics-grid">
            <!-- 서버 상태 -->
            <div class="metric-card">
                <div class="metric-title">🖥️ 서버 상태</div>
                <div class="metric-value status-online">${metrics.server.uptime.formatted}</div>
                <div class="metric-label">업타임</div>
                <div class="detail-item">
                    <span>메모리 사용량</span>
                    <span class="status-${memoryClass}">${metrics.server.memory.used}MB / ${metrics.server.memory.total}MB (${memoryUsage}%)</span>
                </div>
                <div class="metric-progress">
                    <div class="metric-progress-bar progress-${memoryClass}" style="width: ${memoryUsage}%"></div>
                </div>
            </div>
            
            <!-- 플레이어 현황 -->
            <div class="metric-card ${playerClass === 'normal' ? '' : playerClass}">
                <div class="metric-title">👥 플레이어</div>
                <div class="metric-value">${metrics.players.active} / ${metrics.players.total}</div>
                <div class="metric-label">활성 플레이어 / 전체</div>
                <div class="detail-item">
                    <span>온라인율</span>
                    <span class="status-${playerClass}">${onlineRate}%</span>
                </div>
                <div class="metric-progress">
                    <div class="metric-progress-bar progress-${playerClass}" style="width: ${onlineRate}%"></div>
                </div>
            </div>
            
            <!-- 거래 현황 -->
            <div class="metric-card">
                <div class="metric-title">💰 거래</div>
                <div class="metric-value">${metrics.game.trades.today.count}</div>
                <div class="metric-label">오늘 거래 횟수</div>
                <div class="detail-item">
                    <span>거래량</span>
                    <span>${metrics.game.trades.today.volume.toLocaleString()}원</span>
                </div>
                <div class="detail-item">
                    <span>주간 평균</span>
                    <span>${metrics.game.trades.avgPerDay}회/일</span>
                </div>
            </div>
            
            <!-- 데이터베이스 상태 -->
            <div class="metric-card">
                <div class="metric-title">🗄️ 데이터베이스</div>
                <div class="metric-value">${metrics.database.file ? metrics.database.file.size : 'N/A'}</div>
                <div class="metric-label">데이터베이스 크기 (MB)</div>
                <div class="detail-item">
                    <span>쿼리 성능</span>
                    <span>${metrics.database.performance ? metrics.database.performance.queryTime : 'N/A'}ms</span>
                </div>
            </div>
        </div>
        
        <!-- 상세 정보 섹션 -->
        <div class="details-section">
            <div class="details-title">📊 상세 통계</div>
            <div class="details-grid">
                <div>
                    <h3>시스템 정보</h3>
                    <div class="detail-item">
                        <span>플랫폼</span>
                        <span>${metrics.server.system.platform} ${metrics.server.system.arch}</span>
                    </div>
                    <div class="detail-item">
                        <span>Node.js</span>
                        <span>${metrics.server.system.nodeVersion}</span>
                    </div>
                    <div class="detail-item">
                        <span>CPU 코어</span>
                        <span>${metrics.server.cpu.cores}개</span>
                    </div>
                    <div class="detail-item">
                        <span>시스템 메모리</span>
                        <span>${metrics.server.memory.systemFree}MB / ${metrics.server.memory.systemTotal}MB 사용가능</span>
                    </div>
                </div>
                
                <div>
                    <h3>게임 컨텐츠</h3>
                    <div class="detail-item">
                        <span>활성 상인</span>
                        <span>${metrics.game.merchants.active}명</span>
                    </div>
                    <div class="detail-item">
                        <span>퀘스트</span>
                        <span>${metrics.game.content.quests.active} / ${metrics.game.content.quests.total}</span>
                    </div>
                    <div class="detail-item">
                        <span>스킬</span>
                        <span>${metrics.game.content.skills.total}개</span>
                    </div>
                    <div class="detail-item">
                        <span>총 거래</span>
                        <span>${metrics.game.trades.total}회</span>
                    </div>
                </div>
            </div>
        </div>
        
        <!-- 테이블 정보 -->
        <div class="details-section">
            <div class="details-title">🗃️ 데이터베이스 테이블</div>
            <table class="table">
                <thead>
                    <tr>
                        <th>테이블</th>
                        <th>레코드 수</th>
                        <th>상태</th>
                    </tr>
                </thead>
                <tbody>
                    ${Object.entries(metrics.database.tables || {}).map(([table, count]) => `
                        <tr>
                            <td>${table}</td>
                            <td>${count.toLocaleString()}</td>
                            <td><span class="status-online">정상</span></td>
                        </tr>
                    `).join('')}
                </tbody>
            </table>
        </div>
        
        <!-- 플레이어 분포 -->
        ${metrics.players.levels && metrics.players.levels.length > 0 ? `
            <div class="details-section">
                <div class="details-title">📈 플레이어 레벨 분포</div>
                <table class="table">
                    <thead>
                        <tr>
                            <th>레벨 범위</th>
                            <th>플레이어 수</th>
                            <th>비율</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${metrics.players.levels.map(level => {
                            const percentage = Math.round((level.count / metrics.players.total) * 100);
                            return `
                                <tr>
                                    <td>${level.level_range}</td>
                                    <td>${level.count}</td>
                                    <td>${percentage}%</td>
                                </tr>
                            `;
                        }).join('')}
                    </tbody>
                </table>
            </div>
        ` : ''}
    `;
}

// 간단한 메트릭 수집 함수 (임시)
async function collectSimpleMetrics() {
    try {
        const DatabaseManager = require('../../database/DatabaseManager');
        const os = require('os');
        const process = require('process');

        // 기본 시스템 정보
        const memUsed = Math.round(process.memoryUsage().heapUsed / 1024 / 1024);
        const memTotal = Math.round(os.totalmem() / 1024 / 1024);
        const memUsage = Math.round((memUsed / memTotal) * 100);

        // 플레이어 수 조회
        const totalPlayers = await DatabaseManager.get('SELECT COUNT(*) as count FROM players') || { count: 0 };
        const activePlayers = await DatabaseManager.get(`
            SELECT COUNT(*) as count FROM players
            WHERE last_active >= datetime('now', '-5 minutes')
        `) || { count: 0 };

        // 거래 수 조회
        const todayTrades = await DatabaseManager.get(`
            SELECT COUNT(*) as count FROM trade_records
            WHERE created_at >= datetime('now', 'start of day')
        `) || { count: 0 };

        return {
            collectionTime: new Date().toLocaleString(),
            server: {
                uptime: {
                    formatted: formatUptime(process.uptime())
                },
                memory: {
                    used: memUsed,
                    total: memTotal,
                    usage: memUsage,
                    systemFree: Math.round(os.freemem() / 1024 / 1024),
                    systemTotal: Math.round(os.totalmem() / 1024 / 1024)
                },
                cpu: {
                    cores: os.cpus().length
                },
                system: {
                    platform: os.platform(),
                    arch: os.arch(),
                    nodeVersion: process.version
                }
            },
            players: {
                active: activePlayers.count,
                total: totalPlayers.count,
                onlineRate: totalPlayers.count > 0 ? Math.round((activePlayers.count / totalPlayers.count) * 100) : 0,
                levels: []
            },
            game: {
                trades: {
                    today: {
                        count: todayTrades.count,
                        volume: 0
                    },
                    total: todayTrades.count,
                    avgPerDay: Math.round(todayTrades.count / 7)
                },
                merchants: {
                    active: 0
                },
                content: {
                    quests: {
                        active: 0,
                        total: 0
                    },
                    skills: {
                        total: 0
                    }
                }
            },
            database: {
                file: {
                    size: 'N/A'
                },
                performance: {
                    queryTime: 'N/A'
                },
                tables: {}
            }
        };
    } catch (error) {
        logger.error('메트릭 수집 실패:', error);
        return {
            collectionTime: new Date().toLocaleString(),
            server: { uptime: { formatted: 'N/A' }, memory: { used: 0, total: 0, usage: 0 }, cpu: { cores: 1 }, system: {} },
            players: { active: 0, total: 0, onlineRate: 0, levels: [] },
            game: { trades: { today: { count: 0, volume: 0 }, total: 0, avgPerDay: 0 }, merchants: { active: 0 }, content: { quests: { active: 0, total: 0 }, skills: { total: 0 } } },
            database: { file: { size: 'N/A' }, performance: { queryTime: 'N/A' }, tables: {} }
        };
    }
}

function formatUptime(seconds) {
    const days = Math.floor(seconds / 86400);
    const hours = Math.floor((seconds % 86400) / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);

    if (days > 0) {
        return `${days}일 ${hours}시간 ${minutes}분`;
    } else if (hours > 0) {
        return `${hours}시간 ${minutes}분`;
    } else {
        return `${minutes}분`;
    }
}

module.exports = router;