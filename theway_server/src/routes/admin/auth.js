// 📁 src/routes/admin/auth.js - 어드민 인증 라우트
const express = require('express');
const { AdminAuth, ADMIN_ROLES } = require('../../middleware/adminAuth');
const logger = require('../../config/logger');

const router = express.Router();

/**
 * 어드민 로그인 페이지
 * GET /admin/auth/login
 */
router.get('/login', (req, res) => {
    res.send(`
        <!DOCTYPE html>
        <html>
        <head>
            <title>어드민 로그인 - Way Game</title>
            <style>
                body { 
                    font-family: Arial, sans-serif; 
                    background-color: #f5f5f5;
                    display: flex;
                    justify-content: center;
                    align-items: center;
                    height: 100vh;
                    margin: 0;
                }
                .login-form {
                    background: white;
                    padding: 40px;
                    border-radius: 8px;
                    box-shadow: 0 2px 10px rgba(0,0,0,0.1);
                    width: 300px;
                }
                .form-group {
                    margin-bottom: 20px;
                }
                label {
                    display: block;
                    margin-bottom: 5px;
                    font-weight: bold;
                    color: #333;
                }
                input[type="text"], input[type="password"] {
                    width: 100%;
                    padding: 10px;
                    border: 1px solid #ddd;
                    border-radius: 4px;
                    box-sizing: border-box;
                }
                button {
                    width: 100%;
                    padding: 12px;
                    background-color: #007bff;
                    color: white;
                    border: none;
                    border-radius: 4px;
                    font-size: 16px;
                    cursor: pointer;
                }
                button:hover {
                    background-color: #0056b3;
                }
                .title {
                    text-align: center;
                    margin-bottom: 30px;
                    color: #333;
                }
                .error {
                    color: red;
                    margin-bottom: 15px;
                    text-align: center;
                }
            </style>
        </head>
        <body>
            <div class="login-form">
                <h2 class="title">🎮 Way Game Admin</h2>
                <div id="error" class="error" style="display: none;"></div>
                
                <form id="loginForm">
                    <div class="form-group">
                        <label for="username">사용자명:</label>
                        <input type="text" id="username" name="username" required>
                    </div>
                    
                    <div class="form-group">
                        <label for="password">비밀번호:</label>
                        <input type="password" id="password" name="password" required>
                    </div>
                    
                    <button type="submit">로그인</button>
                </form>
            </div>

            <script>
                document.getElementById('loginForm').addEventListener('submit', async (e) => {
                    e.preventDefault();
                    
                    const username = document.getElementById('username').value;
                    const password = document.getElementById('password').value;
                    
                    try {
                        const response = await fetch('/admin/auth/login', {
                            method: 'POST',
                            headers: {
                                'Content-Type': 'application/json',
                            },
                            body: JSON.stringify({ username, password })
                        });
                        
                        const result = await response.json();
                        
                        if (result.success) {
                            // 토큰 저장
                            localStorage.setItem('adminToken', result.data.token);
                            // 대시보드로 리다이렉트
                            window.location.href = '/admin';
                        } else {
                            document.getElementById('error').style.display = 'block';
                            document.getElementById('error').textContent = result.error;
                        }
                    } catch (error) {
                        document.getElementById('error').style.display = 'block';
                        document.getElementById('error').textContent = '로그인 요청 중 오류가 발생했습니다.';
                    }
                });
            </script>
        </body>
        </html>
    `);
});

/**
 * 어드민 로그인 처리
 * POST /admin/auth/login
 */
router.post('/login', async (req, res) => {
    try {
        const { username, password } = req.body;
        
        if (!username || !password) {
            return res.status(400).json({
                success: false,
                error: '사용자명과 비밀번호를 입력해주세요'
            });
        }
        
        const loginResult = await AdminAuth.login(username, password);
        
        // 로그인 성공 로그
        await AdminAuth.logAction(
            loginResult.admin.id,
            'login',
            'admin_auth',
            loginResult.admin.id,
            null,
            { success: true, loginTime: new Date() },
            req
        );
        
        res.json({
            success: true,
            message: '로그인 성공',
            data: loginResult
        });
        
    } catch (error) {
        logger.error('어드민 로그인 실패:', { body: req.body, error: error.message });
        
        res.status(401).json({
            success: false,
            error: error.message
        });
    }
});

/**
 * 어드민 로그아웃
 * POST /admin/auth/logout
 */
router.post('/logout', AdminAuth.authenticateToken, async (req, res) => {
    try {
        // 로그아웃 로그 기록
        await AdminAuth.logAction(
            req.admin.adminId,
            'logout',
            'admin_auth',
            req.admin.adminId,
            null,
            { logoutTime: new Date() },
            req
        );
        
        res.json({
            success: true,
            message: '로그아웃 되었습니다'
        });
        
    } catch (error) {
        logger.error('어드민 로그아웃 실패:', error);
        res.status(500).json({
            success: false,
            error: '로그아웃 처리 중 오류가 발생했습니다'
        });
    }
});

/**
 * 현재 어드민 정보 조회
 * GET /admin/auth/me
 */
router.get('/me', AdminAuth.authenticateToken, (req, res) => {
    res.json({
        success: true,
        data: {
            id: req.admin.adminId,
            username: req.admin.username,
            role: req.admin.role,
            permissions: req.admin.permissions
        }
    });
});

/**
 * 새 어드민 사용자 생성 (슈퍼 어드민만 가능)
 * POST /admin/auth/create
 */
router.post('/create', 
    AdminAuth.authenticateToken,
    AdminAuth.requirePermission('admin.create'),
    async (req, res) => {
        try {
            const { username, email, password, role } = req.body;
            
            if (!username || !email || !password) {
                return res.status(400).json({
                    success: false,
                    error: '모든 필드를 입력해주세요'
                });
            }
            
            const newAdmin = await AdminAuth.createAdmin(req.admin.adminId, {
                username,
                email,
                password,
                role: role || ADMIN_ROLES.MODERATOR
            });
            
            // 생성 로그 기록
            await AdminAuth.logAction(
                req.admin.adminId,
                'create',
                'admin_user',
                newAdmin.adminId,
                null,
                { username, email, role: newAdmin.role },
                req
            );
            
            res.status(201).json({
                success: true,
                message: '어드민 사용자가 생성되었습니다',
                data: newAdmin
            });
            
        } catch (error) {
            logger.error('어드민 사용자 생성 실패:', error);
            res.status(400).json({
                success: false,
                error: error.message
            });
        }
    }
);

module.exports = router;