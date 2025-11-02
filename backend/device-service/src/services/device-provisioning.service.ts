import crypto from 'crypto';

interface ProvisioningRequest {
  deviceType: string;
  manufacturer: string;
  model: string;
  serialNumber: string;
  macAddress: string;
  firmwareVersion: string;
}

interface ProvisioningCredentials {
  deviceId: string;
  clientId: string;
  clientSecret: string;
  certificate?: string;
  privateKey?: string;
}

export class DeviceProvisioningService {
  private pendingProvisions: Map<string, ProvisioningRequest> = new Map();
  private provisionedDevices: Map<string, ProvisioningCredentials> = new Map();

  async initiateProvisioning(request: ProvisioningRequest): Promise<string> {
    const provisioningToken = crypto.randomBytes(32).toString('hex');
    this.pendingProvisions.set(provisioningToken, request);

    setTimeout(() => {
      this.pendingProvisions.delete(provisioningToken);
    }, 300000);

    return provisioningToken;
  }

  async completeProvisioning(
    provisioningToken: string,
    userId: string
  ): Promise<ProvisioningCredentials> {
    const request = this.pendingProvisions.get(provisioningToken);
    
    if (!request) {
      throw new Error('Invalid or expired provisioning token');
    }

    const deviceId = crypto.randomUUID();
    const clientId = `device_${deviceId}`;
    const clientSecret = crypto.randomBytes(32).toString('hex');

    const credentials: ProvisioningCredentials = {
      deviceId,
      clientId,
      clientSecret
    };

    this.provisionedDevices.set(deviceId, credentials);
    this.pendingProvisions.delete(provisioningToken);

    return credentials;
  }

  async generateCertificate(deviceId: string): Promise<{ certificate: string; privateKey: string }> {
    const privateKey = crypto.generateKeyPairSync('rsa', {
      modulusLength: 2048,
      publicKeyEncoding: { type: 'spki', format: 'pem' },
      privateKeyEncoding: { type: 'pkcs8', format: 'pem' }
    }).privateKey;

    const certificate = `-----BEGIN CERTIFICATE-----\n${Buffer.from(deviceId).toString('base64')}\n-----END CERTIFICATE-----`;

    return { certificate, privateKey };
  }

  async revokeDevice(deviceId: string): Promise<boolean> {
    return this.provisionedDevices.delete(deviceId);
  }

  async getDeviceCredentials(deviceId: string): Promise<ProvisioningCredentials | null> {
    return this.provisionedDevices.get(deviceId) || null;
  }
}

export const deviceProvisioningService = new DeviceProvisioningService();
