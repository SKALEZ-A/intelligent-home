import { EventEmitter } from 'events';

interface NotificationChannel {
  type: 'email' | 'sms' | 'push' | 'in_app';
  enabled: boolean;
  address?: string;
  quietHours?: {
    start: string;
    end: string;
    timezone: string;
  };
}

interface NotificationPreferences {
  userId: string;
  channels: NotificationChannel[];
  categories: {
    [category: string]: {
      enabled: boolean;
      priority: 'low' | 'medium' | 'high' | 'critical';
      channels: string[];
    };
  };
  frequency: {
    maxPerHour: number;
    maxPerDay: number;
    batchingEnabled: boolean;
    batchingInterval: number;
  };
  filters: {
    keywords: string[];
    deviceTypes: string[];
    locations: string[];
  };
}

export class NotificationPreferencesService extends EventEmitter {
  private preferences: Map<string, NotificationPreferences> = new Map();
  private notificationCounts: Map<string, { hour: number; day: number; lastReset: number }> = new Map();

  public setPreferences(userId: string, prefs: Partial<NotificationPreferences>): void {
    const existing = this.preferences.get(userId) || this.getDefaultPreferences(userId);
    const updated = { ...existing, ...prefs };
    
    this.preferences.set(userId, updated);
    this.emit('preferencesUpdated', { userId, preferences: updated });
  }

  public getPreferences(userId: string): NotificationPreferences {
    return this.preferences.get(userId) || this.getDefaultPreferences(userId);
  }

  private getDefaultPreferences(userId: string): NotificationPreferences {
    return {
      userId,
      channels: [
        { type: 'email', enabled: true },
        { type: 'push', enabled: true },
        { type: 'in_app', enabled: true },
        { type: 'sms', enabled: false }
      ],
      categories: {
        security: {
          enabled: true,
          priority: 'critical',
          channels: ['email', 'push', 'sms']
        },
        device_status: {
          enabled: true,
          priority: 'medium',
          channels: ['push', 'in_app']
        },
        automation: {
          enabled: true,
          priority: 'low',
          channels: ['in_app']
        },
        energy: {
          enabled: true,
          priority: 'medium',
          channels: ['email', 'in_app']
        }
      },
      frequency: {
        maxPerHour: 10,
        maxPerDay: 50,
        batchingEnabled: true,
        batchingInterval: 300000 // 5 minutes
      },
      filters: {
        keywords: [],
        deviceTypes: [],
        locations: []
      }
    };
  }

  public shouldSendNotification(
    userId: string,
    category: string,
    channel: string,
    priority: string
  ): boolean {
    const prefs = this.getPreferences(userId);

    const categoryPrefs = prefs.categories[category];
    if (!categoryPrefs || !categoryPrefs.enabled) {
      return false;
    }

    if (!categoryPrefs.channels.includes(channel)) {
      return false;
    }

    const channelConfig = prefs.channels.find(c => c.type === channel);
    if (!channelConfig || !channelConfig.enabled) {
      return false;
    }

    if (channelConfig.quietHours && this.isInQuietHours(channelConfig.quietHours)) {
      if (priority !== 'critical') {
        return false;
      }
    }

    if (!this.checkFrequencyLimits(userId)) {
      if (priority !== 'critical') {
        return false;
      }
    }

    return true;
  }

  private isInQuietHours(quietHours: NonNullable<NotificationChannel['quietHours']>): boolean {
    const now = new Date();
    const currentTime = now.toLocaleTimeString('en-US', { 
      hour12: false,
      timeZone: quietHours.timezone 
    });

    return currentTime >= quietHours.start && currentTime <= quietHours.end;
  }

  private checkFrequencyLimits(userId: string): boolean {
    const counts = this.notificationCounts.get(userId) || {
      hour: 0,
      day: 0,
      lastReset: Date.now()
    };

    const now = Date.now();
    const hoursSinceReset = (now - counts.lastReset) / 3600000;

    if (hoursSinceReset >= 24) {
      counts.hour = 0;
      counts.day = 0;
      counts.lastReset = now;
    } else if (hoursSinceReset >= 1) {
      counts.hour = 0;
    }

    const prefs = this.getPreferences(userId);

    if (counts.hour >= prefs.frequency.maxPerHour) {
      return false;
    }

    if (counts.day >= prefs.frequency.maxPerDay) {
      return false;
    }

    counts.hour++;
    counts.day++;
    this.notificationCounts.set(userId, counts);

    return true;
  }

  public updateChannelAddress(
    userId: string,
    channelType: NotificationChannel['type'],
    address: string
  ): void {
    const prefs = this.getPreferences(userId);
    const channel = prefs.channels.find(c => c.type === channelType);

    if (channel) {
      channel.address = address;
      this.setPreferences(userId, prefs);
    }
  }

  public setQuietHours(
    userId: string,
    channelType: NotificationChannel['type'],
    quietHours: NotificationChannel['quietHours']
  ): void {
    const prefs = this.getPreferences(userId);
    const channel = prefs.channels.find(c => c.type === channelType);

    if (channel) {
      channel.quietHours = quietHours;
      this.setPreferences(userId, prefs);
    }
  }

  public addFilter(
    userId: string,
    filterType: keyof NotificationPreferences['filters'],
    value: string
  ): void {
    const prefs = this.getPreferences(userId);
    
    if (!prefs.filters[filterType].includes(value)) {
      prefs.filters[filterType].push(value);
      this.setPreferences(userId, prefs);
    }
  }

  public removeFilter(
    userId: string,
    filterType: keyof NotificationPreferences['filters'],
    value: string
  ): void {
    const prefs = this.getPreferences(userId);
    prefs.filters[filterType] = prefs.filters[filterType].filter(v => v !== value);
    this.setPreferences(userId, prefs);
  }
}

export const notificationPreferencesService = new NotificationPreferencesService();
