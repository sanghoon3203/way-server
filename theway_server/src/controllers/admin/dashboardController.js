const path = require('path');
const fs = require('fs').promises;
const logger = require('../../config/logger');

class DashboardController {
    /**
     * 대시보드 메인 페이지 렌더링
     */
    async renderDashboard(req, res) {
        try {
            res.render('admin/dashboard', {
                title: '대시보드',
                currentPath: req.path
            });
        } catch (error) {
            logger.error('Dashboard render error:', error);
            res.status(500).render('admin/error', {
                title: '서버 오류',
                message: '대시보드를 불러오는 중 오류가 발생했습니다.',
                error: process.env.NODE_ENV === 'development' ? error : {}
            });
        }
    }

    /**
     * 대시보드 통계 데이터 API
     */
    async getStats(req, res) {
        try {
            const db = req.app.get('db');

            // 상인 통계
            const merchantStats = await this.getMerchantStats(db);

            // 퀘스트 통계
            const questStats = await this.getQuestStats(db);

            // 스킬 통계
            const skillStats = await this.getSkillStats(db);

            // 플레이어 통계
            const playerStats = await this.getPlayerStats(db);

            res.json({
                success: true,
                data: {
                    merchants: {
                        total: merchantStats.total,
                        growth: merchantStats.growth,
                        byType: merchantStats.byType
                    },
                    quests: {
                        active: questStats.active,
                        completed: questStats.completed,
                        total: questStats.total
                    },
                    skills: {
                        total: skillStats.total,
                        byCategory: skillStats.byCategory
                    },
                    players: {
                        total: playerStats.total,
                        active: playerStats.active,
                        online: playerStats.online
                    }
                }
            });
        } catch (error) {
            logger.error('Dashboard stats error:', error);
            res.status(500).json({
                success: false,
                message: '통계 데이터를 불러오는 중 오류가 발생했습니다.',
                error: process.env.NODE_ENV === 'development' ? error.message : undefined
            });
        }
    }

    /**
     * 카운트 정보 API (사이드바용)
     */
    async getCounts(req, res) {
        try {
            const db = req.app.get('db');

            const [merchants, quests, skills, players, media] = await Promise.all([
                this.getCount(db, 'merchants'),
                this.getCount(db, 'quests'),
                this.getCount(db, 'skills'),
                this.getCount(db, 'players'),
                this.getMediaCount()
            ]);

            res.json({
                success: true,
                data: {
                    merchants,
                    quests,
                    skills,
                    players,
                    media
                }
            });
        } catch (error) {
            logger.error('Dashboard counts error:', error);
            res.status(500).json({
                success: false,
                message: '카운트 정보를 불러오는 중 오류가 발생했습니다.'
            });
        }
    }

    /**
     * 활동 차트 데이터 API
     */
    async getActivityChart(req, res) {
        try {
            const { period = '7' } = req.query;
            const days = parseInt(period);

            if (![7, 30].includes(days)) {
                return res.status(400).json({
                    success: false,
                    message: '유효하지 않은 기간입니다. (7, 30일만 지원)'
                });
            }

            const db = req.app.get('db');
            const chartData = await this.getActivityChartData(db, days);

            res.json({
                success: true,
                data: chartData
            });
        } catch (error) {
            logger.error('Activity chart error:', error);
            res.status(500).json({
                success: false,
                message: '차트 데이터를 불러오는 중 오류가 발생했습니다.'
            });
        }
    }

    /**
     * 최근 활동 로그 API
     */
    async getActivityLog(req, res) {
        try {
            const { limit = 20 } = req.query;
            const db = req.app.get('db');

            const activities = await this.getRecentActivities(db, parseInt(limit));

            res.json({
                success: true,
                data: activities
            });
        } catch (error) {
            logger.error('Activity log error:', error);
            res.status(500).json({
                success: false,
                message: '활동 로그를 불러오는 중 오류가 발생했습니다.'
            });
        }
    }

    /**
     * 시스템 상태 API
     */
    async getSystemStatus(req, res) {
        try {
            const systemInfo = await this.getSystemInfo();

            res.json({
                success: true,
                data: systemInfo
            });
        } catch (error) {
            logger.error('System status error:', error);
            res.status(500).json({
                success: false,
                message: '시스템 상태를 불러오는 중 오류가 발생했습니다.'
            });
        }
    }

    // === Private Helper Methods ===

    /**
     * 상인 통계 계산
     */
    async getMerchantStats(db) {
        const totalQuery = `SELECT COUNT(*) as count FROM merchants`;
        const typeQuery = `
            SELECT type, COUNT(*) as count
            FROM merchants
            GROUP BY type
        `;
        const recentQuery = `
            SELECT COUNT(*) as count
            FROM merchants
            WHERE created_at >= datetime('now', '-7 days')
        `;

        const [total, byType, recent] = await Promise.all([
            db.get(totalQuery),
            db.all(typeQuery),
            db.get(recentQuery)
        ]);

        return {
            total: total.count,
            growth: recent.count,
            byType: byType.reduce((acc, item) => {
                acc[item.type] = item.count;
                return acc;
            }, {})
        };
    }

    /**
     * 퀘스트 통계 계산
     */
    async getQuestStats(db) {
        const totalQuery = `SELECT COUNT(*) as count FROM quests`;
        const activeQuery = `
            SELECT COUNT(*) as count
            FROM quests
            WHERE status = 'active'
        `;
        const completedQuery = `
            SELECT COUNT(*) as count
            FROM quests
            WHERE status = 'completed'
        `;

        const [total, active, completed] = await Promise.all([
            db.get(totalQuery),
            db.get(activeQuery),
            db.get(completedQuery)
        ]);

        return {
            total: total.count,
            active: active.count,
            completed: completed.count
        };
    }

    /**
     * 스킬 통계 계산
     */
    async getSkillStats(db) {
        const totalQuery = `SELECT COUNT(*) as count FROM skills`;
        const categoryQuery = `
            SELECT category, COUNT(*) as count
            FROM skills
            GROUP BY category
        `;

        const [total, byCategory] = await Promise.all([
            db.get(totalQuery),
            db.all(categoryQuery)
        ]);

        return {
            total: total.count,
            byCategory: byCategory.reduce((acc, item) => {
                acc[item.category] = item.count;
                return acc;
            }, {})
        };
    }

    /**
     * 플레이어 통계 계산
     */
    async getPlayerStats(db) {
        const totalQuery = `SELECT COUNT(*) as count FROM players`;
        const activeQuery = `
            SELECT COUNT(*) as count
            FROM players
            WHERE last_active >= datetime('now', '-1 day')
        `;
        const onlineQuery = `
            SELECT COUNT(*) as count
            FROM players
            WHERE last_active >= datetime('now', '-5 minutes')
        `;

        const [total, active, online] = await Promise.all([
            db.get(totalQuery),
            db.get(activeQuery),
            db.get(onlineQuery)
        ]);

        return {
            total: total.count,
            active: active.count,
            online: online.count
        };
    }

    /**
     * 테이블별 카운트 조회
     */
    async getCount(db, tableName) {
        try {
            const result = await db.get(`SELECT COUNT(*) as count FROM ${tableName}`);
            return result.count;
        } catch (error) {
            logger.warn(`Count query failed for table ${tableName}:`, error);
            return 0;
        }
    }

    /**
     * 미디어 파일 카운트 조회
     */
    async getMediaCount() {
        try {
            const mediaPath = path.join(__dirname, '../../../public/media');
            const files = await fs.readdir(mediaPath);
            return files.filter(file => !file.startsWith('.')).length;
        } catch (error) {
            logger.warn('Media count failed:', error);
            return 0;
        }
    }

    /**
     * 활동 차트 데이터 생성
     */
    async getActivityChartData(db, days) {
        const query = `
            SELECT
                DATE(created_at) as date,
                'merchant' as type,
                COUNT(*) as count
            FROM merchants
            WHERE created_at >= datetime('now', '-${days} days')
            GROUP BY DATE(created_at)

            UNION ALL

            SELECT
                DATE(created_at) as date,
                'quest' as type,
                COUNT(*) as count
            FROM quests
            WHERE created_at >= datetime('now', '-${days} days')
            GROUP BY DATE(created_at)

            UNION ALL

            SELECT
                DATE(created_at) as date,
                'skill' as type,
                COUNT(*) as count
            FROM skills
            WHERE created_at >= datetime('now', '-${days} days')
            GROUP BY DATE(created_at)

            ORDER BY date DESC
        `;

        const results = await db.all(query);

        // 날짜별로 데이터 정리
        const dateMap = {};
        const today = new Date();

        // 빈 날짜 배열 생성
        for (let i = 0; i < days; i++) {
            const date = new Date(today);
            date.setDate(date.getDate() - i);
            const dateStr = date.toISOString().split('T')[0];
            dateMap[dateStr] = { merchants: 0, quests: 0, skills: 0 };
        }

        // 실제 데이터로 채우기
        results.forEach(row => {
            if (dateMap[row.date]) {
                dateMap[row.date][`${row.type}s`] = row.count;
            }
        });

        // Chart.js 형식으로 변환
        const labels = Object.keys(dateMap).reverse();
        const datasets = [
            {
                label: '상인',
                data: labels.map(date => dateMap[date].merchants),
                borderColor: '#0d6efd',
                backgroundColor: '#0d6efd20'
            },
            {
                label: '퀘스트',
                data: labels.map(date => dateMap[date].quests),
                borderColor: '#ffc107',
                backgroundColor: '#ffc10720'
            },
            {
                label: '스킬',
                data: labels.map(date => dateMap[date].skills),
                borderColor: '#198754',
                backgroundColor: '#19875420'
            }
        ];

        return { labels, datasets };
    }

    /**
     * 최근 활동 로그 조회
     */
    async getRecentActivities(db, limit) {
        const query = `
            SELECT
                'merchant' as type,
                name as title,
                'created' as action,
                created_at as timestamp
            FROM merchants
            WHERE created_at >= datetime('now', '-7 days')

            UNION ALL

            SELECT
                'quest' as type,
                name as title,
                'created' as action,
                created_at as timestamp
            FROM quests
            WHERE created_at >= datetime('now', '-7 days')

            UNION ALL

            SELECT
                'skill' as type,
                name as title,
                'created' as action,
                created_at as timestamp
            FROM skills
            WHERE created_at >= datetime('now', '-7 days')

            ORDER BY timestamp DESC
            LIMIT ?
        `;

        const activities = await db.all(query, [limit]);

        return activities.map(activity => ({
            ...activity,
            timeAgo: this.getTimeAgo(activity.timestamp),
            icon: this.getActivityIcon(activity.type, activity.action),
            color: this.getActivityColor(activity.type, activity.action)
        }));
    }

    /**
     * 시스템 정보 조회
     */
    async getSystemInfo() {
        const process = require('process');

        return {
            uptime: Math.floor(process.uptime()),
            memory: {
                used: Math.round(process.memoryUsage().rss / 1024 / 1024),
                total: Math.round(require('os').totalmem() / 1024 / 1024)
            },
            cpu: {
                usage: Math.round(Math.random() * 100) // 실제 CPU 사용률 계산 로직 추가 필요
            },
            database: {
                status: 'connected'
            }
        };
    }

    /**
     * 시간 전 문자열 생성
     */
    getTimeAgo(timestamp) {
        const now = new Date();
        const past = new Date(timestamp);
        const diffMs = now - past;
        const diffMins = Math.floor(diffMs / 60000);
        const diffHours = Math.floor(diffMins / 60);
        const diffDays = Math.floor(diffHours / 24);

        if (diffMins < 1) return '방금 전';
        if (diffMins < 60) return `${diffMins}분 전`;
        if (diffHours < 24) return `${diffHours}시간 전`;
        return `${diffDays}일 전`;
    }

    /**
     * 활동 아이콘 반환
     */
    getActivityIcon(type, action) {
        const icons = {
            merchant: 'bi-shop',
            quest: 'bi-flag',
            skill: 'bi-lightning',
            player: 'bi-person'
        };
        return icons[type] || 'bi-circle';
    }

    /**
     * 활동 색상 반환
     */
    getActivityColor(type, action) {
        const colors = {
            merchant: 'primary',
            quest: 'warning',
            skill: 'success',
            player: 'info'
        };
        return colors[type] || 'secondary';
    }
}

module.exports = new DashboardController();