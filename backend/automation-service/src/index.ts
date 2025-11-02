import express, { Application, Request, Response, NextFunction } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import { AutomationEngineService } from './services/automation-engine.service';
import { TriggerHandlerService } from './services/trigger-handler.service';
import { ConditionEvaluatorService } from './services/condition-evaluator.service';
import { ActionExecutorService } from './services/action-executor.service';
import automationRoutes from './routes/automation.routes';
import sceneRoutes from './routes/scene.routes';
import { logger } from '../../shared/utils/logger';
import { errorHandler } from '../../shared/middleware/error-handler';
import { connectDatabase } from './config/database';
import { connectRedis } from './config/redis';

const app: Application = express();
const PORT = process.env.AUTOMATION_SERVICE_PORT || 3003;

// Middleware
app.use(helmet());
app.use(cors());
app.use(compression());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Request logging
app.use((req: Request, res: Response, next: NextFunction) => {
  logger.info(`${req.method} ${req.path}`, { 
    ip: req.ip, 
    userAgent: req.get('user-agent') 
  });
  next();
});

// Health check
app.get('/health', (req: Request, res: Response) => {
  res.status(200).json({ 
    status: 'healthy', 
    service: 'automation-service',
    timestamp: new Date().toISOString()
  });
});

// Routes
app.use('/api/automations', automationRoutes);
app.use('/api/scenes', sceneRoutes);

// Error handling
app.use(errorHandler);

// Initialize services and start server
async function startServer() {
  try {
    await connectDatabase();
    await connectRedis();
    
    // Initialize automation engine
    const automationEngine = AutomationEngineService.getInstance();
    await automationEngine.initialize();
    
    app.listen(PORT, () => {
      logger.info(`Automation Service running on port ${PORT}`);
    });
  } catch (error) {
    logger.error('Failed to start Automation Service', error);
    process.exit(1);
  }
}

startServer();

export default app;
