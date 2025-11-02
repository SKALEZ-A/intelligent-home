import Redis from 'ioredis';
import { logger } from './logger';

export class CacheService {
  private redis: Redis;
  private defaultTTL: number;

  constructor(redis: Redis, defaultTTL: number = 3600) {
    this.redis = redis;
    this.defaultTTL = defaultTTL;
  }

  async get<T>(key: string): Promise<T | null> {
    try {
      const value = await this.redis.get(key);
      if (!value) return null;
      
      return JSON.parse(value) as T;
    } catch (error) {
      logger.error('Cache get error:', { key, error });
      return null;
    }
  }

  async set(key: string, value: any, ttl?: number): Promise<boolean> {
    try {
      const serialized = JSON.stringify(value);
      const expiry = ttl || this.defaultTTL;
      
      await this.redis.setex(key, expiry, serialized);
      return true;
    } catch (error) {
      logger.error('Cache set error:', { key, error });
      return false;
    }
  }

  async delete(key: string): Promise<boolean> {
    try {
      await this.redis.del(key);
      return true;
    } catch (error) {
      logger.error('Cache delete error:', { key, error });
      return false;
    }
  }

  async deletePattern(pattern: string): Promise<number> {
    try {
      const keys = await this.redis.keys(pattern);
      if (keys.length === 0) return 0;
      
      await this.redis.del(...keys);
      return keys.length;
    } catch (error) {
      logger.error('Cache delete pattern error:', { pattern, error });
      return 0;
    }
  }

  async exists(key: string): Promise<boolean> {
    try {
      const result = await this.redis.exists(key);
      return result === 1;
    } catch (error) {
      logger.error('Cache exists error:', { key, error });
      return false;
    }
  }

  async increment(key: string, amount: number = 1): Promise<number> {
    try {
      return await this.redis.incrby(key, amount);
    } catch (error) {
      logger.error('Cache increment error:', { key, error });
      throw error;
    }
  }

  async decrement(key: string, amount: number = 1): Promise<number> {
    try {
      return await this.redis.decrby(key, amount);
    } catch (error) {
      logger.error('Cache decrement error:', { key, error });
      throw error;
    }
  }

  async getOrSet<T>(
    key: string,
    factory: () => Promise<T>,
    ttl?: number
  ): Promise<T> {
    try {
      const cached = await this.get<T>(key);
      if (cached !== null) return cached;

      const value = await factory();
      await this.set(key, value, ttl);
      return value;
    } catch (error) {
      logger.error('Cache getOrSet error:', { key, error });
      throw error;
    }
  }

  async mget<T>(keys: string[]): Promise<(T | null)[]> {
    try {
      const values = await this.redis.mget(...keys);
      return values.map(v => v ? JSON.parse(v) as T : null);
    } catch (error) {
      logger.error('Cache mget error:', { keys, error });
      return keys.map(() => null);
    }
  }

  async mset(entries: Array<{ key: string; value: any; ttl?: number }>): Promise<boolean> {
    try {
      const pipeline = this.redis.pipeline();
      
      for (const entry of entries) {
        const serialized = JSON.stringify(entry.value);
        const expiry = entry.ttl || this.defaultTTL;
        pipeline.setex(entry.key, expiry, serialized);
      }
      
      await pipeline.exec();
      return true;
    } catch (error) {
      logger.error('Cache mset error:', error);
      return false;
    }
  }

  async getTTL(key: string): Promise<number> {
    try {
      return await this.redis.ttl(key);
    } catch (error) {
      logger.error('Cache getTTL error:', { key, error });
      return -1;
    }
  }

  async expire(key: string, ttl: number): Promise<boolean> {
    try {
      const result = await this.redis.expire(key, ttl);
      return result === 1;
    } catch (error) {
      logger.error('Cache expire error:', { key, error });
      return false;
    }
  }

  async flush(): Promise<boolean> {
    try {
      await this.redis.flushdb();
      return true;
    } catch (error) {
      logger.error('Cache flush error:', error);
      return false;
    }
  }

  // Hash operations
  async hget<T>(key: string, field: string): Promise<T | null> {
    try {
      const value = await this.redis.hget(key, field);
      if (!value) return null;
      
      return JSON.parse(value) as T;
    } catch (error) {
      logger.error('Cache hget error:', { key, field, error });
      return null;
    }
  }

  async hset(key: string, field: string, value: any): Promise<boolean> {
    try {
      const serialized = JSON.stringify(value);
      await this.redis.hset(key, field, serialized);
      return true;
    } catch (error) {
      logger.error('Cache hset error:', { key, field, error });
      return false;
    }
  }

  async hgetall<T>(key: string): Promise<Record<string, T>> {
    try {
      const hash = await this.redis.hgetall(key);
      const result: Record<string, T> = {};
      
      for (const [field, value] of Object.entries(hash)) {
        result[field] = JSON.parse(value) as T;
      }
      
      return result;
    } catch (error) {
      logger.error('Cache hgetall error:', { key, error });
      return {};
    }
  }

  async hdel(key: string, ...fields: string[]): Promise<number> {
    try {
      return await this.redis.hdel(key, ...fields);
    } catch (error) {
      logger.error('Cache hdel error:', { key, fields, error });
      return 0;
    }
  }

  // List operations
  async lpush(key: string, ...values: any[]): Promise<number> {
    try {
      const serialized = values.map(v => JSON.stringify(v));
      return await this.redis.lpush(key, ...serialized);
    } catch (error) {
      logger.error('Cache lpush error:', { key, error });
      throw error;
    }
  }

  async rpush(key: string, ...values: any[]): Promise<number> {
    try {
      const serialized = values.map(v => JSON.stringify(v));
      return await this.redis.rpush(key, ...serialized);
    } catch (error) {
      logger.error('Cache rpush error:', { key, error });
      throw error;
    }
  }

  async lrange<T>(key: string, start: number, stop: number): Promise<T[]> {
    try {
      const values = await this.redis.lrange(key, start, stop);
      return values.map(v => JSON.parse(v) as T);
    } catch (error) {
      logger.error('Cache lrange error:', { key, error });
      return [];
    }
  }

  async llen(key: string): Promise<number> {
    try {
      return await this.redis.llen(key);
    } catch (error) {
      logger.error('Cache llen error:', { key, error });
      return 0;
    }
  }

  // Set operations
  async sadd(key: string, ...members: any[]): Promise<number> {
    try {
      const serialized = members.map(m => JSON.stringify(m));
      return await this.redis.sadd(key, ...serialized);
    } catch (error) {
      logger.error('Cache sadd error:', { key, error });
      throw error;
    }
  }

  async smembers<T>(key: string): Promise<T[]> {
    try {
      const members = await this.redis.smembers(key);
      return members.map(m => JSON.parse(m) as T);
    } catch (error) {
      logger.error('Cache smembers error:', { key, error });
      return [];
    }
  }

  async sismember(key: string, member: any): Promise<boolean> {
    try {
      const serialized = JSON.stringify(member);
      const result = await this.redis.sismember(key, serialized);
      return result === 1;
    } catch (error) {
      logger.error('Cache sismember error:', { key, error });
      return false;
    }
  }

  async srem(key: string, ...members: any[]): Promise<number> {
    try {
      const serialized = members.map(m => JSON.stringify(m));
      return await this.redis.srem(key, ...serialized);
    } catch (error) {
      logger.error('Cache srem error:', { key, error });
      return 0;
    }
  }
}

export function createCacheService(redis: Redis, defaultTTL?: number): CacheService {
  return new CacheService(redis, defaultTTL);
}
