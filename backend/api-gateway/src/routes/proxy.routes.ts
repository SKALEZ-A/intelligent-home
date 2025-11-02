import { Router, Request, Response, NextFunction } from 'express';
import { LoadBalancerService } from '../services/load-balancer.service';
import { CircuitBreakerService } from '../services/circuit-breaker.service';
import { RequestTracingService } from '../services/request-tracing.service';
import axios from 'axios';

const router = Router();
const loadBalancer = new LoadBalancerService();
const circuitBreaker = new CircuitBreakerService();
const requestTracing = new RequestTracingService();

const serviceMap = {
  auth: process.env.AUTH_SERVICE_URL || 'http://auth-service:3001',
  device: process.env.DEVICE_SERVICE_URL || 'http://device-service:3002',
  automation: process.env.AUTOMATION_SERVICE_URL || 'http://automation-service:3003',
  energy: process.env.ENERGY_SERVICE_URL || 'http://energy-service:3004',
  notification: process.env.NOTIFICATION_SERVICE_URL || 'http://notification-service:3005',
  weather: process.env.WEATHER_SERVICE_URL || 'http://weather-service:3006',
  video: process.env.VIDEO_SERVICE_URL || 'http://video-streaming-service:3007',
  voice: process.env.VOICE_SERVICE_URL || 'http://voice-assistant-service:3008',
  integration: process.env.INTEGRATION_SERVICE_URL || 'http://integration-service:3009'
};

router.all('/:service/*', async (req: Request, res: Response, next: NextFunction) => {
  const { service } = req.params;
  const traceId = requestTracing.generateTraceId();
  
  try {
    if (!serviceMap[service]) {
      return res.status(404).json({ error: 'Service not found' });
    }

    const serviceUrl = loadBalancer.getServiceInstance(service, Object.values(serviceMap));
    const targetPath = req.originalUrl.replace(`/${service}`, '');
    const targetUrl = `${serviceUrl}${targetPath}`;

    const response = await circuitBreaker.execute(service, async () => {
      return await axios({
        method: req.method,
        url: targetUrl,
        data: req.body,
        headers: {
          ...req.headers,
          'x-trace-id': traceId,
          'x-forwarded-for': req.ip,
          'x-forwarded-proto': req.protocol,
          'x-forwarded-host': req.hostname
        },
        params: req.query,
        timeout: 30000
      });
    });

    requestTracing.logRequest(traceId, service, req.method, targetPath, response.status);
    
    res.status(response.status).json(response.data);
  } catch (error) {
    requestTracing.logError(traceId, service, error);
    
    if (error.response) {
      res.status(error.response.status).json(error.response.data);
    } else if (error.message.includes('Circuit breaker is open')) {
      res.status(503).json({ error: 'Service temporarily unavailable' });
    } else {
      res.status(500).json({ error: 'Internal server error' });
    }
  }
});

export default router;
