import axios from 'axios';
import { IAction } from '../models/automation.model';
import { logger } from '../../../../shared/utils/logger';

export interface ExecutionResult {
  success: boolean;
  actionType: string;
  duration: number;
  error?: string;
  data?: any;
}

export class ActionExecutorService {
  private deviceServiceUrl: string;
  private notificationServiceUrl: string;

  constructor() {
    this.deviceServiceUrl = process.env.DEVICE_SERVICE_URL || 'http://localhost:3002';
    this.notificationServiceUrl = process.env.NOTIFICATION_SERVICE_URL || 'http://localhost:3004';
  }

  async executeActions(actions: IAction[], context: any): Promise<ExecutionResult[]> {
    const results: ExecutionResult[] = [];

    for (const action of actions) {
      const startTime = Date.now();
      
      try {
        const result = await this.executeAction(action, context);
        results.push({
          success: true,
          actionType: action.type,
          duration: Date.now() - startTime,
          data: result,
        });
      } catch (error: any) {
        logger.error('Action execution failed', { action, error: error.message });
        results.push({
          success: false,
          actionType: action.type,
          duration: Date.now() - startTime,
          error: error.message,
        });
      }
    }

    return results;
  }

  private async executeAction(action: IAction, context: any): Promise<any> {
    switch (action.type) {
      case 'device':
        return this.executeDeviceAction(action);
      case 'notification':
        return this.executeNotificationAction(action);
      case 'scene':
        return this.executeSceneAction(action);
      case 'delay':
        return this.executeDelayAction(action);
      case 'webhook':
        return this.executeWebhookAction(action);
      case 'script':
        return this.executeScriptAction(action, context);
      default:
        throw new Error(`Unknown action type: ${action.type}`);
    }
  }

  private async executeDeviceAction(action: IAction): Promise<any> {
    const { deviceId, deviceIds, command, parameters } = action.config;

    const targets = deviceIds || (deviceId ? [deviceId] : []);
    
    if (targets.length === 0) {
      throw new Error('No device targets specified');
    }

    const results = await Promise.all(
      targets.map(async (id) => {
        try {
          const response = await axios.post(
            `${this.deviceServiceUrl}/api/devices/${id}/command`,
            {
              command,
              parameters,
            }
          );
          return { deviceId: id, success: true, data: response.data };
        } catch (error: any) {
          logger.error('Device command failed', { deviceId: id, error: error.message });
          return { deviceId: id, success: false, error: error.message };
        }
      })
    );

    logger.info('Device action executed', { 
      command, 
      deviceCount: targets.length,
      successCount: results.filter(r => r.success).length,
    });

    return results;
  }

  private async executeNotificationAction(action: IAction): Promise<any> {
    const { title, message, channels, priority } = action.config;

    if (!message) {
      throw new Error('Notification message is required');
    }

    const notificationData = {
      title: title || 'Automation Notification',
      message,
      channels: channels || ['push'],
      priority: priority || 'normal',
      timestamp: new Date(),
    };

    try {
      const response = await axios.post(
        `${this.notificationServiceUrl}/api/notifications/send`,
        notificationData
      );

      logger.info('Notification sent', { title, channels });
      return response.data;
    } catch (error: any) {
      logger.error('Notification failed', { error: error.message });
      throw error;
    }
  }

  private async executeSceneAction(action: IAction): Promise<any> {
    const { sceneId } = action.config;

    if (!sceneId) {
      throw new Error('Scene ID is required');
    }

    try {
      const response = await axios.post(
        `${this.deviceServiceUrl}/api/scenes/${sceneId}/activate`
      );

      logger.info('Scene activated', { sceneId });
      return response.data;
    } catch (error: any) {
      logger.error('Scene activation failed', { sceneId, error: error.message });
      throw error;
    }
  }

  private async executeDelayAction(action: IAction): Promise<any> {
    const { duration } = action.config;

    if (!duration || duration <= 0) {
      throw new Error('Valid delay duration is required');
    }

    logger.info('Executing delay', { duration });
    await new Promise(resolve => setTimeout(resolve, duration));
    
    return { delayed: duration };
  }

  private async executeWebhookAction(action: IAction): Promise<any> {
    const { url, method, headers, body } = action.config;

    if (!url) {
      throw new Error('Webhook URL is required');
    }

    try {
      const response = await axios({
        method: method || 'POST',
        url,
        headers: headers || {},
        data: body,
        timeout: 10000,
      });

      logger.info('Webhook executed', { url, method, status: response.status });
      return response.data;
    } catch (error: any) {
      logger.error('Webhook failed', { url, error: error.message });
      throw error;
    }
  }

  private async executeScriptAction(action: IAction, context: any): Promise<any> {
    const { script } = action.config;

    if (!script) {
      throw new Error('Script is required');
    }

    try {
      // In production, use a sandboxed environment
      const func = new Function('context', script);
      const result = func(context);

      logger.info('Script executed successfully');
      return result;
    } catch (error: any) {
      logger.error('Script execution failed', { error: error.message });
      throw error;
    }
  }

  async validateActions(actions: IAction[]): Promise<{ valid: boolean; errors: string[] }> {
    const errors: string[] = [];

    for (const action of actions) {
      if (!action.type) {
        errors.push('Action type is required');
      }

      if (!action.config) {
        errors.push('Action config is required');
      }

      switch (action.type) {
        case 'device':
          if (!action.config.deviceId && !action.config.deviceIds) {
            errors.push('Device action requires deviceId or deviceIds');
          }
          if (!action.config.command) {
            errors.push('Device action requires command');
          }
          break;
        case 'notification':
          if (!action.config.message) {
            errors.push('Notification action requires message');
          }
          break;
        case 'scene':
          if (!action.config.sceneId) {
            errors.push('Scene action requires sceneId');
          }
          break;
        case 'delay':
          if (!action.config.duration || action.config.duration <= 0) {
            errors.push('Delay action requires positive duration');
          }
          break;
        case 'webhook':
          if (!action.config.url) {
            errors.push('Webhook action requires url');
          }
          break;
        case 'script':
          if (!action.config.script) {
            errors.push('Script action requires script');
          }
          break;
      }
    }

    return {
      valid: errors.length === 0,
      errors,
    };
  }
}

export const actionExecutorService = new ActionExecutorService();
