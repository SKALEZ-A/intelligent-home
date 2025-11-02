import { RedisService } from './redis.service';
import { logger } from '../../../shared/utils/logger';
import { UnauthorizedError } from '../../../shared/utils/errors';

export interface SessionData {
  userId: string;
  email: string;
  deviceId: string;
  ipAddress: string;
  userAgent: string;
  createdAt: Date;
  lastActivity: Date;
  expiresAt: Date;
}

export class SessionService {
  private redisService: RedisService;
  private readonly SESSION_PREFIX = 'session:';
  private readonly USER_SESSIONS_PREFIX = 'user:sessions:';
  private readonly SESSION_TTL = 7 * 24 * 60 * 60; // 7 days

  constructor() {
    this.redisService = new RedisService();
  }

  async createSession(
    userId: string,
    email: string,
    deviceId: string,
    ipAddress: string,
    userAgent: string
  ): Promise<string> {
    const sessionId = this.generateSessionId();
    const now = new Date();
    const expiresAt = new Date(now.getTime() + this.SESSION_TTL * 1000);

    const sessionData: SessionData = {
      userId,
      email,
      deviceId,
      ipAddress,
      userAgent,
      createdAt: now,
      lastActivity: now,
      expiresAt,
    };

    await this.redisService.set(
      `${this.SESSION_PREFIX}${sessionId}`,
      JSON.stringify(sessionData),
      this.SESSION_TTL
    );

    await this.addSessionToUser(userId, sessionId);

    logger.info(`Session created for user ${userId}`, { sessionId, deviceId });
    return sessionId;
  }

  async getSession(sessionId: string): Promise<SessionData | null> {
    const data = await this.redisService.get(`${this.SESSION_PREFIX}${sessionId}`);
    if (!data) return null;

    const session = JSON.parse(data) as SessionData;
    
    // Update last activity
    session.lastActivity = new Date();
    await this.redisService.set(
      `${this.SESSION_PREFIX}${sessionId}`,
      JSON.stringify(session),
      this.SESSION_TTL
    );

    return session;
  }

  async validateSession(sessionId: string): Promise<SessionData> {
    const session = await this.getSession(sessionId);
    if (!session) {
      throw new UnauthorizedError('Invalid or expired session');
    }

    if (new Date() > new Date(session.expiresAt)) {
      await this.destroySession(sessionId);
      throw new UnauthorizedError('Session expired');
    }

    return session;
  }

  async destroySession(sessionId: string): Promise<void> {
    const session = await this.getSession(sessionId);
    if (session) {
      await this.removeSessionFromUser(session.userId, sessionId);
    }

    await this.redisService.delete(`${this.SESSION_PREFIX}${sessionId}`);
    logger.info(`Session destroyed`, { sessionId });
  }

  async getUserSessions(userId: string): Promise<SessionData[]> {
    const sessionIds = await this.redisService.getSetMembers(
      `${this.USER_SESSIONS_PREFIX}${userId}`
    );

    const sessions: SessionData[] = [];
    for (const sessionId of sessionIds) {
      const session = await this.getSession(sessionId);
      if (session) {
        sessions.push(session);
      }
    }

    return sessions;
  }

  async destroyAllUserSessions(userId: string): Promise<void> {
    const sessionIds = await this.redisService.getSetMembers(
      `${this.USER_SESSIONS_PREFIX}${userId}`
    );

    for (const sessionId of sessionIds) {
      await this.redisService.delete(`${this.SESSION_PREFIX}${sessionId}`);
    }

    await this.redisService.delete(`${this.USER_SESSIONS_PREFIX}${userId}`);
    logger.info(`All sessions destroyed for user ${userId}`);
  }

  async destroyOtherSessions(userId: string, currentSessionId: string): Promise<void> {
    const sessionIds = await this.redisService.getSetMembers(
      `${this.USER_SESSIONS_PREFIX}${userId}`
    );

    for (const sessionId of sessionIds) {
      if (sessionId !== currentSessionId) {
        await this.redisService.delete(`${this.SESSION_PREFIX}${sessionId}`);
        await this.removeSessionFromUser(userId, sessionId);
      }
    }

    logger.info(`Other sessions destroyed for user ${userId}`, { currentSessionId });
  }

  private async addSessionToUser(userId: string, sessionId: string): Promise<void> {
    await this.redisService.addToSet(`${this.USER_SESSIONS_PREFIX}${userId}`, sessionId);
  }

  private async removeSessionFromUser(userId: string, sessionId: string): Promise<void> {
    await this.redisService.removeFromSet(
      `${this.USER_SESSIONS_PREFIX}${userId}`,
      sessionId
    );
  }

  private generateSessionId(): string {
    return `${Date.now()}-${Math.random().toString(36).substring(2, 15)}`;
  }

  async getActiveSessionCount(userId: string): Promise<number> {
    const sessions = await this.getUserSessions(userId);
    return sessions.length;
  }

  async isSessionActive(sessionId: string): Promise<boolean> {
    const session = await this.getSession(sessionId);
    return session !== null && new Date() <= new Date(session.expiresAt);
  }
}
