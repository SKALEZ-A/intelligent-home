import { Router } from 'express';
import { NotificationController } from '../controllers/notification.controller';
import { authenticate } from '../../../shared/middleware/authenticate';
import { validateRequest } from '../../../shared/middleware/validation';

const router = Router();
const controller = new NotificationController();

// All routes require authentication
router.use(authenticate);

// Get user notifications
router.get('/', controller.getUserNotifications.bind(controller));

// Get notification by ID
router.get('/:id', controller.getNotification.bind(controller));

// Send notification
router.post('/send', controller.sendNotification.bind(controller));

// Mark notification as read
router.patch('/:id/read', controller.markAsRead.bind(controller));

// Mark all as read
router.patch('/read-all', controller.markAllAsRead.bind(controller));

// Dismiss notification
router.patch('/:id/dismiss', controller.dismissNotification.bind(controller));

// Delete notification
router.delete('/:id', controller.deleteNotification.bind(controller));

// Get notification preferences
router.get('/preferences', controller.getPreferences.bind(controller));

// Update notification preferences
router.put('/preferences', controller.updatePreferences.bind(controller));

// Register device token for push notifications
router.post('/devices/register', controller.registerDevice.bind(controller));

// Unregister device token
router.delete('/devices/:token', controller.unregisterDevice.bind(controller));

// Subscribe to topic
router.post('/topics/subscribe', controller.subscribeToTopic.bind(controller));

// Unsubscribe from topic
router.post('/topics/unsubscribe', controller.unsubscribeFromTopic.bind(controller));

export { router as notificationRoutes };
