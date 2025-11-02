import { EventEmitter } from 'events';
import cron from 'node-cron';
import { ITrigger, IAutomation } from '../models/automation.model';
import { logger } from '../../../../shared/utils/logger';

export interface TriggerEvent {
  automationId: string;
  triggerId: string;
  triggerType: string;
  data: any;
  timestamp: Date;
}

export class TriggerHandlerService extends EventEmitter {
  private scheduledTriggers: Map<string, cron.ScheduledTask> = new Map();
  private deviceTriggers: Map<string, Set<string>> = new Map();

  registerAutomation(automation: IAutomation): void {
    automation.triggers.forEach((trigger, index) => {
      const triggerId = `${automation._id}_${index}`;
      
      switch (trigger.type) {
        case 'time':
          this.registerTimeTrigger(automation, trigger, triggerId);
          break;
        case 'device':
          this.registerDeviceTrigger(automation, trigger, triggerId);
          break;
        case 'sensor':
          this.registerSensorTrigger(automation, trigger, triggerId);
          break;
        case 'location':
          this.registerLocationTrigger(automation, trigger, triggerId);
          break;
        case 'weather':
          this.registerWeatherTrigger(automation, trigger, triggerId);
          break;
      }
    });

    logger.info('Automation registered', { 
      automationId: automation._id,
      name: automation.name,
      triggerCount: automation.triggers.length,
    });
  }

  unregisterAutomation(automationId: string): void {
    // Remove scheduled triggers
    const triggersToRemove: string[] = [];
    this.scheduledTriggers.forEach((task, triggerId) => {
      if (triggerId.startsWith(automationId)) {
        task.stop();
        triggersToRemove.push(triggerId);
      }
    });

    triggersToRemove.forEach(triggerId => {
      this.scheduledTriggers.delete(triggerId);
    });

    // Remove device triggers
    this.deviceTriggers.forEach((automations, deviceId) => {
      automations.delete(automationId);
    });

    logger.info('Automation unregistered', { automationId });
  }

  private registerTimeTrigger(automation: IAutomation, trigger: ITrigger, triggerId: string): void {
    const { schedule, time, days } = trigger.config;

    let cronExpression: string;

    if (schedule) {
      cronExpression = schedule;
    } else if (time && days) {
      const [hours, minutes] = time.split(':');
      const dayOfWeek = days.join(',');
      cronExpression = `${minutes} ${hours} * * ${dayOfWeek}`;
    } else {
      logger.warn('Invalid time trigger configuration', { triggerId });
      return;
    }

    try {
      const task = cron.schedule(cronExpression, () => {
        this.emitTrigger({
          automationId: automation._id.toString(),
          triggerId,
          triggerType: 'time',
          data: { time: new Date() },
          timestamp: new Date(),
        });
      });

      this.scheduledTriggers.set(triggerId, task);
      logger.info('Time trigger registered', { triggerId, cronExpression });
    } catch (error) {
      logger.error('Failed to register time trigger', { triggerId, error });
    }
  }

  private registerDeviceTrigger(automation: IAutomation, trigger: ITrigger, triggerId: string): void {
    const { deviceId } = trigger.config;
    
    if (!deviceId) {
      logger.warn('Device trigger missing deviceId', { triggerId });
      return;
    }

    if (!this.deviceTriggers.has(deviceId)) {
      this.deviceTriggers.set(deviceId, new Set());
    }

    this.deviceTriggers.get(deviceId)!.add(automation._id.toString());
    logger.info('Device trigger registered', { triggerId, deviceId });
  }

  private registerSensorTrigger(automation: IAutomation, trigger: ITrigger, triggerId: string): void {
    const { sensorType, threshold } = trigger.config;
    
    logger.info('Sensor trigger registered', { 
      triggerId, 
      sensorType, 
      threshold,
    });
  }

  private registerLocationTrigger(automation: IAutomation, trigger: ITrigger, triggerId: string): void {
    const { latitude, longitude, radius, event } = trigger.config;
    
    logger.info('Location trigger registered', { 
      triggerId, 
      latitude, 
      longitude, 
      radius, 
      event,
    });
  }

  private registerWeatherTrigger(automation: IAutomation, trigger: ITrigger, triggerId: string): void {
    const { condition, temperature } = trigger.config;
    
    logger.info('Weather trigger registered', { 
      triggerId, 
      condition, 
      temperature,
    });
  }

  handleDeviceStateChange(deviceId: string, property: string, value: any): void {
    const automationIds = this.deviceTriggers.get(deviceId);
    
    if (!automationIds || automationIds.size === 0) {
      return;
    }

    automationIds.forEach(automationId => {
      this.emitTrigger({
        automationId,
        triggerId: `${automationId}_device`,
        triggerType: 'device',
        data: { deviceId, property, value },
        timestamp: new Date(),
      });
    });
  }

  handleSensorReading(sensorId: string, sensorType: string, value: number): void {
    this.emitTrigger({
      automationId: 'sensor_automation',
      triggerId: `sensor_${sensorId}`,
      triggerType: 'sensor',
      data: { sensorId, sensorType, value },
      timestamp: new Date(),
    });
  }

  handleLocationEvent(userId: string, event: 'enter' | 'exit', location: { lat: number; lng: number }): void {
    this.emitTrigger({
      automationId: 'location_automation',
      triggerId: `location_${userId}`,
      triggerType: 'location',
      data: { userId, event, location },
      timestamp: new Date(),
    });
  }

  handleWeatherChange(condition: string, temperature: number): void {
    this.emitTrigger({
      automationId: 'weather_automation',
      triggerId: 'weather',
      triggerType: 'weather',
      data: { condition, temperature },
      timestamp: new Date(),
    });
  }

  private emitTrigger(event: TriggerEvent): void {
    this.emit('trigger:fired', event);
    logger.debug('Trigger fired', event);
  }

  getActiveTriggers(): { scheduled: number; device: number } {
    return {
      scheduled: this.scheduledTriggers.size,
      device: this.deviceTriggers.size,
    };
  }

  clearAllTriggers(): void {
    this.scheduledTriggers.forEach(task => task.stop());
    this.scheduledTriggers.clear();
    this.deviceTriggers.clear();
    logger.info('All triggers cleared');
  }
}

export const triggerHandlerService = new TriggerHandlerService();
