import express, { Express, Request, Response, NextFunction } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import { createServer } from 'http';
import { Server as SocketIOServer } from 'socket.io';
import { createLogger } from '../../../shared/utils/logger';
import { handleError } from '../../../shared/utils/errors';
import deviceRoutes from './routes/device.routes';
import { connectDatabase } from './config/database';
import { connectMongoDB } from './config/mongodb';
import { connectRedis } from './config/redis';
import { connectTimescaleDB } from './config/timescale';
import { MQTTService } from './services/mqtt.service';
import { WebSocketService } from './services/websocket.service';

const logger = createLogger('DeviceService');
const app: Express = express();
const httpServer = createServer(app);
const io = new SocketIOServer(httpServer, {
  cors: {
    origin: process.env.CORS_ORIGIN || '*',
    credentials: true,
  },
});

const PORT = process.env.PORT || 3200;

// Security middleware
app.use(helmet());
app.use(cors({
  origin: process.env.CORS_ORIGIN || '*',
  credentials: true,
}));

// Body parsing
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use(compression());

// Request logging
app.use((req: Request, res: Response, next: NextFunction) => {
  const start = Date.now();
  res.on('finish', () => {
    const duration = Date.now() - start;
    logger.http(`${req.method} ${req.path} ${res.statusCode} ${duration}ms`);
  });
  next();
});

// Health check
app.get('/health', (req: Request, res: Response) => {
  res.json({
    status: 'healthy',
    service: 'device-service',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
  });
});

// Routes
app.use('/api/devices', deviceRoutes);

// 404 handler
app.use((req: Request, res: Response) => {
  res.status(404).json({
    success: false,
    error: {
      code: 'NOT_FOUND',
      message: `Route ${req.method} ${req.path} not found`,
      timestamp: new Date(),
    },
  });
});

// Error handler
app.use((err: Error, req: Request, res: Response, next: NextFunction) => {
  logger.error('Unhandled error', err);
  const errorResponse = handleError(err);
  res.status(errorResponse.statusCode).json({
    success: false,
    error: {
      ...errorResponse,
      timestamp: new Date(),
      requestId: req.headers['x-request-id'] || 'unknown',
    },
  });
});

// Initialize services
let mqttService: MQTTService;
let wsService: WebSocketService;

async function startServer() {
  try {
    // Connect to databases
    await connectDatabase();
    await connectMongoDB();
    await connectRedis();
    await connectTimescaleDB();

    // Initialize MQTT
    mqttService = new MQTTService();
    await mqttService.connect();

    // Initialize WebSocket
    wsService = new WebSocketService(io);
    wsService.initialize();

    httpServer.listen(PORT, () => {
      logger.info(`Device Service listening on port ${PORT}`);
      logger.info(`Environment: ${process.env.NODE_ENV || 'development'}`);
    });
  } catch (error) {
    logger.error('Failed to start server', error as Error);
    process.exit(1);
  }
}

// Graceful shutdown
process.on('SIGTERM', async () => {
  logger.info('SIGTERM signal received: closing HTTP server');
  if (mqttService) await mqttService.disconnect();
  httpServer.close(() => {
    logger.info('HTTP server closed');
    process.exit(0);
  });
});

startServer();

export { app, io, mqttService, wsService };
