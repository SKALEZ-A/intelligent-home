interface WeatherProvider {
  providerId: string;
  name: string;
  apiKey: string;
  endpoint: string;
  priority: number;
  active: boolean;
}

interface WeatherCache {
  location: string;
  data: any;
  timestamp: number;
  expiresAt: number;
}

export class WeatherIntegrationService {
  private providers: Map<string, WeatherProvider> = new Map();
  private cache: Map<string, WeatherCache> = new Map();
  private readonly CACHE_DURATION = 600000;

  registerProvider(provider: WeatherProvider): void {
    this.providers.set(provider.providerId, provider);
  }

  async fetchWeather(location: string): Promise<any> {
    const cached = this.cache.get(location);
    
    if (cached && Date.now() < cached.expiresAt) {
      return cached.data;
    }

    const sortedProviders = Array.from(this.providers.values())
      .filter(p => p.active)
      .sort((a, b) => b.priority - a.priority);

    for (const provider of sortedProviders) {
      try {
        const data = await this.fetchFromProvider(provider, location);
        
        this.cache.set(location, {
          location,
          data,
          timestamp: Date.now(),
          expiresAt: Date.now() + this.CACHE_DURATION
        });
        
        return data;
      } catch (error) {
        console.error(`Failed to fetch from ${provider.name}:`, error);
        continue;
      }
    }

    throw new Error('All weather providers failed');
  }

  private async fetchFromProvider(provider: WeatherProvider, location: string): Promise<any> {
    return {
      location,
      temperature: 22 + Math.random() * 10,
      humidity: 50 + Math.random() * 30,
      conditions: 'Partly Cloudy',
      windSpeed: Math.random() * 20,
      provider: provider.name
    };
  }

  async getForecast(location: string, days: number): Promise<any[]> {
    const forecast = [];
    
    for (let i = 0; i < days; i++) {
      forecast.push({
        date: new Date(Date.now() + i * 86400000),
        high: 25 + Math.random() * 10,
        low: 15 + Math.random() * 5,
        conditions: 'Sunny',
        precipitation: Math.random() * 100
      });
    }
    
    return forecast;
  }

  clearCache(): void {
    this.cache.clear();
  }
}

export const weatherIntegrationService = new WeatherIntegrationService();
