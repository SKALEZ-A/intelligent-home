import axios from 'axios';
import NodeCache from 'node-cache';
import { logger } from '../utils/logger';
import { WeatherData, WeatherCondition, AirQuality } from '../models/weather.model';

export class WeatherService {
  private cache: NodeCache;
  private apiKey: string;
  private updateInterval: NodeJS.Timeout | null = null;

  constructor() {
    this.cache = new NodeCache({ stdTTL: 1800 }); // 30 minutes
    this.apiKey = process.env.WEATHER_API_KEY || '';
  }

  async getCurrentWeather(lat: number, lon: number): Promise<WeatherData> {
    const cacheKey = `weather_${lat}_${lon}`;
    const cached = this.cache.get<WeatherData>(cacheKey);
    
    if (cached) {
      return cached;
    }

    try {
      const response = await axios.get(
        `https://api.openweathermap.org/data/2.5/weather`,
        {
          params: {
            lat,
            lon,
            appid: this.apiKey,
            units: 'metric'
          }
        }
      );

      const weatherData: WeatherData = {
        temperature: response.data.main.temp,
        feelsLike: response.data.main.feels_like,
        humidity: response.data.main.humidity,
        pressure: response.data.main.pressure,
        windSpeed: response.data.wind.speed,
        windDirection: response.data.wind.deg,
        cloudiness: response.data.clouds.all,
        visibility: response.data.visibility,
        condition: this.mapCondition(response.data.weather[0].main),
        description: response.data.weather[0].description,
        icon: response.data.weather[0].icon,
        sunrise: new Date(response.data.sys.sunrise * 1000),
        sunset: new Date(response.data.sys.sunset * 1000),
        timestamp: new Date()
      };

      this.cache.set(cacheKey, weatherData);
      return weatherData;
    } catch (error) {
      logger.error('Error fetching weather data:', error);
      throw new Error('Failed to fetch weather data');
    }
  }

  async getAirQuality(lat: number, lon: number): Promise<AirQuality> {
    try {
      const response = await axios.get(
        `https://api.openweathermap.org/data/2.5/air_pollution`,
        {
          params: {
            lat,
            lon,
            appid: this.apiKey
          }
        }
      );

      const aqi = response.data.list[0];
      return {
        aqi: aqi.main.aqi,
        pm25: aqi.components.pm2_5,
        pm10: aqi.components.pm10,
        co: aqi.components.co,
        no2: aqi.components.no2,
        o3: aqi.components.o3,
        so2: aqi.components.so2,
        timestamp: new Date()
      };
    } catch (error) {
      logger.error('Error fetching air quality data:', error);
      throw new Error('Failed to fetch air quality data');
    }
  }

  startPeriodicUpdates(): void {
    // Update weather data every 30 minutes
    this.updateInterval = setInterval(async () => {
      logger.info('Running periodic weather update');
      // Update for all registered locations
      // Implementation depends on location storage
    }, 30 * 60 * 1000);
  }

  stopPeriodicUpdates(): void {
    if (this.updateInterval) {
      clearInterval(this.updateInterval);
      this.updateInterval = null;
    }
  }

  private mapCondition(condition: string): WeatherCondition {
    const conditionMap: Record<string, WeatherCondition> = {
      'Clear': 'clear',
      'Clouds': 'cloudy',
      'Rain': 'rainy',
      'Drizzle': 'rainy',
      'Thunderstorm': 'stormy',
      'Snow': 'snowy',
      'Mist': 'foggy',
      'Fog': 'foggy',
      'Haze': 'foggy'
    };

    return conditionMap[condition] || 'clear';
  }

  async getHistoricalWeather(lat: number, lon: number, date: Date): Promise<WeatherData> {
    const timestamp = Math.floor(date.getTime() / 1000);
    
    try {
      const response = await axios.get(
        `https://api.openweathermap.org/data/2.5/onecall/timemachine`,
        {
          params: {
            lat,
            lon,
            dt: timestamp,
            appid: this.apiKey,
            units: 'metric'
          }
        }
      );

      const data = response.data.current;
      return {
        temperature: data.temp,
        feelsLike: data.feels_like,
        humidity: data.humidity,
        pressure: data.pressure,
        windSpeed: data.wind_speed,
        windDirection: data.wind_deg,
        cloudiness: data.clouds,
        visibility: data.visibility,
        condition: this.mapCondition(data.weather[0].main),
        description: data.weather[0].description,
        icon: data.weather[0].icon,
        sunrise: new Date(data.sunrise * 1000),
        sunset: new Date(data.sunset * 1000),
        timestamp: date
      };
    } catch (error) {
      logger.error('Error fetching historical weather:', error);
      throw new Error('Failed to fetch historical weather data');
    }
  }
}
