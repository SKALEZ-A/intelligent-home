import { EventEmitter } from 'events';

interface AnomalyDetectionConfig {
  sensitivityLevel: 'low' | 'medium' | 'high';
  windowSize: number;
  threshold: number;
}

interface DeviceMetrics {
  deviceId: string;
  timestamp: Date;
  temperature?: number;
  humidity?: number;
  powerConsumption?: number;
  responseTime?: number;
  errorRate?: number;
  signalStrength?: number;
}

interface Anomaly {
  deviceId: string;
  type: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  detectedAt: Date;
  metrics: DeviceMetrics;
  description: string;
  confidence: number;
}

export class DeviceAnomalyDetectionService extends EventEmitter {
  private config: AnomalyDetectionConfig;
  private metricsHistory: Map<string, DeviceMetrics[]>;
  private baselineProfiles: Map<string, any>;

  constructor(config: Partial<AnomalyDetectionConfig> = {}) {
    super();
    this.config = {
      sensitivityLevel: config.sensitivityLevel || 'medium',
      windowSize: config.windowSize || 100,
      threshold: config.threshold || 2.5,
    };
    this.metricsHistory = new Map();
    this.baselineProfiles = new Map();
  }

  public async analyzeMetrics(metrics: DeviceMetrics): Promise<Anomaly[]> {
    const anomalies: Anomaly[] = [];
    
    this.addToHistory(metrics);
    
    const history = this.metricsHistory.get(metrics.deviceId) || [];
    if (history.length < 10) {
      return anomalies;
    }

    const baseline = this.getBaseline(metrics.deviceId);
    
    if (metrics.temperature !== undefined) {
      const tempAnomaly = this.detectTemperatureAnomaly(metrics, baseline);
      if (tempAnomaly) anomalies.push(tempAnomaly);
    }

    if (metrics.powerConsumption !== undefined) {
      const powerAnomaly = this.detectPowerAnomaly(metrics, baseline);
      if (powerAnomaly) anomalies.push(powerAnomaly);
    }

    if (metrics.responseTime !== undefined) {
      const responseAnomaly = this.detectResponseTimeAnomaly(metrics, baseline);
      if (responseAnomaly) anomalies.push(responseAnomaly);
    }

    if (metrics.errorRate !== undefined) {
      const errorAnomaly = this.detectErrorRateAnomaly(metrics, baseline);
      if (errorAnomaly) anomalies.push(errorAnomaly);
    }

    anomalies.forEach(anomaly => {
      this.emit('anomalyDetected', anomaly);
    });

    return anomalies;
  }

  private addToHistory(metrics: DeviceMetrics): void {
    if (!this.metricsHistory.has(metrics.deviceId)) {
      this.metricsHistory.set(metrics.deviceId, []);
    }

    const history = this.metricsHistory.get(metrics.deviceId)!;
    history.push(metrics);

    if (history.length > this.config.windowSize) {
      history.shift();
    }
  }

  private getBaseline(deviceId: string): any {
    if (!this.baselineProfiles.has(deviceId)) {
      this.calculateBaseline(deviceId);
    }
    return this.baselineProfiles.get(deviceId);
  }

  private calculateBaseline(deviceId: string): void {
    const history = this.metricsHistory.get(deviceId) || [];
    if (history.length === 0) return;

    const baseline = {
      temperature: this.calculateStats(history.map(m => m.temperature).filter(v => v !== undefined) as number[]),
      powerConsumption: this.calculateStats(history.map(m => m.powerConsumption).filter(v => v !== undefined) as number[]),
      responseTime: this.calculateStats(history.map(m => m.responseTime).filter(v => v !== undefined) as number[]),
      errorRate: this.calculateStats(history.map(m => m.errorRate).filter(v => v !== undefined) as number[]),
    };

    this.baselineProfiles.set(deviceId, baseline);
  }

  private calculateStats(values: number[]): { mean: number; stdDev: number; min: number; max: number } {
    if (values.length === 0) {
      return { mean: 0, stdDev: 0, min: 0, max: 0 };
    }

    const mean = values.reduce((sum, val) => sum + val, 0) / values.length;
    const variance = values.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / values.length;
    const stdDev = Math.sqrt(variance);
    const min = Math.min(...values);
    const max = Math.max(...values);

    return { mean, stdDev, min, max };
  }

  private detectTemperatureAnomaly(metrics: DeviceMetrics, baseline: any): Anomaly | null {
    if (!metrics.temperature || !baseline.temperature) return null;

    const zScore = Math.abs((metrics.temperature - baseline.temperature.mean) / baseline.temperature.stdDev);
    
    if (zScore > this.config.threshold) {
      return {
        deviceId: metrics.deviceId,
        type: 'temperature',
        severity: this.calculateSeverity(zScore),
        detectedAt: new Date(),
        metrics,
        description: `Temperature anomaly detected: ${metrics.temperature}°C (baseline: ${baseline.temperature.mean.toFixed(2)}°C)`,
        confidence: Math.min(zScore / 5, 1),
      };
    }

    return null;
  }

  private detectPowerAnomaly(metrics: DeviceMetrics, baseline: any): Anomaly | null {
    if (!metrics.powerConsumption || !baseline.powerConsumption) return null;

    const zScore = Math.abs((metrics.powerConsumption - baseline.powerConsumption.mean) / baseline.powerConsumption.stdDev);
    
    if (zScore > this.config.threshold) {
      return {
        deviceId: metrics.deviceId,
        type: 'power_consumption',
        severity: this.calculateSeverity(zScore),
        detectedAt: new Date(),
        metrics,
        description: `Power consumption anomaly: ${metrics.powerConsumption}W (baseline: ${baseline.powerConsumption.mean.toFixed(2)}W)`,
        confidence: Math.min(zScore / 5, 1),
      };
    }

    return null;
  }

  private detectResponseTimeAnomaly(metrics: DeviceMetrics, baseline: any): Anomaly | null {
    if (!metrics.responseTime || !baseline.responseTime) return null;

    const zScore = Math.abs((metrics.responseTime - baseline.responseTime.mean) / baseline.responseTime.stdDev);
    
    if (zScore > this.config.threshold) {
      return {
        deviceId: metrics.deviceId,
        type: 'response_time',
        severity: this.calculateSeverity(zScore),
        detectedAt: new Date(),
        metrics,
        description: `Response time anomaly: ${metrics.responseTime}ms (baseline: ${baseline.responseTime.mean.toFixed(2)}ms)`,
        confidence: Math.min(zScore / 5, 1),
      };
    }

    return null;
  }

  private detectErrorRateAnomaly(metrics: DeviceMetrics, baseline: any): Anomaly | null {
    if (!metrics.errorRate || !baseline.errorRate) return null;

    const zScore = Math.abs((metrics.errorRate - baseline.errorRate.mean) / baseline.errorRate.stdDev);
    
    if (zScore > this.config.threshold) {
      return {
        deviceId: metrics.deviceId,
        type: 'error_rate',
        severity: this.calculateSeverity(zScore),
        detectedAt: new Date(),
        metrics,
        description: `Error rate anomaly: ${(metrics.errorRate * 100).toFixed(2)}% (baseline: ${(baseline.errorRate.mean * 100).toFixed(2)}%)`,
        confidence: Math.min(zScore / 5, 1),
      };
    }

    return null;
  }

  private calculateSeverity(zScore: number): 'low' | 'medium' | 'high' | 'critical' {
    if (zScore > 5) return 'critical';
    if (zScore > 4) return 'high';
    if (zScore > 3) return 'medium';
    return 'low';
  }

  public async getAnomalyHistory(deviceId: string, limit: number = 100): Promise<Anomaly[]> {
    return [];
  }

  public clearHistory(deviceId: string): void {
    this.metricsHistory.delete(deviceId);
    this.baselineProfiles.delete(deviceId);
  }
}
