import Redis from 'ioredis';
import crypto from 'crypto';

interface CacheStrategy {
  ttl: number;
  staleWhileRevalidate?: number;
  cacheControl?: string;
  varyBy?: string[];
  invalidateOn?: string[];
}

interface CacheEntry {
  data: any;
  timestamp: number;
  etag: string;
  headers: Record<string, string>;
}

export class ApiCachingStrategyService {
  private redis: Redis;
  private strategies: Map<string, CacheStrategy>;
  private invalidationPatterns: Map<string, Set<string>>;

  constructor() {
    this.redis = new Redis({
      host: process.env.REDIS_HOST || 'localhost',
      port: parseInt(process.env.REDIS_PORT || '6379'),
      password: process.env.REDIS_PASSWORD,
    });
    this.strategies = new Map();
    this.invalidationPatterns = new Map();
  }

  public setStrategy(pattern: string, strategy: CacheStrategy): void {
    this.strategies.set(pattern, strategy);

    if (strategy.invalidateOn) {
      strategy.invalidateOn.forEach(event => {
        if (!this.invalidationPatterns.has(event)) {
          this.invalidationPatterns.set(event, new Set());
        }
        this.invalidationPatterns.get(event)!.add(pattern);
      });
    }
  }

  public async get(key: string, req: any): Promise<CacheEntry | null> {
    const cacheKey = this.generateCacheKey(key, req);
    const cached = await this.redis.get(cacheKey);

    if (!cached) return null;

    const entry: CacheEntry = JSON.parse(cached);
    const strategy = this.getStrategyForKey(key);

    if (strategy && strategy.staleWhileRevalidate) {
      const age = Date.now() - entry.timestamp;
      const staleThreshold = strategy.ttl + strategy.staleWhileRevalidate;

      if (age > strategy.ttl && age < staleThreshold) {
        this.revalidateInBackground(key, req);
      }
    }

    return entry;
  }

  public async set(key: string, data: any, req: any, headers: Record<string, string> = {}): Promise<void> {
    const strategy = this.getStrategyForKey(key);
    if (!strategy) return;

    const cacheKey = this.generateCacheKey(key, req);
    const etag = this.generateETag(data);

    const entry: CacheEntry = {
      data,
      timestamp: Date.now(),
      etag,
      headers: {
        ...headers,
        'Cache-Control': strategy.cacheControl || `max-age=${strategy.ttl}`,
        'ETag': etag,
      },
    };

    const ttl = strategy.staleWhileRevalidate
      ? strategy.ttl + strategy.staleWhileRevalidate
      : strategy.ttl;

    await this.redis.setex(cacheKey, ttl, JSON.stringify(entry));
  }

  public async invalidate(pattern: string): Promise<void> {
    const keys = await this.redis.keys(`cache:${pattern}*`);
    if (keys.length > 0) {
      await this.redis.del(...keys);
    }
  }

  public async invalidateByEvent(event: string): Promise<void> {
    const patterns = this.invalidationPatterns.get(event);
    if (!patterns) return;

    for (const pattern of patterns) {
      await this.invalidate(pattern);
    }
  }

  private generateCacheKey(key: string, req: any): string {
    const strategy = this.getStrategyForKey(key);
    let cacheKey = `cache:${key}`;

    if (strategy?.varyBy) {
      const varyParts = strategy.varyBy.map(field => {
        if (field.startsWith('header:')) {
          const headerName = field.substring(7);
          return req.headers[headerName] || '';
        }
        if (field.startsWith('query:')) {
          const queryParam = field.substring(6);
          return req.query[queryParam] || '';
        }
        return '';
      });

      const varyHash = crypto.createHash('md5').update(varyParts.join(':')).digest('hex');
      cacheKey += `:${varyHash}`;
    }

    return cacheKey;
  }

  private generateETag(data: any): string {
    const content = JSON.stringify(data);
    return crypto.createHash('md5').update(content).digest('hex');
  }

  private getStrategyForKey(key: string): CacheStrategy | undefined {
    for (const [pattern, strategy] of this.strategies.entries()) {
      if (this.matchPattern(key, pattern)) {
        return strategy;
      }
    }
    return undefined;
  }

  private matchPattern(key: string, pattern: string): boolean {
    const regexPattern = pattern.replace(/\*/g, '.*').replace(/\?/g, '.');
    const regex = new RegExp(`^${regexPattern}$`);
    return regex.test(key);
  }

  private async revalidateInBackground(key: string, req: any): Promise<void> {
    setTimeout(async () => {
      try {
        console.log(`Revalidating cache for key: ${key}`);
      } catch (error) {
        console.error(`Failed to revalidate cache for key: ${key}`, error);
      }
    }, 0);
  }

  public async getCacheStats(): Promise<any> {
    const keys = await this.redis.keys('cache:*');
    const stats = {
      totalKeys: keys.length,
      totalSize: 0,
      hitRate: 0,
      missRate: 0,
    };

    for (const key of keys.slice(0, 100)) {
      const value = await this.redis.get(key);
      if (value) {
        stats.totalSize += Buffer.byteLength(value, 'utf8');
      }
    }

    return stats;
  }

  public async warmCache(entries: Array<{ key: string; data: any; req: any }>): Promise<void> {
    for (const entry of entries) {
      await this.set(entry.key, entry.data, entry.req);
    }
  }

  public async clearAll(): Promise<void> {
    const keys = await this.redis.keys('cache:*');
    if (keys.length > 0) {
      await this.redis.del(...keys);
    }
  }
}

export const apiCachingStrategy = new ApiCachingStrategyService();
