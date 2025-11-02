import crypto from 'crypto';

export interface BiometricData {
  userId: string;
  type: 'fingerprint' | 'face' | 'voice' | 'iris';
  template: string;
  deviceId: string;
  enrolledAt: Date;
  lastUsed?: Date;
}

export class BiometricAuthService {
  private biometricTemplates: Map<string, BiometricData[]> = new Map();

  async enrollBiometric(userId: string, type: BiometricData['type'], rawData: string, deviceId: string): Promise<BiometricData> {
    const template = this.createBiometricTemplate(rawData);
    
    const biometricData: BiometricData = {
      userId,
      type,
      template,
      deviceId,
      enrolledAt: new Date()
    };

    const userBiometrics = this.biometricTemplates.get(userId) || [];
    userBiometrics.push(biometricData);
    this.biometricTemplates.set(userId, userBiometrics);

    return biometricData;
  }

  async verifyBiometric(userId: string, type: BiometricData['type'], rawData: string, deviceId: string): Promise<boolean> {
    const userBiometrics = this.biometricTemplates.get(userId);
    if (!userBiometrics) return false;

    const template = this.createBiometricTemplate(rawData);
    
    const matchingBiometric = userBiometrics.find(
      bio => bio.type === type && bio.deviceId === deviceId
    );

    if (!matchingBiometric) return false;

    const similarity = this.compareBiometricTemplates(template, matchingBiometric.template);
    
    if (similarity > 0.95) {
      matchingBiometric.lastUsed = new Date();
      return true;
    }

    return false;
  }

  private createBiometricTemplate(rawData: string): string {
    return crypto.createHash('sha256').update(rawData).digest('hex');
  }

  private compareBiometricTemplates(template1: string, template2: string): number {
    if (template1 === template2) return 1.0;
    
    let matches = 0;
    const length = Math.min(template1.length, template2.length);
    
    for (let i = 0; i < length; i++) {
      if (template1[i] === template2[i]) matches++;
    }
    
    return matches / length;
  }

  async removeBiometric(userId: string, type: BiometricData['type'], deviceId: string): Promise<boolean> {
    const userBiometrics = this.biometricTemplates.get(userId);
    if (!userBiometrics) return false;

    const filtered = userBiometrics.filter(
      bio => !(bio.type === type && bio.deviceId === deviceId)
    );

    if (filtered.length === userBiometrics.length) return false;

    this.biometricTemplates.set(userId, filtered);
    return true;
  }

  async getUserBiometrics(userId: string): Promise<BiometricData[]> {
    return this.biometricTemplates.get(userId) || [];
  }

  async isBiometricEnrolled(userId: string, type: BiometricData['type'], deviceId: string): Promise<boolean> {
    const userBiometrics = this.biometricTemplates.get(userId);
    if (!userBiometrics) return false;

    return userBiometrics.some(
      bio => bio.type === type && bio.deviceId === deviceId
    );
  }

  async getBiometricStats(userId: string): Promise<any> {
    const userBiometrics = this.biometricTemplates.get(userId) || [];
    
    return {
      total: userBiometrics.length,
      byType: {
        fingerprint: userBiometrics.filter(b => b.type === 'fingerprint').length,
        face: userBiometrics.filter(b => b.type === 'face').length,
        voice: userBiometrics.filter(b => b.type === 'voice').length,
        iris: userBiometrics.filter(b => b.type === 'iris').length
      },
      devices: [...new Set(userBiometrics.map(b => b.deviceId))].length,
      lastUsed: userBiometrics.reduce((latest, bio) => {
        if (!bio.lastUsed) return latest;
        return !latest || bio.lastUsed > latest ? bio.lastUsed : latest;
      }, null as Date | null)
    };
  }
}
