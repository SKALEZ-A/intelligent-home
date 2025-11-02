import { Request, Response } from 'express';
import { IFTTTService } from '../services/ifttt.service';
import { WebhookService } from '../services/webhook.service';
import { logger } from '../../../shared/utils/logger';

export class IntegrationController {
  private iftttService: IFTTTService;
  private webhookService: WebhookService;

  constructor() {
    this.iftttService = new IFTTTService();
    this.webhookService = new WebhookService();
  }

  async createWebhook(req: Request, res: Response): Promise<void> {
    try {
      const { url, events, secret, userId } = req.body;
      const webhook = await this.webhookService.createWebhook({
        url,
        events,
        secret,
        userId,
      });

      res.json({
        success: true,
        webhook,
      });
    } catch (error: any) {
      logger.error('Failed to create webhook', { error });
      res.status(500).json({
        success: false,
        error: error.message,
      });
    }
  }

  async triggerIFTTT(req: Request, res: Response): Promise<void> {
    try {
      const { event, value1, value2, value3 } = req.body;
      await this.iftttService.trigger(event, { value1, value2, value3 });

      res.json({
        success: true,
      });
    } catch (error: any) {
      logger.error('Failed to trigger IFTTT', { error });
      res.status(500).json({
        success: false,
        error: error.message,
      });
    }
  }

  async listWebhooks(req: Request, res: Response): Promise<void> {
    try {
      const { userId } = req.query;
      const webhooks = await this.webhookService.listWebhooks(userId as string);

      res.json({
        success: true,
        webhooks,
      });
    } catch (error: any) {
      logger.error('Failed to list webhooks', { error });
      res.status(500).json({
        success: false,
        error: error.message,
      });
    }
  }

  async deleteWebhook(req: Request, res: Response): Promise<void> {
    try {
      const { webhookId } = req.params;
      await this.webhookService.deleteWebhook(webhookId);

      res.json({
        success: true,
      });
    } catch (error: any) {
      logger.error('Failed to delete webhook', { error });
      res.status(500).json({
        success: false,
        error: error.message,
      });
    }
  }
}
