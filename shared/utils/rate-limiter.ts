import { EventEmitter } from 'events';

export interface RateLimitConfig {
  windowMs: number;
  maxRequests: number;
  keyGenerator?: (identifier: string) => string;
  skipSuccessfulRequests?: boolean;
  skipFailedRequests?: boolean;
  onLimitReached?: (identifier: string) => void;
}

interface RateLimitEntry {
  count: number;
  resetTime: number;
  blocked: boolean;
}

export class RateLimiter extends EventEmitter {
  private store: Map<string, RateLimitEntry> = new Map();
  private cleanupInterval: NodeJS.Timeout;

  constructor(private config: RateLimitConfig) {
    super();
    
    // Cleanup expired entries every minute
    this.cleanupInterval = setInterval(() => {
      this.cleanup();
    }, 60000);
  }

  async consume(identifier: string, cost: number = 1): Promise<{
    allowed: boolean;
    remaining: number;
    resetTime: number;
  }> {
    const key = this.config.keyGenerator ? this.config.keyGenerator(identifier) : identifier;
    const now = Date.now();
    
    let entry = this.store.get(key);

    // Create new entry or reset if window expired
    if (!entry || now >= entry.resetTime) {
      entry = {
        count: 0,
        resetTime: now + this.config.windowMs,
        blocked: false
      };
      this.store.set(key, entry);
    }

    // Check if limit exceeded
    if (entry.count + cost > this.config.maxRequests) {
      if (!entry.blocked) {
        entry.blocked = true;
        this.emit('limitReached', identifier);
        
        if (this.config.onLimitReached) {
          this.config.onLimitReached(identifier);
        }
      }

      return {
        allowed: false,
        remaining: 0,
        resetTime: entry.resetTime
      };
    }

    // Consume tokens
    entry.count += cost;
    this.store.set(key, entry);

    return {
      allowed: true,
      remaining: this.config.maxRequests - entry.count,
      resetTime: entry.resetTime
    };
  }

  async check(identifier: string): Promise<{
    allowed: boolean;
    remaining: number;
    resetTime: number;
  }> {
    const key = this.config.keyGenerator ? this.config.keyGenerator(identifier) : identifier;
    const now = Date.now();
    
    const entry = this.store.get(key);

    if (!entry || now >= entry.resetTime) {
      return {
        allowed: true,
        remaining: this.config.maxRequests,
        resetTime: now + this.config.windowMs
      };
    }

    return {
      allowed: entry.count < this.config.maxRequests,
      remaining: Math.max(0, this.config.maxRequests - entry.count),
      resetTime: entry.resetTime
    };
  }

  reset(identifier: string): void {
    const key = this.config.keyGenerator ? this.config.keyGenerator(identifier) : identifier;
    this.store.delete(key);
    this.emit('reset', identifier);
  }

  resetAll(): void {
    this.store.clear();
    this.emit('resetAll');
  }

  private cleanup(): void {
    const now = Date.now();
    let cleaned = 0;

    for (const [key, entry] of this.store.entries()) {
      if (now >= entry.resetTime) {
        this.store.delete(key);
        cleaned++;
      }
    }

    if (cleaned > 0) {
      this.emit('cleanup', cleaned);
    }
  }

  getStats(): {
    totalKeys: number;
    blockedKeys: number;
    averageUsage: number;
  } {
    let blockedCount = 0;
    let totalUsage = 0;

    for (const entry of this.store.values()) {
      if (entry.blocked) blockedCount++;
      totalUsage += entry.count;
    }

    return {
      totalKeys: this.store.size,
      blockedKeys: blockedCount,
      averageUsage: this.store.size > 0 ? totalUsage / this.store.size : 0
    };
  }

  destroy(): void {
    clearInterval(this.cleanupInterval);
    this.store.clear();
    this.removeAllListeners();
  }
}

export class TokenBucketRateLimiter extends EventEmitter {
  private buckets: Map<string, {
    tokens: number;
    lastRefill: number;
  }> = new Map();

  constructor(
    private capacity: number,
    private refillRate: number, // tokens per second
    private keyGenerator?: (identifier: string) => string
  ) {
    super();
  }

  async consume(identifier: string, tokens: number = 1): Promise<boolean> {
    const key = this.keyGenerator ? this.keyGenerator(identifier) : identifier;
    const now = Date.now();

    let bucket = this.buckets.get(key);

    if (!bucket) {
      bucket = {
        tokens: this.capacity,
        lastRefill: now
      };
      this.buckets.set(key, bucket);
    }

    // Refill tokens based on time passed
    const timePassed = (now - bucket.lastRefill) / 1000;
    const tokensToAdd = timePassed * this.refillRate;
    bucket.tokens = Math.min(this.capacity, bucket.tokens + tokensToAdd);
    bucket.lastRefill = now;

    // Try to consume tokens
    if (bucket.tokens >= tokens) {
      bucket.tokens -= tokens;
      this.buckets.set(key, bucket);
      return true;
    }

    this.emit('limitReached', identifier);
    return false;
  }

  reset(identifier: string): void {
    const key = this.keyGenerator ? this.keyGenerator(identifier) : identifier;
    this.buckets.delete(key);
  }

  resetAll(): void {
    this.buckets.clear();
  }
}

export class SlidingWindowRateLimiter extends EventEmitter {
  private windows: Map<string, number[]> = new Map();

  constructor(
    private windowMs: number,
    private maxRequests: number,
    private keyGenerator?: (identifier: string) => string
  ) {
    super();
  }

  async consume(identifier: string): Promise<boolean> {
    const key = this.keyGenerator ? this.keyGenerator(identifier) : identifier;
    const now = Date.now();
    const windowStart = now - this.windowMs;

    let timestamps = this.windows.get(key) || [];
    
    // Remove old timestamps
    timestamps = timestamps.filter(ts => ts > windowStart);

    if (timestamps.length >= this.maxRequests) {
      this.emit('limitReached', identifier);
      return false;
    }

    timestamps.push(now);
    this.windows.set(key, timestamps);
    return true;
  }

  reset(identifier: string): void {
    const key = this.keyGenerator ? this.keyGenerator(identifier) : identifier;
    this.windows.delete(key);
  }

  resetAll(): void {
    this.windows.clear();
  }
}

export class AdaptiveRateLimiter extends EventEmitter {
  private baseLimiter: RateLimiter;
  private performanceMetrics: Map<string, {
    successCount: number;
    failureCount: number;
    avgResponseTime: number;
  }> = new Map();

  constructor(
    private baseConfig: RateLimitConfig,
    private adaptiveConfig: {
      minLimit: number;
      maxLimit: number;
      adjustmentFactor: number;
      evaluationWindow: number;
    }
  ) {
    super();
    this.baseLimiter = new RateLimiter(baseConfig);
  }

  async consume(identifier: string, responseTime?: number, success?: boolean): Promise<{
    allowed: boolean;
    remaining: number;
    resetTime: number;
  }> {
    // Update metrics
    if (responseTime !== undefined && success !== undefined) {
      this.updateMetrics(identifier, responseTime, success);
    }

    // Adjust limit based on performance
    this.adjustLimit(identifier);

    return this.baseLimiter.consume(identifier);
  }

  private updateMetrics(identifier: string, responseTime: number, success: boolean): void {
    let metrics = this.performanceMetrics.get(identifier);

    if (!metrics) {
      metrics = {
        successCount: 0,
        failureCount: 0,
        avgResponseTime: 0
      };
    }

    if (success) {
      metrics.successCount++;
    } else {
      metrics.failureCount++;
    }

    // Update average response time
    const totalRequests = metrics.successCount + metrics.failureCount;
    metrics.avgResponseTime = (metrics.avgResponseTime * (totalRequests - 1) + responseTime) / totalRequests;

    this.performanceMetrics.set(identifier, metrics);
  }

  private adjustLimit(identifier: string): void {
    const metrics = this.performanceMetrics.get(identifier);
    if (!metrics) return;

    const totalRequests = metrics.successCount + metrics.failureCount;
    if (totalRequests < 10) return; // Need enough data

    const successRate = metrics.successCount / totalRequests;
    const currentLimit = this.baseConfig.maxRequests;

    let newLimit = currentLimit;

    // Increase limit if performing well
    if (successRate > 0.95 && metrics.avgResponseTime < 100) {
      newLimit = Math.min(
        this.adaptiveConfig.maxLimit,
        currentLimit * (1 + this.adaptiveConfig.adjustmentFactor)
      );
    }
    // Decrease limit if performing poorly
    else if (successRate < 0.8 || metrics.avgResponseTime > 500) {
      newLimit = Math.max(
        this.adaptiveConfig.minLimit,
        currentLimit * (1 - this.adaptiveConfig.adjustmentFactor)
      );
    }

    if (newLimit !== currentLimit) {
      this.baseConfig.maxRequests = Math.round(newLimit);
      this.emit('limitAdjusted', identifier, currentLimit, newLimit);
    }
  }

  reset(identifier: string): void {
    this.baseLimiter.reset(identifier);
    this.performanceMetrics.delete(identifier);
  }

  resetAll(): void {
    this.baseLimiter.resetAll();
    this.performanceMetrics.clear();
  }
}

export function createRateLimiter(type: 'fixed' | 'token' | 'sliding' | 'adaptive', config: any): any {
  switch (type) {
    case 'fixed':
      return new RateLimiter(config);
    case 'token':
      return new TokenBucketRateLimiter(config.capacity, config.refillRate, config.keyGenerator);
    case 'sliding':
      return new SlidingWindowRateLimiter(config.windowMs, config.maxRequests, config.keyGenerator);
    case 'adaptive':
      return new AdaptiveRateLimiter(config.baseConfig, config.adaptiveConfig);
    default:
      throw new Error(`Unknown rate limiter type: ${type}`);
  }
}
