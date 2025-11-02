import { ICondition } from '../models/automation.model';
import { logger } from '../../../../shared/utils/logger';

export interface EvaluationContext {
  devices: Map<string, any>;
  currentTime: Date;
  weather?: {
    condition: string;
    temperature: number;
    humidity: number;
  };
  location?: {
    latitude: number;
    longitude: number;
  };
  triggerData?: any;
}

export class ConditionEvaluatorService {
  async evaluateConditions(
    conditions: ICondition[],
    context: EvaluationContext
  ): Promise<boolean> {
    if (conditions.length === 0) {
      return true; // No conditions means always execute
    }

    const results = await Promise.all(
      conditions.map(condition => this.evaluateCondition(condition, context))
    );

    // Determine overall result based on operators
    let result = results[0];
    for (let i = 1; i < conditions.length; i++) {
      const operator = conditions[i].operator || 'and';
      if (operator === 'and') {
        result = result && results[i];
      } else {
        result = result || results[i];
      }
    }

    return result;
  }

  private async evaluateCondition(
    condition: ICondition,
    context: EvaluationContext
  ): Promise<boolean> {
    try {
      switch (condition.type) {
        case 'device':
          return this.evaluateDeviceCondition(condition, context);
        case 'time':
          return this.evaluateTimeCondition(condition, context);
        case 'weather':
          return this.evaluateWeatherCondition(condition, context);
        case 'location':
          return this.evaluateLocationCondition(condition, context);
        case 'custom':
          return this.evaluateCustomCondition(condition, context);
        default:
          logger.warn('Unknown condition type', { type: condition.type });
          return false;
      }
    } catch (error) {
      logger.error('Condition evaluation error', { condition, error });
      return false;
    }
  }

  private evaluateDeviceCondition(
    condition: ICondition,
    context: EvaluationContext
  ): boolean {
    const { deviceId, property, comparison, value } = condition.config;

    if (!deviceId || !property) {
      return false;
    }

    const device = context.devices.get(deviceId);
    if (!device) {
      logger.warn('Device not found in context', { deviceId });
      return false;
    }

    const deviceValue = this.getNestedProperty(device, property);
    
    return this.compareValues(deviceValue, value, comparison || 'equals');
  }

  private evaluateTimeCondition(
    condition: ICondition,
    context: EvaluationContext
  ): boolean {
    const { timeStart, timeEnd } = condition.config;

    if (!timeStart || !timeEnd) {
      return false;
    }

    const currentTime = context.currentTime.getHours() * 60 + context.currentTime.getMinutes();
    const [startHour, startMin] = timeStart.split(':').map(Number);
    const [endHour, endMin] = timeEnd.split(':').map(Number);
    
    const start = startHour * 60 + startMin;
    const end = endHour * 60 + endMin;

    if (start <= end) {
      return currentTime >= start && currentTime <= end;
    } else {
      // Handle overnight time range
      return currentTime >= start || currentTime <= end;
    }
  }

  private evaluateWeatherCondition(
    condition: ICondition,
    context: EvaluationContext
  ): boolean {
    const { weatherCondition } = condition.config;

    if (!context.weather || !weatherCondition) {
      return false;
    }

    return context.weather.condition.toLowerCase() === weatherCondition.toLowerCase();
  }

  private evaluateLocationCondition(
    condition: ICondition,
    context: EvaluationContext
  ): boolean {
    // Location-based condition evaluation
    // This would typically check if user is within a geofence
    return true; // Placeholder
  }

  private evaluateCustomCondition(
    condition: ICondition,
    context: EvaluationContext
  ): boolean {
    const { customScript } = condition.config;

    if (!customScript) {
      return false;
    }

    try {
      // In production, use a sandboxed environment
      const func = new Function('context', `return ${customScript}`);
      return func(context);
    } catch (error) {
      logger.error('Custom condition script error', { error });
      return false;
    }
  }

  private compareValues(actual: any, expected: any, comparison: string): boolean {
    switch (comparison) {
      case 'equals':
        return actual === expected;
      case 'greater':
        return Number(actual) > Number(expected);
      case 'less':
        return Number(actual) < Number(expected);
      case 'between':
        if (Array.isArray(expected) && expected.length === 2) {
          const num = Number(actual);
          return num >= expected[0] && num <= expected[1];
        }
        return false;
      default:
        return false;
    }
  }

  private getNestedProperty(obj: any, path: string): any {
    return path.split('.').reduce((current, prop) => current?.[prop], obj);
  }

  async validateConditions(conditions: ICondition[]): Promise<{ valid: boolean; errors: string[] }> {
    const errors: string[] = [];

    for (const condition of conditions) {
      if (!condition.type) {
        errors.push('Condition type is required');
      }

      if (!condition.config) {
        errors.push('Condition config is required');
      }

      switch (condition.type) {
        case 'device':
          if (!condition.config.deviceId) {
            errors.push('Device condition requires deviceId');
          }
          if (!condition.config.property) {
            errors.push('Device condition requires property');
          }
          break;
        case 'time':
          if (!condition.config.timeStart || !condition.config.timeEnd) {
            errors.push('Time condition requires timeStart and timeEnd');
          }
          break;
        case 'weather':
          if (!condition.config.weatherCondition) {
            errors.push('Weather condition requires weatherCondition');
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

export const conditionEvaluatorService = new ConditionEvaluatorService();
