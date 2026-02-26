// src/routes/api/story.js
const express = require('express');
const router = express.Router();
const db = require('../../database/DatabaseManager');
const { authenticateToken } = require('../../middleware/auth');
const logger = require('../../config/logger');

// GET /api/story/progress — 서버에서 진행도 fetch
router.get('/progress', authenticateToken, async (req, res) => {
    try {
        const row = await db.get(
            'SELECT * FROM player_story_progress WHERE player_id = ?',
            [req.user.playerId]
        );

        if (!row) {
            return res.json({
                success: true,
                data: {
                    completedChapters: [],
                    completedEpisodes: [],
                    completedSubQuests: [],
                    unlockedEpisodes: [],
                    keyItems: [],
                    lastSyncedAt: null
                }
            });
        }

        res.json({
            success: true,
            data: {
                completedChapters:   JSON.parse(row.completed_chapters),
                completedEpisodes:   JSON.parse(row.completed_episodes),
                completedSubQuests:  JSON.parse(row.completed_sub_quests),
                unlockedEpisodes:    JSON.parse(row.unlocked_episodes),
                keyItems:            JSON.parse(row.key_items),
                lastSyncedAt:        row.last_synced_at
            }
        });
    } catch (error) {
        logger.error('story progress fetch 오류:', error);
        res.status(500).json({ success: false, error: '서버 오류' });
    }
});

// POST /api/story/sync — 앱 → 서버 동기화
router.post('/sync', authenticateToken, async (req, res) => {
    try {
        const {
            completedChapters = [],
            completedEpisodes = [],
            completedSubQuests = [],
            unlockedEpisodes = [],
            keyItems = []
        } = req.body;

        const now = new Date().toISOString();

        await db.run(
            `INSERT INTO player_story_progress
               (player_id, completed_chapters, completed_episodes,
                completed_sub_quests, unlocked_episodes, key_items, last_synced_at)
             VALUES (?, ?, ?, ?, ?, ?, ?)
             ON CONFLICT(player_id) DO UPDATE SET
               completed_chapters   = excluded.completed_chapters,
               completed_episodes   = excluded.completed_episodes,
               completed_sub_quests = excluded.completed_sub_quests,
               unlocked_episodes    = excluded.unlocked_episodes,
               key_items            = excluded.key_items,
               last_synced_at       = excluded.last_synced_at`,
            [
                req.user.playerId,
                JSON.stringify(completedChapters),
                JSON.stringify(completedEpisodes),
                JSON.stringify(completedSubQuests),
                JSON.stringify(unlockedEpisodes),
                JSON.stringify(keyItems),
                now
            ]
        );

        res.json({ success: true, lastSyncedAt: now });
    } catch (error) {
        logger.error('story sync 오류:', error);
        res.status(500).json({ success: false, error: '서버 오류' });
    }
});

module.exports = router;
