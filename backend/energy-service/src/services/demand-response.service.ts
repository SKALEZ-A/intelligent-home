import { EventEmitter } from 'events';

interface DemandResponseEvent {
  id: string;
  type: 'peak_demand' | 'grid_emergency' | 'price_spike' | 'renewable_surplus';
  startTime: number;
  endTime: number;
  severity: 'low' | 'medium' | 'high' | 'critical';
  targetReduction: number;
  incentive?: {
    type: 'credit' | 'discount' | 'rebate';
    amount: number;
  };
  status: 'scheduled' | 'active' | 'completed' | 'cancelled';
}

interface DeviceParticipation {
  deviceId: string;
  deviceType: string;
  priority: number;
  maxReduction: number;
  currentReduction: number;
  participating: boolean;
}

interface DRStrategy {
  name: string;
  devices: DeviceParticipation[];
  expectedReduction: number;
  userComfortImpact: number;
  costSavings: number;
}

export class DemandResponseService extends EventEmitter {
  private activeEvents: Map<string, DemandResponseEvent> = new Map();
  private deviceRegistry: Map<string, DeviceParticipation> = new Map();
  private participationHistory: Array<{
    eventId: string;
    timestamp: number;
    reduction: number;
    savings: number;
  }> = [];

  public registerDevice(device: DeviceParticipation): void {
    this.deviceRegistry.set(device.deviceId, device);
    this.emit('deviceRegistered', device);
  }

  public createEvent(event: Omit<DemandResponseEvent, 'id' | 'status'>): DemandResponseEvent {
    const drEvent: DemandResponseEvent = {
      ...event,
      id: `dr_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      status: 'scheduled'
    };

    this.activeEvents.set(drEvent.id, drEvent);
    this.emit('eventCreated', drEvent);

    return drEvent;
  }

  public async activateEvent(eventId: string): Promise<DRStrategy> {
    const event = this.activeEvents.get(eventId);
    
    if (!event) {
      throw new Error('Event not found');
    }

    event.status = 'active';
    const strategy = this.generateOptimalStrategy(event);
    
    await this.executeStrategy(strategy, event);
    
    this.emit('eventActivated', { event, strategy });
    return strategy;
  }

  private generateOptimalStrategy(event: DemandResponseEvent): DRStrategy {
    const availableDevices = Array.from(this.deviceRegistry.values())
      .filter(d => d.participating)
      .sort((a, b) => {
        const priorityDiff = a.priority - b.priority;
        if (priorityDiff !== 0) return priorityDiff;
        return b.maxReduction - a.maxReduction;
      });

    let remainingTarget = event.targetReduction;
    const selectedDevices: DeviceParticipation[] = [];
    let totalReduction = 0;
    let comfortImpact = 0;

    for (const device of availableDevices) {
      if (remainingTarget <= 0) break;

      const reduction = Math.min(device.maxReduction, remainingTarget);
      selectedDevices.push({
        ...device,
        currentReduction: reduction
      });

      totalReduction += reduction;
      remainingTarget -= reduction;
      comfortImpact += this.calculateComfortImpact(device, reduction);
    }

    const costSavings = this.calculateCostSavings(totalReduction, event);

    return {
      name: `DR Strategy for ${event.type}`,
      devices: selectedDevices,
      expectedReduction: totalReduction,
      userComfortImpact: comfortImpact,
      costSavings
    };
  }

  private async executeStrategy(strategy: DRStrategy, event: DemandResponseEvent): Promise<void> {
    for (const device of strategy.devices) {
      await this.adjustDevicePower(device.deviceId, device.currentReduction);
    }

    this.participationHistory.push({
      eventId: event.id,
      timestamp: Date.now(),
      reduction: strategy.expectedReduction,
      savings: strategy.costSavings
    });
  }

  private async adjustDevicePower(deviceId: string, reduction: number): Promise<void> {
    this.emit('deviceAdjusted', { deviceId, reduction });
  }

  private calculateComfortImpact(device: DeviceParticipation, reduction: number): number {
    const impactFactors: { [key: string]: number } = {
      'hvac': 0.8,
      'water_heater': 0.3,
      'ev_charger': 0.2,
      'pool_pump': 0.1,
      'lighting': 0.4
    };

    const factor = impactFactors[device.deviceType] || 0.5;
    return (reduction / device.maxReduction) * factor;
  }

  private calculateCostSavings(reduction: number, event: DemandResponseEvent): number {
    const baseRate = 0.15;
    const peakRate = 0.35;
    const duration = (event.endTime - event.startTime) / 3600000;
    
    const savings = reduction * (peakRate - baseRate) * duration;
    
    if (event.incentive) {
      return savings + event.incentive.amount;
    }

    return savings;
  }

  public async completeEvent(eventId: string): Promise<void> {
    const event = this.activeEvents.get(eventId);
    
    if (!event) {
      throw new Error('Event not found');
    }

    event.status = 'completed';
    
    for (const device of this.deviceRegistry.values()) {
      device.currentReduction = 0;
      await this.adjustDevicePower(device.deviceId, 0);
    }

    this.emit('eventCompleted', event);
  }

  public getActiveEvents(): DemandResponseEvent[] {
    return Array.from(this.activeEvents.values())
      .filter(e => e.status === 'active' || e.status === 'scheduled');
  }

  public getParticipationStats(): {
    totalEvents: number;
    totalReduction: number;
    totalSavings: number;
    averageReduction: number;
  } {
    const totalEvents = this.participationHistory.length;
    const totalReduction = this.participationHistory.reduce((sum, p) => sum + p.reduction, 0);
    const totalSavings = this.participationHistory.reduce((sum, p) => sum + p.savings, 0);

    return {
      totalEvents,
      totalReduction,
      totalSavings,
      averageReduction: totalEvents > 0 ? totalReduction / totalEvents : 0
    };
  }

  public predictNextEvent(): {
    probability: number;
    expectedTime: number;
    type: DemandResponseEvent['type'];
  } | null {
    if (this.participationHistory.length < 5) {
      return null;
    }

    return {
      probability: 0.65,
      expectedTime: Date.now() + 86400000,
      type: 'peak_demand'
    };
  }
}

export const demandResponseService = new DemandResponseService();
