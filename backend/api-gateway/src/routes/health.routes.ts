import { Router, Request, Response } from 'express';
import { HealthCheckService } from '../../../shared/services/health-check.service';
import { MetricsService } from '../../../shared/services/metrics.service';

const router = Router();
const healthCheckService = new HealthCheckService();
const metricsService = new MetricsService();

router.get('/health', async (req: Request, res: Response) => {
  try {
    const health = await healthCheckService.checkHealth();
    res.status(health.status === 'healthy' ? 200 : 503).json(health);
  } catch (error) {
    res.status(503).json({ status: 'unhealthy', error: error.message });
  }
});

router.get('/health/detailed', async (req: Request, res: Response) => {
  try {
    const detailedHealth = await healthCheckService.getDetailedHealth();
    res.json(detailedHealth);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/metrics', async (req: Request, res: Response) => {
  try {
    const metrics = await metricsService.getMetrics();
    res.json(metrics);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/ready', async (req: Request, res: Response) => {
  try {
    const ready = await healthCheckService.isReady();
    res.status(ready ? 200 : 503).json({ ready });
  } catch (error) {
    res.status(503).json({ ready: false, error: error.message });
  }
});

router.get('/live', (req: Request, res: Response) => {
  res.json({ alive: true, timestamp: new Date().toISOString() });
});

export default router;
