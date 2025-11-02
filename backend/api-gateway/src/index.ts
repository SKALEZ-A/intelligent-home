import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { createProxyMiddleware } from 'http-proxy-middleware';
import { rateLimiter } from './middleware/rate-limiter';
import { authenticate } from './middleware/authenticate';
import { logger } from './utils/logger';

const app = express();
const PORT = process.env.PORT || 3000;

app.use(helmet());
app.use(cors());
app.use(express.json());
app.use(rateLimiter);

const services = {
  auth: process.env.AUTH_SERVICE_URL || 'http://localhost:3001',
  device: process.env.DEVICE_SERVICE_URL || 'http://localhost:3002',
  automation: process.env.AUTOMATION_SERVICE_URL || 'http://localhost:3003',
  notification: process.env.NOTIFICATION_SERVICE_URL || 'http://localhost:3004',
  energy: process.env.ENERGY_SERVICE_URL || 'http://localhost:3005',
  weather: process.env.WEATHER_SERVICE_URL || 'http://localhost:3006',
  integration: process.env.INTEGRATION_SERVICE_URL || 'http://localhost:3007',
  video: process.env.VIDEO_SERVICE_URL || 'http://localhost:3008',
  voice: process.env.VOICE_SERVICE_URL || 'http://localhost:3009',
};

app.use('/api/auth', createProxyMiddleware({
  target: services.auth,
  changeOrigin: true,
  pathRewrite: { '^/api/auth': '' },
}));

app.use('/api/devices', authenticate, createProxyMiddleware({
  target: services.device,
  changeOrigin: true,
  pathRewrite: { '^/api/devices': '' },
}));

app.use('/api/automation', authenticate, createProxyMiddleware({
  target: services.automation,
  changeOrigin: true,
  pathRewrite: { '^/api/automation': '' },
}));

app.use('/api/notifications', authenticate, createProxyMiddleware({
  target: services.notification,
  changeOrigin: true,
  pathRewrite: { '^/api/notifications': '' },
}));

app.use('/api/energy', authenticate, createProxyMiddleware({
  target: services.energy,
  changeOrigin: true,
  pathRewrite: { '^/api/energy': '' },
}));

app.use('/api/weather', authenticate, createProxyMiddleware({
  target: services.weather,
  changeOrigin: true,
  pathRewrite: { '^/api/weather': '' },
}));

app.use('/api/integrations', authenticate, createProxyMiddleware({
  target: services.integration,
  changeOrigin: true,
  pathRewrite: { '^/api/integrations': '' },
}));

app.use('/api/video', authenticate, createProxyMiddleware({
  target: services.video,
  changeOrigin: true,
  pathRewrite: { '^/api/video': '' },
}));

app.use('/api/voice', authenticate, createProxyMiddleware({
  target: services.voice,
  changeOrigin: true,
  pathRewrite: { '^/api/voice': '' },
}));

app.get('/health', (req, res) => {
  res.json({ status: 'healthy', timestamp: new Date() });
});

app.listen(PORT, () => {
  logger.info(`API Gateway running on port ${PORT}`);
});
