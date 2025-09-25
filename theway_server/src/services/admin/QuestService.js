// 📁 src/services/admin/QuestService.js - 퀘스트 관리 서비스
const DatabaseManager = require('../../database/DatabaseManager');
const { AdminAuth } = require('../../middleware/adminAuth');
const logger = require('../../config/logger');

class QuestService {
    
    // 퀘스트 카테고리 및 타입 정의
    static getQuestCategories() {
        return {
            main_story: { label: '메인 스토리', icon: '📖', description: '주요 스토리라인 퀘스트' },
            side_quest: { label: '사이드 퀘스트', icon: '🎯', description: '선택적 부가 퀘스트' },
            daily: { label: '일일 퀘스트', icon: '📅', description: '매일 반복되는 퀘스트' },
            weekly: { label: '주간 퀘스트', icon: '📆', description: '주간 단위 퀘스트' },
            achievement: { label: '업적', icon: '🏆', description: '특별한 성취 퀘스트' },
            tutorial: { label: '튜토리얼', icon: '🎓', description: '게임 학습용 퀘스트' }
        };
    }

    static getQuestTypes() {
        return {
            collect: { 
                label: '수집', 
                icon: '📦',
                description: '특정 아이템을 수집하는 퀘스트',
                objectiveTemplate: { item_id: '', quantity: 1 }
            },
            trade: { 
                label: '거래', 
                icon: '💰',
                description: '상인과 거래를 완료하는 퀘스트',
                objectiveTemplate: { merchant_id: '', trade_count: 1, min_amount: 0 }
            },
            visit: { 
                label: '방문', 
                icon: '📍',
                description: '특정 장소를 방문하는 퀘스트',
                objectiveTemplate: { location_lat: 0, location_lng: 0, radius: 100 }
            },
            level: { 
                label: '레벨 달성', 
                icon: '⬆️',
                description: '특정 레벨에 도달하는 퀘스트',
                objectiveTemplate: { target_level: 1 }
            },
            skill: { 
                label: '스킬 사용', 
                icon: '🔧',
                description: '특정 스킬을 사용하는 퀘스트',
                objectiveTemplate: { skill_id: '', usage_count: 1 }
            },
            social: { 
                label: '소셜', 
                icon: '👥',
                description: '다른 플레이어와의 상호작용 퀘스트',
                objectiveTemplate: { interaction_type: 'friend', target_count: 1 }
            }
        };
    }

    // 보상 타입 정의
    static getRewardTypes() {
        return {
            money: { label: '돈', icon: '💵', unit: '원' },
            experience: { label: '경험치', icon: '⭐', unit: 'XP' },
            items: { label: '아이템', icon: '🎁', unit: '개' },
            skill_points: { label: '스킬 포인트', icon: '🎯', unit: 'SP' },
            reputation: { label: '평판', icon: '👑', unit: '점' },
            license: { label: '라이센스 업그레이드', icon: '📜', unit: '' }
        };
    }

    // 퀘스트 템플릿 생성
    static async createQuestTemplate(questData, adminId) {
        try {
            await this.validateQuestData(questData);

            const questId = require('crypto').randomUUID();
            
            await DatabaseManager.run(`
                INSERT INTO quest_templates (
                    id, name, description, category, type, level_requirement,
                    required_license, prerequisites, objectives, rewards,
                    auto_complete, repeatable, time_limit, is_active, sort_order,
                    created_at, updated_at
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 
                         CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
            `, [
                questId,
                questData.name,
                questData.description,
                questData.category,
                questData.type,
                questData.level_requirement || 1,
                questData.required_license || 0,
                JSON.stringify(questData.prerequisites || []),
                JSON.stringify(questData.objectives),
                JSON.stringify(questData.rewards),
                questData.auto_complete || false,
                questData.repeatable || false,
                questData.time_limit || null,
                questData.is_active !== false,
                questData.sort_order || 0
            ]);

            // 액션 로그 기록
            await AdminAuth.logAction(adminId, 'create', 'quest_template', questId, null, questData);

            logger.info('퀘스트 템플릿 생성', {
                adminId,
                questId,
                name: questData.name,
                category: questData.category
            });

            return await this.getQuestTemplate(questId);
        } catch (error) {
            logger.error('퀘스트 템플릿 생성 실패:', error);
            throw error;
        }
    }

    // 퀘스트 템플릿 조회
    static async getQuestTemplate(questId) {
        const quest = await DatabaseManager.get(`
            SELECT * FROM quest_templates WHERE id = ?
        `, [questId]);

        if (!quest) {
            throw new Error('퀘스트를 찾을 수 없습니다');
        }

        // JSON 필드 파싱
        quest.prerequisites = JSON.parse(quest.prerequisites || '[]');
        quest.objectives = JSON.parse(quest.objectives || '[]');
        quest.rewards = JSON.parse(quest.rewards || '[]');

        return quest;
    }

    // 퀘스트 템플릿 목록 조회
    static async getQuestTemplates(filters = {}, pagination = {}) {
        const page = Math.max(1, parseInt(pagination.page) || 1);
        const limit = Math.min(100, Math.max(1, parseInt(pagination.limit) || 20));
        const offset = (page - 1) * limit;

        // WHERE 절 구성
        const whereConditions = ['1=1']; // 기본 조건
        const whereValues = [];

        if (filters.category) {
            whereConditions.push('category = ?');
            whereValues.push(filters.category);
        }

        if (filters.type) {
            whereConditions.push('type = ?');
            whereValues.push(filters.type);
        }

        if (filters.is_active !== undefined) {
            whereConditions.push('is_active = ?');
            whereValues.push(filters.is_active ? 1 : 0);
        }

        if (filters.level_min) {
            whereConditions.push('level_requirement >= ?');
            whereValues.push(parseInt(filters.level_min));
        }

        if (filters.level_max) {
            whereConditions.push('level_requirement <= ?');
            whereValues.push(parseInt(filters.level_max));
        }

        if (filters.search) {
            whereConditions.push('(name LIKE ? OR description LIKE ?)');
            whereValues.push(`%${filters.search}%`, `%${filters.search}%`);
        }

        const whereClause = `WHERE ${whereConditions.join(' AND ')}`;

        // 데이터 조회
        const quests = await DatabaseManager.all(`
            SELECT 
                id, name, description, category, type, level_requirement,
                required_license, is_active, repeatable, sort_order,
                created_at, updated_at
            FROM quest_templates 
            ${whereClause}
            ORDER BY sort_order, created_at DESC 
            LIMIT ? OFFSET ?
        `, [...whereValues, limit, offset]);

        // 총 개수 조회
        const countResult = await DatabaseManager.get(`
            SELECT COUNT(*) as total FROM quest_templates ${whereClause}
        `, whereValues);

        return {
            quests,
            pagination: {
                page,
                limit,
                total: countResult.total,
                pages: Math.ceil(countResult.total / limit)
            }
        };
    }

    // 퀘스트 통계 조회
    static async getQuestStatistics(questId) {
        const [
            attemptStats,
            completionStats,
            timeStats,
            recentActivity
        ] = await Promise.all([
            DatabaseManager.get(`
                SELECT 
                    COUNT(DISTINCT player_id) as total_players_attempted,
                    COUNT(*) as total_attempts,
                    COUNT(CASE WHEN status = 'completed' THEN 1 END) as completed_count,
                    COUNT(CASE WHEN status = 'active' THEN 1 END) as active_count,
                    COUNT(CASE WHEN status = 'failed' THEN 1 END) as failed_count,
                    COUNT(CASE WHEN status = 'abandoned' THEN 1 END) as abandoned_count
                FROM player_quests 
                WHERE quest_template_id = ?
            `, [questId]),

            DatabaseManager.all(`
                SELECT 
                    DATE(completed_at) as completion_date,
                    COUNT(*) as completions
                FROM player_quests 
                WHERE quest_template_id = ? AND status = 'completed'
                AND completed_at >= date('now', '-30 days')
                GROUP BY DATE(completed_at)
                ORDER BY completion_date DESC
            `, [questId]),

            DatabaseManager.get(`
                SELECT 
                    AVG(CASE WHEN completed_at IS NOT NULL 
                        THEN (julianday(completed_at) - julianday(started_at)) * 24 * 60 
                    END) as avg_completion_minutes,
                    MIN(CASE WHEN completed_at IS NOT NULL 
                        THEN (julianday(completed_at) - julianday(started_at)) * 24 * 60 
                    END) as min_completion_minutes,
                    MAX(CASE WHEN completed_at IS NOT NULL 
                        THEN (julianday(completed_at) - julianday(started_at)) * 24 * 60 
                    END) as max_completion_minutes
                FROM player_quests 
                WHERE quest_template_id = ? AND status = 'completed'
            `, [questId]),

            DatabaseManager.all(`
                SELECT 
                    p.name as player_name,
                    pq.status,
                    pq.started_at,
                    pq.completed_at,
                    pq.progress
                FROM player_quests pq
                JOIN players p ON p.id = pq.player_id
                WHERE pq.quest_template_id = ?
                ORDER BY pq.started_at DESC
                LIMIT 10
            `, [questId])
        ]);

        const completionRate = attemptStats.total_players_attempted > 0 
            ? Math.round((attemptStats.completed_count / attemptStats.total_players_attempted) * 100)
            : 0;

        return {
            attempts: attemptStats,
            completion: {
                rate: completionRate,
                dailyHistory: completionStats
            },
            timing: {
                averageMinutes: Math.round(timeStats.avg_completion_minutes || 0),
                fastestMinutes: Math.round(timeStats.min_completion_minutes || 0),
                slowestMinutes: Math.round(timeStats.max_completion_minutes || 0)
            },
            recentActivity: recentActivity.map(activity => ({
                ...activity,
                progress: JSON.parse(activity.progress || '{}')
            }))
        };
    }

    // 플레이어별 퀘스트 진행상황 조회
    static async getPlayerQuestProgress(playerId, questId = null) {
        let query = `
            SELECT 
                pq.*,
                qt.name as quest_name,
                qt.description as quest_description,
                qt.category,
                qt.type,
                qt.objectives,
                qt.rewards
            FROM player_quests pq
            JOIN quest_templates qt ON qt.id = pq.quest_template_id
            WHERE pq.player_id = ?
        `;
        
        const params = [playerId];
        
        if (questId) {
            query += ' AND pq.quest_template_id = ?';
            params.push(questId);
        }
        
        query += ' ORDER BY pq.started_at DESC';
        
        const results = await DatabaseManager.all(query, params);
        
        return results.map(result => ({
            ...result,
            objectives: JSON.parse(result.objectives || '[]'),
            rewards: JSON.parse(result.rewards || '[]'),
            progress: JSON.parse(result.progress || '{}')
        }));
    }

    // 퀘스트 할당 (플레이어에게 퀘스트 제공)
    static async assignQuestToPlayer(questId, playerId, adminId) {
        try {
            const quest = await this.getQuestTemplate(questId);
            
            // 이미 진행 중이거나 완료한 퀘스트인지 확인
            const existingQuest = await DatabaseManager.get(`
                SELECT id, status FROM player_quests 
                WHERE player_id = ? AND quest_template_id = ?
                ORDER BY started_at DESC
                LIMIT 1
            `, [playerId, questId]);

            if (existingQuest && existingQuest.status === 'active') {
                throw new Error('이미 진행 중인 퀘스트입니다');
            }

            if (existingQuest && existingQuest.status === 'completed' && !quest.repeatable) {
                throw new Error('반복 불가능한 퀘스트를 이미 완료했습니다');
            }

            // 플레이어 레벨 및 라이센스 확인
            const player = await DatabaseManager.get(`
                SELECT level, current_license FROM players WHERE id = ?
            `, [playerId]);

            if (!player) {
                throw new Error('플레이어를 찾을 수 없습니다');
            }

            if (player.level < quest.level_requirement) {
                throw new Error(`레벨 ${quest.level_requirement} 이상이어야 합니다`);
            }

            if (player.current_license < quest.required_license) {
                throw new Error(`라이센스 레벨 ${quest.required_license} 이상이어야 합니다`);
            }

            // 퀘스트 할당
            const playerQuestId = require('crypto').randomUUID();
            const expiresAt = quest.time_limit 
                ? new Date(Date.now() + quest.time_limit * 1000).toISOString()
                : null;

            await DatabaseManager.run(`
                INSERT INTO player_quests (
                    id, player_id, quest_template_id, status, progress,
                    started_at, expires_at
                ) VALUES (?, ?, ?, 'active', '{}', CURRENT_TIMESTAMP, ?)
            `, [playerQuestId, playerId, questId, expiresAt]);

            // 액션 로그 기록
            await AdminAuth.logAction(adminId, 'assign_quest', 'player_quest', playerQuestId, null, {
                questId,
                playerId,
                questName: quest.name
            });

            logger.info('퀘스트 할당', {
                adminId,
                questId,
                playerId,
                questName: quest.name
            });

            return { playerQuestId, message: '퀘스트가 할당되었습니다' };
        } catch (error) {
            logger.error('퀘스트 할당 실패:', error);
            throw error;
        }
    }

    // 퀘스트 데이터 검증
    static async validateQuestData(questData) {
        if (!questData.name || questData.name.trim().length < 2) {
            throw new Error('퀘스트 이름은 2자 이상이어야 합니다');
        }

        if (!questData.description || questData.description.trim().length < 10) {
            throw new Error('퀘스트 설명은 10자 이상이어야 합니다');
        }

        const categories = Object.keys(this.getQuestCategories());
        if (!categories.includes(questData.category)) {
            throw new Error(`유효하지 않은 카테고리입니다: ${questData.category}`);
        }

        const types = Object.keys(this.getQuestTypes());
        if (!types.includes(questData.type)) {
            throw new Error(`유효하지 않은 타입입니다: ${questData.type}`);
        }

        if (!questData.objectives || !Array.isArray(questData.objectives) || questData.objectives.length === 0) {
            throw new Error('최소 하나의 목표가 필요합니다');
        }

        if (!questData.rewards || !Array.isArray(questData.rewards) || questData.rewards.length === 0) {
            throw new Error('최소 하나의 보상이 필요합니다');
        }

        // 선행 퀘스트 검증
        if (questData.prerequisites && questData.prerequisites.length > 0) {
            for (const prereqId of questData.prerequisites) {
                const prereq = await DatabaseManager.get(`
                    SELECT id FROM quest_templates WHERE id = ? AND is_active = 1
                `, [prereqId]);
                
                if (!prereq) {
                    throw new Error(`유효하지 않은 선행 퀘스트 ID: ${prereqId}`);
                }
            }
        }

        return true;
    }

    // 퀘스트 빌더용 도구들
    static getObjectiveBuilder() {
        return {
            generateObjective: (type, params) => {
                const types = this.getQuestTypes();
                if (!types[type]) {
                    throw new Error(`Unknown objective type: ${type}`);
                }

                return {
                    type,
                    description: this.generateObjectiveDescription(type, params),
                    ...types[type].objectiveTemplate,
                    ...params
                };
            },

            generateObjectiveDescription: (type, params) => {
                const descriptions = {
                    collect: `${params.item_name || '아이템'} ${params.quantity || 1}개 수집`,
                    trade: `${params.merchant_name || '상인'}과 ${params.trade_count || 1}회 거래`,
                    visit: `지정된 장소 방문`,
                    level: `레벨 ${params.target_level || 1} 달성`,
                    skill: `${params.skill_name || '스킬'} ${params.usage_count || 1}회 사용`,
                    social: `${params.interaction_type || '상호작용'} ${params.target_count || 1}회 완료`
                };

                return descriptions[type] || '목표 완료';
            }
        };
    }

    static getRewardBuilder() {
        return {
            generateReward: (type, amount, itemId = null) => {
                const types = this.getRewardTypes();
                if (!types[type]) {
                    throw new Error(`Unknown reward type: ${type}`);
                }

                const reward = {
                    type,
                    amount,
                    description: `${types[type].label} ${amount}${types[type].unit}`
                };

                if (type === 'items' && itemId) {
                    reward.item_id = itemId;
                }

                return reward;
            }
        };
    }

    // 최근 퀘스트 활동 조회
    static async getRecentQuestActivity(limit = 20) {
        try {
            const activities = await DatabaseManager.all(`
                SELECT 
                    pq.started_at as created_at,
                    pq.status,
                    'assigned' as activity_type,
                    qt.name as quest_title,
                    p.name as player_name
                FROM player_quests pq
                JOIN quest_templates qt ON pq.quest_template_id = qt.id
                JOIN players p ON pq.player_id = p.id
                ORDER BY pq.started_at DESC
                LIMIT ?
            `, [limit]);

            return activities;
        } catch (error) {
            logger.error('최근 퀘스트 활동 조회 실패:', error);
            return [];
        }
    }

    // 활성 퀘스트 조회
    static async getActiveQuests(limit = 10) {
        try {
            const quests = await DatabaseManager.all(`
                SELECT 
                    qt.*,
                    COUNT(CASE WHEN pq.status = 'active' THEN 1 END) as inProgress,
                    COUNT(CASE WHEN pq.status = 'completed' THEN 1 END) as completed,
                    COUNT(pq.id) as assigned
                FROM quest_templates qt
                LEFT JOIN player_quests pq ON qt.id = pq.quest_template_id
                WHERE qt.is_active = 1
                GROUP BY qt.id
                ORDER BY assigned DESC, qt.created_at DESC
                LIMIT ?
            `, [limit]);

            return quests;
        } catch (error) {
            logger.error('활성 퀘스트 조회 실패:', error);
            return [];
        }
    }

    // 카테고리별 통계
    static async getCategoryStatistics() {
        try {
            const stats = await DatabaseManager.all(`
                SELECT 
                    category,
                    COUNT(*) as count
                FROM quest_templates
                WHERE is_active = 1
                GROUP BY category
                ORDER BY count DESC
            `);

            return stats;
        } catch (error) {
            logger.error('카테고리별 통계 조회 실패:', error);
            return [];
        }
    }

    // 완료율 통계
    static async getCompletionStatistics(limit = 10) {
        try {
            const stats = await DatabaseManager.all(`
                SELECT 
                    qt.name as quest_title,
                    COUNT(pq.id) as assigned,
                    COUNT(CASE WHEN pq.status = 'completed' THEN 1 END) as completed,
                    ROUND(
                        CAST(COUNT(CASE WHEN pq.status = 'completed' THEN 1 END) AS FLOAT) / 
                        NULLIF(COUNT(pq.id), 0) * 100, 2
                    ) as completion_rate
                FROM quest_templates qt
                LEFT JOIN player_quests pq ON qt.id = pq.quest_template_id
                WHERE qt.is_active = 1
                GROUP BY qt.id, qt.name
                HAVING assigned > 0
                ORDER BY completion_rate DESC
                LIMIT ?
            `, [limit]);

            return stats;
        } catch (error) {
            logger.error('완료율 통계 조회 실패:', error);
            return [];
        }
    }

    // 관리자 액션 로깅
    static async logAdminAction(adminId, action, details) {
        try {
            await DatabaseManager.run(`
                INSERT INTO admin_action_logs (
                    id, admin_id, action, target_type, details, ip_address
                ) VALUES (?, ?, ?, ?, ?, ?)
            `, [
                uuidv4(),
                adminId || 'system',
                action,
                'quest',
                JSON.stringify(details),
                '127.0.0.1' // TODO: 실제 IP 주소 가져오기
            ]);
        } catch (error) {
            logger.error('관리자 액션 로깅 실패:', error);
        }
    }
}

module.exports = QuestService;