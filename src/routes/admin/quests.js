// 📁 src/routes/admin/quests.js - 퀘스트 관리 라우트
const express = require('express');
const QuestService = require('../../services/admin/QuestService');
const { AdminAuth } = require('../../middleware/adminAuth');
const logger = require('../../config/logger');

const router = express.Router();

// 개발 환경에서는 인증 우회, API 경로만 인증 필요
// router.use(AdminAuth.authenticateToken);

/**
 * 퀘스트 관리 대시보드
 * GET /admin/quests
 */
router.get('/', async (req, res) => {
    try {
        const [statistics, recentQuests, activeQuests] = await Promise.all([
            QuestService.getQuestStatistics(),
            QuestService.getRecentQuestActivity(),
            QuestService.getActiveQuests()
        ]);

        const dashboardHTML = generateQuestDashboard(statistics, recentQuests, activeQuests);

        res.send(`
            <!DOCTYPE html>
            <html>
            <head>
                <title>퀘스트 관리 - Way Game Admin</title>
                <meta charset="utf-8">
                <meta name="viewport" content="width=device-width, initial-scale=1">
                <style>
                    body { font-family: Arial, sans-serif; margin: 0; background-color: #f8f9fa; }
                    .container { max-width: 1400px; margin: 0 auto; padding: 20px; }
                    .navbar { background-color: #28a745; color: white; padding: 1rem 0; margin-bottom: 2rem; }
                    .navbar .container { display: flex; justify-content: space-between; align-items: center; padding: 0 20px; }
                    .navbar a { color: white; text-decoration: none; margin-left: 20px; }
                    .navbar a:hover { text-decoration: underline; }
                    
                    .dashboard-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(300px, 1fr)); gap: 20px; margin-bottom: 30px; }
                    .stat-card { background: white; border-radius: 8px; padding: 20px; box-shadow: 0 2px 10px rgba(0,0,0,0.1); }
                    .stat-value { font-size: 36px; font-weight: bold; color: #28a745; }
                    .stat-label { color: #666; margin-top: 5px; }
                    
                    .action-buttons { display: flex; gap: 10px; margin-bottom: 30px; }
                    .btn { padding: 12px 24px; text-decoration: none; border: none; border-radius: 6px; cursor: pointer; font-weight: bold; }
                    .btn-primary { background-color: #007bff; color: white; }
                    .btn-success { background-color: #28a745; color: white; }
                    .btn-warning { background-color: #ffc107; color: #212529; }
                    .btn:hover { opacity: 0.9; }
                    
                    .content-section { background: white; border-radius: 8px; padding: 20px; margin-bottom: 20px; box-shadow: 0 2px 10px rgba(0,0,0,0.1); }
                    .section-title { font-size: 20px; font-weight: bold; margin-bottom: 15px; color: #333; }
                    
                    .table { width: 100%; border-collapse: collapse; margin-top: 10px; }
                    .table th, .table td { padding: 12px; text-align: left; border-bottom: 1px solid #eee; }
                    .table th { background-color: #f8f9fa; font-weight: bold; }
                    .table tr:hover { background-color: #f5f5f5; }
                    
                    .status-badge { padding: 4px 8px; border-radius: 12px; font-size: 12px; font-weight: bold; }
                    .status-active { background-color: #d4edda; color: #155724; }
                    .status-inactive { background-color: #f8d7da; color: #721c24; }
                    .status-draft { background-color: #fff3cd; color: #856404; }
                    
                    .category-badge { padding: 2px 6px; border-radius: 4px; font-size: 11px; font-weight: bold; }
                    .cat-main_story { background-color: #e3f2fd; color: #1565c0; }
                    .cat-side_quest { background-color: #f3e5f5; color: #7b1fa2; }
                    .cat-daily { background-color: #fff3e0; color: #ef6c00; }
                    .cat-weekly { background-color: #e8f5e8; color: #2e7d32; }
                    .cat-achievement { background-color: #fff8e1; color: #f57f17; }
                </style>
            </head>
            <body>
                <nav class="navbar">
                    <div class="container">
                        <div>
                            <a href="/admin"><strong>Way Game Admin</strong></a>
                            <span> / 퀘스트 관리</span>
                        </div>
                        <div>
                            <a href="/admin">대시보드</a>
                            <a href="/admin/crud/players">플레이어</a>
                            <a href="/admin/crud/merchants">상인</a>
                            <a href="/admin/monitoring">모니터링</a>
                        </div>
                    </div>
                </nav>
                
                <div class="container">
                    <h1>🎯 퀘스트 관리 시스템</h1>
                    
                    <div class="action-buttons">
                        <a href="/admin/quests/create" class="btn btn-primary">새 퀘스트 생성</a>
                        <a href="/admin/quests/templates" class="btn btn-success">퀘스트 템플릿</a>
                        <a href="/admin/quests/statistics" class="btn btn-warning">통계 분석</a>
                    </div>
                    
                    ${dashboardHTML}
                </div>
                
                <script>
                    // 퀘스트 활성화/비활성화
                    async function toggleQuest(questId, isActive) {
                        try {
                            const response = await fetch('/admin/quests/api/toggle', {
                                method: 'POST',
                                headers: {
                                    'Content-Type': 'application/json',
                                    'Authorization': 'Bearer ' + localStorage.getItem('adminToken')
                                },
                                body: JSON.stringify({ questId, isActive: !isActive })
                            });
                            
                            const result = await response.json();
                            if (result.success) {
                                location.reload();
                            } else {
                                alert('변경 실패: ' + result.error);
                            }
                        } catch (error) {
                            alert('요청 실패: ' + error.message);
                        }
                    }
                    
                    // 자동 새로고침 (30초마다)
                    setTimeout(() => {
                        window.location.reload();
                    }, 30000);
                </script>
            </body>
            </html>
        `);

    } catch (error) {
        logger.error('퀘스트 대시보드 로드 실패:', error);
        res.status(500).send(`<h1>오류</h1><p>${error.message}</p>`);
    }
});

/**
 * 퀘스트 생성 페이지
 * GET /admin/quests/create
 */
router.get('/create', AdminAuth.requirePermission('quest.create'), (req, res) => {
    const formHTML = generateQuestForm();
    
    res.send(`
        <!DOCTYPE html>
        <html>
        <head>
            <title>새 퀘스트 생성 - Way Game Admin</title>
            <meta charset="utf-8">
            <meta name="viewport" content="width=device-width, initial-scale=1">
            <style>
                body { font-family: Arial, sans-serif; margin: 20px; background-color: #f8f9fa; }
                .form-container { max-width: 800px; margin: 0 auto; background: white; padding: 30px; border-radius: 8px; box-shadow: 0 2px 10px rgba(0,0,0,0.1); }
                .form-group { margin-bottom: 20px; }
                .form-label { display: block; font-weight: bold; margin-bottom: 5px; color: #333; }
                .form-input { width: 100%; padding: 10px; border: 1px solid #ddd; border-radius: 4px; font-size: 14px; }
                .form-select { width: 100%; padding: 10px; border: 1px solid #ddd; border-radius: 4px; }
                .form-textarea { width: 100%; padding: 10px; border: 1px solid #ddd; border-radius: 4px; min-height: 100px; }
                .btn { padding: 12px 24px; border: none; border-radius: 6px; cursor: pointer; font-weight: bold; }
                .btn-primary { background-color: #007bff; color: white; }
                .btn-secondary { background-color: #6c757d; color: white; margin-left: 10px; }
                .btn:hover { opacity: 0.9; }
                .objectives-container { border: 1px solid #ddd; border-radius: 4px; padding: 15px; }
                .objective-item { background: #f8f9fa; padding: 10px; margin-bottom: 10px; border-radius: 4px; border-left: 4px solid #007bff; }
                .add-objective { background-color: #28a745; color: white; border: none; padding: 8px 16px; border-radius: 4px; cursor: pointer; }
            </style>
        </head>
        <body>
            <div class="form-container">
                <h1>🎯 새 퀘스트 생성</h1>
                <a href="/admin/quests" style="color: #007bff; text-decoration: none;">← 퀘스트 관리로 돌아가기</a>
                
                ${formHTML}
            </div>
        </body>
        </html>
    `);
});

/**
 * 퀘스트 템플릿 목록
 * GET /admin/quests/templates
 */
router.get('/templates', async (req, res) => {
    try {
        const { category, type, status } = req.query;
        const templates = await QuestService.getQuestTemplates({
            category,
            type,
            status: status || 'active'
        });

        const templatesHTML = generateTemplateList(templates);

        res.send(`
            <!DOCTYPE html>
            <html>
            <head>
                <title>퀘스트 템플릿 - Way Game Admin</title>
                <meta charset="utf-8">
                <meta name="viewport" content="width=device-width, initial-scale=1">
                <style>
                    body { font-family: Arial, sans-serif; margin: 20px; background-color: #f8f9fa; }
                    .container { max-width: 1200px; margin: 0 auto; }
                    .filters { background: white; padding: 20px; border-radius: 8px; margin-bottom: 20px; box-shadow: 0 2px 10px rgba(0,0,0,0.1); }
                    .filter-group { display: inline-block; margin-right: 20px; }
                    .table { width: 100%; border-collapse: collapse; background: white; border-radius: 8px; overflow: hidden; box-shadow: 0 2px 10px rgba(0,0,0,0.1); }
                    .table th, .table td { padding: 12px; text-align: left; border-bottom: 1px solid #eee; }
                    .table th { background-color: #f8f9fa; font-weight: bold; }
                    .status-badge, .category-badge { padding: 4px 8px; border-radius: 12px; font-size: 12px; font-weight: bold; }
                    .status-active { background-color: #d4edda; color: #155724; }
                    .status-inactive { background-color: #f8d7da; color: #721c24; }
                    .cat-main_story { background-color: #e3f2fd; color: #1565c0; }
                    .cat-daily { background-color: #fff3e0; color: #ef6c00; }
                    .btn { padding: 6px 12px; text-decoration: none; border-radius: 4px; font-size: 12px; }
                    .btn-info { background-color: #17a2b8; color: white; }
                    .btn-warning { background-color: #ffc107; color: #212529; }
                    .btn-danger { background-color: #dc3545; color: white; }
                </style>
            </head>
            <body>
                <div class="container">
                    <h1>📋 퀘스트 템플릿 관리</h1>
                    <a href="/admin/quests" style="color: #007bff; text-decoration: none;">← 퀘스트 관리로 돌아가기</a>
                    
                    ${templatesHTML}
                </div>
            </body>
            </html>
        `);

    } catch (error) {
        logger.error('퀘스트 템플릿 목록 조회 실패:', error);
        res.status(500).send(`<h1>오류</h1><p>${error.message}</p>`);
    }
});

/**
 * 퀘스트 통계 페이지
 * GET /admin/quests/statistics
 */
router.get('/statistics', async (req, res) => {
    try {
        const statistics = await QuestService.getQuestStatistics();
        const categoryStats = await QuestService.getCategoryStatistics();
        const completionStats = await QuestService.getCompletionStatistics();

        const statisticsHTML = generateStatisticsPage(statistics, categoryStats, completionStats);

        res.send(`
            <!DOCTYPE html>
            <html>
            <head>
                <title>퀘스트 통계 - Way Game Admin</title>
                <meta charset="utf-8">
                <meta name="viewport" content="width=device-width, initial-scale=1">
                <style>
                    body { font-family: Arial, sans-serif; margin: 20px; background-color: #f8f9fa; }
                    .container { max-width: 1400px; margin: 0 auto; }
                    .stats-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(250px, 1fr)); gap: 20px; margin-bottom: 30px; }
                    .stat-card { background: white; border-radius: 8px; padding: 20px; box-shadow: 0 2px 10px rgba(0,0,0,0.1); }
                    .stat-value { font-size: 32px; font-weight: bold; color: #28a745; }
                    .chart-container { background: white; border-radius: 8px; padding: 20px; margin-bottom: 20px; box-shadow: 0 2px 10px rgba(0,0,0,0.1); }
                    .chart-title { font-size: 18px; font-weight: bold; margin-bottom: 15px; }
                    .progress-bar { width: 100%; height: 20px; background-color: #e9ecef; border-radius: 10px; overflow: hidden; margin: 5px 0; }
                    .progress-fill { height: 100%; transition: width 0.3s ease; }
                    .progress-success { background-color: #28a745; }
                    .progress-warning { background-color: #ffc107; }
                    .progress-info { background-color: #17a2b8; }
                </style>
            </head>
            <body>
                <div class="container">
                    <h1>📊 퀘스트 통계 분석</h1>
                    <a href="/admin/quests" style="color: #007bff; text-decoration: none;">← 퀘스트 관리로 돌아가기</a>
                    
                    ${statisticsHTML}
                </div>
            </body>
            </html>
        `);

    } catch (error) {
        logger.error('퀘스트 통계 조회 실패:', error);
        res.status(500).send(`<h1>오류</h1><p>${error.message}</p>`);
    }
});

/**
 * API: 퀘스트 생성
 * POST /admin/quests/api/create
 */
router.post('/api/create', AdminAuth.requirePermission('quest.create'), async (req, res) => {
    try {
        const questData = req.body;
        const result = await QuestService.createQuestTemplate(questData, req.admin.adminId);

        res.json({
            success: true,
            data: result,
            message: '퀘스트가 성공적으로 생성되었습니다'
        });

    } catch (error) {
        logger.error('퀘스트 생성 실패:', { error: error.message, data: req.body });
        res.status(400).json({
            success: false,
            error: error.message
        });
    }
});

/**
 * API: 퀘스트 활성화/비활성화 토글
 * POST /admin/quests/api/toggle
 */
router.post('/api/toggle', AdminAuth.requirePermission('quest.update'), async (req, res) => {
    try {
        const { questId, isActive } = req.body;
        
        const result = await QuestService.updateQuestTemplate(questId, {
            is_active: isActive
        }, req.admin.adminId);

        res.json({
            success: true,
            data: result,
            message: `퀘스트가 ${isActive ? '활성화' : '비활성화'}되었습니다`
        });

    } catch (error) {
        logger.error('퀘스트 상태 변경 실패:', { error: error.message, body: req.body });
        res.status(400).json({
            success: false,
            error: error.message
        });
    }
});

/**
 * API: 플레이어에게 퀘스트 할당
 * POST /admin/quests/api/assign
 */
router.post('/api/assign', AdminAuth.requirePermission('quest.assign'), async (req, res) => {
    try {
        const { questId, playerId } = req.body;
        
        const result = await QuestService.assignQuestToPlayer(playerId, questId, req.admin.adminId);

        res.json({
            success: true,
            data: result,
            message: '퀘스트가 플레이어에게 할당되었습니다'
        });

    } catch (error) {
        logger.error('퀘스트 할당 실패:', { error: error.message, body: req.body });
        res.status(400).json({
            success: false,
            error: error.message
        });
    }
});

// 퀘스트 대시보드 HTML 생성
function generateQuestDashboard(statistics, recentQuests, activeQuests) {
    return `
        <!-- 통계 카드들 -->
        <div class="dashboard-grid">
            <div class="stat-card">
                <div class="stat-value">${statistics.totalQuests || 0}</div>
                <div class="stat-label">전체 퀘스트</div>
            </div>
            <div class="stat-card">
                <div class="stat-value">${statistics.activeQuests || 0}</div>
                <div class="stat-label">활성 퀘스트</div>
            </div>
            <div class="stat-card">
                <div class="stat-value">${statistics.completedToday || 0}</div>
                <div class="stat-label">오늘 완료된 퀘스트</div>
            </div>
            <div class="stat-card">
                <div class="stat-value">${statistics.averageCompletionRate || 0}%</div>
                <div class="stat-label">평균 완료율</div>
            </div>
        </div>
        
        <!-- 활성 퀘스트 목록 -->
        <div class="content-section">
            <div class="section-title">🎯 활성 퀘스트</div>
            <table class="table">
                <thead>
                    <tr>
                        <th>퀘스트명</th>
                        <th>카테고리</th>
                        <th>타입</th>
                        <th>진행중</th>
                        <th>완료율</th>
                        <th>상태</th>
                        <th>작업</th>
                    </tr>
                </thead>
                <tbody>
                    ${activeQuests.map(quest => `
                        <tr>
                            <td><strong>${quest.title}</strong></td>
                            <td><span class="category-badge cat-${quest.category}">${getCategoryName(quest.category)}</span></td>
                            <td>${getTypeName(quest.type)}</td>
                            <td>${quest.inProgress || 0}</td>
                            <td>${Math.round((quest.completed / (quest.assigned || 1)) * 100)}%</td>
                            <td><span class="status-badge status-${quest.is_active ? 'active' : 'inactive'}">${quest.is_active ? '활성' : '비활성'}</span></td>
                            <td>
                                <button onclick="toggleQuest('${quest.id}', ${quest.is_active})" class="btn btn-warning">
                                    ${quest.is_active ? '비활성화' : '활성화'}
                                </button>
                            </td>
                        </tr>
                    `).join('')}
                </tbody>
            </table>
        </div>
        
        <!-- 최근 활동 -->
        <div class="content-section">
            <div class="section-title">📈 최근 퀘스트 활동</div>
            <table class="table">
                <thead>
                    <tr>
                        <th>시간</th>
                        <th>활동</th>
                        <th>퀘스트</th>
                        <th>플레이어</th>
                        <th>상태</th>
                    </tr>
                </thead>
                <tbody>
                    ${recentQuests.map(activity => `
                        <tr>
                            <td>${new Date(activity.created_at).toLocaleString()}</td>
                            <td>${getActivityName(activity.activity_type)}</td>
                            <td>${activity.quest_title}</td>
                            <td>${activity.player_name}</td>
                            <td><span class="status-badge status-${activity.status}">${getStatusName(activity.status)}</span></td>
                        </tr>
                    `).join('')}
                </tbody>
            </table>
        </div>
    `;
}

// 퀘스트 생성 폼 HTML 생성
function generateQuestForm() {
    return `
        <form id="questForm" onsubmit="submitQuest(event)">
            <div class="form-group">
                <label class="form-label">퀘스트명 *</label>
                <input type="text" name="title" class="form-input" required maxlength="100">
            </div>
            
            <div class="form-group">
                <label class="form-label">설명</label>
                <textarea name="description" class="form-textarea" maxlength="500"></textarea>
            </div>
            
            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 20px;">
                <div class="form-group">
                    <label class="form-label">카테고리 *</label>
                    <select name="category" class="form-select" required>
                        <option value="">선택하세요</option>
                        <option value="main_story">메인 스토리</option>
                        <option value="side_quest">사이드 퀘스트</option>
                        <option value="daily">데일리</option>
                        <option value="weekly">위클리</option>
                        <option value="achievement">업적</option>
                        <option value="tutorial">튜토리얼</option>
                    </select>
                </div>
                
                <div class="form-group">
                    <label class="form-label">타입 *</label>
                    <select name="type" class="form-select" required>
                        <option value="">선택하세요</option>
                        <option value="collect">수집</option>
                        <option value="trade">거래</option>
                        <option value="visit">방문</option>
                        <option value="level">레벨업</option>
                        <option value="skill">스킬 사용</option>
                        <option value="social">소셜</option>
                    </select>
                </div>
            </div>
            
            <div class="form-group">
                <label class="form-label">목표 설정</label>
                <div class="objectives-container">
                    <div id="objectives">
                        <div class="objective-item">
                            <input type="text" name="objectives[0][description]" placeholder="목표 설명" class="form-input" style="margin-bottom: 5px;">
                            <input type="number" name="objectives[0][target_value]" placeholder="목표값" class="form-input" style="width: 120px;">
                        </div>
                    </div>
                    <button type="button" class="add-objective" onclick="addObjective()">목표 추가</button>
                </div>
            </div>
            
            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 20px;">
                <div class="form-group">
                    <label class="form-label">경험치 보상</label>
                    <input type="number" name="reward_exp" class="form-input" min="0">
                </div>
                
                <div class="form-group">
                    <label class="form-label">돈 보상</label>
                    <input type="number" name="reward_money" class="form-input" min="0">
                </div>
            </div>
            
            <div class="form-group">
                <label class="form-label">제한 시간 (시간)</label>
                <input type="number" name="time_limit_hours" class="form-input" min="1">
                <small>비워두면 무제한</small>
            </div>
            
            <div class="form-group">
                <label style="display: flex; align-items: center;">
                    <input type="checkbox" name="is_repeatable" style="margin-right: 8px;">
                    반복 가능한 퀘스트
                </label>
            </div>
            
            <div class="form-group">
                <button type="submit" class="btn btn-primary">퀘스트 생성</button>
                <a href="/admin/quests" class="btn btn-secondary">취소</a>
            </div>
        </form>
        
        <script>
            let objectiveCount = 1;
            
            function addObjective() {
                const container = document.getElementById('objectives');
                const div = document.createElement('div');
                div.className = 'objective-item';
                div.innerHTML = \`
                    <input type="text" name="objectives[\${objectiveCount}][description]" placeholder="목표 설명" class="form-input" style="margin-bottom: 5px;">
                    <input type="number" name="objectives[\${objectiveCount}][target_value]" placeholder="목표값" class="form-input" style="width: 120px;">
                    <button type="button" onclick="this.parentElement.remove()" style="margin-left: 10px; background: #dc3545; color: white; border: none; padding: 5px 10px; border-radius: 4px;">삭제</button>
                \`;
                container.appendChild(div);
                objectiveCount++;
            }
            
            async function submitQuest(event) {
                event.preventDefault();
                
                const formData = new FormData(event.target);
                const questData = {};
                
                // 기본 필드들
                questData.title = formData.get('title');
                questData.description = formData.get('description');
                questData.category = formData.get('category');
                questData.type = formData.get('type');
                questData.reward_exp = parseInt(formData.get('reward_exp')) || 0;
                questData.reward_money = parseInt(formData.get('reward_money')) || 0;
                questData.time_limit_hours = parseInt(formData.get('time_limit_hours')) || null;
                questData.is_repeatable = formData.has('is_repeatable');
                
                // 목표들 수집
                questData.objectives = [];
                for (let i = 0; i < objectiveCount; i++) {
                    const desc = formData.get(\`objectives[\${i}][description]\`);
                    const target = formData.get(\`objectives[\${i}][target_value]\`);
                    if (desc && target) {
                        questData.objectives.push({
                            description: desc,
                            target_value: parseInt(target)
                        });
                    }
                }
                
                try {
                    const response = await fetch('/admin/quests/api/create', {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json',
                            'Authorization': 'Bearer ' + localStorage.getItem('adminToken')
                        },
                        body: JSON.stringify(questData)
                    });
                    
                    const result = await response.json();
                    
                    if (result.success) {
                        alert('퀘스트가 성공적으로 생성되었습니다!');
                        window.location.href = '/admin/quests';
                    } else {
                        alert('생성 실패: ' + result.error);
                    }
                } catch (error) {
                    alert('요청 실패: ' + error.message);
                }
            }
        </script>
    `;
}

// 템플릿 목록 HTML 생성
function generateTemplateList(templates) {
    return `
        <div class="filters">
            <h3>필터</h3>
            <div class="filter-group">
                <label>카테고리:</label>
                <select onchange="filterTemplates()">
                    <option value="">전체</option>
                    <option value="main_story">메인 스토리</option>
                    <option value="side_quest">사이드 퀘스트</option>
                    <option value="daily">데일리</option>
                    <option value="weekly">위클리</option>
                    <option value="achievement">업적</option>
                </select>
            </div>
        </div>
        
        <table class="table">
            <thead>
                <tr>
                    <th>퀘스트명</th>
                    <th>카테고리</th>
                    <th>타입</th>
                    <th>보상</th>
                    <th>상태</th>
                    <th>생성일</th>
                    <th>작업</th>
                </tr>
            </thead>
            <tbody>
                ${templates.map(template => `
                    <tr>
                        <td><strong>${template.title}</strong></td>
                        <td><span class="category-badge cat-${template.category}">${getCategoryName(template.category)}</span></td>
                        <td>${getTypeName(template.type)}</td>
                        <td>EXP: ${template.reward_exp || 0}, 돈: ${(template.reward_money || 0).toLocaleString()}원</td>
                        <td><span class="status-badge status-${template.is_active ? 'active' : 'inactive'}">${template.is_active ? '활성' : '비활성'}</span></td>
                        <td>${new Date(template.created_at).toLocaleDateString()}</td>
                        <td>
                            <a href="/admin/quests/${template.id}" class="btn btn-info">보기</a>
                            <a href="/admin/quests/${template.id}/edit" class="btn btn-warning">수정</a>
                            <button onclick="deleteTemplate('${template.id}')" class="btn btn-danger">삭제</button>
                        </td>
                    </tr>
                `).join('')}
            </tbody>
        </table>
    `;
}

// 통계 페이지 HTML 생성
function generateStatisticsPage(statistics, categoryStats, completionStats) {
    return `
        <div class="stats-grid">
            <div class="stat-card">
                <div class="stat-value">${statistics.totalQuests || 0}</div>
                <div class="stat-label">전체 퀘스트</div>
            </div>
            <div class="stat-card">
                <div class="stat-value">${statistics.completedToday || 0}</div>
                <div class="stat-label">오늘 완료</div>
            </div>
            <div class="stat-card">
                <div class="stat-value">${statistics.averageCompletionRate || 0}%</div>
                <div class="stat-label">평균 완료율</div>
            </div>
            <div class="stat-card">
                <div class="stat-value">${statistics.averageCompletionTime || 0}분</div>
                <div class="stat-label">평균 완료 시간</div>
            </div>
        </div>
        
        <div class="chart-container">
            <div class="chart-title">카테고리별 퀘스트 분포</div>
            ${categoryStats.map(cat => `
                <div style="margin-bottom: 10px;">
                    <div style="display: flex; justify-content: space-between; margin-bottom: 5px;">
                        <span>${getCategoryName(cat.category)}</span>
                        <span>${cat.count}개 (${Math.round((cat.count / statistics.totalQuests) * 100)}%)</span>
                    </div>
                    <div class="progress-bar">
                        <div class="progress-fill progress-info" style="width: ${(cat.count / statistics.totalQuests) * 100}%"></div>
                    </div>
                </div>
            `).join('')}
        </div>
        
        <div class="chart-container">
            <div class="chart-title">완료율 분석</div>
            ${completionStats.map(stat => `
                <div style="margin-bottom: 10px;">
                    <div style="display: flex; justify-content: space-between; margin-bottom: 5px;">
                        <span>${stat.quest_title}</span>
                        <span>${Math.round(stat.completion_rate)}% (${stat.completed}/${stat.assigned})</span>
                    </div>
                    <div class="progress-bar">
                        <div class="progress-fill ${stat.completion_rate > 80 ? 'progress-success' : stat.completion_rate > 50 ? 'progress-warning' : 'progress-info'}" 
                             style="width: ${stat.completion_rate}%"></div>
                    </div>
                </div>
            `).join('')}
        </div>
    `;
}

// 헬퍼 함수들
function getCategoryName(category) {
    const names = {
        'main_story': '메인 스토리',
        'side_quest': '사이드 퀘스트',
        'daily': '데일리',
        'weekly': '위클리',
        'achievement': '업적',
        'tutorial': '튜토리얼'
    };
    return names[category] || category;
}

function getTypeName(type) {
    const names = {
        'collect': '수집',
        'trade': '거래',
        'visit': '방문',
        'level': '레벨업',
        'skill': '스킬',
        'social': '소셜'
    };
    return names[type] || type;
}

function getActivityName(activity) {
    const names = {
        'assigned': '할당됨',
        'started': '시작됨',
        'completed': '완료됨',
        'failed': '실패함',
        'abandoned': '포기됨'
    };
    return names[activity] || activity;
}

function getStatusName(status) {
    const names = {
        'assigned': '할당됨',
        'in_progress': '진행중',
        'completed': '완료',
        'failed': '실패',
        'abandoned': '포기'
    };
    return names[status] || status;
}

module.exports = router;