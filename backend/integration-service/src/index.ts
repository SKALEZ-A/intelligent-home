import express from 'express';
import { webhookRouter } from './routes/webhook.routes';
import { iftttRouter } from './routes/ifttt.routes';
import { zapierRouter } from './routes/zapier.routes';
import { homeAssistantRouter } from './routes/home-assistant.routes';
import { errorHandler } from './middleware/error-handler';
import { WebhookService } from './services/webhook.service';
import { IFTTTService } from './services/ifttt.service';
import { logger } from './utils/logger';

const app = express();
const PORT = process.env.PORT || 3700;

app.use(express.json());

// Initialize services
const webhookService = new WebhookService();
const iftttService = new IFTTTService();

// Routes
app.use('/api/webhooks', webhookRouter);
app.use('/api/ifttt', iftttRouter);
app.use('/api/zapier', zapierRouter);
app.use('/api/home-assistant', homeAssistantRouter);

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'healthy', service: 'integration-service' });
});

app.use(errorHandler);

app.listen(PORT, () => {
  logger.info(`Integration service listening on port ${PORT}`);
});

export default app;
