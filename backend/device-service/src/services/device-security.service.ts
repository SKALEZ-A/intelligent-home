import crypto from 'crypto';
import { logger } from '../../../../shared/utils/logger';
import { encryptionService } from '../../../../shared/services/encryption.service';

interface DeviceCredentials {
  deviceId: string;
  apiKey: string;
  secret: string;
  certificate?: string;
  privateKey?: string;
}

interface SecurityPolicy {
  requireEncryption: boolean;
  requireAuthentication: boolean;
  allowedProtocols: string[];
  maxFailedAttempts: number;
  lockoutDuration: number;
}

export class DeviceSecurityService {
  private credentials: Map<string, DeviceCredentials> = new Map();
  private failedAttempts: Map<string, number> = new Map();
  private lockedDevices: Map<string, Date> = new Map();
  private securityPolicies: Map<string, SecurityPolicy> = new Map();

  constructor() {
    this.initializeDefaultPolicy();
  }

  private initializeDefaultPolicy(): void {
    const defaultPolicy: SecurityPolicy = {
      requireEncryption: true,
      requireAuthentication: true,
      allowedProtocols: ['mqtt', 'https', 'wss'],
      maxFailedAttempts: 5,
      lockoutDuration: 900000 // 15 minutes
    };

    this.securityPolicies.set('default', defaultPolicy);
  }

  public async registerDevice(deviceId: string): Promise<DeviceCredentials> {
    const apiKey = this.generateApiKey();
    const secret = this.generateSecret();

    const credentials: DeviceCredentials = {
      deviceId,
      apiKey,
      secret
    };

    this.credentials.set(deviceId, credentials);
    logger.info('Device registered with security credentials', { deviceId });

    return credentials;
  }

  public async authenticateDevice(deviceId: string, apiKey: string, signature: string): Promise<boolean> {
    if (this.isDeviceLocked(deviceId)) {
      logger.warn('Authentication attempt on locked device', { deviceId });
      return false;
    }

    const credentials = this.credentials.get(deviceId);
    if (!credentials) {
      logger.warn('Authentication failed: device not found', { deviceId });
      this.recordFailedAttempt(deviceId);
      return false;
    }

    if (credentials.apiKey !== apiKey) {
      logger.warn('Authentication failed: invalid API key', { deviceId });
      this.recordFailedAttempt(deviceId);
      return false;
    }

    const expectedSignature = this.generateSignature(deviceId, credentials.secret);
    if (signature !== expectedSignature) {
      logger.warn('Authentication failed: invalid signature', { deviceId });
      this.recordFailedAttempt(deviceId);
      return false;
    }

    this.clearFailedAttempts(deviceId);
    logger.info('Device authenticated successfully', { deviceId });
    return true;
  }

  public generateSignature(deviceId: string, secret: string, timestamp?: number): string {
    const ts = timestamp || Date.now();
    const data = `${deviceId}:${ts}`;
    
    return crypto
      .createHmac('sha256', secret)
      .update(data)
      .digest('hex');
  }

  public encryptDeviceData(deviceId: string, data: string): string {
    return encryptionService.encrypt(data, deviceId);
  }

  public decryptDeviceData(deviceId: string, encryptedData: string): string {
    return encryptionService.decrypt(encryptedData, deviceId);
  }

  public async rotateCredentials(deviceId: string): Promise<DeviceCredentials> {
    const oldCredentials = this.credentials.get(deviceId);
    if (!oldCredentials) {
      throw new Error(`Device not found: ${deviceId}`);
    }

    const newCredentials: DeviceCredentials = {
      deviceId,
      apiKey: this.generateApiKey(),
      secret: this.generateSecret(),
      certificate: oldCredentials.certificate,
      privateKey: oldCredentials.privateKey
    };

    this.credentials.set(deviceId, newCredentials);
    logger.info('Device credentials rotated', { deviceId });

    return newCredentials;
  }

  public setSecurityPolicy(deviceId: string, policy: Partial<SecurityPolicy>): void {
    const currentPolicy = this.securityPolicies.get(deviceId) || this.securityPolicies.get('default')!;
    const updatedPolicy = { ...currentPolicy, ...policy };
    
    this.securityPolicies.set(deviceId, updatedPolicy);
    logger.info('Security policy updated', { deviceId });
  }

  public getSecurityPolicy(deviceId: string): SecurityPolicy {
    return this.securityPolicies.get(deviceId) || this.securityPolicies.get('default')!;
  }

  private generateApiKey(): string {
    return crypto.randomBytes(32).toString('hex');
  }

  private generateSecret(): string {
    return crypto.randomBytes(64).toString('hex');
  }

  private recordFailedAttempt(deviceId: string): void {
    const attempts = (this.failedAttempts.get(deviceId) || 0) + 1;
    this.failedAttempts.set(deviceId, attempts);

    const policy = this.getSecurityPolicy(deviceId);
    if (attempts >= policy.maxFailedAttempts) {
      this.lockDevice(deviceId, policy.lockoutDuration);
    }
  }

  private clearFailedAttempts(deviceId: string): void {
    this.failedAttempts.delete(deviceId);
  }

  private lockDevice(deviceId: string, duration: number): void {
    const unlockTime = new Date(Date.now() + duration);
    this.lockedDevices.set(deviceId, unlockTime);
    logger.warn('Device locked due to failed authentication attempts', { 
      deviceId, 
      unlockTime 
    });
  }

  private isDeviceLocked(deviceId: string): boolean {
    const unlockTime = this.lockedDevices.get(deviceId);
    if (!unlockTime) return false;

    if (new Date() > unlockTime) {
      this.lockedDevices.delete(deviceId);
      this.clearFailedAttempts(deviceId);
      return false;
    }

    return true;
  }

  public unlockDevice(deviceId: string): void {
    this.lockedDevices.delete(deviceId);
    this.clearFailedAttempts(deviceId);
    logger.info('Device manually unlocked', { deviceId });
  }

  public getDeviceSecurityStatus(deviceId: string): any {
    return {
      isLocked: this.isDeviceLocked(deviceId),
      failedAttempts: this.failedAttempts.get(deviceId) || 0,
      unlockTime: this.lockedDevices.get(deviceId),
      hasCredentials: this.credentials.has(deviceId),
      policy: this.getSecurityPolicy(deviceId)
    };
  }
}

export const deviceSecurityService = new DeviceSecurityService();
