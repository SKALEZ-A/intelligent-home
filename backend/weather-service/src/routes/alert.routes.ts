import { Router } from 'express';
import { AlertController } from '../controllers/alert.controller';
import { authenticate } from '../../../shared/middleware/authenticate';

const router = Router();
const alertController = new AlertController();

router.use(authenticate);

router.get('/', alertController.getAlerts.bind(alertController));
router.get('/active', alertController.getActiveAlerts.bind(alertController));
router.get('/:id', alertController.getAlertById.bind(alertController));
router.post('/subscribe', alertController.subscribeToAlerts.bind(alertController));
router.delete('/subscribe/:id', alertController.unsubscribeFromAlerts.bind(alertController));
router.get('/history', alertController.getAlertHistory.bind(alertController));

export default router;
