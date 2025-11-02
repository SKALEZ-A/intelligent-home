import { createHash } from 'crypto';
import { Request, Response } from 'express';
import Redis from 'ioredis';
import { logger } from '../../../shared/utils/logger';

interface CacheConfig {
  ttl: number;
  keyPrefix: string;
  excludeHeaders?: string[];
  varyBy?: string[];
}

interface CachedResponse {
  statusCode: number;
  headers: Record<string, string>;
  body: any;
  timestamp: number;
  etag: string;
}

export class ApiResponseCacheService {
  private redis: Redis;
  private defaultTTL = 300; // 5 minutes
  private readonly keyPrefix = 'api:cache:';

  constructor() {
    this.redis = new Redis({
      host: process.env.REDIS_HOST || 'localhost',
      port: parseInt(process.env.REDIS_PORT || '6379'),
      password: process.env.REDIS_PASSWORD,
      db: parseInt(process.env.REDIS_CACHE_DB || '1'),
      retryStrategy: (times) => {
        const delay = Math.min(times * 50, 2000);
        return delay;
      }
    });

    this.redis.on('error', (error) => {
      logger.error('Redis cache connection error:', error);
    });
  }

  generateCacheKey(req: Request, varyBy: string[] = []): string {
    const parts = [
      req.method,
      req.path,
      JSON.stringify(req.query),
      ...varyBy.map(header => req.get(header) || '')
    ];

    const hash = createHash('sha256')
      .update(parts.join(':'))
      .digest('hex');

    return `${this.keyPrefix}${hash}`;
  }

  async get(key: string): Promise<CachedResponse | null> {
    try {
      const cached = await this.redis.get(key);
      if (!cached) return null;

      const response: CachedResponse = JSON.parse(cached);
      
      // Check if cache is still valid
      const age = Date.now() - response.timestamp;
      if (age > this.defaultTTL * 1000) {
        await this.delete(key);
        return null;
      }

      return response;
    } catch (error) {
      logger.error('Cache get error:', error);
      return null;
    }
  }

  async set(key: string, response: CachedResponse, ttl?: number): Promise<void> {
    try {
      const cacheData = JSON.stringify(response);
      const cacheTTL = ttl || this.defaultTTL;
      
      await this.redis.setex(key, cacheTTL, cacheData);
      
      logger.debug(`Cached response for key: ${key}, TTL: ${cacheTTL}s`);
    } catch (error) {
      logger.error('Cache set error:', error);
    }
  }

  async delete(key: string): Promise<void> {
    try {
      await this.redis.del(key);
    } catch (error) {
      logger.error('Cache delete error:', error);
    }
  }

  async invalidatePattern(pattern: string): Promise<number> {
    try {
      const keys = await this.redis.keys(`${this.keyPrefix}${pattern}`);
      if (keys.length === 0) return 0;

      const deleted = await this.redis.del(...keys);
      logger.info(`Invalidated ${deleted} cache entries matching pattern: ${pattern}`);
      return deleted;
    } catch (error) {
      logger.error('Cache invalidation error:', error);
      return 0;
    }
  }

  async clear(): Promise<void> {
    try {
      const keys = await this.redis.keys(`${this.keyPrefix}*`);
      if (keys.length > 0) {
        await this.redis.del(...keys);
        logger.info(`Cleared ${keys.length} cache entries`);
      }
    } catch (error) {
      logger.error('Cache clear error:', error);
    }
  }

  middleware(config: Partial<CacheConfig> = {}) {
    const {
      ttl = this.defaultTTL,
      varyBy = ['authorization'],
      excludeHeaders = ['set-cookie', 'authorization']
    } = config;

    return async (req: Request, res: Response, next: Function) => {
      // Only cache GET requests
      if (req.method !== 'GET') {
        return next();
      }

      const cacheKey = this.generateCacheKey(req, varyBy);

      // Check if response is cached
      const cached = await this.get(cacheKey);
      if (cached) {
        // Set cached headers
        Object.entries(cached.headers).forEach(([key, value]) => {
          if (!excludeHeaders.includes(key.toLowerCase())) {
            res.setHeader(key, value);
          }
        });

        res.setHeader('X-Cache', 'HIT');
        res.setHeader('X-Cache-Age', Math.floor((Date.now() - cached.timestamp) / 1000).toString());
        
        return res.status(cached.statusCode).json(cached.body);
      }

      // Capture response
      const originalJson = res.json.bind(res);
      const originalSend = res.send.bind(res);

      res.json = function(body: any) {
        const response: CachedResponse = {
          statusCode: res.statusCode,
          headers: Object.fromEntries(
            Object.entries(res.getHeaders()).map(([k, v]) => [k, String(v)])
          ),
          body,
          timestamp: Date.now(),
          etag: createHash('md5').update(JSON.stringify(body)).digest('hex')
        };

        // Cache successful responses
        if (res.statusCode >= 200 && res.statusCode < 300) {
          apiResponseCache.set(cacheKey, response, ttl).catch(err => {
            logger.error('Failed to cache response:', err);
          });
        }

        res.setHeader('X-Cache', 'MISS');
        res.setHeader('ETag', response.etag);
        
        return originalJson(body);
      };

      res.send = function(body: any) {
        if (typeof body === 'object') {
          return res.json(body);
        }
        return originalSend(body);
      };

      next();
    };
  }

  async getStats(): Promise<{
    totalKeys: number;
    memoryUsage: string;
    hitRate: number;
  }> {
    try {
      const keys = await this.redis.keys(`${this.keyPrefix}*`);
      const info = await this.redis.info('memory');
      const memoryMatch = info.match(/used_memory_human:(.+)/);
      
      return {
        totalKeys: keys.length,
        memoryUsage: memoryMatch ? memoryMatch[1].trim() : 'unknown',
        hitRate: 0 // Would need to track hits/misses separately
      };
    } catch (error) {
      logger.error('Failed to get cache stats:', error);
      return {
        totalKeys: 0,
        memoryUsage: 'unknown',
        hitRate: 0
      };
    }
  }

  async disconnect(): Promise<void> {
    await this.redis.quit();
  }
}

export const apiResponseCache = new ApiResponseCacheService();
