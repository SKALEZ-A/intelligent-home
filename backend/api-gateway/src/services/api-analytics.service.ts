import Redis from 'ioredis';
import { EventEmitter } from 'events';

interface RequestMetrics {
  endpoint: string;
  method: string;
  statusCode: number;
  responseTime: number;
  timestamp: number;
  userId?: string;
  userAgent?: string;
  ip?: string;
  errorMessage?: string;
}

interface AggregatedMetrics {
  totalRequests: number;
  successfulRequests: number;
  failedRequests: number;
  averageResponseTime: number;
  p95ResponseTime: number;
  p99ResponseTime: number;
  requestsByEndpoint: { [endpoint: string]: number };
  requestsByStatus: { [status: number]: number };
  errorRate: number;
}

export class ApiAnalyticsService extends EventEmitter {
  private redis: Redis;
  private metricsBuffer: RequestMetrics[] = [];
  private bufferSize: number = 100;
  private flushInterval: NodeJS.Timeout | null = null;

  constructor(redis: Redis, bufferSize: number = 100) {
    super();
    this.redis = redis;
    this.bufferSize = bufferSize;
    this.startFlushInterval();
  }

  private startFlushInterval(): void {
    this.flushInterval = setInterval(() => {
      this.flushMetrics();
    }, 10000);
  }

  public async recordRequest(metrics: RequestMetrics): Promise<void> {
    this.metricsBuffer.push(metrics);

    if (this.metricsBuffer.length >= this.bufferSize) {
      await this.flushMetrics();
    }

    this.emit('request', metrics);
  }

  private async flushMetrics(): Promise<void> {
    if (this.metricsBuffer.length === 0) return;

    const batch = [...this.metricsBuffer];
    this.metricsBuffer = [];

    try {
      const pipeline = this.redis.pipeline();
      const now = Date.now();
      const hourKey = `analytics:hour:${Math.floor(now / 3600000)}`;
      const dayKey = `analytics:day:${Math.floor(now / 86400000)}`;

      for (const metric of batch) {
        const metricData = JSON.stringify(metric);
        
        pipeline.zadd(hourKey, metric.timestamp, metricData);
        pipeline.zadd(dayKey, metric.timestamp, metricData);
        pipeline.expire(hourKey, 7200);
        pipeline.expire(dayKey, 604800);

        pipeline.hincrby(`stats:endpoint:${metric.endpoint}`, 'count', 1);
        pipeline.hincrby(`stats:endpoint:${metric.endpoint}`, 'totalTime', metric.responseTime);
        pipeline.hincrby(`stats:status:${metric.statusCode}`, 'count', 1);

        if (metric.userId) {
          pipeline.pfadd(`analytics:users:${dayKey}`, metric.userId);
        }
      }

      await pipeline.exec();
    } catch (error) {
      console.error('Failed to flush metrics:', error);
      this.metricsBuffer.unshift(...batch);
    }
  }

  public async getMetrics(timeRange: 'hour' | 'day' = 'hour'): Promise<AggregatedMetrics> {
    const now = Date.now();
    const key = timeRange === 'hour' 
      ? `analytics:hour:${Math.floor(now / 3600000)}`
      : `analytics:day:${Math.floor(now / 86400000)}`;

    const startTime = timeRange === 'hour' ? now - 3600000 : now - 86400000;
    const metrics = await this.redis.zrangebyscore(key, startTime, now);

    const parsed: RequestMetrics[] = metrics.map(m => JSON.parse(m));

    const totalRequests = parsed.length;
    const successfulRequests = parsed.filter(m => m.statusCode >= 200 && m.statusCode < 400).length;
    const failedRequests = totalRequests - successfulRequests;

    const responseTimes = parsed.map(m => m.responseTime).sort((a, b) => a - b);
    const averageResponseTime = responseTimes.reduce((a, b) => a + b, 0) / totalRequests || 0;
    const p95Index = Math.floor(responseTimes.length * 0.95);
    const p99Index = Math.floor(responseTimes.length * 0.99);

    const requestsByEndpoint: { [endpoint: string]: number } = {};
    const requestsByStatus: { [status: number]: number } = {};

    for (const metric of parsed) {
      requestsByEndpoint[metric.endpoint] = (requestsByEndpoint[metric.endpoint] || 0) + 1;
      requestsByStatus[metric.statusCode] = (requestsByStatus[metric.statusCode] || 0) + 1;
    }

    return {
      totalRequests,
      successfulRequests,
      failedRequests,
      averageResponseTime,
      p95ResponseTime: responseTimes[p95Index] || 0,
      p99ResponseTime: responseTimes[p99Index] || 0,
      requestsByEndpoint,
      requestsByStatus,
      errorRate: totalRequests > 0 ? (failedRequests / totalRequests) * 100 : 0
    };
  }

  public async getTopEndpoints(limit: number = 10): Promise<Array<{ endpoint: string; count: number; avgTime: number }>> {
    const keys = await this.redis.keys('stats:endpoint:*');
    const results: Array<{ endpoint: string; count: number; avgTime: number }> = [];

    for (const key of keys) {
      const stats = await this.redis.hgetall(key);
      const endpoint = key.replace('stats:endpoint:', '');
      const count = parseInt(stats.count || '0', 10);
      const totalTime = parseInt(stats.totalTime || '0', 10);
      const avgTime = count > 0 ? totalTime / count : 0;

      results.push({ endpoint, count, avgTime });
    }

    return results
      .sort((a, b) => b.count - a.count)
      .slice(0, limit);
  }

  public async getUniqueUsers(timeRange: 'day' = 'day'): Promise<number> {
    const now = Date.now();
    const dayKey = `analytics:day:${Math.floor(now / 86400000)}`;
    const userKey = `analytics:users:${dayKey}`;
    
    return await this.redis.pfcount(userKey);
  }

  public async clearMetrics(): Promise<void> {
    const keys = await this.redis.keys('analytics:*');
    const statKeys = await this.redis.keys('stats:*');
    
    if (keys.length > 0) {
      await this.redis.del(...keys);
    }
    if (statKeys.length > 0) {
      await this.redis.del(...statKeys);
    }
  }

  public destroy(): void {
    if (this.flushInterval) {
      clearInterval(this.flushInterval);
    }
    this.flushMetrics();
  }
}
