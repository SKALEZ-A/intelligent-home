import { EventEmitter } from 'events';

interface MaintenanceSchedule {
  id: string;
  deviceId: string;
  type: 'routine' | 'preventive' | 'corrective';
  frequency: number;
  lastMaintenance: number;
  nextMaintenance: number;
  tasks: MaintenanceTask[];
  priority: 'low' | 'medium' | 'high' | 'critical';
  estimatedDuration: number;
}

interface MaintenanceTask {
  id: string;
  name: string;
  description: string;
  completed: boolean;
  completedAt?: number;
  notes?: string;
}

interface MaintenanceRecord {
  id: string;
  scheduleId: string;
  deviceId: string;
  performedAt: number;
  performedBy?: string;
  tasks: MaintenanceTask[];
  duration: number;
  issues?: string[];
  nextScheduled: number;
}

export class DeviceMaintenanceSchedulerService extends EventEmitter {
  private schedules: Map<string, MaintenanceSchedule> = new Map();
  private records: MaintenanceRecord[] = [];

  public createSchedule(schedule: Omit<MaintenanceSchedule, 'id'>): MaintenanceSchedule {
    const fullSchedule: MaintenanceSchedule = {
      ...schedule,
      id: `sched_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
    };

    this.schedules.set(fullSchedule.id, fullSchedule);
    this.emit('scheduleCreated', fullSchedule);

    return fullSchedule;
  }

  public getUpcomingMaintenance(daysAhead: number = 7): MaintenanceSchedule[] {
    const cutoff = Date.now() + (daysAhead * 86400000);
    
    return Array.from(this.schedules.values())
      .filter(schedule => schedule.nextMaintenance <= cutoff)
      .sort((a, b) => a.nextMaintenance - b.nextMaintenance);
  }

  public getOverdueMaintenance(): MaintenanceSchedule[] {
    const now = Date.now();
    
    return Array.from(this.schedules.values())
      .filter(schedule => schedule.nextMaintenance < now)
      .sort((a, b) => a.nextMaintenance - b.nextMaintenance);
  }

  public recordMaintenance(
    scheduleId: string,
    performedBy: string,
    completedTasks: MaintenanceTask[],
    issues?: string[]
  ): MaintenanceRecord {
    const schedule = this.schedules.get(scheduleId);

    if (!schedule) {
      throw new Error('Schedule not found');
    }

    const now = Date.now();
    const nextScheduled = now + schedule.frequency;

    const record: MaintenanceRecord = {
      id: `rec_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      scheduleId,
      deviceId: schedule.deviceId,
      performedAt: now,
      performedBy,
      tasks: completedTasks,
      duration: schedule.estimatedDuration,
      issues,
      nextScheduled
    };

    this.records.push(record);

    schedule.lastMaintenance = now;
    schedule.nextMaintenance = nextScheduled;

    this.emit('maintenanceRecorded', record);

    return record;
  }

  public getDeviceMaintenanceHistory(deviceId: string): MaintenanceRecord[] {
    return this.records
      .filter(record => record.deviceId === deviceId)
      .sort((a, b) => b.performedAt - a.performedAt);
  }

  public getMaintenanceStats(deviceId: string): {
    totalMaintenance: number;
    averageDuration: number;
    issuesReported: number;
    lastMaintenance: number;
    nextMaintenance: number;
  } {
    const history = this.getDeviceMaintenanceHistory(deviceId);
    const schedule = Array.from(this.schedules.values())
      .find(s => s.deviceId === deviceId);

    const totalDuration = history.reduce((sum, r) => sum + r.duration, 0);
    const totalIssues = history.reduce((sum, r) => sum + (r.issues?.length || 0), 0);

    return {
      totalMaintenance: history.length,
      averageDuration: history.length > 0 ? totalDuration / history.length : 0,
      issuesReported: totalIssues,
      lastMaintenance: history[0]?.performedAt || 0,
      nextMaintenance: schedule?.nextMaintenance || 0
    };
  }

  public updateSchedule(scheduleId: string, updates: Partial<MaintenanceSchedule>): void {
    const schedule = this.schedules.get(scheduleId);

    if (schedule) {
      Object.assign(schedule, updates);
      this.emit('scheduleUpdated', schedule);
    }
  }

  public deleteSchedule(scheduleId: string): void {
    this.schedules.delete(scheduleId);
    this.emit('scheduleDeleted', scheduleId);
  }

  public generateMaintenanceReport(
    startDate: number,
    endDate: number
  ): {
    totalMaintenance: number;
    byType: { [type: string]: number };
    byPriority: { [priority: string]: number };
    averageDuration: number;
    issuesFound: number;
  } {
    const filtered = this.records.filter(
      r => r.performedAt >= startDate && r.performedAt <= endDate
    );

    const byType: { [type: string]: number } = {};
    const byPriority: { [priority: string]: number } = {};
    let totalDuration = 0;
    let totalIssues = 0;

    filtered.forEach(record => {
      const schedule = this.schedules.get(record.scheduleId);
      
      if (schedule) {
        byType[schedule.type] = (byType[schedule.type] || 0) + 1;
        byPriority[schedule.priority] = (byPriority[schedule.priority] || 0) + 1;
      }

      totalDuration += record.duration;
      totalIssues += record.issues?.length || 0;
    });

    return {
      totalMaintenance: filtered.length,
      byType,
      byPriority,
      averageDuration: filtered.length > 0 ? totalDuration / filtered.length : 0,
      issuesFound: totalIssues
    };
  }
}

export const maintenanceSchedulerService = new DeviceMaintenanceSchedulerService();
