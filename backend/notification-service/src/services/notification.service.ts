import { Notification, INotification } from '../models/notification.model';
import { pushNotificationService, DeviceToken } from './push-notification.service';
import { emailService } from '../../auth-service/src/services/email.service';
import { smsService } from './sms.service';
import { logger } from '../../../shared/utils/logger';

export interface NotificationPreferences {
  email: boolean;
  push: boolean;
  sms: boolean;
  categories: {
    device: boolean;
    automation: boolean;
    energy: boolean;
    security: boolean;
    system: boolean;
    update: boolean;
  };
  quietHours: {
    enabled: boolean;
    start: string;
    end: string;
  };
}

export class NotificationService {
  async getUserNotifications(
    userId: string,
    options: {
      status?: string;
      category?: string;
      limit?: number;
      offset?: number;
    }
  ): Promise<INotification[]> {
    const query: any = { userId };

    if (options.status) {
      query.status = options.status;
    }

    if (options.category) {
      query.category = options.category;
    }

    const notifications = await Notification.find(query)
      .sort({ createdAt: -1 })
      .limit(options.limit || 50)
      .skip(options.offset || 0);

    return notifications;
  }

  async getNotification(id: string, userId: string): Promise<INotification | null> {
    return Notification.findOne({ _id: id, userId });
  }

  async sendNotification(data: Partial<INotification>): Promise<INotification> {
    const notification = new Notification(data);
    await notification.save();

    // Send through configured channels
    await this.deliverNotification(notification);

    return notification;
  }

  private async deliverNotification(notification: INotification): Promise<void> {
    const deliveryPromises: Promise<void>[] = [];

    for (const channel of notification.channels) {
      switch (channel) {
        case 'push':
          deliveryPromises.push(this.sendPushNotification(notification));
          break;
        case 'email':
          deliveryPromises.push(this.sendEmailNotification(notification));
          break;
        case 'sms':
          deliveryPromises.push(this.sendSMSNotification(notification));
          break;
        case 'in_app':
          // In-app notifications are already stored in database
          notification.deliveryStatus.in_app = {
            delivered: true,
            deliveredAt: new Date(),
          };
          break;
      }
    }

    await Promise.allSettled(deliveryPromises);
    await notification.save();
  }

  private async sendPushNotification(notification: INotification): Promise<void> {
    try {
      await pushNotificationService.sendToUser(notification.userId, {
        title: notification.title,
        body: notification.message,
        data: notification.data,
        priority: notification.priority === 'critical' ? 'high' : 'normal',
      });

      notification.deliveryStatus.push = {
        sent: true,
        sentAt: new Date(),
      };
    } catch (error: any) {
      logger.error('Failed to send push notification', error);
      notification.deliveryStatus.push = {
        sent: false,
        error: error.message,
      };
    }
  }

  private async sendEmailNotification(notification: INotification): Promise<void> {
    try {
      // Get user email from user service
      const userEmail = await this.getUserEmail(notification.userId);

      if (userEmail) {
        await emailService.sendEmail({
          to: userEmail,
          subject: notification.title,
          html: this.formatEmailContent(notification),
          text: notification.message,
        });

        notification.deliveryStatus.email = {
          sent: true,
          sentAt: new Date(),
        };
      }
    } catch (error: any) {
      logger.error('Failed to send email notification', error);
      notification.deliveryStatus.email = {
        sent: false,
        error: error.message,
      };
    }
  }

  private async sendSMSNotification(notification: INotification): Promise<void> {
    try {
      // Get user phone from user service
      const userPhone = await this.getUserPhone(notification.userId);

      if (userPhone) {
        await smsService.sendSMS({
          to: userPhone,
          body: `${notification.title}: ${notification.message}`,
        });

        notification.deliveryStatus.sms = {
          sent: true,
          sentAt: new Date(),
        };
      }
    } catch (error: any) {
      logger.error('Failed to send SMS notification', error);
      notification.deliveryStatus.sms = {
        sent: false,
        error: error.message,
      };
    }
  }

  private formatEmailContent(notification: INotification): string {
    return `
      <!DOCTYPE html>
      <html>
        <head>
          <style>
            body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
            .container { max-width: 600px; margin: 0 auto; padding: 20px; }
            .header { background-color: #007bff; color: white; padding: 20px; text-align: center; }
            .content { padding: 20px; background-color: #f8f9fa; }
            .footer { margin-top: 20px; font-size: 12px; color: #666; text-align: center; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h2>${notification.title}</h2>
            </div>
            <div class="content">
              <p>${notification.message}</p>
              ${notification.data ? `<pre>${JSON.stringify(notification.data, null, 2)}</pre>` : ''}
            </div>
            <div class="footer">
              <p>Smart Home Automation System</p>
              <p>${new Date().toLocaleString()}</p>
            </div>
          </div>
        </body>
      </html>
    `;
  }

  async markAsRead(id: string, userId: string): Promise<void> {
    await Notification.updateOne(
      { _id: id, userId },
      {
        $set: {
          status: 'read',
          readAt: new Date(),
          'deliveryStatus.in_app.readAt': new Date(),
        },
      }
    );
  }

  async markAllAsRead(userId: string): Promise<number> {
    const result = await Notification.updateMany(
      { userId, status: { $ne: 'read' } },
      {
        $set: {
          status: 'read',
          readAt: new Date(),
          'deliveryStatus.in_app.readAt': new Date(),
        },
      }
    );

    return result.modifiedCount;
  }

  async dismissNotification(id: string, userId: string): Promise<void> {
    await Notification.updateOne(
      { _id: id, userId },
      { $set: { dismissedAt: new Date() } }
    );
  }

  async deleteNotification(id: string, userId: string): Promise<void> {
    await Notification.deleteOne({ _id: id, userId });
  }

  async getPreferences(userId: string): Promise<NotificationPreferences> {
    // In production, this would fetch from a preferences collection
    return {
      email: true,
      push: true,
      sms: false,
      categories: {
        device: true,
        automation: true,
        energy: true,
        security: true,
        system: true,
        update: true,
      },
      quietHours: {
        enabled: false,
        start: '22:00',
        end: '08:00',
      },
    };
  }

  async updatePreferences(
    userId: string,
    preferences: Partial<NotificationPreferences>
  ): Promise<NotificationPreferences> {
    // In production, this would update a preferences collection
    logger.info('Updating notification preferences', { userId, preferences });
    return this.getPreferences(userId);
  }

  async registerDeviceToken(deviceToken: DeviceToken): Promise<void> {
    await pushNotificationService.registerToken(deviceToken);
  }

  async unregisterDeviceToken(userId: string, token: string): Promise<void> {
    await pushNotificationService.unregisterToken(userId, token);
  }

  async subscribeToTopic(userId: string, topic: string): Promise<void> {
    const tokens = pushNotificationService.getUserTokens(userId);
    const tokenStrings = tokens.map(t => t.token);

    if (tokenStrings.length > 0) {
      await pushNotificationService.subscribeToTopic(tokenStrings, topic);
    }
  }

  async unsubscribeFromTopic(userId: string, topic: string): Promise<void> {
    const tokens = pushNotificationService.getUserTokens(userId);
    const tokenStrings = tokens.map(t => t.token);

    if (tokenStrings.length > 0) {
      await pushNotificationService.unsubscribeFromTopic(tokenStrings, topic);
    }
  }

  private async getUserEmail(userId: string): Promise<string | null> {
    // In production, fetch from user service
    return `user_${userId}@example.com`;
  }

  private async getUserPhone(userId: string): Promise<string | null> {
    // In production, fetch from user service
    return null;
  }

  async sendBulkNotifications(
    userIds: string[],
    notificationData: Partial<INotification>
  ): Promise<void> {
    const notifications = userIds.map(userId =>
      this.sendNotification({ ...notificationData, userId })
    );

    await Promise.allSettled(notifications);
  }

  async getUnreadCount(userId: string): Promise<number> {
    return Notification.countDocuments({
      userId,
      status: { $ne: 'read' },
    });
  }

  async cleanupOldNotifications(daysOld: number = 30): Promise<number> {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - daysOld);

    const result = await Notification.deleteMany({
      createdAt: { $lt: cutoffDate },
      status: 'read',
    });

    logger.info(`Cleaned up ${result.deletedCount} old notifications`);
    return result.deletedCount;
  }
}
