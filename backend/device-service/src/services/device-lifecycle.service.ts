import { EventEmitter } from 'events';

export enum DeviceLifecycleState {
  PROVISIONING = 'provisioning',
  ACTIVE = 'active',
  INACTIVE = 'inactive',
  MAINTENANCE = 'maintenance',
  DECOMMISSIONED = 'decommissioned',
  FAILED = 'failed'
}

export interface DeviceLifecycleEvent {
  deviceId: string;
  previousState: DeviceLifecycleState;
  currentState: DeviceLifecycleState;
  timestamp: Date;
  reason?: string;
  metadata?: any;
}

export class DeviceLifecycleService extends EventEmitter {
  private deviceStates: Map<string, DeviceLifecycleState> = new Map();
  private stateHistory: Map<string, DeviceLifecycleEvent[]> = new Map();

  async transitionState(
    deviceId: string,
    newState: DeviceLifecycleState,
    reason?: string,
    metadata?: any
  ): Promise<void> {
    const currentState = this.deviceStates.get(deviceId) || DeviceLifecycleState.PROVISIONING;

    if (!this.isValidTransition(currentState, newState)) {
      throw new Error(`Invalid state transition from ${currentState} to ${newState}`);
    }

    const event: DeviceLifecycleEvent = {
      deviceId,
      previousState: currentState,
      currentState: newState,
      timestamp: new Date(),
      reason,
      metadata
    };

    this.deviceStates.set(deviceId, newState);
    
    const history = this.stateHistory.get(deviceId) || [];
    history.push(event);
    this.stateHistory.set(deviceId, history);

    this.emit('stateChanged', event);
    this.emit(`state:${newState}`, event);

    await this.executeStateActions(event);
  }

  private isValidTransition(from: DeviceLifecycleState, to: DeviceLifecycleState): boolean {
    const validTransitions: Record<DeviceLifecycleState, DeviceLifecycleState[]> = {
      [DeviceLifecycleState.PROVISIONING]: [
        DeviceLifecycleState.ACTIVE,
        DeviceLifecycleState.FAILED
      ],
      [DeviceLifecycleState.ACTIVE]: [
        DeviceLifecycleState.INACTIVE,
        DeviceLifecycleState.MAINTENANCE,
        DeviceLifecycleState.FAILED,
        DeviceLifecycleState.DECOMMISSIONED
      ],
      [DeviceLifecycleState.INACTIVE]: [
        DeviceLifecycleState.ACTIVE,
        DeviceLifecycleState.MAINTENANCE,
        DeviceLifecycleState.DECOMMISSIONED
      ],
      [DeviceLifecycleState.MAINTENANCE]: [
        DeviceLifecycleState.ACTIVE,
        DeviceLifecycleState.FAILED,
        DeviceLifecycleState.DECOMMISSIONED
      ],
      [DeviceLifecycleState.FAILED]: [
        DeviceLifecycleState.MAINTENANCE,
        DeviceLifecycleState.DECOMMISSIONED
      ],
      [DeviceLifecycleState.DECOMMISSIONED]: []
    };

    return validTransitions[from]?.includes(to) || false;
  }

  private async executeStateActions(event: DeviceLifecycleEvent): Promise<void> {
    switch (event.currentState) {
      case DeviceLifecycleState.ACTIVE:
        await this.onDeviceActivated(event);
        break;
      case DeviceLifecycleState.INACTIVE:
        await this.onDeviceDeactivated(event);
        break;
      case DeviceLifecycleState.MAINTENANCE:
        await this.onDeviceMaintenance(event);
        break;
      case DeviceLifecycleState.FAILED:
        await this.onDeviceFailed(event);
        break;
      case DeviceLifecycleState.DECOMMISSIONED:
        await this.onDeviceDecommissioned(event);
        break;
    }
  }

  private async onDeviceActivated(event: DeviceLifecycleEvent): Promise<void> {
    console.log(`Device ${event.deviceId} activated`);
  }

  private async onDeviceDeactivated(event: DeviceLifecycleEvent): Promise<void> {
    console.log(`Device ${event.deviceId} deactivated`);
  }

  private async onDeviceMaintenance(event: DeviceLifecycleEvent): Promise<void> {
    console.log(`Device ${event.deviceId} in maintenance mode`);
  }

  private async onDeviceFailed(event: DeviceLifecycleEvent): Promise<void> {
    console.log(`Device ${event.deviceId} failed: ${event.reason}`);
  }

  private async onDeviceDecommissioned(event: DeviceLifecycleEvent): Promise<void> {
    console.log(`Device ${event.deviceId} decommissioned`);
  }

  getCurrentState(deviceId: string): DeviceLifecycleState | undefined {
    return this.deviceStates.get(deviceId);
  }

  getStateHistory(deviceId: string): DeviceLifecycleEvent[] {
    return this.stateHistory.get(deviceId) || [];
  }

  getDevicesByState(state: DeviceLifecycleState): string[] {
    const devices: string[] = [];
    this.deviceStates.forEach((deviceState, deviceId) => {
      if (deviceState === state) {
        devices.push(deviceId);
      }
    });
    return devices;
  }

  async getLifecycleMetrics(): Promise<any> {
    const metrics = {
      total: this.deviceStates.size,
      byState: {} as Record<string, number>,
      averageLifetime: 0,
      failureRate: 0
    };

    Object.values(DeviceLifecycleState).forEach(state => {
      metrics.byState[state] = this.getDevicesByState(state).length;
    });

    const failedDevices = this.getDevicesByState(DeviceLifecycleState.FAILED).length;
    metrics.failureRate = metrics.total > 0 ? (failedDevices / metrics.total) * 100 : 0;

    return metrics;
  }
}
