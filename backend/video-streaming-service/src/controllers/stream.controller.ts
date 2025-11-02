import { Request, Response } from 'express';
import { StreamManagerService } from '../services/stream-manager.service';
import { logger } from '../../../shared/utils/logger';

export class StreamController {
  private streamManager: StreamManagerService;

  constructor() {
    this.streamManager = new StreamManagerService();
  }

  async startStream(req: Request, res: Response): Promise<void> {
    try {
      const { deviceId, quality, userId } = req.body;
      const stream = await this.streamManager.startStream(deviceId, quality, userId);

      res.json({
        success: true,
        stream,
      });
    } catch (error: any) {
      logger.error('Failed to start stream', { error });
      res.status(500).json({
        success: false,
        error: error.message,
      });
    }
  }

  async stopStream(req: Request, res: Response): Promise<void> {
    try {
      const { streamId } = req.params;
      await this.streamManager.stopStream(streamId);

      res.json({
        success: true,
      });
    } catch (error: any) {
      logger.error('Failed to stop stream', { error });
      res.status(500).json({
        success: false,
        error: error.message,
      });
    }
  }

  async getStreamStatus(req: Request, res: Response): Promise<void> {
    try {
      const { streamId } = req.params;
      const status = await this.streamManager.getStreamStatus(streamId);

      res.json({
        success: true,
        status,
      });
    } catch (error: any) {
      logger.error('Failed to get stream status', { error });
      res.status(500).json({
        success: false,
        error: error.message,
      });
    }
  }

  async getActiveStreams(req: Request, res: Response): Promise<void> {
    try {
      const { userId } = req.query;
      const streams = await this.streamManager.getActiveStreams(userId as string);

      res.json({
        success: true,
        streams,
      });
    } catch (error: any) {
      logger.error('Failed to get active streams', { error });
      res.status(500).json({
        success: false,
        error: error.message,
      });
    }
  }
}
