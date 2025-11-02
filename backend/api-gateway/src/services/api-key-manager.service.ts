import crypto from 'crypto';

interface ApiKey {
  id: string;
  userId: string;
  keyHash: string;
  name: string;
  scopes: string[];
  rateLimit: number;
  expiresAt?: Date;
  active: boolean;
  createdAt: Date;
}

interface ApiKeyUsage {
  apiKeyId: string;
  endpoint: string;
  method: string;
  statusCode: number;
  timestamp: Date;
}

export class ApiKeyManagerService {
  private keys: Map<string, ApiKey> = new Map();
  private usage: Map<string, ApiKeyUsage[]> = new Map();

  generateApiKey(): string {
    return crypto.randomBytes(32).toString('hex');
  }

  hashApiKey(key: string): string {
    return crypto.createHash('sha256').update(key).digest('hex');
  }

  async createApiKey(
    userId: string,
    name: string,
    scopes: string[],
    rateLimit: number = 1000,
    expiresAt?: Date
  ): Promise<{ key: string; apiKey: ApiKey }> {
    const key = this.generateApiKey();
    const keyHash = this.hashApiKey(key);

    const apiKey: ApiKey = {
      id: crypto.randomUUID(),
      userId,
      keyHash,
      name,
      scopes,
      rateLimit,
      expiresAt,
      active: true,
      createdAt: new Date()
    };

    this.keys.set(keyHash, apiKey);
    return { key, apiKey };
  }

  async validateApiKey(key: string): Promise<ApiKey | null> {
    const keyHash = this.hashApiKey(key);
    const apiKey = this.keys.get(keyHash);

    if (!apiKey || !apiKey.active) {
      return null;
    }

    if (apiKey.expiresAt && new Date() > apiKey.expiresAt) {
      return null;
    }

    return apiKey;
  }

  async checkRateLimit(keyHash: string): Promise<boolean> {
    const apiKey = this.keys.get(keyHash);
    if (!apiKey) return false;

    const usageRecords = this.usage.get(apiKey.id) || [];
    const oneHourAgo = new Date(Date.now() - 3600000);
    const recentUsage = usageRecords.filter(u => u.timestamp > oneHourAgo);

    return recentUsage.length < apiKey.rateLimit;
  }

  async recordUsage(
    apiKeyId: string,
    endpoint: string,
    method: string,
    statusCode: number
  ): Promise<void> {
    const usageRecords = this.usage.get(apiKeyId) || [];
    
    usageRecords.push({
      apiKeyId,
      endpoint,
      method,
      statusCode,
      timestamp: new Date()
    });

    if (usageRecords.length > 10000) {
      usageRecords.shift();
    }

    this.usage.set(apiKeyId, usageRecords);
  }

  async revokeApiKey(keyHash: string): Promise<boolean> {
    const apiKey = this.keys.get(keyHash);
    if (!apiKey) return false;

    apiKey.active = false;
    return true;
  }

  async getUserApiKeys(userId: string): Promise<ApiKey[]> {
    return Array.from(this.keys.values()).filter(k => k.userId === userId);
  }
}

export const apiKeyManager = new ApiKeyManagerService();
