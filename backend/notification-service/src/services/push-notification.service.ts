import admin from 'firebase-admin';
import { logger } from '../../../../shared/utils/logger';

export interface PushNotificationPayload {
  title: string;
  body: string;
  data?: Record<string, string>;
  imageUrl?: string;
  badge?: number;
  sound?: string;
  priority?: 'high' | 'normal';
  clickAction?: string;
}

export interface DeviceToken {
  userId: string;
  token: string;
  platform: 'ios' | 'android' | 'web';
  deviceId: string;
  active: boolean;
  lastUsed: Date;
}

export class PushNotificationService {
  private initialized: boolean = false;
  private deviceTokens: Map<string, DeviceToken[]> = new Map();

  constructor() {
    this.initializeFirebase();
  }

  private initializeFirebase(): void {
    try {
      if (!admin.apps.length) {
        const serviceAccount = process.env.FIREBASE_SERVICE_ACCOUNT;
        
        if (serviceAccount) {
          admin.initializeApp({
            credential: admin.credential.cert(JSON.parse(serviceAccount)),
          });
          this.initialized = true;
          logger.info('Firebase Admin initialized');
        } else {
          logger.warn('Firebase service account not configured');
        }
      }
    } catch (error) {
      logger.error('Failed to initialize Firebase', error);
    }
  }

  async sendToUser(userId: string, payload: PushNotificationPayload): Promise<void> {
    const tokens = this.deviceTokens.get(userId);
    
    if (!tokens || tokens.length === 0) {
      logger.warn('No device tokens found for user', { userId });
      return;
    }

    const activeTokens = tokens.filter(t => t.active).map(t => t.token);
    
    if (activeTokens.length === 0) {
      logger.warn('No active device tokens for user', { userId });
      return;
    }

    await this.sendToTokens(activeTokens, payload);
  }

  async sendToTokens(tokens: string[], payload: PushNotificationPayload): Promise<void> {
    if (!this.initialized) {
      logger.error('Firebase not initialized');
      return;
    }

    const message: admin.messaging.MulticastMessage = {
      tokens,
      notification: {
        title: payload.title,
        body: payload.body,
        imageUrl: payload.imageUrl,
      },
      data: payload.data,
      android: {
        priority: payload.priority || 'high',
        notification: {
          sound: payload.sound || 'default',
          clickAction: payload.clickAction,
          channelId: 'smart_home_notifications',
        },
      },
      apns: {
        payload: {
          aps: {
            alert: {
              title: payload.title,
              body: payload.body,
            },
            badge: payload.badge,
            sound: payload.sound || 'default',
          },
        },
      },
      webpush: {
        notification: {
          title: payload.title,
          body: payload.body,
          icon: '/icon-192x192.png',
          badge: '/badge-72x72.png',
        },
      },
    };

    try {
      const response = await admin.messaging().sendEachForMulticast(message);
      
      logger.info('Push notifications sent', {
        successCount: response.successCount,
        failureCount: response.failureCount,
      });

      // Handle failed tokens
      if (response.failureCount > 0) {
        const failedTokens: string[] = [];
        response.responses.forEach((resp, idx) => {
          if (!resp.success) {
            failedTokens.push(tokens[idx]);
            logger.error('Failed to send to token', {
              token: tokens[idx],
              error: resp.error?.message,
            });
          }
        });

        // Remove invalid tokens
        await this.removeInvalidTokens(failedTokens);
      }
    } catch (error) {
      logger.error('Failed to send push notifications', error);
      throw error;
    }
  }

  async sendToTopic(topic: string, payload: PushNotificationPayload): Promise<void> {
    if (!this.initialized) {
      logger.error('Firebase not initialized');
      return;
    }

    const message: admin.messaging.Message = {
      topic,
      notification: {
        title: payload.title,
        body: payload.body,
        imageUrl: payload.imageUrl,
      },
      data: payload.data,
    };

    try {
      const messageId = await admin.messaging().send(message);
      logger.info('Topic notification sent', { topic, messageId });
    } catch (error) {
      logger.error('Failed to send topic notification', { topic, error });
      throw error;
    }
  }

  async registerToken(deviceToken: DeviceToken): Promise<void> {
    const userTokens = this.deviceTokens.get(deviceToken.userId) || [];
    
    // Check if token already exists
    const existingIndex = userTokens.findIndex(t => t.token === deviceToken.token);
    
    if (existingIndex >= 0) {
      userTokens[existingIndex] = deviceToken;
    } else {
      userTokens.push(deviceToken);
    }

    this.deviceTokens.set(deviceToken.userId, userTokens);
    logger.info('Device token registered', {
      userId: deviceToken.userId,
      platform: deviceToken.platform,
    });
  }

  async unregisterToken(userId: string, token: string): Promise<void> {
    const userTokens = this.deviceTokens.get(userId);
    
    if (!userTokens) return;

    const filteredTokens = userTokens.filter(t => t.token !== token);
    this.deviceTokens.set(userId, filteredTokens);
    
    logger.info('Device token unregistered', { userId, token });
  }

  async subscribeToTopic(tokens: string[], topic: string): Promise<void> {
    if (!this.initialized) {
      logger.error('Firebase not initialized');
      return;
    }

    try {
      const response = await admin.messaging().subscribeToTopic(tokens, topic);
      logger.info('Subscribed to topic', {
        topic,
        successCount: response.successCount,
        failureCount: response.failureCount,
      });
    } catch (error) {
      logger.error('Failed to subscribe to topic', { topic, error });
      throw error;
    }
  }

  async unsubscribeFromTopic(tokens: string[], topic: string): Promise<void> {
    if (!this.initialized) {
      logger.error('Firebase not initialized');
      return;
    }

    try {
      const response = await admin.messaging().unsubscribeFromTopic(tokens, topic);
      logger.info('Unsubscribed from topic', {
        topic,
        successCount: response.successCount,
        failureCount: response.failureCount,
      });
    } catch (error) {
      logger.error('Failed to unsubscribe from topic', { topic, error });
      throw error;
    }
  }

  private async removeInvalidTokens(tokens: string[]): Promise<void> {
    for (const [userId, userTokens] of this.deviceTokens.entries()) {
      const validTokens = userTokens.filter(t => !tokens.includes(t.token));
      this.deviceTokens.set(userId, validTokens);
    }
    
    logger.info('Invalid tokens removed', { count: tokens.length });
  }

  getUserTokens(userId: string): DeviceToken[] {
    return this.deviceTokens.get(userId) || [];
  }

  getActiveTokenCount(userId: string): number {
    const tokens = this.deviceTokens.get(userId) || [];
    return tokens.filter(t => t.active).length;
  }
}

export const pushNotificationService = new PushNotificationService();
