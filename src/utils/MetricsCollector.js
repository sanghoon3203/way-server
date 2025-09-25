// 📁 src/utils/MetricsCollector.js - 실시간 메트릭 수집 시스템
const DatabaseManager = require('../database/DatabaseManager');
const logger = require('../config/logger');

class MetricsCollector {
    constructor() {
        this.isCollecting = false;
        this.collectionInterval = null;
        this.metricsQueue = [];
        this.batchSize = 100;
        this.flushInterval = 30000; // 30초마다 플러시
    }

    /**
     * 메트릭 수집 시작
     */
    start() {
        if (this.isCollecting) {
            logger.warn('메트릭 수집이 이미 실행 중입니다');
            return;
        }

        this.isCollecting = true;
        
        // 실시간 서버 메트릭 수집 (5분마다)
        this.collectionInterval = setInterval(() => {
            this.collectServerMetrics();
        }, 5 * 60 * 1000);

        // 메트릭 큐 플러시 (30초마다)
        this.flushInterval = setInterval(() => {
            this.flushMetricsQueue();
        }, 30000);

        logger.info('실시간 메트릭 수집 시작됨');
    }

    /**
     * 메트릭 수집 중지
     */
    stop() {
        if (!this.isCollecting) return;

        if (this.collectionInterval) {
            clearInterval(this.collectionInterval);
            this.collectionInterval = null;
        }

        if (this.flushInterval) {
            clearInterval(this.flushInterval);
            this.flushInterval = null;
        }

        // 남은 메트릭 처리
        this.flushMetricsQueue();

        this.isCollecting = false;
        logger.info('실시간 메트릭 수집 중지됨');
    }

    /**
     * 서버 메트릭 수집
     */
    async collectServerMetrics() {
        try {
            const metrics = {
                timestamp: new Date().toISOString(),
                server: await this.getServerMetrics(),
                players: await this.getPlayerMetrics(),
                economy: await this.getEconomyMetrics(),
                activities: await this.getActivityMetrics()
            };

            await this.saveServerMetrics(metrics);
            logger.debug('서버 메트릭 수집 완료', { timestamp: metrics.timestamp });

        } catch (error) {
            logger.error('서버 메트릭 수집 실패:', error);
        }
    }

    /**
     * 서버 상태 메트릭 수집
     */
    async getServerMetrics() {
        const process = require('process');
        const os = require('os');

        return {
            uptime: process.uptime(),
            memoryUsage: process.memoryUsage(),
            cpuUsage: process.cpuUsage(),
            systemLoad: os.loadavg(),
            freeMemory: os.freemem(),
            totalMemory: os.totalmem()
        };
    }

    /**
     * 플레이어 메트릭 수집
     */
    async getPlayerMetrics() {
        try {
            // 현재 온라인 플레이어 수 (최근 5분 이내 활동)
            const activeUsers = await DatabaseManager.get(`
                SELECT COUNT(*) as count FROM players 
                WHERE last_active >= datetime('now', '-5 minutes')
            `);

            // 전체 등록 플레이어 수
            const totalUsers = await DatabaseManager.get(`
                SELECT COUNT(*) as count FROM players
            `);

            // 레벨별 분포
            const levelDistribution = await DatabaseManager.all(`
                SELECT 
                    CASE 
                        WHEN level <= 5 THEN '1-5'
                        WHEN level <= 10 THEN '6-10'
                        WHEN level <= 20 THEN '11-20'
                        ELSE '20+'
                    END as level_range,
                    COUNT(*) as count
                FROM players 
                GROUP BY level_range
            `);

            // 신규 가입자 (최근 24시간)
            const newSignups = await DatabaseManager.get(`
                SELECT COUNT(*) as count FROM players 
                WHERE created_at >= datetime('now', '-1 day')
            `);

            return {
                activeUsers: activeUsers.count,
                totalUsers: totalUsers.count,
                newSignups24h: newSignups.count,
                levelDistribution
            };

        } catch (error) {
            logger.error('플레이어 메트릭 수집 실패:', error);
            return {};
        }
    }

    /**
     * 경제 메트릭 수집
     */
    async getEconomyMetrics() {
        try {
            // 최근 24시간 거래량
            const dailyTrades = await DatabaseManager.get(`
                SELECT 
                    COUNT(*) as trade_count,
                    SUM(total_price) as total_volume
                FROM trade_records 
                WHERE created_at >= datetime('now', '-1 day')
            `);

            // 아이템별 거래 현황
            const itemTradeStats = await DatabaseManager.all(`
                SELECT 
                    it.name,
                    it.category,
                    COUNT(tr.id) as trade_count,
                    AVG(tr.total_price) as avg_price
                FROM trade_records tr
                JOIN item_templates it ON tr.item_template_id = it.id
                WHERE tr.created_at >= datetime('now', '-7 days')
                GROUP BY it.id
                ORDER BY trade_count DESC
                LIMIT 10
            `);

            // 평균 플레이어 자산
            const playerWealth = await DatabaseManager.get(`
                SELECT 
                    AVG(money) as avg_money,
                    MIN(money) as min_money,
                    MAX(money) as max_money
                FROM players
            `);

            return {
                dailyTrades: dailyTrades.trade_count || 0,
                dailyVolume: dailyTrades.total_volume || 0,
                topTradedItems: itemTradeStats,
                avgPlayerMoney: playerWealth.avg_money || 0,
                wealthRange: {
                    min: playerWealth.min_money || 0,
                    max: playerWealth.max_money || 0
                }
            };

        } catch (error) {
            logger.error('경제 메트릭 수집 실패:', error);
            return {};
        }
    }

    /**
     * 활동 메트릭 수집
     */
    async getActivityMetrics() {
        try {
            // 퀘스트 활동
            const questStats = await DatabaseManager.get(`
                SELECT 
                    COUNT(CASE WHEN status = 'active' THEN 1 END) as active_quests,
                    COUNT(CASE WHEN status = 'completed' AND completed_at >= datetime('now', '-1 day') THEN 1 END) as completed_today
                FROM player_quests
            `);

            // 스킬 사용 통계
            const skillUsage = await DatabaseManager.get(`
                SELECT COUNT(*) as skill_uses
                FROM skill_usage_logs 
                WHERE used_at >= datetime('now', '-1 day')
            `);

            // 플레이어 세션 통계
            const sessionStats = await DatabaseManager.get(`
                SELECT 
                    COUNT(*) as total_sessions,
                    AVG(julianday(ended_at) - julianday(started_at)) * 24 * 60 as avg_duration_minutes
                FROM player_sessions 
                WHERE started_at >= datetime('now', '-1 day') AND ended_at IS NOT NULL
            `);

            return {
                activeQuests: questStats.active_quests || 0,
                questsCompletedToday: questStats.completed_today || 0,
                skillUsesToday: skillUsage.skill_uses || 0,
                sessionsToday: sessionStats.total_sessions || 0,
                avgSessionDuration: sessionStats.avg_duration_minutes || 0
            };

        } catch (error) {
            logger.error('활동 메트릭 수집 실패:', error);
            return {};
        }
    }

    /**
     * 서버 메트릭 저장
     */
    async saveServerMetrics(metrics) {
        try {
            const { randomUUID } = require('crypto');

            // 각 메트릭을 개별 레코드로 저장 (스키마에 맞게)
            const metricsToSave = [
                { name: 'active_players', value: metrics.players.activeUsers || 0, unit: 'count' },
                { name: 'total_players', value: metrics.players.totalUsers || 0, unit: 'count' },
                { name: 'new_players_24h', value: metrics.players.newSignups24h || 0, unit: 'count' },
                { name: 'daily_trades', value: metrics.economy.dailyTrades || 0, unit: 'count' },
                { name: 'daily_volume', value: metrics.economy.dailyVolume || 0, unit: 'currency' },
                { name: 'avg_player_money', value: metrics.economy.avgPlayerMoney || 0, unit: 'currency' },
                { name: 'active_quests', value: metrics.activities.activeQuests || 0, unit: 'count' },
                { name: 'completed_quests_24h', value: metrics.activities.questsCompletedToday || 0, unit: 'count' },
                { name: 'skill_uses_24h', value: metrics.activities.skillUsesToday || 0, unit: 'count' },
                { name: 'sessions_24h', value: metrics.activities.sessionsToday || 0, unit: 'count' },
                { name: 'avg_session_duration', value: metrics.activities.avgSessionDuration || 0, unit: 'minutes' },
                { name: 'memory_usage', value: metrics.server.memoryUsage.heapUsed || 0, unit: 'bytes' },
                { name: 'cpu_usage', value: metrics.server.cpuUsage.user + metrics.server.cpuUsage.system || 0, unit: 'microseconds' },
                { name: 'uptime', value: metrics.server.uptime || 0, unit: 'seconds' }
            ];

            // 각 메트릭을 개별 레코드로 삽입
            for (const metric of metricsToSave) {
                await DatabaseManager.run(`
                    INSERT INTO server_metrics (id, metric_name, metric_value, metric_unit)
                    VALUES (?, ?, ?, ?)
                `, [
                    randomUUID(),
                    metric.name,
                    metric.value,
                    metric.unit
                ]);
            }

            logger.debug(`${metricsToSave.length}개 서버 메트릭 저장 완료`);

        } catch (error) {
            logger.error('서버 메트릭 저장 실패:', error);
        }
    }

    /**
     * 이벤트 메트릭 기록
     */
    recordEvent(eventType, eventData, playerId = null) {
        const metric = {
            timestamp: new Date().toISOString(),
            eventType,
            eventData,
            playerId
        };

        this.metricsQueue.push(metric);

        // 큐가 배치 크기에 도달하면 즉시 플러시
        if (this.metricsQueue.length >= this.batchSize) {
            this.flushMetricsQueue();
        }
    }

    /**
     * 메트릭 큐 플러시
     */
    async flushMetricsQueue() {
        if (this.metricsQueue.length === 0) return;

        const metricsToFlush = [...this.metricsQueue];
        this.metricsQueue = [];

        try {
            for (const metric of metricsToFlush) {
                await DatabaseManager.run(`
                    INSERT INTO activity_logs (
                        id, player_id, event_type, event_data, created_at
                    ) VALUES (?, ?, ?, ?, ?)
                `, [
                    require('crypto').randomUUID(),
                    metric.playerId,
                    metric.eventType,
                    JSON.stringify(metric.eventData),
                    metric.timestamp
                ]);
            }

            logger.debug(`${metricsToFlush.length}개 이벤트 메트릭 저장 완료`);

        } catch (error) {
            logger.error('메트릭 큐 플러시 실패:', error);
            // 실패한 메트릭들을 다시 큐에 추가
            this.metricsQueue.unshift(...metricsToFlush);
        }
    }

    /**
     * 거래 이벤트 기록
     */
    recordTradeEvent(playerId, tradeData) {
        this.recordEvent('trade', {
            merchantId: tradeData.merchantId,
            itemId: tradeData.itemId,
            quantity: tradeData.quantity,
            totalPrice: tradeData.totalPrice,
            profit: tradeData.profit,
            success: tradeData.success
        }, playerId);
    }

    /**
     * 퀘스트 이벤트 기록
     */
    recordQuestEvent(playerId, questData) {
        this.recordEvent('quest', {
            questId: questData.questId,
            action: questData.action, // accept, complete, abandon
            rewards: questData.rewards
        }, playerId);
    }

    /**
     * 스킬 이벤트 기록
     */
    recordSkillEvent(playerId, skillData) {
        this.recordEvent('skill', {
            skillId: skillData.skillId,
            action: skillData.action, // learn, upgrade, use
            level: skillData.level,
            pointsUsed: skillData.pointsUsed
        }, playerId);
    }

    /**
     * 세션 이벤트 기록
     */
    recordSessionEvent(playerId, sessionData) {
        this.recordEvent('session', {
            action: sessionData.action, // start, end
            duration: sessionData.duration,
            platform: sessionData.platform
        }, playerId);
    }
}

// 싱글톤 인스턴스
const metricsCollector = new MetricsCollector();

module.exports = metricsCollector;