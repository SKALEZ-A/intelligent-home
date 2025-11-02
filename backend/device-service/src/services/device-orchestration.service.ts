import { EventEmitter } from 'events';
import { logger } from '../../../shared/utils/logger';

interface DeviceAction {
  deviceId: string;
  action: string;
  parameters: Record<string, any>;
  priority: number;
  timeout: number;
  retryCount: number;
}

interface OrchestrationTask {
  id: string;
  name: string;
  actions: DeviceAction[];
  status: 'pending' | 'running' | 'completed' | 'failed' | 'cancelled';
  startedAt?: Date;
  completedAt?: Date;
  results: Map<string, any>;
  errors: Map<string, Error>;
  dependencies?: string[];
  parallel: boolean;
}

interface OrchestrationRule {
  id: string;
  name: string;
  condition: (context: any) => boolean;
  actions: DeviceAction[];
  enabled: boolean;
  priority: number;
}

export class DeviceOrchestrationService extends EventEmitter {
  private tasks: Map<string, OrchestrationTask> = new Map();
  private rules: Map<string, OrchestrationRule> = new Map();
  private executionQueue: OrchestrationTask[] = [];
  private isProcessing = false;
  private readonly maxConcurrentTasks = 5;
  private activeTasks = 0;

  constructor() {
    super();
    this.initializeDefaultRules();
    this.startQueueProcessor();
  }

  private initializeDefaultRules(): void {
    // Morning routine rule
    this.addRule({
      id: 'morning_routine',
      name: 'Morning Routine',
      condition: (context) => {
        const hour = new Date().getHours();
        return hour >= 6 && hour < 9 && context.userPresent;
      },
      actions: [
        {
          deviceId: 'lights_bedroom',
          action: 'turnOn',
          parameters: { brightness: 30 },
          priority: 1,
          timeout: 5000,
          retryCount: 2
        },
        {
          deviceId: 'thermostat_main',
          action: 'setTemperature',
          parameters: { temperature: 22 },
          priority: 1,
          timeout: 5000,
          retryCount: 2
        },
        {
          deviceId: 'coffee_maker',
          action: 'brew',
          parameters: { strength: 'medium' },
          priority: 2,
          timeout: 10000,
          retryCount: 1
        }
      ],
      enabled: true,
      priority: 1
    });

    // Away mode rule
    this.addRule({
      id: 'away_mode',
      name: 'Away Mode',
      condition: (context) => !context.userPresent && context.awayModeEnabled,
      actions: [
        {
          deviceId: 'all_lights',
          action: 'turnOff',
          parameters: {},
          priority: 1,
          timeout: 5000,
          retryCount: 2
        },
        {
          deviceId: 'thermostat_main',
          action: 'setMode',
          parameters: { mode: 'away' },
          priority: 1,
          timeout: 5000,
          retryCount: 2
        },
        {
          deviceId: 'security_system',
          action: 'arm',
          parameters: { mode: 'away' },
          priority: 0,
          timeout: 10000,
          retryCount: 3
        }
      ],
      enabled: true,
      priority: 0
    });
  }

  async createTask(
    name: string,
    actions: DeviceAction[],
    options: {
      parallel?: boolean;
      dependencies?: string[];
    } = {}
  ): Promise<string> {
    const task: OrchestrationTask = {
      id: this.generateTaskId(),
      name,
      actions: actions.sort((a, b) => a.priority - b.priority),
      status: 'pending',
      results: new Map(),
      errors: new Map(),
      dependencies: options.dependencies,
      parallel: options.parallel || false
    };

    this.tasks.set(task.id, task);
    this.executionQueue.push(task);
    
    logger.info(`Created orchestration task: ${task.id} - ${name}`);
    this.emit('taskCreated', task);

    // Start processing if not already running
    if (!this.isProcessing) {
      this.processQueue();
    }

    return task.id;
  }

  private async processQueue(): Promise<void> {
    if (this.isProcessing || this.executionQueue.length === 0) {
      return;
    }

    this.isProcessing = true;

    while (this.executionQueue.length > 0 && this.activeTasks < this.maxConcurrentTasks) {
      const task = this.executionQueue.shift();
      if (!task) continue;

      // Check dependencies
      if (task.dependencies && !this.areDependenciesMet(task.dependencies)) {
        this.executionQueue.push(task); // Re-queue
        continue;
      }

      this.activeTasks++;
      this.executeTask(task).finally(() => {
        this.activeTasks--;
        if (this.executionQueue.length > 0) {
          this.processQueue();
        }
      });
    }

    this.isProcessing = false;
  }

  private areDependenciesMet(dependencies: string[]): boolean {
    return dependencies.every(depId => {
      const depTask = this.tasks.get(depId);
      return depTask && depTask.status === 'completed';
    });
  }

  private async executeTask(task: OrchestrationTask): Promise<void> {
    task.status = 'running';
    task.startedAt = new Date();
    this.tasks.set(task.id, task);
    
    logger.info(`Executing orchestration task: ${task.id}`);
    this.emit('taskStarted', task);

    try {
      if (task.parallel) {
        await this.executeActionsParallel(task);
      } else {
        await this.executeActionsSequential(task);
      }

      task.status = 'completed';
      task.completedAt = new Date();
      
      logger.info(`Completed orchestration task: ${task.id}`);
      this.emit('taskCompleted', task);
    } catch (error) {
      task.status = 'failed';
      task.completedAt = new Date();
      
      logger.error(`Failed orchestration task: ${task.id}`, error);
      this.emit('taskFailed', task, error);
    }

    this.tasks.set(task.id, task);
  }

  private async executeActionsSequential(task: OrchestrationTask): Promise<void> {
    for (const action of task.actions) {
      try {
        const result = await this.executeAction(action);
        task.results.set(action.deviceId, result);
        this.emit('actionCompleted', task.id, action, result);
      } catch (error) {
        task.errors.set(action.deviceId, error as Error);
        this.emit('actionFailed', task.id, action, error);
        
        // Continue with other actions even if one fails
        logger.warn(`Action failed for device ${action.deviceId}:`, error);
      }
    }
  }

  private async executeActionsParallel(task: OrchestrationTask): Promise<void> {
    const promises = task.actions.map(async (action) => {
      try {
        const result = await this.executeAction(action);
        task.results.set(action.deviceId, result);
        this.emit('actionCompleted', task.id, action, result);
        return { success: true, action, result };
      } catch (error) {
        task.errors.set(action.deviceId, error as Error);
        this.emit('actionFailed', task.id, action, error);
        return { success: false, action, error };
      }
    });

    await Promise.allSettled(promises);
  }

  private async executeAction(action: DeviceAction): Promise<any> {
    let lastError: Error | null = null;
    
    for (let attempt = 0; attempt <= action.retryCount; attempt++) {
      try {
        // Simulate device action execution
        // In real implementation, this would call the actual device service
        const result = await this.performDeviceAction(action);
        
        if (attempt > 0) {
          logger.info(`Action succeeded on retry ${attempt} for device ${action.deviceId}`);
        }
        
        return result;
      } catch (error) {
        lastError = error as Error;
        
        if (attempt < action.retryCount) {
          const delay = Math.pow(2, attempt) * 1000; // Exponential backoff
          logger.warn(`Action failed for device ${action.deviceId}, retrying in ${delay}ms...`);
          await new Promise(resolve => setTimeout(resolve, delay));
        }
      }
    }

    throw lastError || new Error('Action failed after all retries');
  }

  private async performDeviceAction(action: DeviceAction): Promise<any> {
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error(`Action timeout for device ${action.deviceId}`));
      }, action.timeout);

      // Simulate async device operation
      setTimeout(() => {
        clearTimeout(timeout);
        resolve({
          deviceId: action.deviceId,
          action: action.action,
          status: 'success',
          timestamp: new Date()
        });
      }, Math.random() * 1000);
    });
  }

  addRule(rule: OrchestrationRule): void {
    this.rules.set(rule.id, rule);
    logger.info(`Added orchestration rule: ${rule.id} - ${rule.name}`);
  }

  removeRule(ruleId: string): void {
    this.rules.delete(ruleId);
    logger.info(`Removed orchestration rule: ${ruleId}`);
  }

  enableRule(ruleId: string): void {
    const rule = this.rules.get(ruleId);
    if (rule) {
      rule.enabled = true;
      this.rules.set(ruleId, rule);
    }
  }

  disableRule(ruleId: string): void {
    const rule = this.rules.get(ruleId);
    if (rule) {
      rule.enabled = false;
      this.rules.set(ruleId, rule);
    }
  }

  async evaluateRules(context: any): Promise<string[]> {
    const triggeredTasks: string[] = [];
    const sortedRules = Array.from(this.rules.values())
      .filter(rule => rule.enabled)
      .sort((a, b) => a.priority - b.priority);

    for (const rule of sortedRules) {
      try {
        if (rule.condition(context)) {
          const taskId = await this.createTask(
            `Rule: ${rule.name}`,
            rule.actions,
            { parallel: true }
          );
          triggeredTasks.push(taskId);
          logger.info(`Rule triggered: ${rule.name}`);
        }
      } catch (error) {
        logger.error(`Error evaluating rule ${rule.id}:`, error);
      }
    }

    return triggeredTasks;
  }

  getTask(taskId: string): OrchestrationTask | undefined {
    return this.tasks.get(taskId);
  }

  getActiveTasks(): OrchestrationTask[] {
    return Array.from(this.tasks.values())
      .filter(task => task.status === 'running' || task.status === 'pending');
  }

  async cancelTask(taskId: string): Promise<void> {
    const task = this.tasks.get(taskId);
    if (!task) {
      throw new Error(`Task ${taskId} not found`);
    }

    if (task.status === 'running' || task.status === 'pending') {
      task.status = 'cancelled';
      task.completedAt = new Date();
      this.tasks.set(taskId, task);
      
      // Remove from queue if pending
      const queueIndex = this.executionQueue.findIndex(t => t.id === taskId);
      if (queueIndex !== -1) {
        this.executionQueue.splice(queueIndex, 1);
      }
      
      logger.info(`Cancelled task: ${taskId}`);
      this.emit('taskCancelled', task);
    }
  }

  private startQueueProcessor(): void {
    setInterval(() => {
      if (!this.isProcessing && this.executionQueue.length > 0) {
        this.processQueue();
      }
    }, 1000);
  }

  private generateTaskId(): string {
    return `task_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  getStatistics(): {
    totalTasks: number;
    completedTasks: number;
    failedTasks: number;
    activeTasks: number;
    queuedTasks: number;
    averageExecutionTime: number;
  } {
    const tasks = Array.from(this.tasks.values());
    const completedTasks = tasks.filter(t => t.status === 'completed');
    const totalExecutionTime = completedTasks.reduce((sum, task) => {
      if (task.startedAt && task.completedAt) {
        return sum + (task.completedAt.getTime() - task.startedAt.getTime());
      }
      return sum;
    }, 0);

    return {
      totalTasks: tasks.length,
      completedTasks: completedTasks.length,
      failedTasks: tasks.filter(t => t.status === 'failed').length,
      activeTasks: tasks.filter(t => t.status === 'running').length,
      queuedTasks: this.executionQueue.length,
      averageExecutionTime: completedTasks.length > 0 ? totalExecutionTime / completedTasks.length : 0
    };
  }
}

export const deviceOrchestrationService = new DeviceOrchestrationService();
