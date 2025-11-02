import { logger } from '../utils/logger';
import { encryptionService } from './encryption.service';
import * as fs from 'fs/promises';
import * as path from 'path';
import * as zlib from 'zlib';
import { promisify } from 'util';

const gzip = promisify(zlib.gzip);
const gunzip = promisify(zlib.gunzip);

interface BackupMetadata {
  id: string;
  timestamp: Date;
  type: 'full' | 'incremental';
  size: number;
  encrypted: boolean;
  compressed: boolean;
  checksum: string;
}

interface BackupOptions {
  encrypt?: boolean;
  compress?: boolean;
  includeFiles?: string[];
  excludeFiles?: string[];
}

export class BackupService {
  private backupDir: string;
  private backups: Map<string, BackupMetadata> = new Map();

  constructor(backupDir: string = './backups') {
    this.backupDir = backupDir;
    this.ensureBackupDirectory();
  }

  private async ensureBackupDirectory(): Promise<void> {
    try {
      await fs.mkdir(this.backupDir, { recursive: true });
    } catch (error) {
      logger.error('Failed to create backup directory', { error });
    }
  }

  public async createBackup(
    data: any,
    type: 'full' | 'incremental' = 'full',
    options: BackupOptions = {}
  ): Promise<string> {
    const backupId = this.generateBackupId();
    const timestamp = new Date();

    try {
      let backupData = JSON.stringify(data);

      // Compress if requested
      if (options.compress !== false) {
        const compressed = await gzip(Buffer.from(backupData));
        backupData = compressed.toString('base64');
      }

      // Encrypt if requested
      if (options.encrypt !== false) {
        backupData = encryptionService.encrypt(backupData);
      }

      // Calculate checksum
      const checksum = encryptionService.hash(backupData).hash;

      // Write backup file
      const filename = `backup_${backupId}.dat`;
      const filepath = path.join(this.backupDir, filename);
      await fs.writeFile(filepath, backupData);

      // Store metadata
      const metadata: BackupMetadata = {
        id: backupId,
        timestamp,
        type,
        size: Buffer.byteLength(backupData),
        encrypted: options.encrypt !== false,
        compressed: options.compress !== false,
        checksum
      };

      this.backups.set(backupId, metadata);
      await this.saveMetadata();

      logger.info('Backup created successfully', { backupId, type, size: metadata.size });

      return backupId;
    } catch (error) {
      logger.error('Backup creation failed', { backupId, error });
      throw new Error('Failed to create backup');
    }
  }

  public async restoreBackup(backupId: string): Promise<any> {
    const metadata = this.backups.get(backupId);
    if (!metadata) {
      throw new Error(`Backup not found: ${backupId}`);
    }

    try {
      const filename = `backup_${backupId}.dat`;
      const filepath = path.join(this.backupDir, filename);
      let backupData = await fs.readFile(filepath, 'utf-8');

      // Decrypt if encrypted
      if (metadata.encrypted) {
        backupData = encryptionService.decrypt(backupData);
      }

      // Decompress if compressed
      if (metadata.compressed) {
        const decompressed = await gunzip(Buffer.from(backupData, 'base64'));
        backupData = decompressed.toString('utf-8');
      }

      // Verify checksum
      const checksum = encryptionService.hash(
        metadata.encrypted ? encryptionService.encrypt(backupData) : backupData
      ).hash;

      if (checksum !== metadata.checksum) {
        throw new Error('Backup checksum verification failed');
      }

      const data = JSON.parse(backupData);

      logger.info('Backup restored successfully', { backupId });

      return data;
    } catch (error) {
      logger.error('Backup restoration failed', { backupId, error });
      throw new Error('Failed to restore backup');
    }
  }

  public async listBackups(type?: 'full' | 'incremental'): Promise<BackupMetadata[]> {
    let backups = Array.from(this.backups.values());

    if (type) {
      backups = backups.filter(b => b.type === type);
    }

    return backups.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
  }

  public async deleteBackup(backupId: string): Promise<void> {
    const metadata = this.backups.get(backupId);
    if (!metadata) {
      throw new Error(`Backup not found: ${backupId}`);
    }

    try {
      const filename = `backup_${backupId}.dat`;
      const filepath = path.join(this.backupDir, filename);
      await fs.unlink(filepath);

      this.backups.delete(backupId);
      await this.saveMetadata();

      logger.info('Backup deleted', { backupId });
    } catch (error) {
      logger.error('Backup deletion failed', { backupId, error });
      throw new Error('Failed to delete backup');
    }
  }

  public async cleanupOldBackups(daysToKeep: number = 30): Promise<number> {
    const cutoffDate = new Date(Date.now() - daysToKeep * 24 * 3600000);
    const backupsToDelete = Array.from(this.backups.values())
      .filter(b => b.timestamp < cutoffDate);

    let deletedCount = 0;

    for (const backup of backupsToDelete) {
      try {
        await this.deleteBackup(backup.id);
        deletedCount++;
      } catch (error) {
        logger.error('Failed to delete old backup', { backupId: backup.id, error });
      }
    }

    logger.info('Old backups cleaned up', { deletedCount, daysToKeep });

    return deletedCount;
  }

  private generateBackupId(): string {
    return `${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private async saveMetadata(): Promise<void> {
    const metadataPath = path.join(this.backupDir, 'metadata.json');
    const metadata = Array.from(this.backups.entries());
    await fs.writeFile(metadataPath, JSON.stringify(metadata, null, 2));
  }

  private async loadMetadata(): Promise<void> {
    try {
      const metadataPath = path.join(this.backupDir, 'metadata.json');
      const data = await fs.readFile(metadataPath, 'utf-8');
      const metadata = JSON.parse(data);
      this.backups = new Map(metadata);
    } catch (error) {
      logger.warn('Failed to load backup metadata', { error });
    }
  }
}

export const backupService = new BackupService();
