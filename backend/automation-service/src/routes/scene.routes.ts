import { Router } from 'express';
import { SceneController } from '../controllers/scene.controller';
import { authenticate } from '../../../shared/middleware/authenticate';
import { validateRequest } from '../../../shared/middleware/validation';
import { sceneValidators } from '../validators/scene.validators';

const router = Router();
const sceneController = new SceneController();

// All routes require authentication
router.use(authenticate);

// Scene CRUD operations
router.post(
  '/',
  validateRequest(sceneValidators.createScene),
  sceneController.createScene.bind(sceneController)
);

router.get(
  '/',
  sceneController.getScenes.bind(sceneController)
);

router.get(
  '/:sceneId',
  sceneController.getScene.bind(sceneController)
);

router.put(
  '/:sceneId',
  validateRequest(sceneValidators.updateScene),
  sceneController.updateScene.bind(sceneController)
);

router.delete(
  '/:sceneId',
  sceneController.deleteScene.bind(sceneController)
);

// Scene execution
router.post(
  '/:sceneId/execute',
  sceneController.executeScene.bind(sceneController)
);

router.get(
  '/:sceneId/executions',
  sceneController.getExecutionHistory.bind(sceneController)
);

router.get(
  '/:sceneId/executions/:executionId',
  sceneController.getExecution.bind(sceneController)
);

// Scene management
router.post(
  '/:sceneId/activate',
  sceneController.activateScene.bind(sceneController)
);

router.post(
  '/:sceneId/deactivate',
  sceneController.deactivateScene.bind(sceneController)
);

router.post(
  '/:sceneId/duplicate',
  sceneController.duplicateScene.bind(sceneController)
);

// Scene analytics
router.get(
  '/:sceneId/analytics',
  sceneController.getSceneAnalytics.bind(sceneController)
);

export default router;
