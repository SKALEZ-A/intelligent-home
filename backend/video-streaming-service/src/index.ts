import express, { Application } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import dotenv from 'dotenv';
import { createServer } from 'http';
import { WebSocketServer } from 'ws';
import { logger } from './utils/logger';
import { errorHandler } from './middleware/error-handler';
import cameraRoutes from './routes/camera.routes';
import streamRoutes from './routes/stream.routes';
import recordingRoutes from './routes/recording.routes';
import { StreamManager } from './services/stream-manager.service';

dotenv.config();

const app: Application = express();
const PORT = process.env.PORT || 3010;

// Create HTTP server
const server = createServer(app);

// Create WebSocket server for streaming
const wss = new WebSocketServer({ server, path: '/ws/stream' });

// Initialize stream manager
const streamManager = new StreamManager(wss);

// Middleware
app.use(helmet());
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Make stream manager available to routes
app.locals.streamManager = streamManager;

// Routes
app.use('/api/cameras', cameraRoutes);
app.use('/api/streams', streamRoutes);
app.use('/api/recordings', recordingRoutes);

// Health check
app.get('/health', (req, res) => {
  res.json({ 
    status: 'healthy', 
    service: 'video-streaming',
    activeStreams: streamManager.getActiveStreamCount(),
    timestamp: new Date() 
  });
});

// Error handling
app.use(errorHandler);

server.listen(PORT, () => {
  logger.info(`Video Streaming Service running on port ${PORT}`);
});

export default app;
