import { logger } from '../utils/logger';

export enum AuditAction {
  CREATE = 'CREATE',
  READ = 'READ',
  UPDATE = 'UPDATE',
  DELETE = 'DELETE',
  LOGIN = 'LOGIN',
  LOGOUT = 'LOGOUT',
  EXECUTE = 'EXECUTE',
  CONFIGURE = 'CONFIGURE'
}

export enum AuditResource {
  USER = 'USER',
  DEVICE = 'DEVICE',
  AUTOMATION = 'AUTOMATION',
  SCENE = 'SCENE',
  HOME = 'HOME',
  ENERGY = 'ENERGY',
  NOTIFICATION = 'NOTIFICATION',
  SYSTEM = 'SYSTEM'
}

interface AuditEntry {
  id: string;
  timestamp: Date;
  userId: string;
  action: AuditAction;
  resource: AuditResource;
  resourceId: string;
  details?: Record<string, any>;
  ipAddress?: string;
  userAgent?: string;
  success: boolean;
  errorMessage?: string;
}

export class AuditLogService {
  private logs: AuditEntry[] = [];
  private readonly maxLogs = 10000;

  public async log(entry: Omit<AuditEntry, 'id' | 'timestamp'>): Promise<void> {
    const auditEntry: AuditEntry = {
      id: this.generateId(),
      timestamp: new Date(),
      ...entry
    };

    this.logs.push(auditEntry);

    if (this.logs.length > this.maxLogs) {
      this.logs.shift();
    }

    logger.info('Audit log entry created', {
      action: entry.action,
      resource: entry.resource,
      userId: entry.userId,
      success: entry.success
    });

    // In production, this would write to a database
    await this.persistLog(auditEntry);
  }

  public async query(filters: {
    userId?: string;
    action?: AuditAction;
    resource?: AuditResource;
    startDate?: Date;
    endDate?: Date;
    success?: boolean;
    limit?: number;
  }): Promise<AuditEntry[]> {
    let results = [...this.logs];

    if (filters.userId) {
      results = results.filter(log => log.userId === filters.userId);
    }

    if (filters.action) {
      results = results.filter(log => log.action === filters.action);
    }

    if (filters.resource) {
      results = results.filter(log => log.resource === filters.resource);
    }

    if (filters.startDate) {
      results = results.filter(log => log.timestamp >= filters.startDate!);
    }

    if (filters.endDate) {
      results = results.filter(log => log.timestamp <= filters.endDate!);
    }

    if (filters.success !== undefined) {
      results = results.filter(log => log.success === filters.success);
    }

    results.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());

    if (filters.limit) {
      results = results.slice(0, filters.limit);
    }

    return results;
  }

  public async getRecentActivity(userId: string, limit: number = 50): Promise<AuditEntry[]> {
    return this.query({ userId, limit });
  }

  public async getFailedAttempts(userId: string, hours: number = 24): Promise<AuditEntry[]> {
    const startDate = new Date(Date.now() - hours * 3600000);
    return this.query({ userId, success: false, startDate });
  }

  public async getResourceHistory(resource: AuditResource, resourceId: string): Promise<AuditEntry[]> {
    return this.logs.filter(
      log => log.resource === resource && log.resourceId === resourceId
    ).sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
  }

  public async getStatistics(startDate: Date, endDate: Date): Promise<any> {
    const logs = await this.query({ startDate, endDate });

    const stats = {
      total: logs.length,
      successful: logs.filter(l => l.success).length,
      failed: logs.filter(l => !l.success).length,
      byAction: {} as Record<string, number>,
      byResource: {} as Record<string, number>,
      byUser: {} as Record<string, number>
    };

    logs.forEach(log => {
      stats.byAction[log.action] = (stats.byAction[log.action] || 0) + 1;
      stats.byResource[log.resource] = (stats.byResource[log.resource] || 0) + 1;
      stats.byUser[log.userId] = (stats.byUser[log.userId] || 0) + 1;
    });

    return stats;
  }

  private generateId(): string {
    return `audit_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private async persistLog(entry: AuditEntry): Promise<void> {
    // In production, write to database
    // For now, just log to console in development
    if (process.env.NODE_ENV === 'development') {
      logger.debug('Audit entry', entry);
    }
  }

  public async exportLogs(startDate: Date, endDate: Date, format: 'json' | 'csv' = 'json'): Promise<string> {
    const logs = await this.query({ startDate, endDate });

    if (format === 'json') {
      return JSON.stringify(logs, null, 2);
    }

    // CSV format
    const headers = ['ID', 'Timestamp', 'User ID', 'Action', 'Resource', 'Resource ID', 'Success'];
    const rows = logs.map(log => [
      log.id,
      log.timestamp.toISOString(),
      log.userId,
      log.action,
      log.resource,
      log.resourceId,
      log.success.toString()
    ]);

    return [headers, ...rows].map(row => row.join(',')).join('\n');
  }
}

export const auditLogService = new AuditLogService();
