import axios from 'axios';
import { Scene, SceneAction } from '../models/scene.model';
import { SceneRepository } from '../repositories/scene.repository';
import { logger } from '../../../shared/utils/logger';
import { AppError } from '../../../shared/utils/errors';

const DEVICE_SERVICE_URL = process.env.DEVICE_SERVICE_URL || 'http://localhost:3002';

export class SceneExecutorService {
  private sceneRepository: SceneRepository;

  constructor() {
    this.sceneRepository = new SceneRepository();
  }

  async executeScene(scene: Scene): Promise<any> {
    const startTime = Date.now();
    const actionResults: any[] = [];
    let overallStatus: 'success' | 'failed' | 'partial' = 'success';
    let error: string | undefined;

    try {
      logger.info(`Executing scene: ${scene.id}`, { sceneName: scene.name });

      // Sort actions by order
      const sortedActions = [...scene.actions].sort((a, b) => a.order - b.order);

      // Execute actions sequentially
      for (const action of sortedActions) {
        try {
          // Apply delay if specified
          if (action.delay && action.delay > 0) {
            await this.delay(action.delay);
          }

          const actionStartTime = Date.now();
          const result = await this.executeAction(action);
          const actionExecutionTime = Date.now() - actionStartTime;

          actionResults.push({
            deviceId: action.deviceId,
            action: action.action,
            status: 'success',
            executionTime: actionExecutionTime,
          });

          logger.info(`Action executed successfully`, {
            sceneId: scene.id,
            deviceId: action.deviceId,
            action: action.action,
          });
        } catch (actionError: any) {
          const actionExecutionTime = Date.now() - actionStartTime;
          
          actionResults.push({
            deviceId: action.deviceId,
            action: action.action,
            status: 'failed',
            error: actionError.message,
            executionTime: actionExecutionTime,
          });

          overallStatus = actionResults.some(r => r.status === 'success') ? 'partial' : 'failed';

          logger.error(`Action execution failed`, {
            sceneId: scene.id,
            deviceId: action.deviceId,
            action: action.action,
            error: actionError.message,
          });
        }
      }

      const executionTime = Date.now() - startTime;

      // Log execution
      await this.sceneRepository.logExecution({
        sceneId: scene.id,
        userId: scene.userId,
        status: overallStatus,
        executedAt: new Date(),
        executionTime,
        actionResults,
        error,
      });

      return {
        status: overallStatus,
        executionTime,
        actionResults,
        error,
      };
    } catch (err: any) {
      const executionTime = Date.now() - startTime;
      error = err.message;
      overallStatus = 'failed';

      logger.error(`Scene execution failed: ${scene.id}`, err);

      // Log failed execution
      await this.sceneRepository.logExecution({
        sceneId: scene.id,
        userId: scene.userId,
        status: 'failed',
        executedAt: new Date(),
        executionTime,
        actionResults,
        error,
      });

      throw new AppError(`Scene execution failed: ${error}`, 500);
    }
  }

  private async executeAction(action: SceneAction): Promise<any> {
    try {
      const response = await axios.post(
        `${DEVICE_SERVICE_URL}/api/devices/${action.deviceId}/command`,
        {
          action: action.action,
          parameters: action.parameters,
        },
        {
          timeout: 10000,
          headers: {
            'Content-Type': 'application/json',
          },
        }
      );

      return response.data;
    } catch (error: any) {
      if (error.response) {
        throw new Error(`Device command failed: ${error.response.data.message || error.message}`);
      } else if (error.request) {
        throw new Error('Device service unreachable');
      } else {
        throw new Error(`Action execution error: ${error.message}`);
      }
    }
  }

  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  async validateScene(scene: Scene): Promise<{ valid: boolean; errors: string[] }> {
    const errors: string[] = [];

    if (!scene.actions || scene.actions.length === 0) {
      errors.push('Scene must have at least one action');
    }

    // Validate action order
    const orders = scene.actions.map(a => a.order);
    const uniqueOrders = new Set(orders);
    if (orders.length !== uniqueOrders.size) {
      errors.push('Action orders must be unique');
    }

    // Validate device IDs exist
    for (const action of scene.actions) {
      try {
        await axios.get(`${DEVICE_SERVICE_URL}/api/devices/${action.deviceId}`, {
          timeout: 5000,
        });
      } catch (error) {
        errors.push(`Device not found: ${action.deviceId}`);
      }
    }

    return {
      valid: errors.length === 0,
      errors,
    };
  }
}
