/**
 * errorHandler.js
 * 중앙화된 에러 핸들링 미들웨어
 *
 * 모든 에러를 일관성 있게 처리하고 표준화된 응답 제공
 */

const StandardResponse = require('../utils/StandardResponse');
const {
    BaseError,
    ValidationError,
    DatabaseError,
    AuthenticationError,
    AuthorizationError
} = require('../errors/CustomErrors');
const logger = require('../config/logger');

/**
 * Express 에러 처리 미들웨어
 */
function errorHandler(error, req, res, next) {
    // 이미 응답이 전송된 경우
    if (res.headersSent) {
        return next(error);
    }

    // 에러 로깅
    logError(error, req);

    // 커스텀 에러 처리
    if (error instanceof BaseError) {
        return handleCustomError(error, req, res);
    }

    // Express Validator 에러
    if (error.name === 'ValidationError' || error.errors) {
        return handleValidationError(error, req, res);
    }

    // Mongoose/Database 에러
    if (error.name === 'MongoError' || error.name === 'CastError' || error.code === 'SQLITE_ERROR') {
        return handleDatabaseError(error, req, res);
    }

    // JWT 에러
    if (error.name === 'JsonWebTokenError' || error.name === 'TokenExpiredError') {
        return handleJWTError(error, req, res);
    }

    // Multer 파일 업로드 에러
    if (error.code && error.code.startsWith('LIMIT_')) {
        return handleMulterError(error, req, res);
    }

    // SyntaxError (잘못된 JSON)
    if (error instanceof SyntaxError && error.status === 400 && 'body' in error) {
        return StandardResponse.badRequest(res, {
            error: 'Invalid JSON format',
            errorCode: 'INVALID_JSON',
            details: { message: error.message }
        });
    }

    // 기본 처리되지 않은 에러
    return handleUnknownError(error, req, res);
}

/**
 * 커스텀 에러 처리
 */
function handleCustomError(error, req, res) {
    const response = {
        error: error.message,
        errorCode: error.errorCode,
        statusCode: error.statusCode
    };

    // 상세 정보가 있으면 추가
    if (error.details) {
        response.details = error.details;
    }

    // ValidationError의 경우 특별 처리
    if (error instanceof ValidationError && error.validationErrors) {
        response.validationErrors = error.validationErrors;
    }

    return StandardResponse.error(res, response);
}

/**
 * 유효성 검사 에러 처리
 */
function handleValidationError(error, req, res) {
    let validationErrors = [];

    // Express-validator 에러 형식
    if (error.array && typeof error.array === 'function') {
        validationErrors = error.array();
    }
    // Mongoose validation 에러
    else if (error.errors) {
        validationErrors = Object.values(error.errors).map(err => ({
            field: err.path,
            message: err.message,
            value: err.value
        }));
    }

    return StandardResponse.validationFailed(res, {
        validationErrors,
        error: 'Validation failed',
        errorCode: 'VALIDATION_ERROR'
    });
}

/**
 * 데이터베이스 에러 처리
 */
function handleDatabaseError(error, req, res) {
    // 🔒 SECURITY: Log SQL query details only, never expose to client
    logger.error('Database Error:', {
        error: error.message,
        code: error.code,
        sql: error.sql || null,
        url: req.url,
        method: req.method
    });

    // 🔒 SECURITY: Never expose SQL queries or internal error details to client
    // Even in development, return generic error message
    return StandardResponse.error(res, {
        error: 'Database operation failed',
        errorCode: 'DATABASE_ERROR',
        statusCode: 500
    });
}

/**
 * JWT 에러 처리
 */
function handleJWTError(error, req, res) {
    let errorMessage = 'Authentication failed';
    let errorCode = 'AUTHENTICATION_ERROR';

    switch (error.name) {
        case 'TokenExpiredError':
            errorMessage = 'Token has expired';
            errorCode = 'TOKEN_EXPIRED';
            break;
        case 'JsonWebTokenError':
            errorMessage = 'Invalid token';
            errorCode = 'INVALID_TOKEN';
            break;
        case 'NotBeforeError':
            errorMessage = 'Token not active yet';
            errorCode = 'TOKEN_NOT_ACTIVE';
            break;
        default:
            errorMessage = 'Token verification failed';
            errorCode = 'TOKEN_VERIFICATION_FAILED';
    }

    return StandardResponse.unauthorized(res, {
        error: errorMessage,
        errorCode
    });
}

/**
 * Multer 파일 업로드 에러 처리
 */
function handleMulterError(error, req, res) {
    let errorMessage = 'File upload error';
    let errorCode = 'FILE_UPLOAD_ERROR';

    switch (error.code) {
        case 'LIMIT_FILE_SIZE':
            errorMessage = 'File size too large';
            errorCode = 'FILE_TOO_LARGE';
            break;
        case 'LIMIT_FILE_COUNT':
            errorMessage = 'Too many files';
            errorCode = 'TOO_MANY_FILES';
            break;
        case 'LIMIT_UNEXPECTED_FILE':
            errorMessage = 'Unexpected file field';
            errorCode = 'UNEXPECTED_FILE';
            break;
        default:
            errorMessage = `File upload error: ${error.code}`;
            errorCode = 'FILE_UPLOAD_ERROR';
    }

    return StandardResponse.badRequest(res, {
        error: errorMessage,
        errorCode,
        details: { code: error.code, field: error.field }
    });
}

/**
 * 알 수 없는 에러 처리
 */
function handleUnknownError(error, req, res) {
    // 🔒 SECURITY: Log full error details server-side only
    logger.error('Unhandled Error:', {
        error: error.message,
        stack: error.stack,
        name: error.name,
        url: req.url,
        method: req.method,
        headers: req.headers,
        body: req.body
    });

    // 🔒 SECURITY: Never expose stack traces or internal error details to client
    // Even in development, return generic error message
    return StandardResponse.internalError(res, {
        error: 'Internal server error',
        errorCode: 'INTERNAL_ERROR'
    });
}

/**
 * 에러 로깅 함수
 */
function logError(error, req) {
    const errorInfo = {
        name: error.name,
        message: error.message,
        stack: error.stack,
        url: req.url,
        method: req.method,
        userAgent: req.get('User-Agent'),
        ip: req.ip || req.connection.remoteAddress,
        timestamp: new Date().toISOString()
    };

    // 사용자 정보가 있으면 추가
    if (req.user) {
        errorInfo.userId = req.user.id;
        errorInfo.userEmail = req.user.email;
    }

    if (req.player) {
        errorInfo.playerId = req.player.id;
        errorInfo.playerName = req.player.name;
    }

    // 심각도에 따른 로깅 레벨 결정
    if (error instanceof BaseError) {
        if (error.statusCode >= 500) {
            logger.error('Server Error:', errorInfo);
        } else if (error.statusCode >= 400) {
            logger.warn('Client Error:', errorInfo);
        } else {
            logger.info('Error:', errorInfo);
        }
    } else {
        logger.error('Unhandled Error:', errorInfo);
    }
}

/**
 * 404 에러 핸들러 (라우트를 찾지 못한 경우)
 */
function notFoundHandler(req, res, next) {
    const error = new Error(`Route ${req.method} ${req.originalUrl} not found`);
    error.statusCode = 404;
    error.errorCode = 'ROUTE_NOT_FOUND';

    return StandardResponse.notFound(res, {
        error: `Route not found: ${req.method} ${req.originalUrl}`,
        errorCode: 'ROUTE_NOT_FOUND'
    });
}

/**
 * 비동기 라우트 핸들러 래퍼
 * async/await 에러를 자동으로 next()로 전달
 */
function asyncHandler(fn) {
    return (req, res, next) => {
        Promise.resolve(fn(req, res, next)).catch(next);
    };
}

/**
 * 에러 응답 형식 검증 미들웨어
 */
function validateErrorResponse(req, res, next) {
    const originalJson = res.json;

    res.json = function(obj) {
        // 에러 응답이 표준 형식을 따르는지 검증
        if (!obj.success && obj.success !== false) {
            logger.warn('Non-standard error response detected:', {
                url: req.url,
                response: obj
            });
        }

        return originalJson.call(this, obj);
    };

    next();
}

module.exports = {
    errorHandler,
    notFoundHandler,
    asyncHandler,
    validateErrorResponse
};