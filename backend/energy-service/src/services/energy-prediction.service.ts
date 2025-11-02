import { EventEmitter } from 'events';
import { logger } from '../../../shared/utils/logger';

interface EnergyDataPoint {
  timestamp: Date;
  consumption: number;
  production?: number;
  cost: number;
  source: 'grid' | 'solar' | 'battery' | 'wind';
}

interface PredictionModel {
  id: string;
  name: string;
  type: 'linear' | 'polynomial' | 'exponential' | 'seasonal';
  accuracy: number;
  lastTrained: Date;
  parameters: Record<string, number>;
}

interface EnergyPrediction {
  timestamp: Date;
  predictedConsumption: number;
  predictedCost: number;
  confidence: number;
  factors: string[];
}

interface SeasonalPattern {
  season: 'spring' | 'summer' | 'fall' | 'winter';
  averageConsumption: number;
  peakHours: number[];
  offPeakHours: number[];
}

export class EnergyPredictionService extends EventEmitter {
  private historicalData: EnergyDataPoint[] = [];
  private models: Map<string, PredictionModel> = new Map();
  private seasonalPatterns: Map<string, SeasonalPattern> = new Map();
  private readonly maxHistoricalDays = 365;

  constructor() {
    super();
    this.initializeModels();
    this.initializeSeasonalPatterns();
  }

  private initializeModels(): void {
    // Linear regression model
    this.models.set('linear', {
      id: 'linear',
      name: 'Linear Regression',
      type: 'linear',
      accuracy: 0.75,
      lastTrained: new Date(),
      parameters: { slope: 0, intercept: 0 }
    });

    // Polynomial model
    this.models.set('polynomial', {
      id: 'polynomial',
      name: 'Polynomial Regression',
      type: 'polynomial',
      accuracy: 0.82,
      lastTrained: new Date(),
      parameters: { a: 0, b: 0, c: 0 }
    });

    // Seasonal model
    this.models.set('seasonal', {
      id: 'seasonal',
      name: 'Seasonal Decomposition',
      type: 'seasonal',
      accuracy: 0.88,
      lastTrained: new Date(),
      parameters: { trend: 0, seasonal: 0, residual: 0 }
    });
  }

  private initializeSeasonalPatterns(): void {
    this.seasonalPatterns.set('spring', {
      season: 'spring',
      averageConsumption: 450,
      peakHours: [7, 8, 18, 19, 20],
      offPeakHours: [1, 2, 3, 4, 5, 6]
    });

    this.seasonalPatterns.set('summer', {
      season: 'summer',
      averageConsumption: 650,
      peakHours: [12, 13, 14, 15, 16, 17, 18],
      offPeakHours: [1, 2, 3, 4, 5, 6, 22, 23]
    });

    this.seasonalPatterns.set('fall', {
      season: 'fall',
      averageConsumption: 480,
      peakHours: [7, 8, 18, 19, 20],
      offPeakHours: [1, 2, 3, 4, 5, 6]
    });

    this.seasonalPatterns.set('winter', {
      season: 'winter',
      averageConsumption: 750,
      peakHours: [6, 7, 8, 17, 18, 19, 20, 21],
      offPeakHours: [1, 2, 3, 4, 5]
    });
  }

  addDataPoint(dataPoint: EnergyDataPoint): void {
    this.historicalData.push(dataPoint);

    // Keep only recent data
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - this.maxHistoricalDays);
    
    this.historicalData = this.historicalData.filter(
      point => point.timestamp >= cutoffDate
    );

    // Retrain models periodically
    if (this.historicalData.length % 100 === 0) {
      this.trainModels();
    }
  }

  async predictConsumption(
    startDate: Date,
    endDate: Date,
    interval: 'hourly' | 'daily' | 'weekly' = 'hourly'
  ): Promise<EnergyPrediction[]> {
    const predictions: EnergyPrediction[] = [];
    const bestModel = this.selectBestModel();

    let currentDate = new Date(startDate);
    const intervalMs = this.getIntervalMs(interval);

    while (currentDate <= endDate) {
      const prediction = await this.predictForTimestamp(currentDate, bestModel);
      predictions.push(prediction);
      currentDate = new Date(currentDate.getTime() + intervalMs);
    }

    return predictions;
  }

  private async predictForTimestamp(
    timestamp: Date,
    model: PredictionModel
  ): Promise<EnergyPrediction> {
    const factors: string[] = [];
    let baseConsumption = 0;

    // Get seasonal pattern
    const season = this.getSeason(timestamp);
    const seasonalPattern = this.seasonalPatterns.get(season);
    
    if (seasonalPattern) {
      baseConsumption = seasonalPattern.averageConsumption;
      factors.push(`seasonal_${season}`);
    }

    // Apply time-of-day factor
    const hour = timestamp.getHours();
    const timeOfDayFactor = this.getTimeOfDayFactor(hour, seasonalPattern);
    baseConsumption *= timeOfDayFactor;
    factors.push('time_of_day');

    // Apply day-of-week factor
    const dayOfWeek = timestamp.getDay();
    const dayOfWeekFactor = this.getDayOfWeekFactor(dayOfWeek);
    baseConsumption *= dayOfWeekFactor;
    factors.push('day_of_week');

    // Apply weather factor (simulated)
    const weatherFactor = this.getWeatherFactor(timestamp, season);
    baseConsumption *= weatherFactor;
    if (weatherFactor !== 1) {
      factors.push('weather');
    }

    // Apply model-specific adjustments
    const modelAdjustment = this.applyModel(baseConsumption, timestamp, model);
    const predictedConsumption = baseConsumption + modelAdjustment;

    // Calculate cost
    const ratePerKwh = this.getEnergyRate(hour);
    const predictedCost = (predictedConsumption / 1000) * ratePerKwh;

    // Calculate confidence based on model accuracy and data availability
    const confidence = this.calculateConfidence(timestamp, model);

    return {
      timestamp,
      predictedConsumption: Math.max(0, predictedConsumption),
      predictedCost,
      confidence,
      factors
    };
  }

  private selectBestModel(): PredictionModel {
    let bestModel = this.models.get('linear')!;
    let bestAccuracy = 0;

    for (const model of this.models.values()) {
      if (model.accuracy > bestAccuracy) {
        bestAccuracy = model.accuracy;
        bestModel = model;
      }
    }

    return bestModel;
  }

  private applyModel(
    baseValue: number,
    timestamp: Date,
    model: PredictionModel
  ): number {
    const daysSinceEpoch = Math.floor(timestamp.getTime() / (1000 * 60 * 60 * 24));

    switch (model.type) {
      case 'linear':
        return model.parameters.slope * daysSinceEpoch + model.parameters.intercept;
      
      case 'polynomial':
        return (
          model.parameters.a * Math.pow(daysSinceEpoch, 2) +
          model.parameters.b * daysSinceEpoch +
          model.parameters.c
        );
      
      case 'exponential':
        return baseValue * Math.exp(model.parameters.slope * daysSinceEpoch);
      
      case 'seasonal':
        const seasonalComponent = Math.sin((daysSinceEpoch / 365) * 2 * Math.PI) * model.parameters.seasonal;
        return seasonalComponent + model.parameters.trend * daysSinceEpoch;
      
      default:
        return 0;
    }
  }

  private trainModels(): void {
    if (this.historicalData.length < 30) {
      logger.warn('Insufficient data for model training');
      return;
    }

    logger.info('Training energy prediction models...');

    // Train linear model
    this.trainLinearModel();

    // Train polynomial model
    this.trainPolynomialModel();

    // Train seasonal model
    this.trainSeasonalModel();

    this.emit('modelsUpdated', Array.from(this.models.values()));
  }

  private trainLinearModel(): void {
    const model = this.models.get('linear')!;
    const data = this.historicalData.slice(-90); // Last 90 days

    if (data.length < 2) return;

    // Simple linear regression
    const n = data.length;
    let sumX = 0, sumY = 0, sumXY = 0, sumX2 = 0;

    data.forEach((point, index) => {
      const x = index;
      const y = point.consumption;
      sumX += x;
      sumY += y;
      sumXY += x * y;
      sumX2 += x * x;
    });

    const slope = (n * sumXY - sumX * sumY) / (n * sumX2 - sumX * sumX);
    const intercept = (sumY - slope * sumX) / n;

    model.parameters = { slope, intercept };
    model.lastTrained = new Date();

    // Calculate accuracy
    model.accuracy = this.calculateModelAccuracy(model, data);
    this.models.set('linear', model);
  }

  private trainPolynomialModel(): void {
    const model = this.models.get('polynomial')!;
    const data = this.historicalData.slice(-90);

    if (data.length < 3) return;

    // Simplified polynomial regression (degree 2)
    // In production, use a proper matrix library
    const n = data.length;
    let sumX = 0, sumY = 0, sumX2 = 0, sumX3 = 0, sumX4 = 0, sumXY = 0, sumX2Y = 0;

    data.forEach((point, index) => {
      const x = index;
      const y = point.consumption;
      sumX += x;
      sumY += y;
      sumX2 += x * x;
      sumX3 += x * x * x;
      sumX4 += x * x * x * x;
      sumXY += x * y;
      sumX2Y += x * x * y;
    });

    // Solve system of equations (simplified)
    const a = (n * sumX2Y - sumX2 * sumY) / (n * sumX4 - sumX2 * sumX2);
    const b = (sumXY - a * sumX3) / sumX2;
    const c = (sumY - b * sumX - a * sumX2) / n;

    model.parameters = { a, b, c };
    model.lastTrained = new Date();
    model.accuracy = this.calculateModelAccuracy(model, data);
    this.models.set('polynomial', model);
  }

  private trainSeasonalModel(): void {
    const model = this.models.get('seasonal')!;
    const data = this.historicalData.slice(-365); // Full year if available

    if (data.length < 30) return;

    // Calculate trend
    const trend = this.calculateTrend(data);

    // Calculate seasonal component
    const seasonal = this.calculateSeasonalComponent(data);

    // Calculate residual
    const residual = this.calculateResidual(data, trend, seasonal);

    model.parameters = { trend, seasonal, residual };
    model.lastTrained = new Date();
    model.accuracy = this.calculateModelAccuracy(model, data);
    this.models.set('seasonal', model);
  }

  private calculateTrend(data: EnergyDataPoint[]): number {
    if (data.length < 2) return 0;
    
    const firstHalf = data.slice(0, Math.floor(data.length / 2));
    const secondHalf = data.slice(Math.floor(data.length / 2));

    const firstAvg = firstHalf.reduce((sum, p) => sum + p.consumption, 0) / firstHalf.length;
    const secondAvg = secondHalf.reduce((sum, p) => sum + p.consumption, 0) / secondHalf.length;

    return (secondAvg - firstAvg) / data.length;
  }

  private calculateSeasonalComponent(data: EnergyDataPoint[]): number {
    const seasonalAverages = new Map<string, number[]>();

    data.forEach(point => {
      const season = this.getSeason(point.timestamp);
      if (!seasonalAverages.has(season)) {
        seasonalAverages.set(season, []);
      }
      seasonalAverages.get(season)!.push(point.consumption);
    });

    let maxVariation = 0;
    for (const values of seasonalAverages.values()) {
      const avg = values.reduce((sum, v) => sum + v, 0) / values.length;
      const variation = Math.abs(avg - data.reduce((sum, p) => sum + p.consumption, 0) / data.length);
      maxVariation = Math.max(maxVariation, variation);
    }

    return maxVariation;
  }

  private calculateResidual(data: EnergyDataPoint[], trend: number, seasonal: number): number {
    const residuals = data.map((point, index) => {
      const predicted = trend * index + seasonal * Math.sin((index / 365) * 2 * Math.PI);
      return Math.abs(point.consumption - predicted);
    });

    return residuals.reduce((sum, r) => sum + r, 0) / residuals.length;
  }

  private calculateModelAccuracy(model: PredictionModel, data: EnergyDataPoint[]): number {
    let totalError = 0;
    let totalActual = 0;

    data.forEach((point, index) => {
      const predicted = this.applyModel(point.consumption, point.timestamp, model);
      const error = Math.abs(point.consumption - predicted);
      totalError += error;
      totalActual += point.consumption;
    });

    const mape = (totalError / totalActual) * 100; // Mean Absolute Percentage Error
    return Math.max(0, 100 - mape) / 100; // Convert to accuracy (0-1)
  }

  private calculateConfidence(timestamp: Date, model: PredictionModel): number {
    const now = new Date();
    const daysAhead = Math.floor((timestamp.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));

    // Confidence decreases with prediction distance
    let confidence = model.accuracy;
    
    if (daysAhead > 0) {
      confidence *= Math.exp(-daysAhead / 30); // Exponential decay
    }

    // Adjust based on data availability
    const dataPoints = this.historicalData.length;
    const dataFactor = Math.min(1, dataPoints / 365);
    confidence *= dataFactor;

    return Math.max(0, Math.min(1, confidence));
  }

  private getSeason(date: Date): 'spring' | 'summer' | 'fall' | 'winter' {
    const month = date.getMonth();
    
    if (month >= 2 && month <= 4) return 'spring';
    if (month >= 5 && month <= 7) return 'summer';
    if (month >= 8 && month <= 10) return 'fall';
    return 'winter';
  }

  private getTimeOfDayFactor(hour: number, pattern?: SeasonalPattern): number {
    if (!pattern) return 1;

    if (pattern.peakHours.includes(hour)) {
      return 1.3; // 30% increase during peak hours
    } else if (pattern.offPeakHours.includes(hour)) {
      return 0.7; // 30% decrease during off-peak hours
    }

    return 1;
  }

  private getDayOfWeekFactor(dayOfWeek: number): number {
    // 0 = Sunday, 6 = Saturday
    if (dayOfWeek === 0 || dayOfWeek === 6) {
      return 0.9; // 10% less on weekends
    }
    return 1;
  }

  private getWeatherFactor(timestamp: Date, season: string): number {
    // Simulated weather impact
    // In production, integrate with actual weather service
    const random = Math.random();
    
    if (season === 'summer' && random > 0.7) {
      return 1.2; // Hot day, more AC usage
    } else if (season === 'winter' && random > 0.7) {
      return 1.15; // Cold day, more heating
    }

    return 1;
  }

  private getEnergyRate(hour: number): number {
    // Time-of-use pricing
    if (hour >= 17 && hour <= 21) {
      return 0.25; // Peak rate
    } else if (hour >= 9 && hour <= 17) {
      return 0.15; // Mid-peak rate
    } else {
      return 0.08; // Off-peak rate
    }
  }

  private getIntervalMs(interval: 'hourly' | 'daily' | 'weekly'): number {
    switch (interval) {
      case 'hourly':
        return 60 * 60 * 1000;
      case 'daily':
        return 24 * 60 * 60 * 1000;
      case 'weekly':
        return 7 * 24 * 60 * 60 * 1000;
    }
  }

  async predictPeakDemand(date: Date): Promise<{
    peakHour: number;
    peakConsumption: number;
    confidence: number;
  }> {
    const startOfDay = new Date(date);
    startOfDay.setHours(0, 0, 0, 0);
    
    const endOfDay = new Date(date);
    endOfDay.setHours(23, 59, 59, 999);

    const predictions = await this.predictConsumption(startOfDay, endOfDay, 'hourly');
    
    let peakPrediction = predictions[0];
    predictions.forEach(pred => {
      if (pred.predictedConsumption > peakPrediction.predictedConsumption) {
        peakPrediction = pred;
      }
    });

    return {
      peakHour: peakPrediction.timestamp.getHours(),
      peakConsumption: peakPrediction.predictedConsumption,
      confidence: peakPrediction.confidence
    };
  }

  async predictMonthlyCost(year: number, month: number): Promise<{
    totalCost: number;
    averageDailyCost: number;
    confidence: number;
  }> {
    const startDate = new Date(year, month, 1);
    const endDate = new Date(year, month + 1, 0);

    const predictions = await this.predictConsumption(startDate, endDate, 'daily');
    
    const totalCost = predictions.reduce((sum, pred) => sum + pred.predictedCost, 0);
    const averageConfidence = predictions.reduce((sum, pred) => sum + pred.confidence, 0) / predictions.length;

    return {
      totalCost,
      averageDailyCost: totalCost / predictions.length,
      confidence: averageConfidence
    };
  }

  getModelPerformance(): Array<{
    modelId: string;
    name: string;
    accuracy: number;
    lastTrained: Date;
  }> {
    return Array.from(this.models.values()).map(model => ({
      modelId: model.id,
      name: model.name,
      accuracy: model.accuracy,
      lastTrained: model.lastTrained
    }));
  }

  getHistoricalDataSummary(): {
    totalDataPoints: number;
    dateRange: { start: Date; end: Date } | null;
    averageConsumption: number;
    totalCost: number;
  } {
    if (this.historicalData.length === 0) {
      return {
        totalDataPoints: 0,
        dateRange: null,
        averageConsumption: 0,
        totalCost: 0
      };
    }

    const sorted = [...this.historicalData].sort((a, b) => 
      a.timestamp.getTime() - b.timestamp.getTime()
    );

    const totalConsumption = this.historicalData.reduce((sum, p) => sum + p.consumption, 0);
    const totalCost = this.historicalData.reduce((sum, p) => sum + p.cost, 0);

    return {
      totalDataPoints: this.historicalData.length,
      dateRange: {
        start: sorted[0].timestamp,
        end: sorted[sorted.length - 1].timestamp
      },
      averageConsumption: totalConsumption / this.historicalData.length,
      totalCost
    };
  }
}

export const energyPredictionService = new EnergyPredictionService();
