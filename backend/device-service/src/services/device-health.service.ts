import { DeviceHealth } from '../../../shared/types';
import { AppError } from '../../../shared/utils/errors';
import { createLogger } from '../../../shared/utils/logger';
import { DeviceRepository } from '../repositories/device.repository';
import { DeviceCommandRepository } from '../repositories/device-command.repository';
import { getTimescalePool } from '../config/timescale';

const logger = createLogger('DeviceHealthService');

export class DeviceHealthService {
  private deviceRepository = new DeviceRepository();
  private commandRepository = new DeviceCommandRepository();

  async getDeviceHealth(deviceId: string, userId: string): Promise<DeviceHealth> {
    try {
      const device = await this.deviceRepository.findById(deviceId);
      if (!device) {
        throw new AppError('Device not found', 404, 'DEVICE_NOT_FOUND');
      }

      if (device.userId !== userId) {
        throw new AppError('Access denied', 403, 'ACCESS_DENIED');
      }

      // Calculate health metrics
      const [uptime, avgResponseTime, errorRate, commandSuccessRate] = await Promise.all([
        this.calculateUptime(deviceId),
        this.calculateAvgResponseTime(deviceId),
        this.calculateErrorRate(deviceId),
        this.commandRepository.getSuccessRate(deviceId, 7),
      ]);

      // Calculate overall health score (0-100)
      const healthScore = this.calculateHealthScore({
        uptime,
        avgResponseTime,
        errorRate,
        commandSuccessRate,
        batteryLevel: device.batteryLevel,
        signalStrength: device.signalStrength,
        isOnline: device.isOnline,
      });

      // Get last error
      const failedCommands = await this.commandRepository.findFailedCommands(deviceId, 1);
      const lastError = failedCommands.length > 0 ? failedCommands[0].error : undefined;
      const lastErrorAt = failedCommands.length > 0 ? failedCommands[0].completedAt : undefined;

      // Generate recommendations
      const recommendations = this.generateRecommendations({
        healthScore,
        uptime,
        avgResponseTime,
        errorRate,
        batteryLevel: device.batteryLevel,
        signalStrength: device.signalStrength,
        isOnline: device.isOnline,
        lastSeen: device.lastSeen,
      });

      const health: DeviceHealth = {
        deviceId,
        healthScore,
        uptime,
        avgResponseTime,
        errorRate,
        lastError,
        lastErrorAt,
        batteryHealth: device.batteryLevel ? this.calculateBatteryHealth(device.batteryLevel) : undefined,
        signalQuality: device.signalStrength ? this.calculateSignalQuality(device.signalStrength) : undefined,
        recommendations,
      };

      return health;
    } catch (error) {
      if (error instanceof AppError) throw error;
      logger.error('Error getting device health', error as Error);
      throw new AppError('Failed to get device health', 500, 'HEALTH_CHECK_ERROR');
    }
  }

  private async calculateUptime(deviceId: string): Promise<number> {
    try {
      const pool = getTimescalePool();
      const result = await pool.query(
        `SELECT 
          COUNT(CASE WHEN attributes->>'online' = 'true' THEN 1 END)::float / 
          NULLIF(COUNT(*), 0) * 100 as uptime
         FROM device_states
         WHERE device_id = $1 
         AND time >= NOW() - INTERVAL '7 days'`,
        [deviceId]
      );

      return result.rows[0]?.uptime || 0;
    } catch (error) {
      logger.error('Error calculating uptime', error as Error);
      return 0;
    }
  }

  private async calculateAvgResponseTime(deviceId: string): Promise<number> {
    try {
      const pool = getTimescalePool();
      const result = await pool.query(
        `SELECT AVG(EXTRACT(EPOCH FROM (completed_at - executed_at)) * 1000) as avg_response_time
         FROM device_commands
         WHERE device_id = $1 
         AND status = 'completed'
         AND executed_at IS NOT NULL
         AND completed_at IS NOT NULL
         AND created_at >= NOW() - INTERVAL '7 days'`,
        [deviceId]
      );

      return result.rows[0]?.avg_response_time || 0;
    } catch (error) {
      logger.error('Error calculating avg response time', error as Error);
      return 0;
    }
  }

  private async calculateErrorRate(deviceId: string): Promise<number> {
    try {
      const pool = getTimescalePool();
      const result = await pool.query(
        `SELECT 
          COUNT(CASE WHEN severity IN ('high', 'critical') THEN 1 END)::float / 
          NULLIF(COUNT(*), 0) * 100 as error_rate
         FROM device_events
         WHERE device_id = $1 
         AND time >= NOW() - INTERVAL '7 days'`,
        [deviceId]
      );

      return result.rows[0]?.error_rate || 0;
    } catch (error) {
      logger.error('Error calculating error rate', error as Error);
      return 0;
    }
  }

  private calculateHealthScore(metrics: {
    uptime: number;
    avgResponseTime: number;
    errorRate: number;
    commandSuccessRate: number;
    batteryLevel?: number;
    signalStrength?: number;
    isOnline: boolean;
  }): number {
    let score = 0;

    // Uptime (30 points)
    score += (metrics.uptime / 100) * 30;

    // Response time (20 points) - lower is better
    const responseScore = Math.max(0, 20 - (metrics.avgResponseTime / 1000) * 2);
    score += responseScore;

    // Error rate (20 points) - lower is better
    score += Math.max(0, 20 - metrics.errorRate);

    // Command success rate (20 points)
    score += (metrics.commandSuccessRate / 100) * 20;

    // Battery level (5 points)
    if (metrics.batteryLevel !== undefined) {
      score += (metrics.batteryLevel / 100) * 5;
    } else {
      score += 5; // Full points if not battery powered
    }

    // Signal strength (5 points)
    if (metrics.signalStrength !== undefined) {
      score += (metrics.signalStrength / 100) * 5;
    } else {
      score += 5; // Full points if not applicable
    }

    // Online status penalty
    if (!metrics.isOnline) {
      score *= 0.5; // 50% penalty for offline devices
    }

    return Math.round(Math.max(0, Math.min(100, score)));
  }

  private calculateBatteryHealth(batteryLevel: number): number {
    // Simple battery health calculation
    // In a real system, this would consider discharge rate, charge cycles, etc.
    if (batteryLevel >= 80) return 100;
    if (batteryLevel >= 60) return 90;
    if (batteryLevel >= 40) return 75;
    if (batteryLevel >= 20) return 50;
    return 25;
  }

  private calculateSignalQuality(signalStrength: number): number {
    // Convert signal strength to quality score
    if (signalStrength >= 80) return 100;
    if (signalStrength >= 60) return 80;
    if (signalStrength >= 40) return 60;
    if (signalStrength >= 20) return 40;
    return 20;
  }

  private generateRecommendations(metrics: {
    healthScore: number;
    uptime: number;
    avgResponseTime: number;
    errorRate: number;
    batteryLevel?: number;
    signalStrength?: number;
    isOnline: boolean;
    lastSeen: Date;
  }): string[] {
    const recommendations: string[] = [];

    if (!metrics.isOnline) {
      const minutesOffline = Math.floor((Date.now() - metrics.lastSeen.getTime()) / 60000);
      recommendations.push(`Device is offline for ${minutesOffline} minutes. Check power and connectivity.`);
    }

    if (metrics.uptime < 90) {
      recommendations.push('Device has low uptime. Consider checking power supply or network stability.');
    }

    if (metrics.avgResponseTime > 5000) {
      recommendations.push('Device has slow response times. Check network latency or device performance.');
    }

    if (metrics.errorRate > 10) {
      recommendations.push('Device has high error rate. Review device logs for issues.');
    }

    if (metrics.batteryLevel !== undefined && metrics.batteryLevel < 20) {
      recommendations.push('Battery level is low. Replace or recharge battery soon.');
    }

    if (metrics.signalStrength !== undefined && metrics.signalStrength < 40) {
      recommendations.push('Weak signal strength. Consider moving device closer to hub or adding a repeater.');
    }

    if (metrics.healthScore < 50) {
      recommendations.push('Overall device health is poor. Consider device replacement or maintenance.');
    }

    if (recommendations.length === 0) {
      recommendations.push('Device is operating normally.');
    }

    return recommendations;
  }

  async getHomeDevicesHealth(homeId: string, userId: string): Promise<DeviceHealth[]> {
    try {
      const devices = await this.deviceRepository.findByHomeId(homeId, userId);
      const healthPromises = devices.map(device => 
        this.getDeviceHealth(device.id, userId).catch(error => {
          logger.error('Error getting device health', { deviceId: device.id, error });
          return null;
        })
      );

      const healthResults = await Promise.all(healthPromises);
      return healthResults.filter(h => h !== null) as DeviceHealth[];
    } catch (error) {
      logger.error('Error getting home devices health', error as Error);
      throw new AppError('Failed to get home devices health', 500, 'HEALTH_CHECK_ERROR');
    }
  }

  async getUnhealthyDevices(homeId: string, userId: string, threshold: number = 70): Promise<DeviceHealth[]> {
    try {
      const allHealth = await this.getHomeDevicesHealth(homeId, userId);
      return allHealth.filter(h => h.healthScore < threshold);
    } catch (error) {
      logger.error('Error getting unhealthy devices', error as Error);
      throw new AppError('Failed to get unhealthy devices', 500, 'HEALTH_CHECK_ERROR');
    }
  }

  async monitorDeviceHealth(deviceId: string): Promise<void> {
    try {
      // This would be called periodically to monitor device health
      const device = await this.deviceRepository.findById(deviceId);
      if (!device) return;

      const health = await this.getDeviceHealth(deviceId, device.userId);

      // Store health metrics in TimescaleDB
      const pool = getTimescalePool();
      await pool.query(
        `INSERT INTO device_metrics (time, device_id, home_id, metric_name, metric_value, tags)
         VALUES (NOW(), $1, $2, 'health_score', $3, $4)`,
        [deviceId, device.homeId, health.healthScore, JSON.stringify({ uptime: health.uptime, errorRate: health.errorRate })]
      );

      // Trigger alerts if health is poor
      if (health.healthScore < 50) {
        logger.warn('Device health is poor', { deviceId, healthScore: health.healthScore });
        // Emit event for notification service
        this.emit('device:health:poor', { deviceId, health });
      }

      // Check battery level
      if (device.batteryLevel !== undefined && device.batteryLevel < 20) {
        logger.warn('Device battery is low', { deviceId, batteryLevel: device.batteryLevel });
        this.emit('device:battery:low', { deviceId, batteryLevel: device.batteryLevel });
      }

      // Check signal strength
      if (device.signalStrength !== undefined && device.signalStrength < 30) {
        logger.warn('Device signal is weak', { deviceId, signalStrength: device.signalStrength });
        this.emit('device:signal:weak', { deviceId, signalStrength: device.signalStrength });
      }

    } catch (error) {
      logger.error('Error monitoring device health', error as Error);
    }
  }

  private emit(event: string, data: any): void {
    // This would integrate with an event bus or message queue
    logger.debug('Health event emitted', { event, data });
  }
}
