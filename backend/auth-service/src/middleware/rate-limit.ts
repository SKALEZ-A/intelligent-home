import rateLimit from 'express-rate-limit';
import RedisStore from 'rate-limit-redis';
import { createClient } from 'redis';
import { createLogger } from '../../../shared/utils/logger';

const logger = createLogger('RateLimit');

const redisClient = createClient({
  url: process.env.REDIS_URL || 'redis://localhost:6379',
  socket: {
    reconnectStrategy: (retries) => Math.min(retries * 50, 500),
  },
});

redisClient.on('error', (err) => logger.error('Redis Client Error', err));
redisClient.connect().catch((err) => logger.error('Failed to connect to Redis', err));

export const rateLimitStrict = rateLimit({
  store: new RedisStore({
    // @ts-ignore - Redis client type mismatch
    client: redisClient,
    prefix: 'rl:strict:',
  }),
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // 5 requests per window
  message: {
    success: false,
    error: {
      code: 'RATE_LIMIT_EXCEEDED',
      message: 'Too many requests, please try again later',
    },
  },
  standardHeaders: true,
  legacyHeaders: false,
  skipSuccessfulRequests: false,
  skipFailedRequests: false,
  handler: (req, res) => {
    logger.warn('Rate limit exceeded', {
      ip: req.ip,
      path: req.path,
      method: req.method,
    });
    res.status(429).json({
      success: false,
      error: {
        code: 'RATE_LIMIT_EXCEEDED',
        message: 'Too many requests, please try again later',
        retryAfter: res.getHeader('Retry-After'),
      },
    });
  },
});

export const rateLimitModerate = rateLimit({
  store: new RedisStore({
    // @ts-ignore
    client: redisClient,
    prefix: 'rl:moderate:',
  }),
  windowMs: 15 * 60 * 1000,
  max: 50,
  message: {
    success: false,
    error: {
      code: 'RATE_LIMIT_EXCEEDED',
      message: 'Too many requests, please try again later',
    },
  },
  standardHeaders: true,
  legacyHeaders: false,
});

export const rateLimitGenerous = rateLimit({
  store: new RedisStore({
    // @ts-ignore
    client: redisClient,
    prefix: 'rl:generous:',
  }),
  windowMs: 15 * 60 * 1000,
  max: 200,
  message: {
    success: false,
    error: {
      code: 'RATE_LIMIT_EXCEEDED',
      message: 'Too many requests, please try again later',
    },
  },
  standardHeaders: true,
  legacyHeaders: false,
});

export const createDynamicRateLimit = (windowMs: number, max: number, prefix: string) => {
  return rateLimit({
    store: new RedisStore({
      // @ts-ignore
      client: redisClient,
      prefix: `rl:${prefix}:`,
    }),
    windowMs,
    max,
    standardHeaders: true,
    legacyHeaders: false,
  });
};
