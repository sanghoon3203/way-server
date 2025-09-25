// 📁 src/routes/api/skills.js - 스킬 시스템 API
const express = require('express');
const { authenticateToken } = require('../../middleware/auth');
const DatabaseManager = require('../../database/DatabaseManager');
const logger = require('../../config/logger');
const { randomUUID } = require('crypto');

const router = express.Router();
router.use(authenticateToken);

/**
 * 스킬 트리 조회 (템플릿 기반)
 * GET /api/skills/tree
 */
router.get('/tree', async (req, res) => {
    try {
        const playerId = req.user.playerId;

        // 플레이어 정보 조회
        const player = await DatabaseManager.get(`
            SELECT skill_points, level FROM players WHERE id = ?
        `, [playerId]);

        // 스킬 템플릿 조회
        const skillTemplates = await DatabaseManager.all(`
            SELECT * FROM skill_templates WHERE is_active = 1 ORDER BY category, tier, sort_order
        `);

        // 플레이어의 현재 스킬 레벨 조회
        const playerSkills = await DatabaseManager.all(`
            SELECT skill_template_id, current_level FROM player_skills WHERE player_id = ?
        `, [playerId]);

        const playerSkillMap = {};
        playerSkills.forEach(skill => {
            playerSkillMap[skill.skill_template_id] = skill.current_level;
        });

        // 카테고리별로 스킬 그룹화
        const skillTree = {};
        
        skillTemplates.forEach(skill => {
            if (!skillTree[skill.category]) {
                skillTree[skill.category] = {
                    category: skill.category,
                    name: getCategoryName(skill.category),
                    skills: []
                };
            }

            const currentLevel = playerSkillMap[skill.id] || 0;
            const prerequisites = JSON.parse(skill.prerequisites || '[]');
            const unlockRequirements = JSON.parse(skill.unlock_requirements || '{}');
            const effects = JSON.parse(skill.effects || '{}');
            const costPerLevel = JSON.parse(skill.cost_per_level || '[]');

            // 선행 조건 확인
            let canUnlock = true;
            for (const prereqSkillName of prerequisites) {
                const prereqSkill = skillTemplates.find(s => s.name === prereqSkillName);
                if (prereqSkill) {
                    const prereqLevel = playerSkillMap[prereqSkill.id] || 0;
                    if (prereqLevel === 0) {
                        canUnlock = false;
                        break;
                    }
                }
            }

            // 현재 레벨에서 다음 레벨로 업그레이드하는 비용 계산
            let nextLevelCost = null;
            if (currentLevel < skill.max_level && costPerLevel[currentLevel]) {
                nextLevelCost = costPerLevel[currentLevel];
            }

            skillTree[skill.category].skills.push({
                id: skill.id,
                name: skill.name,
                description: skill.description,
                tier: skill.tier,
                currentLevel,
                maxLevel: skill.max_level,
                canUnlock,
                isUnlocked: currentLevel > 0,
                nextLevelCost,
                effects: formatSkillEffects(effects, currentLevel),
                nextLevelEffects: currentLevel < skill.max_level ? formatSkillEffects(effects, currentLevel + 1) : null,
                prerequisites,
                unlockRequirements
            });
        });

        res.json({
            success: true,
            data: {
                skillTree: Object.values(skillTree),
                availablePoints: player.skill_points,
                playerLevel: player.level
            }
        });

    } catch (error) {
        logger.error('스킬 트리 조회 실패:', error);
        res.status(500).json({
            success: false,
            error: '서버 오류가 발생했습니다'
        });
    }
});

/**
 * 플레이어의 스킬 상세 정보 조회
 * GET /api/skills/player
 */
router.get('/player', async (req, res) => {
    try {
        const playerId = req.user.playerId;

        const playerSkills = await DatabaseManager.all(`
            SELECT 
                ps.*,
                st.name,
                st.description,
                st.category,
                st.tier,
                st.max_level,
                st.effects
            FROM player_skills ps
            JOIN skill_templates st ON ps.skill_template_id = st.id
            WHERE ps.player_id = ?
            ORDER BY st.category, st.tier
        `, [playerId]);

        const formattedSkills = playerSkills.map(skill => ({
            id: skill.id,
            skillId: skill.skill_template_id,
            name: skill.name,
            description: skill.description,
            category: skill.category,
            tier: skill.tier,
            currentLevel: skill.current_level,
            maxLevel: skill.max_level,
            experience: skill.experience,
            effects: formatSkillEffects(JSON.parse(skill.effects || '{}'), skill.current_level),
            learnedAt: skill.learned_at,
            lastUsed: skill.last_used
        }));

        res.json({
            success: true,
            data: {
                skills: formattedSkills,
                totalSkills: formattedSkills.length
            }
        });

    } catch (error) {
        logger.error('플레이어 스킬 조회 실패:', error);
        res.status(500).json({
            success: false,
            error: '서버 오류가 발생했습니다'
        });
    }
});

/**
 * 스킬 학습/업그레이드
 * POST /api/skills/:skillId/upgrade
 */
router.post('/:skillId/upgrade', async (req, res) => {
    try {
        const playerId = req.user.playerId;
        const skillId = req.params.skillId;

        // 스킬 템플릿 확인
        const skillTemplate = await DatabaseManager.get(`
            SELECT * FROM skill_templates WHERE id = ? AND is_active = 1
        `, [skillId]);

        if (!skillTemplate) {
            return res.status(404).json({
                success: false,
                error: '스킬을 찾을 수 없습니다'
            });
        }

        // 플레이어 정보 확인
        const player = await DatabaseManager.get(`
            SELECT skill_points, level FROM players WHERE id = ?
        `, [playerId]);

        // 현재 스킬 레벨 확인
        let playerSkill = await DatabaseManager.get(`
            SELECT * FROM player_skills WHERE player_id = ? AND skill_template_id = ?
        `, [playerId, skillId]);

        const currentLevel = playerSkill ? playerSkill.current_level : 0;
        
        if (currentLevel >= skillTemplate.max_level) {
            return res.status(400).json({
                success: false,
                error: '스킬이 이미 최대 레벨입니다'
            });
        }

        // 비용 계산
        const costPerLevel = JSON.parse(skillTemplate.cost_per_level || '[]');
        const upgradeCost = costPerLevel[currentLevel];
        
        if (!upgradeCost || player.skill_points < upgradeCost.skill_points) {
            return res.status(400).json({
                success: false,
                error: '스킬 포인트가 부족합니다'
            });
        }

        // 선행 조건 확인
        const prerequisites = JSON.parse(skillTemplate.prerequisites || '[]');
        for (const prereqSkillName of prerequisites) {
            const prereqSkill = await DatabaseManager.get(`
                SELECT id FROM skill_templates WHERE name = ?
            `, [prereqSkillName]);
            
            if (prereqSkill) {
                const prereqPlayerSkill = await DatabaseManager.get(`
                    SELECT current_level FROM player_skills WHERE player_id = ? AND skill_template_id = ?
                `, [playerId, prereqSkill.id]);
                
                if (!prereqPlayerSkill || prereqPlayerSkill.current_level === 0) {
                    return res.status(400).json({
                        success: false,
                        error: `선행 스킬 '${prereqSkillName}'이 필요합니다`
                    });
                }
            }
        }

        // 스킬 업그레이드 실행
        await DatabaseManager.run('BEGIN TRANSACTION');

        try {
            // 스킬 포인트 차감
            await DatabaseManager.run(`
                UPDATE players SET skill_points = skill_points - ? WHERE id = ?
            `, [upgradeCost.skill_points, playerId]);

            if (playerSkill) {
                // 기존 스킬 레벨업
                await DatabaseManager.run(`
                    UPDATE player_skills 
                    SET current_level = current_level + 1, last_upgraded = CURRENT_TIMESTAMP 
                    WHERE id = ?
                `, [playerSkill.id]);
            } else {
                // 새 스킬 학습
                await DatabaseManager.run(`
                    INSERT INTO player_skills (
                        id, player_id, skill_template_id, current_level, experience, learned_at, last_upgraded
                    ) VALUES (?, ?, ?, 1, 0, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
                `, [randomUUID(), playerId, skillId]);
            }

            await DatabaseManager.run('COMMIT');

            logger.info(`스킬 업그레이드: 플레이어 ${playerId}, 스킬 ${skillTemplate.name} (레벨 ${currentLevel + 1})`);

            res.json({
                success: true,
                data: {
                    message: '스킬이 업그레이드되었습니다',
                    newLevel: currentLevel + 1,
                    skillPointsUsed: upgradeCost.skill_points
                }
            });

        } catch (error) {
            await DatabaseManager.run('ROLLBACK');
            throw error;
        }

    } catch (error) {
        logger.error('스킬 업그레이드 실패:', error);
        res.status(500).json({
            success: false,
            error: '서버 오류가 발생했습니다'
        });
    }
});

/**
 * 스킬 사용 로그 기록
 * POST /api/skills/use
 */
router.post('/use', async (req, res) => {
    try {
        const playerId = req.user.playerId;
        const { skillId, context } = req.body;

        // 플레이어가 해당 스킬을 보유하고 있는지 확인
        const playerSkill = await DatabaseManager.get(`
            SELECT ps.*, st.name FROM player_skills ps
            JOIN skill_templates st ON ps.skill_template_id = st.id
            WHERE ps.player_id = ? AND ps.skill_template_id = ?
        `, [playerId, skillId]);

        if (!playerSkill) {
            return res.status(404).json({
                success: false,
                error: '보유하지 않은 스킬입니다'
            });
        }

        // 스킬 사용 로그 기록
        await DatabaseManager.run(`
            INSERT INTO skill_usage_logs (
                id, player_id, skill_template_id, skill_level, context, used_at
            ) VALUES (?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
        `, [randomUUID(), playerId, skillId, playerSkill.current_level, JSON.stringify(context || {})]);

        // 스킬 마지막 사용 시간 업데이트
        await DatabaseManager.run(`
            UPDATE player_skills SET last_used = CURRENT_TIMESTAMP WHERE id = ?
        `, [playerSkill.id]);

        res.json({
            success: true,
            data: {
                message: '스킬 사용이 기록되었습니다',
                skillName: playerSkill.name,
                skillLevel: playerSkill.current_level
            }
        });

    } catch (error) {
        logger.error('스킬 사용 기록 실패:', error);
        res.status(500).json({
            success: false,
            error: '서버 오류가 발생했습니다'
        });
    }
});

/**
 * 헬퍼 함수들
 */
function getCategoryName(category) {
    const categoryNames = {
        'trading': '거래',
        'social': '관계',
        'storage': '보관',
        'negotiation': '협상',
        'analysis': '분석',
        'appraisal': '감정',
        'specialization': '전문화'
    };
    return categoryNames[category] || category;
}

function formatSkillEffects(effects, level) {
    const formattedEffects = [];
    
    for (const [effectName, effectData] of Object.entries(effects)) {
        if (effectData.base !== undefined && effectData.perLevel !== undefined) {
            const value = effectData.base + (effectData.perLevel * level);
            formattedEffects.push({
                name: effectName,
                value: value,
                description: `${getEffectDisplayName(effectName)}: ${value}${getEffectUnit(effectName)}`
            });
        }
    }
    
    return formattedEffects;
}

function getEffectDisplayName(effectName) {
    const displayNames = {
        'trade_success_rate': '거래 성공률',
        'negotiation_bonus': '협상 보너스',
        'price_accuracy': '가격 정확도',
        'hidden_info_chance': '숨겨진 정보 확률',
        'price_discount': '가격 할인',
        'merchant_friendship_bonus': '상인 우정도 보너스',
        'market_prediction': '시장 예측',
        'trend_detection': '트렌드 감지',
        'inventory_slots': '인벤토리 슬롯',
        'weight_capacity': '무게 용량',
        'storage_efficiency': '보관 효율성',
        'fragile_protection': '파손 방지',
        'relationship_gain': '관계도 증가',
        'introduction_bonus': '소개 보너스',
        'trust_gain_multiplier': '신뢰도 배율',
        'reputation_bonus': '평판 보너스',
        'antique_bonus': '골동품 보너스',
        'authenticity_detection': '진품 감별',
        'electronics_bonus': '전자제품 보너스',
        'tech_trend_prediction': '기술 트렌드 예측'
    };
    return displayNames[effectName] || effectName;
}

function getEffectUnit(effectName) {
    const units = {
        'trade_success_rate': '%',
        'negotiation_bonus': '%',
        'price_accuracy': '%',
        'hidden_info_chance': '%',
        'price_discount': '%',
        'merchant_friendship_bonus': '%',
        'market_prediction': '%',
        'trend_detection': '단계',
        'inventory_slots': '개',
        'weight_capacity': 'kg',
        'storage_efficiency': '%',
        'fragile_protection': '%',
        'relationship_gain': '%',
        'introduction_bonus': '회',
        'trust_gain_multiplier': 'x',
        'reputation_bonus': '점',
        'antique_bonus': '%',
        'authenticity_detection': '%',
        'electronics_bonus': '%',
        'tech_trend_prediction': '%'
    };
    return units[effectName] || '';
}

module.exports = router;