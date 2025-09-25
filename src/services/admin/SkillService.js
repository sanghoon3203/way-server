// 📁 src/services/admin/SkillService.js - 스킬 시스템 관리 서비스
const DatabaseManager = require('../../database/DatabaseManager');
const logger = require('../../config/logger');
const { randomUUID } = require('crypto');

class SkillService {

    // 스킬 카테고리 정의
    static getSkillCategories() {
        return {
            'trading': {
                name: '거래',
                description: '거래 관련 스킬',
                icon: '💰'
            },
            'combat': {
                name: '전투',
                description: '전투 관련 스킬',
                icon: '⚔️'
            },
            'crafting': {
                name: '제작',
                description: '아이템 제작 스킬',
                icon: '🔨'
            },
            'social': {
                name: '사회',
                description: '사회적 상호작용 스킬',
                icon: '🤝'
            },
            'exploration': {
                name: '탐험',
                description: '탐험 및 발견 스킬',
                icon: '🗺️'
            },
            'passive': {
                name: '패시브',
                description: '자동 발동 스킬',
                icon: '✨'
            }
        };
    }

    // 스킬 타입 정의
    static getSkillTypes() {
        return {
            'active': {
                name: '액티브',
                description: '플레이어가 직접 사용하는 스킬'
            },
            'passive': {
                name: '패시브',
                description: '자동으로 효과가 적용되는 스킬'
            },
            'toggle': {
                name: '토글',
                description: '켜고 끌 수 있는 스킬'
            },
            'triggered': {
                name: '트리거',
                description: '특정 조건에서 발동되는 스킬'
            }
        };
    }

    // 스킬 템플릿 생성
    static async createSkillTemplate(skillData, adminId) {
        try {
            // 입력 데이터 검증
            const validatedData = this.validateSkillData(skillData);
            
            const skillId = randomUUID();
            const now = new Date().toISOString();

            // 스킬 템플릿 생성
            await DatabaseManager.run(`
                INSERT INTO skill_templates (
                    id, name, description, category, type, max_level,
                    base_cost, cost_multiplier, base_cooldown, cooldown_reduction,
                    base_effect_value, effect_multiplier, requirements, effects,
                    icon, is_active, created_by, created_at, updated_at
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            `, [
                skillId,
                validatedData.name,
                validatedData.description,
                validatedData.category,
                validatedData.type,
                validatedData.maxLevel || 10,
                validatedData.baseCost || 0,
                validatedData.costMultiplier || 1.5,
                validatedData.baseCooldown || 0,
                validatedData.cooldownReduction || 0,
                validatedData.baseEffectValue || 0,
                validatedData.effectMultiplier || 1.1,
                JSON.stringify(validatedData.requirements || {}),
                JSON.stringify(validatedData.effects || {}),
                validatedData.icon || '⭐',
                true,
                adminId,
                now,
                now
            ]);

            // 레벨별 스킬 데이터 생성
            if (validatedData.levelData) {
                for (const levelData of validatedData.levelData) {
                    await DatabaseManager.run(`
                        INSERT INTO skill_levels (
                            id, skill_id, level, cost, cooldown, effect_value,
                            description, requirements
                        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
                    `, [
                        randomUUID(),
                        skillId,
                        levelData.level,
                        levelData.cost,
                        levelData.cooldown,
                        levelData.effectValue,
                        levelData.description,
                        JSON.stringify(levelData.requirements || {})
                    ]);
                }
            }

            // 관리자 액션 로그
            await this.logAdminAction(adminId, 'skill_create', {
                skillId,
                skillName: validatedData.name
            });

            logger.info(`스킬 템플릿 생성: ${validatedData.name} (${skillId})`);
            return { id: skillId, ...validatedData };

        } catch (error) {
            logger.error('스킬 템플릿 생성 실패:', error);
            throw error;
        }
    }

    // 스킬 템플릿 목록 조회
    static async getSkillTemplates(options = {}) {
        try {
            const { category, type, status = 'active', page = 1, limit = 20 } = options;
            const offset = (page - 1) * limit;

            let whereConditions = [];
            let params = [];

            if (category) {
                whereConditions.push('category = ?');
                params.push(category);
            }

            if (type) {
                whereConditions.push('type = ?');
                params.push(type);
            }

            if (status === 'active') {
                whereConditions.push('is_active = 1');
            } else if (status === 'inactive') {
                whereConditions.push('is_active = 0');
            }

            const whereClause = whereConditions.length > 0 ? 
                `WHERE ${whereConditions.join(' AND ')}` : '';

            const skills = await DatabaseManager.all(`
                SELECT 
                    st.*,
                    COUNT(ps.id) as players_learned,
                    AVG(ps.level) as avg_level
                FROM skill_templates st
                LEFT JOIN player_skills ps ON st.id = ps.skill_id
                ${whereClause}
                GROUP BY st.id
                ORDER BY st.created_at DESC
                LIMIT ? OFFSET ?
            `, [...params, limit, offset]);

            // 총 개수 조회
            const totalResult = await DatabaseManager.get(`
                SELECT COUNT(*) as total 
                FROM skill_templates st 
                ${whereClause}
            `, params);

            return {
                skills,
                pagination: {
                    page,
                    limit,
                    total: totalResult.total,
                    totalPages: Math.ceil(totalResult.total / limit)
                }
            };

        } catch (error) {
            logger.error('스킬 템플릿 목록 조회 실패:', error);
            throw error;
        }
    }

    // 스킬 상세 정보 조회
    static async getSkillDetails(skillId) {
        try {
            const skill = await DatabaseManager.get(`
                SELECT * FROM skill_templates WHERE id = ?
            `, [skillId]);

            if (!skill) {
                throw new Error('스킬을 찾을 수 없습니다');
            }

            // 레벨 정보 조회
            const levels = await DatabaseManager.all(`
                SELECT * FROM skill_levels WHERE skill_id = ? ORDER BY level
            `, [skillId]);

            // 스킬 사용 통계
            const stats = await DatabaseManager.get(`
                SELECT 
                    COUNT(ps.id) as total_learned,
                    AVG(ps.level) as avg_level,
                    MAX(ps.level) as max_level_achieved,
                    COUNT(CASE WHEN ps.last_used > datetime('now', '-7 days') THEN 1 END) as active_users_week
                FROM player_skills ps 
                WHERE ps.skill_id = ?
            `, [skillId]);

            return {
                ...skill,
                levels,
                statistics: stats,
                requirements: skill.requirements ? JSON.parse(skill.requirements) : {},
                effects: skill.effects ? JSON.parse(skill.effects) : {}
            };

        } catch (error) {
            logger.error('스킬 상세 조회 실패:', error);
            throw error;
        }
    }

    // 스킬 템플릿 업데이트
    static async updateSkillTemplate(skillId, updates, adminId) {
        try {
            const skill = await DatabaseManager.get(`
                SELECT * FROM skill_templates WHERE id = ?
            `, [skillId]);

            if (!skill) {
                throw new Error('스킬을 찾을 수 없습니다');
            }

            const updateFields = [];
            const params = [];

            // 업데이트할 필드들 처리
            const allowedFields = [
                'name', 'description', 'category', 'type', 'max_level',
                'base_cost', 'cost_multiplier', 'base_cooldown', 'cooldown_reduction',
                'base_effect_value', 'effect_multiplier', 'requirements', 'effects',
                'icon', 'is_active'
            ];

            for (const field of allowedFields) {
                if (updates[field] !== undefined) {
                    updateFields.push(`${field} = ?`);
                    if (field === 'requirements' || field === 'effects') {
                        params.push(JSON.stringify(updates[field]));
                    } else {
                        params.push(updates[field]);
                    }
                }
            }

            if (updateFields.length === 0) {
                throw new Error('업데이트할 필드가 없습니다');
            }

            updateFields.push('updated_at = ?');
            params.push(new Date().toISOString());
            params.push(skillId);

            await DatabaseManager.run(`
                UPDATE skill_templates 
                SET ${updateFields.join(', ')}
                WHERE id = ?
            `, params);

            // 관리자 액션 로그
            await this.logAdminAction(adminId, 'skill_update', {
                skillId,
                skillName: updates.name || skill.name,
                updates: Object.keys(updates)
            });

            logger.info(`스킬 템플릿 업데이트: ${skill.name} (${skillId})`);
            return await this.getSkillDetails(skillId);

        } catch (error) {
            logger.error('스킬 템플릿 업데이트 실패:', error);
            throw error;
        }
    }

    // 스킬 통계 조회
    static async getSkillStatistics() {
        try {
            const [
                totalStats,
                categoryStats,
                usageStats,
                levelStats
            ] = await Promise.all([
                // 전체 통계
                DatabaseManager.get(`
                    SELECT 
                        COUNT(*) as total_skills,
                        COUNT(CASE WHEN is_active = 1 THEN 1 END) as active_skills,
                        AVG(max_level) as avg_max_level
                    FROM skill_templates
                `),

                // 카테고리별 통계
                DatabaseManager.all(`
                    SELECT 
                        category,
                        COUNT(*) as count,
                        COUNT(CASE WHEN is_active = 1 THEN 1 END) as active_count
                    FROM skill_templates
                    GROUP BY category
                    ORDER BY count DESC
                `),

                // 사용 통계
                DatabaseManager.all(`
                    SELECT 
                        st.name,
                        st.category,
                        COUNT(ps.id) as total_learned,
                        AVG(ps.current_level) as avg_level,
                        COUNT(CASE WHEN ps.last_used_at > datetime('now', '-7 days') THEN 1 END) as active_users
                    FROM skill_templates st
                    LEFT JOIN player_skills ps ON st.id = ps.skill_template_id
                    WHERE st.is_active = 1
                    GROUP BY st.id
                    ORDER BY total_learned DESC
                    LIMIT 10
                `),

                // 레벨 분포
                DatabaseManager.all(`
                    SELECT 
                        ps.current_level as level,
                        COUNT(*) as count
                    FROM player_skills ps
                    JOIN skill_templates st ON ps.skill_template_id = st.id
                    WHERE st.is_active = 1
                    GROUP BY ps.current_level
                    ORDER BY ps.current_level
                `)
            ]);

            return {
                overview: totalStats,
                categories: categoryStats,
                topSkills: usageStats,
                levelDistribution: levelStats
            };

        } catch (error) {
            logger.error('스킬 통계 조회 실패:', error);
            throw error;
        }
    }

    // 플레이어 스킬 관리
    static async getPlayerSkills(playerId) {
        try {
            const skills = await DatabaseManager.all(`
                SELECT 
                    ps.*,
                    st.name as skill_name,
                    st.category,
                    st.type,
                    st.max_level,
                    st.icon
                FROM player_skills ps
                JOIN skill_templates st ON ps.skill_template_id = st.id
                WHERE ps.player_id = ?
                ORDER BY ps.last_used_at DESC
            `, [playerId]);

            return skills.map(skill => ({
                ...skill,
                experience_to_next: this.calculateExpToNext(skill.current_level, skill.current_exp),
                progress_percent: this.calculateProgressPercent(skill.current_level, skill.current_exp)
            }));

        } catch (error) {
            logger.error('플레이어 스킬 조회 실패:', error);
            throw error;
        }
    }

    // 스킬 트리 시각화 데이터
    static async getSkillTreeData(category = null) {
        try {
            let whereClause = 'WHERE st.is_active = 1';
            let params = [];

            if (category) {
                whereClause += ' AND st.category = ?';
                params.push(category);
            }

            const skills = await DatabaseManager.all(`
                SELECT 
                    st.*,
                    COUNT(ps.id) as learner_count
                FROM skill_templates st
                LEFT JOIN player_skills ps ON st.id = ps.skill_template_id
                ${whereClause}
                GROUP BY st.id
                ORDER BY st.category, st.name
            `, params);

            // 스킬을 카테고리별로 그룹핑
            const skillTree = {};
            const categories = this.getSkillCategories();

            for (const skill of skills) {
                if (!skillTree[skill.category]) {
                    skillTree[skill.category] = {
                        name: categories[skill.category]?.name || skill.category,
                        description: categories[skill.category]?.description || '',
                        icon: categories[skill.category]?.icon || '⭐',
                        skills: []
                    };
                }

                skillTree[skill.category].skills.push({
                    id: skill.id,
                    name: skill.name,
                    description: skill.description,
                    type: skill.type,
                    maxLevel: skill.max_level,
                    icon: skill.icon,
                    learnerCount: skill.learner_count,
                    requirements: skill.requirements ? JSON.parse(skill.requirements) : {},
                    effects: skill.effects ? JSON.parse(skill.effects) : {}
                });
            }

            return skillTree;

        } catch (error) {
            logger.error('스킬 트리 데이터 조회 실패:', error);
            throw error;
        }
    }

    // 스킬 사용 로그 조회
    static async getSkillUsageLogs(options = {}) {
        try {
            const { skillId, playerId, page = 1, limit = 50 } = options;
            const offset = (page - 1) * limit;

            let whereConditions = [];
            let params = [];

            if (skillId) {
                whereConditions.push('sul.skill_id = ?');
                params.push(skillId);
            }

            if (playerId) {
                whereConditions.push('sul.player_id = ?');
                params.push(playerId);
            }

            const whereClause = whereConditions.length > 0 ? 
                `WHERE ${whereConditions.join(' AND ')}` : '';

            const logs = await DatabaseManager.all(`
                SELECT 
                    sul.*,
                    p.name as player_name,
                    st.name as skill_name,
                    st.category
                FROM skill_usage_logs sul
                JOIN players p ON sul.player_id = p.id
                JOIN skill_templates st ON sul.skill_id = st.id
                ${whereClause}
                ORDER BY sul.used_at DESC
                LIMIT ? OFFSET ?
            `, [...params, limit, offset]);

            return logs;

        } catch (error) {
            logger.error('스킬 사용 로그 조회 실패:', error);
            throw error;
        }
    }

    // 데이터 검증
    static validateSkillData(data) {
        const errors = [];

        // 필수 필드 검증
        if (!data.name || data.name.trim().length === 0) {
            errors.push('스킬명은 필수입니다');
        }

        if (!data.category) {
            errors.push('카테고리는 필수입니다');
        }

        if (!data.type) {
            errors.push('스킬 타입은 필수입니다');
        }

        // 카테고리 검증
        const validCategories = Object.keys(this.getSkillCategories());
        if (data.category && !validCategories.includes(data.category)) {
            errors.push('유효하지 않은 카테고리입니다');
        }

        // 타입 검증
        const validTypes = Object.keys(this.getSkillTypes());
        if (data.type && !validTypes.includes(data.type)) {
            errors.push('유효하지 않은 스킬 타입입니다');
        }

        // 숫자 필드 검증
        if (data.maxLevel && (isNaN(data.maxLevel) || data.maxLevel < 1 || data.maxLevel > 100)) {
            errors.push('최대 레벨은 1-100 사이여야 합니다');
        }

        if (data.baseCost && isNaN(data.baseCost)) {
            errors.push('기본 비용은 숫자여야 합니다');
        }

        if (errors.length > 0) {
            throw new Error(`스킬 데이터 검증 실패: ${errors.join(', ')}`);
        }

        return {
            name: data.name.trim(),
            description: data.description?.trim() || '',
            category: data.category,
            type: data.type,
            maxLevel: parseInt(data.maxLevel) || 10,
            baseCost: parseFloat(data.baseCost) || 0,
            costMultiplier: parseFloat(data.costMultiplier) || 1.5,
            baseCooldown: parseInt(data.baseCooldown) || 0,
            cooldownReduction: parseFloat(data.cooldownReduction) || 0,
            baseEffectValue: parseFloat(data.baseEffectValue) || 0,
            effectMultiplier: parseFloat(data.effectMultiplier) || 1.1,
            requirements: data.requirements || {},
            effects: data.effects || {},
            icon: data.icon || '⭐',
            levelData: data.levelData || []
        };
    }

    // 경험치 계산 헬퍼 함수들
    static calculateExpToNext(level, currentExp) {
        const baseExp = 100;
        const expMultiplier = 1.5;
        const requiredExp = Math.floor(baseExp * Math.pow(expMultiplier, level - 1));
        return Math.max(0, requiredExp - currentExp);
    }

    static calculateProgressPercent(level, currentExp) {
        const baseExp = 100;
        const expMultiplier = 1.5;
        const requiredExp = Math.floor(baseExp * Math.pow(expMultiplier, level - 1));
        return Math.min(100, Math.floor((currentExp / requiredExp) * 100));
    }

    // 관리자 액션 로깅
    static async logAdminAction(adminId, action, details) {
        try {
            await DatabaseManager.run(`
                INSERT INTO admin_action_logs (
                    id, admin_id, action, target_type, details, ip_address
                ) VALUES (?, ?, ?, ?, ?, ?)
            `, [
                randomUUID(),
                adminId,
                action,
                'skill',
                JSON.stringify(details),
                '127.0.0.1' // TODO: 실제 IP 주소 가져오기
            ]);
        } catch (error) {
            logger.error('관리자 액션 로깅 실패:', error);
        }
    }
}

module.exports = SkillService;