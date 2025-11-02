import { Router } from 'express';
import { authenticate } from '../middleware/authenticate';
import { rateLimiter } from '../middleware/rate-limiter';
import { requestValidator } from '../middleware/request-validator';
import { cors } from '../middleware/cors';

const router = Router();

router.use(cors);
router.use(rateLimiter);

router.get('/health', (req, res) => {
  res.json({ status: 'healthy', timestamp: new Date() });
});

router.use('/auth', require('../../auth-service/src/routes/auth.routes'));
router.use('/devices', authenticate, require('../../device-service/src/routes/device.routes'));
router.use('/automations', authenticate, require('../../automation-service/src/routes/automation.routes'));
router.use('/scenes', authenticate, require('../../automation-service/src/routes/scene.routes'));
router.use('/energy', authenticate, require('../../energy-service/src/routes/energy.routes'));
router.use('/notifications', authenticate, require('../../notification-service/src/routes/notification.routes'));
router.use('/weather', authenticate, require('../../weather-service/src/routes/weather.routes'));
router.use('/integrations', authenticate, require('../../integration-service/src/routes/integration.routes'));
router.use('/voice', authenticate, require('../../voice-assistant-service/src/routes/voice.routes'));
router.use('/stream', authenticate, require('../../video-streaming-service/src/routes/stream.routes'));

export default router;
