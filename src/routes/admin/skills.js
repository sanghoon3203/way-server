// 📁 src/routes/admin/skills.js - 스킬 관리 라우트
const express = require('express');
const SkillService = require('../../services/admin/SkillService');
const { AdminAuth } = require('../../middleware/adminAuth');
const logger = require('../../config/logger');

const router = express.Router();

// 개발 환경에서는 인증 우회, API 경로만 인증 필요
// router.use(AdminAuth.authenticateToken);

/**
 * 스킬 관리 대시보드
 * GET /admin/skills
 */
router.get('/', async (req, res) => {
    try {
        const [statistics, skillTree] = await Promise.all([
            SkillService.getSkillStatistics(),
            SkillService.getSkillTreeData()
        ]);

        const dashboardHTML = generateSkillDashboard(statistics, skillTree);

        res.send(`
            <!DOCTYPE html>
            <html>
            <head>
                <title>스킬 관리 - Way Game Admin</title>
                <meta charset="utf-8">
                <meta name="viewport" content="width=device-width, initial-scale=1">
                <style>
                    body { font-family: Arial, sans-serif; margin: 0; background-color: #f8f9fa; }
                    .container { max-width: 1400px; margin: 0 auto; padding: 20px; }
                    .navbar { background-color: #6f42c1; color: white; padding: 1rem 0; margin-bottom: 2rem; }
                    .navbar .container { display: flex; justify-content: space-between; align-items: center; padding: 0 20px; }
                    .navbar a { color: white; text-decoration: none; margin-left: 20px; }
                    .navbar a:hover { text-decoration: underline; }
                    
                    .dashboard-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); gap: 20px; margin-bottom: 30px; }
                    .stat-card { background: white; border-radius: 8px; padding: 20px; box-shadow: 0 2px 10px rgba(0,0,0,0.1); border-left: 4px solid #6f42c1; }
                    .stat-value { font-size: 36px; font-weight: bold; color: #6f42c1; }
                    .stat-label { color: #666; margin-top: 5px; }
                    
                    .action-buttons { display: flex; gap: 10px; margin-bottom: 30px; flex-wrap: wrap; }
                    .btn { padding: 12px 24px; text-decoration: none; border: none; border-radius: 6px; cursor: pointer; font-weight: bold; }
                    .btn-primary { background-color: #6f42c1; color: white; }
                    .btn-success { background-color: #28a745; color: white; }
                    .btn-info { background-color: #17a2b8; color: white; }
                    .btn-warning { background-color: #ffc107; color: #212529; }
                    .btn:hover { opacity: 0.9; }
                    
                    .skill-tree { background: white; border-radius: 8px; padding: 20px; margin-bottom: 20px; box-shadow: 0 2px 10px rgba(0,0,0,0.1); }
                    .tree-title { font-size: 20px; font-weight: bold; margin-bottom: 15px; color: #333; }
                    .category-section { margin-bottom: 30px; }
                    .category-header { display: flex; align-items: center; font-size: 18px; font-weight: bold; margin-bottom: 15px; color: #6f42c1; }
                    .category-icon { font-size: 24px; margin-right: 10px; }
                    .skills-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 15px; }
                    .skill-card { background: #f8f9fa; border-radius: 6px; padding: 15px; border-left: 3px solid #6f42c1; }
                    .skill-name { font-weight: bold; margin-bottom: 5px; }
                    .skill-meta { font-size: 12px; color: #666; }
                    
                    .usage-stats { background: white; border-radius: 8px; padding: 20px; box-shadow: 0 2px 10px rgba(0,0,0,0.1); }
                    .table { width: 100%; border-collapse: collapse; margin-top: 10px; }
                    .table th, .table td { padding: 12px; text-align: left; border-bottom: 1px solid #eee; }
                    .table th { background-color: #f8f9fa; font-weight: bold; }
                    .table tr:hover { background-color: #f5f5f5; }
                    
                    .category-badge { padding: 2px 8px; border-radius: 4px; font-size: 11px; font-weight: bold; }
                    .cat-trading { background-color: #fff8dc; color: #b8860b; }
                    .cat-combat { background-color: #ffe4e1; color: #dc143c; }
                    .cat-crafting { background-color: #f0f8ff; color: #4682b4; }
                    .cat-social { background-color: #f0fff0; color: #32cd32; }
                    .cat-exploration { background-color: #fdf5e6; color: #ff8c00; }
                    .cat-passive { background-color: #f5f5f5; color: #808080; }
                    
                    .progress-bar { width: 100%; height: 6px; background-color: #e9ecef; border-radius: 3px; margin-top: 5px; }
                    .progress-fill { height: 100%; background-color: #6f42c1; border-radius: 3px; transition: width 0.3s ease; }
                </style>
            </head>
            <body>
                <nav class="navbar">
                    <div class="container">
                        <div>
                            <a href="/admin"><strong>Way Game Admin</strong></a>
                            <span> / 스킬 관리</span>
                        </div>
                        <div>
                            <a href="/admin">대시보드</a>
                            <a href="/admin/crud/players">플레이어</a>
                            <a href="/admin/quests">퀘스트</a>
                            <a href="/admin/monitoring">모니터링</a>
                        </div>
                    </div>
                </nav>
                
                <div class="container">
                    <h1>⚡ 스킬 관리 시스템</h1>
                    
                    <div class="action-buttons">
                        <a href="/admin/skills/create" class="btn btn-primary">새 스킬 생성</a>
                        <a href="/admin/skills/tree" class="btn btn-success">스킬 트리</a>
                        <a href="/admin/skills/statistics" class="btn btn-info">통계 분석</a>
                        <a href="/admin/skills/usage" class="btn btn-warning">사용 로그</a>
                    </div>
                    
                    ${dashboardHTML}
                </div>
                
                <script>
                    // 스킬 활성화/비활성화
                    async function toggleSkill(skillId, isActive) {
                        try {
                            const response = await fetch('/admin/skills/api/toggle', {
                                method: 'POST',
                                headers: {
                                    'Content-Type': 'application/json',
                                    'Authorization': 'Bearer ' + localStorage.getItem('adminToken')
                                },
                                body: JSON.stringify({ skillId, isActive: !isActive })
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
                </script>
            </body>
            </html>
        `);

    } catch (error) {
        logger.error('스킬 대시보드 로드 실패:', error);
        res.status(500).send(`<h1>오류</h1><p>${error.message}</p>`);
    }
});

/**
 * 스킬 생성 페이지
 * GET /admin/skills/create
 */
router.get('/create', AdminAuth.requirePermission('skill.create'), (req, res) => {
    const categories = SkillService.getSkillCategories();
    const types = SkillService.getSkillTypes();
    const formHTML = generateSkillForm(categories, types);
    
    res.send(`
        <!DOCTYPE html>
        <html>
        <head>
            <title>새 스킬 생성 - Way Game Admin</title>
            <meta charset="utf-8">
            <meta name="viewport" content="width=device-width, initial-scale=1">
            <style>
                body { font-family: Arial, sans-serif; margin: 20px; background-color: #f8f9fa; }
                .form-container { max-width: 900px; margin: 0 auto; background: white; padding: 30px; border-radius: 8px; box-shadow: 0 2px 10px rgba(0,0,0,0.1); }
                .form-row { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; margin-bottom: 20px; }
                .form-group { margin-bottom: 20px; }
                .form-label { display: block; font-weight: bold; margin-bottom: 5px; color: #333; }
                .form-input, .form-select, .form-textarea { width: 100%; padding: 10px; border: 1px solid #ddd; border-radius: 4px; font-size: 14px; }
                .form-textarea { min-height: 100px; }
                .btn { padding: 12px 24px; border: none; border-radius: 6px; cursor: pointer; font-weight: bold; }
                .btn-primary { background-color: #6f42c1; color: white; }
                .btn-secondary { background-color: #6c757d; color: white; margin-left: 10px; }
                .btn:hover { opacity: 0.9; }
                .level-container { border: 1px solid #ddd; border-radius: 4px; padding: 15px; margin-top: 10px; }
                .level-item { background: #f8f9fa; padding: 10px; margin-bottom: 10px; border-radius: 4px; }
                .add-level { background-color: #28a745; color: white; border: none; padding: 8px 16px; border-radius: 4px; cursor: pointer; }
                .requirements-container { border: 1px solid #ddd; border-radius: 4px; padding: 15px; }
            </style>
        </head>
        <body>
            <div class="form-container">
                <h1>⚡ 새 스킬 생성</h1>
                <a href="/admin/skills" style="color: #6f42c1; text-decoration: none;">← 스킬 관리로 돌아가기</a>
                
                ${formHTML}
            </div>
        </body>
        </html>
    `);
});

/**
 * 스킬 트리 페이지
 * GET /admin/skills/tree
 */
router.get('/tree', async (req, res) => {
    try {
        const { category } = req.query;
        const skillTree = await SkillService.getSkillTreeData(category);
        const categories = SkillService.getSkillCategories();

        const treeHTML = generateSkillTreeVisualization(skillTree, categories);

        res.send(`
            <!DOCTYPE html>
            <html>
            <head>
                <title>스킬 트리 - Way Game Admin</title>
                <meta charset="utf-8">
                <meta name="viewport" content="width=device-width, initial-scale=1">
                <style>
                    body { font-family: Arial, sans-serif; margin: 20px; background-color: #f8f9fa; }
                    .container { max-width: 1400px; margin: 0 auto; }
                    .filters { background: white; padding: 20px; border-radius: 8px; margin-bottom: 20px; box-shadow: 0 2px 10px rgba(0,0,0,0.1); }
                    .skill-tree-container { background: white; border-radius: 8px; padding: 20px; box-shadow: 0 2px 10px rgba(0,0,0,0.1); }
                    .category-section { margin-bottom: 40px; }
                    .category-header { display: flex; align-items: center; font-size: 24px; font-weight: bold; margin-bottom: 20px; padding-bottom: 10px; border-bottom: 2px solid #6f42c1; }
                    .category-icon { font-size: 32px; margin-right: 15px; }
                    .skills-network { display: grid; grid-template-columns: repeat(auto-fit, minmax(250px, 1fr)); gap: 20px; }
                    .skill-node { background: linear-gradient(145deg, #ffffff, #f0f0f0); border: 2px solid #6f42c1; border-radius: 12px; padding: 20px; position: relative; box-shadow: 0 4px 8px rgba(0,0,0,0.1); }
                    .skill-icon { font-size: 32px; text-align: center; margin-bottom: 10px; }
                    .skill-name { font-size: 16px; font-weight: bold; margin-bottom: 5px; text-align: center; }
                    .skill-description { font-size: 12px; color: #666; margin-bottom: 10px; text-align: center; }
                    .skill-stats { font-size: 11px; color: #888; }
                    .learner-count { background: #6f42c1; color: white; padding: 2px 6px; border-radius: 10px; font-size: 10px; position: absolute; top: -5px; right: -5px; }
                    .type-badge { position: absolute; top: 5px; left: 5px; background: #28a745; color: white; padding: 2px 6px; border-radius: 4px; font-size: 10px; }
                </style>
            </head>
            <body>
                <div class="container">
                    <h1>🌳 스킬 트리 시각화</h1>
                    <a href="/admin/skills" style="color: #6f42c1; text-decoration: none;">← 스킬 관리로 돌아가기</a>
                    
                    <div class="filters">
                        <label>카테고리 필터:</label>
                        <select onchange="window.location.href='/admin/skills/tree?category='+this.value">
                            <option value="">전체 카테고리</option>
                            ${Object.entries(categories).map(([key, cat]) => `
                                <option value="${key}" ${category === key ? 'selected' : ''}>${cat.icon} ${cat.name}</option>
                            `).join('')}
                        </select>
                    </div>
                    
                    ${treeHTML}
                </div>
            </body>
            </html>
        `);

    } catch (error) {
        logger.error('스킬 트리 페이지 로드 실패:', error);
        res.status(500).send(`<h1>오류</h1><p>${error.message}</p>`);
    }
});

/**
 * 스킬 통계 페이지
 * GET /admin/skills/statistics
 */
router.get('/statistics', async (req, res) => {
    try {
        const statistics = await SkillService.getSkillStatistics();
        const statisticsHTML = generateStatisticsPage(statistics);

        res.send(`
            <!DOCTYPE html>
            <html>
            <head>
                <title>스킬 통계 - Way Game Admin</title>
                <meta charset="utf-8">
                <meta name="viewport" content="width=device-width, initial-scale=1">
                <style>
                    body { font-family: Arial, sans-serif; margin: 20px; background-color: #f8f9fa; }
                    .container { max-width: 1400px; margin: 0 auto; }
                    .stats-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(250px, 1fr)); gap: 20px; margin-bottom: 30px; }
                    .stat-card { background: white; border-radius: 8px; padding: 20px; box-shadow: 0 2px 10px rgba(0,0,0,0.1); text-align: center; }
                    .stat-value { font-size: 36px; font-weight: bold; color: #6f42c1; }
                    .stat-label { color: #666; margin-top: 5px; }
                    .chart-container { background: white; border-radius: 8px; padding: 20px; margin-bottom: 20px; box-shadow: 0 2px 10px rgba(0,0,0,0.1); }
                    .chart-title { font-size: 20px; font-weight: bold; margin-bottom: 15px; color: #333; }
                    .table { width: 100%; border-collapse: collapse; }
                    .table th, .table td { padding: 12px; text-align: left; border-bottom: 1px solid #eee; }
                    .table th { background-color: #f8f9fa; font-weight: bold; }
                    .progress-bar { width: 100%; height: 20px; background-color: #e9ecef; border-radius: 10px; overflow: hidden; margin: 5px 0; }
                    .progress-fill { height: 100%; background-color: #6f42c1; transition: width 0.3s ease; }
                </style>
            </head>
            <body>
                <div class="container">
                    <h1>📊 스킬 통계 분석</h1>
                    <a href="/admin/skills" style="color: #6f42c1; text-decoration: none;">← 스킬 관리로 돌아가기</a>
                    
                    ${statisticsHTML}
                </div>
            </body>
            </html>
        `);

    } catch (error) {
        logger.error('스킬 통계 조회 실패:', error);
        res.status(500).send(`<h1>오류</h1><p>${error.message}</p>`);
    }
});

/**
 * API: 스킬 생성
 * POST /admin/skills/api/create
 */
router.post('/api/create', AdminAuth.requirePermission('skill.create'), async (req, res) => {
    try {
        const skillData = req.body;
        const result = await SkillService.createSkillTemplate(skillData, req.admin.adminId);

        res.json({
            success: true,
            data: result,
            message: '스킬이 성공적으로 생성되었습니다'
        });

    } catch (error) {
        logger.error('스킬 생성 실패:', { error: error.message, data: req.body });
        res.status(400).json({
            success: false,
            error: error.message
        });
    }
});

/**
 * API: 스킬 활성화/비활성화 토글
 * POST /admin/skills/api/toggle
 */
router.post('/api/toggle', AdminAuth.requirePermission('skill.update'), async (req, res) => {
    try {
        const { skillId, isActive } = req.body;
        
        const result = await SkillService.updateSkillTemplate(skillId, {
            is_active: isActive
        }, req.admin.adminId);

        res.json({
            success: true,
            data: result,
            message: `스킬이 ${isActive ? '활성화' : '비활성화'}되었습니다`
        });

    } catch (error) {
        logger.error('스킬 상태 변경 실패:', { error: error.message, body: req.body });
        res.status(400).json({
            success: false,
            error: error.message
        });
    }
});

// 스킬 대시보드 HTML 생성
function generateSkillDashboard(statistics, skillTree) {
    return `
        <!-- 통계 카드들 -->
        <div class="dashboard-grid">
            <div class="stat-card">
                <div class="stat-value">${statistics.overview?.total_skills || 0}</div>
                <div class="stat-label">전체 스킬</div>
            </div>
            <div class="stat-card">
                <div class="stat-value">${statistics.overview?.active_skills || 0}</div>
                <div class="stat-label">활성 스킬</div>
            </div>
            <div class="stat-card">
                <div class="stat-value">${Math.round(statistics.overview?.avg_max_level || 0)}</div>
                <div class="stat-label">평균 최대 레벨</div>
            </div>
            <div class="stat-card">
                <div class="stat-value">${statistics.categories?.length || 0}</div>
                <div class="stat-label">스킬 카테고리</div>
            </div>
        </div>
        
        <!-- 스킬 트리 미리보기 -->
        <div class="skill-tree">
            <div class="tree-title">🌳 스킬 트리 미리보기</div>
            ${Object.entries(skillTree).slice(0, 3).map(([categoryKey, category]) => `
                <div class="category-section">
                    <div class="category-header">
                        <span class="category-icon">${category.icon}</span>
                        ${category.name} (${category.skills.length}개)
                    </div>
                    <div class="skills-grid">
                        ${category.skills.slice(0, 4).map(skill => `
                            <div class="skill-card">
                                <div class="skill-name">${skill.icon} ${skill.name}</div>
                                <div class="skill-meta">
                                    ${skill.type} • ${skill.learnerCount}명 학습
                                    <div class="progress-bar">
                                        <div class="progress-fill" style="width: ${Math.min(100, (skill.learnerCount / 10) * 100)}%"></div>
                                    </div>
                                </div>
                            </div>
                        `).join('')}
                    </div>
                </div>
            `).join('')}
            <div style="text-align: center; margin-top: 20px;">
                <a href="/admin/skills/tree" class="btn btn-primary">전체 스킬 트리 보기</a>
            </div>
        </div>
        
        <!-- 인기 스킬 -->
        <div class="usage-stats">
            <div class="tree-title">🔥 인기 스킬 TOP 10</div>
            <table class="table">
                <thead>
                    <tr>
                        <th>스킬명</th>
                        <th>카테고리</th>
                        <th>학습자 수</th>
                        <th>평균 레벨</th>
                        <th>활성 사용자</th>
                    </tr>
                </thead>
                <tbody>
                    ${statistics.topSkills?.map(skill => `
                        <tr>
                            <td><strong>${skill.name}</strong></td>
                            <td><span class="category-badge cat-${skill.category}">${getCategoryName(skill.category)}</span></td>
                            <td>${skill.total_learned || 0}</td>
                            <td>${Math.round(skill.avg_level || 0)}</td>
                            <td>${skill.active_users || 0}</td>
                        </tr>
                    `).join('') || '<tr><td colspan="5">데이터가 없습니다</td></tr>'}
                </tbody>
            </table>
        </div>
    `;
}

// 스킬 생성 폼 HTML 생성
function generateSkillForm(categories, types) {
    return `
        <form id="skillForm" onsubmit="submitSkill(event)">
            <div class="form-row">
                <div class="form-group">
                    <label class="form-label">스킬명 *</label>
                    <input type="text" name="name" class="form-input" required maxlength="50">
                </div>
                
                <div class="form-group">
                    <label class="form-label">아이콘</label>
                    <input type="text" name="icon" class="form-input" placeholder="⚡" maxlength="2">
                </div>
            </div>
            
            <div class="form-group">
                <label class="form-label">설명</label>
                <textarea name="description" class="form-textarea" maxlength="200"></textarea>
            </div>
            
            <div class="form-row">
                <div class="form-group">
                    <label class="form-label">카테고리 *</label>
                    <select name="category" class="form-select" required>
                        <option value="">선택하세요</option>
                        ${Object.entries(categories).map(([key, cat]) => `
                            <option value="${key}">${cat.icon} ${cat.name}</option>
                        `).join('')}
                    </select>
                </div>
                
                <div class="form-group">
                    <label class="form-label">타입 *</label>
                    <select name="type" class="form-select" required>
                        <option value="">선택하세요</option>
                        ${Object.entries(types).map(([key, type]) => `
                            <option value="${key}">${type.name}</option>
                        `).join('')}
                    </select>
                </div>
            </div>
            
            <div class="form-row">
                <div class="form-group">
                    <label class="form-label">최대 레벨</label>
                    <input type="number" name="maxLevel" class="form-input" min="1" max="100" value="10">
                </div>
                
                <div class="form-group">
                    <label class="form-label">기본 비용</label>
                    <input type="number" name="baseCost" class="form-input" min="0" value="0">
                </div>
            </div>
            
            <div class="form-row">
                <div class="form-group">
                    <label class="form-label">기본 쿨다운 (초)</label>
                    <input type="number" name="baseCooldown" class="form-input" min="0" value="0">
                </div>
                
                <div class="form-group">
                    <label class="form-label">기본 효과값</label>
                    <input type="number" name="baseEffectValue" class="form-input" step="0.1" value="0">
                </div>
            </div>
            
            <div class="form-row">
                <div class="form-group">
                    <label class="form-label">비용 배수</label>
                    <input type="number" name="costMultiplier" class="form-input" step="0.1" min="1" value="1.5">
                </div>
                
                <div class="form-group">
                    <label class="form-label">효과 배수</label>
                    <input type="number" name="effectMultiplier" class="form-input" step="0.1" min="1" value="1.1">
                </div>
            </div>
            
            <div class="form-group">
                <label class="form-label">요구사항 (JSON)</label>
                <textarea name="requirements" class="form-textarea" placeholder='{"level": 10, "skills": ["skill_id"]}'>{}</textarea>
                <small>JSON 형식으로 입력하세요</small>
            </div>
            
            <div class="form-group">
                <label class="form-label">효과 (JSON)</label>
                <textarea name="effects" class="form-textarea" placeholder='{"damage": 10, "duration": 5}'>{}</textarea>
                <small>JSON 형식으로 입력하세요</small>
            </div>
            
            <div class="form-group">
                <button type="submit" class="btn btn-primary">스킬 생성</button>
                <a href="/admin/skills" class="btn btn-secondary">취소</a>
            </div>
        </form>
        
        <script>
            async function submitSkill(event) {
                event.preventDefault();
                
                const formData = new FormData(event.target);
                const skillData = {};
                
                // 기본 필드들
                for (const [key, value] of formData.entries()) {
                    skillData[key] = value;
                }
                
                // JSON 필드 파싱
                try {
                    skillData.requirements = JSON.parse(skillData.requirements || '{}');
                    skillData.effects = JSON.parse(skillData.effects || '{}');
                } catch (error) {
                    alert('JSON 형식이 올바르지 않습니다');
                    return;
                }
                
                try {
                    const response = await fetch('/admin/skills/api/create', {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json',
                            'Authorization': 'Bearer ' + localStorage.getItem('adminToken')
                        },
                        body: JSON.stringify(skillData)
                    });
                    
                    const result = await response.json();
                    
                    if (result.success) {
                        alert('스킬이 성공적으로 생성되었습니다!');
                        window.location.href = '/admin/skills';
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

// 스킬 트리 시각화 HTML 생성
function generateSkillTreeVisualization(skillTree, categories) {
    return `
        <div class="skill-tree-container">
            ${Object.entries(skillTree).map(([categoryKey, category]) => `
                <div class="category-section">
                    <div class="category-header">
                        <span class="category-icon">${category.icon}</span>
                        ${category.name}
                        <small style="font-weight: normal; margin-left: 10px; color: #666;">
                            (${category.skills.length}개 스킬)
                        </small>
                    </div>
                    <div class="skills-network">
                        ${category.skills.map(skill => `
                            <div class="skill-node">
                                <div class="type-badge">${skill.type}</div>
                                ${skill.learnerCount > 0 ? `<div class="learner-count">${skill.learnerCount}</div>` : ''}
                                <div class="skill-icon">${skill.icon}</div>
                                <div class="skill-name">${skill.name}</div>
                                <div class="skill-description">${skill.description}</div>
                                <div class="skill-stats">
                                    최대 레벨: ${skill.maxLevel}<br>
                                    학습자: ${skill.learnerCount}명
                                    ${Object.keys(skill.requirements).length > 0 ? `<br>요구사항 있음` : ''}
                                </div>
                            </div>
                        `).join('')}
                    </div>
                </div>
            `).join('')}
        </div>
    `;
}

// 통계 페이지 HTML 생성
function generateStatisticsPage(statistics) {
    return `
        <div class="stats-grid">
            <div class="stat-card">
                <div class="stat-value">${statistics.overview?.total_skills || 0}</div>
                <div class="stat-label">전체 스킬</div>
            </div>
            <div class="stat-card">
                <div class="stat-value">${statistics.overview?.active_skills || 0}</div>
                <div class="stat-label">활성 스킬</div>
            </div>
            <div class="stat-card">
                <div class="stat-value">${Math.round(statistics.overview?.avg_max_level || 0)}</div>
                <div class="stat-label">평균 최대 레벨</div>
            </div>
        </div>
        
        <div class="chart-container">
            <div class="chart-title">카테고리별 스킬 분포</div>
            ${statistics.categories?.map(cat => `
                <div style="margin-bottom: 15px;">
                    <div style="display: flex; justify-content: space-between; margin-bottom: 5px;">
                        <span>${getCategoryName(cat.category)}</span>
                        <span>${cat.count}개 (활성: ${cat.active_count}개)</span>
                    </div>
                    <div class="progress-bar">
                        <div class="progress-fill" style="width: ${(cat.count / statistics.overview.total_skills) * 100}%"></div>
                    </div>
                </div>
            `).join('') || ''}
        </div>
        
        <div class="chart-container">
            <div class="chart-title">레벨 분포</div>
            ${statistics.levelDistribution?.map(level => `
                <div style="margin-bottom: 10px;">
                    <div style="display: flex; justify-content: space-between; margin-bottom: 5px;">
                        <span>레벨 ${level.level}</span>
                        <span>${level.count}개</span>
                    </div>
                    <div class="progress-bar">
                        <div class="progress-fill" style="width: ${(level.count / Math.max(...statistics.levelDistribution.map(l => l.count))) * 100}%"></div>
                    </div>
                </div>
            `).join('') || ''}
        </div>
    `;
}

// 헬퍼 함수
function getCategoryName(category) {
    const categories = SkillService.getSkillCategories();
    return categories[category]?.name || category;
}

module.exports = router;