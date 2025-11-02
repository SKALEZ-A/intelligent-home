import { EventEmitter } from 'events';
import { logger } from '../../../../shared/utils/logger';

export interface LoadBalancingStrategy {
  type: 'time_shift' | 'priority' | 'round_robin' | 'adaptive';
  config: {
    maxLoad?: number;
    priorityLevels?: Map<string, number>;
    shiftWindow?: number;
    adaptiveThreshold?: number;
  };
}

export interface DeviceLoad {
  deviceId: string;
  deviceName: string;
  currentPower: number;
  averagePower: number;
  priority: number;
  flexible: boolean;
  minRuntime?: number;
  maxDelay?: number;
}

export interface LoadBalancingResult {
  success: boolean;
  strategy: string;
  devicesAffected: string[];
  powerReduced: number;
  recommendations: string[];
}

export class LoadBalancingService extends EventEmitter {
  private maxSystemLoad: number;
  private currentLoad: number = 0;
  private deviceLoads: Map<string, DeviceLoad> = new Map();

  constructor(maxSystemLoad: number = 10000) {
    super();
    this.maxSystemLoad = maxSystemLoad;
  }

  async balanceLoad(strategy: LoadBalancingStrategy): Promise<LoadBalancingResult> {
    logger.info('Starting load balancing', { 
      strategy: strategy.type,
      currentLoad: this.currentLoad,
      maxLoad: this.maxSystemLoad,
    });

    switch (strategy.type) {
      case 'time_shift':
        return this.timeShiftStrategy(strategy);
      case 'priority':
        return this.priorityStrategy(strategy);
      case 'round_robin':
        return this.roundRobinStrategy(strategy);
      case 'adaptive':
        return this.adaptiveStrategy(strategy);
      default:
        throw new Error(`Unknown strategy: ${strategy.type}`);
    }
  }

  private async timeShiftStrategy(strategy: LoadBalancingStrategy): Promise<LoadBalancingResult> {
    const devicesAffected: string[] = [];
    let powerReduced = 0;
    const recommendations: string[] = [];

    // Find flexible devices that can be shifted
    const flexibleDevices = Array.from(this.deviceLoads.values())
      .filter(device => device.flexible)
      .sort((a, b) => a.priority - b.priority);

    for (const device of flexibleDevices) {
      if (this.currentLoad <= this.maxSystemLoad) break;

      const shiftWindow = strategy.config.shiftWindow || 3600000; // 1 hour default
      
      devicesAffected.push(device.deviceId);
      powerReduced += device.currentPower;
      this.currentLoad -= device.currentPower;

      recommendations.push(
        `Shift ${device.deviceName} to off-peak hours (within ${shiftWindow / 60000} minutes)`
      );

      this.emit('device:shifted', {
        deviceId: device.deviceId,
        shiftWindow,
        reason: 'load_balancing',
      });
    }

    return {
      success: this.currentLoad <= this.maxSystemLoad,
      strategy: 'time_shift',
      devicesAffected,
      powerReduced,
      recommendations,
    };
  }

  private async priorityStrategy(strategy: LoadBalancingStrategy): Promise<LoadBalancingResult> {
    const devicesAffected: string[] = [];
    let powerReduced = 0;
    const recommendations: string[] = [];

    // Sort devices by priority (lower priority = can be turned off first)
    const sortedDevices = Array.from(this.deviceLoads.values())
      .sort((a, b) => a.priority - b.priority);

    for (const device of sortedDevices) {
      if (this.currentLoad <= this.maxSystemLoad) break;

      if (device.priority < 5) { // Only affect low priority devices
        devicesAffected.push(device.deviceId);
        powerReduced += device.currentPower;
        this.currentLoad -= device.currentPower;

        recommendations.push(
          `Reduce power for ${device.deviceName} (Priority: ${device.priority})`
        );

        this.emit('device:throttled', {
          deviceId: device.deviceId,
          reason: 'priority_balancing',
        });
      }
    }

    return {
      success: this.currentLoad <= this.maxSystemLoad,
      strategy: 'priority',
      devicesAffected,
      powerReduced,
      recommendations,
    };
  }

  private async roundRobinStrategy(strategy: LoadBalancingStrategy): Promise<LoadBalancingResult> {
    const devicesAffected: string[] = [];
    let powerReduced = 0;
    const recommendations: string[] = [];

    const devices = Array.from(this.deviceLoads.values());
    let index = 0;

    while (this.currentLoad > this.maxSystemLoad && index < devices.length) {
      const device = devices[index];
      
      if (device.flexible) {
        const reduction = device.currentPower * 0.2; // Reduce by 20%
        
        devicesAffected.push(device.deviceId);
        powerReduced += reduction;
        this.currentLoad -= reduction;

        recommendations.push(
          `Reduce ${device.deviceName} power by 20%`
        );

        this.emit('device:reduced', {
          deviceId: device.deviceId,
          reduction: 0.2,
          reason: 'round_robin_balancing',
        });
      }

      index++;
    }

    return {
      success: this.currentLoad <= this.maxSystemLoad,
      strategy: 'round_robin',
      devicesAffected,
      powerReduced,
      recommendations,
    };
  }

  private async adaptiveStrategy(strategy: LoadBalancingStrategy): Promise<LoadBalancingResult> {
    const devicesAffected: string[] = [];
    let powerReduced = 0;
    const recommendations: string[] = [];

    const threshold = strategy.config.adaptiveThreshold || 0.9;
    const targetLoad = this.maxSystemLoad * threshold;

    // Analyze device usage patterns
    const devices = Array.from(this.deviceLoads.values())
      .map(device => ({
        ...device,
        efficiency: device.averagePower / device.currentPower,
        score: device.priority * (device.currentPower / device.averagePower),
      }))
      .sort((a, b) => a.score - b.score);

    for (const device of devices) {
      if (this.currentLoad <= targetLoad) break;

      const optimalReduction = Math.min(
        device.currentPower * 0.3,
        this.currentLoad - targetLoad
      );

      devicesAffected.push(device.deviceId);
      powerReduced += optimalReduction;
      this.currentLoad -= optimalReduction;

      recommendations.push(
        `Optimize ${device.deviceName} (Efficiency: ${(device.efficiency * 100).toFixed(1)}%)`
      );

      this.emit('device:optimized', {
        deviceId: device.deviceId,
        reduction: optimalReduction,
        reason: 'adaptive_balancing',
      });
    }

    return {
      success: this.currentLoad <= targetLoad,
      strategy: 'adaptive',
      devicesAffected,
      powerReduced,
      recommendations,
    };
  }

  updateDeviceLoad(deviceId: string, load: DeviceLoad): void {
    const previousLoad = this.deviceLoads.get(deviceId);
    
    if (previousLoad) {
      this.currentLoad -= previousLoad.currentPower;
    }

    this.deviceLoads.set(deviceId, load);
    this.currentLoad += load.currentPower;

    this.emit('load:updated', {
      deviceId,
      currentLoad: this.currentLoad,
      maxLoad: this.maxSystemLoad,
      utilization: (this.currentLoad / this.maxSystemLoad) * 100,
    });

    // Auto-balance if threshold exceeded
    if (this.currentLoad > this.maxSystemLoad * 0.95) {
      this.emit('load:critical', {
        currentLoad: this.currentLoad,
        maxLoad: this.maxSystemLoad,
      });
    }
  }

  removeDevice(deviceId: string): void {
    const device = this.deviceLoads.get(deviceId);
    if (device) {
      this.currentLoad -= device.currentPower;
      this.deviceLoads.delete(deviceId);
    }
  }

  getCurrentLoad(): number {
    return this.currentLoad;
  }

  getLoadUtilization(): number {
    return (this.currentLoad / this.maxSystemLoad) * 100;
  }

  getDeviceLoads(): DeviceLoad[] {
    return Array.from(this.deviceLoads.values());
  }

  predictPeakLoad(timeWindow: number): number {
    // Simple prediction based on current trends
    const devices = Array.from(this.deviceLoads.values());
    const totalAverage = devices.reduce((sum, d) => sum + d.averagePower, 0);
    const growthFactor = 1.2; // Assume 20% growth during peak
    
    return totalAverage * growthFactor;
  }

  async scheduleLoadShift(deviceId: string, targetTime: Date): Promise<void> {
    const device = this.deviceLoads.get(deviceId);
    
    if (!device || !device.flexible) {
      throw new Error('Device cannot be shifted');
    }

    const delay = targetTime.getTime() - Date.now();
    
    if (delay <= 0) {
      throw new Error('Target time must be in the future');
    }

    logger.info('Load shift scheduled', {
      deviceId,
      deviceName: device.deviceName,
      targetTime,
    });

    this.emit('shift:scheduled', {
      deviceId,
      targetTime,
      currentPower: device.currentPower,
    });
  }
}

export const loadBalancingService = new LoadBalancingService();
