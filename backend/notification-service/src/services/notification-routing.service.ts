import { EventEmitter } from 'events';
import { logger } from '../../../shared/utils/logger';

interface NotificationRoute {
  id: string;
  name: string;
  priority: number;
  conditions: RouteCondition[];
  channels: NotificationChannel[];
  enabled: boolean;
  schedule?: RouteSchedule;
}

interface RouteCondition {
  field: string;
  operator: 'equals' | 'contains' | 'greaterThan' | 'lessThan' | 'in' | 'matches';
  value: any;
}

interface NotificationChannel {
  type: 'email' | 'sms' | 'push' | 'webhook' | 'slack' | 'teams';
  config: Record<string, any>;
  fallback?: NotificationChannel;
}

interface RouteSchedule {
  timezone: string;
  allowedHours: { start: number; end: number };
  allowedDays: number[]; // 0-6, Sunday-Saturday
  quietHours?: { start: number; end: number };
}

interface Notification {
  id: string;
  type: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  title: string;
  message: string;
  data: Record<string, any>;
  userId?: string;
  timestamp: Date;
}

interface RoutingResult {
  notificationId: string;
  routes: string[];
  channels: Array<{ type: string; status: 'sent' | 'failed' | 'queued' }>;
  timestamp: Date;
}

export class NotificationRoutingService extends EventEmitter {
  private routes: Map<string, NotificationRoute> = new Map();
  private routingHistory: RoutingResult[] = [];
  private readonly maxHistorySize = 1000;

  constructor() {
    super();
    this.initializeDefaultRoutes();
  }

  private initializeDefaultRoutes(): void {
    // Critical alerts route
    this.addRoute({
      id: 'critical_alerts',
      name: 'Critical Alerts',
      priority: 1,
      conditions: [
        { field: 'severity', operator: 'equals', value: 'critical' }
      ],
      channels: [
        {
          type: 'push',
          config: { sound: 'critical', vibrate: true },
          fallback: {
            type: 'sms',
            config: {}
          }
        },
        {
          type: 'email',
          config: { priority: 'high' }
        }
      ],
      enabled: true
    });

    // Security alerts route
    this.addRoute({
      id: 'security_alerts',
      name: 'Security Alerts',
      priority: 2,
      conditions: [
        { field: 'type', operator: 'contains', value: 'security' }
      ],
      channels: [
        {
          type: 'push',
          config: { sound: 'alert' }
        },
        {
          type: 'email',
          config: { template: 'security_alert' }
        }
      ],
      enabled: true
    });

    // Energy alerts route
    this.addRoute({
      id: 'energy_alerts',
      name: 'Energy Alerts',
      priority: 3,
      conditions: [
        { field: 'type', operator: 'equals', value: 'energy' }
      ],
      channels: [
        {
          type: 'push',
          config: { sound: 'default' }
        }
      ],
      enabled: true,
      schedule: {
        timezone: 'UTC',
        allowedHours: { start: 8, end: 22 },
        allowedDays: [1, 2, 3, 4, 5], // Weekdays only
        quietHours: { start: 22, end: 8 }
      }
    });

    // Device status route
    this.addRoute({
      id: 'device_status',
      name: 'Device Status Updates',
      priority: 4,
      conditions: [
        { field: 'type', operator: 'equals', value: 'device_status' }
      ],
      channels: [
        {
          type: 'push',
          config: { sound: 'none', badge: true }
        }
      ],
      enabled: true
    });

    // General notifications route
    this.addRoute({
      id: 'general',
      name: 'General Notifications',
      priority: 10,
      conditions: [],
      channels: [
        {
          type: 'push',
          config: { sound: 'default' }
        }
      ],
      enabled: true
    });
  }

  addRoute(route: NotificationRoute): void {
    this.routes.set(route.id, route);
    logger.info(`Added notification route: ${route.id} - ${route.name}`);
  }

  removeRoute(routeId: string): void {
    this.routes.delete(routeId);
    logger.info(`Removed notification route: ${routeId}`);
  }

  updateRoute(routeId: string, updates: Partial<NotificationRoute>): void {
    const route = this.routes.get(routeId);
    if (!route) {
      throw new Error(`Route ${routeId} not found`);
    }

    const updatedRoute = { ...route, ...updates };
    this.routes.set(routeId, updatedRoute);
    logger.info(`Updated notification route: ${routeId}`);
  }

  async routeNotification(notification: Notification): Promise<RoutingResult> {
    const matchedRoutes = this.findMatchingRoutes(notification);
    
    if (matchedRoutes.length === 0) {
      logger.warn(`No routes matched for notification ${notification.id}`);
      matchedRoutes.push(this.routes.get('general')!);
    }

    // Sort by priority
    matchedRoutes.sort((a, b) => a.priority - b.priority);

    const channels: Array<{ type: string; status: 'sent' | 'failed' | 'queued' }> = [];

    for (const route of matchedRoutes) {
      // Check schedule
      if (route.schedule && !this.isWithinSchedule(route.schedule)) {
        logger.info(`Notification ${notification.id} queued due to schedule restrictions`);
        route.channels.forEach(channel => {
          channels.push({ type: channel.type, status: 'queued' });
        });
        continue;
      }

      // Send through channels
      for (const channel of route.channels) {
        try {
          await this.sendThroughChannel(notification, channel);
          channels.push({ type: channel.type, status: 'sent' });
          this.emit('notificationSent', notification.id, channel.type);
        } catch (error) {
          logger.error(`Failed to send notification through ${channel.type}:`, error);
          channels.push({ type: channel.type, status: 'failed' });

          // Try fallback
          if (channel.fallback) {
            try {
              await this.sendThroughChannel(notification, channel.fallback);
              channels.push({ type: channel.fallback.type, status: 'sent' });
              this.emit('notificationSent', notification.id, channel.fallback.type);
            } catch (fallbackError) {
              logger.error(`Fallback channel also failed:`, fallbackError);
              channels.push({ type: channel.fallback.type, status: 'failed' });
            }
          }
        }
      }
    }

    const result: RoutingResult = {
      notificationId: notification.id,
      routes: matchedRoutes.map(r => r.id),
      channels,
      timestamp: new Date()
    };

    this.recordRoutingResult(result);
    return result;
  }

  private findMatchingRoutes(notification: Notification): NotificationRoute[] {
    const matched: NotificationRoute[] = [];

    for (const route of this.routes.values()) {
      if (!route.enabled) continue;

      if (route.conditions.length === 0) {
        // Route with no conditions matches everything
        matched.push(route);
        continue;
      }

      const allConditionsMet = route.conditions.every(condition =>
        this.evaluateCondition(notification, condition)
      );

      if (allConditionsMet) {
        matched.push(route);
      }
    }

    return matched;
  }

  private evaluateCondition(notification: Notification, condition: RouteCondition): boolean {
    const value = this.getNestedValue(notification, condition.field);

    switch (condition.operator) {
      case 'equals':
        return value === condition.value;
      
      case 'contains':
        return typeof value === 'string' && value.includes(condition.value);
      
      case 'greaterThan':
        return typeof value === 'number' && value > condition.value;
      
      case 'lessThan':
        return typeof value === 'number' && value < condition.value;
      
      case 'in':
        return Array.isArray(condition.value) && condition.value.includes(value);
      
      case 'matches':
        return typeof value === 'string' && new RegExp(condition.value).test(value);
      
      default:
        return false;
    }
  }

  private getNestedValue(obj: any, path: string): any {
    return path.split('.').reduce((current, key) => current?.[key], obj);
  }

  private isWithinSchedule(schedule: RouteSchedule): boolean {
    const now = new Date();
    const hour = now.getHours();
    const day = now.getDay();

    // Check allowed days
    if (!schedule.allowedDays.includes(day)) {
      return false;
    }

    // Check quiet hours
    if (schedule.quietHours) {
      const { start, end } = schedule.quietHours;
      if (start < end) {
        if (hour >= start && hour < end) {
          return false;
        }
      } else {
        // Quiet hours span midnight
        if (hour >= start || hour < end) {
          return false;
        }
      }
    }

    // Check allowed hours
    const { start, end } = schedule.allowedHours;
    if (start < end) {
      return hour >= start && hour < end;
    } else {
      // Allowed hours span midnight
      return hour >= start || hour < end;
    }
  }

  private async sendThroughChannel(
    notification: Notification,
    channel: NotificationChannel
  ): Promise<void> {
    // Simulate sending through different channels
    // In production, integrate with actual services
    
    logger.info(`Sending notification ${notification.id} through ${channel.type}`);

    switch (channel.type) {
      case 'email':
        await this.sendEmail(notification, channel.config);
        break;
      
      case 'sms':
        await this.sendSMS(notification, channel.config);
        break;
      
      case 'push':
        await this.sendPush(notification, channel.config);
        break;
      
      case 'webhook':
        await this.sendWebhook(notification, channel.config);
        break;
      
      case 'slack':
        await this.sendSlack(notification, channel.config);
        break;
      
      case 'teams':
        await this.sendTeams(notification, channel.config);
        break;
      
      default:
        throw new Error(`Unsupported channel type: ${channel.type}`);
    }
  }

  private async sendEmail(notification: Notification, config: Record<string, any>): Promise<void> {
    // Simulate email sending
    await new Promise(resolve => setTimeout(resolve, 100));
    logger.debug(`Email sent: ${notification.title}`);
  }

  private async sendSMS(notification: Notification, config: Record<string, any>): Promise<void> {
    // Simulate SMS sending
    await new Promise(resolve => setTimeout(resolve, 100));
    logger.debug(`SMS sent: ${notification.message}`);
  }

  private async sendPush(notification: Notification, config: Record<string, any>): Promise<void> {
    // Simulate push notification
    await new Promise(resolve => setTimeout(resolve, 50));
    logger.debug(`Push notification sent: ${notification.title}`);
  }

  private async sendWebhook(notification: Notification, config: Record<string, any>): Promise<void> {
    // Simulate webhook call
    await new Promise(resolve => setTimeout(resolve, 150));
    logger.debug(`Webhook called for notification: ${notification.id}`);
  }

  private async sendSlack(notification: Notification, config: Record<string, any>): Promise<void> {
    // Simulate Slack message
    await new Promise(resolve => setTimeout(resolve, 100));
    logger.debug(`Slack message sent: ${notification.title}`);
  }

  private async sendTeams(notification: Notification, config: Record<string, any>): Promise<void> {
    // Simulate Teams message
    await new Promise(resolve => setTimeout(resolve, 100));
    logger.debug(`Teams message sent: ${notification.title}`);
  }

  private recordRoutingResult(result: RoutingResult): void {
    this.routingHistory.push(result);

    // Keep history size manageable
    if (this.routingHistory.length > this.maxHistorySize) {
      this.routingHistory.shift();
    }
  }

  getRoute(routeId: string): NotificationRoute | undefined {
    return this.routes.get(routeId);
  }

  getAllRoutes(): NotificationRoute[] {
    return Array.from(this.routes.values())
      .sort((a, b) => a.priority - b.priority);
  }

  getRoutingHistory(limit: number = 100): RoutingResult[] {
    return this.routingHistory
      .slice(-limit)
      .reverse();
  }

  getStatistics(): {
    totalRoutes: number;
    enabledRoutes: number;
    totalNotifications: number;
    successRate: number;
    channelStats: Record<string, { sent: number; failed: number; queued: number }>;
  } {
    const channelStats: Record<string, { sent: number; failed: number; queued: number }> = {};

    this.routingHistory.forEach(result => {
      result.channels.forEach(channel => {
        if (!channelStats[channel.type]) {
          channelStats[channel.type] = { sent: 0, failed: 0, queued: 0 };
        }
        channelStats[channel.type][channel.status]++;
      });
    });

    const totalAttempts = this.routingHistory.reduce(
      (sum, result) => sum + result.channels.length,
      0
    );

    const successfulAttempts = this.routingHistory.reduce(
      (sum, result) => sum + result.channels.filter(c => c.status === 'sent').length,
      0
    );

    return {
      totalRoutes: this.routes.size,
      enabledRoutes: Array.from(this.routes.values()).filter(r => r.enabled).length,
      totalNotifications: this.routingHistory.length,
      successRate: totalAttempts > 0 ? (successfulAttempts / totalAttempts) * 100 : 0,
      channelStats
    };
  }

  async testRoute(routeId: string, testNotification: Notification): Promise<RoutingResult> {
    const route = this.routes.get(routeId);
    if (!route) {
      throw new Error(`Route ${routeId} not found`);
    }

    logger.info(`Testing route: ${routeId}`);
    
    const channels: Array<{ type: string; status: 'sent' | 'failed' | 'queued' }> = [];

    for (const channel of route.channels) {
      try {
        await this.sendThroughChannel(testNotification, channel);
        channels.push({ type: channel.type, status: 'sent' });
      } catch (error) {
        channels.push({ type: channel.type, status: 'failed' });
      }
    }

    return {
      notificationId: testNotification.id,
      routes: [routeId],
      channels,
      timestamp: new Date()
    };
  }

  clearHistory(): void {
    this.routingHistory = [];
    logger.info('Routing history cleared');
  }
}

export const notificationRoutingService = new NotificationRoutingService();
