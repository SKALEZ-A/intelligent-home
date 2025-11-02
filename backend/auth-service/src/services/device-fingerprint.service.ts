import crypto from 'crypto';

interface DeviceFingerprint {
  fingerprintId: string;
  userId: string;
  userAgent: string;
  platform: string;
  screenResolution: string;
  timezone: string;
  language: string;
  plugins: string[];
  canvas: string;
  webgl: string;
  fonts: string[];
  audioContext: string;
  createdAt: Date;
  lastSeen: Date;
  trustScore: number;
  ipAddresses: string[];
}

interface DeviceTrustScore {
  fingerprintId: string;
  score: number;
  factors: {
    consistency: number;
    age: number;
    ipReputation: number;
    behaviorPattern: number;
  };
}

export class DeviceFingerprintService {
  private fingerprints: Map<string, DeviceFingerprint> = new Map();
  private suspiciousDevices: Set<string> = new Set();

  generateFingerprint(deviceData: Partial<DeviceFingerprint>): string {
    const components = [
      deviceData.userAgent || '',
      deviceData.platform || '',
      deviceData.screenResolution || '',
      deviceData.timezone || '',
      deviceData.language || '',
      (deviceData.plugins || []).join(','),
      deviceData.canvas || '',
      deviceData.webgl || '',
      (deviceData.fonts || []).join(','),
      deviceData.audioContext || ''
    ];

    const fingerprintString = components.join('|');
    return crypto.createHash('sha256').update(fingerprintString).digest('hex');
  }

  async registerDevice(userId: string, deviceData: Partial<DeviceFingerprint>): Promise<string> {
    const fingerprintId = this.generateFingerprint(deviceData);
    
    const existingFingerprint = this.fingerprints.get(fingerprintId);
    
    if (existingFingerprint) {
      existingFingerprint.lastSeen = new Date();
      existingFingerprint.trustScore = Math.min(100, existingFingerprint.trustScore + 5);
      return fingerprintId;
    }

    const fingerprint: DeviceFingerprint = {
      fingerprintId,
      userId,
      userAgent: deviceData.userAgent || '',
      platform: deviceData.platform || '',
      screenResolution: deviceData.screenResolution || '',
      timezone: deviceData.timezone || '',
      language: deviceData.language || '',
      plugins: deviceData.plugins || [],
      canvas: deviceData.canvas || '',
      webgl: deviceData.webgl || '',
      fonts: deviceData.fonts || [],
      audioContext: deviceData.audioContext || '',
      createdAt: new Date(),
      lastSeen: new Date(),
      trustScore: 50,
      ipAddresses: []
    };

    this.fingerprints.set(fingerprintId, fingerprint);
    return fingerprintId;
  }

  async verifyDevice(fingerprintId: string, userId: string): Promise<boolean> {
    const fingerprint = this.fingerprints.get(fingerprintId);
    
    if (!fingerprint) {
      return false;
    }

    if (fingerprint.userId !== userId) {
      this.suspiciousDevices.add(fingerprintId);
      return false;
    }

    if (this.suspiciousDevices.has(fingerprintId)) {
      return false;
    }

    fingerprint.lastSeen = new Date();
    return true;
  }

  calculateTrustScore(fingerprintId: string): DeviceTrustScore {
    const fingerprint = this.fingerprints.get(fingerprintId);
    
    if (!fingerprint) {
      return {
        fingerprintId,
        score: 0,
        factors: { consistency: 0, age: 0, ipReputation: 0, behaviorPattern: 0 }
      };
    }

    const ageInDays = (Date.now() - fingerprint.createdAt.getTime()) / (1000 * 60 * 60 * 24);
    const ageFactor = Math.min(100, ageInDays * 2);

    const consistencyFactor = fingerprint.trustScore;

    const uniqueIPs = new Set(fingerprint.ipAddresses).size;
    const ipReputationFactor = Math.max(0, 100 - (uniqueIPs * 10));

    const behaviorFactor = this.suspiciousDevices.has(fingerprintId) ? 0 : 100;

    const totalScore = (ageFactor + consistencyFactor + ipReputationFactor + behaviorFactor) / 4;

    return {
      fingerprintId,
      score: Math.round(totalScore),
      factors: {
        consistency: Math.round(consistencyFactor),
        age: Math.round(ageFactor),
        ipReputation: Math.round(ipReputationFactor),
        behaviorPattern: Math.round(behaviorFactor)
      }
    };
  }

  async addIpAddress(fingerprintId: string, ipAddress: string): Promise<void> {
    const fingerprint = this.fingerprints.get(fingerprintId);
    if (fingerprint && !fingerprint.ipAddresses.includes(ipAddress)) {
      fingerprint.ipAddresses.push(ipAddress);
      
      if (fingerprint.ipAddresses.length > 10) {
        this.suspiciousDevices.add(fingerprintId);
      }
    }
  }

  async getUserDevices(userId: string): Promise<DeviceFingerprint[]> {
    return Array.from(this.fingerprints.values()).filter(f => f.userId === userId);
  }

  async revokeDevice(fingerprintId: string): Promise<boolean> {
    return this.fingerprints.delete(fingerprintId);
  }

  async markSuspicious(fingerprintId: string): Promise<void> {
    this.suspiciousDevices.add(fingerprintId);
  }

  async clearSuspicious(fingerprintId: string): Promise<void> {
    this.suspiciousDevices.delete(fingerprintId);
  }

  isSuspicious(fingerprintId: string): boolean {
    return this.suspiciousDevices.has(fingerprintId);
  }
}

export const deviceFingerprintService = new DeviceFingerprintService();
