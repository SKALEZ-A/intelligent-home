import twilio from 'twilio';
import { logger } from '../../../../shared/utils/logger';

export interface SMSMessage {
  to: string;
  body: string;
  mediaUrl?: string[];
}

export interface SMSDeliveryStatus {
  messageId: string;
  status: 'queued' | 'sent' | 'delivered' | 'failed' | 'undelivered';
  errorCode?: string;
  errorMessage?: string;
  price?: string;
  priceUnit?: string;
}

export class SMSService {
  private client: twilio.Twilio | null = null;
  private fromNumber: string;
  private initialized: boolean = false;

  constructor() {
    this.fromNumber = process.env.TWILIO_PHONE_NUMBER || '';
    this.initializeTwilio();
  }

  private initializeTwilio(): void {
    const accountSid = process.env.TWILIO_ACCOUNT_SID;
    const authToken = process.env.TWILIO_AUTH_TOKEN;

    if (accountSid && authToken) {
      this.client = twilio(accountSid, authToken);
      this.initialized = true;
      logger.info('Twilio SMS service initialized');
    } else {
      logger.warn('Twilio credentials not configured');
    }
  }

  async sendSMS(message: SMSMessage): Promise<string> {
    if (!this.initialized || !this.client) {
      throw new Error('SMS service not initialized');
    }

    if (!this.fromNumber) {
      throw new Error('Twilio phone number not configured');
    }

    try {
      const result = await this.client.messages.create({
        body: message.body,
        from: this.fromNumber,
        to: message.to,
        mediaUrl: message.mediaUrl,
      });

      logger.info('SMS sent', {
        messageId: result.sid,
        to: message.to,
        status: result.status,
      });

      return result.sid;
    } catch (error: any) {
      logger.error('Failed to send SMS', {
        to: message.to,
        error: error.message,
      });
      throw error;
    }
  }

  async sendBulkSMS(messages: SMSMessage[]): Promise<string[]> {
    const messageIds: string[] = [];

    for (const message of messages) {
      try {
        const messageId = await this.sendSMS(message);
        messageIds.push(messageId);
      } catch (error) {
        logger.error('Bulk SMS failed for recipient', { to: message.to });
        messageIds.push('');
      }
    }

    logger.info('Bulk SMS completed', {
      total: messages.length,
      successful: messageIds.filter(id => id).length,
    });

    return messageIds;
  }

  async getDeliveryStatus(messageId: string): Promise<SMSDeliveryStatus> {
    if (!this.initialized || !this.client) {
      throw new Error('SMS service not initialized');
    }

    try {
      const message = await this.client.messages(messageId).fetch();

      return {
        messageId: message.sid,
        status: message.status as any,
        errorCode: message.errorCode?.toString(),
        errorMessage: message.errorMessage || undefined,
        price: message.price || undefined,
        priceUnit: message.priceUnit || undefined,
      };
    } catch (error: any) {
      logger.error('Failed to get SMS delivery status', {
        messageId,
        error: error.message,
      });
      throw error;
    }
  }

  async sendVerificationCode(phoneNumber: string, code: string): Promise<string> {
    const message: SMSMessage = {
      to: phoneNumber,
      body: `Your Smart Home verification code is: ${code}. This code will expire in 10 minutes.`,
    };

    return this.sendSMS(message);
  }

  async sendAlert(phoneNumber: string, alertMessage: string): Promise<string> {
    const message: SMSMessage = {
      to: phoneNumber,
      body: `🚨 Smart Home Alert: ${alertMessage}`,
    };

    return this.sendSMS(message);
  }

  async sendDeviceNotification(
    phoneNumber: string,
    deviceName: string,
    status: string
  ): Promise<string> {
    const message: SMSMessage = {
      to: phoneNumber,
      body: `Smart Home: ${deviceName} is now ${status}`,
    };

    return this.sendSMS(message);
  }

  async sendEnergyAlert(
    phoneNumber: string,
    usage: number,
    threshold: number
  ): Promise<string> {
    const message: SMSMessage = {
      to: phoneNumber,
      body: `⚡ Energy Alert: Your usage (${usage}kWh) has exceeded the threshold (${threshold}kWh)`,
    };

    return this.sendSMS(message);
  }

  async sendSecurityAlert(phoneNumber: string, event: string): Promise<string> {
    const message: SMSMessage = {
      to: phoneNumber,
      body: `🔒 Security Alert: ${event}. Check your Smart Home app for details.`,
    };

    return this.sendSMS(message);
  }

  validatePhoneNumber(phoneNumber: string): boolean {
    // E.164 format validation
    const e164Regex = /^\+[1-9]\d{1,14}$/;
    return e164Regex.test(phoneNumber);
  }

  formatPhoneNumber(phoneNumber: string, countryCode: string = '+1'): string {
    // Remove all non-digit characters
    const digits = phoneNumber.replace(/\D/g, '');

    // Add country code if not present
    if (!phoneNumber.startsWith('+')) {
      return `${countryCode}${digits}`;
    }

    return `+${digits}`;
  }

  async getAccountBalance(): Promise<{ balance: string; currency: string }> {
    if (!this.initialized || !this.client) {
      throw new Error('SMS service not initialized');
    }

    try {
      const account = await this.client.balance.fetch();
      return {
        balance: account.balance,
        currency: account.currency,
      };
    } catch (error: any) {
      logger.error('Failed to get account balance', error);
      throw error;
    }
  }

  async getMessageCost(to: string, body: string): Promise<number> {
    // Estimate cost based on message length and destination
    const segmentCount = Math.ceil(body.length / 160);
    const baseRate = 0.0075; // $0.0075 per segment (example rate)
    
    return segmentCount * baseRate;
  }
}

export const smsService = new SMSService();
