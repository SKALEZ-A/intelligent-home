import { Request, Response, NextFunction } from 'express';
import xss from 'xss';
import validator from 'validator';

interface SanitizationOptions {
  allowedTags?: string[];
  allowedAttributes?: { [key: string]: string[] };
  stripIgnoreTag?: boolean;
  stripIgnoreTagBody?: string[];
}

export class RequestSanitizer {
  private options: SanitizationOptions;
  private dangerousPatterns: RegExp[];

  constructor(options: SanitizationOptions = {}) {
    this.options = {
      allowedTags: options.allowedTags || [],
      allowedAttributes: options.allowedAttributes || {},
      stripIgnoreTag: options.stripIgnoreTag !== false,
      stripIgnoreTagBody: options.stripIgnoreTagBody || ['script', 'style'],
    };

    this.dangerousPatterns = [
      /<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi,
      /javascript:/gi,
      /on\w+\s*=/gi,
      /<iframe/gi,
      /<object/gi,
      /<embed/gi,
      /eval\(/gi,
      /expression\(/gi,
    ];
  }

  public middleware() {
    return (req: Request, res: Response, next: NextFunction) => {
      try {
        if (req.body) {
          req.body = this.sanitizeObject(req.body);
        }

        if (req.query) {
          req.query = this.sanitizeObject(req.query);
        }

        if (req.params) {
          req.params = this.sanitizeObject(req.params);
        }

        next();
      } catch (error) {
        res.status(400).json({
          error: 'Invalid request data',
          message: 'Request contains potentially malicious content',
        });
      }
    };
  }

  private sanitizeObject(obj: any): any {
    if (typeof obj === 'string') {
      return this.sanitizeString(obj);
    }

    if (Array.isArray(obj)) {
      return obj.map(item => this.sanitizeObject(item));
    }

    if (obj !== null && typeof obj === 'object') {
      const sanitized: any = {};
      for (const key in obj) {
        if (obj.hasOwnProperty(key)) {
          const sanitizedKey = this.sanitizeString(key);
          sanitized[sanitizedKey] = this.sanitizeObject(obj[key]);
        }
      }
      return sanitized;
    }

    return obj;
  }

  private sanitizeString(str: string): string {
    if (typeof str !== 'string') return str;

    // Check for dangerous patterns
    for (const pattern of this.dangerousPatterns) {
      if (pattern.test(str)) {
        throw new Error('Dangerous content detected');
      }
    }

    // XSS sanitization
    let sanitized = xss(str, {
      whiteList: this.options.allowedTags?.reduce((acc, tag) => {
        acc[tag] = this.options.allowedAttributes?.[tag] || [];
        return acc;
      }, {} as any) || {},
      stripIgnoreTag: this.options.stripIgnoreTag,
      stripIgnoreTagBody: this.options.stripIgnoreTagBody,
    });

    // SQL injection prevention
    sanitized = sanitized.replace(/['";\\]/g, '');

    // NoSQL injection prevention
    sanitized = sanitized.replace(/[${}]/g, '');

    // Path traversal prevention
    sanitized = sanitized.replace(/\.\.\//g, '');

    // Command injection prevention
    sanitized = sanitized.replace(/[;&|`$()]/g, '');

    return sanitized.trim();
  }

  public sanitizeEmail(email: string): string {
    if (!validator.isEmail(email)) {
      throw new Error('Invalid email format');
    }
    return validator.normalizeEmail(email) || email;
  }

  public sanitizeUrl(url: string): string {
    if (!validator.isURL(url, { protocols: ['http', 'https'], require_protocol: true })) {
      throw new Error('Invalid URL format');
    }
    return validator.escape(url);
  }

  public sanitizeFilename(filename: string): string {
    return filename.replace(/[^a-zA-Z0-9._-]/g, '_');
  }

  public sanitizeHtml(html: string): string {
    return xss(html, {
      whiteList: {
        p: [],
        br: [],
        strong: [],
        em: [],
        u: [],
        a: ['href', 'title'],
        ul: [],
        ol: [],
        li: [],
      },
    });
  }
}

export const requestSanitizer = new RequestSanitizer();
