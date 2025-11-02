export interface EnergyData {
  id: string;
  deviceId: string;
  timestamp: string;
  consumption: number;
  unit: EnergyUnit;
  cost?: number;
  currency?: string;
}

export enum EnergyUnit {
  WATT_HOUR = 'Wh',
  KILOWATT_HOUR = 'kWh',
  MEGAWATT_HOUR = 'MWh'
}

export interface EnergyProfile {
  id: string;
  homeId: string;
  dailyAverage: number;
  weeklyAverage: number;
  monthlyAverage: number;
  peakHours: number[];
  offPeakHours: number[];
  totalCost: number;
  projectedCost: number;
}

export interface EnergyForecast {
  timestamp: string;
  predictedConsumption: number;
  confidence: number;
  factors: ForecastFactor[];
}

export interface ForecastFactor {
  name: string;
  impact: number;
  description: string;
}

export interface EnergySavingRecommendation {
  id: string;
  title: string;
  description: string;
  potentialSavings: number;
  difficulty: DifficultyLevel;
  category: string;
  deviceIds: string[];
}

export enum DifficultyLevel {
  EASY = 'easy',
  MEDIUM = 'medium',
  HARD = 'hard'
}
