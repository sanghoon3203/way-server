// 📁 src/services/merchantChatService.js
// AI 상인 채팅 서비스 — Gemini API 연동
// 캐릭터 인격(merchantPersonas) 기반 시스템 프롬프트 생성 + 언락 트리거 처리

const { GoogleGenerativeAI } = require('@google/generative-ai');
const merchantPersonas = require('../constants/merchantPersonas');
const logger = require('../config/logger');

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

/**
 * 히스토리를 Gemini API 형식으로 변환
 * @param {Array} history - [{role: 'user'|'model', text: string}]
 */
function buildGeminiHistory(history) {
    return history.map(({ role, text }) => ({
        role: role === 'user' ? 'user' : 'model',
        parts: [{ text }]
    }));
}

/**
 * 언락 트리거 체크 — 사용자 메시지에 키워드 포함 여부
 * @param {string} message - 사용자 메시지
 * @param {Array} triggers - persona.unlockTriggers
 * @returns {object|null} - 언락 에피소드 또는 null
 */
function checkUnlockTriggers(message, triggers) {
    if (!triggers || triggers.length === 0) return null;

    for (const trigger of triggers) {
        const hit = trigger.keywords.some(kw => message.includes(kw));
        if (hit) {
            return {
                episode_id: trigger.episodeId,
                title: trigger.episodeTitle,
                entry_node: trigger.entryNode,
                unlock_requirements: []
            };
        }
    }
    return null;
}

/**
 * 상인 AI 채팅 처리
 * @param {string} merchantId - 상인 ID (e.g. 'seoyena')
 * @param {string} userMessage - 사용자 메시지
 * @param {Array} history - 이전 대화 히스토리
 * @param {object} playerContext - { level, completedEpisodes, relationshipLevel }
 * @returns {{ reply: string, unlockedEpisode: object|null }}
 */
async function sendMerchantChat(merchantId, userMessage, history = [], playerContext = {}) {
    const persona = merchantPersonas[merchantId];
    if (!persona) {
        throw new Error(`알 수 없는 상인: ${merchantId}`);
    }

    // 시스템 프롬프트 구성
    const systemInstruction = buildSystemPrompt(persona, playerContext);

    // 언락 트리거 체크 (Gemini 호출 전에 미리 확인)
    const unlockedEpisode = checkUnlockTriggers(userMessage, persona.unlockTriggers);

    try {
        const model = genAI.getGenerativeModel({
            model: 'gemini-1.5-flash',
            systemInstruction,
            generationConfig: {
                maxOutputTokens: 300,
                temperature: 0.85,
                topP: 0.9
            }
        });

        const chat = model.startChat({
            history: buildGeminiHistory(history)
        });

        const result = await chat.sendMessage(userMessage);
        const reply = result.response.text().trim();

        logger.info(`[MerchantChat] ${merchantId} → reply (${reply.length}자), unlock: ${unlockedEpisode?.episode_id ?? 'none'}`);

        return { reply, unlockedEpisode };
    } catch (error) {
        logger.error(`[MerchantChat] Gemini API 오류: ${error.message}`);
        throw error;
    }
}

/**
 * 시스템 프롬프트 빌더
 */
function buildSystemPrompt(persona, playerContext) {
    const {
        level = 1,
        completedEpisodes = [],
        relationshipLevel = 0
    } = playerContext;

    const episodeList = completedEpisodes.length > 0
        ? completedEpisodes.join(', ')
        : '없음';

    return `${persona.basePrompt}

[현재 게임 상태]
플레이어 레벨: ${level}
완료된 에피소드: ${episodeList}
현재 관계도: ${relationshipLevel}/100

[응답 규칙]
- 반드시 한국어로만 응답
- 네오 서울(2030년대) 게임 세계관 내에서만 이야기
- 자신이 AI임을 절대 언급하지 않음
- 응답은 2~4문장, 간결하게
- 캐릭터 고유 말투와 성격을 일관되게 유지`;
}

module.exports = { sendMerchantChat };
