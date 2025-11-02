import { logger } from '../../../../shared/utils/logger';

export interface DeviceUsageStats {
  deviceId: string;
  totalCommands: number;
  successfulCommands: number;
  failedCommands: number;
  averageResponseTime: number;
  uptime: number;
  lastActive: Date;
}

export interface DevicePerformanceMetrics {
  deviceId: string;
  cpuUsage: number;
  memoryUsage: number;
  networkLatency: number;
  batteryLevel?: number;
  signalStrength?: number;
  temperature?: number;
}

export class DeviceAnalyticsService {
  private usageCache: Map<string, DeviceUsageStats> = new Map();
  private performanceCache: Map<string, DevicePerformanceMetrics> = new Map();

  async trackCommand(
    deviceId: string,
    success: boolean,
    responseTime: number
  ): Promise<void> {
    const stats = this.usageCache.get(deviceId) || this.initializeStats(deviceId);

    stats.totalCommands++;
    if (success) {
      stats.successfulCommands++;
    } else {
      stats.failedCommands++;
    }

    stats.averageResponseTime =
      (stats.averageResponseTime * (stats.totalCommands - 1) + responseTime) /
      stats.totalCommands;
    stats.lastActive = new Date();

    this.usageCache.set(deviceId, stats);
  }

  async recordPerformanceMetrics(
    deviceId: string,
    metrics: Partial<DevicePerformanceMetrics>
  ): Promise<void> {
    const existing = this.performanceCache.get(deviceId) || {
      deviceId,
      cpuUsage: 0,
      memoryUsage: 0,
      networkLatency: 0,
    };

    const updated = { ...existing, ...metrics, deviceId };
    this.performanceCache.set(deviceId, updated);

    logger.debug(`Performance metrics recorded for device ${deviceId}`, metrics);
  }

  async getDeviceUsageStats(deviceId: string): Promise<DeviceUsageStats | null> {
    return this.usageCache.get(deviceId) || null;
  }

  async getDevicePerformanceMetrics(
    deviceId: string
  ): Promise<DevicePerformanceMetrics | null> {
    return this.performanceCache.get(deviceId) || null;
  }

  async getAllDeviceStats(): Promise<DeviceUsageStats[]> {
    return Array.from(this.usageCache.values());
  }

  async getTopPerformingDevices(limit: number = 10): Promise<DeviceUsageStats[]> {
    const allStats = Array.from(this.usageCache.values());
    return allStats
      .sort((a, b) => {
        const aSuccessRate = a.successfulCommands / a.totalCommands;
        const bSuccessRate = b.successfulCommands / b.totalCommands;
        return bSuccessRate - aSuccessRate;
      })
      .slice(0, limit);
  }

  async getUnderperformingDevices(
    threshold: number = 0.8,
    limit: number = 10
  ): Promise<DeviceUsageStats[]> {
    const allStats = Array.from(this.usageCache.values());
    return allStats
      .filter((stats) => {
        const successRate = stats.successfulCommands / stats.totalCommands;
        return successRate < threshold;
      })
      .sort((a, b) => {
        const aSuccessRate = a.successfulCommands / a.totalCommands;
        const bSuccessRate = b.successfulCommands / b.totalCommands;
        return aSuccessRate - bSuccessRate;
      })
      .slice(0, limit);
  }

  private initializeStats(deviceId: string): DeviceUsageStats {
    return {
      deviceId,
      totalCommands: 0,
      successfulCommands: 0,
      failedCommands: 0,
      averageResponseTime: 0,
      uptime: 0,
      lastActive: new Date(),
    };
  }

  async clearDeviceStats(deviceId: string): Promise<void> {
    this.usageCache.delete(deviceId);
    this.performanceCache.delete(deviceId);
    logger.info(`Analytics cleared for device ${deviceId}`);
  }
}
