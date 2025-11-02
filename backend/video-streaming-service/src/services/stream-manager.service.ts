import { WebSocketServer, WebSocket } from 'ws';
import ffmpeg from 'fluent-ffmpeg';
import { logger } from '../utils/logger';
import { EventEmitter } from 'events';

interface StreamConfig {
  cameraId: string;
  rtspUrl: string;
  quality: 'low' | 'medium' | 'high';
  fps: number;
}

interface ActiveStream {
  cameraId: string;
  clients: Set<WebSocket>;
  ffmpegProcess: any;
  startedAt: Date;
}

export class StreamManager extends EventEmitter {
  private wss: WebSocketServer;
  private activeStreams: Map<string, ActiveStream>;
  private clientStreams: Map<WebSocket, string>;

  constructor(wss: WebSocketServer) {
    super();
    this.wss = wss;
    this.activeStreams = new Map();
    this.clientStreams = new Map();
    this.setupWebSocketServer();
  }

  private setupWebSocketServer(): void {
    this.wss.on('connection', (ws: WebSocket, req) => {
      const cameraId = new URL(req.url!, `http://${req.headers.host}`).searchParams.get('cameraId');
      
      if (!cameraId) {
        ws.close(1008, 'Camera ID required');
        return;
      }

      logger.info(`Client connected to stream: ${cameraId}`);
      this.addClient(cameraId, ws);

      ws.on('close', () => {
        logger.info(`Client disconnected from stream: ${cameraId}`);
        this.removeClient(cameraId, ws);
      });

      ws.on('error', (error) => {
        logger.error(`WebSocket error for camera ${cameraId}:`, error);
        this.removeClient(cameraId, ws);
      });
    });
  }

  async startStream(config: StreamConfig): Promise<void> {
    const { cameraId, rtspUrl, quality, fps } = config;

    if (this.activeStreams.has(cameraId)) {
      logger.info(`Stream already active for camera: ${cameraId}`);
      return;
    }

    logger.info(`Starting stream for camera: ${cameraId}`);

    const stream: ActiveStream = {
      cameraId,
      clients: new Set(),
      ffmpegProcess: null,
      startedAt: new Date()
    };

    // Configure FFmpeg based on quality
    const videoSize = this.getVideoSize(quality);
    const videoBitrate = this.getVideoBitrate(quality);

    const ffmpegProcess = ffmpeg(rtspUrl)
      .inputOptions([
        '-rtsp_transport', 'tcp',
        '-analyzeduration', '1000000',
        '-probesize', '1000000'
      ])
      .videoCodec('libx264')
      .videoBitrate(videoBitrate)
      .size(videoSize)
      .fps(fps)
      .format('mpegts')
      .outputOptions([
        '-preset', 'ultrafast',
        '-tune', 'zerolatency',
        '-g', String(fps * 2),
        '-sc_threshold', '0'
      ])
      .on('start', (commandLine) => {
        logger.info(`FFmpeg started for camera ${cameraId}: ${commandLine}`);
      })
      .on('error', (err) => {
        logger.error(`FFmpeg error for camera ${cameraId}:`, err);
        this.stopStream(cameraId);
        this.emit('streamError', { cameraId, error: err.message });
      })
      .on('end', () => {
        logger.info(`FFmpeg ended for camera ${cameraId}`);
        this.stopStream(cameraId);
      });

    // Pipe output to WebSocket clients
    const outputStream = ffmpegProcess.pipe();
    
    outputStream.on('data', (chunk: Buffer) => {
      this.broadcastToClients(cameraId, chunk);
    });

    stream.ffmpegProcess = ffmpegProcess;
    this.activeStreams.set(cameraId, stream);

    this.emit('streamStarted', { cameraId });
  }

  stopStream(cameraId: string): void {
    const stream = this.activeStreams.get(cameraId);
    
    if (!stream) {
      return;
    }

    logger.info(`Stopping stream for camera: ${cameraId}`);

    // Kill FFmpeg process
    if (stream.ffmpegProcess) {
      stream.ffmpegProcess.kill('SIGKILL');
    }

    // Close all client connections
    stream.clients.forEach(client => {
      if (client.readyState === WebSocket.OPEN) {
        client.close(1000, 'Stream stopped');
      }
    });

    this.activeStreams.delete(cameraId);
    this.emit('streamStopped', { cameraId });
  }

  private addClient(cameraId: string, ws: WebSocket): void {
    let stream = this.activeStreams.get(cameraId);
    
    if (!stream) {
      // Stream not active, will be started by route handler
      return;
    }

    stream.clients.add(ws);
    this.clientStreams.set(ws, cameraId);
    
    logger.info(`Client added to stream ${cameraId}. Total clients: ${stream.clients.size}`);
  }

  private removeClient(cameraId: string, ws: WebSocket): void {
    const stream = this.activeStreams.get(cameraId);
    
    if (!stream) {
      return;
    }

    stream.clients.delete(ws);
    this.clientStreams.delete(ws);
    
    logger.info(`Client removed from stream ${cameraId}. Remaining clients: ${stream.clients.size}`);

    // Stop stream if no clients left
    if (stream.clients.size === 0) {
      setTimeout(() => {
        const currentStream = this.activeStreams.get(cameraId);
        if (currentStream && currentStream.clients.size === 0) {
          this.stopStream(cameraId);
        }
      }, 30000); // 30 second grace period
    }
  }

  private broadcastToClients(cameraId: string, data: Buffer): void {
    const stream = this.activeStreams.get(cameraId);
    
    if (!stream) {
      return;
    }

    stream.clients.forEach(client => {
      if (client.readyState === WebSocket.OPEN) {
        try {
          client.send(data);
        } catch (error) {
          logger.error(`Error sending data to client:`, error);
          this.removeClient(cameraId, client);
        }
      }
    });
  }

  private getVideoSize(quality: string): string {
    switch (quality) {
      case 'low':
        return '640x360';
      case 'medium':
        return '1280x720';
      case 'high':
        return '1920x1080';
      default:
        return '1280x720';
    }
  }

  private getVideoBitrate(quality: string): string {
    switch (quality) {
      case 'low':
        return '500k';
      case 'medium':
        return '1500k';
      case 'high':
        return '3000k';
      default:
        return '1500k';
    }
  }

  getActiveStreamCount(): number {
    return this.activeStreams.size;
  }

  getStreamInfo(cameraId: string): any {
    const stream = this.activeStreams.get(cameraId);
    
    if (!stream) {
      return null;
    }

    return {
      cameraId: stream.cameraId,
      clientCount: stream.clients.size,
      startedAt: stream.startedAt,
      uptime: Date.now() - stream.startedAt.getTime()
    };
  }

  getAllStreams(): any[] {
    const streams: any[] = [];
    
    this.activeStreams.forEach((stream, cameraId) => {
      streams.push(this.getStreamInfo(cameraId));
    });

    return streams;
  }
}
