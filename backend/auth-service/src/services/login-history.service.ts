import { EventEmitter } from 'events';

interface LoginAttempt {
  id: string;
  userId?: string;
  username: string;
  timestamp: number;
  success: boolean;
  ipAddress: string;
  userAgent: string;
  location?: {
    country: string;
    city: string;
    coordinates: { lat: number; lon: number };
  };
  deviceFingerprint?: string;
  failureReason?: string;
}

interface LoginSession {
  id: string;
  userId: string;
  loginAttemptId: string;
  startTime: number;
  lastActivity: number;
  endTime?: number;
  ipAddress: string;
  deviceInfo: string;
  active: boolean;
}

export class LoginHistoryService extends EventEmitter {
  private attempts: LoginAttempt[] = [];
  private sessions: Map<string, LoginSession> = new Map();
  private readonly maxHistorySize = 10000;

  public recordAttempt(attempt: Omit<LoginAttempt, 'id'>): LoginAttempt {
    const fullAttempt: LoginAttempt = {
      ...attempt,
      id: `attempt_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
    };

    this.attempts.push(fullAttempt);

    if (this.attempts.length > this.maxHistorySize) {
      this.attempts.shift();
    }

    this.emit('attemptRecorded', fullAttempt);

    if (fullAttempt.success && fullAttempt.userId) {
      this.createSession(fullAttempt);
    }

    return fullAttempt;
  }

  private createSession(attempt: LoginAttempt): LoginSession {
    const session: LoginSession = {
      id: `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      userId: attempt.userId!,
      loginAttemptId: attempt.id,
      startTime: attempt.timestamp,
      lastActivity: attempt.timestamp,
      ipAddress: attempt.ipAddress,
      deviceInfo: attempt.userAgent,
      active: true
    };

    this.sessions.set(session.id, session);
    this.emit('sessionCreated', session);

    return session;
  }

  public updateSessionActivity(sessionId: string): void {
    const session = this.sessions.get(sessionId);

    if (session && session.active) {
      session.lastActivity = Date.now();
    }
  }

  public endSession(sessionId: string): void {
    const session = this.sessions.get(sessionId);

    if (session) {
      session.endTime = Date.now();
      session.active = false;
      this.emit('sessionEnded', session);
    }
  }

  public getUserLoginHistory(userId: string, limit: number = 50): LoginAttempt[] {
    return this.attempts
      .filter(attempt => attempt.userId === userId)
      .sort((a, b) => b.timestamp - a.timestamp)
      .slice(0, limit);
  }

  public getActiveSessions(userId: string): LoginSession[] {
    return Array.from(this.sessions.values())
      .filter(session => session.userId === userId && session.active);
  }

  public getFailedAttempts(
    username: string,
    timeWindowMs: number = 3600000
  ): LoginAttempt[] {
    const cutoff = Date.now() - timeWindowMs;
    
    return this.attempts.filter(
      attempt =>
        attempt.username === username &&
        !attempt.success &&
        attempt.timestamp >= cutoff
    );
  }

  public detectSuspiciousActivity(userId: string): {
    suspicious: boolean;
    reasons: string[];
  } {
    const reasons: string[] = [];
    const recentAttempts = this.getUserLoginHistory(userId, 10);

    const uniqueIPs = new Set(recentAttempts.map(a => a.ipAddress));
    if (uniqueIPs.size > 5) {
      reasons.push('Multiple IP addresses detected');
    }

    const uniqueLocations = new Set(
      recentAttempts
        .filter(a => a.location)
        .map(a => a.location!.country)
    );
    if (uniqueLocations.size > 3) {
      reasons.push('Multiple countries detected');
    }

    const failedAttempts = recentAttempts.filter(a => !a.success);
    if (failedAttempts.length > 3) {
      reasons.push('Multiple failed login attempts');
    }

    return {
      suspicious: reasons.length > 0,
      reasons
    };
  }

  public getLoginStats(userId: string): {
    totalLogins: number;
    successfulLogins: number;
    failedLogins: number;
    uniqueDevices: number;
    uniqueLocations: number;
    lastLogin: number;
  } {
    const history = this.getUserLoginHistory(userId, 1000);
    const successful = history.filter(a => a.success);
    const failed = history.filter(a => !a.success);

    const uniqueDevices = new Set(history.map(a => a.deviceFingerprint)).size;
    const uniqueLocations = new Set(
      history.filter(a => a.location).map(a => a.location!.country)
    ).size;

    return {
      totalLogins: history.length,
      successfulLogins: successful.length,
      failedLogins: failed.length,
      uniqueDevices,
      uniqueLocations,
      lastLogin: history[0]?.timestamp || 0
    };
  }
}

export const loginHistoryService = new LoginHistoryService();
