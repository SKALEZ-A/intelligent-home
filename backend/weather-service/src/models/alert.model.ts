export interface WeatherAlert {
  id: string;
  type: 'severe_weather' | 'temperature' | 'precipitation' | 'wind' | 'air_quality';
  severity: 'low' | 'moderate' | 'high' | 'extreme';
  title: string;
  description: string;
  location: {
    latitude: number;
    longitude: number;
    city: string;
    region: string;
  };
  startTime: Date;
  endTime: Date;
  isActive: boolean;
  affectedAreas: string[];
  recommendations: string[];
  metadata: {
    source: string;
    confidence: number;
    lastUpdated: Date;
  };
}

export class WeatherAlertModel {
  private alerts: Map<string, WeatherAlert>;

  constructor() {
    this.alerts = new Map();
  }

  public createAlert(alert: WeatherAlert): void {
    this.alerts.set(alert.id, alert);
  }

  public getAlert(id: string): WeatherAlert | undefined {
    return this.alerts.get(id);
  }

  public getActiveAlerts(location?: { latitude: number; longitude: number }): WeatherAlert[] {
    const now = new Date();
    let activeAlerts = Array.from(this.alerts.values()).filter(
      alert => alert.isActive && alert.startTime <= now && alert.endTime >= now
    );

    if (location) {
      activeAlerts = activeAlerts.filter(alert => {
        const distance = this.calculateDistance(
          location.latitude,
          location.longitude,
          alert.location.latitude,
          alert.location.longitude
        );
        return distance < 50;
      });
    }

    return activeAlerts.sort((a, b) => this.getSeverityWeight(b.severity) - this.getSeverityWeight(a.severity));
  }

  public updateAlert(id: string, updates: Partial<WeatherAlert>): void {
    const alert = this.alerts.get(id);
    if (alert) {
      this.alerts.set(id, { ...alert, ...updates });
    }
  }

  public deactivateAlert(id: string): void {
    const alert = this.alerts.get(id);
    if (alert) {
      alert.isActive = false;
      this.alerts.set(id, alert);
    }
  }

  public deleteAlert(id: string): void {
    this.alerts.delete(id);
  }

  public getAlertsByType(type: WeatherAlert['type']): WeatherAlert[] {
    return Array.from(this.alerts.values()).filter(alert => alert.type === type);
  }

  public getAlertsBySeverity(severity: WeatherAlert['severity']): WeatherAlert[] {
    return Array.from(this.alerts.values()).filter(alert => alert.severity === severity);
  }

  private calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
    const R = 6371;
    const dLat = this.toRadians(lat2 - lat1);
    const dLon = this.toRadians(lon2 - lon1);
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(this.toRadians(lat1)) * Math.cos(this.toRadians(lat2)) *
      Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  }

  private toRadians(degrees: number): number {
    return degrees * (Math.PI / 180);
  }

  private getSeverityWeight(severity: WeatherAlert['severity']): number {
    const weights = { low: 1, moderate: 2, high: 3, extreme: 4 };
    return weights[severity];
  }

  public cleanupExpiredAlerts(): void {
    const now = new Date();
    Array.from(this.alerts.entries()).forEach(([id, alert]) => {
      if (alert.endTime < now) {
        this.alerts.delete(id);
      }
    });
  }
}
