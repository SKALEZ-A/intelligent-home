import { Request, Response, NextFunction } from 'express';
import { Schema, ValidationError } from 'joi';
import { AppError } from '../utils/errors';
import { createLogger } from '../utils/logger';

const logger = createLogger('ValidationMiddleware');

export function validateRequest(schema: Schema, property: 'body' | 'query' | 'params' = 'body') {
  return (req: Request, res: Response, next: NextFunction): void => {
    const { error, value } = schema.validate(req[property], {
      abortEarly: false,
      stripUnknown: true,
      convert: true,
    });

    if (error) {
      const details = error.details.map(detail => ({
        field: detail.path.join('.'),
        message: detail.message,
        type: detail.type,
      }));

      logger.warn('Validation failed', {
        path: req.path,
        method: req.method,
        errors: details,
      });

      return next(new AppError('Validation failed', 400, 'VALIDATION_ERROR', { details }));
    }

    // Replace request property with validated and sanitized value
    req[property] = value;
    next();
  };
}

export function validateBody(schema: Schema) {
  return validateRequest(schema, 'body');
}

export function validateQuery(schema: Schema) {
  return validateRequest(schema, 'query');
}

export function validateParams(schema: Schema) {
  return validateRequest(schema, 'params');
}

export function validateMultiple(schemas: {
  body?: Schema;
  query?: Schema;
  params?: Schema;
}) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const errors: any[] = [];

    if (schemas.body) {
      const { error, value } = schemas.body.validate(req.body, {
        abortEarly: false,
        stripUnknown: true,
        convert: true,
      });

      if (error) {
        errors.push(...error.details.map(detail => ({
          location: 'body',
          field: detail.path.join('.'),
          message: detail.message,
          type: detail.type,
        })));
      } else {
        req.body = value;
      }
    }

    if (schemas.query) {
      const { error, value } = schemas.query.validate(req.query, {
        abortEarly: false,
        stripUnknown: true,
        convert: true,
      });

      if (error) {
        errors.push(...error.details.map(detail => ({
          location: 'query',
          field: detail.path.join('.'),
          message: detail.message,
          type: detail.type,
        })));
      } else {
        req.query = value;
      }
    }

    if (schemas.params) {
      const { error, value } = schemas.params.validate(req.params, {
        abortEarly: false,
        stripUnknown: true,
        convert: true,
      });

      if (error) {
        errors.push(...error.details.map(detail => ({
          location: 'params',
          field: detail.path.join('.'),
          message: detail.message,
          type: detail.type,
        })));
      } else {
        req.params = value;
      }
    }

    if (errors.length > 0) {
      logger.warn('Validation failed', {
        path: req.path,
        method: req.method,
        errors,
      });

      return next(new AppError('Validation failed', 400, 'VALIDATION_ERROR', { details: errors }));
    }

    next();
  };
}

// Custom validators
export const customValidators = {
  uuid: (value: string, helpers: any) => {
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(value)) {
      return helpers.error('any.invalid');
    }
    return value;
  },

  objectId: (value: string, helpers: any) => {
    const objectIdRegex = /^[0-9a-fA-F]{24}$/;
    if (!objectIdRegex.test(value)) {
      return helpers.error('any.invalid');
    }
    return value;
  },

  phoneNumber: (value: string, helpers: any) => {
    const phoneRegex = /^\+?[1-9]\d{1,14}$/;
    if (!phoneRegex.test(value)) {
      return helpers.error('any.invalid');
    }
    return value;
  },

  hexColor: (value: string, helpers: any) => {
    const hexColorRegex = /^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/;
    if (!hexColorRegex.test(value)) {
      return helpers.error('any.invalid');
    }
    return value;
  },

  ipAddress: (value: string, helpers: any) => {
    const ipv4Regex = /^(\d{1,3}\.){3}\d{1,3}$/;
    const ipv6Regex = /^([0-9a-fA-F]{1,4}:){7}[0-9a-fA-F]{1,4}$/;
    
    if (!ipv4Regex.test(value) && !ipv6Regex.test(value)) {
      return helpers.error('any.invalid');
    }

    // Validate IPv4 octets
    if (ipv4Regex.test(value)) {
      const octets = value.split('.');
      for (const octet of octets) {
        const num = parseInt(octet, 10);
        if (num < 0 || num > 255) {
          return helpers.error('any.invalid');
        }
      }
    }

    return value;
  },

  macAddress: (value: string, helpers: any) => {
    const macRegex = /^([0-9A-Fa-f]{2}[:-]){5}([0-9A-Fa-f]{2})$/;
    if (!macRegex.test(value)) {
      return helpers.error('any.invalid');
    }
    return value;
  },

  url: (value: string, helpers: any) => {
    try {
      new URL(value);
      return value;
    } catch {
      return helpers.error('any.invalid');
    }
  },

  cronExpression: (value: string, helpers: any) => {
    // Basic cron validation (5 or 6 fields)
    const parts = value.split(' ');
    if (parts.length < 5 || parts.length > 6) {
      return helpers.error('any.invalid');
    }
    return value;
  },

  latitude: (value: number, helpers: any) => {
    if (value < -90 || value > 90) {
      return helpers.error('number.min', { limit: -90 });
    }
    return value;
  },

  longitude: (value: number, helpers: any) => {
    if (value < -180 || value > 180) {
      return helpers.error('number.min', { limit: -180 });
    }
    return value;
  },

  timezone: (value: string, helpers: any) => {
    try {
      Intl.DateTimeFormat(undefined, { timeZone: value });
      return value;
    } catch {
      return helpers.error('any.invalid');
    }
  },

  iso8601Date: (value: string, helpers: any) => {
    const date = new Date(value);
    if (isNaN(date.getTime())) {
      return helpers.error('any.invalid');
    }
    return value;
  },

  base64: (value: string, helpers: any) => {
    const base64Regex = /^[A-Za-z0-9+/]*={0,2}$/;
    if (!base64Regex.test(value)) {
      return helpers.error('any.invalid');
    }
    return value;
  },

  jwt: (value: string, helpers: any) => {
    const parts = value.split('.');
    if (parts.length !== 3) {
      return helpers.error('any.invalid');
    }
    return value;
  },

  semver: (value: string, helpers: any) => {
    const semverRegex = /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-((?:0|[1-9]\d*|\d*[a-zA-Z-][0-9a-zA-Z-]*)(?:\.(?:0|[1-9]\d*|\d*[a-zA-Z-][0-9a-zA-Z-]*))*))?(?:\+([0-9a-zA-Z-]+(?:\.[0-9a-zA-Z-]+)*))?$/;
    if (!semverRegex.test(value)) {
      return helpers.error('any.invalid');
    }
    return value;
  },
};

// Sanitization helpers
export const sanitizers = {
  trim: (value: string): string => {
    return typeof value === 'string' ? value.trim() : value;
  },

  lowercase: (value: string): string => {
    return typeof value === 'string' ? value.toLowerCase() : value;
  },

  uppercase: (value: string): string => {
    return typeof value === 'string' ? value.toUpperCase() : value;
  },

  removeWhitespace: (value: string): string => {
    return typeof value === 'string' ? value.replace(/\s+/g, '') : value;
  },

  normalizeEmail: (value: string): string => {
    if (typeof value !== 'string') return value;
    return value.toLowerCase().trim();
  },

  normalizePhone: (value: string): string => {
    if (typeof value !== 'string') return value;
    return value.replace(/[^\d+]/g, '');
  },

  escapeHtml: (value: string): string => {
    if (typeof value !== 'string') return value;
    return value
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#x27;')
      .replace(/\//g, '&#x2F;');
  },

  stripTags: (value: string): string => {
    if (typeof value !== 'string') return value;
    return value.replace(/<[^>]*>/g, '');
  },

  truncate: (value: string, maxLength: number): string => {
    if (typeof value !== 'string') return value;
    if (value.length <= maxLength) return value;
    return value.substring(0, maxLength) + '...';
  },

  slugify: (value: string): string => {
    if (typeof value !== 'string') return value;
    return value
      .toLowerCase()
      .trim()
      .replace(/[^\w\s-]/g, '')
      .replace(/[\s_-]+/g, '-')
      .replace(/^-+|-+$/g, '');
  },
};

// Validation error formatter
export function formatValidationError(error: ValidationError): any {
  return {
    message: 'Validation failed',
    errors: error.details.map(detail => ({
      field: detail.path.join('.'),
      message: detail.message,
      type: detail.type,
      value: detail.context?.value,
    })),
  };
}

// Request sanitization middleware
export function sanitizeRequest(fields: string[] = ['body', 'query', 'params']) {
  return (req: Request, res: Response, next: NextFunction): void => {
    for (const field of fields) {
      if (req[field as keyof Request] && typeof req[field as keyof Request] === 'object') {
        req[field as keyof Request] = sanitizeObject(req[field as keyof Request] as any);
      }
    }
    next();
  };
}

function sanitizeObject(obj: any): any {
  if (typeof obj !== 'object' || obj === null) {
    return obj;
  }

  if (Array.isArray(obj)) {
    return obj.map(item => sanitizeObject(item));
  }

  const sanitized: any = {};
  for (const [key, value] of Object.entries(obj)) {
    if (typeof value === 'string') {
      sanitized[key] = sanitizers.trim(value);
    } else if (typeof value === 'object') {
      sanitized[key] = sanitizeObject(value);
    } else {
      sanitized[key] = value;
    }
  }

  return sanitized;
}

// File upload validation
export function validateFileUpload(options: {
  maxSize?: number; // in bytes
  allowedMimeTypes?: string[];
  allowedExtensions?: string[];
  required?: boolean;
}) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const file = (req as any).file;
    const files = (req as any).files;

    if (!file && !files) {
      if (options.required) {
        return next(new AppError('File upload is required', 400, 'FILE_REQUIRED'));
      }
      return next();
    }

    const filesToValidate = file ? [file] : files;

    for (const f of filesToValidate) {
      // Check file size
      if (options.maxSize && f.size > options.maxSize) {
        return next(new AppError(
          `File size exceeds maximum allowed size of ${options.maxSize} bytes`,
          400,
          'FILE_TOO_LARGE'
        ));
      }

      // Check MIME type
      if (options.allowedMimeTypes && !options.allowedMimeTypes.includes(f.mimetype)) {
        return next(new AppError(
          `File type ${f.mimetype} is not allowed`,
          400,
          'INVALID_FILE_TYPE'
        ));
      }

      // Check file extension
      if (options.allowedExtensions) {
        const ext = f.originalname.split('.').pop()?.toLowerCase();
        if (!ext || !options.allowedExtensions.includes(ext)) {
          return next(new AppError(
            `File extension .${ext} is not allowed`,
            400,
            'INVALID_FILE_EXTENSION'
          ));
        }
      }
    }

    next();
  };
}

// Pagination validation
export function validatePagination(options: {
  maxLimit?: number;
  defaultLimit?: number;
  defaultPage?: number;
} = {}) {
  const maxLimit = options.maxLimit || 100;
  const defaultLimit = options.defaultLimit || 20;
  const defaultPage = options.defaultPage || 1;

  return (req: Request, res: Response, next: NextFunction): void => {
    let page = parseInt(req.query.page as string) || defaultPage;
    let limit = parseInt(req.query.limit as string) || defaultLimit;

    if (page < 1) page = 1;
    if (limit < 1) limit = defaultLimit;
    if (limit > maxLimit) limit = maxLimit;

    req.query.page = page.toString();
    req.query.limit = limit.toString();

    next();
  };
}

// Date range validation
export function validateDateRange(startField: string = 'startDate', endField: string = 'endDate') {
  return (req: Request, res: Response, next: NextFunction): void => {
    const startDate = req.query[startField] as string;
    const endDate = req.query[endField] as string;

    if (startDate && endDate) {
      const start = new Date(startDate);
      const end = new Date(endDate);

      if (isNaN(start.getTime())) {
        return next(new AppError(`Invalid ${startField}`, 400, 'INVALID_DATE'));
      }

      if (isNaN(end.getTime())) {
        return next(new AppError(`Invalid ${endField}`, 400, 'INVALID_DATE'));
      }

      if (start > end) {
        return next(new AppError(
          `${startField} must be before ${endField}`,
          400,
          'INVALID_DATE_RANGE'
        ));
      }
    }

    next();
  };
}
