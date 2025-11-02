import { logger } from '../../../../shared/utils/logger';
import * as fs from 'fs/promises';
import * as path from 'path';

interface Recording {
  id: string;
  cameraId: string;
  startTime: Date;
  endTime?: Date;
  duration: number;
  fileSize: number;
  filePath: string;
  thumbnailPath?: string;
  metadata: {
    resolution: string;
    fps: number;
    codec: string;
  };
}

interface RecordingOptions {
  duration?: number;
  quality?: 'low' | 'medium' | 'high';
  motion?: boolean;
  continuous?: boolean;
}

export class RecordingService {
  private recordings: Map<string, Recording> = new Map();
  private activeRecordings: Map<string, NodeJS.Timeout> = new Map();
  private recordingsDir: string;

  constructor(recordingsDir: string = './recordings') {
    this.recordingsDir = recordingsDir;
    this.ensureRecordingsDirectory();
  }

  private async ensureRecordingsDirectory(): Promise<void> {
    try {
      await fs.mkdir(this.recordingsDir, { recursive: true });
    } catch (error) {
      logger.error('Failed to create recordings directory', { error });
    }
  }

  public async startRecording(cameraId: string, options: RecordingOptions = {}): Promise<string> {
    const recordingId = this.generateRecordingId();
    const startTime = new Date();

    const recording: Recording = {
      id: recordingId,
      cameraId,
      startTime,
      duration: 0,
      fileSize: 0,
      filePath: path.join(this.recordingsDir, `${recordingId}.mp4`),
      metadata: {
        resolution: this.getResolution(options.quality),
        fps: 30,
        codec: 'h264'
      }
    };

    this.recordings.set(recordingId, recording);

    logger.info('Recording started', { recordingId, cameraId, options });

    // Set auto-stop if duration specified
    if (options.duration) {
      const timeout = setTimeout(() => {
        this.stopRecording(recordingId);
      }, options.duration * 1000);

      this.activeRecordings.set(recordingId, timeout);
    }

    return recordingId;
  }

  public async stopRecording(recordingId: string): Promise<Recording> {
    const recording = this.recordings.get(recordingId);
    if (!recording) {
      throw new Error(`Recording not found: ${recordingId}`);
    }

    if (recording.endTime) {
      throw new Error(`Recording already stopped: ${recordingId}`);
    }

    recording.endTime = new Date();
    recording.duration = (recording.endTime.getTime() - recording.startTime.getTime()) / 1000;

    // Clear auto-stop timeout
    const timeout = this.activeRecordings.get(recordingId);
    if (timeout) {
      clearTimeout(timeout);
      this.activeRecordings.delete(recordingId);
    }

    // Generate thumbnail
    await this.generateThumbnail(recording);

    logger.info('Recording stopped', { 
      recordingId, 
      duration: recording.duration,
      fileSize: recording.fileSize
    });

    return recording;
  }

  public async getRecording(recordingId: string): Promise<Recording | undefined> {
    return this.recordings.get(recordingId);
  }

  public async listRecordings(cameraId?: string, startDate?: Date, endDate?: Date): Promise<Recording[]> {
    let recordings = Array.from(this.recordings.values());

    if (cameraId) {
      recordings = recordings.filter(r => r.cameraId === cameraId);
    }

    if (startDate) {
      recordings = recordings.filter(r => r.startTime >= startDate);
    }

    if (endDate) {
      recordings = recordings.filter(r => r.startTime <= endDate);
    }

    return recordings.sort((a, b) => b.startTime.getTime() - a.startTime.getTime());
  }

  public async deleteRecording(recordingId: string): Promise<void> {
    const recording = this.recordings.get(recordingId);
    if (!recording) {
      throw new Error(`Recording not found: ${recordingId}`);
    }

    try {
      await fs.unlink(recording.filePath);
      
      if (recording.thumbnailPath) {
        await fs.unlink(recording.thumbnailPath);
      }

      this.recordings.delete(recordingId);

      logger.info('Recording deleted', { recordingId });
    } catch (error) {
      logger.error('Failed to delete recording', { recordingId, error });
      throw error;
    }
  }

  public async getRecordingStream(recordingId: string): Promise<any> {
    const recording = this.recordings.get(recordingId);
    if (!recording) {
      throw new Error(`Recording not found: ${recordingId}`);
    }

    // In production, return actual file stream
    return null;
  }

  private async generateThumbnail(recording: Recording): Promise<void> {
    const thumbnailPath = recording.filePath.replace('.mp4', '_thumb.jpg');
    
    // In production, generate actual thumbnail from video
    recording.thumbnailPath = thumbnailPath;
    
    logger.debug('Thumbnail generated', { recordingId: recording.id });
  }

  private getResolution(quality?: string): string {
    switch (quality) {
      case 'low':
        return '640x480';
      case 'medium':
        return '1280x720';
      case 'high':
        return '1920x1080';
      default:
        return '1280x720';
    }
  }

  private generateRecordingId(): string {
    return `rec_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  public async cleanupOldRecordings(daysToKeep: number = 30): Promise<number> {
    const cutoffDate = new Date(Date.now() - daysToKeep * 24 * 3600000);
    const recordingsToDelete = Array.from(this.recordings.values())
      .filter(r => r.startTime < cutoffDate);

    let deletedCount = 0;

    for (const recording of recordingsToDelete) {
      try {
        await this.deleteRecording(recording.id);
        deletedCount++;
      } catch (error) {
        logger.error('Failed to delete old recording', { recordingId: recording.id, error });
      }
    }

    logger.info('Old recordings cleaned up', { deletedCount, daysToKeep });

    return deletedCount;
  }
}

export const recordingService = new RecordingService();
