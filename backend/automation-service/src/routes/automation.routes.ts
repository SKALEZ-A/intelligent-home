import { Router } from 'express';
import { AutomationController } from '../controllers/automation.controller';
import { authenticate } from '../../../shared/middleware/authenticate';
import { validateRequest } from '../../../shared/middleware/validation';
import { automationValidators } from '../validators/automation.validators';

const router = Router();
const automationController = new AutomationController();

// All routes require authentication
router.use(authenticate);

// Create automation
router.post(
  '/',
  validateRequest(automationValidators.createAutomation),
  automationController.createAutomation.bind(automationController)
);

// Get all automations for user
router.get(
  '/',
  automationController.getAutomations.bind(automationController)
);

// Get automation by ID
router.get(
  '/:id',
  automationController.getAutomationById.bind(automationController)
);

// Update automation
router.put(
  '/:id',
  validateRequest(automationValidators.updateAutomation),
  automationController.updateAutomation.bind(automationController)
);

// Delete automation
router.delete(
  '/:id',
  automationController.deleteAutomation.bind(automationController)
);

// Toggle automation enabled/disabled
router.patch(
  '/:id/toggle',
  validateRequest(automationValidators.toggleAutomation),
  automationController.toggleAutomation.bind(automationController)
);

// Get automation execution history
router.get(
  '/:id/history',
  automationController.getAutomationExecutionHistory.bind(automationController)
);

// Test automation
router.post(
  '/:id/test',
  automationController.testAutomation.bind(automationController)
);

export default router;
