export interface BatteryStatus {
  deviceId: string;
  level: number;
  voltage: number;
  temperature: number;
  health: 'good' | 'fair' | 'poor' | 'critical';
  cycleCount: number;
  isCharging: boolean;
  estimatedTimeToFull?: number;
  estimatedTimeToEmpty?: number;
}

export class BatteryManagementService {
  private batteryStates: Map<string, BatteryStatus> = new Map();

  async updateBatteryStatus(deviceId: string, status: Partial<BatteryStatus>): Promise<BatteryStatus> {
    const current = this.batteryStates.get(deviceId) || this.createDefaultStatus(deviceId);
    const updated = { ...current, ...status };
    
    updated.health = this.calculateBatteryHealth(updated);
    
    if (updated.isCharging) {
      updated.estimatedTimeToFull = this.estimateTimeToFull(updated);
    } else {
      updated.estimatedTimeToEmpty = this.estimateTimeToEmpty(updated);
    }

    this.batteryStates.set(deviceId, updated);
    
    if (updated.level < 20) {
      await this.sendLowBatteryAlert(deviceId, updated);
    }

    return updated;
  }

  private createDefaultStatus(deviceId: string): BatteryStatus {
    return {
      deviceId,
      level: 100,
      voltage: 3.7,
      temperature: 25,
      health: 'good',
      cycleCount: 0,
      isCharging: false
    };
  }

  private calculateBatteryHealth(status: BatteryStatus): 'good' | 'fair' | 'poor' | 'critical' {
    if (status.cycleCount > 1000 || status.temperature > 45) return 'critical';
    if (status.cycleCount > 500 || status.temperature > 40) return 'poor';
    if (status.cycleCount > 300 || status.temperature > 35) return 'fair';
    return 'good';
  }

  private estimateTimeToFull(status: BatteryStatus): number {
    const remainingCapacity = 100 - status.level;
    const chargingRate = 1.5;
    return Math.ceil(remainingCapacity / chargingRate);
  }

  private estimateTimeToEmpty(status: BatteryStatus): number {
    const dischargingRate = 0.5;
    return Math.ceil(status.level / dischargingRate);
  }

  private async sendLowBatteryAlert(deviceId: string, status: BatteryStatus): Promise<void> {
    console.log(`Low battery alert for device ${deviceId}: ${status.level}%`);
  }

  async getBatteryStatus(deviceId: string): Promise<BatteryStatus | null> {
    return this.batteryStates.get(deviceId) || null;
  }

  async getAllBatteryStatuses(): Promise<BatteryStatus[]> {
    return Array.from(this.batteryStates.values());
  }

  async getCriticalBatteries(): Promise<BatteryStatus[]> {
    return Array.from(this.batteryStates.values()).filter(
      status => status.level < 10 || status.health === 'critical'
    );
  }

  async optimizeChargingSchedule(deviceId: string, preferences: any): Promise<any> {
    const status = this.batteryStates.get(deviceId);
    if (!status) return null;

    return {
      deviceId,
      recommendedChargingTime: this.calculateOptimalChargingTime(preferences),
      estimatedCost: this.estimateChargingCost(status, preferences),
      carbonFootprint: this.calculateCarbonFootprint(status, preferences)
    };
  }

  private calculateOptimalChargingTime(preferences: any): string {
    return '02:00 AM';
  }

  private estimateChargingCost(status: BatteryStatus, preferences: any): number {
    const energyNeeded = (100 - status.level) * 0.01;
    const costPerKWh = preferences.electricityRate || 0.12;
    return energyNeeded * costPerKWh;
  }

  private calculateCarbonFootprint(status: BatteryStatus, preferences: any): number {
    const energyNeeded = (100 - status.level) * 0.01;
    const carbonPerKWh = preferences.carbonIntensity || 0.5;
    return energyNeeded * carbonPerKWh;
  }
}
