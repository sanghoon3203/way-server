/**
 * CustomErrors.js
 * 게임 특화 커스텀 에러 클래스들
 *
 * 비즈니스 로직 에러를 체계적으로 관리하여 일관성 있는 에러 처리 제공
 */

/**
 * 기본 커스텀 에러 클래스
 */
class BaseError extends Error {
    constructor(message, statusCode = 500, errorCode = 'GENERIC_ERROR', details = null) {
        super(message);
        this.name = this.constructor.name;
        this.statusCode = statusCode;
        this.errorCode = errorCode;
        this.details = details;
        this.timestamp = new Date().toISOString();

        // Stack trace에서 이 생성자 호출 제거
        Error.captureStackTrace(this, this.constructor);
    }

    toJSON() {
        return {
            name: this.name,
            message: this.message,
            statusCode: this.statusCode,
            errorCode: this.errorCode,
            details: this.details,
            timestamp: this.timestamp,
            stack: this.stack
        };
    }
}

/**
 * 인증 관련 에러
 */
class AuthenticationError extends BaseError {
    constructor(message = 'Authentication failed', errorCode = 'AUTHENTICATION_ERROR', details = null) {
        super(message, 401, errorCode, details);
    }
}

class AuthorizationError extends BaseError {
    constructor(message = 'Access denied', errorCode = 'AUTHORIZATION_ERROR', details = null) {
        super(message, 403, errorCode, details);
    }
}

class TokenExpiredError extends AuthenticationError {
    constructor(message = 'Token has expired') {
        super(message, 'TOKEN_EXPIRED');
    }
}

class InvalidCredentialsError extends AuthenticationError {
    constructor(message = 'Invalid credentials provided') {
        super(message, 'INVALID_CREDENTIALS');
    }
}

/**
 * 리소스 관련 에러
 */
class NotFoundError extends BaseError {
    constructor(resource = 'Resource', message = null) {
        const errorMessage = message || `${resource} not found`;
        super(errorMessage, 404, 'NOT_FOUND', { resource });
    }
}

class ConflictError extends BaseError {
    constructor(message = 'Resource already exists', errorCode = 'CONFLICT', details = null) {
        super(message, 409, errorCode, details);
    }
}

class ValidationError extends BaseError {
    constructor(message = 'Validation failed', validationErrors = [], errorCode = 'VALIDATION_ERROR') {
        super(message, 422, errorCode, { validationErrors });
        this.validationErrors = validationErrors;
    }
}

/**
 * 게임 비즈니스 로직 에러들
 */
class GameplayError extends BaseError {
    constructor(message, errorCode, details = null) {
        super(message, 400, errorCode, details);
    }
}

class InsufficientFundsError extends GameplayError {
    constructor(required, available) {
        super(
            '자금이 부족합니다',
            'INSUFFICIENT_FUNDS',
            { required, available, shortage: required - available }
        );
    }
}

class InventoryFullError extends GameplayError {
    constructor(currentSize, maxSize) {
        super(
            '인벤토리가 가득 찼습니다',
            'INVENTORY_FULL',
            { currentSize, maxSize }
        );
    }
}

class ItemNotAvailableError extends GameplayError {
    constructor(itemId, reason = 'Item is not available') {
        super(
            reason,
            'ITEM_NOT_AVAILABLE',
            { itemId, reason }
        );
    }
}

class TradeNotAllowedError extends GameplayError {
    constructor(reason = 'Trade is not allowed') {
        super(
            reason,
            'TRADE_NOT_ALLOWED',
            { reason }
        );
    }
}

class LevelTooLowError extends GameplayError {
    constructor(requiredLevel, currentLevel, action = 'perform this action') {
        super(
            `레벨이 부족합니다. ${action}하려면 레벨 ${requiredLevel}이 필요합니다`,
            'LEVEL_TOO_LOW',
            { requiredLevel, currentLevel, action }
        );
    }
}

class LicenseRequiredError extends GameplayError {
    constructor(requiredLicense, currentLicense, item = '') {
        super(
            `라이센스가 부족합니다. ${item} 거래하려면 ${requiredLicense} 라이센스가 필요합니다`,
            'LICENSE_REQUIRED',
            { requiredLicense, currentLicense, item }
        );
    }
}

class CooldownActiveError extends GameplayError {
    constructor(action, remainingTime) {
        super(
            `${action}은(는) 쿨다운 중입니다`,
            'COOLDOWN_ACTIVE',
            { action, remainingTime }
        );
    }
}

class MaxCapacityReachedError extends GameplayError {
    constructor(resource, current, max) {
        super(
            `${resource} 최대 용량에 도달했습니다`,
            'MAX_CAPACITY_REACHED',
            { resource, current, max }
        );
    }
}

/**
 * 시스템 에러들
 */
class DatabaseError extends BaseError {
    constructor(message = 'Database operation failed', query = null, error = null) {
        super(message, 500, 'DATABASE_ERROR', { query, originalError: error?.message });
        this.originalError = error;
    }
}

class ExternalServiceError extends BaseError {
    constructor(service, message = 'External service error', statusCode = 502) {
        super(message, statusCode, 'EXTERNAL_SERVICE_ERROR', { service });
    }
}

class RateLimitError extends BaseError {
    constructor(limit, windowMs, retryAfter) {
        super(
            'Rate limit exceeded',
            429,
            'RATE_LIMITED',
            { limit, windowMs, retryAfter }
        );
    }
}

/**
 * 특정 게임 기능 에러들
 */
class AuctionError extends GameplayError {
    constructor(message, reason, auctionId = null) {
        super(message, 'AUCTION_ERROR', { reason, auctionId });
    }
}

class GuildError extends GameplayError {
    constructor(message, reason, guildId = null) {
        super(message, 'GUILD_ERROR', { reason, guildId });
    }
}

class QuestError extends GameplayError {
    constructor(message, reason, questId = null) {
        super(message, 'QUEST_ERROR', { reason, questId });
    }
}

class SkillError extends GameplayError {
    constructor(message, skillId, reason) {
        super(message, 'SKILL_ERROR', { skillId, reason });
    }
}

/**
 * 위치 관련 에러들
 */
class LocationError extends GameplayError {
    constructor(message, reason, location = null) {
        super(message, 'LOCATION_ERROR', { reason, location });
    }
}

class OutOfRangeError extends LocationError {
    constructor(maxDistance, actualDistance) {
        super(
            '거리가 너무 멉니다',
            'OUT_OF_RANGE',
            { maxDistance, actualDistance }
        );
    }
}

/**
 * 에러 팩토리 함수들
 */
class ErrorFactory {
    static createAuthError(type, message, details) {
        switch (type) {
            case 'token_expired':
                return new TokenExpiredError(message);
            case 'invalid_credentials':
                return new InvalidCredentialsError(message);
            case 'unauthorized':
                return new AuthenticationError(message, 'UNAUTHORIZED', details);
            case 'forbidden':
                return new AuthorizationError(message, 'FORBIDDEN', details);
            default:
                return new AuthenticationError(message, 'AUTHENTICATION_ERROR', details);
        }
    }

    static createGameplayError(type, ...args) {
        switch (type) {
            case 'insufficient_funds':
                return new InsufficientFundsError(...args);
            case 'inventory_full':
                return new InventoryFullError(...args);
            case 'item_not_available':
                return new ItemNotAvailableError(...args);
            case 'trade_not_allowed':
                return new TradeNotAllowedError(...args);
            case 'level_too_low':
                return new LevelTooLowError(...args);
            case 'license_required':
                return new LicenseRequiredError(...args);
            case 'cooldown_active':
                return new CooldownActiveError(...args);
            case 'max_capacity_reached':
                return new MaxCapacityReachedError(...args);
            case 'out_of_range':
                return new OutOfRangeError(...args);
            default:
                return new GameplayError(args[0] || 'Unknown gameplay error', 'GAMEPLAY_ERROR');
        }
    }

    static createSystemError(type, message, details) {
        switch (type) {
            case 'database':
                return new DatabaseError(message, details?.query, details?.originalError);
            case 'external_service':
                return new ExternalServiceError(details?.service, message);
            case 'rate_limit':
                return new RateLimitError(details?.limit, details?.windowMs, details?.retryAfter);
            default:
                return new BaseError(message, 500, 'SYSTEM_ERROR', details);
        }
    }
}

module.exports = {
    BaseError,
    AuthenticationError,
    AuthorizationError,
    TokenExpiredError,
    InvalidCredentialsError,
    NotFoundError,
    ConflictError,
    ValidationError,
    GameplayError,
    InsufficientFundsError,
    InventoryFullError,
    ItemNotAvailableError,
    TradeNotAllowedError,
    LevelTooLowError,
    LicenseRequiredError,
    CooldownActiveError,
    MaxCapacityReachedError,
    DatabaseError,
    ExternalServiceError,
    RateLimitError,
    AuctionError,
    GuildError,
    QuestError,
    SkillError,
    LocationError,
    OutOfRangeError,
    ErrorFactory
};