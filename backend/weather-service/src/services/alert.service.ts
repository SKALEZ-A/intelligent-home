import axios from 'axios';
import { logger } from '../utils/logger';
import { WeatherAlert, AlertSeverity, AlertType } from '../models/alert.model';

export class AlertService {
  private apiKey: string;
  private monitoringInterval: NodeJS.Timeout | null = null;
  private subscribers: Map<string, AlertCallback[]> = new Map();

  constructor() {
    this.apiKey = process.env.WEATHER_API_KEY || '';
  }

  async getActiveAlerts(lat: number, lon: number): Promise<WeatherAlert[]> {
    try {
      const response = await axios.get(
        `https://api.openweathermap.org/data/2.5/onecall`,
        {
          params: {
            lat,
            lon,
            appid: this.apiKey,
            exclude: 'current,minutely,hourly,daily'
          }
        }
      );

      if (!response.data.alerts) {
        return [];
      }

      return response.data.alerts.map((alert: any) => ({
        id: `${alert.event}_${alert.start}`,
        event: alert.event,
        sender: alert.sender_name,
        start: new Date(alert.start * 1000),
        end: new Date(alert.end * 1000),
        description: alert.description,
        severity: this.determineSeverity(alert.event),
        type: this.determineAlertType(alert.event),
        tags: alert.tags || []
      }));
    } catch (error) {
      logger.error('Error fetching weather alerts:', error);
      return [];
    }
  }

  subscribe(locationId: string, callback: AlertCallback): void {
    if (!this.subscribers.has(locationId)) {
      this.subscribers.set(locationId, []);
    }
    this.subscribers.get(locationId)!.push(callback);
  }

  unsubscribe(locationId: string, callback: AlertCallback): void {
    const callbacks = this.subscribers.get(locationId);
    if (callbacks) {
      const index = callbacks.indexOf(callback);
      if (index > -1) {
        callbacks.splice(index, 1);
      }
    }
  }

  startMonitoring(): void {
    // Check for alerts every 5 minutes
    this.monitoringInterval = setInterval(async () => {
      logger.info('Checking for weather alerts');
      
      for (const [locationId, callbacks] of this.subscribers.entries()) {
        try {
          // Parse location ID to get coordinates
          const [lat, lon] = locationId.split(',').map(Number);
          const alerts = await this.getActiveAlerts(lat, lon);
          
          if (alerts.length > 0) {
            callbacks.forEach(callback => {
              alerts.forEach(alert => callback(alert));
            });
          }
        } catch (error) {
          logger.error(`Error checking alerts for ${locationId}:`, error);
        }
      }
    }, 5 * 60 * 1000);
  }

  stopMonitoring(): void {
    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval);
      this.monitoringInterval = null;
    }
  }

  private determineSeverity(event: string): AlertSeverity {
    const severeEvents = ['tornado', 'hurricane', 'severe thunderstorm', 'flash flood'];
    const moderateEvents = ['thunderstorm', 'flood', 'winter storm', 'high wind'];
    
    const eventLower = event.toLowerCase();
    
    if (severeEvents.some(e => eventLower.includes(e))) {
      return 'severe';
    } else if (moderateEvents.some(e => eventLower.includes(e))) {
      return 'moderate';
    }
    return 'minor';
  }

  private determineAlertType(event: string): AlertType {
    const eventLower = event.toLowerCase();
    
    if (eventLower.includes('tornado')) return 'tornado';
    if (eventLower.includes('hurricane')) return 'hurricane';
    if (eventLower.includes('flood')) return 'flood';
    if (eventLower.includes('thunderstorm')) return 'thunderstorm';
    if (eventLower.includes('winter') || eventLower.includes('snow')) return 'winter';
    if (eventLower.includes('heat')) return 'heat';
    if (eventLower.includes('wind')) return 'wind';
    if (eventLower.includes('fog')) return 'fog';
    
    return 'other';
  }

  async createCustomAlert(alert: Partial<WeatherAlert>): Promise<WeatherAlert> {
    const customAlert: WeatherAlert = {
      id: `custom_${Date.now()}`,
      event: alert.event || 'Custom Alert',
      sender: 'System',
      start: alert.start || new Date(),
      end: alert.end || new Date(Date.now() + 24 * 60 * 60 * 1000),
      description: alert.description || '',
      severity: alert.severity || 'minor',
      type: alert.type || 'other',
      tags: alert.tags || []
    };

    // Store in database
    logger.info('Created custom alert:', customAlert);
    
    return customAlert;
  }
}

type AlertCallback = (alert: WeatherAlert) => void;
