import { logger } from '../utils/logger';

interface RateLimitConfig {
  windowMs: number;
  maxRequests: number;
  skipSuccessfulRequests?: boolean;
  skipFailedRequests?: boolean;
  keyGenerator?: (identifier: string) => string;
}

interface RateLimitEntry {
  count: number;
  resetTime: number;
  blocked: boolean;
}

export class AdvancedRateLimiterService {
  private limits: Map<string, RateLimitEntry> = new Map();
  private configs: Map<string, RateLimitConfig> = new Map();

  constructor() {
    this.initializeConfigs();
    this.startCleanup();
  }

  private initializeConfigs(): void {
    // API rate limits
    this.configs.set('api:default', {
      windowMs: 60000, // 1 minute
      maxRequests: 100
    });

    this.configs.set('api:auth', {
      windowMs: 900000, // 15 minutes
      maxRequests: 5,
      skipSuccessfulRequests: false
    });

    this.configs.set('api:device_control', {
      windowMs: 1000, // 1 second
      maxRequests: 10
    });

    this.configs.set('api:data_export', {
      windowMs: 3600000, // 1 hour
      maxRequests: 5
    });

    logger.info('Rate limiter configs initialized');
  }

  public async checkLimit(
    category: string,
    identifier: string,
    success?: boolean
  ): Promise<{ allowed: boolean; remaining: number; resetTime: number }> {
    const config = this.configs.get(category);
    if (!config) {
      logger.warn('Unknown rate limit category', { category });
      return { allowed: true, remaining: Infinity, resetTime: 0 };
    }

    const key = config.keyGenerator ? config.keyGenerator(identifier) : `${category}:${identifier}`;
    const now = Date.now();
    let entry = this.limits.get(key);

    // Initialize or reset if window expired
    if (!entry || now >= entry.resetTime) {
      entry = {
        count: 0,
        resetTime: now + config.windowMs,
        blocked: false
      };
      this.limits.set(key, entry);
    }

    // Check if blocked
    if (entry.blocked) {
      logger.warn('Rate limit exceeded', { category, identifier });
      return {
        allowed: false,
        remaining: 0,
        resetTime: entry.resetTime
      };
    }

    // Skip counting based on config
    const shouldCount = !(
      (success === true && config.skipSuccessfulRequests) ||
      (success === false && config.skipFailedRequests)
    );

    if (shouldCount) {
      entry.count++;
    }

    // Check if limit exceeded
    if (entry.count > config.maxRequests) {
      entry.blocked = true;
      logger.warn('Rate limit exceeded', { 
        category, 
        identifier, 
        count: entry.count,
        limit: config.maxRequests
      });

      return {
        allowed: false,
        remaining: 0,
        resetTime: entry.resetTime
      };
    }

    return {
      allowed: true,
      remaining: config.maxRequests - entry.count,
      resetTime: entry.resetTime
    };
  }

  public async incrementCounter(category: string, identifier: string): Promise<void> {
    await this.checkLimit(category, identifier);
  }

  public async resetLimit(category: string, identifier: string): Promise<void> {
    const config = this.configs.get(category);
    if (!config) return;

    const key = config.keyGenerator ? config.keyGenerator(identifier) : `${category}:${identifier}`;
    this.limits.delete(key);

    logger.info('Rate limit reset', { category, identifier });
  }

  public async getRemainingRequests(category: string, identifier: string): Promise<number> {
    const result = await this.checkLimit(category, identifier);
    return result.remaining;
  }

  public async getResetTime(category: string, identifier: string): Promise<number> {
    const config = this.configs.get(category);
    if (!config) return 0;

    const key = config.keyGenerator ? config.keyGenerator(identifier) : `${category}:${identifier}`;
    const entry = this.limits.get(key);

    return entry?.resetTime || Date.now() + config.windowMs;
  }

  public setConfig(category: string, config: RateLimitConfig): void {
    this.configs.set(category, config);
    logger.info('Rate limit config updated', { category });
  }

  public getConfig(category: string): RateLimitConfig | undefined {
    return this.configs.get(category);
  }

  public async getStats(category: string): Promise<any> {
    const config = this.configs.get(category);
    if (!config) return null;

    const entries = Array.from(this.limits.entries())
      .filter(([key]) => key.startsWith(`${category}:`));

    const totalRequests = entries.reduce((sum, [, entry]) => sum + entry.count, 0);
    const blockedCount = entries.filter(([, entry]) => entry.blocked).length;

    return {
      category,
      config,
      totalEntries: entries.length,
      totalRequests,
      blockedCount,
      activeCount: entries.length - blockedCount
    };
  }

  private startCleanup(): void {
    setInterval(() => {
      const now = Date.now();
      let cleaned = 0;

      for (const [key, entry] of this.limits.entries()) {
        if (now >= entry.resetTime) {
          this.limits.delete(key);
          cleaned++;
        }
      }

      if (cleaned > 0) {
        logger.debug('Rate limiter cleanup completed', { cleaned });
      }
    }, 60000); // Clean up every minute
  }

  public async applyBackoff(
    category: string,
    identifier: string,
    multiplier: number = 2
  ): Promise<void> {
    const config = this.configs.get(category);
    if (!config) return;

    const key = config.keyGenerator ? config.keyGenerator(identifier) : `${category}:${identifier}`;
    const entry = this.limits.get(key);

    if (entry) {
      const additionalTime = config.windowMs * (multiplier - 1);
      entry.resetTime += additionalTime;
      logger.info('Backoff applied', { category, identifier, additionalTime });
    }
  }
}

export const advancedRateLimiter = new AdvancedRateLimiterService();
