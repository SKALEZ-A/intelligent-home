import crypto from 'crypto';
import { logger } from '../../../../shared/utils/logger';
import { EventBusService } from '../../../../shared/services/event-bus.service';

interface PairingSession {
  id: string;
  deviceType: string;
  protocol: string;
  status: 'pending' | 'in_progress' | 'completed' | 'failed' | 'expired';
  createdAt: Date;
  expiresAt: Date;
  metadata: Record<string, any>;
}

export class DevicePairingService {
  private pairingSessions: Map<string, PairingSession> = new Map();
  private readonly SESSION_TIMEOUT = 5 * 60 * 1000; // 5 minutes

  constructor(private eventBus: EventBusService) {
    this.startSessionCleanup();
  }

  public async initiatePairing(deviceType: string, protocol: string, metadata: Record<string, any> = {}): Promise<string> {
    const sessionId = this.generateSessionId();
    const session: PairingSession = {
      id: sessionId,
      deviceType,
      protocol,
      status: 'pending',
      createdAt: new Date(),
      expiresAt: new Date(Date.now() + this.SESSION_TIMEOUT),
      metadata
    };

    this.pairingSessions.set(sessionId, session);
    logger.info('Pairing session initiated', { sessionId, deviceType, protocol });

    await this.eventBus.publish('device.pairing.initiated', { sessionId, deviceType, protocol });

    return sessionId;
  }

  public async completePairing(sessionId: string, deviceId: string): Promise<void> {
    const session = this.pairingSessions.get(sessionId);
    if (!session) {
      throw new Error('Pairing session not found');
    }

    if (session.status !== 'pending' && session.status !== 'in_progress') {
      throw new Error(`Invalid session status: ${session.status}`);
    }

    if (new Date() > session.expiresAt) {
      session.status = 'expired';
      throw new Error('Pairing session has expired');
    }

    session.status = 'completed';
    logger.info('Pairing completed', { sessionId, deviceId });

    await this.eventBus.publish('device.pairing.completed', { sessionId, deviceId });
    this.pairingSessions.delete(sessionId);
  }

  public async failPairing(sessionId: string, reason: string): Promise<void> {
    const session = this.pairingSessions.get(sessionId);
    if (!session) {
      throw new Error('Pairing session not found');
    }

    session.status = 'failed';
    logger.warn('Pairing failed', { sessionId, reason });

    await this.eventBus.publish('device.pairing.failed', { sessionId, reason });
  }

  public getPairingSession(sessionId: string): PairingSession | undefined {
    return this.pairingSessions.get(sessionId);
  }

  private generateSessionId(): string {
    return crypto.randomBytes(16).toString('hex');
  }

  private startSessionCleanup(): void {
    setInterval(() => {
      const now = new Date();
      for (const [sessionId, session] of this.pairingSessions.entries()) {
        if (now > session.expiresAt) {
          session.status = 'expired';
          this.pairingSessions.delete(sessionId);
          logger.debug('Expired pairing session removed', { sessionId });
        }
      }
    }, 60000); // Check every minute
  }
}
