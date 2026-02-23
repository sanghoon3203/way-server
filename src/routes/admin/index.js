// 📁 src/routes/admin/index.js
// connect:seoul 어드민 패널 — REST API + SPA 서빙

const express = require('express');
const path = require('path');
const router = express.Router();
const db = require('../../database/DatabaseManager'); // singleton dbManager
const logger = require('../../config/logger');

const ADMIN_SECRET = process.env.ADMIN_SECRET || 'admin1234';

// ─── 미들웨어: 인증 ────────────────────────────────────────────────────────
function requireAdmin(req, res, next) {
    const auth = req.headers['authorization'] || '';
    const token = auth.startsWith('Bearer ') ? auth.slice(7) : '';
    if (token !== ADMIN_SECRET) {
        return res.status(401).json({ error: '인증 필요' });
    }
    next();
}

// ─── SPA 서빙 ──────────────────────────────────────────────────────────────
router.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, '../../public/admin.html'));
});

// ─── 인증 ──────────────────────────────────────────────────────────────────
router.post('/api/auth', (req, res) => {
    const { password } = req.body;
    if (password === ADMIN_SECRET) {
        res.json({ ok: true, token: ADMIN_SECRET });
    } else {
        res.status(401).json({ error: '비밀번호가 틀렸습니다' });
    }
});

// ─── 대시보드 통계 ─────────────────────────────────────────────────────────
router.get('/api/stats', requireAdmin, async (req, res) => {
    try {
        const [players, trades, merchants, quests, recentPlayers] = await Promise.all([
            db.get('SELECT COUNT(*) as count FROM players'),
            db.get('SELECT COUNT(*) as count FROM trade_records'),
            db.get('SELECT COUNT(*) as count FROM merchants'),
            db.get('SELECT COUNT(*) as count FROM quests'),
            db.all(`SELECT p.name, p.level, p.money, u.created_at
                    FROM players p JOIN users u ON p.user_id = u.id
                    ORDER BY u.created_at DESC LIMIT 5`),
        ]);
        const recentTrades = await db.all(
            `SELECT tr.*, p.name as player_name, m.name as merchant_name
             FROM trade_records tr
             LEFT JOIN players p ON tr.player_id = p.id
             LEFT JOIN merchants m ON tr.merchant_id = m.id
             ORDER BY tr.created_at DESC LIMIT 5`
        );
        res.json({
            playerCount: players.count,
            tradeCount: trades.count,
            merchantCount: merchants.count,
            questCount: quests.count,
            recentPlayers,
            recentTrades,
        });
    } catch (e) {
        logger.error('[Admin] stats 오류:', e.message);
        res.status(500).json({ error: e.message });
    }
});

// ─── 플레이어 ──────────────────────────────────────────────────────────────
router.get('/api/players', requireAdmin, async (req, res) => {
    try {
        const { search = '', page = 1, limit = 20 } = req.query;
        const offset = (page - 1) * limit;
        const like = `%${search}%`;
        const [rows, total] = await Promise.all([
            db.all(
                `SELECT p.id, p.name, p.level, p.money, p.current_license,
                        u.email, u.is_active, u.created_at, p.last_active
                 FROM players p JOIN users u ON p.user_id = u.id
                 WHERE p.name LIKE ? OR u.email LIKE ?
                 ORDER BY u.created_at DESC LIMIT ? OFFSET ?`,
                [like, like, Number(limit), offset]
            ),
            db.get(
                `SELECT COUNT(*) as count FROM players p JOIN users u ON p.user_id = u.id
                 WHERE p.name LIKE ? OR u.email LIKE ?`,
                [like, like]
            ),
        ]);
        res.json({ players: rows, total: total.count, page: Number(page), limit: Number(limit) });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

router.get('/api/players/:id', requireAdmin, async (req, res) => {
    try {
        const player = await db.get(
            `SELECT p.*, u.email, u.is_active, u.created_at
             FROM players p JOIN users u ON p.user_id = u.id
             WHERE p.id = ?`, [req.params.id]
        );
        if (!player) return res.status(404).json({ error: '플레이어 없음' });
        const [items, quests] = await Promise.all([
            db.all(`SELECT pi.*, it.name, it.type FROM player_items pi
                    LEFT JOIN item_templates it ON pi.item_id = it.id
                    WHERE pi.player_id = ?`, [req.params.id]),
            db.all(`SELECT * FROM quests WHERE player_id = ? ORDER BY updated_at DESC LIMIT 20`, [req.params.id]),
        ]);
        res.json({ ...player, items, quests });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

router.put('/api/players/:id', requireAdmin, async (req, res) => {
    try {
        const { level, money, current_license, is_active } = req.body;
        await db.run(
            `UPDATE players SET level = ?, money = ?, current_license = ?, updated_at = CURRENT_TIMESTAMP
             WHERE id = ?`,
            [level, money, current_license, req.params.id]
        );
        if (is_active !== undefined) {
            await db.run(`UPDATE users SET is_active = ? WHERE id =
                (SELECT user_id FROM players WHERE id = ?)`, [is_active ? 1 : 0, req.params.id]);
        }
        res.json({ ok: true });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

router.delete('/api/players/:id', requireAdmin, async (req, res) => {
    try {
        const player = await db.get('SELECT user_id FROM players WHERE id = ?', [req.params.id]);
        if (!player) return res.status(404).json({ error: '플레이어 없음' });
        await db.run('DELETE FROM players WHERE id = ?', [req.params.id]);
        await db.run('DELETE FROM users WHERE id = ?', [player.user_id]);
        res.json({ ok: true });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

// ─── 상인 ──────────────────────────────────────────────────────────────────
router.get('/api/merchants', requireAdmin, async (req, res) => {
    try {
        const merchants = await db.all(`SELECT * FROM merchants ORDER BY name`);
        const result = await Promise.all(merchants.map(async (m) => {
            const inventory = await db.all(
                `SELECT mi.*, it.name, it.type, it.base_price FROM merchant_inventory mi
                 LEFT JOIN item_templates it ON mi.item_id = it.id
                 WHERE mi.merchant_id = ?`, [m.id]
            );
            return { ...m, inventory };
        }));
        res.json({ merchants: result });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

router.put('/api/merchants/:id', requireAdmin, async (req, res) => {
    try {
        const { name, title, latitude, longitude, is_active } = req.body;
        await db.run(
            `UPDATE merchants SET name = ?, title = ?, latitude = ?, longitude = ?,
             is_active = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
            [name, title, latitude, longitude, is_active ? 1 : 0, req.params.id]
        );
        res.json({ ok: true });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

// ─── 퀘스트 ────────────────────────────────────────────────────────────────
router.get('/api/quests', requireAdmin, async (req, res) => {
    try {
        const { page = 1, limit = 30 } = req.query;
        const offset = (page - 1) * limit;
        const [rows, total] = await Promise.all([
            db.all(`SELECT q.*, p.name as player_name FROM quests q
                    LEFT JOIN players p ON q.player_id = p.id
                    ORDER BY q.updated_at DESC LIMIT ? OFFSET ?`, [Number(limit), offset]),
            db.get('SELECT COUNT(*) as count FROM quests'),
        ]);
        res.json({ quests: rows, total: total.count });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

// ─── 거래 내역 ─────────────────────────────────────────────────────────────
router.get('/api/trades', requireAdmin, async (req, res) => {
    try {
        const { page = 1, limit = 30 } = req.query;
        const offset = (page - 1) * limit;
        const [rows, total] = await Promise.all([
            db.all(
                `SELECT tr.*, p.name as player_name, m.name as merchant_name
                 FROM trade_records tr
                 LEFT JOIN players p ON tr.player_id = p.id
                 LEFT JOIN merchants m ON tr.merchant_id = m.id
                 ORDER BY tr.created_at DESC LIMIT ? OFFSET ?`,
                [Number(limit), offset]
            ),
            db.get('SELECT COUNT(*) as count FROM trade_records'),
        ]);
        res.json({ trades: rows, total: total.count });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

// ─── 활동 로그 ─────────────────────────────────────────────────────────────
router.get('/api/logs', requireAdmin, async (req, res) => {
    try {
        const { page = 1, limit = 50 } = req.query;
        const offset = (page - 1) * limit;
        const [rows, total] = await Promise.all([
            db.all(
                `SELECT al.*, p.name as player_name FROM activity_logs al
                 LEFT JOIN players p ON al.player_id = p.id
                 ORDER BY al.created_at DESC LIMIT ? OFFSET ?`,
                [Number(limit), offset]
            ),
            db.get('SELECT COUNT(*) as count FROM activity_logs'),
        ]);
        res.json({ logs: rows, total: total.count });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

// ─── 서버 상태 ─────────────────────────────────────────────────────────────
router.get('/api/health', requireAdmin, (req, res) => {
    res.json({
        status: 'healthy',
        uptime: process.uptime(),
        memory: process.memoryUsage(),
        nodeVersion: process.version,
        timestamp: new Date().toISOString(),
    });
});

module.exports = router;
