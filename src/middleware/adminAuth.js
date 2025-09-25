/**
 * 관리자 인증 미들웨어
 */
function adminAuth(req, res, next) {
    // 로그인 페이지는 인증 체크 제외
    if (req.path === '/login' || req.path.endsWith('/login')) {
        return next();
    }

    // 세션에서 인증 정보 확인
    if (req.session && req.session.adminAuthenticated) {
        // 인증된 경우 다음 미들웨어로
        return next();
    }

    // 인증되지 않은 경우 로그인 페이지로 리다이렉트
    if (req.xhr || req.headers.accept?.indexOf('json') > -1) {
        // AJAX 요청인 경우 JSON 응답
        return res.status(401).json({
            success: false,
            message: '로그인이 필요합니다.',
            redirect: '/admin/login'
        });
    } else {
        // 일반 요청인 경우 리다이렉트
        return res.redirect('/admin/login');
    }
}

module.exports = adminAuth;