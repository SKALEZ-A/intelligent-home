import axios from 'axios';

interface ZapierWebhook {
  id: string;
  url: string;
  event: string;
  enabled: boolean;
}

interface ZapierAction {
  type: string;
  data: any;
  timestamp: Date;
}

export class ZapierService {
  private webhooks: Map<string, ZapierWebhook>;
  private actionQueue: ZapierAction[];

  constructor() {
    this.webhooks = new Map();
    this.actionQueue = [];
  }

  public async registerWebhook(webhook: ZapierWebhook): Promise<void> {
    this.webhooks.set(webhook.id, webhook);
  }

  public async unregisterWebhook(webhookId: string): Promise<void> {
    this.webhooks.delete(webhookId);
  }

  public async triggerWebhook(event: string, data: any): Promise<void> {
    const webhooks = Array.from(this.webhooks.values()).filter(
      w => w.event === event && w.enabled
    );

    const promises = webhooks.map(webhook =>
      this.sendWebhookRequest(webhook.url, data)
    );

    await Promise.allSettled(promises);
  }

  private async sendWebhookRequest(url: string, data: any): Promise<void> {
    try {
      await axios.post(url, data, {
        headers: {
          'Content-Type': 'application/json',
        },
        timeout: 10000,
      });
    } catch (error) {
      console.error(`Failed to send webhook to ${url}:`, error);
    }
  }

  public async executeAction(action: ZapierAction): Promise<void> {
    this.actionQueue.push(action);

    if (this.actionQueue.length > 100) {
      this.actionQueue.shift();
    }

    await this.processAction(action);
  }

  private async processAction(action: ZapierAction): Promise<void> {
    switch (action.type) {
      case 'device_control':
        await this.handleDeviceControl(action.data);
        break;
      case 'notification':
        await this.handleNotification(action.data);
        break;
      case 'automation_trigger':
        await this.handleAutomationTrigger(action.data);
        break;
      default:
        console.warn(`Unknown action type: ${action.type}`);
    }
  }

  private async handleDeviceControl(data: any): Promise<void> {
    console.log('Handling device control:', data);
  }

  private async handleNotification(data: any): Promise<void> {
    console.log('Handling notification:', data);
  }

  private async handleAutomationTrigger(data: any): Promise<void> {
    console.log('Handling automation trigger:', data);
  }

  public getWebhooks(): ZapierWebhook[] {
    return Array.from(this.webhooks.values());
  }

  public getActionHistory(limit: number = 50): ZapierAction[] {
    return this.actionQueue.slice(-limit);
  }
}
