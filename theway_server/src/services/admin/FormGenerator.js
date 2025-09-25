// 📁 src/services/admin/FormGenerator.js - 동적 폼 생성기
const AdminCRUDService = require('./CRUDService');

class FormGenerator {
    
    // HTML 폼 생성
    static generateForm(entity, data = {}, mode = 'create') {
        const config = AdminCRUDService.getManageableEntities()[entity];
        if (!config) {
            throw new Error(`지원하지 않는 엔티티: ${entity}`);
        }

        const formId = `${entity}-form`;
        const submitText = mode === 'create' ? '생성' : '수정';
        const formTitle = `${config.displayName} ${submitText}`;

        let formHTML = `
            <div class="form-container">
                <h2>${formTitle}</h2>
                <form id="${formId}" class="admin-form">
                    ${this.generateFormFields(config.fields, data, mode)}
                    
                    <div class="form-actions">
                        <button type="submit" class="btn btn-primary">
                            ${submitText}
                        </button>
                        <button type="button" class="btn btn-secondary" onclick="history.back()">
                            취소
                        </button>
                    </div>
                </form>
            </div>
            
            <style>
                .form-container { max-width: 800px; margin: 0 auto; padding: 20px; }
                .admin-form { background: white; padding: 30px; border-radius: 8px; box-shadow: 0 2px 10px rgba(0,0,0,0.1); }
                .form-group { margin-bottom: 20px; }
                .form-group label { display: block; margin-bottom: 5px; font-weight: bold; color: #333; }
                .form-group input, .form-group select, .form-group textarea { 
                    width: 100%; padding: 10px; border: 1px solid #ddd; border-radius: 4px; 
                    font-size: 14px; box-sizing: border-box;
                }
                .form-group textarea { height: 100px; resize: vertical; }
                .form-group input[type="checkbox"] { width: auto; margin-right: 8px; }
                .form-group .readonly { background-color: #f5f5f5; cursor: not-allowed; }
                .form-actions { margin-top: 30px; text-align: right; }
                .btn { padding: 10px 20px; margin-left: 10px; border: none; border-radius: 4px; cursor: pointer; font-size: 14px; }
                .btn-primary { background-color: #007bff; color: white; }
                .btn-secondary { background-color: #6c757d; color: white; }
                .btn:hover { opacity: 0.9; }
                .error { color: red; font-size: 12px; margin-top: 4px; }
                .required { color: red; }
            </style>
            
            <script>
                document.getElementById('${formId}').addEventListener('submit', async function(e) {
                    e.preventDefault();
                    
                    const formData = new FormData(this);
                    const data = {};
                    
                    // FormData를 객체로 변환
                    for (let [key, value] of formData.entries()) {
                        // JSON 필드 처리
                        if (key.includes('_json') || key === 'objectives' || key === 'rewards' || key === 'effects') {
                            try {
                                data[key] = value ? JSON.parse(value) : null;
                            } catch (e) {
                                alert('JSON 형식이 올바르지 않습니다: ' + key);
                                return;
                            }
                        } else if (value === 'on') {
                            // 체크박스 처리
                            data[key] = true;
                        } else if (value !== '') {
                            // 숫자 타입 변환
                            const fieldConfig = ${JSON.stringify(config.fields)}.find(f => f.name === key);
                            if (fieldConfig && fieldConfig.type === 'number') {
                                data[key] = parseFloat(value) || 0;
                            } else {
                                data[key] = value;
                            }
                        }
                    }
                    
                    // 체크박스가 unchecked인 경우 false로 설정
                    ${JSON.stringify(config.fields)}.forEach(field => {
                        if (field.type === 'boolean' && !(field.name in data)) {
                            data[field.name] = false;
                        }
                    });
                    
                    try {
                        const operation = '${mode}';
                        const endpoint = operation === 'create' 
                            ? '/admin/crud/${entity}' 
                            : '/admin/crud/${entity}/' + data.id;
                        
                        const method = operation === 'create' ? 'POST' : 'PUT';
                        
                        const response = await fetch(endpoint, {
                            method: method,
                            headers: {
                                'Content-Type': 'application/json',
                                'Authorization': 'Bearer ' + localStorage.getItem('adminToken')
                            },
                            body: JSON.stringify(operation === 'update' ? { updates: data } : data)
                        });
                        
                        const result = await response.json();
                        
                        if (result.success) {
                            alert('${submitText} 완료!');
                            window.location.href = '/admin/crud/${entity}';
                        } else {
                            alert('오류: ' + result.error);
                        }
                    } catch (error) {
                        alert('요청 실패: ' + error.message);
                    }
                });
            </script>
        `;

        return formHTML;
    }

    // 폼 필드 생성
    static generateFormFields(fields, data, mode) {
        return fields.map(field => {
            const value = data[field.name] || '';
            const isReadonly = field.readonly || (mode === 'update' && field.name === 'id');
            const required = field.required && !isReadonly;

            return `
                <div class="form-group">
                    <label for="${field.name}">
                        ${field.label}
                        ${required ? '<span class="required">*</span>' : ''}
                    </label>
                    ${this.generateFieldInput(field, value, isReadonly)}
                </div>
            `;
        }).join('');
    }

    // 개별 필드 입력 요소 생성
    static generateFieldInput(field, value, readonly) {
        const commonAttrs = `
            id="${field.name}" 
            name="${field.name}" 
            ${readonly ? 'readonly class="readonly"' : ''}
            ${field.required && !readonly ? 'required' : ''}
        `;

        switch (field.type) {
            case 'text':
            case 'email':
                return `<input type="${field.type}" ${commonAttrs} value="${this.escapeHtml(value)}">`;
                
            case 'number':
                const numAttrs = [
                    field.min !== undefined ? `min="${field.min}"` : '',
                    field.max !== undefined ? `max="${field.max}"` : '',
                    field.step !== undefined ? `step="${field.step}"` : ''
                ].filter(Boolean).join(' ');
                
                return `<input type="number" ${commonAttrs} ${numAttrs} value="${value}">`;
                
            case 'textarea':
                return `<textarea ${commonAttrs}>${this.escapeHtml(value)}</textarea>`;
                
            case 'select':
                const options = field.options.map(option => {
                    const selected = option.value == value ? 'selected' : '';
                    return `<option value="${option.value}" ${selected}>${option.label}</option>`;
                }).join('');
                
                return `
                    <select ${commonAttrs}>
                        <option value="">-- 선택하세요 --</option>
                        ${options}
                    </select>
                `;
                
            case 'boolean':
                const checked = value ? 'checked' : '';
                return `
                    <label style="font-weight: normal;">
                        <input type="checkbox" ${commonAttrs} ${checked}>
                        활성화
                    </label>
                `;
                
            case 'datetime':
                const dateValue = value ? new Date(value).toISOString().slice(0, 19) : '';
                return `<input type="datetime-local" ${commonAttrs} value="${dateValue}">`;
                
            case 'json':
                const jsonValue = typeof value === 'object' ? JSON.stringify(value, null, 2) : value;
                return `
                    <textarea ${commonAttrs} placeholder="JSON 형식으로 입력하세요">${this.escapeHtml(jsonValue)}</textarea>
                    <small style="color: #666;">예: {"key": "value", "number": 123}</small>
                `;
                
            default:
                return `<input type="text" ${commonAttrs} value="${this.escapeHtml(value)}">`;
        }
    }

    // 테이블 형태의 목록 생성
    static generateTable(entity, result) {
        const config = AdminCRUDService.getManageableEntities()[entity];
        const { data, pagination } = result;

        if (!data || data.length === 0) {
            return `
                <div class="no-data">
                    <p>표시할 ${config.displayName} 데이터가 없습니다.</p>
                    <a href="/admin/crud/${entity}/create" class="btn btn-primary">새 ${config.displayName} 생성</a>
                </div>
            `;
        }

        // 테이블 헤더
        const headers = config.fields
            .filter(field => !['json', 'textarea'].includes(field.type))
            .slice(0, 8) // 최대 8개 컬럼만 표시
            .map(field => `<th>${field.label}</th>`)
            .join('');

        // 테이블 로우
        const rows = data.map(item => {
            const cells = config.fields
                .filter(field => !['json', 'textarea'].includes(field.type))
                .slice(0, 8)
                .map(field => {
                    let cellValue = item[field.name];
                    
                    // 값 포맷팅
                    if (field.type === 'boolean') {
                        cellValue = cellValue ? '✓' : '✗';
                    } else if (field.type === 'datetime' && cellValue) {
                        cellValue = new Date(cellValue).toLocaleString();
                    } else if (field.type === 'number' && cellValue) {
                        cellValue = Number(cellValue).toLocaleString();
                    } else if (typeof cellValue === 'string' && cellValue.length > 50) {
                        cellValue = cellValue.substring(0, 50) + '...';
                    }
                    
                    return `<td>${this.escapeHtml(cellValue || '-')}</td>`;
                }).join('');

            return `
                <tr>
                    ${cells}
                    <td class="actions">
                        <a href="/admin/crud/${entity}/${item.id}" class="btn-sm btn-info">보기</a>
                        <a href="/admin/crud/${entity}/${item.id}/edit" class="btn-sm btn-warning">수정</a>
                        <button onclick="deleteItem('${entity}', '${item.id}')" class="btn-sm btn-danger">삭제</button>
                    </td>
                </tr>
            `;
        }).join('');

        // 페이지네이션
        const paginationHTML = this.generatePagination(entity, pagination);

        return `
            <div class="table-container">
                <div class="table-header">
                    <h2>${config.displayName} 관리</h2>
                    <a href="/admin/crud/${entity}/create" class="btn btn-primary">새 ${config.displayName} 생성</a>
                </div>
                
                <table class="admin-table">
                    <thead>
                        <tr>
                            ${headers}
                            <th>작업</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${rows}
                    </tbody>
                </table>
                
                ${paginationHTML}
            </div>
            
            <style>
                .table-container { padding: 20px; }
                .table-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px; }
                .admin-table { width: 100%; border-collapse: collapse; background: white; box-shadow: 0 2px 10px rgba(0,0,0,0.1); }
                .admin-table th, .admin-table td { padding: 12px; text-align: left; border-bottom: 1px solid #ddd; }
                .admin-table th { background-color: #f8f9fa; font-weight: bold; }
                .admin-table tbody tr:hover { background-color: #f5f5f5; }
                .actions { text-align: center; white-space: nowrap; }
                .btn-sm { padding: 4px 8px; margin: 0 2px; text-decoration: none; border: none; border-radius: 3px; font-size: 12px; cursor: pointer; }
                .btn-info { background-color: #17a2b8; color: white; }
                .btn-warning { background-color: #ffc107; color: #212529; }
                .btn-danger { background-color: #dc3545; color: white; }
                .btn-sm:hover { opacity: 0.8; }
                .no-data { text-align: center; padding: 40px; background: white; border-radius: 8px; }
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
                            location.reload();
                        } else {
                            alert('삭제 실패: ' + result.error);
                        }
                    } catch (error) {
                        alert('요청 실패: ' + error.message);
                    }
                }
            </script>
        `;
    }

    // 페이지네이션 생성
    static generatePagination(entity, pagination) {
        if (pagination.pages <= 1) return '';

        const currentPage = pagination.page;
        const totalPages = pagination.pages;
        const prevPage = Math.max(1, currentPage - 1);
        const nextPage = Math.min(totalPages, currentPage + 1);

        let pageLinks = '';
        
        // 이전 페이지
        if (currentPage > 1) {
            pageLinks += `<a href="/admin/crud/${entity}?page=${prevPage}" class="page-link">‹ 이전</a>`;
        }

        // 페이지 번호들
        const startPage = Math.max(1, currentPage - 2);
        const endPage = Math.min(totalPages, currentPage + 2);

        for (let i = startPage; i <= endPage; i++) {
            const activeClass = i === currentPage ? 'active' : '';
            pageLinks += `<a href="/admin/crud/${entity}?page=${i}" class="page-link ${activeClass}">${i}</a>`;
        }

        // 다음 페이지
        if (currentPage < totalPages) {
            pageLinks += `<a href="/admin/crud/${entity}?page=${nextPage}" class="page-link">다음 ›</a>`;
        }

        return `
            <div class="pagination">
                <div class="pagination-info">
                    전체 ${pagination.total}개 중 ${((currentPage-1)*pagination.limit)+1}-${Math.min(currentPage*pagination.limit, pagination.total)}개 표시
                </div>
                <div class="pagination-links">
                    ${pageLinks}
                </div>
            </div>
            
            <style>
                .pagination { display: flex; justify-content: space-between; align-items: center; margin-top: 20px; padding: 20px; background: white; border-radius: 8px; }
                .pagination-info { color: #666; font-size: 14px; }
                .pagination-links { display: flex; gap: 5px; }
                .page-link { padding: 8px 12px; text-decoration: none; border: 1px solid #ddd; border-radius: 4px; color: #333; }
                .page-link:hover, .page-link.active { background-color: #007bff; color: white; border-color: #007bff; }
            </style>
        `;
    }

    // HTML 이스케이프
    static escapeHtml(text) {
        if (text === null || text === undefined) return '';
        return String(text)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#39;');
    }
}

module.exports = FormGenerator;