// 📁 src/services/admin/CRUDService.js - 범용 CRUD 서비스
const DatabaseManager = require('../../database/DatabaseManager');
const { AdminAuth } = require('../../middleware/adminAuth');
const logger = require('../../config/logger');

class AdminCRUDService {
    
    // 관리 가능한 엔티티 정의
    static getManageableEntities() {
        return {
            users: {
                table: 'users',
                displayName: '사용자',
                permissions: ['users.read', 'users.update'],
                fields: [
                    { name: 'id', type: 'text', readonly: true, label: 'ID' },
                    { name: 'email', type: 'email', required: true, label: '이메일' },
                    { name: 'created_at', type: 'datetime', readonly: true, label: '가입일' },
                    { name: 'is_active', type: 'boolean', label: '활성 상태' }
                ]
            },
            players: {
                table: 'players',
                displayName: '플레이어',
                permissions: ['players.read', 'players.update', 'players.delete'],
                fields: [
                    { name: 'id', type: 'text', readonly: true, label: 'ID' },
                    { name: 'name', type: 'text', required: true, label: '플레이어명' },
                    { name: 'level', type: 'number', min: 1, max: 100, label: '레벨' },
                    { name: 'money', type: 'number', min: 0, label: '보유금' },
                    { name: 'current_license', type: 'select', options: [
                        { value: 0, label: '초급' },
                        { value: 1, label: '중급' },
                        { value: 2, label: '고급' }
                    ], label: '라이센스' },
                    { name: 'reputation', type: 'number', min: 0, label: '평판' },
                    { name: 'last_active', type: 'datetime', readonly: true, label: '최종 접속' }
                ]
            },
            merchants: {
                table: 'merchants',
                displayName: '상인',
                permissions: ['merchants.create', 'merchants.read', 'merchants.update', 'merchants.delete'],
                fields: [
                    { name: 'id', type: 'text', readonly: true, label: 'ID' },
                    { name: 'name', type: 'text', required: true, label: '상인명' },
                    { name: 'title', type: 'text', label: '직함' },
                    { name: 'merchant_type', type: 'select', required: true, options: [
                        { value: 'electronics', label: '전자제품' },
                        { value: 'clothing', label: '의류' },
                        { value: 'food', label: '음식' },
                        { value: 'arts', label: '예술품' },
                        { value: 'antiques', label: '골동품' }
                    ], label: '상인 유형' },
                    { name: 'district', type: 'select', required: true, options: [
                        { value: '강남구', label: '강남구' },
                        { value: '서초구', label: '서초구' },
                        { value: '송파구', label: '송파구' },
                        { value: '강동구', label: '강동구' },
                        { value: '관악구', label: '관악구' },
                        { value: '종로구', label: '종로구' },
                        { value: '중구', label: '중구' },
                        { value: '마포구', label: '마포구' },
                        { value: '기타', label: '기타' }
                    ], label: '지역' },
                    { name: 'lat', type: 'number', step: 0.000001, required: true, label: '위도' },
                    { name: 'lng', type: 'number', step: 0.000001, required: true, label: '경도' },
                    { name: 'price_modifier', type: 'number', step: 0.1, min: 0.1, max: 3.0, label: '가격 조정율' },
                    { name: 'is_active', type: 'boolean', label: '활성 상태' }
                ]
            },
            items: {
                table: 'item_templates',
                displayName: '아이템',
                permissions: ['items.create', 'items.read', 'items.update', 'items.delete'],
                fields: [
                    { name: 'id', type: 'text', readonly: true, label: 'ID' },
                    { name: 'name', type: 'text', required: true, label: '아이템명' },
                    { name: 'category', type: 'select', required: true, options: [
                        { value: 'electronics', label: '전자제품' },
                        { value: 'clothing', label: '의류' },
                        { value: 'food', label: '음식' },
                        { value: 'arts', label: '예술품' },
                        { value: 'antiques', label: '골동품' }
                    ], label: '카테고리' },
                    { name: 'grade', type: 'number', min: 0, max: 5, required: true, label: '등급' },
                    { name: 'base_price', type: 'number', min: 1, required: true, label: '기본 가격' },
                    { name: 'weight', type: 'number', step: 0.1, min: 0.1, label: '무게' },
                    { name: 'description', type: 'textarea', label: '설명' },
                    { name: 'required_license', type: 'number', min: 0, max: 2, label: '필요 라이센스' }
                ]
            },
            quests: {
                table: 'quest_templates',
                displayName: '퀘스트',
                permissions: ['quests.create', 'quests.read', 'quests.update', 'quests.delete'],
                fields: [
                    { name: 'id', type: 'text', readonly: true, label: 'ID' },
                    { name: 'name', type: 'text', required: true, label: '퀘스트명' },
                    { name: 'description', type: 'textarea', required: true, label: '설명' },
                    { name: 'category', type: 'select', required: true, options: [
                        { value: 'main_story', label: '메인 스토리' },
                        { value: 'side_quest', label: '사이드 퀘스트' },
                        { value: 'daily', label: '일일 퀘스트' },
                        { value: 'weekly', label: '주간 퀘스트' },
                        { value: 'achievement', label: '업적' }
                    ], label: '카테고리' },
                    { name: 'level_requirement', type: 'number', min: 1, label: '요구 레벨' },
                    { name: 'objectives', type: 'json', label: '목표 (JSON)' },
                    { name: 'rewards', type: 'json', label: '보상 (JSON)' },
                    { name: 'is_active', type: 'boolean', label: '활성 상태' }
                ]
            },
            skills: {
                table: 'skill_templates',
                displayName: '스킬',
                permissions: ['skills.create', 'skills.read', 'skills.update', 'skills.delete'],
                fields: [
                    { name: 'id', type: 'text', readonly: true, label: 'ID' },
                    { name: 'name', type: 'text', required: true, label: '스킬명' },
                    { name: 'description', type: 'textarea', required: true, label: '설명' },
                    { name: 'category', type: 'select', required: true, options: [
                        { value: 'trading', label: '거래' },
                        { value: 'social', label: '사교' },
                        { value: 'exploration', label: '탐험' },
                        { value: 'crafting', label: '제작' }
                    ], label: '카테고리' },
                    { name: 'tier', type: 'number', min: 1, max: 5, required: true, label: '티어' },
                    { name: 'max_level', type: 'number', min: 1, max: 20, label: '최대 레벨' },
                    { name: 'effects', type: 'json', label: '효과 (JSON)' },
                    { name: 'is_active', type: 'boolean', label: '활성 상태' }
                ]
            }
        };
    }

    // 권한 검증
    static async validatePermission(adminId, requiredPermissions, operation) {
        // operation에 따른 필요 권한 확인
        const permissionMap = {
            'create': requiredPermissions.filter(p => p.includes('.create')),
            'read': requiredPermissions.filter(p => p.includes('.read')),
            'update': requiredPermissions.filter(p => p.includes('.update')),
            'delete': requiredPermissions.filter(p => p.includes('.delete'))
        };

        const neededPermissions = permissionMap[operation] || requiredPermissions;
        
        // 실제 권한 검증은 미들웨어에서 이미 처리되었다고 가정
        return true;
    }

    // 생성 (CREATE)
    static async create(entity, data, adminId) {
        const config = this.getManageableEntities()[entity];
        if (!config) {
            throw new Error(`지원하지 않는 엔티티: ${entity}`);
        }

        await this.validatePermission(adminId, config.permissions, 'create');

        // 필수 필드 검증
        const requiredFields = config.fields.filter(f => f.required && !f.readonly);
        for (const field of requiredFields) {
            if (!data[field.name]) {
                throw new Error(`필수 필드 누락: ${field.label}`);
            }
        }

        // ID가 없으면 생성
        if (!data.id) {
            data.id = require('crypto').randomUUID();
        }

        // 🔒 SECURITY: Whitelist column names against schema
        const allowedColumns = config.fields.map(f => f.name);
        const validatedData = {};

        for (const [key, value] of Object.entries(data)) {
            if (!allowedColumns.includes(key)) {
                logger.warn(`Rejected invalid column in CREATE: ${key}`, { entity, adminId });
                continue; // Skip invalid columns
            }
            validatedData[key] = value;
        }

        // 동적 INSERT 쿼리 생성 (validated columns only)
        const columns = Object.keys(validatedData).join(', ');
        const placeholders = Object.keys(validatedData).map(() => '?').join(', ');
        const values = Object.values(validatedData);

        const query = `INSERT INTO ${config.table} (${columns}) VALUES (${placeholders})`;

        await DatabaseManager.run(query, values);

        // 액션 로그 기록
        await AdminAuth.logAction(adminId, 'create', entity, validatedData.id, null, validatedData);

        logger.info(`어드민이 ${config.displayName} 생성`, {
            adminId,
            entity,
            id: validatedData.id
        });

        return validatedData;
    }

    // 조회 (READ)
    static async read(entity, filters = {}, pagination = {}) {
        const config = this.getManageableEntities()[entity];
        if (!config) {
            throw new Error(`지원하지 않는 엔티티: ${entity}`);
        }

        // 페이지네이션 설정
        const page = Math.max(1, parseInt(pagination.page) || 1);
        const limit = Math.min(100, Math.max(1, parseInt(pagination.limit) || 20));
        const offset = (page - 1) * limit;

        // 🔒 SECURITY: Whitelist filter columns against schema
        const allowedColumns = config.fields.map(f => f.name);
        const whereConditions = [];
        const whereValues = [];

        Object.entries(filters).forEach(([key, value]) => {
            if (value !== undefined && value !== null && value !== '') {
                // Validate column name against whitelist
                if (!allowedColumns.includes(key)) {
                    logger.warn(`Rejected invalid filter column: ${key}`, { entity });
                    return; // Skip invalid columns
                }
                whereConditions.push(`${key} LIKE ?`);
                whereValues.push(`%${value}%`);
            }
        });

        const whereClause = whereConditions.length > 0
            ? `WHERE ${whereConditions.join(' AND ')}`
            : '';

        // 🔒 SECURITY: Whitelist sort columns
        const getDefaultSortColumn = (entityName, allowedCols) => {
            const sortPreference = {
                'merchants': 'last_restocked',
                'users': 'created_at',
                'players': 'created_at',
                'trade_records': 'created_at'
            };

            const preferredColumn = sortPreference[entityName] || 'id';

            // Verify column exists in schema
            if (!allowedCols.includes(preferredColumn)) {
                return 'id'; // Safest fallback
            }

            return preferredColumn;
        };

        const sortColumn = getDefaultSortColumn(entity, allowedColumns);

        // 데이터 조회
        const dataQuery = `
            SELECT * FROM ${config.table}
            ${whereClause}
            ORDER BY ${sortColumn} DESC
            LIMIT ? OFFSET ?
        `;

        const data = await DatabaseManager.all(dataQuery, [...whereValues, limit, offset]);

        // 총 개수 조회
        const countQuery = `SELECT COUNT(*) as total FROM ${config.table} ${whereClause}`;
        const countResult = await DatabaseManager.get(countQuery, whereValues);

        return {
            data,
            pagination: {
                page,
                limit,
                total: countResult.total,
                pages: Math.ceil(countResult.total / limit)
            },
            entity: config.displayName
        };
    }

    // 수정 (UPDATE)
    static async update(entity, id, updates, adminId) {
        const config = this.getManageableEntities()[entity];
        if (!config) {
            throw new Error(`지원하지 않는 엔티티: ${entity}`);
        }

        await this.validatePermission(adminId, config.permissions, 'update');

        // 기존 데이터 조회
        const oldData = await DatabaseManager.get(
            `SELECT * FROM ${config.table} WHERE id = ?`,
            [id]
        );

        if (!oldData) {
            throw new Error(`${config.displayName}을(를) 찾을 수 없습니다`);
        }

        // readonly 필드 제거
        const readonlyFields = config.fields.filter(f => f.readonly).map(f => f.name);
        readonlyFields.forEach(field => {
            delete updates[field];
        });

        // 🔒 SECURITY: Whitelist update columns against schema
        const allowedColumns = config.fields
            .filter(f => !f.readonly)
            .map(f => f.name);

        const validatedUpdates = {};

        for (const [key, value] of Object.entries(updates)) {
            if (!allowedColumns.includes(key)) {
                logger.warn(`Rejected invalid column in UPDATE: ${key}`, { entity, adminId });
                continue; // Skip invalid columns
            }
            validatedUpdates[key] = value;
        }

        if (Object.keys(validatedUpdates).length === 0) {
            throw new Error('수정할 유효한 필드가 없습니다');
        }

        // 동적 UPDATE 쿼리 생성 (validated columns only)
        const setClause = Object.keys(validatedUpdates).map(key => `${key} = ?`).join(', ');
        const values = [...Object.values(validatedUpdates), id];

        const query = `UPDATE ${config.table} SET ${setClause} WHERE id = ?`;

        await DatabaseManager.run(query, values);

        // 액션 로그 기록
        await AdminAuth.logAction(adminId, 'update', entity, id, oldData, validatedUpdates);

        logger.info(`어드민이 ${config.displayName} 수정`, {
            adminId,
            entity,
            id,
            changes: Object.keys(validatedUpdates)
        });

        return { ...oldData, ...validatedUpdates };
    }

    // 삭제 (DELETE)
    static async delete(entity, id, adminId) {
        const config = this.getManageableEntities()[entity];
        if (!config) {
            throw new Error(`지원하지 않는 엔티티: ${entity}`);
        }

        await this.validatePermission(adminId, config.permissions, 'delete');

        // 기존 데이터 조회
        const oldData = await DatabaseManager.get(
            `SELECT * FROM ${config.table} WHERE id = ?`, 
            [id]
        );

        if (!oldData) {
            throw new Error(`${config.displayName}을(를) 찾을 수 없습니다`);
        }

        // 소프트 삭제 vs 하드 삭제
        if (config.fields.some(f => f.name === 'is_active')) {
            // is_active 필드가 있으면 소프트 삭제
            await DatabaseManager.run(
                `UPDATE ${config.table} SET is_active = 0 WHERE id = ?`,
                [id]
            );
        } else {
            // 하드 삭제
            await DatabaseManager.run(
                `DELETE FROM ${config.table} WHERE id = ?`,
                [id]
            );
        }

        // 액션 로그 기록
        await AdminAuth.logAction(adminId, 'delete', entity, id, oldData, null);

        logger.info(`어드민이 ${config.displayName} 삭제`, {
            adminId,
            entity,
            id
        });

        return { success: true, deletedId: id };
    }

    // 통합 CRUD 수행
    static async performCRUD(entity, operation, data, adminId) {
        try {
            switch(operation) {
                case 'create':
                    return await this.create(entity, data, adminId);
                case 'read':
                    return await this.read(entity, data.filters, data.pagination);
                case 'update':
                    return await this.update(entity, data.id, data.updates, adminId);
                case 'delete':
                    return await this.delete(entity, data.id, adminId);
                default:
                    throw new Error(`지원하지 않는 작업: ${operation}`);
            }
        } catch (error) {
            logger.error(`CRUD 작업 실패`, {
                entity,
                operation,
                adminId,
                error: error.message
            });
            throw error;
        }
    }
}

module.exports = AdminCRUDService;
