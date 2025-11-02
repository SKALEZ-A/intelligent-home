import Joi from 'joi';

export class RequestValidator {
  static validatePagination(query: any): { page: number; limit: number } {
    const schema = Joi.object({
      page: Joi.number().integer().min(1).default(1),
      limit: Joi.number().integer().min(1).max(100).default(10)
    });

    const { error, value } = schema.validate(query);
    if (error) {
      throw new Error(`Pagination validation failed: ${error.message}`);
    }

    return value;
  }

  static validateSorting(query: any): { sortBy: string; sortOrder: 'asc' | 'desc' } {
    const schema = Joi.object({
      sortBy: Joi.string().default('createdAt'),
      sortOrder: Joi.string().valid('asc', 'desc').default('desc')
    });

    const { error, value } = schema.validate(query);
    if (error) {
      throw new Error(`Sorting validation failed: ${error.message}`);
    }

    return value;
  }

  static validateDateRange(query: any): { startDate?: Date; endDate?: Date } {
    const schema = Joi.object({
      startDate: Joi.date().iso().optional(),
      endDate: Joi.date().iso().min(Joi.ref('startDate')).optional()
    });

    const { error, value } = schema.validate(query);
    if (error) {
      throw new Error(`Date range validation failed: ${error.message}`);
    }

    return value;
  }

  static validateFilters(filters: any, allowedFields: string[]): any {
    const validFilters = {};
    
    Object.keys(filters).forEach(key => {
      if (allowedFields.includes(key)) {
        validFilters[key] = filters[key];
      }
    });

    return validFilters;
  }

  static sanitizeInput(input: string): string {
    return input
      .replace(/[<>]/g, '')
      .replace(/javascript:/gi, '')
      .replace(/on\w+=/gi, '')
      .trim();
  }

  static validateUUID(uuid: string): boolean {
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    return uuidRegex.test(uuid);
  }

  static validateEmail(email: string): boolean {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  }

  static validatePhoneNumber(phone: string): boolean {
    const phoneRegex = /^\+?[1-9]\d{1,14}$/;
    return phoneRegex.test(phone.replace(/[\s-()]/g, ''));
  }
}
