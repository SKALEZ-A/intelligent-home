import { Request, Response, NextFunction } from 'express';
import { logger } from '../../shared/utils/logger';

interface TransformationRule {
  field: string;
  transform: (value: any) => any;
  condition?: (req: Request) => boolean;
}

export class RequestTransformer {
  private transformationRules: Map<string, TransformationRule[]> = new Map();

  constructor() {
    this.initializeDefaultRules();
  }

  private initializeDefaultRules(): void {
    this.addRule('body', {
      field: 'timestamp',
      transform: (value: any) => value || new Date().toISOString()
    });

    this.addRule('body', {
      field: 'userId',
      transform: (value: any) => value?.toString(),
      condition: (req) => !!req.body.userId
    });

    this.addRule('query', {
      field: 'limit',
      transform: (value: any) => Math.min(parseInt(value) || 10, 100)
    });

    this.addRule('query', {
      field: 'offset',
      transform: (value: any) => Math.max(parseInt(value) || 0, 0)
    });
  }

  addRule(target: 'body' | 'query' | 'params', rule: TransformationRule): void {
    const rules = this.transformationRules.get(target) || [];
    rules.push(rule);
    this.transformationRules.set(target, rules);
  }

  transform(req: Request): void {
    for (const [target, rules] of this.transformationRules.entries()) {
      const data = req[target as keyof Request] as any;
      if (!data) continue;

      for (const rule of rules) {
        if (rule.condition && !rule.condition(req)) continue;
        
        if (data[rule.field] !== undefined) {
          try {
            data[rule.field] = rule.transform(data[rule.field]);
          } catch (error) {
            logger.warn(`Failed to transform field ${rule.field}:`, error);
          }
        }
      }
    }
  }

  middleware() {
    return (req: Request, res: Response, next: NextFunction) => {
      try {
        this.transform(req);
        next();
      } catch (error) {
        logger.error('Request transformation error:', error);
        next(error);
      }
    };
  }
}

export const requestTransformer = new RequestTransformer();
export const transformRequest = requestTransformer.middleware();
