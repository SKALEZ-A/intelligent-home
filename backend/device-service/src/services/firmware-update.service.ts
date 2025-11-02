import { EventEmitter } from 'events';
import { logger } from '../../../../shared/utils/logger';
import { Device, IDevice } from '../models/device.model';

export interface FirmwareUpdate {
  deviceId: string;
  currentVersion: string;
  targetVersion: string;
  status: 'pending' | 'downloading' | 'installing' | 'completed' | 'failed';
  progress: number;
  startedAt?: Date;
  completedAt?: Date;
  error?: string;
}

export interface FirmwareMetadata {
  version: string;
  releaseDate: Date;
  size: number;
  checksum: string;
  changelog: string[];
  critical: boolean;
  minVersion?: string;
  url: string;
}

export class FirmwareUpdateService extends EventEmitter {
  private activeUpdates: Map<string, FirmwareUpdate> = new Map();
  private firmwareRegistry: Map<string, FirmwareMetadata[]> = new Map();

  constructor() {
    super();
    this.initializeFirmwareRegistry();
  }

  private initializeFirmwareRegistry(): void {
    // Simulate firmware registry
    this.firmwareRegistry.set('Philips_Hue_White', [
      {
        version: '1.2.5',
        releaseDate: new Date('2024-01-15'),
        size: 524288,
        checksum: 'abc123def456',
        changelog: ['Bug fixes', 'Performance improvements', 'Security patches'],
        critical: false,
        url: 'https://firmware.example.com/philips/hue/1.2.5.bin',
      },
      {
        version: '1.3.0',
        releaseDate: new Date('2024-02-01'),
        size: 589824,
        checksum: 'def789ghi012',
        changelog: ['New features', 'Enhanced stability', 'Energy optimization'],
        critical: true,
        minVersion: '1.2.0',
        url: 'https://firmware.example.com/philips/hue/1.3.0.bin',
      },
    ]);
  }

  async checkForUpdates(device: IDevice): Promise<FirmwareMetadata | null> {
    const deviceKey = `${device.manufacturer}_${device.model.replace(/\s+/g, '_')}`;
    const availableFirmware = this.firmwareRegistry.get(deviceKey);

    if (!availableFirmware || availableFirmware.length === 0) {
      return null;
    }

    // Find latest firmware newer than current version
    const latestFirmware = availableFirmware
      .filter(fw => this.compareVersions(fw.version, device.firmwareVersion) > 0)
      .sort((a, b) => this.compareVersions(b.version, a.version))[0];

    return latestFirmware || null;
  }

  async updateFirmware(deviceId: string, targetVersion: string): Promise<void> {
    const device = await Device.findById(deviceId);
    if (!device) {
      throw new Error('Device not found');
    }

    if (this.activeUpdates.has(deviceId)) {
      throw new Error('Update already in progress for this device');
    }

    const update: FirmwareUpdate = {
      deviceId,
      currentVersion: device.firmwareVersion,
      targetVersion,
      status: 'pending',
      progress: 0,
      startedAt: new Date(),
    };

    this.activeUpdates.set(deviceId, update);
    this.emit('update:started', update);

    try {
      // Update device status
      device.status = 'updating';
      await device.save();

      // Download firmware
      await this.downloadFirmware(update);

      // Install firmware
      await this.installFirmware(update);

      // Complete update
      update.status = 'completed';
      update.progress = 100;
      update.completedAt = new Date();

      device.firmwareVersion = targetVersion;
      device.status = 'online';
      await device.save();

      this.emit('update:completed', update);
      logger.info('Firmware update completed', { deviceId, targetVersion });
    } catch (error: any) {
      update.status = 'failed';
      update.error = error.message;
      update.completedAt = new Date();

      device.status = 'error';
      await device.save();

      this.emit('update:failed', update);
      logger.error('Firmware update failed', { deviceId, error: error.message });
      throw error;
    } finally {
      setTimeout(() => {
        this.activeUpdates.delete(deviceId);
      }, 60000); // Keep in memory for 1 minute
    }
  }

  private async downloadFirmware(update: FirmwareUpdate): Promise<void> {
    update.status = 'downloading';
    this.emit('update:progress', update);

    // Simulate download with progress updates
    for (let i = 0; i <= 50; i += 10) {
      await new Promise(resolve => setTimeout(resolve, 500));
      update.progress = i;
      this.emit('update:progress', update);
    }

    logger.info('Firmware downloaded', { deviceId: update.deviceId });
  }

  private async installFirmware(update: FirmwareUpdate): Promise<void> {
    update.status = 'installing';
    update.progress = 50;
    this.emit('update:progress', update);

    // Simulate installation with progress updates
    for (let i = 50; i <= 90; i += 10) {
      await new Promise(resolve => setTimeout(resolve, 1000));
      update.progress = i;
      this.emit('update:progress', update);
    }

    // Simulate device reboot
    await new Promise(resolve => setTimeout(resolve, 2000));
    update.progress = 95;
    this.emit('update:progress', update);

    logger.info('Firmware installed', { deviceId: update.deviceId });
  }

  async scheduleUpdate(deviceId: string, targetVersion: string, scheduledTime: Date): Promise<void> {
    const delay = scheduledTime.getTime() - Date.now();
    
    if (delay <= 0) {
      throw new Error('Scheduled time must be in the future');
    }

    setTimeout(() => {
      this.updateFirmware(deviceId, targetVersion).catch(error => {
        logger.error('Scheduled update failed', { deviceId, error: error.message });
      });
    }, delay);

    logger.info('Firmware update scheduled', { deviceId, scheduledTime });
  }

  async batchUpdate(deviceIds: string[], targetVersion: string): Promise<void> {
    logger.info('Starting batch firmware update', { 
      deviceCount: deviceIds.length,
      targetVersion,
    });

    const updatePromises = deviceIds.map(deviceId =>
      this.updateFirmware(deviceId, targetVersion).catch(error => {
        logger.error('Batch update failed for device', { deviceId, error: error.message });
        return null;
      })
    );

    await Promise.all(updatePromises);
    logger.info('Batch firmware update completed');
  }

  getUpdateStatus(deviceId: string): FirmwareUpdate | null {
    return this.activeUpdates.get(deviceId) || null;
  }

  getAllActiveUpdates(): FirmwareUpdate[] {
    return Array.from(this.activeUpdates.values());
  }

  private compareVersions(v1: string, v2: string): number {
    const parts1 = v1.split('.').map(Number);
    const parts2 = v2.split('.').map(Number);

    for (let i = 0; i < Math.max(parts1.length, parts2.length); i++) {
      const part1 = parts1[i] || 0;
      const part2 = parts2[i] || 0;

      if (part1 > part2) return 1;
      if (part1 < part2) return -1;
    }

    return 0;
  }

  async rollbackFirmware(deviceId: string, targetVersion: string): Promise<void> {
    logger.info('Rolling back firmware', { deviceId, targetVersion });
    await this.updateFirmware(deviceId, targetVersion);
  }
}

export const firmwareUpdateService = new FirmwareUpdateService();
