import axios from 'axios';
import { logger } from '../utils/logger';

export interface IFTTTTrigger {
  id: string;
  eventName: string;
  userId: string;
  webhookKey: string;
  active: boolean;
  createdAt: Date;
}

export interface IFTTTAction {
  id: string;
  appletId: string;
  actionType: string;
  parameters: Record<string, any>;
  userId: string;
}

export class IFTTTService {
  private triggers: Map<string, IFTTTTrigger> = new Map();
  private actions: Map<string, IFTTTAction> = new Map();
  private baseUrl = 'https://maker.ifttt.com/trigger';

  async createTrigger(trigger: Omit<IFTTTTrigger, 'id' | 'createdAt'>): Promise<IFTTTTrigger> {
    const newTrigger: IFTTTTrigger = {
      ...trigger,
      id: `ifttt_trigger_${Date.now()}`,
      createdAt: new Date()
    };

    this.triggers.set(newTrigger.id, newTrigger);
    logger.info(`Created IFTTT trigger: ${newTrigger.id}`);
    
    return newTrigger;
  }

  async triggerEvent(
    eventName: string,
    webhookKey: string,
    value1?: string,
    value2?: string,
    value3?: string
  ): Promise<void> {
    try {
      const url = `${this.baseUrl}/${eventName}/with/key/${webhookKey}`;
      
      await axios.post(url, {
        value1,
        value2,
        value3
      }, {
        headers: {
          'Content-Type': 'application/json'
        }
      });

      logger.info(`Triggered IFTTT event: ${eventName}`);
    } catch (error) {
      logger.error(`Failed to trigger IFTTT event ${eventName}:`, error);
      throw new Error('Failed to trigger IFTTT event');
    }
  }

  async handleDeviceStateChange(deviceId: string, state: Record<string, any>): Promise<void> {
    const activeTriggers = Array.from(this.triggers.values())
      .filter(trigger => trigger.active);

    for (const trigger of activeTriggers) {
      try {
        await this.triggerEvent(
          trigger.eventName,
          trigger.webhookKey,
          deviceId,
          JSON.stringify(state),
          new Date().toISOString()
        );
      } catch (error) {
        logger.error(`Failed to trigger IFTTT for device ${deviceId}:`, error);
      }
    }
  }

  async handleAutomationExecuted(automationId: string, result: string): Promise<void> {
    const activeTriggers = Array.from(this.triggers.values())
      .filter(trigger => trigger.active && trigger.eventName.includes('automation'));

    for (const trigger of activeTriggers) {
      try {
        await this.triggerEvent(
          trigger.eventName,
          trigger.webhookKey,
          automationId,
          result,
          new Date().toISOString()
        );
      } catch (error) {
        logger.error(`Failed to trigger IFTTT for automation ${automationId}:`, error);
      }
    }
  }

  async handleSecurityEvent(eventType: string, details: Record<string, any>): Promise<void> {
    const activeTriggers = Array.from(this.triggers.values())
      .filter(trigger => trigger.active && trigger.eventName.includes('security'));

    for (const trigger of activeTriggers) {
      try {
        await this.triggerEvent(
          trigger.eventName,
          trigger.webhookKey,
          eventType,
          JSON.stringify(details),
          new Date().toISOString()
        );
      } catch (error) {
        logger.error(`Failed to trigger IFTTT for security event ${eventType}:`, error);
      }
    }
  }

  async deleteTrigger(triggerId: string): Promise<void> {
    const trigger = this.triggers.get(triggerId);
    
    if (!trigger) {
      throw new Error(`Trigger ${triggerId} not found`);
    }

    this.triggers.delete(triggerId);
    logger.info(`Deleted IFTTT trigger: ${triggerId}`);
  }

  getTriggers(userId: string): IFTTTTrigger[] {
    return Array.from(this.triggers.values())
      .filter(trigger => trigger.userId === userId);
  }

  async updateTrigger(triggerId: string, updates: Partial<IFTTTTrigger>): Promise<IFTTTTrigger> {
    const trigger = this.triggers.get(triggerId);
    
    if (!trigger) {
      throw new Error(`Trigger ${triggerId} not found`);
    }

    Object.assign(trigger, updates);
    logger.info(`Updated IFTTT trigger: ${triggerId}`);
    
    return trigger;
  }

  async testTrigger(triggerId: string): Promise<boolean> {
    const trigger = this.triggers.get(triggerId);
    
    if (!trigger) {
      throw new Error(`Trigger ${triggerId} not found`);
    }

    try {
      await this.triggerEvent(
        trigger.eventName,
        trigger.webhookKey,
        'test',
        'This is a test trigger',
        new Date().toISOString()
      );
      return true;
    } catch (error) {
      return false;
    }
  }
}
