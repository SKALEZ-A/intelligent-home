import { EventEmitter } from 'events';

interface WeatherAlert {
  id: string;
  type: 'severe_weather' | 'temperature_extreme' | 'air_quality' | 'uv_index' | 'pollen';
  severity: 'advisory' | 'watch' | 'warning' | 'emergency';
  title: string;
  description: string;
  affectedAreas: string[];
  startTime: number;
  endTime: number;
  recommendations: string[];
  automationSuggestions: AutomationSuggestion[];
}

interface AutomationSuggestion {
  action: string;
  devices: string[];
  reason: string;
  priority: number;
}

interface AlertSubscription {
  userId: string;
  alertTypes: string[];
  locations: string[];
  severityThreshold: WeatherAlert['severity'];
  notificationChannels: string[];
}

export class WeatherAlertsAdvancedService extends EventEmitter {
  private activeAlerts: Map<string, WeatherAlert> = new Map();
  private subscriptions: Map<string, AlertSubscription> = new Map();
  private alertHistory: WeatherAlert[] = [];

  public createAlert(alert: Omit<WeatherAlert, 'id'>): WeatherAlert {
    const fullAlert: WeatherAlert = {
      ...alert,
      id: `alert_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
    };

    this.activeAlerts.set(fullAlert.id, fullAlert);
    this.alertHistory.push(fullAlert);
    this.emit('alertCreated', fullAlert);

    this.notifySubscribers(fullAlert);
    this.generateAutomationSuggestions(fullAlert);

    return fullAlert;
  }

  private notifySubscribers(alert: WeatherAlert): void {
    for (const [userId, subscription] of this.subscriptions.entries()) {
      if (this.shouldNotifyUser(subscription, alert)) {
        this.emit('notifyUser', { userId, alert, channels: subscription.notificationChannels });
      }
    }
  }

  private shouldNotifyUser(subscription: AlertSubscription, alert: WeatherAlert): boolean {
    if (!subscription.alertTypes.includes(alert.type)) {
      return false;
    }

    const severityLevels = ['advisory', 'watch', 'warning', 'emergency'];
    const alertSeverityIndex = severityLevels.indexOf(alert.severity);
    const thresholdIndex = severityLevels.indexOf(subscription.severityThreshold);

    if (alertSeverityIndex < thresholdIndex) {
      return false;
    }

    const hasMatchingLocation = alert.affectedAreas.some(area =>
      subscription.locations.some(loc => area.includes(loc))
    );

    return hasMatchingLocation;
  }

  private generateAutomationSuggestions(alert: WeatherAlert): void {
    const suggestions: AutomationSuggestion[] = [];

    switch (alert.type) {
      case 'severe_weather':
        suggestions.push(
          {
            action: 'close_all_windows',
            devices: ['window_sensors', 'smart_blinds'],
            reason: 'Protect from storm damage',
            priority: 9
          },
          {
            action: 'secure_outdoor_devices',
            devices: ['outdoor_cameras', 'smart_locks'],
            reason: 'Prevent weather damage',
            priority: 8
          }
        );
        break;

      case 'temperature_extreme':
        if (alert.title.includes('heat')) {
          suggestions.push({
            action: 'activate_cooling',
            devices: ['thermostat', 'fans', 'blinds'],
            reason: 'Maintain comfortable temperature',
            priority: 7
          });
        } else {
          suggestions.push({
            action: 'activate_heating',
            devices: ['thermostat', 'space_heaters'],
            reason: 'Prevent freezing and maintain comfort',
            priority: 7
          });
        }
        break;

      case 'air_quality':
        suggestions.push({
          action: 'improve_air_quality',
          devices: ['air_purifiers', 'hvac_filters', 'windows'],
          reason: 'Reduce indoor air pollution',
          priority: 6
        });
        break;

      case 'uv_index':
        suggestions.push({
          action: 'reduce_uv_exposure',
          devices: ['smart_blinds', 'window_tint'],
          reason: 'Protect from harmful UV rays',
          priority: 5
        });
        break;
    }

    alert.automationSuggestions = suggestions;
  }

  public subscribe(subscription: AlertSubscription): void {
    this.subscriptions.set(subscription.userId, subscription);
    this.emit('subscriptionCreated', subscription);
  }

  public unsubscribe(userId: string): void {
    this.subscriptions.delete(userId);
    this.emit('subscriptionRemoved', userId);
  }

  public getActiveAlerts(location?: string): WeatherAlert[] {
    const now = Date.now();
    let alerts = Array.from(this.activeAlerts.values())
      .filter(alert => alert.startTime <= now && alert.endTime >= now);

    if (location) {
      alerts = alerts.filter(alert =>
        alert.affectedAreas.some(area => area.includes(location))
      );
    }

    return alerts.sort((a, b) => {
      const severityOrder = { emergency: 4, warning: 3, watch: 2, advisory: 1 };
      return severityOrder[b.severity] - severityOrder[a.severity];
    });
  }

  public getAlertHistory(
    startTime: number,
    endTime: number,
    type?: string
  ): WeatherAlert[] {
    let history = this.alertHistory.filter(
      alert => alert.startTime >= startTime && alert.startTime <= endTime
    );

    if (type) {
      history = history.filter(alert => alert.type === type);
    }

    return history;
  }

  public getAlertStatistics(timeWindowMs: number = 2592000000): {
    totalAlerts: number;
    byType: { [key: string]: number };
    bySeverity: { [key: string]: number };
    averagePerDay: number;
  } {
    const cutoff = Date.now() - timeWindowMs;
    const recentAlerts = this.alertHistory.filter(a => a.startTime >= cutoff);

    const byType: { [key: string]: number } = {};
    const bySeverity: { [key: string]: number } = {};

    recentAlerts.forEach(alert => {
      byType[alert.type] = (byType[alert.type] || 0) + 1;
      bySeverity[alert.severity] = (bySeverity[alert.severity] || 0) + 1;
    });

    const days = timeWindowMs / 86400000;

    return {
      totalAlerts: recentAlerts.length,
      byType,
      bySeverity,
      averagePerDay: recentAlerts.length / days
    };
  }

  public dismissAlert(alertId: string, userId: string): void {
    this.emit('alertDismissed', { alertId, userId });
  }

  public acknowledgeAlert(alertId: string, userId: string): void {
    this.emit('alertAcknowledged', { alertId, userId });
  }

  public executeAutomationSuggestion(
    alertId: string,
    suggestionIndex: number
  ): void {
    const alert = this.activeAlerts.get(alertId);

    if (!alert || !alert.automationSuggestions[suggestionIndex]) {
      throw new Error('Alert or suggestion not found');
    }

    const suggestion = alert.automationSuggestions[suggestionIndex];
    this.emit('executeSuggestion', { alert, suggestion });
  }
}

export const weatherAlertsAdvancedService = new WeatherAlertsAdvancedService();
