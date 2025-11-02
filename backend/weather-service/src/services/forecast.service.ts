import axios from 'axios';
import { logger } from '../utils/logger';
import { ForecastData, HourlyForecast, DailyForecast } from '../models/forecast.model';

export class ForecastService {
  private apiKey: string;

  constructor() {
    this.apiKey = process.env.WEATHER_API_KEY || '';
  }

  async getHourlyForecast(lat: number, lon: number, hours: number = 48): Promise<HourlyForecast[]> {
    try {
      const response = await axios.get(
        `https://api.openweathermap.org/data/2.5/forecast`,
        {
          params: {
            lat,
            lon,
            appid: this.apiKey,
            units: 'metric',
            cnt: Math.min(hours / 3, 40) // API returns 3-hour intervals
          }
        }
      );

      return response.data.list.map((item: any) => ({
        timestamp: new Date(item.dt * 1000),
        temperature: item.main.temp,
        feelsLike: item.main.feels_like,
        humidity: item.main.humidity,
        pressure: item.main.pressure,
        windSpeed: item.wind.speed,
        windDirection: item.wind.deg,
        precipitation: item.pop * 100, // Probability of precipitation
        precipitationAmount: item.rain?.['3h'] || 0,
        cloudiness: item.clouds.all,
        condition: item.weather[0].main,
        description: item.weather[0].description,
        icon: item.weather[0].icon
      }));
    } catch (error) {
      logger.error('Error fetching hourly forecast:', error);
      throw new Error('Failed to fetch hourly forecast');
    }
  }

  async getDailyForecast(lat: number, lon: number, days: number = 7): Promise<DailyForecast[]> {
    try {
      const response = await axios.get(
        `https://api.openweathermap.org/data/2.5/onecall`,
        {
          params: {
            lat,
            lon,
            appid: this.apiKey,
            units: 'metric',
            exclude: 'current,minutely,hourly,alerts'
          }
        }
      );

      return response.data.daily.slice(0, days).map((item: any) => ({
        date: new Date(item.dt * 1000),
        temperatureMin: item.temp.min,
        temperatureMax: item.temp.max,
        temperatureMorning: item.temp.morn,
        temperatureDay: item.temp.day,
        temperatureEvening: item.temp.eve,
        temperatureNight: item.temp.night,
        feelsLikeDay: item.feels_like.day,
        humidity: item.humidity,
        pressure: item.pressure,
        windSpeed: item.wind_speed,
        windDirection: item.wind_deg,
        precipitation: item.pop * 100,
        precipitationAmount: item.rain || 0,
        cloudiness: item.clouds,
        uvIndex: item.uvi,
        condition: item.weather[0].main,
        description: item.weather[0].description,
        icon: item.weather[0].icon,
        sunrise: new Date(item.sunrise * 1000),
        sunset: new Date(item.sunset * 1000)
      }));
    } catch (error) {
      logger.error('Error fetching daily forecast:', error);
      throw new Error('Failed to fetch daily forecast');
    }
  }

  async getExtendedForecast(lat: number, lon: number): Promise<ForecastData> {
    const [hourly, daily] = await Promise.all([
      this.getHourlyForecast(lat, lon, 48),
      this.getDailyForecast(lat, lon, 7)
    ]);

    return {
      hourly,
      daily,
      generatedAt: new Date()
    };
  }

  async getPrecipitationForecast(lat: number, lon: number): Promise<any> {
    try {
      const response = await axios.get(
        `https://api.openweathermap.org/data/2.5/onecall`,
        {
          params: {
            lat,
            lon,
            appid: this.apiKey,
            units: 'metric',
            exclude: 'current,hourly,daily,alerts'
          }
        }
      );

      return response.data.minutely?.map((item: any) => ({
        timestamp: new Date(item.dt * 1000),
        precipitation: item.precipitation
      })) || [];
    } catch (error) {
      logger.error('Error fetching precipitation forecast:', error);
      return [];
    }
  }
}
