import { logger } from '../../../../shared/utils/logger';
import { DeviceRepository } from '../repositories/device.repository';

export interface DeviceBackup {
  deviceId: string;
  timestamp: Date;
  configuration: Record<string, any>;
  state: Record<string, any>;
  metadata: {
    version: string;
    backupType: 'manual' | 'automatic' | 'scheduled';
    triggeredBy: string;
  };
}

export class DeviceBackupService {
  private deviceRepository: DeviceRepository;
  private backups: Map<string, DeviceBackup[]> = new Map();
  private readonly MAX_BACKUPS_PER_DEVICE = 50;

  constructor() {
    this.deviceRepository = new DeviceRepository();
  }

  async createBackup(
    deviceId: string,
    backupType: 'manual' | 'automatic' | 'scheduled',
    triggeredBy: string
  ): Promise<DeviceBackup> {
    const device = await this.deviceRepository.findById(deviceId);
    if (!device) {
      throw new Error(`Device ${deviceId} not found`);
    }

    const backup: DeviceBackup = {
      deviceId,
      timestamp: new Date(),
      configuration: device.configuration || {},
      state: device.state || {},
      metadata: {
        version: '1.0',
        backupType,
        triggeredBy,
      },
    };

    const deviceBackups = this.backups.get(deviceId) || [];
    deviceBackups.unshift(backup);

    if (deviceBackups.length > this.MAX_BACKUPS_PER_DEVICE) {
      deviceBackups.pop();
    }

    this.backups.set(deviceId, deviceBackups);

    logger.info(`Backup created for device ${deviceId}`, {
      backupType,
      triggeredBy,
    });

    return backup;
  }

  async restoreBackup(deviceId: string, timestamp: Date): Promise<void> {
    const deviceBackups = this.backups.get(deviceId);
    if (!deviceBackups) {
      throw new Error(`No backups found for device ${deviceId}`);
    }

    const backup = deviceBackups.find(
      (b) => b.timestamp.getTime() === timestamp.getTime()
    );

    if (!backup) {
      throw new Error(`Backup not found for device ${deviceId} at ${timestamp}`);
    }

    await this.deviceRepository.updateConfiguration(deviceId, backup.configuration);
    await this.deviceRepository.updateState(deviceId, backup.state);

    logger.info(`Backup restored for device ${deviceId}`, { timestamp });
  }

  async getDeviceBackups(deviceId: string): Promise<DeviceBackup[]> {
    return this.backups.get(deviceId) || [];
  }

  async getLatestBackup(deviceId: string): Promise<DeviceBackup | null> {
    const deviceBackups = this.backups.get(deviceId);
    return deviceBackups && deviceBackups.length > 0 ? deviceBackups[0] : null;
  }

  async deleteBackup(deviceId: string, timestamp: Date): Promise<void> {
    const deviceBackups = this.backups.get(deviceId);
    if (!deviceBackups) return;

    const filtered = deviceBackups.filter(
      (b) => b.timestamp.getTime() !== timestamp.getTime()
    );

    this.backups.set(deviceId, filtered);
    logger.info(`Backup deleted for device ${deviceId}`, { timestamp });
  }

  async deleteAllBackups(deviceId: string): Promise<void> {
    this.backups.delete(deviceId);
    logger.info(`All backups deleted for device ${deviceId}`);
  }

  async exportBackup(deviceId: string, timestamp: Date): Promise<string> {
    const deviceBackups = this.backups.get(deviceId);
    if (!deviceBackups) {
      throw new Error(`No backups found for device ${deviceId}`);
    }

    const backup = deviceBackups.find(
      (b) => b.timestamp.getTime() === timestamp.getTime()
    );

    if (!backup) {
      throw new Error(`Backup not found`);
    }

    return JSON.stringify(backup, null, 2);
  }

  async importBackup(backupData: string): Promise<void> {
    const backup: DeviceBackup = JSON.parse(backupData);
    const deviceBackups = this.backups.get(backup.deviceId) || [];
    deviceBackups.unshift(backup);

    if (deviceBackups.length > this.MAX_BACKUPS_PER_DEVICE) {
      deviceBackups.pop();
    }

    this.backups.set(backup.deviceId, deviceBackups);
    logger.info(`Backup imported for device ${backup.deviceId}`);
  }
}
