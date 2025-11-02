import { EventEmitter } from 'events';
import { logger } from '../../../shared/utils/logger';

interface SecurityEvent {
  id: string;
  type: SecurityEventType;
  severity: 'low' | 'medium' | 'high' | 'critical';
  userId?: string;
  ipAddress: string;
  userAgent: string;
  timestamp: Date;
  details: Record<string, any>;
  resolved: boolean;
  resolvedAt?: Date;
  resolvedBy?: string;
}

enum SecurityEventType {
  FAILED_LOGIN = 'failed_login',
  SUSPICIOUS_ACTIVITY = 'suspicious_activity',
  BRUTE_FORCE_ATTEMPT = 'brute_force_attempt',
  ACCOUNT_LOCKOUT = 'account_lockout',
  PASSWORD_CHANGE = 'password_change',
  MFA_DISABLED = 'mfa_disabled',
  PRIVILEGE_ESCALATION = 'privilege_escalation',
  UNAUTHORIZED_ACCESS = 'unauthorized_access',
  DATA_BREACH_ATTEMPT = 'data_breach_attempt',
  MALICIOUS_PAYLOAD = 'malicious_payload',
  SESSION_HIJACKING = 'session_hijacking',
  TOKEN_THEFT = 'token_theft'
}

interface SecurityMetrics {
  totalEvents: number;
  eventsByType: Record<string, number>;
  eventsBySeverity: Record<string, number>;
  unresolvedEvents: number;
  averageResolutionTime: number;
  topThreats: Array<{ type: string; count: number }>;
}

export class SecurityAuditService extends EventEmitter {
  private events: Map<string, SecurityEvent> = new Map();
  private failedLoginAttempts: Map<string, number> = new Map();
  private suspiciousIPs: Set<string> = new Set();
  private readonly maxFailedAttempts = 5;
  private readonly suspiciousActivityWindow = 300000; // 5 minutes

  constructor() {
    super();
    this.initializeMonitoring();
  }

  private initializeMonitoring(): void {
    // Clean up old events periodically
    setInterval(() => {
      this.cleanupOldEvents();
    }, 3600000); // Every hour
  }

  async logSecurityEvent(event: Omit<SecurityEvent, 'id' | 'timestamp' | 'resolved'>): Promise<string> {
    const securityEvent: SecurityEvent = {
      ...event,
      id: this.generateEventId(),
      timestamp: new Date(),
      resolved: false
    };

    this.events.set(securityEvent.id, securityEvent);
    
    // Emit event for real-time monitoring
    this.emit('securityEvent', securityEvent);

    // Log based on severity
    const logMessage = `Security Event [${securityEvent.severity.toUpperCase()}]: ${securityEvent.type}`;
    switch (securityEvent.severity) {
      case 'critical':
        logger.error(logMessage, securityEvent.details);
        this.emit('criticalEvent', securityEvent);
        break;
      case 'high':
        logger.warn(logMessage, securityEvent.details);
        break;
      default:
        logger.info(logMessage, securityEvent.details);
    }

    // Take automated actions based on event type
    await this.handleSecurityEvent(securityEvent);

    return securityEvent.id;
  }

  private async handleSecurityEvent(event: SecurityEvent): Promise<void> {
    switch (event.type) {
      case SecurityEventType.FAILED_LOGIN:
        await this.handleFailedLogin(event);
        break;
      case SecurityEventType.BRUTE_FORCE_ATTEMPT:
        await this.handleBruteForce(event);
        break;
      case SecurityEventType.SUSPICIOUS_ACTIVITY:
        await this.handleSuspiciousActivity(event);
        break;
      case SecurityEventType.SESSION_HIJACKING:
        await this.handleSessionHijacking(event);
        break;
    }
  }

  private async handleFailedLogin(event: SecurityEvent): Promise<void> {
    const key = `${event.userId || 'unknown'}:${event.ipAddress}`;
    const attempts = (this.failedLoginAttempts.get(key) || 0) + 1;
    this.failedLoginAttempts.set(key, attempts);

    if (attempts >= this.maxFailedAttempts) {
      await this.logSecurityEvent({
        type: SecurityEventType.BRUTE_FORCE_ATTEMPT,
        severity: 'high',
        userId: event.userId,
        ipAddress: event.ipAddress,
        userAgent: event.userAgent,
        details: {
          attempts,
          originalEvent: event.id
        }
      });

      // Clear attempts after detection
      this.failedLoginAttempts.delete(key);
    }

    // Auto-clear after window
    setTimeout(() => {
      this.failedLoginAttempts.delete(key);
    }, this.suspiciousActivityWindow);
  }

  private async handleBruteForce(event: SecurityEvent): Promise<void> {
    this.suspiciousIPs.add(event.ipAddress);
    
    // Notify security team
    this.emit('bruteForceDetected', {
      ipAddress: event.ipAddress,
      userId: event.userId,
      attempts: event.details.attempts
    });

    logger.error(`Brute force attack detected from IP: ${event.ipAddress}`);
  }

  private async handleSuspiciousActivity(event: SecurityEvent): Promise<void> {
    const recentEvents = this.getRecentEventsByIP(event.ipAddress, 600000); // 10 minutes
    
    if (recentEvents.length > 10) {
      await this.logSecurityEvent({
        type: SecurityEventType.SUSPICIOUS_ACTIVITY,
        severity: 'high',
        userId: event.userId,
        ipAddress: event.ipAddress,
        userAgent: event.userAgent,
        details: {
          recentEventCount: recentEvents.length,
          pattern: 'high_frequency_activity'
        }
      });
    }
  }

  private async handleSessionHijacking(event: SecurityEvent): Promise<void> {
    // Immediately invalidate all sessions for the user
    this.emit('invalidateUserSessions', event.userId);
    
    // Force password reset
    this.emit('forcePasswordReset', event.userId);
    
    logger.error(`Session hijacking detected for user: ${event.userId}`);
  }

  async resolveEvent(eventId: string, resolvedBy: string, notes?: string): Promise<void> {
    const event = this.events.get(eventId);
    if (!event) {
      throw new Error(`Security event ${eventId} not found`);
    }

    event.resolved = true;
    event.resolvedAt = new Date();
    event.resolvedBy = resolvedBy;
    if (notes) {
      event.details.resolutionNotes = notes;
    }

    this.events.set(eventId, event);
    this.emit('eventResolved', event);
    
    logger.info(`Security event ${eventId} resolved by ${resolvedBy}`);
  }

  getEvent(eventId: string): SecurityEvent | undefined {
    return this.events.get(eventId);
  }

  getRecentEvents(limit: number = 100): SecurityEvent[] {
    return Array.from(this.events.values())
      .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime())
      .slice(0, limit);
  }

  getRecentEventsByIP(ipAddress: string, timeWindowMs: number): SecurityEvent[] {
    const cutoff = Date.now() - timeWindowMs;
    return Array.from(this.events.values())
      .filter(event => 
        event.ipAddress === ipAddress && 
        event.timestamp.getTime() > cutoff
      );
  }

  getUnresolvedEvents(): SecurityEvent[] {
    return Array.from(this.events.values())
      .filter(event => !event.resolved)
      .sort((a, b) => {
        // Sort by severity first, then by timestamp
        const severityOrder = { critical: 0, high: 1, medium: 2, low: 3 };
        const severityDiff = severityOrder[a.severity] - severityOrder[b.severity];
        if (severityDiff !== 0) return severityDiff;
        return b.timestamp.getTime() - a.timestamp.getTime();
      });
  }

  getMetrics(): SecurityMetrics {
    const events = Array.from(this.events.values());
    const eventsByType: Record<string, number> = {};
    const eventsBySeverity: Record<string, number> = {};
    let totalResolutionTime = 0;
    let resolvedCount = 0;

    events.forEach(event => {
      eventsByType[event.type] = (eventsByType[event.type] || 0) + 1;
      eventsBySeverity[event.severity] = (eventsBySeverity[event.severity] || 0) + 1;

      if (event.resolved && event.resolvedAt) {
        totalResolutionTime += event.resolvedAt.getTime() - event.timestamp.getTime();
        resolvedCount++;
      }
    });

    const topThreats = Object.entries(eventsByType)
      .map(([type, count]) => ({ type, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);

    return {
      totalEvents: events.length,
      eventsByType,
      eventsBySeverity,
      unresolvedEvents: events.filter(e => !e.resolved).length,
      averageResolutionTime: resolvedCount > 0 ? totalResolutionTime / resolvedCount : 0,
      topThreats
    };
  }

  isIPSuspicious(ipAddress: string): boolean {
    return this.suspiciousIPs.has(ipAddress);
  }

  clearSuspiciousIP(ipAddress: string): void {
    this.suspiciousIPs.delete(ipAddress);
    logger.info(`Cleared suspicious status for IP: ${ipAddress}`);
  }

  private cleanupOldEvents(): void {
    const cutoff = Date.now() - (30 * 24 * 60 * 60 * 1000); // 30 days
    let cleaned = 0;

    for (const [id, event] of this.events.entries()) {
      if (event.resolved && event.timestamp.getTime() < cutoff) {
        this.events.delete(id);
        cleaned++;
      }
    }

    if (cleaned > 0) {
      logger.info(`Cleaned up ${cleaned} old security events`);
    }
  }

  private generateEventId(): string {
    return `sec_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  async exportEvents(startDate: Date, endDate: Date): Promise<SecurityEvent[]> {
    return Array.from(this.events.values())
      .filter(event => 
        event.timestamp >= startDate && 
        event.timestamp <= endDate
      )
      .sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());
  }
}

export const securityAuditService = new SecurityAuditService();
