export interface Weather {
  id: string;
  homeId: string;
  location: WeatherLocation;
  current: CurrentWeather;
  hourly: HourlyForecast[];
  daily: DailyForecast[];
  alerts: WeatherAlert[];
  timestamp: Date;
  source: string;
}

export interface WeatherLocation {
  latitude: number;
  longitude: number;
  city: string;
  state?: string;
  country: string;
  timezone: string;
}

export interface CurrentWeather {
  temperature: number;
  feelsLike: number;
  humidity: number;
  pressure: number;
  windSpeed: number;
  windDirection: number;
  windGust?: number;
  cloudCover: number;
  visibility: number;
  uvIndex: number;
  dewPoint: number;
  condition: string;
  conditionCode: string;
  icon: string;
  sunrise: Date;
  sunset: Date;
}

export interface HourlyForecast {
  timestamp: Date;
  temperature: number;
  feelsLike: number;
  humidity: number;
  pressure: number;
  windSpeed: number;
  windDirection: number;
  cloudCover: number;
  precipitationChance: number;
  precipitationAmount: number;
  condition: string;
  conditionCode: string;
  icon: string;
}

export interface DailyForecast {
  date: Date;
  temperatureHigh: number;
  temperatureLow: number;
  feelsLikeHigh: number;
  feelsLikeLow: number;
  humidity: number;
  windSpeed: number;
  windDirection: number;
  precipitationChance: number;
  precipitationAmount: number;
  condition: string;
  conditionCode: string;
  icon: string;
  sunrise: Date;
  sunset: Date;
  moonPhase: number;
  uvIndex: number;
}

export interface WeatherAlert {
  id: string;
  type: string;
  severity: AlertSeverity;
  title: string;
  description: string;
  startTime: Date;
  endTime: Date;
  affectedAreas: string[];
  instructions?: string;
  source: string;
}

export enum AlertSeverity {
  MINOR = 'minor',
  MODERATE = 'moderate',
  SEVERE = 'severe',
  EXTREME = 'extreme'
}

export interface WeatherProvider {
  name: string;
  apiKey: string;
  baseUrl: string;
  rateLimit: number;
  priority: number;
}
