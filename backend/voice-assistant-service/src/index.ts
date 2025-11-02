import express, { Application } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import dotenv from 'dotenv';
import { logger } from './utils/logger';
import { errorHandler } from './middleware/error-handler';
import voiceRoutes from './routes/voice.routes';
import intentRoutes from './routes/intent.routes';
import profileRoutes from './routes/profile.routes';

dotenv.config();

const app: Application = express();
const PORT = process.env.PORT || 3009;

// Middleware
app.use(helmet());
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Routes
app.use('/api/voice', voiceRoutes);
app.use('/api/intents', intentRoutes);
app.use('/api/profiles', profileRoutes);

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'healthy', service: 'voice-assistant', timestamp: new Date() });
});

// Error handling
app.use(errorHandler);

app.listen(PORT, () => {
  logger.info(`Voice Assistant Service running on port ${PORT}`);
});

export default app;
