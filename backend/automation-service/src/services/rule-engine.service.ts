import { logger } from '../../../../shared/utils/logger';

interface Rule {
  id: string;
  name: string;
  conditions: Condition[];
  actions: Action[];
  enabled: boolean;
  priority: number;
}

interface Condition {
  type: 'device_state' | 'time' | 'weather' | 'location' | 'custom';
  operator: 'equals' | 'not_equals' | 'greater_than' | 'less_than' | 'contains' | 'between';
  field: string;
  value: any;
  logicalOperator?: 'AND' | 'OR';
}

interface Action {
  type: 'device_control' | 'notification' | 'scene' | 'webhook' | 'delay';
  target: string;
  parameters: Record<string, any>;
}

interface RuleContext {
  deviceStates: Map<string, any>;
  currentTime: Date;
  weather?: any;
  location?: any;
  customData?: Record<string, any>;
}

export class RuleEngineService {
  private rules: Map<string, Rule> = new Map();

  public addRule(rule: Rule): void {
    this.rules.set(rule.id, rule);
    logger.info('Rule added', { ruleId: rule.id, name: rule.name });
  }

  public removeRule(ruleId: string): void {
    this.rules.delete(ruleId);
    logger.info('Rule removed', { ruleId });
  }

  public async evaluateRules(context: RuleContext): Promise<Action[]> {
    const actionsToExecute: Action[] = [];
    const sortedRules = Array.from(this.rules.values())
      .filter(rule => rule.enabled)
      .sort((a, b) => b.priority - a.priority);

    for (const rule of sortedRules) {
      if (await this.evaluateConditions(rule.conditions, context)) {
        logger.info('Rule triggered', { ruleId: rule.id, name: rule.name });
        actionsToExecute.push(...rule.actions);
      }
    }

    return actionsToExecute;
  }

  private async evaluateConditions(conditions: Condition[], context: RuleContext): Promise<boolean> {
    if (conditions.length === 0) return true;

    let result = this.evaluateCondition(conditions[0], context);

    for (let i = 1; i < conditions.length; i++) {
      const condition = conditions[i];
      const conditionResult = this.evaluateCondition(condition, context);

      if (condition.logicalOperator === 'OR') {
        result = result || conditionResult;
      } else {
        result = result && conditionResult;
      }
    }

    return result;
  }

  private evaluateCondition(condition: Condition, context: RuleContext): boolean {
    let actualValue: any;

    switch (condition.type) {
      case 'device_state':
        actualValue = context.deviceStates.get(condition.field);
        break;
      case 'time':
        actualValue = context.currentTime;
        break;
      case 'weather':
        actualValue = context.weather?.[condition.field];
        break;
      case 'location':
        actualValue = context.location?.[condition.field];
        break;
      case 'custom':
        actualValue = context.customData?.[condition.field];
        break;
      default:
        return false;
    }

    return this.compareValues(actualValue, condition.value, condition.operator);
  }

  private compareValues(actual: any, expected: any, operator: string): boolean {
    switch (operator) {
      case 'equals':
        return actual === expected;
      case 'not_equals':
        return actual !== expected;
      case 'greater_than':
        return actual > expected;
      case 'less_than':
        return actual < expected;
      case 'contains':
        return String(actual).includes(String(expected));
      case 'between':
        return actual >= expected[0] && actual <= expected[1];
      default:
        return false;
    }
  }
}
