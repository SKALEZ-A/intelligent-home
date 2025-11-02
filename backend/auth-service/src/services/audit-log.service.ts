import { RedisService } from './redis.service';
import { logger } from '../../../shared/utils/logger';

export enum AuditEventType {
  LOGIN = 'LOGIN',
  LOGOUT = 'LOGOUT',
  LOGIN_FAILED = 'LOGIN_FAILED',
  PASSWORD_CHANGED = 'PASSWORD_CHANGED',
  PASSWORD_RESET_REQUESTED = 'PASSWORD_RESET_REQUESTED',
  PASSWORD_RESET_COMPLETED = 'PASSWORD_RESET_COMPLETED',
  TWO_FACTOR_ENABLED = 'TWO_FACTOR_ENABLED',
  TWO_FACTOR_DISABLED = 'TWO_FACTOR_DISABLED',
  TWO_FACTOR_VERIFIED = 'TWO_FACTOR_VERIFIED',
  TWO_FACTOR_FAILED = 'TWO_FACTOR_FAILED',
  ACCOUNT_CREATED = 'ACCOUNT_CREATED',
  ACCOUNT_DELETED = 'ACCOUNT_DELETED',
  ACCOUNT_LOCKED = 'ACCOUNT_LOCKED',
  ACCOUNT_UNLOCKED = 'ACCOUNT_UNLOCKED',
  EMAIL_VERIFIED = 'EMAIL_VERIFIED',
  PROFILE_UPDATED = 'PROFILE_UPDATED',
  SESSION_CREATED = 'SESSION_CREATED',
  SESSION_DESTROYED = 'SESSION_DESTROYED',
  PERMISSION_GRANTED = 'PERMISSION_GRANTED',
  PERMISSION_REVOKED = 'PERMISSION_REVOKED',
}

export interface AuditLogEntry {
  id: string;
  userId: string;
  eventType: AuditEventType;
  timestamp: Date;
  ipAddress: string;
  userAgent: string;
  metadata?: Record<string, any>;
  success: boolean;
  errorMessage?: string;
}

export class AuditLogService {
  private redisService: RedisService;
  private readonly AUDIT_LOG_PREFIX = 'audit:';
  private readonly USER_AUDIT_PREFIX = 'user:audit:';
  private readonly MAX_LOGS_PER_USER = 1000;

  constructor() {
    this.redisService = new RedisService();
  }

  async logEvent(
    userId: string,
    eventType: AuditEventType,
    ipAddress: string,
    userAgent: string,
    success: boolean,
    metadata?: Record<string, any>,
    errorMessage?: string
  ): Promise<void> {
    const logEntry: AuditLogEntry = {
      id: this.generateLogId(),
      userId,
      eventType,
      timestamp: new Date(),
      ipAddress,
      userAgent,
      metadata,
      success,
      errorMessage,
    };

    // Store in Redis with TTL of 90 days
    await this.redisService.set(
      `${this.AUDIT_LOG_PREFIX}${logEntry.id}`,
      JSON.stringify(logEntry),
      90 * 24 * 60 * 60
    );

    // Add to user's audit log list
    await this.redisService.addToList(
      `${this.USER_AUDIT_PREFIX}${userId}`,
      logEntry.id
    );

    // Trim list to max size
    await this.redisService.trimList(
      `${this.USER_AUDIT_PREFIX}${userId}`,
      0,
      this.MAX_LOGS_PER_USER - 1
    );

    logger.info(`Audit log created`, {
      userId,
      eventType,
      success,
      logId: logEntry.id,
    });
  }

  async getUserAuditLogs(
    userId: string,
    limit: number = 50,
    offset: number = 0
  ): Promise<AuditLogEntry[]> {
    const logIds = await this.redisService.getListRange(
      `${this.USER_AUDIT_PREFIX}${userId}`,
      offset,
      offset + limit - 1
    );

    const logs: AuditLogEntry[] = [];
    for (const logId of logIds) {
      const logData = await this.redisService.get(`${this.AUDIT_LOG_PREFIX}${logId}`);
      if (logData) {
        logs.push(JSON.parse(logData));
      }
    }

    return logs;
  }

  async getRecentFailedLogins(userId: string, limit: number = 10): Promise<AuditLogEntry[]> {
    const allLogs = await this.getUserAuditLogs(userId, 100);
    return allLogs
      .filter(
        (log) =>
          (log.eventType === AuditEventType.LOGIN_FAILED ||
            log.eventType === AuditEventType.TWO_FACTOR_FAILED) &&
          !log.success
      )
      .slice(0, limit);
  }

  async getLoginHistory(userId: string, limit: number = 20): Promise<AuditLogEntry[]> {
    const allLogs = await this.getUserAuditLogs(userId, 100);
    return allLogs
      .filter(
        (log) =>
          log.eventType === AuditEventType.LOGIN ||
          log.eventType === AuditEventType.LOGOUT
      )
      .slice(0, limit);
  }

  async getSecurityEvents(userId: string, limit: number = 50): Promise<AuditLogEntry[]> {
    const allLogs = await this.getUserAuditLogs(userId, 200);
    const securityEvents = [
      AuditEventType.PASSWORD_CHANGED,
      AuditEventType.PASSWORD_RESET_REQUESTED,
      AuditEventType.PASSWORD_RESET_COMPLETED,
      AuditEventType.TWO_FACTOR_ENABLED,
      AuditEventType.TWO_FACTOR_DISABLED,
      AuditEventType.ACCOUNT_LOCKED,
      AuditEventType.ACCOUNT_UNLOCKED,
    ];

    return allLogs.filter((log) => securityEvents.includes(log.eventType)).slice(0, limit);
  }

  async countFailedLoginAttempts(
    userId: string,
    timeWindowMinutes: number = 15
  ): Promise<number> {
    const allLogs = await this.getUserAuditLogs(userId, 50);
    const cutoffTime = new Date(Date.now() - timeWindowMinutes * 60 * 1000);

    return allLogs.filter(
      (log) =>
        log.eventType === AuditEventType.LOGIN_FAILED &&
        new Date(log.timestamp) > cutoffTime
    ).length;
  }

  async hasRecentSuccessfulLogin(
    userId: string,
    timeWindowMinutes: number = 5
  ): Promise<boolean> {
    const allLogs = await this.getUserAuditLogs(userId, 20);
    const cutoffTime = new Date(Date.now() - timeWindowMinutes * 60 * 1000);

    return allLogs.some(
      (log) =>
        log.eventType === AuditEventType.LOGIN &&
        log.success &&
        new Date(log.timestamp) > cutoffTime
    );
  }

  private generateLogId(): string {
    return `${Date.now()}-${Math.random().toString(36).substring(2, 15)}`;
  }

  async deleteUserAuditLogs(userId: string): Promise<void> {
    const logIds = await this.redisService.getListRange(
      `${this.USER_AUDIT_PREFIX}${userId}`,
      0,
      -1
    );

    for (const logId of logIds) {
      await this.redisService.delete(`${this.AUDIT_LOG_PREFIX}${logId}`);
    }

    await this.redisService.delete(`${this.USER_AUDIT_PREFIX}${userId}`);
    logger.info(`Audit logs deleted for user ${userId}`);
  }
}
