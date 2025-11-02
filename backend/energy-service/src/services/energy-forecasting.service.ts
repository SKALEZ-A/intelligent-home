interface EnergyDataPoint {
  timestamp: Date;
  consumption: number;
  temperature?: number;
  occupancy?: number;
  dayOfWeek: number;
  hour: number;
}

interface ForecastResult {
  timestamp: Date;
  predictedConsumption: number;
  confidence: number;
  lowerBound: number;
  upperBound: number;
}

export class EnergyForecastingService {
  private historicalData: EnergyDataPoint[];
  private model: any;

  constructor() {
    this.historicalData = [];
  }

  public addDataPoint(dataPoint: EnergyDataPoint): void {
    this.historicalData.push(dataPoint);

    if (this.historicalData.length > 10000) {
      this.historicalData.shift();
    }
  }

  public async forecast(hours: number = 24): Promise<ForecastResult[]> {
    if (this.historicalData.length < 168) {
      throw new Error('Insufficient historical data for forecasting');
    }

    const forecasts: ForecastResult[] = [];
    const now = new Date();

    for (let i = 0; i < hours; i++) {
      const forecastTime = new Date(now.getTime() + i * 3600000);
      const prediction = this.predictConsumption(forecastTime);
      
      forecasts.push({
        timestamp: forecastTime,
        predictedConsumption: prediction.value,
        confidence: prediction.confidence,
        lowerBound: prediction.value * 0.85,
        upperBound: prediction.value * 1.15,
      });
    }

    return forecasts;
  }

  private predictConsumption(timestamp: Date): { value: number; confidence: number } {
    const hour = timestamp.getHours();
    const dayOfWeek = timestamp.getDay();

    const similarData = this.historicalData.filter(d => 
      d.hour === hour && d.dayOfWeek === dayOfWeek
    );

    if (similarData.length === 0) {
      const allData = this.historicalData.filter(d => d.hour === hour);
      const avgConsumption = allData.reduce((sum, d) => sum + d.consumption, 0) / allData.length;
      return { value: avgConsumption, confidence: 0.5 };
    }

    const avgConsumption = similarData.reduce((sum, d) => sum + d.consumption, 0) / similarData.length;
    const confidence = Math.min(similarData.length / 50, 1);

    return { value: avgConsumption, confidence };
  }

  public async getDailyPattern(): Promise<any[]> {
    const hourlyAverages = new Array(24).fill(0);
    const hourlyCounts = new Array(24).fill(0);

    this.historicalData.forEach(d => {
      hourlyAverages[d.hour] += d.consumption;
      hourlyCounts[d.hour]++;
    });

    return hourlyAverages.map((sum, hour) => ({
      hour,
      averageConsumption: hourlyCounts[hour] > 0 ? sum / hourlyCounts[hour] : 0,
    }));
  }

  public async getWeeklyPattern(): Promise<any[]> {
    const dailyAverages = new Array(7).fill(0);
    const dailyCounts = new Array(7).fill(0);

    this.historicalData.forEach(d => {
      dailyAverages[d.dayOfWeek] += d.consumption;
      dailyCounts[d.dayOfWeek]++;
    });

    return dailyAverages.map((sum, day) => ({
      dayOfWeek: day,
      averageConsumption: dailyCounts[day] > 0 ? sum / dailyCounts[day] : 0,
    }));
  }

  public async getSeasonalTrends(): Promise<any> {
    const monthlyData = new Map<number, number[]>();

    this.historicalData.forEach(d => {
      const month = d.timestamp.getMonth();
      if (!monthlyData.has(month)) {
        monthlyData.set(month, []);
      }
      monthlyData.get(month)!.push(d.consumption);
    });

    const trends: any[] = [];
    monthlyData.forEach((consumptions, month) => {
      const avg = consumptions.reduce((sum, c) => sum + c, 0) / consumptions.length;
      trends.push({ month, averageConsumption: avg });
    });

    return trends;
  }

  public async getPeakDemandForecast(): Promise<any> {
    const peakHours = this.historicalData
      .sort((a, b) => b.consumption - a.consumption)
      .slice(0, 100);

    const hourFrequency = new Map<number, number>();
    peakHours.forEach(d => {
      hourFrequency.set(d.hour, (hourFrequency.get(d.hour) || 0) + 1);
    });

    const mostLikelyPeakHour = Array.from(hourFrequency.entries())
      .sort((a, b) => b[1] - a[1])[0];

    return {
      peakHour: mostLikelyPeakHour[0],
      frequency: mostLikelyPeakHour[1],
      averagePeakConsumption: peakHours.reduce((sum, d) => sum + d.consumption, 0) / peakHours.length,
    };
  }
}
