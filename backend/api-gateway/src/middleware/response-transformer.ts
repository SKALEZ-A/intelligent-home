import { Request, Response, NextFunction } from 'express';

interface TransformRule {
  condition: (req: Request, res: Response, body: any) => boolean;
  transform: (body: any, req: Request, res: Response) => any;
}

interface ResponseTransformerOptions {
  rules?: TransformRule[];
  wrapResponse?: boolean;
  includeMetadata?: boolean;
  camelCaseKeys?: boolean;
}

export class ResponseTransformerMiddleware {
  private options: ResponseTransformerOptions;

  constructor(options: ResponseTransformerOptions = {}) {
    this.options = {
      wrapResponse: false,
      includeMetadata: false,
      camelCaseKeys: false,
      rules: [],
      ...options
    };
  }

  private toCamelCase(str: string): string {
    return str.replace(/_([a-z])/g, (_, letter) => letter.toUpperCase());
  }

  private transformKeys(obj: any): any {
    if (Array.isArray(obj)) {
      return obj.map(item => this.transformKeys(item));
    }

    if (obj !== null && typeof obj === 'object') {
      return Object.keys(obj).reduce((acc, key) => {
        const camelKey = this.toCamelCase(key);
        acc[camelKey] = this.transformKeys(obj[key]);
        return acc;
      }, {} as any);
    }

    return obj;
  }

  private applyRules(body: any, req: Request, res: Response): any {
    let transformed = body;

    for (const rule of this.options.rules || []) {
      if (rule.condition(req, res, transformed)) {
        transformed = rule.transform(transformed, req, res);
      }
    }

    return transformed;
  }

  private wrapWithMetadata(body: any, req: Request, res: Response): any {
    const metadata: any = {
      timestamp: new Date().toISOString(),
      path: req.path,
      method: req.method,
      statusCode: res.statusCode
    };

    if ((req as any).apiVersion) {
      metadata.apiVersion = (req as any).apiVersion;
    }

    if ((req as any).requestId) {
      metadata.requestId = (req as any).requestId;
    }

    return {
      data: body,
      metadata,
      success: res.statusCode >= 200 && res.statusCode < 300
    };
  }

  public middleware() {
    return (req: Request, res: Response, next: NextFunction) => {
      const originalJson = res.json;
      const originalSend = res.send;

      res.json = function(this: Response, body: any): Response {
        let transformed = body;

        if (this.options.camelCaseKeys) {
          transformed = this.transformKeys(transformed);
        }

        transformed = this.applyRules(transformed, req, res);

        if (this.options.wrapResponse || this.options.includeMetadata) {
          transformed = this.wrapWithMetadata(transformed, req, res);
        }

        return originalJson.call(this, transformed);
      }.bind(this);

      res.send = function(this: Response, body: any): Response {
        if (typeof body === 'object' && body !== null) {
          return res.json(body);
        }
        return originalSend.call(this, body);
      }.bind(this);

      next();
    };
  }

  public addRule(rule: TransformRule): void {
    this.options.rules = this.options.rules || [];
    this.options.rules.push(rule);
  }
}

export const createResponseTransformer = (options?: ResponseTransformerOptions) => {
  const transformer = new ResponseTransformerMiddleware(options);
  return transformer.middleware();
};
