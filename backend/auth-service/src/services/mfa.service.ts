import crypto from 'crypto';
import { authenticator } from 'otplib';
import QRCode from 'qrcode';
import { logger } from '../../../../shared/utils/logger';
import { encryptionService } from '../../../../shared/services/encryption.service';

interface MFAConfig {
  userId: string;
  secret: string;
  enabled: boolean;
  backupCodes: string[];
  createdAt: Date;
  lastUsed?: Date;
}

export class MFAService {
  private configs: Map<string, MFAConfig> = new Map();
  private readonly APP_NAME = 'SmartHome';

  public async setupMFA(userId: string): Promise<{ secret: string; qrCode: string; backupCodes: string[] }> {
    const secret = authenticator.generateSecret();
    const backupCodes = this.generateBackupCodes();

    const config: MFAConfig = {
      userId,
      secret: encryptionService.encrypt(secret),
      enabled: false,
      backupCodes: backupCodes.map(code => encryptionService.hash(code).hash),
      createdAt: new Date()
    };

    this.configs.set(userId, config);

    const otpauthUrl = authenticator.keyuri(userId, this.APP_NAME, secret);
    const qrCode = await QRCode.toDataURL(otpauthUrl);

    logger.info('MFA setup initiated', { userId });

    return {
      secret,
      qrCode,
      backupCodes
    };
  }

  public async enableMFA(userId: string, token: string): Promise<boolean> {
    const config = this.configs.get(userId);
    if (!config) {
      throw new Error('MFA not set up for user');
    }

    const secret = encryptionService.decrypt(config.secret);
    const isValid = authenticator.verify({ token, secret });

    if (isValid) {
      config.enabled = true;
      logger.info('MFA enabled', { userId });
      return true;
    }

    logger.warn('Invalid MFA token during enablement', { userId });
    return false;
  }

  public async disableMFA(userId: string, token: string): Promise<boolean> {
    const config = this.configs.get(userId);
    if (!config || !config.enabled) {
      return false;
    }

    const secret = encryptionService.decrypt(config.secret);
    const isValid = authenticator.verify({ token, secret });

    if (isValid) {
      config.enabled = false;
      logger.info('MFA disabled', { userId });
      return true;
    }

    return false;
  }

  public async verifyToken(userId: string, token: string): Promise<boolean> {
    const config = this.configs.get(userId);
    if (!config || !config.enabled) {
      return false;
    }

    const secret = encryptionService.decrypt(config.secret);
    const isValid = authenticator.verify({ token, secret });

    if (isValid) {
      config.lastUsed = new Date();
      logger.info('MFA token verified', { userId });
      return true;
    }

    logger.warn('Invalid MFA token', { userId });
    return false;
  }

  public async verifyBackupCode(userId: string, code: string): Promise<boolean> {
    const config = this.configs.get(userId);
    if (!config || !config.enabled) {
      return false;
    }

    const codeHash = encryptionService.hash(code).hash;
    const index = config.backupCodes.indexOf(codeHash);

    if (index !== -1) {
      config.backupCodes.splice(index, 1);
      config.lastUsed = new Date();
      logger.info('Backup code used', { userId, remainingCodes: config.backupCodes.length });
      return true;
    }

    logger.warn('Invalid backup code', { userId });
    return false;
  }

  public async regenerateBackupCodes(userId: string, token: string): Promise<string[] | null> {
    const config = this.configs.get(userId);
    if (!config || !config.enabled) {
      return null;
    }

    const secret = encryptionService.decrypt(config.secret);
    const isValid = authenticator.verify({ token, secret });

    if (!isValid) {
      return null;
    }

    const backupCodes = this.generateBackupCodes();
    config.backupCodes = backupCodes.map(code => encryptionService.hash(code).hash);

    logger.info('Backup codes regenerated', { userId });

    return backupCodes;
  }

  public isMFAEnabled(userId: string): boolean {
    const config = this.configs.get(userId);
    return config?.enabled || false;
  }

  public getMFAStatus(userId: string): any {
    const config = this.configs.get(userId);
    if (!config) {
      return {
        enabled: false,
        configured: false
      };
    }

    return {
      enabled: config.enabled,
      configured: true,
      backupCodesRemaining: config.backupCodes.length,
      lastUsed: config.lastUsed,
      createdAt: config.createdAt
    };
  }

  private generateBackupCodes(count: number = 10): string[] {
    const codes: string[] = [];
    
    for (let i = 0; i < count; i++) {
      const code = crypto.randomBytes(4).toString('hex').toUpperCase();
      const formatted = code.match(/.{1,4}/g)?.join('-') || code;
      codes.push(formatted);
    }

    return codes;
  }

  public async resetMFA(userId: string): Promise<void> {
    this.configs.delete(userId);
    logger.info('MFA reset', { userId });
  }
}

export const mfaService = new MFAService();
