import { createClient, RedisClientType } from 'redis';
import { createHash } from 'crypto';

export class ApiGatewayCacheService {
  private client: RedisClientType;
  private defaultTTL: number = 300;

  async connect(): Promise<void> {
    this.client = createClient({
      url: process.env.REDIS_URL || 'redis://localhost:6379'
    });

    this.client.on('error', (err) => console.error('Redis Client Error', err));
    await this.client.connect();
  }

  async disconnect(): Promise<void> {
    if (this.client) {
      await this.client.quit();
    }
  }

  generateCacheKey(method: string, url: string, body?: any): string {
    const data = `${method}:${url}:${JSON.stringify(body || {})}`;
    return createHash('sha256').update(data).digest('hex');
  }

  async get(key: string): Promise<any> {
    try {
      const cached = await this.client.get(key);
      return cached ? JSON.parse(cached) : null;
    } catch (error) {
      console.error('Cache get error:', error);
      return null;
    }
  }

  async set(key: string, value: any, ttl?: number): Promise<void> {
    try {
      const serialized = JSON.stringify(value);
      await this.client.setEx(key, ttl || this.defaultTTL, serialized);
    } catch (error) {
      console.error('Cache set error:', error);
    }
  }

  async delete(key: string): Promise<void> {
    try {
      await this.client.del(key);
    } catch (error) {
      console.error('Cache delete error:', error);
    }
  }

  async invalidatePattern(pattern: string): Promise<void> {
    try {
      const keys = await this.client.keys(pattern);
      if (keys.length > 0) {
        await this.client.del(keys);
      }
    } catch (error) {
      console.error('Cache invalidate pattern error:', error);
    }
  }

  async getCacheStats(): Promise<any> {
    try {
      const info = await this.client.info('stats');
      const keyspace = await this.client.info('keyspace');
      
      return {
        info,
        keyspace,
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      console.error('Cache stats error:', error);
      return null;
    }
  }

  isCacheable(method: string, statusCode: number): boolean {
    return method === 'GET' && statusCode >= 200 && statusCode < 300;
  }

  getCacheTTL(url: string): number {
    if (url.includes('/weather')) return 600;
    if (url.includes('/energy')) return 300;
    if (url.includes('/device')) return 60;
    if (url.includes('/automation')) return 120;
    return this.defaultTTL;
  }
}
