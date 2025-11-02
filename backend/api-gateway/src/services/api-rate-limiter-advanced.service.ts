import Redis from 'ioredis';
import { EventEmitter } from 'events';

interface RateLimitConfig {
  windowMs: number;
  maxRequests: number;
  skipSuccessfulRequests?: boolean;
  skipFailedRequests?: boolean;
  keyGenerator?: (req: any) => string;
}

interface RateLimitInfo {
  limit: number;
  current: number;
  remaining: number;
  resetTime: Date;
}

export class ApiRateLimiterAdvancedService extends EventEmitter {
  private redis: Redis;
  private configs: Map<string, RateLimitConfig>;

  constructor() {
    super();
    this.redis = new Redis({
      host: process.env.REDIS_HOST || 'localhost',
      port: parseInt(process.env.REDIS_PORT || '6379'),
      password: process.env.REDIS_PASSWORD,
    });
    this.configs = new Map();
  }

  public setConfig(endpoint: string, config: RateLimitConfig): void {
    this.configs.set(endpoint, config);
  }

  public async checkRateLimit(key: string, endpoint: string): Promise<RateLimitInfo> {
    const config = this.configs.get(endpoint) || {
      windowMs: 60000,
      maxRequests: 100,
    };

    const now = Date.now();
    const windowStart = now - config.windowMs;
    const redisKey = `ratelimit:${endpoint}:${key}`;

    await this.redis.zremrangebyscore(redisKey, 0, windowStart);

    const requestCount = await this.redis.zcard(redisKey);

    const resetTime = new Date(now + config.windowMs);

    const info: RateLimitInfo = {
      limit: config.maxRequests,
      current: requestCount,
      remaining: Math.max(0, config.maxRequests - requestCount),
      resetTime,
    };

    if (requestCount >= config.maxRequests) {
      this.emit('rateLimitExceeded', { key, endpoint, info });
    }

    return info;
  }

  public async incrementRateLimit(key: string, endpoint: string): Promise<void> {
    const config = this.configs.get(endpoint) || {
      windowMs: 60000,
      maxRequests: 100,
    };

    const now = Date.now();
    const redisKey = `ratelimit:${endpoint}:${key}`;

    const pipeline = this.redis.pipeline();
    pipeline.zadd(redisKey, now, `${now}-${Math.random()}`);
    pipeline.expire(redisKey, Math.ceil(config.windowMs / 1000));
    await pipeline.exec();
  }

  public async resetRateLimit(key: string, endpoint: string): Promise<void> {
    const redisKey = `ratelimit:${endpoint}:${key}`;
    await this.redis.del(redisKey);
    this.emit('rateLimitReset', { key, endpoint });
  }

  public async getRateLimitStats(endpoint: string): Promise<any> {
    const pattern = `ratelimit:${endpoint}:*`;
    const keys = await this.redis.keys(pattern);

    const stats = {
      endpoint,
      totalKeys: keys.length,
      activeUsers: keys.length,
      averageRequests: 0,
      peakRequests: 0,
    };

    if (keys.length === 0) return stats;

    let totalRequests = 0;
    let maxRequests = 0;

    for (const key of keys) {
      const count = await this.redis.zcard(key);
      totalRequests += count;
      if (count > maxRequests) {
        maxRequests = count;
      }
    }

    stats.averageRequests = totalRequests / keys.length;
    stats.peakRequests = maxRequests;

    return stats;
  }

  public async getTopConsumers(endpoint: string, limit: number = 10): Promise<any[]> {
    const pattern = `ratelimit:${endpoint}:*`;
    const keys = await this.redis.keys(pattern);

    const consumers: any[] = [];

    for (const key of keys) {
      const count = await this.redis.zcard(key);
      const userKey = key.replace(`ratelimit:${endpoint}:`, '');
      consumers.push({ key: userKey, requests: count });
    }

    return consumers.sort((a, b) => b.requests - a.requests).slice(0, limit);
  }

  public async implementDynamicRateLimit(key: string, endpoint: string, behavior: 'good' | 'bad'): Promise<void> {
    const config = this.configs.get(endpoint);
    if (!config) return;

    const adjustmentKey = `ratelimit:adjustment:${endpoint}:${key}`;
    let adjustment = parseInt(await this.redis.get(adjustmentKey) || '0');

    if (behavior === 'good') {
      adjustment = Math.min(adjustment + 10, 100);
    } else {
      adjustment = Math.max(adjustment - 20, -50);
    }

    await this.redis.setex(adjustmentKey, 3600, adjustment.toString());

    this.emit('rateLimitAdjusted', { key, endpoint, adjustment });
  }

  public async getAdjustedLimit(key: string, endpoint: string): Promise<number> {
    const config = this.configs.get(endpoint);
    if (!config) return 100;

    const adjustmentKey = `ratelimit:adjustment:${endpoint}:${key}`;
    const adjustment = parseInt(await this.redis.get(adjustmentKey) || '0');

    const adjustedLimit = Math.floor(config.maxRequests * (1 + adjustment / 100));
    return Math.max(1, adjustedLimit);
  }

  public async implementBurstProtection(key: string, endpoint: string, burstLimit: number, burstWindowMs: number): Promise<boolean> {
    const now = Date.now();
    const windowStart = now - burstWindowMs;
    const burstKey = `ratelimit:burst:${endpoint}:${key}`;

    await this.redis.zremrangebyscore(burstKey, 0, windowStart);

    const burstCount = await this.redis.zcard(burstKey);

    if (burstCount >= burstLimit) {
      this.emit('burstLimitExceeded', { key, endpoint, burstCount, burstLimit });
      return false;
    }

    const pipeline = this.redis.pipeline();
    pipeline.zadd(burstKey, now, `${now}-${Math.random()}`);
    pipeline.expire(burstKey, Math.ceil(burstWindowMs / 1000));
    await pipeline.exec();

    return true;
  }

  public async implementConcurrencyLimit(key: string, endpoint: string, maxConcurrent: number): Promise<boolean> {
    const concurrencyKey = `ratelimit:concurrent:${endpoint}:${key}`;
    const current = await this.redis.incr(concurrencyKey);

    if (current > maxConcurrent) {
      await this.redis.decr(concurrencyKey);
      this.emit('concurrencyLimitExceeded', { key, endpoint, current, maxConcurrent });
      return false;
    }

    await this.redis.expire(concurrencyKey, 60);
    return true;
  }

  public async releaseConcurrencySlot(key: string, endpoint: string): Promise<void> {
    const concurrencyKey = `ratelimit:concurrent:${endpoint}:${key}`;
    await this.redis.decr(concurrencyKey);
  }
}

export const apiRateLimiterAdvanced = new ApiRateLimiterAdvancedService();
