interface SolarPanel {
  panelId: string;
  capacity: number;
  efficiency: number;
  orientation: string;
  tilt: number;
  location: { latitude: number; longitude: number };
}

interface SolarProduction {
  timestamp: Date;
  production: number;
  efficiency: number;
  temperature: number;
  irradiance: number;
}

interface BatteryStorage {
  batteryId: string;
  capacity: number;
  currentCharge: number;
  chargeRate: number;
  dischargeRate: number;
  health: number;
}

export class SolarIntegrationService {
  private panels: Map<string, SolarPanel> = new Map();
  private batteries: Map<string, BatteryStorage> = new Map();
  private productionHistory: Map<string, SolarProduction[]> = new Map();

  async registerPanel(panel: SolarPanel): Promise<void> {
    this.panels.set(panel.panelId, panel);
  }

  async registerBattery(battery: BatteryStorage): Promise<void> {
    this.batteries.set(battery.batteryId, battery);
  }

  async recordProduction(panelId: string, production: SolarProduction): Promise<void> {
    const history = this.productionHistory.get(panelId) || [];
    history.push(production);
    
    if (history.length > 1000) {
      history.shift();
    }
    
    this.productionHistory.set(panelId, history);
  }

  async getCurrentProduction(panelId: string): Promise<number> {
    const panel = this.panels.get(panelId);
    if (!panel) return 0;

    const history = this.productionHistory.get(panelId) || [];
    if (history.length === 0) return 0;

    return history[history.length - 1].production;
  }

  async getTotalProduction(): Promise<number> {
    let total = 0;
    
    for (const panelId of this.panels.keys()) {
      total += await this.getCurrentProduction(panelId);
    }
    
    return total;
  }

  async predictProduction(panelId: string, hours: number): Promise<number[]> {
    const panel = this.panels.get(panelId);
    if (!panel) return [];

    const history = this.productionHistory.get(panelId) || [];
    if (history.length < 24) return [];

    const predictions: number[] = [];
    const avgProduction = history.reduce((sum, p) => sum + p.production, 0) / history.length;

    for (let i = 0; i < hours; i++) {
      const hourOfDay = (new Date().getHours() + i) % 24;
      const seasonalFactor = this.getSeasonalFactor();
      const timeFactor = this.getTimeOfDayFactor(hourOfDay);
      
      predictions.push(avgProduction * seasonalFactor * timeFactor);
    }

    return predictions;
  }

  private getSeasonalFactor(): number {
    const month = new Date().getMonth();
    const seasonalFactors = [0.6, 0.7, 0.8, 0.9, 1.0, 1.0, 1.0, 1.0, 0.9, 0.8, 0.7, 0.6];
    return seasonalFactors[month];
  }

  private getTimeOfDayFactor(hour: number): number {
    if (hour < 6 || hour > 20) return 0;
    if (hour >= 10 && hour <= 14) return 1.0;
    if (hour >= 8 && hour < 10) return 0.7;
    if (hour > 14 && hour <= 16) return 0.7;
    return 0.3;
  }

  async chargeBattery(batteryId: string, amount: number): Promise<boolean> {
    const battery = this.batteries.get(batteryId);
    if (!battery) return false;

    const newCharge = Math.min(battery.capacity, battery.currentCharge + amount);
    battery.currentCharge = newCharge;
    
    return true;
  }

  async dischargeBattery(batteryId: string, amount: number): Promise<boolean> {
    const battery = this.batteries.get(batteryId);
    if (!battery) return false;

    if (battery.currentCharge < amount) return false;

    battery.currentCharge -= amount;
    return true;
  }

  async getBatteryStatus(batteryId: string): Promise<BatteryStorage | null> {
    return this.batteries.get(batteryId) || null;
  }

  async optimizeEnergyFlow(): Promise<{ action: string; amount: number }> {
    const totalProduction = await this.getTotalProduction();
    const totalBatteryCapacity = Array.from(this.batteries.values())
      .reduce((sum, b) => sum + (b.capacity - b.currentCharge), 0);

    if (totalProduction > 0 && totalBatteryCapacity > 0) {
      return {
        action: 'charge',
        amount: Math.min(totalProduction, totalBatteryCapacity)
      };
    }

    return { action: 'none', amount: 0 };
  }
}

export const solarIntegrationService = new SolarIntegrationService();
