export class EnergyFormatter {
  static formatEnergy(value: number, unit: 'Wh' | 'kWh' | 'MWh' = 'kWh'): string {
    switch (unit) {
      case 'Wh':
        return `${value.toFixed(2)} Wh`;
      case 'kWh':
        return `${(value / 1000).toFixed(2)} kWh`;
      case 'MWh':
        return `${(value / 1000000).toFixed(2)} MWh`;
      default:
        return `${value.toFixed(2)} kWh`;
    }
  }

  static formatPower(value: number, unit: 'W' | 'kW' | 'MW' = 'W'): string {
    switch (unit) {
      case 'W':
        return `${value.toFixed(2)} W`;
      case 'kW':
        return `${(value / 1000).toFixed(2)} kW`;
      case 'MW':
        return `${(value / 1000000).toFixed(2)} MW`;
      default:
        return `${value.toFixed(2)} W`;
    }
  }

  static formatCost(value: number, currency: string = 'USD'): string {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: currency
    }).format(value);
  }

  static convertEnergy(value: number, from: 'Wh' | 'kWh' | 'MWh', to: 'Wh' | 'kWh' | 'MWh'): number {
    const toWh: Record<string, number> = {
      'Wh': 1,
      'kWh': 1000,
      'MWh': 1000000
    };

    const valueInWh = value * toWh[from];
    return valueInWh / toWh[to];
  }

  static calculateCost(energyKWh: number, ratePerKWh: number): number {
    return energyKWh * ratePerKWh;
  }

  static calculateSavings(currentUsage: number, previousUsage: number): {
    amount: number;
    percentage: number;
  } {
    const amount = previousUsage - currentUsage;
    const percentage = (amount / previousUsage) * 100;

    return {
      amount,
      percentage
    };
  }

  static formatEfficiency(efficiency: number): string {
    return `${(efficiency * 100).toFixed(1)}%`;
  }

  static calculateCarbonFootprint(energyKWh: number, emissionFactor: number = 0.92): number {
    // Default emission factor: 0.92 lbs CO2 per kWh (US average)
    return energyKWh * emissionFactor;
  }

  static formatCarbonFootprint(lbsCO2: number): string {
    if (lbsCO2 < 1000) {
      return `${lbsCO2.toFixed(2)} lbs CO2`;
    } else {
      return `${(lbsCO2 / 2000).toFixed(2)} tons CO2`;
    }
  }

  static estimateTreesEquivalent(lbsCO2: number): number {
    // One tree absorbs approximately 48 lbs of CO2 per year
    return lbsCO2 / 48;
  }

  static formatPeakDemand(value: number): string {
    return `${value.toFixed(2)} kW`;
  }

  static calculateLoadFactor(averageLoad: number, peakLoad: number): number {
    return (averageLoad / peakLoad) * 100;
  }

  static formatDuration(hours: number): string {
    if (hours < 1) {
      return `${Math.round(hours * 60)} minutes`;
    } else if (hours < 24) {
      return `${hours.toFixed(1)} hours`;
    } else {
      return `${(hours / 24).toFixed(1)} days`;
    }
  }
}
