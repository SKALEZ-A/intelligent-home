import { logger } from '../../../shared/utils/logger';
import { AutomationRepository } from '../repositories/automation.repository';
import { AutomationEngineService } from './automation-engine.service';

interface ScheduledTask {
  id: string;
  automationId: string;
  cronExpression: string;
  nextRun: Date;
  enabled: boolean;
}

export class SchedulerService {
  private tasks: Map<string, ScheduledTask> = new Map();
  private timers: Map<string, NodeJS.Timeout> = new Map();
  private checkInterval = 60000;

  constructor(
    private automationRepository: AutomationRepository,
    private automationEngine: AutomationEngineService
  ) {
    this.initialize();
  }

  private async initialize(): Promise<void> {
    await this.loadScheduledAutomations();
    this.startScheduler();
  }

  private async loadScheduledAutomations(): Promise<void> {
    try {
      const automations = await this.automationRepository.findByTriggerType('time');
      
      for (const automation of automations) {
        if (automation.enabled) {
          this.scheduleAutomation(automation.id, automation.triggers);
        }
      }

      logger.info('Scheduled automations loaded', { count: automations.length });
    } catch (error) {
      logger.error('Failed to load scheduled automations', { error });
    }
  }

  private startScheduler(): void {
    setInterval(() => {
      this.checkScheduledTasks();
    }, this.checkInterval);
  }

  private async checkScheduledTasks(): Promise<void> {
    const now = new Date();

    for (const [id, task] of this.tasks.entries()) {
      if (task.enabled && task.nextRun <= now) {
        await this.executeScheduledTask(task);
        this.updateNextRun(task);
      }
    }
  }

  private async executeScheduledTask(task: ScheduledTask): Promise<void> {
    try {
      logger.info('Executing scheduled automation', {
        automationId: task.automationId,
      });

      await this.automationEngine.executeAutomation(task.automationId, {
        trigger: 'scheduled',
        timestamp: new Date(),
      });
    } catch (error) {
      logger.error('Failed to execute scheduled automation', {
        automationId: task.automationId,
        error,
      });
    }
  }

  scheduleAutomation(automationId: string, triggers: any[]): void {
    const timeTriggers = triggers.filter(t => t.type === 'time');

    for (const trigger of timeTriggers) {
      const task: ScheduledTask = {
        id: this.generateTaskId(),
        automationId,
        cronExpression: trigger.cronExpression,
        nextRun: this.calculateNextRun(trigger.cronExpression),
        enabled: true,
      };

      this.tasks.set(task.id, task);
      logger.info('Automation scheduled', { automationId, taskId: task.id });
    }
  }

  unscheduleAutomation(automationId: string): void {
    for (const [id, task] of this.tasks.entries()) {
      if (task.automationId === automationId) {
        this.tasks.delete(id);
        const timer = this.timers.get(id);
        if (timer) {
          clearTimeout(timer);
          this.timers.delete(id);
        }
      }
    }

    logger.info('Automation unscheduled', { automationId });
  }

  private calculateNextRun(cronExpression: string): Date {
    const now = new Date();
    return new Date(now.getTime() + 60000);
  }

  private updateNextRun(task: ScheduledTask): void {
    task.nextRun = this.calculateNextRun(task.cronExpression);
  }

  private generateTaskId(): string {
    return `task_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  getScheduledTasks(): ScheduledTask[] {
    return Array.from(this.tasks.values());
  }

  getTasksByAutomation(automationId: string): ScheduledTask[] {
    return Array.from(this.tasks.values()).filter(
      t => t.automationId === automationId
    );
  }
}
