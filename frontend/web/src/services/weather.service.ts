import { api } from '../utils/api';

export interface WeatherData {
  temperature: number;
  humidity: number;
  conditions: string;
  windSpeed: number;
  precipitation: number;
  uvIndex: number;
  visibility: number;
  pressure: number;
}

export interface WeatherForecast {
  date: Date;
  high: number;
  low: number;
  conditions: string;
  precipitation: number;
}

export interface WeatherAlert {
  id: string;
  type: string;
  severity: 'minor' | 'moderate' | 'severe' | 'extreme';
  title: string;
  description: string;
  startTime: Date;
  endTime: Date;
}

class WeatherService {
  async getCurrentWeather(location: string): Promise<WeatherData> {
    const response = await api.get(`/weather/current/${location}`);
    return response.data;
  }

  async getForecast(location: string, days: number = 7): Promise<WeatherForecast[]> {
    const response = await api.get(`/weather/forecast/${location}?days=${days}`);
    return response.data.map((f: any) => ({
      ...f,
      date: new Date(f.date)
    }));
  }

  async getAlerts(location: string): Promise<WeatherAlert[]> {
    const response = await api.get(`/weather/alerts/${location}`);
    return response.data.map((a: any) => ({
      ...a,
      startTime: new Date(a.startTime),
      endTime: new Date(a.endTime)
    }));
  }

  async subscribeToWeatherUpdates(location: string): Promise<void> {
    await api.post('/weather/subscribe', { location });
  }

  async unsubscribeFromWeatherUpdates(location: string): Promise<void> {
    await api.post('/weather/unsubscribe', { location });
  }
}

export const weatherService = new WeatherService();
