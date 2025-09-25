// 📁 src/database/initAdmin.js - 초기 어드민 설정
const { AdminAuth } = require('../middleware/adminAuth');
const DatabaseManager = require('./DatabaseManager');
const logger = require('../config/logger');

async function initializeAdmin() {
    try {
        await DatabaseManager.initialize();
        
        // 초기 슈퍼 어드민 생성
        const superAdmin = await AdminAuth.initializeSuperAdmin();
        
        if (superAdmin) {
            console.log('🔑 초기 슈퍼 어드민 계정 생성됨:');
            console.log('   사용자명: superadmin');
            console.log('   비밀번호: WayGame2024!');
            console.log('   이메일: admin@waygame.com');
            console.log('   역할: super_admin');
            console.log('\n🌐 어드민 페이지: http://localhost:3000/admin/auth/login');
        } else {
            console.log('✅ 슈퍼 어드민이 이미 존재합니다.');
            console.log('🌐 어드민 페이지: http://localhost:3000/admin/auth/login');
        }
        
        await DatabaseManager.close();
        
    } catch (error) {
        logger.error('어드민 초기화 실패:', error);
        console.error('❌ 어드민 초기화 중 오류:', error.message);
    }
}

// 스크립트로 직접 실행시
if (require.main === module) {
    initializeAdmin();
}

module.exports = { initializeAdmin };