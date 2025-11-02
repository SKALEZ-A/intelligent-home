import { logger } from '../utils/logger';

interface Metric {
  name: string;
  value: number;
  timestamp: Date;
  tags?: Record<string, string>;
}

export class MetricsService {
  private static instance: MetricsService;
  private metrics: Map<string, Metric[]> = new Map();
  private maxMetricsPerName = 1000;

  private constructor() {}

  static getInstance(): MetricsService {
    if (!MetricsService.instance) {
      MetricsService.instance = new MetricsService();
    }
    return MetricsService.instance;
  }

  record(name: string, value: number, tags?: Record<string, string>): void {
    const metric: Metric = {
      name,
      value,
      timestamp: new Date(),
      tags,
    };

    if (!this.metrics.has(name)) {
      this.metrics.set(name, []);
    }

    const metrics = this.metrics.get(name)!;
    metrics.push(metric);

    if (metrics.length > this.maxMetricsPerName) {
      metrics.shift();
    }

    logger.debug('Metric recorded', { name, value, tags });
  }

  increment(name: string, tags?: Record<string, string>): void {
    this.record(name, 1, tags);
  }

  gauge(name: string, value: number, tags?: Record<string, string>): void {
    this.record(name, value, tags);
  }

  timing(name: string, duration: number, tags?: Record<string, string>): void {
    this.record(name, duration, tags);
  }

  getMetrics(name: string, limit?: number): Metric[] {
    const metrics = this.metrics.get(name) || [];
    return limit ? metrics.slice(-limit) : metrics;
  }

  getAverage(name: string, since?: Date): number {
    const metrics = this.getMetrics(name);
    const filtered = since
      ? metrics.filter(m => m.timestamp >= since)
      : metrics;

    if (filtered.length === 0) return 0;

    const sum = filtered.reduce((acc, m) => acc + m.value, 0);
    return sum / filtered.length;
  }

  getSum(name: string, since?: Date): number {
    const metrics = this.getMetrics(name);
    const filtered = since
      ? metrics.filter(m => m.timestamp >= since)
      : metrics;

    return filtered.reduce((acc, m) => acc + m.value, 0);
  }

  clear(name?: string): void {
    if (name) {
      this.metrics.delete(name);
    } else {
      this.metrics.clear();
    }
  }
}

export const metrics = MetricsService.getInstance();
