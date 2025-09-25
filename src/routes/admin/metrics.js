// 📁 src/routes/admin/metrics.js - 관리자 메트릭 API
const express = require('express');
const DatabaseManager = require('../../database/DatabaseManager');
const logger = require('../../config/logger');

const router = express.Router();

/**
 * 대시보드 요약 메트릭
 * GET /admin/api/metrics/dashboard
 */
router.get('/dashboard', async (req, res) => {
    try {
        // 현재 시간 기준 통계
        const currentStats = {
            // 활성 사용자 (최근 5분 이내)
            activeUsers: await DatabaseManager.get(`
                SELECT COUNT(*) as count FROM players 
                WHERE last_active >= datetime('now', '-5 minutes')
            `),
            
            // 오늘 거래량
            todayTrades: await DatabaseManager.get(`
                SELECT 
                    COUNT(*) as count,
                    COALESCE(SUM(total_price), 0) as volume
                FROM trade_records 
                WHERE created_at >= date('now')
            `),
            
            // 신규 가입자 (오늘)
            newSignupsToday: await DatabaseManager.get(`
                SELECT COUNT(*) as count FROM players 
                WHERE created_at >= date('now')
            `),
            
            // 서버 상태
            serverStatus: {
                uptime: process.uptime(),
                memory: process.memoryUsage(),
                timestamp: new Date().toISOString()
            }
        };

        // 24시간 트렌드 데이터 (시간별)
        const hourlyTrends = await DatabaseManager.all(`
            SELECT 
                strftime('%H', created_at) as hour,
                COUNT(*) as trade_count,
                COALESCE(SUM(total_price), 0) as trade_volume
            FROM trade_records 
            WHERE created_at >= datetime('now', '-24 hours')
            GROUP BY strftime('%H', created_at)
            ORDER BY hour
        `);

        // 7일간 일별 트렌드
        const dailyTrends = await DatabaseManager.all(`
            SELECT 
                date(created_at) as date,
                COUNT(*) as trade_count,
                COALESCE(SUM(total_price), 0) as trade_volume,
                COUNT(DISTINCT player_id) as active_players
            FROM trade_records 
            WHERE created_at >= datetime('now', '-7 days')
            GROUP BY date(created_at)
            ORDER BY date
        `);

        // 인기 아이템 TOP 10 (최근 7일)
        const popularItems = await DatabaseManager.all(`
            SELECT 
                it.name,
                it.category,
                COUNT(tr.id) as trade_count,
                ROUND(AVG(tr.total_price), 2) as avg_price
            FROM trade_records tr
            JOIN item_templates it ON tr.item_template_id = it.id
            WHERE tr.created_at >= datetime('now', '-7 days')
            GROUP BY it.id
            ORDER BY trade_count DESC
            LIMIT 10
        `);

        // 플레이어 레벨 분포
        const levelDistribution = await DatabaseManager.all(`
            SELECT 
                CASE 
                    WHEN level <= 5 THEN '1-5'
                    WHEN level <= 10 THEN '6-10'
                    WHEN level <= 20 THEN '11-20'
                    WHEN level <= 50 THEN '21-50'
                    ELSE '50+'
                END as level_range,
                COUNT(*) as count
            FROM players 
            GROUP BY level_range
            ORDER BY MIN(level)
        `);

        res.json({
            success: true,
            data: {
                summary: {
                    activeUsers: currentStats.activeUsers.count,
                    todayTrades: currentStats.todayTrades.count,
                    todayVolume: currentStats.todayTrades.volume,
                    newSignupsToday: currentStats.newSignupsToday.count,
                    serverUptime: currentStats.serverStatus.uptime,
                    timestamp: currentStats.serverStatus.timestamp
                },
                trends: {
                    hourly: hourlyTrends,
                    daily: dailyTrends
                },
                topItems: popularItems,
                playerDistribution: levelDistribution
            }
        });

    } catch (error) {
        logger.error('대시보드 메트릭 조회 실패:', error);
        res.status(500).json({
            success: false,
            error: '서버 오류가 발생했습니다'
        });
    }
});

/**
 * 플레이어 활동 메트릭
 * GET /admin/api/metrics/players
 */
router.get('/players', async (req, res) => {
    try {
        const { timeRange = '7d' } = req.query;
        
        let timeCondition = '';
        switch(timeRange) {
            case '1d': timeCondition = "datetime('now', '-1 day')"; break;
            case '7d': timeCondition = "datetime('now', '-7 days')"; break;
            case '30d': timeCondition = "datetime('now', '-30 days')"; break;
            default: timeCondition = "datetime('now', '-7 days')";
        }

        // 플레이어 통계
        const playerStats = {
            totalPlayers: await DatabaseManager.get(`SELECT COUNT(*) as count FROM players`),
            activePlayers: await DatabaseManager.get(`
                SELECT COUNT(*) as count FROM players 
                WHERE last_active >= ${timeCondition}
            `),
            newPlayers: await DatabaseManager.get(`
                SELECT COUNT(*) as count FROM players 
                WHERE created_at >= ${timeCondition}
            `),
            avgLevel: await DatabaseManager.get(`
                SELECT ROUND(AVG(level), 2) as avg_level FROM players
            `),
            avgMoney: await DatabaseManager.get(`
                SELECT ROUND(AVG(money), 2) as avg_money FROM players
            `)
        };

        // 플레이어 활동 분포 (시간별)
        const activityPattern = await DatabaseManager.all(`
            SELECT 
                strftime('%H', last_active) as hour,
                COUNT(*) as player_count
            FROM players 
            WHERE last_active >= ${timeCondition}
            GROUP BY strftime('%H', last_active)
            ORDER BY hour
        `);

        // 지역별 플레이어 분포 (최근 거래 기준)
        const regionDistribution = await DatabaseManager.all(`
            SELECT 
                m.district,
                COUNT(DISTINCT tr.player_id) as unique_players,
                COUNT(tr.id) as total_trades
            FROM trade_records tr
            JOIN merchants m ON tr.merchant_id = m.id
            WHERE tr.created_at >= ${timeCondition}
            GROUP BY m.district
            ORDER BY unique_players DESC
        `);

        res.json({
            success: true,
            data: {
                overview: {
                    totalPlayers: playerStats.totalPlayers.count,
                    activePlayers: playerStats.activePlayers.count,
                    newPlayers: playerStats.newPlayers.count,
                    averageLevel: playerStats.avgLevel.avg_level,
                    averageMoney: playerStats.avgMoney.avg_money
                },
                activityPattern,
                regionDistribution,
                timeRange
            }
        });

    } catch (error) {
        logger.error('플레이어 메트릭 조회 실패:', error);
        res.status(500).json({
            success: false,
            error: '서버 오류가 발생했습니다'
        });
    }
});

/**
 * 경제 메트릭
 * GET /admin/api/metrics/economy
 */
router.get('/economy', async (req, res) => {
    try {
        const { timeRange = '7d' } = req.query;
        
        let timeCondition = '';
        switch(timeRange) {
            case '1d': timeCondition = "datetime('now', '-1 day')"; break;
            case '7d': timeCondition = "datetime('now', '-7 days')"; break;
            case '30d': timeCondition = "datetime('now', '-30 days')"; break;
            default: timeCondition = "datetime('now', '-7 days')";
        }

        // 경제 개요
        const economyOverview = {
            totalTrades: await DatabaseManager.get(`
                SELECT COUNT(*) as count FROM trade_records 
                WHERE created_at >= ${timeCondition}
            `),
            totalVolume: await DatabaseManager.get(`
                SELECT COALESCE(SUM(total_price), 0) as volume FROM trade_records 
                WHERE created_at >= ${timeCondition}
            `),
            avgTradeValue: await DatabaseManager.get(`
                SELECT ROUND(AVG(total_price), 2) as avg_value FROM trade_records 
                WHERE created_at >= ${timeCondition}
            `),
            uniqueTraders: await DatabaseManager.get(`
                SELECT COUNT(DISTINCT player_id) as count FROM trade_records 
                WHERE created_at >= ${timeCondition}
            `)
        };

        // 카테고리별 거래 통계
        const categoryStats = await DatabaseManager.all(`
            SELECT 
                it.category,
                COUNT(tr.id) as trade_count,
                COALESCE(SUM(tr.total_price), 0) as total_volume,
                ROUND(AVG(tr.total_price), 2) as avg_price
            FROM trade_records tr
            JOIN item_templates it ON tr.item_template_id = it.id
            WHERE tr.created_at >= ${timeCondition}
            GROUP BY it.category
            ORDER BY total_volume DESC
        `);

        // 일별 거래량 추이
        const dailyTradeTrends = await DatabaseManager.all(`
            SELECT 
                date(created_at) as date,
                COUNT(*) as trade_count,
                COALESCE(SUM(total_price), 0) as volume,
                ROUND(AVG(total_price), 2) as avg_price
            FROM trade_records 
            WHERE created_at >= ${timeCondition}
            GROUP BY date(created_at)
            ORDER BY date
        `);

        // 상위 상인별 거래량
        const topMerchants = await DatabaseManager.all(`
            SELECT 
                m.name,
                m.district,
                COUNT(tr.id) as trade_count,
                COALESCE(SUM(tr.total_price), 0) as total_volume
            FROM trade_records tr
            JOIN merchants m ON tr.merchant_id = m.id
            WHERE tr.created_at >= ${timeCondition}
            GROUP BY m.id
            ORDER BY total_volume DESC
            LIMIT 10
        `);

        res.json({
            success: true,
            data: {
                overview: {
                    totalTrades: economyOverview.totalTrades.count,
                    totalVolume: economyOverview.totalVolume.volume,
                    avgTradeValue: economyOverview.avgTradeValue.avg_value,
                    uniqueTraders: economyOverview.uniqueTraders.count
                },
                categoryStats,
                dailyTrends: dailyTradeTrends,
                topMerchants,
                timeRange
            }
        });

    } catch (error) {
        logger.error('경제 메트릭 조회 실패:', error);
        res.status(500).json({
            success: false,
            error: '서버 오류가 발생했습니다'
        });
    }
});

/**
 * 시스템 상태 메트릭
 * GET /admin/api/metrics/system
 */
router.get('/system', async (req, res) => {
    try {
        const os = require('os');
        
        // 시스템 정보
        const systemInfo = {
            uptime: process.uptime(),
            memory: process.memoryUsage(),
            cpu: process.cpuUsage(),
            platform: os.platform(),
            hostname: os.hostname(),
            loadAverage: os.loadavg(),
            freeMemory: os.freemem(),
            totalMemory: os.totalmem(),
            cpuCount: os.cpus().length
        };

        // 데이터베이스 상태
        const dbStats = {
            totalTables: await DatabaseManager.get(`
                SELECT COUNT(*) as count FROM sqlite_master WHERE type='table'
            `),
            totalRecords: {
                players: await DatabaseManager.get(`SELECT COUNT(*) as count FROM players`),
                trades: await DatabaseManager.get(`SELECT COUNT(*) as count FROM trade_records`),
                merchants: await DatabaseManager.get(`SELECT COUNT(*) as count FROM merchants`),
                items: await DatabaseManager.get(`SELECT COUNT(*) as count FROM item_templates`)
            }
        };

        // 최근 서버 메트릭 (저장된 메트릭이 있다면)
        const recentMetrics = await DatabaseManager.all(`
            SELECT * FROM server_metrics 
            ORDER BY created_at DESC 
            LIMIT 24
        `).catch(() => []); // 테이블이 없을 수 있음

        res.json({
            success: true,
            data: {
                systemInfo: {
                    uptime: systemInfo.uptime,
                    memoryUsage: {
                        rss: Math.round(systemInfo.memory.rss / 1024 / 1024) + ' MB',
                        heapTotal: Math.round(systemInfo.memory.heapTotal / 1024 / 1024) + ' MB',
                        heapUsed: Math.round(systemInfo.memory.heapUsed / 1024 / 1024) + ' MB',
                        external: Math.round(systemInfo.memory.external / 1024 / 1024) + ' MB'
                    },
                    systemMemory: {
                        free: Math.round(systemInfo.freeMemory / 1024 / 1024 / 1024 * 100) / 100 + ' GB',
                        total: Math.round(systemInfo.totalMemory / 1024 / 1024 / 1024 * 100) / 100 + ' GB',
                        usage: Math.round((1 - systemInfo.freeMemory / systemInfo.totalMemory) * 100) + '%'
                    },
                    cpu: {
                        count: systemInfo.cpuCount,
                        loadAverage: systemInfo.loadAverage.map(load => Math.round(load * 100) / 100)
                    },
                    platform: systemInfo.platform,
                    hostname: systemInfo.hostname
                },
                database: {
                    tableCount: dbStats.totalTables.count,
                    recordCounts: {
                        players: dbStats.totalRecords.players.count,
                        trades: dbStats.totalRecords.trades.count,
                        merchants: dbStats.totalRecords.merchants.count,
                        items: dbStats.totalRecords.items.count
                    }
                },
                recentMetrics: recentMetrics.slice(0, 12), // 최근 12개 데이터 포인트
                timestamp: new Date().toISOString()
            }
        });

    } catch (error) {
        logger.error('시스템 메트릭 조회 실패:', error);
        res.status(500).json({
            success: false,
            error: '서버 오류가 발생했습니다'
        });
    }
});

module.exports = router;