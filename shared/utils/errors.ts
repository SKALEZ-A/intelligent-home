export class AppError extends Error {
  public readonly statusCode: number;
  public readonly code: string;
  public readonly isOperational: boolean;
  public readonly details?: Record<string, any>;

  constructor(
    message: string,
    statusCode: number = 500,
    code: string = 'INTERNAL_ERROR',
    isOperational: boolean = true,
    details?: Record<string, any>
  ) {
    super(message);
    Object.setPrototypeOf(this, new.target.prototype);

    this.statusCode = statusCode;
    this.code = code;
    this.isOperational = isOperational;
    this.details = details;

    Error.captureStackTrace(this);
  }
}

export class ValidationError extends AppError {
  constructor(message: string, details?: Record<string, any>) {
    super(message, 400, 'VALIDATION_ERROR', true, details);
  }
}

export class AuthenticationError extends AppError {
  constructor(message: string = 'Authentication failed') {
    super(message, 401, 'AUTHENTICATION_ERROR', true);
  }
}

export class AuthorizationError extends AppError {
  constructor(message: string = 'Insufficient permissions') {
    super(message, 403, 'AUTHORIZATION_ERROR', true);
  }
}

export class NotFoundError extends AppError {
  constructor(resource: string, id?: string) {
    const message = id 
      ? `${resource} with id ${id} not found`
      : `${resource} not found`;
    super(message, 404, 'NOT_FOUND', true);
  }
}

export class ConflictError extends AppError {
  constructor(message: string, details?: Record<string, any>) {
    super(message, 409, 'CONFLICT', true, details);
  }
}

export class RateLimitError extends AppError {
  constructor(message: string = 'Rate limit exceeded') {
    super(message, 429, 'RATE_LIMIT_EXCEEDED', true);
  }
}

export class DeviceError extends AppError {
  constructor(message: string, deviceId?: string) {
    super(
      message,
      500,
      'DEVICE_ERROR',
      true,
      deviceId ? { deviceId } : undefined
    );
  }
}

export class DeviceOfflineError extends DeviceError {
  constructor(deviceId: string) {
    super(`Device ${deviceId} is offline`, deviceId);
    this.code = 'DEVICE_OFFLINE';
  }
}

export class DeviceTimeoutError extends DeviceError {
  constructor(deviceId: string) {
    super(`Device ${deviceId} command timeout`, deviceId);
    this.code = 'DEVICE_TIMEOUT';
  }
}

export class AutomationError extends AppError {
  constructor(message: string, automationId?: string) {
    super(
      message,
      500,
      'AUTOMATION_ERROR',
      true,
      automationId ? { automationId } : undefined
    );
  }
}

export class IntegrationError extends AppError {
  constructor(message: string, integration: string) {
    super(message, 500, 'INTEGRATION_ERROR', true, { integration });
  }
}

export class DatabaseError extends AppError {
  constructor(message: string, operation?: string) {
    super(
      message,
      500,
      'DATABASE_ERROR',
      false,
      operation ? { operation } : undefined
    );
  }
}

export class ExternalServiceError extends AppError {
  constructor(service: string, message: string) {
    super(
      `External service error: ${service} - ${message}`,
      503,
      'EXTERNAL_SERVICE_ERROR',
      true,
      { service }
    );
  }
}

export function isAppError(error: any): error is AppError {
  return error instanceof AppError;
}

export function handleError(error: Error): {
  statusCode: number;
  code: string;
  message: string;
  details?: Record<string, any>;
} {
  if (isAppError(error)) {
    return {
      statusCode: error.statusCode,
      code: error.code,
      message: error.message,
      details: error.details,
    };
  }

  // Unknown error
  return {
    statusCode: 500,
    code: 'INTERNAL_ERROR',
    message: 'An unexpected error occurred',
  };
}
