import speakeasy from 'speakeasy';
import QRCode from 'qrcode';
import { IUser } from '../models/user.model';

export class TwoFactorService {
  generateSecret(email: string): { secret: string; qrCode: string } {
    const secret = speakeasy.generateSecret({
      name: `Smart Home (${email})`,
      issuer: 'Smart Home Automation',
      length: 32,
    });

    return {
      secret: secret.base32,
      qrCode: secret.otpauth_url || '',
    };
  }

  async generateQRCode(otpauthUrl: string): Promise<string> {
    try {
      return await QRCode.toDataURL(otpauthUrl);
    } catch (error) {
      throw new Error('Failed to generate QR code');
    }
  }

  verifyToken(secret: string, token: string): boolean {
    return speakeasy.totp.verify({
      secret,
      encoding: 'base32',
      token,
      window: 2, // Allow 2 time steps before and after
    });
  }

  generateBackupCodes(count: number = 10): string[] {
    const codes: string[] = [];
    for (let i = 0; i < count; i++) {
      const code = Math.random().toString(36).substring(2, 10).toUpperCase();
      codes.push(code);
    }
    return codes;
  }

  async enableTwoFactor(user: IUser, token: string): Promise<{ backupCodes: string[] }> {
    if (!user.twoFactorSecret) {
      throw new Error('Two-factor secret not found');
    }

    if (!this.verifyToken(user.twoFactorSecret, token)) {
      throw new Error('Invalid verification code');
    }

    const backupCodes = this.generateBackupCodes();
    
    user.twoFactorEnabled = true;
    await user.save();

    return { backupCodes };
  }

  async disableTwoFactor(user: IUser, password: string): Promise<void> {
    const isPasswordValid = await user.comparePassword(password);
    if (!isPasswordValid) {
      throw new Error('Invalid password');
    }

    user.twoFactorEnabled = false;
    user.twoFactorSecret = undefined;
    await user.save();
  }

  validateBackupCode(storedCodes: string[], providedCode: string): boolean {
    return storedCodes.includes(providedCode.toUpperCase());
  }
}

export const twoFactorService = new TwoFactorService();
