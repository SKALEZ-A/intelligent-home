import { logger } from './logger';

export interface TransformRule {
  field: string;
  from: string | RegExp;
  to: string | ((value: any) => any);
  condition?: (data: any) => boolean;
}

export interface ValidationRule {
  field: string;
  type: 'string' | 'number' | 'boolean' | 'array' | 'object' | 'date' | 'email' | 'url';
  required?: boolean;
  min?: number;
  max?: number;
  pattern?: RegExp;
  custom?: (value: any) => boolean;
  message?: string;
}

export class DataTransformer {
  private transformRules: TransformRule[] = [];
  private validationRules: ValidationRule[] = [];

  addTransformRule(rule: TransformRule): void {
    this.transformRules.push(rule);
  }

  addValidationRule(rule: ValidationRule): void {
    this.validationRules.push(rule);
  }

  transform<T = any>(data: any): T {
    let transformed = { ...data };

    for (const rule of this.transformRules) {
      if (rule.condition && !rule.condition(transformed)) {
        continue;
      }

      const value = this.getNestedValue(transformed, rule.field);
      if (value === undefined) continue;

      let newValue: any;

      if (typeof rule.to === 'function') {
        newValue = rule.to(value);
      } else if (typeof rule.from === 'string') {
        newValue = String(value).replace(rule.from, rule.to);
      } else {
        newValue = String(value).replace(rule.from, rule.to);
      }

      this.setNestedValue(transformed, rule.field, newValue);
    }

    return transformed as T;
  }

  validate(data: any): { valid: boolean; errors: string[] } {
    const errors: string[] = [];

    for (const rule of this.validationRules) {
      const value = this.getNestedValue(data, rule.field);

      // Check required
      if (rule.required && (value === undefined || value === null || value === '')) {
        errors.push(rule.message || `${rule.field} is required`);
        continue;
      }

      // Skip validation if value is not required and is empty
      if (!rule.required && (value === undefined || value === null || value === '')) {
        continue;
      }

      // Type validation
      if (!this.validateType(value, rule.type)) {
        errors.push(rule.message || `${rule.field} must be of type ${rule.type}`);
        continue;
      }

      // Min/Max validation
      if (rule.min !== undefined) {
        if (typeof value === 'number' && value < rule.min) {
          errors.push(rule.message || `${rule.field} must be at least ${rule.min}`);
        } else if (typeof value === 'string' && value.length < rule.min) {
          errors.push(rule.message || `${rule.field} must be at least ${rule.min} characters`);
        } else if (Array.isArray(value) && value.length < rule.min) {
          errors.push(rule.message || `${rule.field} must have at least ${rule.min} items`);
        }
      }

      if (rule.max !== undefined) {
        if (typeof value === 'number' && value > rule.max) {
          errors.push(rule.message || `${rule.field} must be at most ${rule.max}`);
        } else if (typeof value === 'string' && value.length > rule.max) {
          errors.push(rule.message || `${rule.field} must be at most ${rule.max} characters`);
        } else if (Array.isArray(value) && value.length > rule.max) {
          errors.push(rule.message || `${rule.field} must have at most ${rule.max} items`);
        }
      }

      // Pattern validation
      if (rule.pattern && typeof value === 'string' && !rule.pattern.test(value)) {
        errors.push(rule.message || `${rule.field} format is invalid`);
      }

      // Custom validation
      if (rule.custom && !rule.custom(value)) {
        errors.push(rule.message || `${rule.field} validation failed`);
      }
    }

    return {
      valid: errors.length === 0,
      errors
    };
  }

  private validateType(value: any, type: string): boolean {
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
        return typeof value === 'object' && value !== null && !Array.isArray(value);
      case 'date':
        return value instanceof Date || !isNaN(Date.parse(value));
      case 'email':
        return typeof value === 'string' && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
      case 'url':
        try {
          new URL(value);
          return true;
        } catch {
          return false;
        }
      default:
        return true;
    }
  }

  private getNestedValue(obj: any, path: string): any {
    return path.split('.').reduce((current, key) => current?.[key], obj);
  }

  private setNestedValue(obj: any, path: string, value: any): void {
    const keys = path.split('.');
    const lastKey = keys.pop()!;
    const target = keys.reduce((current, key) => {
      if (!current[key]) current[key] = {};
      return current[key];
    }, obj);
    target[lastKey] = value;
  }

  // Utility methods for common transformations
  static camelToSnake(str: string): string {
    return str.replace(/[A-Z]/g, letter => `_${letter.toLowerCase()}`);
  }

  static snakeToCamel(str: string): string {
    return str.replace(/_([a-z])/g, (_, letter) => letter.toUpperCase());
  }

  static deepCamelToSnake(obj: any): any {
    if (Array.isArray(obj)) {
      return obj.map(item => DataTransformer.deepCamelToSnake(item));
    } else if (obj !== null && typeof obj === 'object') {
      return Object.keys(obj).reduce((result, key) => {
        const snakeKey = DataTransformer.camelToSnake(key);
        result[snakeKey] = DataTransformer.deepCamelToSnake(obj[key]);
        return result;
      }, {} as any);
    }
    return obj;
  }

  static deepSnakeToCamel(obj: any): any {
    if (Array.isArray(obj)) {
      return obj.map(item => DataTransformer.deepSnakeToCamel(item));
    } else if (obj !== null && typeof obj === 'object') {
      return Object.keys(obj).reduce((result, key) => {
        const camelKey = DataTransformer.snakeToCamel(key);
        result[camelKey] = DataTransformer.deepSnakeToCamel(obj[key]);
        return result;
      }, {} as any);
    }
    return obj;
  }

  static sanitize(data: any, allowedFields: string[]): any {
    if (Array.isArray(data)) {
      return data.map(item => DataTransformer.sanitize(item, allowedFields));
    } else if (data !== null && typeof data === 'object') {
      return Object.keys(data).reduce((result, key) => {
        if (allowedFields.includes(key)) {
          result[key] = data[key];
        }
        return result;
      }, {} as any);
    }
    return data;
  }

  static mask(data: any, fieldsToMask: string[], maskChar: string = '*'): any {
    const masked = { ...data };
    
    for (const field of fieldsToMask) {
      const value = this.prototype.getNestedValue(masked, field);
      if (value !== undefined && typeof value === 'string') {
        const visibleChars = Math.min(4, Math.floor(value.length / 4));
        const maskedValue = value.slice(0, visibleChars) + maskChar.repeat(value.length - visibleChars);
        this.prototype.setNestedValue(masked, field, maskedValue);
      }
    }

    return masked;
  }

  static flatten(obj: any, prefix: string = ''): Record<string, any> {
    const flattened: Record<string, any> = {};

    for (const [key, value] of Object.entries(obj)) {
      const newKey = prefix ? `${prefix}.${key}` : key;

      if (value !== null && typeof value === 'object' && !Array.isArray(value)) {
        Object.assign(flattened, DataTransformer.flatten(value, newKey));
      } else {
        flattened[newKey] = value;
      }
    }

    return flattened;
  }

  static unflatten(obj: Record<string, any>): any {
    const result: any = {};

    for (const [key, value] of Object.entries(obj)) {
      const keys = key.split('.');
      let current = result;

      for (let i = 0; i < keys.length - 1; i++) {
        if (!current[keys[i]]) {
          current[keys[i]] = {};
        }
        current = current[keys[i]];
      }

      current[keys[keys.length - 1]] = value;
    }

    return result;
  }

  static pick<T extends object, K extends keyof T>(obj: T, keys: K[]): Pick<T, K> {
    const result = {} as Pick<T, K>;
    for (const key of keys) {
      if (key in obj) {
        result[key] = obj[key];
      }
    }
    return result;
  }

  static omit<T extends object, K extends keyof T>(obj: T, keys: K[]): Omit<T, K> {
    const result = { ...obj };
    for (const key of keys) {
      delete result[key];
    }
    return result;
  }

  static merge<T extends object>(...objects: Partial<T>[]): T {
    return objects.reduce((result, obj) => {
      for (const [key, value] of Object.entries(obj)) {
        if (value !== null && typeof value === 'object' && !Array.isArray(value)) {
          result[key as keyof T] = DataTransformer.merge(
            result[key as keyof T] as any || {},
            value
          ) as any;
        } else {
          result[key as keyof T] = value as any;
        }
      }
      return result;
    }, {} as T);
  }

  static clone<T>(obj: T): T {
    if (obj === null || typeof obj !== 'object') {
      return obj;
    }

    if (obj instanceof Date) {
      return new Date(obj.getTime()) as any;
    }

    if (Array.isArray(obj)) {
      return obj.map(item => DataTransformer.clone(item)) as any;
    }

    const cloned = {} as T;
    for (const key in obj) {
      if (obj.hasOwnProperty(key)) {
        cloned[key] = DataTransformer.clone(obj[key]);
      }
    }

    return cloned;
  }

  static diff(obj1: any, obj2: any): any {
    const changes: any = {};

    const allKeys = new Set([...Object.keys(obj1), ...Object.keys(obj2)]);

    for (const key of allKeys) {
      const val1 = obj1[key];
      const val2 = obj2[key];

      if (val1 === val2) continue;

      if (val1 !== null && val2 !== null && typeof val1 === 'object' && typeof val2 === 'object') {
        const nestedDiff = DataTransformer.diff(val1, val2);
        if (Object.keys(nestedDiff).length > 0) {
          changes[key] = nestedDiff;
        }
      } else {
        changes[key] = { from: val1, to: val2 };
      }
    }

    return changes;
  }

  static normalize(data: any, schema: Record<string, any>): any {
    const normalized: any = {};

    for (const [key, config] of Object.entries(schema)) {
      const value = data[key];

      if (value === undefined || value === null) {
        if (config.default !== undefined) {
          normalized[key] = config.default;
        }
        continue;
      }

      switch (config.type) {
        case 'string':
          normalized[key] = String(value);
          break;
        case 'number':
          normalized[key] = Number(value);
          break;
        case 'boolean':
          normalized[key] = Boolean(value);
          break;
        case 'date':
          normalized[key] = new Date(value);
          break;
        case 'array':
          normalized[key] = Array.isArray(value) ? value : [value];
          break;
        default:
          normalized[key] = value;
      }

      if (config.transform) {
        normalized[key] = config.transform(normalized[key]);
      }
    }

    return normalized;
  }

  static aggregate(data: any[], groupBy: string, aggregations: Record<string, 'sum' | 'avg' | 'min' | 'max' | 'count'>): any[] {
    const groups = new Map<any, any[]>();

    // Group data
    for (const item of data) {
      const key = item[groupBy];
      if (!groups.has(key)) {
        groups.set(key, []);
      }
      groups.get(key)!.push(item);
    }

    // Aggregate
    const results: any[] = [];
    for (const [key, items] of groups.entries()) {
      const result: any = { [groupBy]: key };

      for (const [field, operation] of Object.entries(aggregations)) {
        const values = items.map(item => item[field]).filter(v => typeof v === 'number');

        switch (operation) {
          case 'sum':
            result[field] = values.reduce((sum, val) => sum + val, 0);
            break;
          case 'avg':
            result[field] = values.length > 0 ? values.reduce((sum, val) => sum + val, 0) / values.length : 0;
            break;
          case 'min':
            result[field] = values.length > 0 ? Math.min(...values) : null;
            break;
          case 'max':
            result[field] = values.length > 0 ? Math.max(...values) : null;
            break;
          case 'count':
            result[field] = items.length;
            break;
        }
      }

      results.push(result);
    }

    return results;
  }
}

export const dataTransformer = new DataTransformer();
