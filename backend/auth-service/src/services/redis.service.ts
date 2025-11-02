import { getRedisClient } from '../config/redis';
import { createLogger } from '../../../shared/utils/logger';

const logger = createLogger('RedisService');

export class RedisService {
  private client = getRedisClient();

  async set(key: string, value: string, expirySeconds?: number): Promise<void> {
    try {
      if (expirySeconds) {
        await this.client.setEx(key, expirySeconds, value);
      } else {
        await this.client.set(key, value);
      }
    } catch (error) {
      logger.error('Error setting Redis key', error as Error);
      throw error;
    }
  }

  async get(key: string): Promise<string | null> {
    try {
      return await this.client.get(key);
    } catch (error) {
      logger.error('Error getting Redis key', error as Error);
      throw error;
    }
  }

  async del(key: string): Promise<void> {
    try {
      await this.client.del(key);
    } catch (error) {
      logger.error('Error deleting Redis key', error as Error);
      throw error;
    }
  }

  async exists(key: string): Promise<boolean> {
    try {
      const result = await this.client.exists(key);
      return result === 1;
    } catch (error) {
      logger.error('Error checking Redis key existence', error as Error);
      throw error;
    }
  }

  async setJson(key: string, value: any, expirySeconds?: number): Promise<void> {
    await this.set(key, JSON.stringify(value), expirySeconds);
  }

  async getJson<T>(key: string): Promise<T | null> {
    const value = await this.get(key);
    return value ? JSON.parse(value) : null;
  }

  async blacklistToken(token: string, expirySeconds: number): Promise<void> {
    const key = `blacklist:${token}`;
    await this.set(key, '1', expirySeconds);
    logger.info('Token blacklisted', { key });
  }

  async isTokenBlacklisted(token: string): Promise<boolean> {
    const key = `blacklist:${token}`;
    return await this.exists(key);
  }

  async cacheUserSession(userId: string, sessionData: any, expirySeconds: number): Promise<void> {
    const key = `session:${userId}`;
    await this.setJson(key, sessionData, expirySeconds);
  }

  async getUserSession(userId: string): Promise<any | null> {
    const key = `session:${userId}`;
    return await this.getJson(key);
  }

  async deleteUserSession(userId: string): Promise<void> {
    const key = `session:${userId}`;
    await this.del(key);
  }

  async incrementCounter(key: string, expirySeconds?: number): Promise<number> {
    try {
      const count = await this.client.incr(key);
      if (expirySeconds && count === 1) {
        await this.client.expire(key, expirySeconds);
      }
      return count;
    } catch (error) {
      logger.error('Error incrementing counter', error as Error);
      throw error;
    }
  }

  async getCounter(key: string): Promise<number> {
    try {
      const value = await this.get(key);
      return value ? parseInt(value, 10) : 0;
    } catch (error) {
      logger.error('Error getting counter', error as Error);
      throw error;
    }
  }

  async setHash(key: string, field: string, value: string): Promise<void> {
    try {
      await this.client.hSet(key, field, value);
    } catch (error) {
      logger.error('Error setting hash field', error as Error);
      throw error;
    }
  }

  async getHash(key: string, field: string): Promise<string | undefined> {
    try {
      return await this.client.hGet(key, field);
    } catch (error) {
      logger.error('Error getting hash field', error as Error);
      throw error;
    }
  }

  async getAllHash(key: string): Promise<Record<string, string>> {
    try {
      return await this.client.hGetAll(key);
    } catch (error) {
      logger.error('Error getting all hash fields', error as Error);
      throw error;
    }
  }

  async deleteHashField(key: string, field: string): Promise<void> {
    try {
      await this.client.hDel(key, field);
    } catch (error) {
      logger.error('Error deleting hash field', error as Error);
      throw error;
    }
  }

  async addToSet(key: string, member: string): Promise<void> {
    try {
      await this.client.sAdd(key, member);
    } catch (error) {
      logger.error('Error adding to set', error as Error);
      throw error;
    }
  }

  async removeFromSet(key: string, member: string): Promise<void> {
    try {
      await this.client.sRem(key, member);
    } catch (error) {
      logger.error('Error removing from set', error as Error);
      throw error;
    }
  }

  async isSetMember(key: string, member: string): Promise<boolean> {
    try {
      return await this.client.sIsMember(key, member);
    } catch (error) {
      logger.error('Error checking set membership', error as Error);
      throw error;
    }
  }

  async getSetMembers(key: string): Promise<string[]> {
    try {
      return await this.client.sMembers(key);
    } catch (error) {
      logger.error('Error getting set members', error as Error);
      throw error;
    }
  }

  async publish(channel: string, message: string): Promise<void> {
    try {
      await this.client.publish(channel, message);
    } catch (error) {
      logger.error('Error publishing message', error as Error);
      throw error;
    }
  }

  async setExpiry(key: string, seconds: number): Promise<void> {
    try {
      await this.client.expire(key, seconds);
    } catch (error) {
      logger.error('Error setting expiry', error as Error);
      throw error;
    }
  }

  async getTTL(key: string): Promise<number> {
    try {
      return await this.client.ttl(key);
    } catch (error) {
      logger.error('Error getting TTL', error as Error);
      throw error;
    }
  }

  async flushPattern(pattern: string): Promise<void> {
    try {
      const keys = await this.client.keys(pattern);
      if (keys.length > 0) {
        await this.client.del(keys);
      }
    } catch (error) {
      logger.error('Error flushing pattern', error as Error);
      throw error;
    }
  }
}
