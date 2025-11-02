import { Request, Response } from 'express';
import { NotificationService } from '../services/notification.service';
import { logger } from '../../../shared/utils/logger';

export class NotificationController {
  private notificationService: NotificationService;

  constructor() {
    this.notificationService = new NotificationService();
  }

  async getUserNotifications(req: Request, res: Response): Promise<void> {
    try {
      const userId = req.user?.userId;
      const { status, category, limit = 50, offset = 0 } = req.query;

      const notifications = await this.notificationService.getUserNotifications(
        userId,
        {
          status: status as string,
          category: category as string,
          limit: parseInt(limit as string),
          offset: parseInt(offset as string),
        }
      );

      res.json({
        success: true,
        data: notifications,
      });
    } catch (error: any) {
      logger.error('Failed to get user notifications', error);
      res.status(500).json({
        success: false,
        error: error.message,
      });
    }
  }

  async getNotification(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const userId = req.user?.userId;

      const notification = await this.notificationService.getNotification(id, userId);

      if (!notification) {
        res.status(404).json({
          success: false,
          error: 'Notification not found',
        });
        return;
      }

      res.json({
        success: true,
        data: notification,
      });
    } catch (error: any) {
      logger.error('Failed to get notification', error);
      res.status(500).json({
        success: false,
        error: error.message,
      });
    }
  }

  async sendNotification(req: Request, res: Response): Promise<void> {
    try {
      const userId = req.user?.userId;
      const notificationData = req.body;

      const notification = await this.notificationService.sendNotification({
        ...notificationData,
        userId,
      });

      res.status(201).json({
        success: true,
        data: notification,
      });
    } catch (error: any) {
      logger.error('Failed to send notification', error);
      res.status(500).json({
        success: false,
        error: error.message,
      });
    }
  }

  async markAsRead(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const userId = req.user?.userId;

      await this.notificationService.markAsRead(id, userId);

      res.json({
        success: true,
        message: 'Notification marked as read',
      });
    } catch (error: any) {
      logger.error('Failed to mark notification as read', error);
      res.status(500).json({
        success: false,
        error: error.message,
      });
    }
  }

  async markAllAsRead(req: Request, res: Response): Promise<void> {
    try {
      const userId = req.user?.userId;

      const count = await this.notificationService.markAllAsRead(userId);

      res.json({
        success: true,
        message: `${count} notifications marked as read`,
        count,
      });
    } catch (error: any) {
      logger.error('Failed to mark all notifications as read', error);
      res.status(500).json({
        success: false,
        error: error.message,
      });
    }
  }

  async dismissNotification(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const userId = req.user?.userId;

      await this.notificationService.dismissNotification(id, userId);

      res.json({
        success: true,
        message: 'Notification dismissed',
      });
    } catch (error: any) {
      logger.error('Failed to dismiss notification', error);
      res.status(500).json({
        success: false,
        error: error.message,
      });
    }
  }

  async deleteNotification(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const userId = req.user?.userId;

      await this.notificationService.deleteNotification(id, userId);

      res.json({
        success: true,
        message: 'Notification deleted',
      });
    } catch (error: any) {
      logger.error('Failed to delete notification', error);
      res.status(500).json({
        success: false,
        error: error.message,
      });
    }
  }

  async getPreferences(req: Request, res: Response): Promise<void> {
    try {
      const userId = req.user?.userId;

      const preferences = await this.notificationService.getPreferences(userId);

      res.json({
        success: true,
        data: preferences,
      });
    } catch (error: any) {
      logger.error('Failed to get notification preferences', error);
      res.status(500).json({
        success: false,
        error: error.message,
      });
    }
  }

  async updatePreferences(req: Request, res: Response): Promise<void> {
    try {
      const userId = req.user?.userId;
      const preferences = req.body;

      const updated = await this.notificationService.updatePreferences(
        userId,
        preferences
      );

      res.json({
        success: true,
        data: updated,
      });
    } catch (error: any) {
      logger.error('Failed to update notification preferences', error);
      res.status(500).json({
        success: false,
        error: error.message,
      });
    }
  }

  async registerDevice(req: Request, res: Response): Promise<void> {
    try {
      const userId = req.user?.userId;
      const { token, platform, deviceId } = req.body;

      await this.notificationService.registerDeviceToken({
        userId,
        token,
        platform,
        deviceId,
        active: true,
        lastUsed: new Date(),
      });

      res.json({
        success: true,
        message: 'Device registered successfully',
      });
    } catch (error: any) {
      logger.error('Failed to register device', error);
      res.status(500).json({
        success: false,
        error: error.message,
      });
    }
  }

  async unregisterDevice(req: Request, res: Response): Promise<void> {
    try {
      const userId = req.user?.userId;
      const { token } = req.params;

      await this.notificationService.unregisterDeviceToken(userId, token);

      res.json({
        success: true,
        message: 'Device unregistered successfully',
      });
    } catch (error: any) {
      logger.error('Failed to unregister device', error);
      res.status(500).json({
        success: false,
        error: error.message,
      });
    }
  }

  async subscribeToTopic(req: Request, res: Response): Promise<void> {
    try {
      const userId = req.user?.userId;
      const { topic } = req.body;

      await this.notificationService.subscribeToTopic(userId, topic);

      res.json({
        success: true,
        message: `Subscribed to topic: ${topic}`,
      });
    } catch (error: any) {
      logger.error('Failed to subscribe to topic', error);
      res.status(500).json({
        success: false,
        error: error.message,
      });
    }
  }

  async unsubscribeFromTopic(req: Request, res: Response): Promise<void> {
    try {
      const userId = req.user?.userId;
      const { topic } = req.body;

      await this.notificationService.unsubscribeFromTopic(userId, topic);

      res.json({
        success: true,
        message: `Unsubscribed from topic: ${topic}`,
      });
    } catch (error: any) {
      logger.error('Failed to unsubscribe from topic', error);
      res.status(500).json({
        success: false,
        error: error.message,
      });
    }
  }
}
