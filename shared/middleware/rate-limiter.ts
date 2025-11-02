import { Request, Response, NextFunction } from 'express';
import Redis from 'ioredis';
import { AppError } from '../utils/errors';
import { logger } from '../utils/logger';

export interface RateLimiterOptions {
  windowMs: number;
  maxRequests: number;
  keyGenerator?: (req: Request) => string;
  skipSuccessfulRequests?: boolean;
  skipFailedRequests?: boolean;
}

export class RateLimiter {
  private redis: Redis;
  private options: RateLimiterOptions;

  constructor(redis: Redis, options: RateLimiterOptions) {
    this.redis = redis;
    this.options = {
      keyGenerator: (req) => req.ip || 'unknown',
      skipSuccessfulRequests: false,
      skipFailedRequests: false,
      ...options,
    };
  }

  middleware() {
    return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
      try {
        const key = `rate_limit:${this.options.keyGenerator!(req)}`;
        const now = Date.now();
        const windowStart = now - this.options.windowMs;

        // Remove old entries
        await this.redis.zremrangebyscore(key, 0, windowStart);

        // Count requests in current window
        const requestCount = await this.redis.zcard(key);

        if (requestCount >= this.options.maxRequests) {
          const oldestRequest = await this.redis.zrange(key, 0, 0, 'WITHSCORES');
          const resetTime = oldestRequest.length > 0 
            ? parseInt(oldestRequest[1]) + this.options.windowMs 
            : now + this.options.windowMs;

          res.setHeader('X-RateLimit-Limit', this.options.maxRequests.toString());
          res.setHeader('X-RateLimit-Remaining', '0');
          res.setHeader('X-RateLimit-Reset', new Date(resetTime).toISOString());

          throw new AppError('Too many requests, please try again later', 429);
        }

        // Add current request
        await this.redis.zadd(key, now, `${now}-${Math.random()}`);
        await this.redis.expire(key, Math.ceil(this.options.windowMs / 1000));

        // Set rate limit headers
        res.setHeader('X-RateLimit-Limit', this.options.maxRequests.toString());
        res.setHeader('X-RateLimit-Remaining', (this.options.maxRequests - requestCount - 1).toString());
        res.setHeader('X-RateLimit-Reset', new Date(now + this.options.windowMs).toISOString());

        // Handle response to potentially remove request from count
        const originalSend = res.send;
        res.send = function (data: any) {
          const statusCode = res.statusCode;
          
          if (
            (this.options.skipSuccessfulRequests && statusCode < 400) ||
            (this.options.skipFailedRequests && statusCode >= 400)
          ) {
            this.redis.zrem(key, `${now}-${Math.random()}`).catch((err: any) => {
              logger.error('Failed to remove rate limit entry', err);
            });
          }

          return originalSend.call(res, data);
        }.bind(this);

        next();
      } catch (error) {
        next(error);
      }
    };
  }
}

export function createRateLimiter(redis: Redis, options: RateLimiterOptions) {
  const limiter = new RateLimiter(redis, options);
  return limiter.middleware();
}

// Preset rate limiters
export function createStrictRateLimiter(redis: Redis) {
  return createRateLimiter(redis, {
    windowMs: 15 * 60 * 1000, // 15 minutes
    maxRequests: 100,
  });
}

export function createModerateRateLimiter(redis: Redis) {
  return createRateLimiter(redis, {
    windowMs: 15 * 60 * 1000, // 15 minutes
    maxRequests: 500,
  });
}

export function createLenientRateLimiter(redis: Redis) {
  return createRateLimiter(redis, {
    windowMs: 15 * 60 * 1000, // 15 minutes
    maxRequests: 1000,
  });
}

export function createAuthRateLimiter(redis: Redis) {
  return createRateLimiter(redis, {
    windowMs: 15 * 60 * 1000, // 15 minutes
    maxRequests: 5,
    skipSuccessfulRequests: true,
  });
}
