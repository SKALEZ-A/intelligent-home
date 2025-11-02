import { EventEmitter } from 'events';
import { Request, Response } from 'express';

interface RequestMetrics {
  timestamp: number;
  method: string;
  path: string;
  statusCode: number;
  responseTime: number;
  requestSize: number;
  responseSize: number;
  userId?: string;
  userAgent?: string;
  ip?: string;
  error?: string;
}

interface ServiceHealth {
  serviceName: string;
  status: 'healthy' | 'degraded' | 'down';
  responseTime: number;
  lastCheck: number;
  errorRate: number;
  successRate: number;
}

export class ApiMonitoringService extends EventEmitter {
  private metrics: RequestMetrics[] = [];
  private serviceHealth: Map<string, ServiceHealth> = new Map();
  private readonly maxMetricsSize = 10000;
  private readonly metricsRetentionMs = 3600000; // 1 hour

  constructor() {
    super();
    this.startCleanupInterval();
  }

  public recordRequest(req: Request, res: Response, responseTime: number): void {
    const metric: RequestMetrics = {
      timestamp: Date.now(),
      method: req.method,
      path: req.path,
      statusCode: res.statusCode,
      responseTime,
      requestSize: parseInt(req.get('content-length') || '0', 10),
      responseSize: parseInt(res.get('content-length') || '0', 10),
      userId: (req as any).user?.id,
      userAgent: req.get('user-agent'),
      ip: req.ip || req.connection.remoteAddress
    };

    if (res.statusCode >= 400) {
      metric.error = res.statusMessage || 'Unknown error';
    }

    this.metrics.push(metric);
    this.emit('request', metric);

    if (this.metrics.length > this.maxMetricsSize) {
      this.metrics = this.metrics.slice(-this.maxMetricsSize);
    }
  }

  public updateServiceHealth(serviceName: string, health: Partial<ServiceHealth>): void {
    const existing = this.serviceHealth.get(serviceName) || {
      serviceName,
      status: 'healthy',
      responseTime: 0,
      lastCheck: Date.now(),
      errorRate: 0,
      successRate: 100
    };

    const updated = { ...existing, ...health, lastCheck: Date.now() };
    this.serviceHealth.set(serviceName, updated);
    this.emit('serviceHealth', updated);
  }

  public getMetricsSummary(timeWindowMs: number = 300000): {
    totalRequests: number;
    averageResponseTime: number;
    errorRate: number;
    requestsPerSecond: number;
    statusCodeDistribution: { [code: number]: number };
    topEndpoints: Array<{ path: string; count: number; avgResponseTime: number }>;
  } {
    const cutoff = Date.now() - timeWindowMs;
    const recentMetrics = this.metrics.filter(m => m.timestamp >= cutoff);

    if (recentMetrics.length === 0) {
      return {
        totalRequests: 0,
        averageResponseTime: 0,
        errorRate: 0,
        requestsPerSecond: 0,
        statusCodeDistribution: {},
        topEndpoints: []
      };
    }

    const totalRequests = recentMetrics.length;
    const totalResponseTime = recentMetrics.reduce((sum, m) => sum + m.responseTime, 0);
    const errorCount = recentMetrics.filter(m => m.statusCode >= 400).length;
    const timeWindowSeconds = timeWindowMs / 1000;

    const statusCodeDistribution: { [code: number]: number } = {};
    recentMetrics.forEach(m => {
      statusCodeDistribution[m.statusCode] = (statusCodeDistribution[m.statusCode] || 0) + 1;
    });

    const endpointStats = new Map<string, { count: number; totalTime: number }>();
    recentMetrics.forEach(m => {
      const existing = endpointStats.get(m.path) || { count: 0, totalTime: 0 };
      endpointStats.set(m.path, {
        count: existing.count + 1,
        totalTime: existing.totalTime + m.responseTime
      });
    });

    const topEndpoints = Array.from(endpointStats.entries())
      .map(([path, stats]) => ({
        path,
        count: stats.count,
        avgResponseTime: stats.totalTime / stats.count
      }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);

    return {
      totalRequests,
      averageResponseTime: totalResponseTime / totalRequests,
      errorRate: (errorCount / totalRequests) * 100,
      requestsPerSecond: totalRequests / timeWindowSeconds,
      statusCodeDistribution,
      topEndpoints
    };
  }

  public getServiceHealthStatus(): ServiceHealth[] {
    return Array.from(this.serviceHealth.values());
  }

  public getAnomalies(threshold: number = 2): RequestMetrics[] {
    const summary = this.getMetricsSummary();
    const avgResponseTime = summary.averageResponseTime;
    const stdDev = this.calculateStdDev(this.metrics.map(m => m.responseTime), avgResponseTime);
    
    return this.metrics.filter(m => 
      Math.abs(m.responseTime - avgResponseTime) > threshold * stdDev
    );
  }

  private calculateStdDev(values: number[], mean: number): number {
    const squareDiffs = values.map(value => Math.pow(value - mean, 2));
    const avgSquareDiff = squareDiffs.reduce((sum, val) => sum + val, 0) / values.length;
    return Math.sqrt(avgSquareDiff);
  }

  private startCleanupInterval(): void {
    setInterval(() => {
      const cutoff = Date.now() - this.metricsRetentionMs;
      this.metrics = this.metrics.filter(m => m.timestamp >= cutoff);
    }, 60000); // Clean up every minute
  }

  public exportMetrics(format: 'json' | 'prometheus' = 'json'): string {
    if (format === 'prometheus') {
      return this.toPrometheusFormat();
    }
    return JSON.stringify({
      summary: this.getMetricsSummary(),
      serviceHealth: this.getServiceHealthStatus(),
      timestamp: Date.now()
    }, null, 2);
  }

  private toPrometheusFormat(): string {
    const summary = this.getMetricsSummary();
    let output = '';

    output += `# HELP api_requests_total Total number of API requests\n`;
    output += `# TYPE api_requests_total counter\n`;
    output += `api_requests_total ${summary.totalRequests}\n\n`;

    output += `# HELP api_response_time_avg Average response time in milliseconds\n`;
    output += `# TYPE api_response_time_avg gauge\n`;
    output += `api_response_time_avg ${summary.averageResponseTime.toFixed(2)}\n\n`;

    output += `# HELP api_error_rate Error rate percentage\n`;
    output += `# TYPE api_error_rate gauge\n`;
    output += `api_error_rate ${summary.errorRate.toFixed(2)}\n\n`;

    return output;
  }
}

export const monitoringService = new ApiMonitoringService();
