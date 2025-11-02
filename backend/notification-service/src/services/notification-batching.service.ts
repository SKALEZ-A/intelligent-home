import { EventEmitter } from 'events';

interface BatchedNotification {
  userId: string;
  notifications: Array<{
    id: string;
    title: string;
    message: string;
    timestamp: number;
  }>;
  batchedAt: number;
}

interface BatchingConfig {
  enabled: boolean;
  interval: number;
  maxBatchSize: number;
  minBatchSize: number;
}

export class NotificationBatchingService extends EventEmitter {
  private pendingNotifications: Map<string, Array<any>> = new Map();
  private config: BatchingConfig = {
    enabled: true,
    interval: 300000,
    maxBatchSize: 10,
    minBatchSize: 2
  };
  private batchInterval: NodeJS.Timeout | null = null;

  constructor() {
    super();
    this.startBatching();
  }

  public addNotification(userId: string, notification: any): void {
    if (!this.config.enabled) {
      this.emit('sendImmediate', { userId, notification });
      return;
    }

    const pending = this.pendingNotifications.get(userId) || [];
    pending.push(notification);
    this.pendingNotifications.set(userId, pending);

    if (pending.length >= this.config.maxBatchSize) {
      this.sendBatch(userId);
    }
  }

  private startBatching(): void {
    if (this.batchInterval) {
      clearInterval(this.batchInterval);
    }

    this.batchInterval = setInterval(() => {
      this.processBatches();
    }, this.config.interval);
  }

  private processBatches(): void {
    for (const [userId, notifications] of this.pendingNotifications.entries()) {
      if (notifications.length >= this.config.minBatchSize) {
        this.sendBatch(userId);
      }
    }
  }

  private sendBatch(userId: string): void {
    const notifications = this.pendingNotifications.get(userId);

    if (!notifications || notifications.length === 0) {
      return;
    }

    const batch: BatchedNotification = {
      userId,
      notifications,
      batchedAt: Date.now()
    };

    this.emit('batchReady', batch);
    this.pendingNotifications.delete(userId);
  }

  public updateConfig(config: Partial<BatchingConfig>): void {
    this.config = { ...this.config, ...config };
    
    if (config.interval) {
      this.startBatching();
    }
  }

  public getPendingCount(userId: string): number {
    return this.pendingNotifications.get(userId)?.length || 0;
  }

  public flushAll(): void {
    for (const userId of this.pendingNotifications.keys()) {
      this.sendBatch(userId);
    }
  }

  public stop(): void {
    if (this.batchInterval) {
      clearInterval(this.batchInterval);
      this.batchInterval = null;
    }
  }
}

export const notificationBatchingService = new NotificationBatchingService();
