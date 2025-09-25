// 대시보드 차트 및 데이터 관리
class Dashboard {
    constructor() {
        this.activityChart = null;
        this.updateInterval = null;
        this.init();
    }

    async init() {
        // DOM 로드 완료 후 초기화
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', () => this.initialize());
        } else {
            this.initialize();
        }
    }

    async initialize() {
        try {
            // 초기 데이터 로드
            await Promise.all([
                this.loadDashboardStats(),
                this.loadActivityLog(),
                this.loadSystemStatus(),
                this.initializeChart()
            ]);

            // 이벤트 리스너 등록
            this.setupEventListeners();

            // 주기적 업데이트 시작
            this.startPeriodicUpdates();

            console.log('Dashboard initialized successfully');
        } catch (error) {
            console.error('Dashboard initialization failed:', error);
            this.showError('대시보드 초기화 중 오류가 발생했습니다.');
        }
    }

    /**
     * 대시보드 통계 데이터 로드
     */
    async loadDashboardStats() {
        try {
            const response = await fetch('/admin/api/dashboard/stats');
            const data = await response.json();

            if (data.success) {
                this.updateStatsCards(data.data);
            } else {
                throw new Error(data.message || 'Failed to load stats');
            }
        } catch (error) {
            console.error('Failed to load dashboard stats:', error);
            this.updateStatsCards({
                merchants: { total: '-', growth: '-' },
                quests: { active: '-', total: '-' },
                skills: { total: '-' },
                players: { active: '-', online: '-' }
            });
        }
    }

    /**
     * 통계 카드 업데이트
     */
    updateStatsCards(stats) {
        // 상인 통계
        this.updateElement('totalMerchants', stats.merchants?.total || '-');
        this.updateElement('merchantsGrowth', `+${stats.merchants?.growth || 0} 이번 주`);

        // 퀘스트 통계
        this.updateElement('activeQuests', stats.quests?.active || '-');
        this.updateElement('questsStatus', `총 ${stats.quests?.total || 0}개`);

        // 스킬 통계
        this.updateElement('totalSkills', stats.skills?.total || '-');
        this.updateElement('skillsCategory', `${Object.keys(stats.skills?.byCategory || {}).length || 0}개 카테고리`);

        // 플레이어 통계
        this.updateElement('activePlayers', stats.players?.active || '-');
        this.updateElement('playersOnline', `${stats.players?.online || 0}명 온라인`);
    }

    /**
     * 활동 로그 로드
     */
    async loadActivityLog() {
        try {
            const response = await fetch('/admin/api/dashboard/activity-log?limit=10');
            const data = await response.json();

            if (data.success) {
                this.updateActivityLog(data.data);
            } else {
                throw new Error(data.message || 'Failed to load activity log');
            }
        } catch (error) {
            console.error('Failed to load activity log:', error);
            this.showActivityLogError();
        }
    }

    /**
     * 활동 로그 UI 업데이트
     */
    updateActivityLog(activities) {
        const container = document.getElementById('activityLog');

        if (!activities || activities.length === 0) {
            container.innerHTML = `
                <div class="p-3 text-center text-muted">
                    <i class="bi bi-inbox"></i>
                    <div class="small">최근 활동이 없습니다.</div>
                </div>
            `;
            return;
        }

        const html = activities.map(activity => `
            <div class="activity-item p-3 border-bottom ${this.getActivityClass(activity)}">
                <div class="d-flex">
                    <div class="flex-shrink-0">
                        <i class="bi ${activity.icon} text-${activity.color}"></i>
                    </div>
                    <div class="flex-grow-1 ms-2">
                        <div class="small fw-medium">${this.formatActivityTitle(activity)}</div>
                        <div class="text-muted" style="font-size: 0.75rem;">${activity.timeAgo}</div>
                    </div>
                </div>
            </div>
        `).join('');

        container.innerHTML = html;
    }

    /**
     * 활동 로그 에러 표시
     */
    showActivityLogError() {
        const container = document.getElementById('activityLog');
        container.innerHTML = `
            <div class="p-3 text-center text-muted">
                <i class="bi bi-exclamation-triangle text-warning"></i>
                <div class="small">활동 로그를 불러올 수 없습니다.</div>
            </div>
        `;
    }

    /**
     * 시스템 상태 로드
     */
    async loadSystemStatus() {
        try {
            const response = await fetch('/admin/api/system/status');
            const data = await response.json();

            if (data.success) {
                this.updateSystemStatus(data.data);
            } else {
                throw new Error(data.message || 'Failed to load system status');
            }
        } catch (error) {
            console.error('Failed to load system status:', error);
            this.updateSystemStatus({
                cpu: { usage: 0 },
                memory: { used: 0, total: 0 },
                uptime: 0,
                database: { status: 'unknown' }
            });
        }
    }

    /**
     * 시스템 상태 UI 업데이트
     */
    updateSystemStatus(status) {
        // CPU 사용률
        const cpuUsage = status.cpu?.usage || 0;
        this.updateElement('cpuUsage', `${cpuUsage}%`);
        this.updateProgressBar('cpuProgress', cpuUsage);

        // 메모리 사용률
        const memoryUsed = status.memory?.used || 0;
        const memoryTotal = status.memory?.total || 1;
        const memoryPercent = Math.round((memoryUsed / memoryTotal) * 100);
        this.updateElement('memoryUsage', `${memoryPercent}%`);
        this.updateProgressBar('memoryProgress', memoryPercent);

        // 업타임
        this.updateElement('systemUptime', this.formatUptime(status.uptime || 0));

        // 데이터베이스 상태
        const dbStatus = status.database?.status || 'unknown';
        const dbElement = document.getElementById('dbStatus');
        if (dbElement) {
            dbElement.innerHTML = `<i class="bi bi-circle-fill"></i> ${this.formatDbStatus(dbStatus)}`;
            dbElement.className = `text-${this.getDbStatusColor(dbStatus)} small`;
        }
    }

    /**
     * Chart.js 차트 초기화
     */
    async initializeChart() {
        const ctx = document.getElementById('activityChart');
        if (!ctx) return;

        try {
            // Chart.js 라이브러리 로드 확인
            if (typeof Chart === 'undefined') {
                await this.loadChartJS();
            }

            // 차트 데이터 로드
            const chartData = await this.loadChartData(7);

            this.activityChart = new Chart(ctx, {
                type: 'line',
                data: chartData,
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: {
                        legend: {
                            position: 'top',
                        }
                    },
                    scales: {
                        y: {
                            beginAtZero: true,
                            ticks: {
                                stepSize: 1
                            }
                        }
                    },
                    elements: {
                        line: {
                            tension: 0.3
                        }
                    }
                }
            });
        } catch (error) {
            console.error('Chart initialization failed:', error);
            this.showChartError();
        }
    }

    /**
     * Chart.js 라이브러리 동적 로드
     */
    async loadChartJS() {
        return new Promise((resolve, reject) => {
            const script = document.createElement('script');
            script.src = 'https://cdn.jsdelivr.net/npm/chart.js';
            script.onload = resolve;
            script.onerror = reject;
            document.head.appendChild(script);
        });
    }

    /**
     * 차트 데이터 로드
     */
    async loadChartData(period) {
        try {
            const response = await fetch(`/admin/api/dashboard/activity-chart?period=${period}`);
            const data = await response.json();

            if (data.success) {
                return data.data;
            } else {
                throw new Error(data.message || 'Failed to load chart data');
            }
        } catch (error) {
            console.error('Failed to load chart data:', error);
            // 기본 빈 데이터 반환
            return {
                labels: [],
                datasets: []
            };
        }
    }

    /**
     * 이벤트 리스너 설정
     */
    setupEventListeners() {
        // 차트 기간 변경
        const chartPeriodRadios = document.querySelectorAll('input[name="chartPeriod"]');
        chartPeriodRadios.forEach(radio => {
            radio.addEventListener('change', async (e) => {
                if (e.target.checked) {
                    const period = e.target.id === 'chart7days' ? 7 : 30;
                    await this.updateChart(period);
                }
            });
        });

        // 새로고침 버튼 (필요시 추가)
        const refreshBtn = document.getElementById('refreshDashboard');
        if (refreshBtn) {
            refreshBtn.addEventListener('click', () => this.refreshAllData());
        }
    }

    /**
     * 차트 업데이트
     */
    async updateChart(period) {
        if (!this.activityChart) return;

        try {
            const chartData = await this.loadChartData(period);
            this.activityChart.data = chartData;
            this.activityChart.update();
        } catch (error) {
            console.error('Chart update failed:', error);
        }
    }

    /**
     * 주기적 업데이트 시작
     */
    startPeriodicUpdates() {
        // 30초마다 데이터 업데이트
        this.updateInterval = setInterval(async () => {
            try {
                await Promise.all([
                    this.loadDashboardStats(),
                    this.loadActivityLog(),
                    this.loadSystemStatus()
                ]);
            } catch (error) {
                console.error('Periodic update failed:', error);
            }
        }, 30000);
    }

    /**
     * 전체 데이터 새로고침
     */
    async refreshAllData() {
        try {
            await Promise.all([
                this.loadDashboardStats(),
                this.loadActivityLog(),
                this.loadSystemStatus(),
                this.updateChart(7)
            ]);

            this.showSuccess('데이터가 새로고침되었습니다.');
        } catch (error) {
            console.error('Data refresh failed:', error);
            this.showError('데이터 새로고침 중 오류가 발생했습니다.');
        }
    }

    // === 유틸리티 메소드 ===

    updateElement(id, value) {
        const element = document.getElementById(id);
        if (element) {
            element.textContent = value;
        }
    }

    updateProgressBar(id, percent) {
        const element = document.getElementById(id);
        if (element) {
            element.style.width = `${Math.min(percent, 100)}%`;
        }
    }

    getActivityClass(activity) {
        const now = new Date();
        const activityTime = new Date(activity.timestamp);
        const diffHours = (now - activityTime) / (1000 * 60 * 60);

        if (diffHours < 1) return 'new';
        if (activity.action === 'error') return 'error';
        if (activity.action === 'warning') return 'warning';
        return '';
    }

    formatActivityTitle(activity) {
        const actions = {
            created: '생성됨',
            updated: '수정됨',
            deleted: '삭제됨'
        };
        return `${activity.title} (${actions[activity.action] || activity.action})`;
    }

    formatUptime(seconds) {
        const hours = Math.floor(seconds / 3600);
        const minutes = Math.floor((seconds % 3600) / 60);
        return `${hours}시간 ${minutes}분`;
    }

    formatDbStatus(status) {
        const statuses = {
            connected: '연결됨',
            disconnected: '연결 끊김',
            unknown: '알 수 없음'
        };
        return statuses[status] || status;
    }

    getDbStatusColor(status) {
        const colors = {
            connected: 'success',
            disconnected: 'danger',
            unknown: 'warning'
        };
        return colors[status] || 'secondary';
    }

    showSuccess(message) {
        if (window.showToast) {
            window.showToast(message, 'success');
        }
    }

    showError(message) {
        if (window.showToast) {
            window.showToast(message, 'error');
        }
    }

    showChartError() {
        const chartContainer = document.querySelector('.chart-container');
        if (chartContainer) {
            chartContainer.innerHTML = `
                <div class="d-flex align-items-center justify-content-center h-100">
                    <div class="text-center text-muted">
                        <i class="bi bi-exclamation-triangle fs-3"></i>
                        <div class="mt-2">차트를 불러올 수 없습니다.</div>
                    </div>
                </div>
            `;
        }
    }

    /**
     * 컴포넌트 정리
     */
    destroy() {
        if (this.updateInterval) {
            clearInterval(this.updateInterval);
            this.updateInterval = null;
        }

        if (this.activityChart) {
            this.activityChart.destroy();
            this.activityChart = null;
        }
    }
}

// 전역 대시보드 인스턴스
let dashboardInstance;

// 페이지 로드 시 대시보드 초기화
document.addEventListener('DOMContentLoaded', function() {
    dashboardInstance = new Dashboard();
});

// 페이지 언로드 시 정리
window.addEventListener('beforeunload', function() {
    if (dashboardInstance) {
        dashboardInstance.destroy();
    }
});