import axios from 'axios';
import { EventEmitter } from 'events';
import { logger } from '../utils/logger';

export interface Webhook {
  id: string;
  url: string;
  events: string[];
  secret?: string;
  active: boolean;
  userId: string;
  createdAt: Date;
  lastTriggered?: Date;
}

export interface WebhookPayload {
  event: string;
  timestamp: Date;
  data: Record<string, any>;
  signature?: string;
}

export class WebhookService extends EventEmitter {
  private webhooks: Map<string, Webhook> = new Map();
  private retryAttempts = 3;
  private retryDelay = 1000;

  async registerWebhook(webhook: Omit<Webhook, 'id' | 'createdAt'>): Promise<Webhook> {
    const newWebhook: Webhook = {
      ...webhook,
      id: `webhook_${Date.now()}`,
      createdAt: new Date()
    };

    this.webhooks.set(newWebhook.id, newWebhook);
    logger.info(`Registered webhook: ${newWebhook.id}`);
    
    return newWebhook;
  }

  async triggerWebhook(webhookId: string, payload: WebhookPayload): Promise<void> {
    const webhook = this.webhooks.get(webhookId);
    
    if (!webhook) {
      throw new Error(`Webhook ${webhookId} not found`);
    }

    if (!webhook.active) {
      logger.warn(`Webhook ${webhookId} is inactive`);
      return;
    }

    if (!webhook.events.includes(payload.event)) {
      logger.debug(`Webhook ${webhookId} not subscribed to event ${payload.event}`);
      return;
    }

    await this.sendWebhook(webhook, payload);
  }

  private async sendWebhook(webhook: Webhook, payload: WebhookPayload, attempt: number = 1): Promise<void> {
    try {
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        'User-Agent': 'HomeAutomation-Webhook/1.0'
      };

      if (webhook.secret) {
        // Add HMAC signature for verification
        const crypto = require('crypto');
        const signature = crypto
          .createHmac('sha256', webhook.secret)
          .update(JSON.stringify(payload))
          .digest('hex');
        headers['X-Webhook-Signature'] = signature;
        payload.signature = signature;
      }

      await axios.post(webhook.url, payload, {
        headers,
        timeout: 10000
      });

      webhook.lastTriggered = new Date();
      logger.info(`Webhook ${webhook.id} triggered successfully`);
      this.emit('webhookTriggered', { webhookId: webhook.id, payload });
      
    } catch (error) {
      logger.error(`Webhook ${webhook.id} failed (attempt ${attempt}):`, error);

      if (attempt < this.retryAttempts) {
        await new Promise(resolve => setTimeout(resolve, this.retryDelay * attempt));
        return this.sendWebhook(webhook, payload, attempt + 1);
      }

      this.emit('webhookFailed', { webhookId: webhook.id, payload, error });
    }
  }

  async triggerEvent(event: string, data: Record<string, any>): Promise<void> {
    const payload: WebhookPayload = {
      event,
      timestamp: new Date(),
      data
    };

    const promises = Array.from(this.webhooks.values())
      .filter(webhook => webhook.active && webhook.events.includes(event))
      .map(webhook => this.sendWebhook(webhook, payload));

    await Promise.allSettled(promises);
  }

  async updateWebhook(webhookId: string, updates: Partial<Webhook>): Promise<Webhook> {
    const webhook = this.webhooks.get(webhookId);
    
    if (!webhook) {
      throw new Error(`Webhook ${webhookId} not found`);
    }

    Object.assign(webhook, updates);
    logger.info(`Updated webhook: ${webhookId}`);
    
    return webhook;
  }

  async deleteWebhook(webhookId: string): Promise<void> {
    const webhook = this.webhooks.get(webhookId);
    
    if (!webhook) {
      throw new Error(`Webhook ${webhookId} not found`);
    }

    this.webhooks.delete(webhookId);
    logger.info(`Deleted webhook: ${webhookId}`);
  }

  getWebhooks(userId: string): Webhook[] {
    return Array.from(this.webhooks.values())
      .filter(webhook => webhook.userId === userId);
  }

  async testWebhook(webhookId: string): Promise<boolean> {
    const webhook = this.webhooks.get(webhookId);
    
    if (!webhook) {
      throw new Error(`Webhook ${webhookId} not found`);
    }

    const testPayload: WebhookPayload = {
      event: 'test',
      timestamp: new Date(),
      data: { message: 'This is a test webhook' }
    };

    try {
      await this.sendWebhook(webhook, testPayload);
      return true;
    } catch (error) {
      return false;
    }
  }
}
