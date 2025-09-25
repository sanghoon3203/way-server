// 📁 src/middleware/uploadMiddleware.js
const multer = require('multer');
const path = require('path');
const logger = require('../config/logger');

// 메모리 저장 (Sharp로 처리하기 위해)
const storage = multer.memoryStorage();

// 파일 필터 함수
const fileFilter = (req, file, cb) => {
    logger.info(`파일 업로드 시도: ${file.fieldname}, MIME: ${file.mimetype}`);

    // 얼굴 이미지 업로드
    if (file.fieldname === 'faceImage' || file.fieldname === 'file') {
        if (file.mimetype.startsWith('image/')) {
            cb(null, true);
        } else {
            cb(new Error('이미지 파일만 업로드 가능합니다'), false);
        }
    }
    // 애니메이션 GIF 업로드
    else if (file.fieldname === 'animation') {
        if (file.mimetype === 'image/gif') {
            cb(null, true);
        } else {
            cb(new Error('GIF 파일만 업로드 가능합니다'), false);
        }
    }
    else {
        cb(new Error('알 수 없는 필드입니다'), false);
    }
};

// 파일 크기 제한
const limits = {
    fileSize: 10 * 1024 * 1024, // 10MB
    files: 1 // 한 번에 하나씩만
};

// Multer 설정
const upload = multer({
    storage,
    fileFilter,
    limits
});

// 에러 핸들링 미들웨어
const handleUploadError = (err, req, res, next) => {
    if (err instanceof multer.MulterError) {
        logger.error('Multer 에러:', err);

        if (err.code === 'LIMIT_FILE_SIZE') {
            return res.status(400).json({
                success: false,
                error: '파일 크기가 10MB를 초과합니다'
            });
        }

        if (err.code === 'LIMIT_FILE_COUNT') {
            return res.status(400).json({
                success: false,
                error: '파일은 하나씩만 업로드 가능합니다'
            });
        }

        return res.status(400).json({
            success: false,
            error: '파일 업로드 중 오류가 발생했습니다'
        });
    }

    if (err) {
        logger.error('업로드 에러:', err);
        return res.status(400).json({
            success: false,
            error: err.message
        });
    }

    next();
};

module.exports = {
    // 단일 파일 업로드 (범용)
    uploadSingle: (fieldName = 'file') => [
        upload.single(fieldName),
        handleUploadError
    ],

    // 얼굴 이미지 업로드
    uploadFace: [
        upload.single('faceImage'),
        handleUploadError
    ],

    // 애니메이션 업로드
    uploadAnimation: [
        upload.single('animation'),
        handleUploadError
    ],

    // 다중 파일 업로드 (필요시)
    uploadMultiple: (fieldName = 'files', maxCount = 5) => [
        upload.array(fieldName, maxCount),
        handleUploadError
    ]
};