export interface Weather {
  id: string;
  location: Location;
  current: CurrentWeather;
  forecast: WeatherForecast[];
  alerts: WeatherAlert[];
  updatedAt: string;
}

export interface Location {
  latitude: number;
  longitude: number;
  city: string;
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
  cloudCover: number;
  visibility: number;
  uvIndex: number;
  condition: WeatherCondition;
  icon: string;
}

export enum WeatherCondition {
  CLEAR = 'clear',
  PARTLY_CLOUDY = 'partly_cloudy',
  CLOUDY = 'cloudy',
  OVERCAST = 'overcast',
  RAIN = 'rain',
  HEAVY_RAIN = 'heavy_rain',
  SNOW = 'snow',
  SLEET = 'sleet',
  FOG = 'fog',
  THUNDERSTORM = 'thunderstorm'
}

export interface WeatherForecast {
  date: string;
  high: number;
  low: number;
  condition: WeatherCondition;
  icon: string;
  precipitationChance: number;
  windSpeed: number;
  humidity: number;
}

export interface WeatherAlert {
  id: string;
  type: WeatherAlertType;
  severity: AlertSeverity;
  title: string;
  description: string;
  startTime: string;
  endTime: string;
  affectedAreas: string[];
}

export enum WeatherAlertType {
  SEVERE_WEATHER = 'severe_weather',
  FLOOD = 'flood',
  TORNADO = 'tornado',
  HURRICANE = 'hurricane',
  WINTER_STORM = 'winter_storm',
  HEAT_WAVE = 'heat_wave',
  FREEZE = 'freeze'
}

export enum AlertSeverity {
  MINOR = 'minor',
  MODERATE = 'moderate',
  SEVERE = 'severe',
  EXTREME = 'extreme'
}
