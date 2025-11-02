import axios, { AxiosRequestConfig } from 'axios';
import crypto from 'crypto';
import { EventEmitter } from 'events';

interface WebhookConfig {
  id: string;
  url: string;
  events: string[];
  secret?: string;
  headers?: { [key: string]: string };
  retryAttempts?: number;
  retryDelay?: number;
  timeout?: number;
  active: boolean;
}

interface WebhookPayload {
  event: string;
  timestamp: number;
  data: any;
  webhookId: string;
}

interface WebhookDelivery {
  id: string;
  webhookId: string;
  event: string;
  payload: WebhookPayload;
  attempts: number;
  status: 'pending' | 'success' | 'failed';
  lastAttempt?: number;
  nextRetry?: number;
  response?: {
    statusCode: number;
    body: string;
    headers: any;
  };
  error?: string;
}

export class WebhookManagerService extends EventEmitter {
  private webhooks: Map<string, WebhookConfig> = new Map();
  private deliveries: Map<string, WebhookDelivery> = new Map();
  private retryQueue: WebhookDelivery[] = [];
  private processing = false;

  constructor() {
    super();
    this.startRetryProcessor();
  }

  public registerWebhook(config: WebhookConfig): void {
    this.webhooks.set(config.id, {
      retryAttempts: 3,
      retryDelay: 5000,
      timeout: 30000,
      ...config
    });
    this.emit('webhookRegistered', config);
  }

  public unregisterWebhook(webhookId: string): void {
    this.webhooks.delete(webhookId);
    this.emit('webhookUnregistered', webhookId);
  }

  public async triggerEvent(event: string, data: any): Promise<void> {
    const matchingWebhooks = Array.from(this.webhooks.values())
      .filter(wh => wh.active && wh.events.includes(event));

    const deliveryPromises = matchingWebhooks.map(webhook => 
      this.deliverWebhook(webhook, event, data)
    );

    await Promise.allSettled(deliveryPromises);
  }

  private async deliverWebhook(
    webhook: WebhookConfig,
    event: string,
    data: any
  ): Promise<void> {
    const deliveryId = this.generateDeliveryId();
    const payload: WebhookPayload = {
      event,
      timestamp: Date.now(),
      data,
      webhookId: webhook.id
    };

    const delivery: WebhookDelivery = {
      id: deliveryId,
      webhookId: webhook.id,
      event,
      payload,
      attempts: 0,
      status: 'pending'
    };

    this.deliveries.set(deliveryId, delivery);

    try {
      await this.sendWebhook(webhook, payload, delivery);
    } catch (error) {
      this.handleDeliveryFailure(delivery, webhook, error);
    }
  }

  private async sendWebhook(
    webhook: WebhookConfig,
    payload: WebhookPayload,
    delivery: WebhookDelivery
  ): Promise<void> {
    delivery.attempts++;
    delivery.lastAttempt = Date.now();

    const signature = webhook.secret 
      ? this.generateSignature(payload, webhook.secret)
      : undefined;

    const headers: any = {
      'Content-Type': 'application/json',
      'X-Webhook-Event': payload.event,
      'X-Webhook-Delivery': delivery.id,
      'X-Webhook-Timestamp': payload.timestamp.toString(),
      ...webhook.headers
    };

    if (signature) {
      headers['X-Webhook-Signature'] = signature;
    }

    const config: AxiosRequestConfig = {
      method: 'POST',
      url: webhook.url,
      data: payload,
      headers,
      timeout: webhook.timeout,
      validateStatus: (status) => status >= 200 && status < 300
    };

    try {
      const response = await axios(config);
      
      delivery.status = 'success';
      delivery.response = {
        statusCode: response.status,
        body: JSON.stringify(response.data),
        headers: response.headers
      };

      this.emit('webhookDelivered', delivery);
    } catch (error: any) {
      delivery.error = error.message;
      
      if (error.response) {
        delivery.response = {
          statusCode: error.response.status,
          body: JSON.stringify(error.response.data),
          headers: error.response.headers
        };
      }

      throw error;
    }
  }

  private handleDeliveryFailure(
    delivery: WebhookDelivery,
    webhook: WebhookConfig,
    error: any
  ): void {
    const maxAttempts = webhook.retryAttempts || 3;

    if (delivery.attempts < maxAttempts) {
      delivery.nextRetry = Date.now() + (webhook.retryDelay || 5000) * delivery.attempts;
      this.retryQueue.push(delivery);
      this.emit('webhookRetryScheduled', delivery);
    } else {
      delivery.status = 'failed';
      this.emit('webhookFailed', delivery);
    }
  }

  private startRetryProcessor(): void {
    setInterval(async () => {
      if (this.processing || this.retryQueue.length === 0) {
        return;
      }

      this.processing = true;

      try {
        const now = Date.now();
        const readyForRetry = this.retryQueue.filter(d => 
          d.nextRetry && d.nextRetry <= now
        );

        for (const delivery of readyForRetry) {
          const webhook = this.webhooks.get(delivery.webhookId);
          if (!webhook || !webhook.active) {
            this.retryQueue = this.retryQueue.filter(d => d.id !== delivery.id);
            continue;
          }

          try {
            await this.sendWebhook(webhook, delivery.payload, delivery);
            this.retryQueue = this.retryQueue.filter(d => d.id !== delivery.id);
          } catch (error) {
            this.handleDeliveryFailure(delivery, webhook, error);
          }
        }
      } finally {
        this.processing = false;
      }
    }, 1000);
  }

  private generateSignature(payload: WebhookPayload, secret: string): string {
    const hmac = crypto.createHmac('sha256', secret);
    hmac.update(JSON.stringify(payload));
    return `sha256=${hmac.digest('hex')}`;
  }

  public verifySignature(payload: string, signature: string, secret: string): boolean {
    const expectedSignature = this.generateSignature(JSON.parse(payload), secret);
    return crypto.timingSafeEqual(
      Buffer.from(signature),
      Buffer.from(expectedSignature)
    );
  }

  private generateDeliveryId(): string {
    return `del_${Date.now()}_${crypto.randomBytes(8).toString('hex')}`;
  }

  public getDeliveryStatus(deliveryId: string): WebhookDelivery | undefined {
    return this.deliveries.get(deliveryId);
  }

  public getWebhookDeliveries(webhookId: string, limit: number = 50): WebhookDelivery[] {
    return Array.from(this.deliveries.values())
      .filter(d => d.webhookId === webhookId)
      .sort((a, b) => (b.lastAttempt || 0) - (a.lastAttempt || 0))
      .slice(0, limit);
  }

  public getWebhookStats(webhookId: string): {
    totalDeliveries: number;
    successfulDeliveries: number;
    failedDeliveries: number;
    pendingDeliveries: number;
    averageResponseTime: number;
  } {
    const deliveries = Array.from(this.deliveries.values())
      .filter(d => d.webhookId === webhookId);

    const successful = deliveries.filter(d => d.status === 'success');
    const failed = deliveries.filter(d => d.status === 'failed');
    const pending = deliveries.filter(d => d.status === 'pending');

    return {
      totalDeliveries: deliveries.length,
      successfulDeliveries: successful.length,
      failedDeliveries: failed.length,
      pendingDeliveries: pending.length,
      averageResponseTime: 0 // Would need to track response times
    };
  }
}

export const webhookManager = new WebhookManagerService();
