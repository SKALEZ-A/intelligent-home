import { EventEmitter } from 'events';

interface Notification {
  id: string;
  userId: string;
  type: 'info' | 'warning' | 'error' | 'success';
  title: string;
  message: string;
  priority: 'low' | 'medium' | 'high' | 'urgent';
  channels: ('push' | 'email' | 'sms' | 'in-app')[];
  data?: any;
  timestamp: Date;
  expiresAt?: Date;
}

interface NotificationTemplate {
  id: string;
  name: string;
  type: string;
  subject: string;
  body: string;
  variables: string[];
}

export class NotificationDispatcherService extends EventEmitter {
  private queue: Notification[];
  private templates: Map<string, NotificationTemplate>;
  private userPreferences: Map<string, any>;
  private rateLimits: Map<string, number>;

  constructor() {
    super();
    this.queue = [];
    this.templates = new Map();
    this.userPreferences = new Map();
    this.rateLimits = new Map();
    this.startProcessing();
  }

  public async dispatch(notification: Notification): Promise<void> {
    if (!this.shouldSendNotification(notification)) {
      return;
    }

    this.queue.push(notification);
    this.emit('notificationQueued', notification);
  }

  public async dispatchBatch(notifications: Notification[]): Promise<void> {
    const validNotifications = notifications.filter(n => this.shouldSendNotification(n));
    this.queue.push(...validNotifications);
    this.emit('batchQueued', { count: validNotifications.length });
  }

  public async dispatchFromTemplate(templateId: string, userId: string, variables: Record<string, any>, channels: Notification['channels']): Promise<void> {
    const template = this.templates.get(templateId);
    if (!template) {
      throw new Error(`Template not found: ${templateId}`);
    }

    let subject = template.subject;
    let body = template.body;

    template.variables.forEach(variable => {
      const value = variables[variable] || '';
      subject = subject.replace(new RegExp(`{{${variable}}}`, 'g'), value);
      body = body.replace(new RegExp(`{{${variable}}}`, 'g'), value);
    });

    const notification: Notification = {
      id: `notif_${Date.now()}_${Math.random()}`,
      userId,
      type: 'info',
      title: subject,
      message: body,
      priority: 'medium',
      channels,
      timestamp: new Date(),
    };

    await this.dispatch(notification);
  }

  public registerTemplate(template: NotificationTemplate): void {
    this.templates.set(template.id, template);
  }

  public setUserPreferences(userId: string, preferences: any): void {
    this.userPreferences.set(userId, preferences);
  }

  private shouldSendNotification(notification: Notification): boolean {
    const preferences = this.userPreferences.get(notification.userId);
    
    if (preferences?.disableAll) {
      return false;
    }

    if (preferences?.disabledTypes?.includes(notification.type)) {
      return false;
    }

    if (preferences?.disabledChannels) {
      notification.channels = notification.channels.filter(
        channel => !preferences.disabledChannels.includes(channel)
      );
    }

    if (notification.channels.length === 0) {
      return false;
    }

    if (!this.checkRateLimit(notification.userId, notification.type)) {
      return false;
    }

    return true;
  }

  private checkRateLimit(userId: string, type: string): boolean {
    const key = `${userId}:${type}`;
    const now = Date.now();
    const lastSent = this.rateLimits.get(key) || 0;
    const minInterval = 60000;

    if (now - lastSent < minInterval) {
      return false;
    }

    this.rateLimits.set(key, now);
    return true;
  }

  private startProcessing(): void {
    setInterval(() => {
      this.processQueue();
    }, 1000);
  }

  private async processQueue(): Promise<void> {
    if (this.queue.length === 0) return;

    const batch = this.queue.splice(0, 10);

    for (const notification of batch) {
      try {
        await this.sendNotification(notification);
        this.emit('notificationSent', notification);
      } catch (error) {
        this.emit('notificationFailed', { notification, error });
      }
    }
  }

  private async sendNotification(notification: Notification): Promise<void> {
    for (const channel of notification.channels) {
      switch (channel) {
        case 'push':
          await this.sendPushNotification(notification);
          break;
        case 'email':
          await this.sendEmailNotification(notification);
          break;
        case 'sms':
          await this.sendSmsNotification(notification);
          break;
        case 'in-app':
          await this.sendInAppNotification(notification);
          break;
      }
    }
  }

  private async sendPushNotification(notification: Notification): Promise<void> {
    console.log(`Sending push notification to ${notification.userId}:`, notification.title);
  }

  private async sendEmailNotification(notification: Notification): Promise<void> {
    console.log(`Sending email notification to ${notification.userId}:`, notification.title);
  }

  private async sendSmsNotification(notification: Notification): Promise<void> {
    console.log(`Sending SMS notification to ${notification.userId}:`, notification.title);
  }

  private async sendInAppNotification(notification: Notification): Promise<void> {
    console.log(`Sending in-app notification to ${notification.userId}:`, notification.title);
  }

  public getQueueSize(): number {
    return this.queue.length;
  }

  public clearQueue(): void {
    this.queue = [];
  }

  public async getNotificationHistory(userId: string, limit: number = 50): Promise<Notification[]> {
    return [];
  }

  public async markAsRead(notificationId: string): Promise<void> {
    this.emit('notificationRead', { notificationId });
  }

  public async deleteNotification(notificationId: string): Promise<void> {
    this.emit('notificationDeleted', { notificationId });
  }
}

export const notificationDispatcher = new NotificationDispatcherService();
