import { Request, Response, NextFunction } from 'express';
import { MetricsService } from '../../shared/services/metrics.service';

interface AnalyticsData {
  endpoint: string;
  method: string;
  statusCode: number;
  responseTime: number;
  userId?: string;
  userAgent?: string;
  ip: string;
  timestamp: Date;
  requestSize: number;
  responseSize: number;
  errorMessage?: string;
}

export class ApiAnalyticsMiddleware {
  private metricsService: MetricsService;
  private analyticsBuffer: AnalyticsData[] = [];
  private readonly BUFFER_SIZE = 100;
  private readonly FLUSH_INTERVAL = 30000; // 30 seconds

  constructor() {
    this.metricsService = new MetricsService();
    this.startFlushInterval();
  }

  public middleware() {
    return async (req: Request, res: Response, next: NextFunction) => {
      const startTime = Date.now();
      const originalSend = res.send;
      let responseSize = 0;

      res.send = function (data: any): Response {
        responseSize = Buffer.byteLength(JSON.stringify(data));
        return originalSend.call(this, data);
      };

      res.on('finish', () => {
        const responseTime = Date.now() - startTime;
        const analyticsData: AnalyticsData = {
          endpoint: req.path,
          method: req.method,
          statusCode: res.statusCode,
          responseTime,
          userId: (req as any).user?.id,
          userAgent: req.get('user-agent'),
          ip: req.ip || req.connection.remoteAddress || '',
          timestamp: new Date(),
          requestSize: parseInt(req.get('content-length') || '0'),
          responseSize,
        };

        if (res.statusCode >= 400) {
          analyticsData.errorMessage = (res as any).errorMessage;
        }

        this.collectAnalytics(analyticsData);
      });

      next();
    };
  }

  private collectAnalytics(data: AnalyticsData): void {
    this.analyticsBuffer.push(data);

    if (this.analyticsBuffer.length >= this.BUFFER_SIZE) {
      this.flushAnalytics();
    }
  }

  private async flushAnalytics(): Promise<void> {
    if (this.analyticsBuffer.length === 0) return;

    const dataToFlush = [...this.analyticsBuffer];
    this.analyticsBuffer = [];

    try {
      await this.metricsService.recordBatch(dataToFlush);
      this.calculateMetrics(dataToFlush);
    } catch (error) {
      console.error('Failed to flush analytics:', error);
      this.analyticsBuffer.unshift(...dataToFlush);
    }
  }

  private calculateMetrics(data: AnalyticsData[]): void {
    const avgResponseTime = data.reduce((sum, d) => sum + d.responseTime, 0) / data.length;
    const errorRate = data.filter(d => d.statusCode >= 400).length / data.length;
    const requestsPerSecond = data.length / 30;

    this.metricsService.recordMetric('api.avg_response_time', avgResponseTime);
    this.metricsService.recordMetric('api.error_rate', errorRate);
    this.metricsService.recordMetric('api.requests_per_second', requestsPerSecond);
  }

  private startFlushInterval(): void {
    setInterval(() => {
      this.flushAnalytics();
    }, this.FLUSH_INTERVAL);
  }

  public async getAnalytics(filters: {
    startDate?: Date;
    endDate?: Date;
    endpoint?: string;
    userId?: string;
  }): Promise<any> {
    return this.metricsService.queryMetrics(filters);
  }

  public async getTopEndpoints(limit: number = 10): Promise<any[]> {
    return this.metricsService.getTopEndpoints(limit);
  }

  public async getErrorAnalytics(): Promise<any> {
    return this.metricsService.getErrorAnalytics();
  }
}

export const apiAnalytics = new ApiAnalyticsMiddleware();
