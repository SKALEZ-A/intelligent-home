import { v4 as uuidv4 } from 'uuid';
import cron from 'node-cron';
import {
  Automation,
  Trigger,
  Condition,
  Action,
  AutomationExecution,
  ActionExecution,
  DeviceState,
  WeatherData,
} from '../../../../shared/types';
import { createLogger } from '../../../../shared/utils/logger';
import {
  NotFoundError,
  AutomationError,
  ValidationError,
} from '../../../../shared/utils/errors';
import { AutomationRepository } from '../repositories/automation.repository';
import { ExecutionRepository } from '../repositories/execution.repository';
import { DeviceServiceClient } from '../clients/device-service.client';
import { WeatherServiceClient } from '../clients/weather-service.client';
import { NotificationServiceClient } from '../clients/notification-service.client';
import { RedisService } from './redis.service';
import { RabbitMQService } from './rabbitmq.service';

const logger = createLogger('AutomationEngine');

const EVALUATION_TIMEOUT = 100; // milliseconds
const EXECUTION_TIMEOUT = 30000; // 30 seconds

interface TriggerEvaluationContext {
  automation: Automation;
  trigger: Trigger;
  event?: any;
  deviceStates?: Map<string, DeviceState>;
  weather?: WeatherData;
  userLocations?: Map<string, any>;
}

interface ConditionEvaluationContext {
  automation: Automation;
  deviceStates: Map<string, DeviceState>;
  weather?: WeatherData;
  currentTime: Date;
  userLocations?: Map<string, any>;
}

export class AutomationEngineService {
  private automationRepository: AutomationRepository;
  private executionRepository: ExecutionRepository;
  private deviceClient: DeviceServiceClient;
  private weatherClient: WeatherServiceClient;
  private notificationClient: NotificationServiceClient;
  private redisService: RedisService;
  private rabbitMQService: RabbitMQService;
  
  private cronJobs: Map<string, cron.ScheduledTask>;
  private activeExecutions: Map<string, AutomationExecution>;
  private triggerSubscriptions: Map<string, Set<string>>;

  constructor() {
    this.automationRepository = new AutomationRepository();
    this.executionRepository = new ExecutionRepository();
    this.deviceClient = new DeviceServiceClient();
    this.weatherClient = new WeatherServiceClient();
    this.notificationClient = new NotificationServiceClient();
    this.redisService = new RedisService();
    this.rabbitMQService = new RabbitMQService();
    
    this.cronJobs = new Map();
    this.activeExecutions = new Map();
    this.triggerSubscriptions = new Map();

    this.initializeEventHandlers();
  }

  private async initializeEventHandlers(): Promise<void> {
    // Subscribe to device state changes
    await this.rabbitMQService.subscribe('device.state.changed', async (message) => {
      await this.handleDeviceStateChange(message.deviceId, message.state);
    });

    // Subscribe to location updates
    await this.rabbitMQService.subscribe('user.location.changed', async (message) => {
      await this.handleLocationChange(message.userId, message.location);
    });

    // Subscribe to weather updates
    await this.rabbitMQService.subscribe('weather.updated', async (message) => {
      await this.handleWeatherUpdate(message.homeId, message.weather);
    });
  }

  async createAutomation(automationData: Partial<Automation>): Promise<Automation> {
    // Validate automation
    this.validateAutomation(automationData);

    const automation: Automation = {
      id: uuidv4(),
      name: automationData.name!,
      description: automationData.description || '',
      homeId: automationData.homeId!,
      userId: automationData.userId!,
      enabled: automationData.enabled !== false,
      priority: automationData.priority || 0,
      triggers: automationData.triggers || [],
      conditions: automationData.conditions || [],
      actions: automationData.actions || [],
      mode: automationData.mode || 'single',
      maxExecutions: automationData.maxExecutions,
      cooldownPeriod: automationData.cooldownPeriod,
      createdAt: new Date(),
      updatedAt: new Date(),
      executionCount: 0,
      successCount: 0,
      failureCount: 0,
    };

    const created = await this.automationRepository.create(automation);

    // Register triggers
    await this.registerAutomationTriggers(created);

    logger.info(`Automation created: ${created.id} (${created.name})`);
    return created;
  }

  async getAutomation(automationId: string): Promise<Automation> {
    const automation = await this.automationRepository.findById(automationId);
    if (!automation) {
      throw new NotFoundError('Automation', automationId);
    }
    return automation;
  }

  async getAutomations(homeId: string, filters?: {
    enabled?: boolean;
    userId?: string;
  }): Promise<Automation[]> {
    return this.automationRepository.findByHomeId(homeId, filters);
  }

  async updateAutomation(automationId: string, updates: Partial<Automation>): Promise<Automation> {
    const automation = await this.getAutomation(automationId);

    // Validate updates
    if (updates.triggers || updates.conditions || updates.actions) {
      this.validateAutomation({ ...automation, ...updates });
    }

    // Unregister old triggers
    await this.unregisterAutomationTriggers(automation);

    const updated = await this.automationRepository.update(automationId, {
      ...updates,
      updatedAt: new Date(),
    });

    // Register new triggers
    await this.registerAutomationTriggers(updated);

    logger.info(`Automation updated: ${automationId}`);
    return updated;
  }

  async deleteAutomation(automationId: string): Promise<void> {
    const automation = await this.getAutomation(automationId);

    // Unregister triggers
    await this.unregisterAutomationTriggers(automation);

    await this.automationRepository.delete(automationId);

    logger.info(`Automation deleted: ${automationId}`);
  }

  async enableAutomation(automationId: string): Promise<Automation> {
    return this.updateAutomation(automationId, { enabled: true });
  }

  async disableAutomation(automationId: string): Promise<Automation> {
    return this.updateAutomation(automationId, { enabled: false });
  }

  async triggerAutomation(automationId: string, source: string = 'manual'): Promise<AutomationExecution> {
    const automation = await this.getAutomation(automationId);

    if (!automation.enabled) {
      throw new AutomationError('Automation is disabled', automationId);
    }

    return this.executeAutomation(automation, source);
  }

  private async registerAutomationTriggers(automation: Automation): Promise<void> {
    for (const trigger of automation.triggers) {
      if (!trigger.enabled) continue;

      switch (trigger.type) {
        case 'time':
          await this.registerTimeTrigger(automation, trigger);
          break;
        case 'device':
          await this.registerDeviceTrigger(automation, trigger);
          break;
        case 'sensor':
          await this.registerSensorTrigger(automation, trigger);
          break;
        case 'location':
          await this.registerLocationTrigger(automation, trigger);
          break;
        case 'weather':
          await this.registerWeatherTrigger(automation, trigger);
          break;
        case 'sunrise':
        case 'sunset':
          await this.registerSunTrigger(automation, trigger);
          break;
      }
    }
  }

  private async unregisterAutomationTriggers(automation: Automation): Promise<void> {
    for (const trigger of automation.triggers) {
      switch (trigger.type) {
        case 'time':
          this.unregisterTimeTrigger(automation.id);
          break;
        case 'device':
        case 'sensor':
        case 'location':
        case 'weather':
          this.unregisterSubscription(trigger.type, automation.id);
          break;
      }
    }
  }

  private async registerTimeTrigger(automation: Automation, trigger: Trigger): Promise<void> {
    const config = trigger.config as any;
    
    let cronExpression: string;
    if (config.cron) {
      cronExpression = config.cron;
    } else if (config.time) {
      const [hours, minutes] = config.time.split(':');
      const days = config.days || [0, 1, 2, 3, 4, 5, 6];
      cronExpression = `${minutes} ${hours} * * ${days.join(',')}`;
    } else {
      throw new ValidationError('Invalid time trigger configuration');
    }

    const job = cron.schedule(cronExpression, async () => {
      logger.debug(`Time trigger fired for automation: ${automation.id}`);
      await this.evaluateAndExecute(automation, trigger, {});
    });

    this.cronJobs.set(`${automation.id}:${trigger.id}`, job);
  }

  private unregisterTimeTrigger(automationId: string): void {
    for (const [key, job] of this.cronJobs.entries()) {
      if (key.startsWith(automationId)) {
        job.stop();
        this.cronJobs.delete(key);
      }
    }
  }

  private async registerDeviceTrigger(automation: Automation, trigger: Trigger): Promise<void> {
    const config = trigger.config as any;
    const subscriptionKey = `device:${config.deviceId}`;
    
    if (!this.triggerSubscriptions.has(subscriptionKey)) {
      this.triggerSubscriptions.set(subscriptionKey, new Set());
    }
    
    this.triggerSubscriptions.get(subscriptionKey)!.add(automation.id);
  }

  private async registerSensorTrigger(automation: Automation, trigger: Trigger): Promise<void> {
    const config = trigger.config as any;
    const subscriptionKey = `sensor:${config.sensorId}`;
    
    if (!this.triggerSubscriptions.has(subscriptionKey)) {
      this.triggerSubscriptions.set(subscriptionKey, new Set());
    }
    
    this.triggerSubscriptions.get(subscriptionKey)!.add(automation.id);
  }

  private async registerLocationTrigger(automation: Automation, trigger: Trigger): Promise<void> {
    const config = trigger.config as any;
    const subscriptionKey = `location:${config.userId}`;
    
    if (!this.triggerSubscriptions.has(subscriptionKey)) {
      this.triggerSubscriptions.set(subscriptionKey, new Set());
    }
    
    this.triggerSubscriptions.get(subscriptionKey)!.add(automation.id);
  }

  private async registerWeatherTrigger(automation: Automation, trigger: Trigger): Promise<void> {
    const subscriptionKey = `weather:${automation.homeId}`;
    
    if (!this.triggerSubscriptions.has(subscriptionKey)) {
      this.triggerSubscriptions.set(subscriptionKey, new Set());
    }
    
    this.triggerSubscriptions.get(subscriptionKey)!.add(automation.id);
  }

  private async registerSunTrigger(automation: Automation, trigger: Trigger): Promise<void> {
    // Sun triggers are calculated daily
    const subscriptionKey = `sun:${automation.homeId}`;
    
    if (!this.triggerSubscriptions.has(subscriptionKey)) {
      this.triggerSubscriptions.set(subscriptionKey, new Set());
    }
    
    this.triggerSubscriptions.get(subscriptionKey)!.add(automation.id);
  }

  private unregisterSubscription(type: string, automationId: string): void {
    for (const [key, automations] of this.triggerSubscriptions.entries()) {
      if (key.startsWith(type)) {
        automations.delete(automationId);
        if (automations.size === 0) {
          this.triggerSubscriptions.delete(key);
        }
      }
    }
  }

  private async handleDeviceStateChange(deviceId: string, state: DeviceState): Promise<void> {
    const subscriptionKey = `device:${deviceId}`;
    const automationIds = this.triggerSubscriptions.get(subscriptionKey);
    
    if (!automationIds || automationIds.size === 0) return;

    for (const automationId of automationIds) {
      try {
        const automation = await this.getAutomation(automationId);
        if (!automation.enabled) continue;

        const trigger = automation.triggers.find(
          t => t.type === 'device' && (t.config as any).deviceId === deviceId
        );

        if (trigger) {
          await this.evaluateAndExecute(automation, trigger, { deviceId, state });
        }
      } catch (error) {
        logger.error(`Error handling device state change for automation ${automationId}`, error as Error);
      }
    }
  }

  private async handleLocationChange(userId: string, location: any): Promise<void> {
    const subscriptionKey = `location:${userId}`;
    const automationIds = this.triggerSubscriptions.get(subscriptionKey);
    
    if (!automationIds || automationIds.size === 0) return;

    for (const automationId of automationIds) {
      try {
        const automation = await this.getAutomation(automationId);
        if (!automation.enabled) continue;

        const trigger = automation.triggers.find(
          t => t.type === 'location' && (t.config as any).userId === userId
        );

        if (trigger) {
          await this.evaluateAndExecute(automation, trigger, { userId, location });
        }
      } catch (error) {
        logger.error(`Error handling location change for automation ${automationId}`, error as Error);
      }
    }
  }

  private async handleWeatherUpdate(homeId: string, weather: WeatherData): Promise<void> {
    const subscriptionKey = `weather:${homeId}`;
    const automationIds = this.triggerSubscriptions.get(subscriptionKey);
    
    if (!automationIds || automationIds.size === 0) return;

    for (const automationId of automationIds) {
      try {
        const automation = await this.getAutomation(automationId);
        if (!automation.enabled) continue;

        const trigger = automation.triggers.find(t => t.type === 'weather');

        if (trigger) {
          await this.evaluateAndExecute(automation, trigger, { weather });
        }
      } catch (error) {
        logger.error(`Error handling weather update for automation ${automationId}`, error as Error);
      }
    }
  }

  private async evaluateAndExecute(
    automation: Automation,
    trigger: Trigger,
    event: any
  ): Promise<void> {
    const startTime = Date.now();

    try {
      // Evaluate trigger
      const triggerMatches = await this.evaluateTrigger({
        automation,
        trigger,
        event,
      });

      if (!triggerMatches) {
        logger.debug(`Trigger did not match for automation: ${automation.id}`);
        return;
      }

      // Evaluate conditions
      if (automation.conditions.length > 0) {
        const conditionsContext = await this.buildConditionContext(automation);
        const conditionsMet = await this.evaluateConditions(automation.conditions, conditionsContext);

        if (!conditionsMet) {
          logger.debug(`Conditions not met for automation: ${automation.id}`);
          return;
        }
      }

      const evaluationTime = Date.now() - startTime;
      if (evaluationTime > EVALUATION_TIMEOUT) {
        logger.warn(`Trigger evaluation took ${evaluationTime}ms for automation: ${automation.id}`);
      }

      // Check cooldown
      if (automation.cooldownPeriod) {
        const lastExecution = await this.redisService.get(`automation:${automation.id}:last_execution`);
        if (lastExecution) {
          const timeSinceLastExecution = Date.now() - parseInt(lastExecution);
          if (timeSinceLastExecution < automation.cooldownPeriod * 1000) {
            logger.debug(`Automation in cooldown: ${automation.id}`);
            return;
          }
        }
      }

      // Execute automation
      await this.executeAutomation(automation, `trigger:${trigger.id}`);

      // Update last execution time
      await this.redisService.setWithExpiry(
        `automation:${automation.id}:last_execution`,
        Date.now().toString(),
        automation.cooldownPeriod || 3600
      );
    } catch (error) {
      logger.error(`Error evaluating and executing automation ${automation.id}`, error as Error);
    }
  }

  private async evaluateTrigger(context: TriggerEvaluationContext): Promise<boolean> {
    const { trigger, event } = context;

    switch (trigger.type) {
      case 'time':
        return true; // Time triggers are handled by cron

      case 'device':
        return this.evaluateDeviceTrigger(trigger, event);

      case 'sensor':
        return this.evaluateSensorTrigger(trigger, event);

      case 'location':
        return this.evaluateLocationTrigger(trigger, event);

      case 'weather':
        return this.evaluateWeatherTrigger(trigger, event);

      default:
        return false;
    }
  }

  private evaluateDeviceTrigger(trigger: Trigger, event: any): boolean {
    const config = trigger.config as any;
    const state = event.state;

    if (!state || !state.attributes) return false;

    const value = state.attributes[config.attribute];
    return this.compareValues(value, config.operator, config.value);
  }

  private evaluateSensorTrigger(trigger: Trigger, event: any): boolean {
    const config = trigger.config as any;
    const value = event.value;

    return this.compareValues(value, config.operator, config.value);
  }

  private evaluateLocationTrigger(trigger: Trigger, event: any): boolean {
    const config = trigger.config as any;
    const location = event.location;

    // Implement geofence logic
    // This is a simplified version
    return config.event === 'enter' || config.event === 'exit';
  }

  private evaluateWeatherTrigger(trigger: Trigger, event: any): boolean {
    const config = trigger.config as any;
    const weather = event.weather;

    if (!weather) return false;

    let value: any;
    switch (config.condition) {
      case 'temperature':
        value = weather.temperature;
        break;
      case 'humidity':
        value = weather.humidity;
        break;
      case 'precipitation':
        value = weather.precipitation;
        break;
      case 'wind':
        value = weather.windSpeed;
        break;
      case 'condition':
        value = weather.condition;
        break;
      default:
        return false;
    }

    return this.compareValues(value, config.operator, config.value);
  }

  private async buildConditionContext(automation: Automation): Promise<ConditionEvaluationContext> {
    // Fetch device states
    const deviceStates = new Map<string, DeviceState>();
    // This would fetch actual device states from the device service
    
    // Fetch weather data
    const weather = await this.weatherClient.getCurrentWeather(automation.homeId);

    return {
      automation,
      deviceStates,
      weather,
      currentTime: new Date(),
    };
  }

  private async evaluateConditions(
    conditions: Condition[],
    context: ConditionEvaluationContext
  ): Promise<boolean> {
    // Implement condition evaluation logic
    // This is a simplified version
    for (const condition of conditions) {
      const result = await this.evaluateCondition(condition, context);
      
      if (condition.operator === 'not') {
        if (result) return false;
      } else if (condition.operator === 'and') {
        if (!result) return false;
      } else if (condition.operator === 'or') {
        if (result) return true;
      }
    }

    return true;
  }

  private async evaluateCondition(
    condition: Condition,
    context: ConditionEvaluationContext
  ): Promise<boolean> {
    // Implement specific condition evaluation
    return true;
  }

  private async executeAutomation(automation: Automation, triggeredBy: string): Promise<AutomationExecution> {
    // Check execution mode
    if (automation.mode === 'single') {
      const existingExecution = this.activeExecutions.get(automation.id);
      if (existingExecution && existingExecution.status === 'running') {
        logger.debug(`Automation already running: ${automation.id}`);
        return existingExecution;
      }
    }

    // Check max executions
    if (automation.maxExecutions && automation.executionCount >= automation.maxExecutions) {
      throw new AutomationError('Max executions reached', automation.id);
    }

    const execution: AutomationExecution = {
      id: uuidv4(),
      automationId: automation.id,
      triggeredBy,
      startedAt: new Date(),
      status: 'running',
      actions: automation.actions.map(action => ({
        actionId: action.id,
        status: 'pending',
      })),
    };

    await this.executionRepository.create(execution);
    this.activeExecutions.set(automation.id, execution);

    logger.info(`Executing automation: ${automation.id} (${automation.name})`);

    // Execute actions
    try {
      for (const action of automation.actions) {
        if (!action.enabled) continue;

        if (action.delay) {
          await this.delay(action.delay * 1000);
        }

        await this.executeAction(execution, action);
      }

      execution.status = 'completed';
      execution.completedAt = new Date();

      await this.automationRepository.update(automation.id, {
        executionCount: automation.executionCount + 1,
        successCount: automation.successCount + 1,
        lastExecuted: new Date(),
      });

      logger.info(`Automation completed: ${automation.id}`);
    } catch (error) {
      execution.status = 'failed';
      execution.completedAt = new Date();
      execution.error = (error as Error).message;

      await this.automationRepository.update(automation.id, {
        executionCount: automation.executionCount + 1,
        failureCount: automation.failureCount + 1,
        lastExecuted: new Date(),
      });

      logger.error(`Automation failed: ${automation.id}`, error as Error);
    } finally {
      await this.executionRepository.update(execution.id, execution);
      this.activeExecutions.delete(automation.id);
    }

    return execution;
  }

  private async executeAction(execution: AutomationExecution, action: Action): Promise<void> {
    const actionExecution = execution.actions.find(a => a.actionId === action.id);
    if (!actionExecution) return;

    actionExecution.status = 'running';
    actionExecution.startedAt = new Date();

    try {
      switch (action.type) {
        case 'device':
          await this.executeDeviceAction(action);
          break;
        case 'scene':
          await this.executeSceneAction(action);
          break;
        case 'notification':
          await this.executeNotificationAction(action);
          break;
        case 'webhook':
          await this.executeWebhookAction(action);
          break;
        case 'delay':
          await this.delay(action.parameters.duration * 1000);
          break;
      }

      actionExecution.status = 'completed';
      actionExecution.completedAt = new Date();
    } catch (error) {
      actionExecution.status = 'failed';
      actionExecution.completedAt = new Date();
      actionExecution.error = (error as Error).message;
      throw error;
    }
  }

  private async executeDeviceAction(action: Action): Promise<void> {
    const { target, parameters } = action;
    await this.deviceClient.sendCommand(target, parameters.command, parameters);
  }

  private async executeSceneAction(action: Action): Promise<void> {
    const { target } = action;
    // Activate scene via scene service
    logger.debug(`Activating scene: ${target}`);
  }

  private async executeNotificationAction(action: Action): Promise<void> {
    const { parameters } = action;
    await this.notificationClient.send({
      userId: parameters.userId,
      title: parameters.title,
      message: parameters.message,
      priority: parameters.priority || 'normal',
      channels: parameters.channels || ['push'],
    });
  }

  private async executeWebhookAction(action: Action): Promise<void> {
    const { target, parameters } = action;
    // Send webhook request
    logger.debug(`Sending webhook: ${target}`);
  }

  private compareValues(actual: any, operator: string, expected: any): boolean {
    switch (operator) {
      case 'eq':
        return actual === expected;
      case 'ne':
        return actual !== expected;
      case 'gt':
        return actual > expected;
      case 'lt':
        return actual < expected;
      case 'gte':
        return actual >= expected;
      case 'lte':
        return actual <= expected;
      case 'contains':
        return String(actual).includes(String(expected));
      default:
        return false;
    }
  }

  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  private validateAutomation(automation: Partial<Automation>): void {
    if (!automation.name) {
      throw new ValidationError('Automation name is required');
    }

    if (!automation.triggers || automation.triggers.length === 0) {
      throw new ValidationError('At least one trigger is required');
    }

    if (!automation.actions || automation.actions.length === 0) {
      throw new ValidationError('At least one action is required');
    }

    // Validate triggers
    for (const trigger of automation.triggers) {
      if (!trigger.type || !trigger.config) {
        throw new ValidationError('Invalid trigger configuration');
      }
    }

    // Validate actions
    for (const action of automation.actions) {
      if (!action.type || !action.target) {
        throw new ValidationError('Invalid action configuration');
      }
    }
  }

  async getExecutionHistory(automationId: string, limit: number = 50): Promise<AutomationExecution[]> {
    return this.executionRepository.findByAutomationId(automationId, limit);
  }
}
