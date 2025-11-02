export interface HourlyForecast {
  timestamp: Date;
  temperature: number;
  feelsLike: number;
  humidity: number;
  precipitation: number;
  precipitationProbability: number;
  windSpeed: number;
  windDirection: number;
  cloudCover: number;
  uvIndex: number;
  visibility: number;
  pressure: number;
  condition: string;
  icon: string;
}

export interface DailyForecast {
  date: Date;
  temperatureHigh: number;
  temperatureLow: number;
  sunrise: Date;
  sunset: Date;
  precipitation: number;
  precipitationProbability: number;
  windSpeed: number;
  humidity: number;
  uvIndex: number;
  condition: string;
  icon: string;
  hourlyForecasts: HourlyForecast[];
}

export interface WeatherForecast {
  location: {
    latitude: number;
    longitude: number;
    city: string;
    region: string;
    country: string;
  };
  current: HourlyForecast;
  hourly: HourlyForecast[];
  daily: DailyForecast[];
  lastUpdated: Date;
  source: string;
}

export class ForecastModel {
  private forecasts: Map<string, WeatherForecast>;

  constructor() {
    this.forecasts = new Map();
  }

  public saveForecast(locationKey: string, forecast: WeatherForecast): void {
    this.forecasts.set(locationKey, forecast);
  }

  public getForecast(locationKey: string): WeatherForecast | undefined {
    return this.forecasts.get(locationKey);
  }

  public getHourlyForecast(locationKey: string, hours: number = 24): HourlyForecast[] {
    const forecast = this.forecasts.get(locationKey);
    if (!forecast) return [];
    return forecast.hourly.slice(0, hours);
  }

  public getDailyForecast(locationKey: string, days: number = 7): DailyForecast[] {
    const forecast = this.forecasts.get(locationKey);
    if (!forecast) return [];
    return forecast.daily.slice(0, days);
  }

  public getCurrentConditions(locationKey: string): HourlyForecast | undefined {
    const forecast = this.forecasts.get(locationKey);
    return forecast?.current;
  }

  public isForecastStale(locationKey: string, maxAgeMinutes: number = 30): boolean {
    const forecast = this.forecasts.get(locationKey);
    if (!forecast) return true;

    const ageMinutes = (Date.now() - forecast.lastUpdated.getTime()) / 60000;
    return ageMinutes > maxAgeMinutes;
  }

  public deleteForecast(locationKey: string): void {
    this.forecasts.delete(locationKey);
  }

  public cleanupStaleForecasts(maxAgeMinutes: number = 60): void {
    const now = Date.now();
    Array.from(this.forecasts.entries()).forEach(([key, forecast]) => {
      const ageMinutes = (now - forecast.lastUpdated.getTime()) / 60000;
      if (ageMinutes > maxAgeMinutes) {
        this.forecasts.delete(key);
      }
    });
  }

  public static generateLocationKey(latitude: number, longitude: number): string {
    return `${latitude.toFixed(4)},${longitude.toFixed(4)}`;
  }
}
