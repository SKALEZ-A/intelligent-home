import express, { Application } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import { logger } from '../../shared/utils/logger';
import { errorHandler } from '../../shared/middleware/error-handler';
import { notificationRoutes } from './routes/notification.routes';
import { connectDatabase } from './config/database';

const app: Application = express();
const PORT = process.env.NOTIFICATION_SERVICE_PORT || 3004;

// Middleware
app.use(helmet());
app.use(cors());
app.use(compression());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Request logging
app.use((req, res, next) => {
  logger.info(`${req.method} ${req.path}`, {
    ip: req.ip,
    userAgent: req.get('user-agent'),
  });
  next();
});

// Health check
app.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    service: 'notification-service',
    timestamp: new Date().toISOString(),
  });
});

// Routes
app.use('/api/notifications', notificationRoutes);

// Error handling
app.use(errorHandler);

// Start server
const startServer = async () => {
  try {
    await connectDatabase();
    
    app.listen(PORT, () => {
      logger.info(`Notification service listening on port ${PORT}`);
    });
  } catch (error) {
    logger.error('Failed to start notification service', error);
    process.exit(1);
  }
};

startServer();

export default app;
