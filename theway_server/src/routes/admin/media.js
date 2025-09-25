// 📁 src/routes/admin/media.js - 미디어 관리 전용 라우트
const express = require('express');
const MerchantMediaService = require('../../services/admin/MerchantMediaService');
const { uploadSingle } = require('../../middleware/uploadMiddleware');
const logger = require('../../config/logger');

const router = express.Router();

// 개발 환경에서는 인증 우회
// router.use(AdminAuth.authenticateToken);

/**
 * 미디어 관리 대시보드
 * GET /admin/media
 */
router.get('/', async (req, res) => {
    try {
        // 미디어 통계 조회
        const statistics = await MerchantMediaService.getMediaStatistics();

        // 최근 업로드된 미디어들 조회 (상인 정보 포함)
        const recentMedia = await require('../../database/DatabaseManager').all(`
            SELECT
                mm.*,
                m.name as merchant_name
            FROM merchant_media mm
            JOIN merchants m ON mm.merchant_id = m.id
            WHERE mm.is_active = 1
            ORDER BY mm.created_at DESC
            LIMIT 20
        `);

        const dashboardHTML = generateMediaDashboard(statistics, recentMedia);

        res.send(`
            <!DOCTYPE html>
            <html>
            <head>
                <title>미디어 관리 - Way Game Admin</title>
                <meta charset="utf-8">
                <meta name="viewport" content="width=device-width, initial-scale=1">
                ${getMediaDashboardStyles()}
            </head>
            <body>
                <nav class="navbar">
                    <div class="container">
                        <div>
                            <a href="/admin"><strong>Way Game Admin</strong></a>
                            <span> / 미디어 관리</span>
                        </div>
                        <div>
                            <a href="/admin">대시보드</a>
                            <a href="/admin/merchants">상인</a>
                            <a href="/admin/quests">퀘스트</a>
                            <a href="/admin/skills">스킬</a>
                            <a href="/admin/monitoring">모니터링</a>
                        </div>
                    </div>
                </nav>

                <div class="container">
                    <h1>🖼️ 미디어 관리 시스템</h1>

                    <div class="action-buttons">
                        <button onclick="initializeDirectories()" class="btn btn-primary">디렉토리 초기화</button>
                        <a href="/admin/media/cleanup" class="btn btn-warning">정리 작업</a>
                        <a href="/admin/media/backup" class="btn btn-info">백업 관리</a>
                    </div>

                    ${dashboardHTML}
                </div>

                <script>
                    ${getMediaDashboardScript()}
                </script>
            </body>
            </html>
        `);

    } catch (error) {
        logger.error('미디어 대시보드 로드 실패:', error);
        res.status(500).send(`<h1>오류</h1><p>${error.message}</p>`);
    }
});

/**
 * 파일 업로드 테스트 페이지
 * GET /admin/media/test
 */
router.get('/test', (req, res) => {
    res.send(`
        <!DOCTYPE html>
        <html>
        <head>
            <title>미디어 업로드 테스트</title>
            <meta charset="utf-8">
            <style>
                body { font-family: Arial, sans-serif; margin: 40px; }
                .upload-form { background: #f8f9fa; padding: 20px; border-radius: 8px; margin-bottom: 20px; }
                .form-group { margin-bottom: 15px; }
                .form-label { display: block; font-weight: bold; margin-bottom: 5px; }
                .form-input, .form-select { width: 100%; padding: 8px; border: 1px solid #ddd; border-radius: 4px; }
                .btn { padding: 10px 20px; background: #007bff; color: white; border: none; border-radius: 4px; cursor: pointer; }
                .btn:hover { background: #0056b3; }
                .result { background: #e9ecef; padding: 15px; border-radius: 4px; margin-top: 20px; }
            </style>
        </head>
        <body>
            <h1>🧪 미디어 업로드 테스트</h1>

            <!-- 얼굴 이미지 업로드 테스트 -->
            <div class="upload-form">
                <h3>😊 얼굴 이미지 업로드</h3>
                <form id="faceForm" enctype="multipart/form-data">
                    <div class="form-group">
                        <label class="form-label">상인 ID</label>
                        <input type="text" id="facemerchantId" class="form-input" placeholder="test-merchant-001" required>
                    </div>
                    <div class="form-group">
                        <label class="form-label">감정</label>
                        <select id="faceEmotion" class="form-select" required>
                            <option value="">선택하세요</option>
                            <option value="default">기본</option>
                            <option value="happy">기쁨</option>
                            <option value="sad">슬픔</option>
                            <option value="angry">화남</option>
                            <option value="surprised">놀람</option>
                            <option value="neutral">무표정</option>
                        </select>
                    </div>
                    <div class="form-group">
                        <label class="form-label">이미지 파일 (PNG, JPG)</label>
                        <input type="file" id="faceFile" class="form-input" accept="image/*" required>
                    </div>
                    <button type="submit" class="btn">얼굴 이미지 업로드</button>
                </form>
            </div>

            <!-- 애니메이션 업로드 테스트 -->
            <div class="upload-form">
                <h3>🎞️ 애니메이션 업로드</h3>
                <form id="animationForm" enctype="multipart/form-data">
                    <div class="form-group">
                        <label class="form-label">상인 ID</label>
                        <input type="text" id="animMerchantId" class="form-input" placeholder="test-merchant-001" required>
                    </div>
                    <div class="form-group">
                        <label class="form-label">애니메이션 타입</label>
                        <select id="animationType" class="form-select" required>
                            <option value="">선택하세요</option>
                            <option value="idle">대기</option>
                            <option value="talking">말하기</option>
                            <option value="celebrating">축하</option>
                        </select>
                    </div>
                    <div class="form-group">
                        <label class="form-label">GIF 파일</label>
                        <input type="file" id="animationFile" class="form-input" accept="image/gif" required>
                    </div>
                    <button type="submit" class="btn">애니메이션 업로드</button>
                </form>
            </div>

            <div id="result" class="result" style="display:none;">
                <h4>결과:</h4>
                <pre id="resultText"></pre>
            </div>

            <script>
                // 얼굴 이미지 업로드
                document.getElementById('faceForm').addEventListener('submit', async (e) => {
                    e.preventDefault();

                    const merchantId = document.getElementById('facemerchantId').value;
                    const emotion = document.getElementById('faceEmotion').value;
                    const file = document.getElementById('faceFile').files[0];

                    const formData = new FormData();
                    formData.append('faceImage', file);
                    formData.append('emotion', emotion);

                    try {
                        const response = await fetch(\`/admin/media/upload/face/\${merchantId}\`, {
                            method: 'POST',
                            body: formData
                        });

                        const result = await response.json();
                        showResult(result);
                    } catch (error) {
                        showResult({ success: false, error: error.message });
                    }
                });

                // 애니메이션 업로드
                document.getElementById('animationForm').addEventListener('submit', async (e) => {
                    e.preventDefault();

                    const merchantId = document.getElementById('animMerchantId').value;
                    const animationType = document.getElementById('animationType').value;
                    const file = document.getElementById('animationFile').files[0];

                    const formData = new FormData();
                    formData.append('animation', file);
                    formData.append('animationType', animationType);

                    try {
                        const response = await fetch(\`/admin/media/upload/animation/\${merchantId}\`, {
                            method: 'POST',
                            body: formData
                        });

                        const result = await response.json();
                        showResult(result);
                    } catch (error) {
                        showResult({ success: false, error: error.message });
                    }
                });

                function showResult(result) {
                    const resultDiv = document.getElementById('result');
                    const resultText = document.getElementById('resultText');

                    resultText.textContent = JSON.stringify(result, null, 2);
                    resultDiv.style.display = 'block';

                    if (result.success) {
                        resultDiv.style.background = '#d4edda';
                        resultDiv.style.borderColor = '#c3e6cb';
                    } else {
                        resultDiv.style.background = '#f8d7da';
                        resultDiv.style.borderColor = '#f5c6cb';
                    }
                }
            </script>
        </body>
        </html>
    `);
});

/**
 * 얼굴 이미지 업로드 API
 * POST /admin/media/upload/face/:merchantId
 */
router.post('/upload/face/:merchantId', uploadSingle('faceImage'), async (req, res) => {
    try {
        const { merchantId } = req.params;
        const { emotion } = req.body;
        const file = req.file;
        const adminId = req.admin?.adminId || 'system';

        if (!file) {
            return res.status(400).json({
                success: false,
                error: '이미지 파일이 필요합니다'
            });
        }

        if (!emotion) {
            return res.status(400).json({
                success: false,
                error: '감정 타입이 필요합니다'
            });
        }

        const result = await MerchantMediaService.uploadFaceImage(
            merchantId,
            emotion,
            file,
            adminId
        );

        res.json({
            success: true,
            data: result,
            message: `${emotion} 얼굴 이미지가 업로드되었습니다`
        });

    } catch (error) {
        logger.error('얼굴 이미지 업로드 실패:', error);
        res.status(400).json({
            success: false,
            error: error.message
        });
    }
});

/**
 * 애니메이션 업로드 API
 * POST /admin/media/upload/animation/:merchantId
 */
router.post('/upload/animation/:merchantId', uploadSingle('animation'), async (req, res) => {
    try {
        const { merchantId } = req.params;
        const { animationType } = req.body;
        const file = req.file;
        const adminId = req.admin?.adminId || 'system';

        if (!file) {
            return res.status(400).json({
                success: false,
                error: 'GIF 파일이 필요합니다'
            });
        }

        if (!animationType) {
            return res.status(400).json({
                success: false,
                error: '애니메이션 타입이 필요합니다'
            });
        }

        const result = await MerchantMediaService.uploadAnimation(
            merchantId,
            animationType,
            file,
            adminId
        );

        res.json({
            success: true,
            data: result,
            message: `${animationType} 애니메이션이 업로드되었습니다`
        });

    } catch (error) {
        logger.error('애니메이션 업로드 실패:', error);
        res.status(400).json({
            success: false,
            error: error.message
        });
    }
});

/**
 * 상인 미디어 조회 API
 * GET /admin/media/merchant/:merchantId
 */
router.get('/merchant/:merchantId', async (req, res) => {
    try {
        const { merchantId } = req.params;
        const media = await MerchantMediaService.getMerchantMedia(merchantId);

        res.json({
            success: true,
            data: media
        });

    } catch (error) {
        logger.error('상인 미디어 조회 실패:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

/**
 * 미디어 삭제 API
 * DELETE /admin/media/:mediaId
 */
router.delete('/:mediaId', async (req, res) => {
    try {
        const { mediaId } = req.params;
        const adminId = req.admin?.adminId || 'system';

        await MerchantMediaService.deleteMedia(mediaId, adminId);

        res.json({
            success: true,
            message: '미디어가 삭제되었습니다'
        });

    } catch (error) {
        logger.error('미디어 삭제 실패:', error);
        res.status(400).json({
            success: false,
            error: error.message
        });
    }
});

/**
 * 디렉토리 초기화 API
 * POST /admin/media/init
 */
router.post('/init', async (req, res) => {
    try {
        await MerchantMediaService.initializeDirectories();

        res.json({
            success: true,
            message: '미디어 디렉토리가 초기화되었습니다'
        });

    } catch (error) {
        logger.error('디렉토리 초기화 실패:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// HTML 생성 함수들
function generateMediaDashboard(statistics, recentMedia) {
    return `
        <!-- 통계 카드들 -->
        <div class="dashboard-grid">
            <div class="stat-card">
                <div class="stat-value">${statistics.total_media || 0}</div>
                <div class="stat-label">전체 미디어</div>
            </div>
            <div class="stat-card">
                <div class="stat-value">${statistics.face_images || 0}</div>
                <div class="stat-label">얼굴 이미지</div>
            </div>
            <div class="stat-card">
                <div class="stat-value">${statistics.animations || 0}</div>
                <div class="stat-label">애니메이션</div>
            </div>
            <div class="stat-card">
                <div class="stat-value">${statistics.merchants_with_media || 0}</div>
                <div class="stat-label">미디어 보유 상인</div>
            </div>
            <div class="stat-card">
                <div class="stat-value">${statistics.total_size_mb || 0}MB</div>
                <div class="stat-label">총 용량</div>
            </div>
        </div>

        <!-- 감정별 분포 -->
        <div class="content-section">
            <div class="section-title">😊 감정별 이미지 분포</div>
            <div class="emotion-grid">
                ${statistics.emotion_distribution?.map(emotion => `
                    <div class="emotion-item">
                        <div class="emotion-icon">${getEmotionIcon(emotion.emotion)}</div>
                        <div class="emotion-name">${getEmotionName(emotion.emotion)}</div>
                        <div class="emotion-count">${emotion.count}개</div>
                    </div>
                `).join('') || '<p>데이터가 없습니다</p>'}
            </div>
        </div>

        <!-- 최근 업로드 -->
        <div class="content-section">
            <div class="section-title">📅 최근 업로드된 미디어</div>
            <table class="table">
                <thead>
                    <tr>
                        <th>미리보기</th>
                        <th>상인</th>
                        <th>타입</th>
                        <th>감정/타입</th>
                        <th>파일명</th>
                        <th>크기</th>
                        <th>업로드일</th>
                        <th>작업</th>
                    </tr>
                </thead>
                <tbody>
                    ${recentMedia.map(media => `
                        <tr>
                            <td>
                                <img src="/${media.file_path}" alt="${media.emotion}"
                                     style="width: 40px; height: 40px; object-fit: cover; border-radius: 4px;">
                            </td>
                            <td><strong>${media.merchant_name}</strong></td>
                            <td><span class="type-badge type-${media.media_type}">${getMediaTypeName(media.media_type)}</span></td>
                            <td>${getEmotionName(media.emotion)}</td>
                            <td><code>${media.file_name}</code></td>
                            <td>${formatFileSize(media.file_size)}</td>
                            <td>${new Date(media.created_at).toLocaleString()}</td>
                            <td>
                                <button onclick="deleteMedia('${media.id}')" class="btn btn-sm btn-danger">삭제</button>
                            </td>
                        </tr>
                    `).join('')}
                </tbody>
            </table>
        </div>
    `;
}

function getMediaDashboardStyles() {
    return `
        <style>
            body { font-family: Arial, sans-serif; margin: 0; background-color: #f8f9fa; }
            .container { max-width: 1400px; margin: 0 auto; padding: 20px; }
            .navbar { background-color: #6c5ce7; color: white; padding: 1rem 0; margin-bottom: 2rem; }
            .navbar .container { display: flex; justify-content: space-between; align-items: center; padding: 0 20px; }
            .navbar a { color: white; text-decoration: none; margin-left: 20px; }
            .navbar a:hover { text-decoration: underline; }

            .dashboard-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 20px; margin-bottom: 30px; }
            .stat-card { background: white; border-radius: 8px; padding: 20px; box-shadow: 0 2px 10px rgba(0,0,0,0.1); border-left: 4px solid #6c5ce7; text-align: center; }
            .stat-value { font-size: 32px; font-weight: bold; color: #6c5ce7; }
            .stat-label { color: #666; margin-top: 5px; }

            .action-buttons { display: flex; gap: 10px; margin-bottom: 30px; flex-wrap: wrap; }
            .btn { padding: 12px 24px; text-decoration: none; border: none; border-radius: 6px; cursor: pointer; font-weight: bold; }
            .btn-primary { background-color: #6c5ce7; color: white; }
            .btn-info { background-color: #00cec9; color: white; }
            .btn-warning { background-color: #fdcb6e; color: #2d3436; }
            .btn-danger { background-color: #e74c3c; color: white; }
            .btn-sm { padding: 6px 12px; font-size: 12px; }
            .btn:hover { opacity: 0.9; }

            .content-section { background: white; border-radius: 8px; padding: 20px; margin-bottom: 20px; box-shadow: 0 2px 10px rgba(0,0,0,0.1); }
            .section-title { font-size: 20px; font-weight: bold; margin-bottom: 15px; color: #333; }

            .emotion-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(120px, 1fr)); gap: 15px; }
            .emotion-item { text-align: center; padding: 15px; border: 1px solid #eee; border-radius: 8px; }
            .emotion-icon { font-size: 32px; margin-bottom: 8px; }
            .emotion-name { font-weight: bold; margin-bottom: 4px; }
            .emotion-count { color: #666; font-size: 14px; }

            .table { width: 100%; border-collapse: collapse; margin-top: 10px; }
            .table th, .table td { padding: 12px; text-align: left; border-bottom: 1px solid #eee; }
            .table th { background-color: #f8f9fa; font-weight: bold; }
            .table tr:hover { background-color: #f5f5f5; }

            .type-badge { padding: 2px 8px; border-radius: 4px; font-size: 11px; font-weight: bold; }
            .type-face_image { background-color: #e3f2fd; color: #1565c0; }
            .type-animation_gif { background-color: #f3e5f5; color: #7b1fa2; }
        </style>
    `;
}

function getMediaDashboardScript() {
    return `
        async function initializeDirectories() {
            try {
                const response = await fetch('/admin/media/init', { method: 'POST' });
                const result = await response.json();

                if (result.success) {
                    alert(result.message);
                } else {
                    alert('초기화 실패: ' + result.error);
                }
            } catch (error) {
                alert('요청 실패: ' + error.message);
            }
        }

        async function deleteMedia(mediaId) {
            if (!confirm('정말 이 미디어를 삭제하시겠습니까?')) {
                return;
            }

            try {
                const response = await fetch(\`/admin/media/\${mediaId}\`, { method: 'DELETE' });
                const result = await response.json();

                if (result.success) {
                    alert(result.message);
                    location.reload();
                } else {
                    alert('삭제 실패: ' + result.error);
                }
            } catch (error) {
                alert('삭제 중 오류가 발생했습니다: ' + error.message);
            }
        }
    `;
}

// 헬퍼 함수들
function getEmotionIcon(emotion) {
    const icons = {
        'default': '😐',
        'happy': '😊',
        'sad': '😢',
        'angry': '😠',
        'surprised': '😲',
        'neutral': '😑',
        'idle': '🧍',
        'talking': '💬',
        'celebrating': '🎉'
    };
    return icons[emotion] || '🙂';
}

function getEmotionName(emotion) {
    const names = {
        'default': '기본',
        'happy': '기쁨',
        'sad': '슬픔',
        'angry': '화남',
        'surprised': '놀람',
        'neutral': '무표정',
        'idle': '대기',
        'talking': '말하기',
        'celebrating': '축하'
    };
    return names[emotion] || emotion;
}

function getMediaTypeName(type) {
    const names = {
        'face_image': '얼굴 이미지',
        'animation_gif': '애니메이션'
    };
    return names[type] || type;
}

function formatFileSize(bytes) {
    if (!bytes) return '0 B';

    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));

    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
}

module.exports = router;