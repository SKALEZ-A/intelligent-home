import Redis from 'ioredis';
import { EventEmitter } from 'events';

interface QuotaConfig {
  userId: string;
  tier: 'free' | 'basic' | 'premium' | 'enterprise';
  dailyLimit: number;
  monthlyLimit: number;
  rateLimitPerMinute: number;
  burstLimit: number;
}

interface QuotaUsage {
  userId: string;
  dailyUsage: number;
  monthlyUsage: number;
  currentMinuteUsage: number;
  lastReset: Date;
  quotaExceeded: boolean;
}

export class ApiQuotaManager extends EventEmitter {
  private redis: Redis;
  private readonly TIER_LIMITS = {
    free: { daily: 1000, monthly: 25000, ratePerMinute: 10, burst: 20 },
    basic: { daily: 10000, monthly: 250000, ratePerMinute: 50, burst: 100 },
    premium: { daily: 100000, monthly: 2500000, ratePerMinute: 200, burst: 400 },
    enterprise: { daily: -1, monthly: -1, ratePerMinute: 1000, burst: 2000 },
  };

  constructor() {
    super();
    this.redis = new Redis({
      host: process.env.REDIS_HOST || 'localhost',
      port: parseInt(process.env.REDIS_PORT || '6379'),
      password: process.env.REDIS_PASSWORD,
    });
  }

  public async checkQuota(userId: string, tier: string): Promise<QuotaUsage> {
    const limits = this.TIER_LIMITS[tier as keyof typeof this.TIER_LIMITS];
    if (!limits) {
      throw new Error(`Invalid tier: ${tier}`);
    }

    const now = new Date();
    const dailyKey = `quota:${userId}:daily:${now.toISOString().split('T')[0]}`;
    const monthlyKey = `quota:${userId}:monthly:${now.getFullYear()}-${now.getMonth() + 1}`;
    const minuteKey = `quota:${userId}:minute:${Math.floor(now.getTime() / 60000)}`;

    const [dailyUsage, monthlyUsage, minuteUsage] = await Promise.all([
      this.redis.get(dailyKey),
      this.redis.get(monthlyKey),
      this.redis.get(minuteKey),
    ]);

    const usage: QuotaUsage = {
      userId,
      dailyUsage: parseInt(dailyUsage || '0'),
      monthlyUsage: parseInt(monthlyUsage || '0'),
      currentMinuteUsage: parseInt(minuteUsage || '0'),
      lastReset: now,
      quotaExceeded: false,
    };

    // Check limits
    if (limits.daily !== -1 && usage.dailyUsage >= limits.daily) {
      usage.quotaExceeded = true;
      this.emit('quotaExceeded', { userId, type: 'daily', usage: usage.dailyUsage, limit: limits.daily });
    }

    if (limits.monthly !== -1 && usage.monthlyUsage >= limits.monthly) {
      usage.quotaExceeded = true;
      this.emit('quotaExceeded', { userId, type: 'monthly', usage: usage.monthlyUsage, limit: limits.monthly });
    }

    if (usage.currentMinuteUsage >= limits.ratePerMinute) {
      usage.quotaExceeded = true;
      this.emit('quotaExceeded', { userId, type: 'rate', usage: usage.currentMinuteUsage, limit: limits.ratePerMinute });
    }

    return usage;
  }

  public async incrementQuota(userId: string, tier: string): Promise<void> {
    const now = new Date();
    const dailyKey = `quota:${userId}:daily:${now.toISOString().split('T')[0]}`;
    const monthlyKey = `quota:${userId}:monthly:${now.getFullYear()}-${now.getMonth() + 1}`;
    const minuteKey = `quota:${userId}:minute:${Math.floor(now.getTime() / 60000)}`;

    const pipeline = this.redis.pipeline();
    
    pipeline.incr(dailyKey);
    pipeline.expire(dailyKey, 86400); // 24 hours
    
    pipeline.incr(monthlyKey);
    pipeline.expire(monthlyKey, 2592000); // 30 days
    
    pipeline.incr(minuteKey);
    pipeline.expire(minuteKey, 60); // 1 minute

    await pipeline.exec();

    this.emit('quotaIncremented', { userId, timestamp: now });
  }

  public async getQuotaStatus(userId: string, tier: string): Promise<any> {
    const limits = this.TIER_LIMITS[tier as keyof typeof this.TIER_LIMITS];
    const usage = await this.checkQuota(userId, tier);

    return {
      tier,
      limits: {
        daily: limits.daily === -1 ? 'unlimited' : limits.daily,
        monthly: limits.monthly === -1 ? 'unlimited' : limits.monthly,
        ratePerMinute: limits.ratePerMinute,
        burst: limits.burst,
      },
      usage: {
        daily: usage.dailyUsage,
        monthly: usage.monthlyUsage,
        currentMinute: usage.currentMinuteUsage,
      },
      remaining: {
        daily: limits.daily === -1 ? 'unlimited' : Math.max(0, limits.daily - usage.dailyUsage),
        monthly: limits.monthly === -1 ? 'unlimited' : Math.max(0, limits.monthly - usage.monthlyUsage),
        currentMinute: Math.max(0, limits.ratePerMinute - usage.currentMinuteUsage),
      },
      resetTimes: {
        daily: this.getNextDayReset(),
        monthly: this.getNextMonthReset(),
        minute: this.getNextMinuteReset(),
      },
    };
  }

  public async resetQuota(userId: string, type: 'daily' | 'monthly' | 'all'): Promise<void> {
    const now = new Date();
    const keys: string[] = [];

    if (type === 'daily' || type === 'all') {
      keys.push(`quota:${userId}:daily:${now.toISOString().split('T')[0]}`);
    }

    if (type === 'monthly' || type === 'all') {
      keys.push(`quota:${userId}:monthly:${now.getFullYear()}-${now.getMonth() + 1}`);
    }

    if (keys.length > 0) {
      await this.redis.del(...keys);
      this.emit('quotaReset', { userId, type, timestamp: now });
    }
  }

  public async upgradeTier(userId: string, newTier: string): Promise<void> {
    if (!this.TIER_LIMITS[newTier as keyof typeof this.TIER_LIMITS]) {
      throw new Error(`Invalid tier: ${newTier}`);
    }

    await this.redis.set(`user:${userId}:tier`, newTier);
    this.emit('tierUpgraded', { userId, newTier, timestamp: new Date() });
  }

  public async getUserTier(userId: string): Promise<string> {
    const tier = await this.redis.get(`user:${userId}:tier`);
    return tier || 'free';
  }

  private getNextDayReset(): Date {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    tomorrow.setHours(0, 0, 0, 0);
    return tomorrow;
  }

  private getNextMonthReset(): Date {
    const nextMonth = new Date();
    nextMonth.setMonth(nextMonth.getMonth() + 1);
    nextMonth.setDate(1);
    nextMonth.setHours(0, 0, 0, 0);
    return nextMonth;
  }

  private getNextMinuteReset(): Date {
    const nextMinute = new Date();
    nextMinute.setSeconds(60, 0);
    return nextMinute;
  }

  public async getQuotaAnalytics(userId: string, days: number = 30): Promise<any> {
    const analytics: any = {
      userId,
      period: days,
      dailyUsage: [],
      averageDaily: 0,
      peakUsage: 0,
      totalRequests: 0,
    };

    const now = new Date();
    for (let i = 0; i < days; i++) {
      const date = new Date(now);
      date.setDate(date.getDate() - i);
      const dateKey = date.toISOString().split('T')[0];
      const dailyKey = `quota:${userId}:daily:${dateKey}`;
      
      const usage = await this.redis.get(dailyKey);
      const usageCount = parseInt(usage || '0');
      
      analytics.dailyUsage.push({
        date: dateKey,
        requests: usageCount,
      });

      analytics.totalRequests += usageCount;
      if (usageCount > analytics.peakUsage) {
        analytics.peakUsage = usageCount;
      }
    }

    analytics.averageDaily = Math.round(analytics.totalRequests / days);

    return analytics;
  }
}

export const apiQuotaManager = new ApiQuotaManager();
