import { logger } from '../../../shared/utils/logger';
import { DeviceRepository } from '../repositories/device.repository';
import { DeviceCommandService } from './device-command.service';

interface Schedule {
  id: string;
  deviceId: string;
  userId: string;
  name: string;
  command: any;
  cronExpression: string;
  timezone: string;
  enabled: boolean;
  startDate?: Date;
  endDate?: Date;
  conditions?: ScheduleCondition[];
  metadata?: Record<string, any>;
}

interface ScheduleCondition {
  type: 'weather' | 'occupancy' | 'energy_price' | 'device_state';
  operator: 'equals' | 'greater_than' | 'less_than' | 'contains';
  value: any;
  deviceId?: string;
}

interface ScheduleExecution {
  scheduleId: string;
  executedAt: Date;
  success: boolean;
  error?: string;
  duration: number;
}

export class DeviceSchedulingService {
  private schedules: Map<string, Schedule> = new Map();
  private scheduledJobs: Map<string, NodeJS.Timeout> = new Map();
  private executionHistory: ScheduleExecution[] = [];
  private maxHistorySize = 10000;

  constructor(
    private deviceRepository: DeviceRepository,
    private commandService: DeviceCommandService
  ) {
    this.initializeScheduler();
  }

  private initializeScheduler(): void {
    logger.info('Initializing device scheduling service');
    this.loadSchedulesFromDatabase();
    this.startScheduleProcessor();
  }

  private async loadSchedulesFromDatabase(): Promise<void> {
    try {
      // Load schedules from database
      logger.info('Loading schedules from database');
    } catch (error) {
      logger.error('Failed to load schedules', { error });
    }
  }

  private startScheduleProcessor(): void {
    setInterval(() => {
      this.processSchedules();
    }, 60000); // Check every minute
  }

  async createSchedule(schedule: Omit<Schedule, 'id'>): Promise<Schedule> {
    const newSchedule: Schedule = {
      ...schedule,
      id: this.generateScheduleId(),
    };

    this.schedules.set(newSchedule.id, newSchedule);
    
    if (newSchedule.enabled) {
      await this.activateSchedule(newSchedule.id);
    }

    logger.info('Schedule created', { scheduleId: newSchedule.id });
    return newSchedule;
  }

  async updateSchedule(scheduleId: string, updates: Partial<Schedule>): Promise<Schedule> {
    const schedule = this.schedules.get(scheduleId);
    if (!schedule) {
      throw new Error(`Schedule ${scheduleId} not found`);
    }

    const updatedSchedule = { ...schedule, ...updates };
    this.schedules.set(scheduleId, updatedSchedule);

    // Reactivate if enabled
    if (updatedSchedule.enabled) {
      await this.deactivateSchedule(scheduleId);
      await this.activateSchedule(scheduleId);
    } else {
      await this.deactivateSchedule(scheduleId);
    }

    logger.info('Schedule updated', { scheduleId });
    return updatedSchedule;
  }

  async deleteSchedule(scheduleId: string): Promise<void> {
    await this.deactivateSchedule(scheduleId);
    this.schedules.delete(scheduleId);
    logger.info('Schedule deleted', { scheduleId });
  }

  async activateSchedule(scheduleId: string): Promise<void> {
    const schedule = this.schedules.get(scheduleId);
    if (!schedule) {
      throw new Error(`Schedule ${scheduleId} not found`);
    }

    // Parse cron and set up job
    const nextExecution = this.calculateNextExecution(schedule.cronExpression);
    const delay = nextExecution.getTime() - Date.now();

    const job = setTimeout(async () => {
      await this.executeSchedule(scheduleId);
      // Reschedule
      await this.activateSchedule(scheduleId);
    }, delay);

    this.scheduledJobs.set(scheduleId, job);
    logger.info('Schedule activated', { scheduleId, nextExecution });
  }

  async deactivateSchedule(scheduleId: string): Promise<void> {
    const job = this.scheduledJobs.get(scheduleId);
    if (job) {
      clearTimeout(job);
      this.scheduledJobs.delete(scheduleId);
      logger.info('Schedule deactivated', { scheduleId });
    }
  }

  private async executeSchedule(scheduleId: string): Promise<void> {
    const schedule = this.schedules.get(scheduleId);
    if (!schedule || !schedule.enabled) {
      return;
    }

    const startTime = Date.now();
    let success = false;
    let error: string | undefined;

    try {
      // Check conditions
      if (schedule.conditions && schedule.conditions.length > 0) {
        const conditionsMet = await this.evaluateConditions(schedule.conditions);
        if (!conditionsMet) {
          logger.info('Schedule conditions not met', { scheduleId });
          return;
        }
      }

      // Check date range
      if (schedule.startDate && new Date() < schedule.startDate) {
        return;
      }
      if (schedule.endDate && new Date() > schedule.endDate) {
        await this.deactivateSchedule(scheduleId);
        return;
      }

      // Execute command
      await this.commandService.sendCommand(
        schedule.deviceId,
        schedule.command,
        schedule.userId
      );

      success = true;
      logger.info('Schedule executed successfully', { scheduleId });
    } catch (err: any) {
      error = err.message;
      logger.error('Schedule execution failed', { scheduleId, error });
    }

    // Record execution
    this.recordExecution({
      scheduleId,
      executedAt: new Date(),
      success,
      error,
      duration: Date.now() - startTime,
    });
  }

  private async evaluateConditions(conditions: ScheduleCondition[]): Promise<boolean> {
    for (const condition of conditions) {
      const result = await this.evaluateCondition(condition);
      if (!result) {
        return false;
      }
    }
    return true;
  }

  private async evaluateCondition(condition: ScheduleCondition): Promise<boolean> {
    switch (condition.type) {
      case 'device_state':
        if (!condition.deviceId) return false;
        const device = await this.deviceRepository.findById(condition.deviceId);
        if (!device) return false;
        return this.compareValues(device.state, condition.operator, condition.value);
      
      case 'weather':
        // Integration with weather service
        return true;
      
      case 'occupancy':
        // Integration with occupancy detection
        return true;
      
      case 'energy_price':
        // Integration with energy service
        return true;
      
      default:
        return true;
    }
  }

  private compareValues(actual: any, operator: string, expected: any): boolean {
    switch (operator) {
      case 'equals':
        return actual === expected;
      case 'greater_than':
        return actual > expected;
      case 'less_than':
        return actual < expected;
      case 'contains':
        return String(actual).includes(String(expected));
      default:
        return false;
    }
  }

  private calculateNextExecution(cronExpression: string): Date {
    // Simple cron parser - in production use a library like node-cron
    const now = new Date();
    const next = new Date(now.getTime() + 60000); // Next minute for simplicity
    return next;
  }

  private recordExecution(execution: ScheduleExecution): void {
    this.executionHistory.push(execution);
    
    // Maintain history size
    if (this.executionHistory.length > this.maxHistorySize) {
      this.executionHistory.shift();
    }
  }

  async getSchedule(scheduleId: string): Promise<Schedule | undefined> {
    return this.schedules.get(scheduleId);
  }

  async getSchedulesByDevice(deviceId: string): Promise<Schedule[]> {
    return Array.from(this.schedules.values()).filter(
      s => s.deviceId === deviceId
    );
  }

  async getSchedulesByUser(userId: string): Promise<Schedule[]> {
    return Array.from(this.schedules.values()).filter(
      s => s.userId === userId
    );
  }

  async getExecutionHistory(scheduleId: string, limit: number = 100): Promise<ScheduleExecution[]> {
    return this.executionHistory
      .filter(e => e.scheduleId === scheduleId)
      .slice(-limit);
  }

  private processSchedules(): void {
    // Periodic maintenance tasks
    this.cleanupExpiredSchedules();
    this.checkMissedExecutions();
  }

  private cleanupExpiredSchedules(): void {
    const now = new Date();
    for (const [id, schedule] of this.schedules.entries()) {
      if (schedule.endDate && schedule.endDate < now) {
        this.deleteSchedule(id);
      }
    }
  }

  private checkMissedExecutions(): void {
    // Check for schedules that should have run but didn't
    logger.debug('Checking for missed schedule executions');
  }

  private generateScheduleId(): string {
    return `schedule_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  async getScheduleStatistics(userId: string): Promise<any> {
    const userSchedules = await this.getSchedulesByUser(userId);
    const executions = this.executionHistory.filter(e =>
      userSchedules.some(s => s.id === e.scheduleId)
    );

    return {
      totalSchedules: userSchedules.length,
      activeSchedules: userSchedules.filter(s => s.enabled).length,
      totalExecutions: executions.length,
      successfulExecutions: executions.filter(e => e.success).length,
      failedExecutions: executions.filter(e => !e.success).length,
      averageExecutionTime: executions.reduce((sum, e) => sum + e.duration, 0) / executions.length || 0,
    };
  }
}
