import { Router } from 'express';
import { IntegrationController } from '../controllers/integration.controller';
import { authenticate } from '../../../shared/middleware/authenticate';

const router = Router();
const integrationController = new IntegrationController();

router.use(authenticate);

router.post('/webhooks', integrationController.createWebhook.bind(integrationController));
router.get('/webhooks', integrationController.listWebhooks.bind(integrationController));
router.delete('/webhooks/:webhookId', integrationController.deleteWebhook.bind(integrationController));
router.post('/ifttt/trigger', integrationController.triggerIFTTT.bind(integrationController));

export default router;
