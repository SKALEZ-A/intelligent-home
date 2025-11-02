import { Request, Response, NextFunction } from 'express';
import Redis from 'ioredis';

interface ThrottleConfig {
  windowMs: number;
  maxRequests: number;
  keyGenerator?: (req: Request) => string;
  skipSuccessfulRequests?: boolean;
  skipFailedRequests?: boolean;
}

export class ApiThrottlingMiddleware {
  private redis: Redis;
  private config: ThrottleConfig;

  constructor(redis: Redis, config: ThrottleConfig) {
    this.redis = redis;
    this.config = {
      skipSuccessfulRequests: false,
      skipFailedRequests: false,
      ...config
    };
  }

  private getKey(req: Request): string {
    if (this.config.keyGenerator) {
      return this.config.keyGenerator(req);
    }
    const ip = req.ip || req.connection.remoteAddress || 'unknown';
    const userId = (req as any).user?.id || 'anonymous';
    return `throttle:${userId}:${ip}:${req.path}`;
  }

  public middleware() {
    return async (req: Request, res: Response, next: NextFunction) => {
      try {
        const key = this.getKey(req);
        const current = await this.redis.incr(key);

        if (current === 1) {
          await this.redis.pexpire(key, this.config.windowMs);
        }

        const ttl = await this.redis.pttl(key);
        
        res.setHeader('X-RateLimit-Limit', this.config.maxRequests.toString());
        res.setHeader('X-RateLimit-Remaining', Math.max(0, this.config.maxRequests - current).toString());
        res.setHeader('X-RateLimit-Reset', new Date(Date.now() + ttl).toISOString());

        if (current > this.config.maxRequests) {
          res.status(429).json({
            error: 'Too Many Requests',
            message: 'Rate limit exceeded. Please try again later.',
            retryAfter: Math.ceil(ttl / 1000)
          });
          return;
        }

        const originalSend = res.send;
        res.send = function(data: any) {
          const statusCode = res.statusCode;
          const shouldSkip = 
            (statusCode >= 200 && statusCode < 300 && this.config.skipSuccessfulRequests) ||
            (statusCode >= 400 && this.config.skipFailedRequests);

          if (shouldSkip) {
            this.redis.decr(key);
          }

          return originalSend.call(this, data);
        }.bind(this);

        next();
      } catch (error) {
        console.error('Throttling middleware error:', error);
        next();
      }
    };
  }

  public async resetLimit(identifier: string): Promise<void> {
    const pattern = `throttle:${identifier}:*`;
    const keys = await this.redis.keys(pattern);
    if (keys.length > 0) {
      await this.redis.del(...keys);
    }
  }

  public async getCurrentUsage(identifier: string): Promise<{ [key: string]: number }> {
    const pattern = `throttle:${identifier}:*`;
    const keys = await this.redis.keys(pattern);
    const usage: { [key: string]: number } = {};

    for (const key of keys) {
      const count = await this.redis.get(key);
      usage[key] = parseInt(count || '0', 10);
    }

    return usage;
  }
}

export const createThrottlingMiddleware = (redis: Redis, config: ThrottleConfig) => {
  const throttler = new ApiThrottlingMiddleware(redis, config);
  return throttler.middleware();
};
