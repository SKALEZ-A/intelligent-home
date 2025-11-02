import { Request, Response, NextFunction } from 'express';
import { ValidationError } from '../../../shared/utils/errors';
import { logger } from '../utils/logger';

interface ValidationRule {
  field: string;
  type: 'string' | 'number' | 'boolean' | 'array' | 'object' | 'email' | 'uuid';
  required?: boolean;
  min?: number;
  max?: number;
  pattern?: RegExp;
  enum?: any[];
  custom?: (value: any) => boolean;
}

export class RequestValidator {
  static validate(rules: ValidationRule[]) {
    return (req: Request, res: Response, next: NextFunction) => {
      const errors: string[] = [];
      const data = { ...req.body, ...req.query, ...req.params };

      for (const rule of rules) {
        const value = data[rule.field];

        if (rule.required && (value === undefined || value === null || value === '')) {
          errors.push(`${rule.field} is required`);
          continue;
        }

        if (value === undefined || value === null) continue;

        if (!this.validateType(value, rule.type)) {
          errors.push(`${rule.field} must be of type ${rule.type}`);
          continue;
        }

        if (rule.min !== undefined && this.getLength(value) < rule.min) {
          errors.push(`${rule.field} must be at least ${rule.min}`);
        }

        if (rule.max !== undefined && this.getLength(value) > rule.max) {
          errors.push(`${rule.field} must be at most ${rule.max}`);
        }

        if (rule.pattern && !rule.pattern.test(String(value))) {
          errors.push(`${rule.field} format is invalid`);
        }

        if (rule.enum && !rule.enum.includes(value)) {
          errors.push(`${rule.field} must be one of: ${rule.enum.join(', ')}`);
        }

        if (rule.custom && !rule.custom(value)) {
          errors.push(`${rule.field} validation failed`);
        }
      }

      if (errors.length > 0) {
        logger.warn('Validation failed', { errors, path: req.path });
        throw new ValidationError(errors.join('; '));
      }

      next();
    };
  }

  private static validateType(value: any, type: string): boolean {
    switch (type) {
      case 'string':
        return typeof value === 'string';
      case 'number':
        return typeof value === 'number' && !isNaN(value);
      case 'boolean':
        return typeof value === 'boolean';
      case 'array':
        return Array.isArray(value);
      case 'object':
        return typeof value === 'object' && !Array.isArray(value);
      case 'email':
        return typeof value === 'string' && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
      case 'uuid':
        return typeof value === 'string' && 
          /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);
      default:
        return true;
    }
  }

  private static getLength(value: any): number {
    if (typeof value === 'string' || Array.isArray(value)) {
      return value.length;
    }
    if (typeof value === 'number') {
      return value;
    }
    return 0;
  }
}
