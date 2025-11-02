import rateLimit from 'express-rate-limit';
import Redis from 'ioredis';

const redis = new Redis({
  host: process.env.REDIS_HOST || 'localhost',
  port: parseInt(process.env.REDIS_PORT || '6379'),
});

export const rateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  message: 'Too many requests from this IP',
  standardHeaders: true,
  legacyHeaders: false,
  store: {
    async increment(key: string) {
      const count = await redis.incr(key);
      if (count === 1) {
        await redis.expire(key, 900);
      }
      return { totalHits: count, resetTime: new Date(Date.now() + 900000) };
    },
    async decrement(key: string) {
      await redis.decr(key);
    },
    async resetKey(key: string) {
      await redis.del(key);
    },
  },
});
