// 📁 src/routes/admin/crud.js - 범용 CRUD API 라우트
const express = require('express');
const AdminCRUDService = require('../../services/admin/CRUDService');
const FormGenerator = require('../../services/admin/FormGenerator');
const { AdminAuth } = require('../../middleware/adminAuth');
const logger = require('../../config/logger');

const router = express.Router();

// 개발 환경에서는 인증 우회
// router.use(AdminAuth.authenticateToken);

/**
 * 엔티티 목록 페이지
 * GET /admin/crud/:entity
 */
router.get('/:entity', async (req, res) => {
    try {
        const { entity } = req.params;
        const { page = 1, limit = 20, ...filters } = req.query;

        // 빈 문자열 필터 제거
        Object.keys(filters).forEach(key => {
            if (filters[key] === '') {
                delete filters[key];
            }
        });

        const result = await AdminCRUDService.performCRUD(entity, 'read', {
            filters,
            pagination: { page: parseInt(page), limit: parseInt(limit) }
        });

        // HTML 응답
        const tableHTML = FormGenerator.generateTable(entity, result);
        
        res.send(`
            <!DOCTYPE html>
            <html>
            <head>
                <title>${result.entity} 관리 - Way Game Admin</title>
                <meta charset="utf-8">
                <meta name="viewport" content="width=device-width, initial-scale=1">
                <style>
                    body { font-family: Arial, sans-serif; margin: 0; background-color: #f8f9fa; }
                    .container { max-width: 1200px; margin: 0 auto; }
                    .navbar { background-color: #343a40; color: white; padding: 1rem 0; margin-bottom: 2rem; }
                    .navbar .container { display: flex; justify-content: space-between; align-items: center; padding: 0 20px; }
                    .navbar a { color: white; text-decoration: none; margin-left: 20px; }
                    .navbar a:hover { text-decoration: underline; }
                    .btn { padding: 10px 20px; text-decoration: none; border: none; border-radius: 4px; cursor: pointer; display: inline-block; }
                    .btn-primary { background-color: #007bff; color: white; }
                    .btn-primary:hover { background-color: #0056b3; }
                </style>
            </head>
            <body>
                <nav class="navbar">
                    <div class="container">
                        <div>
                            <a href="/admin"><strong>Way Game Admin</strong></a>
                        </div>
                        <div>
                            <a href="/admin/crud/users">사용자</a>
                            <a href="/admin/crud/players">플레이어</a>
                            <a href="/admin/crud/merchants">상인</a>
                            <a href="/admin/crud/items">아이템</a>
                            <a href="/admin/crud/quests">퀘스트</a>
                            <a href="/admin/crud/skills">스킬</a>
                            <a href="/admin/monitoring">모니터링</a>
                        </div>
                    </div>
                </nav>
                
                <div class="container">
                    ${tableHTML}
                </div>
            </body>
            </html>
        `);

    } catch (error) {
        logger.error(`CRUD 목록 조회 실패: ${req.params.entity}`, error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

/**
 * 엔티티 생성 폼
 * GET /admin/crud/:entity/create
 */
router.get('/:entity/create', (req, res) => {
    try {
        const { entity } = req.params;
        const formHTML = FormGenerator.generateForm(entity, {}, 'create');

        res.send(`
            <!DOCTYPE html>
            <html>
            <head>
                <title>새 ${AdminCRUDService.getManageableEntities()[entity]?.displayName} 생성 - Way Game Admin</title>
                <meta charset="utf-8">
                <meta name="viewport" content="width=device-width, initial-scale=1">
            </head>
            <body>
                ${formHTML}
            </body>
            </html>
        `);

    } catch (error) {
        res.status(400).send(`<h1>오류</h1><p>${error.message}</p>`);
    }
});

/**
 * 엔티티 상세 조회
 * GET /admin/crud/:entity/:id
 */
router.get('/:entity/:id', async (req, res) => {
    try {
        const { entity, id } = req.params;
        
        // 단일 아이템 조회
        const result = await AdminCRUDService.performCRUD(entity, 'read', {
            filters: { id },
            pagination: { page: 1, limit: 1 }
        });

        if (!result.data || result.data.length === 0) {
            return res.status(404).send('<h1>찾을 수 없습니다</h1>');
        }

        const item = result.data[0];
        const config = AdminCRUDService.getManageableEntities()[entity];
        
        // 상세 보기 HTML 생성
        const detailsHTML = `
            <div class="detail-container">
                <div class="detail-header">
                    <h2>${config.displayName} 상세 정보</h2>
                    <div class="detail-actions">
                        <a href="/admin/crud/${entity}/${id}/edit" class="btn btn-warning">수정</a>
                        <button onclick="deleteItem('${entity}', '${id}')" class="btn btn-danger">삭제</button>
                        <a href="/admin/crud/${entity}" class="btn btn-secondary">목록으로</a>
                    </div>
                </div>
                
                <div class="detail-content">
                    ${config.fields.map(field => {
                        let value = item[field.name];
                        
                        // 값 포맷팅
                        if (field.type === 'boolean') {
                            value = value ? '예' : '아니오';
                        } else if (field.type === 'datetime' && value) {
                            value = new Date(value).toLocaleString();
                        } else if (field.type === 'json' && value) {
                            value = `<pre>${JSON.stringify(typeof value === 'string' ? JSON.parse(value) : value, null, 2)}</pre>`;
                        } else if (field.type === 'select' && field.options) {
                            const option = field.options.find(opt => opt.value == value);
                            value = option ? option.label : value;
                        } else if (!value) {
                            value = '-';
                        }

                        return `
                            <div class="detail-row">
                                <div class="detail-label">${field.label}:</div>
                                <div class="detail-value">${value}</div>
                            </div>
                        `;
                    }).join('')}
                </div>
            </div>
            
            <style>
                body { font-family: Arial, sans-serif; margin: 20px; background-color: #f8f9fa; }
                .detail-container { max-width: 800px; margin: 0 auto; }
                .detail-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px; }
                .detail-actions { display: flex; gap: 10px; }
                .detail-content { background: white; padding: 30px; border-radius: 8px; box-shadow: 0 2px 10px rgba(0,0,0,0.1); }
                .detail-row { display: flex; margin-bottom: 15px; border-bottom: 1px solid #eee; padding-bottom: 15px; }
                .detail-label { font-weight: bold; min-width: 150px; color: #555; }
                .detail-value { flex: 1; }
                .detail-value pre { background: #f8f9fa; padding: 10px; border-radius: 4px; font-size: 12px; }
                .btn { padding: 10px 20px; text-decoration: none; border: none; border-radius: 4px; cursor: pointer; }
                .btn-warning { background-color: #ffc107; color: #212529; }
                .btn-danger { background-color: #dc3545; color: white; }
                .btn-secondary { background-color: #6c757d; color: white; }
                .btn:hover { opacity: 0.8; }
            </style>
            
            <script>
                async function deleteItem(entity, id) {
                    if (!confirm('정말 삭제하시겠습니까?')) return;
                    
                    try {
                        const response = await fetch('/admin/crud/' + entity + '/' + id, {
                            method: 'DELETE',
                            headers: {
                                'Authorization': 'Bearer ' + localStorage.getItem('adminToken')
                            }
                        });
                        
                        const result = await response.json();
                        
                        if (result.success) {
                            alert('삭제 완료!');
                            window.location.href = '/admin/crud/' + entity;
                        } else {
                            alert('삭제 실패: ' + result.error);
                        }
                    } catch (error) {
                        alert('요청 실패: ' + error.message);
                    }
                }
            </script>
        `;

        res.send(`
            <!DOCTYPE html>
            <html>
            <head>
                <title>${config.displayName} 상세 - Way Game Admin</title>
                <meta charset="utf-8">
            </head>
            <body>
                ${detailsHTML}
            </body>
            </html>
        `);

    } catch (error) {
        logger.error(`CRUD 상세 조회 실패: ${req.params.entity}/${req.params.id}`, error);
        res.status(500).send(`<h1>오류</h1><p>${error.message}</p>`);
    }
});

/**
 * 엔티티 수정 폼
 * GET /admin/crud/:entity/:id/edit
 */
router.get('/:entity/:id/edit', async (req, res) => {
    try {
        const { entity, id } = req.params;
        
        // 기존 데이터 조회
        const result = await AdminCRUDService.performCRUD(entity, 'read', {
            filters: { id },
            pagination: { page: 1, limit: 1 }
        });

        if (!result.data || result.data.length === 0) {
            return res.status(404).send('<h1>찾을 수 없습니다</h1>');
        }

        const item = result.data[0];
        const formHTML = FormGenerator.generateForm(entity, item, 'update');

        res.send(`
            <!DOCTYPE html>
            <html>
            <head>
                <title>${AdminCRUDService.getManageableEntities()[entity]?.displayName} 수정 - Way Game Admin</title>
                <meta charset="utf-8">
                <meta name="viewport" content="width=device-width, initial-scale=1">
            </head>
            <body>
                ${formHTML}
            </body>
            </html>
        `);

    } catch (error) {
        logger.error(`CRUD 수정 폼 로드 실패: ${req.params.entity}/${req.params.id}`, error);
        res.status(500).send(`<h1>오류</h1><p>${error.message}</p>`);
    }
});

/**
 * 엔티티 생성 API
 * POST /admin/crud/:entity
 */
router.post('/:entity', async (req, res) => {
    try {
        const { entity } = req.params;
        const result = await AdminCRUDService.performCRUD(entity, 'create', req.body, req.admin.adminId);

        res.json({
            success: true,
            data: result,
            message: `${AdminCRUDService.getManageableEntities()[entity]?.displayName}이(가) 생성되었습니다`
        });

    } catch (error) {
        logger.error(`CRUD 생성 실패: ${req.params.entity}`, { error: error.message, body: req.body });
        res.status(400).json({
            success: false,
            error: error.message
        });
    }
});

/**
 * 엔티티 수정 API
 * PUT /admin/crud/:entity/:id
 */
router.put('/:entity/:id', async (req, res) => {
    try {
        const { entity, id } = req.params;
        const { updates } = req.body;

        const result = await AdminCRUDService.performCRUD(entity, 'update', {
            id,
            updates
        }, req.admin.adminId);

        res.json({
            success: true,
            data: result,
            message: `${AdminCRUDService.getManageableEntities()[entity]?.displayName}이(가) 수정되었습니다`
        });

    } catch (error) {
        logger.error(`CRUD 수정 실패: ${req.params.entity}/${req.params.id}`, { error: error.message, body: req.body });
        res.status(400).json({
            success: false,
            error: error.message
        });
    }
});

/**
 * 엔티티 삭제 API
 * DELETE /admin/crud/:entity/:id
 */
router.delete('/:entity/:id', async (req, res) => {
    try {
        const { entity, id } = req.params;

        const result = await AdminCRUDService.performCRUD(entity, 'delete', { id }, req.admin.adminId);

        res.json({
            success: true,
            data: result,
            message: `${AdminCRUDService.getManageableEntities()[entity]?.displayName}이(가) 삭제되었습니다`
        });

    } catch (error) {
        logger.error(`CRUD 삭제 실패: ${req.params.entity}/${req.params.id}`, { error: error.message });
        res.status(400).json({
            success: false,
            error: error.message
        });
    }
});

/**
 * 엔티티 목록 API (JSON 응답)
 * GET /admin/api/crud/:entity
 */
router.get('/api/:entity', async (req, res) => {
    try {
        const { entity } = req.params;
        const { page = 1, limit = 20, ...filters } = req.query;

        const result = await AdminCRUDService.performCRUD(entity, 'read', {
            filters,
            pagination: { page: parseInt(page), limit: parseInt(limit) }
        });

        res.json({
            success: true,
            data: result
        });

    } catch (error) {
        logger.error(`CRUD API 조회 실패: ${req.params.entity}`, error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

module.exports = router;