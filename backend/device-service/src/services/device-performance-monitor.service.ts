import { EventEmitter } from 'events';

interface PerformanceMetrics {
  deviceId: string;
  timestamp: Date;
  cpuUsage?: number;
  memoryUsage?: number;
  networkLatency?: number;
  throughput?: number;
  uptime?: number;
  batteryLevel?: number;
}

interface PerformanceThresholds {
  cpuUsage: number;
  memoryUsage: number;
  networkLatency: number;
  batteryLevel: number;
}

export class DevicePerformanceMonitorService extends EventEmitter {
  private metricsStore: Map<string, PerformanceMetrics[]>;
  private thresholds: PerformanceThresholds;
  private monitoringIntervals: Map<string, NodeJS.Timeout>;

  constructor() {
    super();
    this.metricsStore = new Map();
    this.thresholds = {
      cpuUsage: 80,
      memoryUsage: 85,
      networkLatency: 500,
      batteryLevel: 20,
    };
    this.monitoringIntervals = new Map();
  }

  public startMonitoring(deviceId: string, interval: number = 60000): void {
    if (this.monitoringIntervals.has(deviceId)) {
      return;
    }

    const intervalId = setInterval(async () => {
      await this.collectMetrics(deviceId);
    }, interval);

    this.monitoringIntervals.set(deviceId, intervalId);
    this.emit('monitoringStarted', { deviceId, interval });
  }

  public stopMonitoring(deviceId: string): void {
    const intervalId = this.monitoringIntervals.get(deviceId);
    if (intervalId) {
      clearInterval(intervalId);
      this.monitoringIntervals.delete(deviceId);
      this.emit('monitoringStopped', { deviceId });
    }
  }

  private async collectMetrics(deviceId: string): Promise<void> {
    const metrics: PerformanceMetrics = {
      deviceId,
      timestamp: new Date(),
      cpuUsage: Math.random() * 100,
      memoryUsage: Math.random() * 100,
      networkLatency: Math.random() * 1000,
      throughput: Math.random() * 1000,
      uptime: Date.now(),
      batteryLevel: Math.random() * 100,
    };

    this.storeMetrics(metrics);
    this.checkThresholds(metrics);
  }

  private storeMetrics(metrics: PerformanceMetrics): void {
    if (!this.metricsStore.has(metrics.deviceId)) {
      this.metricsStore.set(metrics.deviceId, []);
    }

    const deviceMetrics = this.metricsStore.get(metrics.deviceId)!;
    deviceMetrics.push(metrics);

    if (deviceMetrics.length > 1000) {
      deviceMetrics.shift();
    }
  }

  private checkThresholds(metrics: PerformanceMetrics): void {
    const alerts: string[] = [];

    if (metrics.cpuUsage && metrics.cpuUsage > this.thresholds.cpuUsage) {
      alerts.push(`High CPU usage: ${metrics.cpuUsage.toFixed(2)}%`);
    }

    if (metrics.memoryUsage && metrics.memoryUsage > this.thresholds.memoryUsage) {
      alerts.push(`High memory usage: ${metrics.memoryUsage.toFixed(2)}%`);
    }

    if (metrics.networkLatency && metrics.networkLatency > this.thresholds.networkLatency) {
      alerts.push(`High network latency: ${metrics.networkLatency.toFixed(2)}ms`);
    }

    if (metrics.batteryLevel && metrics.batteryLevel < this.thresholds.batteryLevel) {
      alerts.push(`Low battery: ${metrics.batteryLevel.toFixed(2)}%`);
    }

    if (alerts.length > 0) {
      this.emit('thresholdExceeded', {
        deviceId: metrics.deviceId,
        alerts,
        metrics,
      });
    }
  }

  public getMetrics(deviceId: string, limit: number = 100): PerformanceMetrics[] {
    const metrics = this.metricsStore.get(deviceId) || [];
    return metrics.slice(-limit);
  }

  public getAverageMetrics(deviceId: string, duration: number = 3600000): any {
    const metrics = this.metricsStore.get(deviceId) || [];
    const cutoff = Date.now() - duration;
    const recentMetrics = metrics.filter(m => m.timestamp.getTime() > cutoff);

    if (recentMetrics.length === 0) {
      return null;
    }

    return {
      cpuUsage: this.average(recentMetrics.map(m => m.cpuUsage).filter(v => v !== undefined) as number[]),
      memoryUsage: this.average(recentMetrics.map(m => m.memoryUsage).filter(v => v !== undefined) as number[]),
      networkLatency: this.average(recentMetrics.map(m => m.networkLatency).filter(v => v !== undefined) as number[]),
      throughput: this.average(recentMetrics.map(m => m.throughput).filter(v => v !== undefined) as number[]),
    };
  }

  private average(values: number[]): number {
    if (values.length === 0) return 0;
    return values.reduce((sum, val) => sum + val, 0) / values.length;
  }

  public setThresholds(thresholds: Partial<PerformanceThresholds>): void {
    this.thresholds = { ...this.thresholds, ...thresholds };
    this.emit('thresholdsUpdated', this.thresholds);
  }

  public getThresholds(): PerformanceThresholds {
    return { ...this.thresholds };
  }

  public clearMetrics(deviceId: string): void {
    this.metricsStore.delete(deviceId);
    this.emit('metricsCleared', { deviceId });
  }
}
