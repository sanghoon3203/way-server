/**
 * StandardResponse.js
 * 표준화된 API 응답 형식을 제공하는 유틸리티 클래스
 *
 * 모든 API 응답을 일관성 있게 관리하여 클라이언트 처리 편의성 향상
 */

const logger = require('../config/logger');

class StandardResponse {
    /**
     * 성공 응답 생성
     * @param {Object} res - Express response 객체
     * @param {Object} options - 응답 옵션
     * @param {any} options.data - 응답 데이터
     * @param {string} options.message - 성공 메시지
     * @param {number} options.statusCode - HTTP 상태 코드 (기본: 200)
     * @param {Object} options.meta - 메타데이터 (페이징 등)
     */
    static success(res, { data = null, message = 'Success', statusCode = 200, meta = null } = {}) {
        const response = {
            success: true,
            timestamp: new Date().toISOString(),
            statusCode,
            message,
            data,
            ...(meta && { meta })
        };

        logger.info('API Success Response', {
            statusCode,
            message,
            hasData: !!data,
            hasMeta: !!meta
        });

        return res.status(statusCode).json(response);
    }

    /**
     * 실패 응답 생성
     * @param {Object} res - Express response 객체
     * @param {Object} options - 응답 옵션
     * @param {string} options.error - 에러 메시지
     * @param {string} options.errorCode - 에러 코드
     * @param {number} options.statusCode - HTTP 상태 코드 (기본: 400)
     * @param {any} options.details - 에러 상세 정보
     * @param {Array} options.validationErrors - 유효성 검사 에러 배열
     */
    static error(res, {
        error = 'An error occurred',
        errorCode = 'GENERIC_ERROR',
        statusCode = 400,
        details = null,
        validationErrors = null
    } = {}) {
        const response = {
            success: false,
            timestamp: new Date().toISOString(),
            statusCode,
            error: {
                code: errorCode,
                message: error,
                ...(details && { details }),
                ...(validationErrors && { validationErrors })
            }
        };

        logger.error('API Error Response', {
            statusCode,
            errorCode,
            error,
            hasDetails: !!details,
            hasValidationErrors: !!validationErrors
        });

        return res.status(statusCode).json(response);
    }

    /**
     * 페이징된 데이터 응답
     * @param {Object} res - Express response 객체
     * @param {Object} options - 응답 옵션
     * @param {Array} options.data - 데이터 배열
     * @param {number} options.total - 전체 데이터 개수
     * @param {number} options.page - 현재 페이지
     * @param {number} options.limit - 페이지당 아이템 수
     * @param {string} options.message - 성공 메시지
     */
    static paginated(res, {
        data = [],
        total = 0,
        page = 1,
        limit = 10,
        message = 'Data retrieved successfully'
    } = {}) {
        const totalPages = Math.ceil(total / limit);
        const hasNextPage = page < totalPages;
        const hasPreviousPage = page > 1;

        const meta = {
            pagination: {
                total,
                page,
                limit,
                totalPages,
                hasNextPage,
                hasPreviousPage,
                ...(hasNextPage && { nextPage: page + 1 }),
                ...(hasPreviousPage && { previousPage: page - 1 })
            }
        };

        return this.success(res, { data, message, meta });
    }

    /**
     * 생성 성공 응답 (201)
     */
    static created(res, { data = null, message = 'Resource created successfully' } = {}) {
        return this.success(res, { data, message, statusCode: 201 });
    }

    /**
     * 업데이트 성공 응답 (200)
     */
    static updated(res, { data = null, message = 'Resource updated successfully' } = {}) {
        return this.success(res, { data, message, statusCode: 200 });
    }

    /**
     * 삭제 성공 응답 (204)
     */
    static deleted(res, { message = 'Resource deleted successfully' } = {}) {
        return this.success(res, { message, statusCode: 204 });
    }

    /**
     * 찾을 수 없음 에러 (404)
     */
    static notFound(res, { error = 'Resource not found', errorCode = 'NOT_FOUND' } = {}) {
        return this.error(res, { error, errorCode, statusCode: 404 });
    }

    /**
     * 권한 없음 에러 (401)
     */
    static unauthorized(res, { error = 'Unauthorized access', errorCode = 'UNAUTHORIZED' } = {}) {
        return this.error(res, { error, errorCode, statusCode: 401 });
    }

    /**
     * 접근 금지 에러 (403)
     */
    static forbidden(res, { error = 'Access forbidden', errorCode = 'FORBIDDEN' } = {}) {
        return this.error(res, { error, errorCode, statusCode: 403 });
    }

    /**
     * 유효성 검사 실패 에러 (422)
     */
    static validationFailed(res, { validationErrors, error = 'Validation failed', errorCode = 'VALIDATION_ERROR' } = {}) {
        return this.error(res, {
            error,
            errorCode,
            statusCode: 422,
            validationErrors
        });
    }

    /**
     * 서버 내부 에러 (500)
     */
    static internalError(res, { error = 'Internal server error', errorCode = 'INTERNAL_ERROR', details = null } = {}) {
        return this.error(res, {
            error,
            errorCode,
            statusCode: 500,
            details
        });
    }

    /**
     * 비즈니스 로직 에러 (400)
     */
    static businessError(res, { error, errorCode, details = null } = {}) {
        return this.error(res, {
            error,
            errorCode,
            statusCode: 400,
            details
        });
    }

    /**
     * 중복 리소스 에러 (409)
     */
    static conflict(res, { error = 'Resource already exists', errorCode = 'CONFLICT' } = {}) {
        return this.error(res, { error, errorCode, statusCode: 409 });
    }

    /**
     * 요청 데이터 에러 (400)
     */
    static badRequest(res, { error = 'Bad request', errorCode = 'BAD_REQUEST', details = null } = {}) {
        return this.error(res, { error, errorCode, statusCode: 400, details });
    }

    /**
     * 요율 제한 에러 (429)
     */
    static rateLimited(res, { error = 'Rate limit exceeded', errorCode = 'RATE_LIMITED' } = {}) {
        return this.error(res, { error, errorCode, statusCode: 429 });
    }
}

// 에러 코드 상수 정의
StandardResponse.ErrorCodes = {
    // 인증 관련
    UNAUTHORIZED: 'UNAUTHORIZED',
    FORBIDDEN: 'FORBIDDEN',
    TOKEN_EXPIRED: 'TOKEN_EXPIRED',
    INVALID_CREDENTIALS: 'INVALID_CREDENTIALS',

    // 리소스 관련
    NOT_FOUND: 'NOT_FOUND',
    CONFLICT: 'CONFLICT',
    ALREADY_EXISTS: 'ALREADY_EXISTS',

    // 유효성 검사
    VALIDATION_ERROR: 'VALIDATION_ERROR',
    INVALID_INPUT: 'INVALID_INPUT',
    MISSING_REQUIRED_FIELD: 'MISSING_REQUIRED_FIELD',

    // 비즈니스 로직
    INSUFFICIENT_FUNDS: 'INSUFFICIENT_FUNDS',
    INVENTORY_FULL: 'INVENTORY_FULL',
    ITEM_NOT_AVAILABLE: 'ITEM_NOT_AVAILABLE',
    TRADE_NOT_ALLOWED: 'TRADE_NOT_ALLOWED',
    LEVEL_TOO_LOW: 'LEVEL_TOO_LOW',

    // 시스템 에러
    INTERNAL_ERROR: 'INTERNAL_ERROR',
    DATABASE_ERROR: 'DATABASE_ERROR',
    EXTERNAL_SERVICE_ERROR: 'EXTERNAL_SERVICE_ERROR',
    RATE_LIMITED: 'RATE_LIMITED'
};

module.exports = StandardResponse;