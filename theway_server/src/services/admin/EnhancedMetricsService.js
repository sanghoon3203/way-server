// 📁 src/services/admin/EnhancedMetricsService.js - 통합 메트릭 서비스
const DatabaseManager = require('../../database/DatabaseManager');
const logger = require('../../config/logger');
const os = require('os');
const { performance } = require('perf_hooks');

class EnhancedMetricsService {
    constructor() {
        this.cache = new Map();
        this.cacheTimeout = 30000; // 30초 캐시
        this.isCollecting = false;
    }

    // ================================
    // 메인 통합 메트릭 수집 API
    // ================================

    /**
     * 대시보드용 종합 메트릭 (캐시 적용)
     */
    async getDashboardMetrics() {
        const cacheKey = 'dashboard_metrics';
        const cached = this.getFromCache(cacheKey);
        if (cached) return cached;

        try {
            const metrics = await this.collectDashboardMetrics();
            this.setCache(cacheKey, metrics);
            return metrics;
        } catch (error) {
            logger.error('대시보드 메트릭 수집 실패:', error);
            throw error;
        }
    }

    /**
     * 실시간 모니터링 메트릭
     */
    async getMonitoringMetrics() {
        const cacheKey = 'monitoring_metrics';
        const cached = this.getFromCache(cacheKey, 10000); // 10초 캐시
        if (cached) return cached;

        try {
            const metrics = await this.collectMonitoringMetrics();
            this.setCache(cacheKey, metrics, 10000);
            return metrics;
        } catch (error) {
            logger.error('모니터링 메트릭 수집 실패:', error);
            throw error;
        }
    }

    /**
     * 플레이어 분석 메트릭
     */
    async getPlayerAnalytics(timeRange = '7d') {
        const cacheKey = `player_analytics_${timeRange}`;
        const cached = this.getFromCache(cacheKey, 60000); // 1분 캐시
        if (cached) return cached;

        try {
            const metrics = await this.collectPlayerAnalytics(timeRange);
            this.setCache(cacheKey, metrics, 60000);
            return metrics;
        } catch (error) {
            logger.error('플레이어 분석 메트릭 수집 실패:', error);
            throw error;
        }
    }

    /**
     * 경제 분석 메트릭
     */
    async getEconomyAnalytics(timeRange = '7d') {
        const cacheKey = `economy_analytics_${timeRange}`;
        const cached = this.getFromCache(cacheKey, 60000); // 1분 캐시
        if (cached) return cached;

        try {
            const metrics = await this.collectEconomyAnalytics(timeRange);
            this.setCache(cacheKey, metrics, 60000);
            return metrics;
        } catch (error) {
            logger.error('경제 분석 메트릭 수집 실패:', error);
            throw error;
        }
    }

    // ================================
    // 개별 메트릭 수집 메서드들
    // ================================

    /**
     * 대시보드 메트릭 수집
     */
    async collectDashboardMetrics() {
        const startTime = performance.now();

        const [serverStats, playerStats, tradeStats, systemHealth] = await Promise.all([
            this.getServerStatus(),
            this.getPlayerSummary(),
            this.getTradeSummary(),
            this.getSystemHealth()
        ]);

        const collectionTime = Math.round(performance.now() - startTime);

        return {
            timestamp: new Date().toISOString(),
            collectionTime: `${collectionTime}ms`,
            server: serverStats,
            players: playerStats,
            trades: tradeStats,
            system: systemHealth,
            alerts: await this.generateAlerts({
                server: serverStats,
                players: playerStats,
                system: systemHealth
            })
        };
    }

    /**
     * 실시간 모니터링 메트릭 수집
     */
    async collectMonitoringMetrics() {
        const [
            serverMetrics,
            gameMetrics,
            databaseMetrics,
            alertData
        ] = await Promise.all([
            this.getDetailedServerMetrics(),
            this.getGameMetrics(),
            this.getDatabaseMetrics(),
            this.checkSystemAlerts()
        ]);

        return {
            timestamp: new Date().toISOString(),
            server: serverMetrics,
            game: gameMetrics,
            database: databaseMetrics,
            alerts: alertData,
            collectionTime: `${Date.now() % 1000}ms`
        };
    }

    /**
     * 플레이어 분석 메트릭 수집
     */
    async collectPlayerAnalytics(timeRange) {
        const timeCondition = this.getTimeCondition(timeRange);

        const [overview, activity, distribution, engagement] = await Promise.all([
            this.getPlayerOverview(timeCondition),
            this.getPlayerActivityPattern(timeCondition),
            this.getPlayerDistribution(),
            this.getPlayerEngagement(timeCondition)
        ]);

        return {
            timeRange,
            overview,
            activity,
            distribution,
            engagement,
            timestamp: new Date().toISOString()
        };
    }

    /**
     * 경제 분석 메트릭 수집
     */
    async collectEconomyAnalytics(timeRange) {
        const timeCondition = this.getTimeCondition(timeRange);

        const [overview, trends, categories, merchants] = await Promise.all([
            this.getEconomyOverview(timeCondition),
            this.getTradeTrends(timeCondition),
            this.getCategoryAnalysis(timeCondition),
            this.getMerchantAnalysis(timeCondition)
        ]);

        return {
            timeRange,
            overview,
            trends,
            categories,
            merchants,
            timestamp: new Date().toISOString()
        };
    }

    // ================================
    // 서버 메트릭 수집
    // ================================

    async getServerStatus() {
        const memoryUsage = process.memoryUsage();
        const uptime = process.uptime();

        return {
            uptime: {
                seconds: Math.round(uptime),
                formatted: this.formatUptime(uptime)
            },
            memory: {
                used: Math.round(memoryUsage.heapUsed / 1024 / 1024),
                total: Math.round(memoryUsage.heapTotal / 1024 / 1024),
                usage: Math.round((memoryUsage.heapUsed / memoryUsage.heapTotal) * 100),
                external: Math.round(memoryUsage.external / 1024 / 1024),
                systemFree: Math.round(os.freemem() / 1024 / 1024),
                systemTotal: Math.round(os.totalmem() / 1024 / 1024)
            },
            cpu: {
                cores: os.cpus().length,
                loadAverage: os.loadavg().map(load => Math.round(load * 100) / 100)
            },
            system: {
                platform: os.platform(),
                arch: os.arch(),
                nodeVersion: process.version,
                hostname: os.hostname()
            }
        };
    }

    async getDetailedServerMetrics() {
        const basic = await this.getServerStatus();

        return {
            ...basic,
            process: {
                pid: process.pid,
                version: process.version,
                uptime: process.uptime()
            },
            network: {
                // 네트워크 연결 수 등 (추후 확장)
                activeConnections: 0
            }
        };
    }

    // ================================
    // 플레이어 메트릭 수집
    // ================================

    async getPlayerSummary() {
        const [total, active, today] = await Promise.all([
            DatabaseManager.get(`SELECT COUNT(*) as count FROM players`),
            DatabaseManager.get(`
                SELECT COUNT(*) as count FROM players
                WHERE last_active >= datetime('now', '-5 minutes')
            `),
            DatabaseManager.get(`
                SELECT COUNT(*) as count FROM players
                WHERE created_at >= date('now')
            `)
        ]);

        const onlineRate = total.count > 0 ? Math.round((active.count / total.count) * 100) : 0;

        return {
            total: total.count,
            active: active.count,
            newToday: today.count,
            onlineRate,
            levels: await this.getPlayerLevelDistribution()
        };
    }

    async getPlayerOverview(timeCondition) {
        const [stats, avgStats] = await Promise.all([
            Promise.all([
                DatabaseManager.get(`SELECT COUNT(*) as count FROM players`),
                DatabaseManager.get(`
                    SELECT COUNT(*) as count FROM players
                    WHERE last_active >= ${timeCondition}
                `),
                DatabaseManager.get(`
                    SELECT COUNT(*) as count FROM players
                    WHERE created_at >= ${timeCondition}
                `)
            ]),
            Promise.all([
                DatabaseManager.get(`SELECT ROUND(AVG(level), 2) as avg_level FROM players`),
                DatabaseManager.get(`SELECT ROUND(AVG(money), 2) as avg_money FROM players`)
            ])
        ]);

        return {
            totalPlayers: stats[0].count,
            activePlayers: stats[1].count,
            newPlayers: stats[2].count,
            averageLevel: avgStats[0].avg_level,
            averageMoney: avgStats[1].avg_money
        };
    }

    async getPlayerActivityPattern(timeCondition) {
        return await DatabaseManager.all(`
            SELECT
                strftime('%H', last_active) as hour,
                COUNT(*) as player_count
            FROM players
            WHERE last_active >= ${timeCondition}
            GROUP BY strftime('%H', last_active)
            ORDER BY hour
        `);
    }

    async getPlayerDistribution() {
        return await DatabaseManager.all(`
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
    }

    async getPlayerEngagement(timeCondition) {
        return await DatabaseManager.all(`
            SELECT
                m.district,
                COUNT(DISTINCT tr.player_id) as unique_players,
                COUNT(tr.id) as total_trades,
                ROUND(AVG(tr.total_price), 2) as avg_trade_value
            FROM trade_records tr
            JOIN merchants m ON tr.merchant_id = m.id
            WHERE tr.created_at >= ${timeCondition}
            GROUP BY m.district
            ORDER BY unique_players DESC
        `);
    }

    async getPlayerLevelDistribution() {
        return await DatabaseManager.all(`
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
    }

    // ================================
    // 거래/경제 메트릭 수집
    // ================================

    async getTradeSummary() {
        const [todayTrades, totalVolume, avgValue] = await Promise.all([
            DatabaseManager.get(`
                SELECT
                    COUNT(*) as count,
                    COALESCE(SUM(total_price), 0) as volume
                FROM trade_records
                WHERE created_at >= date('now')
            `),
            DatabaseManager.get(`
                SELECT COALESCE(SUM(total_price), 0) as total FROM trade_records
            `),
            DatabaseManager.get(`
                SELECT ROUND(AVG(total_price), 2) as avg_value FROM trade_records
                WHERE created_at >= datetime('now', '-7 days')
            `)
        ]);

        return {
            today: {
                count: todayTrades.count,
                volume: todayTrades.volume
            },
            total: totalVolume.total,
            avgPerDay: await this.getAvgTradesPerDay(),
            avgValue: avgValue.avg_value || 0
        };
    }

    async getEconomyOverview(timeCondition) {
        const [tradeStats, traderStats] = await Promise.all([
            Promise.all([
                DatabaseManager.get(`
                    SELECT COUNT(*) as count FROM trade_records
                    WHERE created_at >= ${timeCondition}
                `),
                DatabaseManager.get(`
                    SELECT COALESCE(SUM(total_price), 0) as volume FROM trade_records
                    WHERE created_at >= ${timeCondition}
                `),
                DatabaseManager.get(`
                    SELECT ROUND(AVG(total_price), 2) as avg_value FROM trade_records
                    WHERE created_at >= ${timeCondition}
                `)
            ]),
            DatabaseManager.get(`
                SELECT COUNT(DISTINCT player_id) as count FROM trade_records
                WHERE created_at >= ${timeCondition}
            `)
        ]);

        return {
            totalTrades: tradeStats[0].count,
            totalVolume: tradeStats[1].volume,
            avgTradeValue: tradeStats[2].avg_value,
            uniqueTraders: traderStats.count
        };
    }

    async getTradeTrends(timeCondition) {
        return await DatabaseManager.all(`
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
    }

    async getCategoryAnalysis(timeCondition) {
        return await DatabaseManager.all(`
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
    }

    async getMerchantAnalysis(timeCondition) {
        return await DatabaseManager.all(`
            SELECT
                m.name,
                m.district,
                COUNT(tr.id) as trade_count,
                COALESCE(SUM(tr.total_price), 0) as total_volume,
                ROUND(AVG(tr.total_price), 2) as avg_trade_value
            FROM trade_records tr
            JOIN merchants m ON tr.merchant_id = m.id
            WHERE tr.created_at >= ${timeCondition}
            GROUP BY m.id
            ORDER BY total_volume DESC
            LIMIT 10
        `);
    }

    // ================================
    // 게임 메트릭 수집
    // ================================

    async getGameMetrics() {
        const [merchants, content, tradeData] = await Promise.all([
            this.getMerchantStats(),
            this.getContentStats(),
            this.getTradeSummary()
        ]);

        return {
            merchants,
            content,
            trades: tradeData
        };
    }

    async getMerchantStats() {
        const [active, total] = await Promise.all([
            DatabaseManager.get(`SELECT COUNT(*) as count FROM merchants WHERE is_active = 1`),
            DatabaseManager.get(`SELECT COUNT(*) as count FROM merchants`)
        ]);

        return {
            active: active.count,
            total: total.count,
            activeRate: total.count > 0 ? Math.round((active.count / total.count) * 100) : 0
        };
    }

    async getContentStats() {
        const [quests, skills] = await Promise.all([
            Promise.all([
                DatabaseManager.get(`SELECT COUNT(*) as count FROM quests WHERE is_active = 1`).catch(() => ({count: 0})),
                DatabaseManager.get(`SELECT COUNT(*) as count FROM quests`).catch(() => ({count: 0}))
            ]),
            DatabaseManager.get(`SELECT COUNT(*) as count FROM skills`).catch(() => ({count: 0}))
        ]);

        return {
            quests: {
                active: quests[0].count,
                total: quests[1].count
            },
            skills: {
                total: skills.count
            }
        };
    }

    // ================================
    // 데이터베이스 메트릭
    // ================================

    async getDatabaseMetrics() {
        const [tableInfo, performance] = await Promise.all([
            this.getDatabaseTableInfo(),
            this.getDatabasePerformance()
        ]);

        return {
            tables: tableInfo,
            performance,
            file: await this.getDatabaseFileInfo()
        };
    }

    async getDatabaseTableInfo() {
        const tables = ['players', 'trade_records', 'merchants', 'item_templates', 'quests', 'skills'];
        const counts = {};

        for (const table of tables) {
            try {
                const result = await DatabaseManager.get(`SELECT COUNT(*) as count FROM ${table}`);
                counts[table] = result.count;
            } catch (error) {
                counts[table] = 0; // 테이블이 없을 수 있음
            }
        }

        return counts;
    }

    async getDatabasePerformance() {
        const startTime = performance.now();

        try {
            await DatabaseManager.get(`SELECT 1`);
            const queryTime = Math.round(performance.now() - startTime);

            return {
                queryTime,
                status: queryTime < 100 ? 'excellent' : queryTime < 500 ? 'good' : 'slow'
            };
        } catch (error) {
            return {
                queryTime: -1,
                status: 'error',
                error: error.message
            };
        }
    }

    async getDatabaseFileInfo() {
        try {
            const fs = require('fs');
            const path = require('path');
            const dbPath = path.join(__dirname, '../../../data/game.db');

            if (fs.existsSync(dbPath)) {
                const stats = fs.statSync(dbPath);
                return {
                    size: Math.round(stats.size / 1024 / 1024 * 100) / 100, // MB
                    lastModified: stats.mtime.toISOString()
                };
            }
        } catch (error) {
            logger.error('데이터베이스 파일 정보 조회 실패:', error);
        }

        return { size: 'N/A', lastModified: 'N/A' };
    }

    // ================================
    // 시스템 헬스 체크
    // ================================

    async getSystemHealth() {
        const memoryUsage = process.memoryUsage();
        const systemMemory = {
            free: os.freemem(),
            total: os.totalmem()
        };

        const heapUsage = (memoryUsage.heapUsed / memoryUsage.heapTotal) * 100;
        const systemUsage = ((systemMemory.total - systemMemory.free) / systemMemory.total) * 100;

        return {
            status: this.calculateSystemStatus(heapUsage, systemUsage),
            memory: {
                heap: Math.round(heapUsage),
                system: Math.round(systemUsage)
            },
            uptime: process.uptime(),
            loadAverage: os.loadavg()[0] // 1분 평균
        };
    }

    async checkSystemAlerts() {
        const alerts = [];
        const systemHealth = await this.getSystemHealth();
        const playerStats = await this.getPlayerSummary();

        // 메모리 사용량 알림
        if (systemHealth.memory.heap > 80) {
            alerts.push({
                level: 'critical',
                type: 'memory',
                message: '힙 메모리 사용량이 위험 수준입니다',
                value: systemHealth.memory.heap,
                unit: '%'
            });
        } else if (systemHealth.memory.heap > 60) {
            alerts.push({
                level: 'warning',
                type: 'memory',
                message: '힙 메모리 사용량이 높습니다',
                value: systemHealth.memory.heap,
                unit: '%'
            });
        }

        // 플레이어 활동 알림
        if (playerStats.onlineRate < 20) {
            alerts.push({
                level: 'warning',
                type: 'players',
                message: '플레이어 활동률이 낮습니다',
                value: playerStats.onlineRate,
                unit: '%'
            });
        }

        // 시스템 로드 알림
        if (systemHealth.loadAverage > 2) {
            alerts.push({
                level: 'warning',
                type: 'system',
                message: '시스템 로드가 높습니다',
                value: Math.round(systemHealth.loadAverage * 100) / 100
            });
        }

        return alerts;
    }

    async generateAlerts(metrics) {
        return await this.checkSystemAlerts();
    }

    // ================================
    // 유틸리티 메서드들
    // ================================

    calculateSystemStatus(heapUsage, systemUsage) {
        if (heapUsage > 80 || systemUsage > 90) return 'critical';
        if (heapUsage > 60 || systemUsage > 75) return 'warning';
        return 'healthy';
    }

    formatUptime(seconds) {
        const days = Math.floor(seconds / 86400);
        const hours = Math.floor((seconds % 86400) / 3600);
        const minutes = Math.floor((seconds % 3600) / 60);

        if (days > 0) return `${days}일 ${hours}시간 ${minutes}분`;
        if (hours > 0) return `${hours}시간 ${minutes}분`;
        return `${minutes}분`;
    }

    async getAvgTradesPerDay() {
        const result = await DatabaseManager.get(`
            SELECT ROUND(COUNT(*) / 7.0, 1) as avg_per_day
            FROM trade_records
            WHERE created_at >= datetime('now', '-7 days')
        `);
        return result.avg_per_day || 0;
    }

    getTimeCondition(timeRange) {
        switch(timeRange) {
            case '1d': return "datetime('now', '-1 day')";
            case '7d': return "datetime('now', '-7 days')";
            case '30d': return "datetime('now', '-30 days')";
            case '1h': return "datetime('now', '-1 hour')";
            default: return "datetime('now', '-7 days')";
        }
    }

    // ================================
    // 캐시 관리
    // ================================

    getFromCache(key, customTimeout = null) {
        const cached = this.cache.get(key);
        if (!cached) return null;

        const timeout = customTimeout || this.cacheTimeout;
        if (Date.now() - cached.timestamp > timeout) {
            this.cache.delete(key);
            return null;
        }

        return cached.data;
    }

    setCache(key, data, customTimeout = null) {
        const timeout = customTimeout || this.cacheTimeout;
        this.cache.set(key, {
            data,
            timestamp: Date.now(),
            timeout
        });

        // 캐시 크기 제한 (최대 50개)
        if (this.cache.size > 50) {
            const firstKey = this.cache.keys().next().value;
            this.cache.delete(firstKey);
        }
    }

    clearCache(pattern = null) {
        if (pattern) {
            for (const key of this.cache.keys()) {
                if (key.includes(pattern)) {
                    this.cache.delete(key);
                }
            }
        } else {
            this.cache.clear();
        }
    }

    // ================================
    // 메트릭 저장 (향후 확장)
    // ================================

    async saveMetrics(metrics) {
        // 향후 메트릭 히스토리 저장 로직 추가
        // 현재는 MetricsCollector.js에서 처리
    }

    async getMetricsHistory(hours = 24) {
        // 향후 메트릭 히스토리 조회 로직 추가
        return [];
    }

    async cleanupOldMetrics(daysToKeep = 30) {
        // 향후 오래된 메트릭 정리 로직 추가
        return 0;
    }
}

module.exports = new EnhancedMetricsService();