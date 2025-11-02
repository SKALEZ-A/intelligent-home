export interface AutomationValidationResult {
  valid: boolean;
  errors: string[];
}

export class AutomationValidator {
  static validateAutomationName(name: string): AutomationValidationResult {
    const errors: string[] = [];

    if (!name) {
      errors.push('Automation name is required');
    }

    if (name && name.length < 3) {
      errors.push('Automation name must be at least 3 characters');
    }

    if (name && name.length > 100) {
      errors.push('Automation name must not exceed 100 characters');
    }

    return {
      valid: errors.length === 0,
      errors
    };
  }

  static validateTrigger(trigger: any): AutomationValidationResult {
    const errors: string[] = [];
    const validTriggerTypes = ['time', 'device', 'sensor', 'location', 'weather', 'manual'];

    if (!trigger) {
      errors.push('Trigger is required');
    }

    if (trigger && !trigger.type) {
      errors.push('Trigger type is required');
    }

    if (trigger && trigger.type && !validTriggerTypes.includes(trigger.type)) {
      errors.push(`Invalid trigger type. Must be one of: ${validTriggerTypes.join(', ')}`);
    }

    if (trigger && trigger.type === 'time' && !trigger.config?.time) {
      errors.push('Time trigger requires a time configuration');
    }

    if (trigger && trigger.type === 'device' && !trigger.config?.deviceId) {
      errors.push('Device trigger requires a device ID');
    }

    return {
      valid: errors.length === 0,
      errors
    };
  }

  static validateCondition(condition: any): AutomationValidationResult {
    const errors: string[] = [];
    const validOperators = ['and', 'or', 'not'];
    const validConditionTypes = ['device', 'time', 'weather', 'custom'];

    if (!condition) {
      return { valid: true, errors: [] }; // Conditions are optional
    }

    if (condition.operator && !validOperators.includes(condition.operator)) {
      errors.push(`Invalid operator. Must be one of: ${validOperators.join(', ')}`);
    }

    if (condition.type && !validConditionTypes.includes(condition.type)) {
      errors.push(`Invalid condition type. Must be one of: ${validConditionTypes.join(', ')}`);
    }

    return {
      valid: errors.length === 0,
      errors
    };
  }

  static validateAction(action: any): AutomationValidationResult {
    const errors: string[] = [];
    const validActionTypes = ['device', 'scene', 'notification', 'webhook', 'delay'];

    if (!action) {
      errors.push('Action is required');
    }

    if (action && !action.type) {
      errors.push('Action type is required');
    }

    if (action && action.type && !validActionTypes.includes(action.type)) {
      errors.push(`Invalid action type. Must be one of: ${validActionTypes.join(', ')}`);
    }

    if (action && action.type === 'device' && !action.target) {
      errors.push('Device action requires a target device ID');
    }

    if (action && action.type === 'scene' && !action.target) {
      errors.push('Scene action requires a target scene ID');
    }

    if (action && action.type === 'delay' && !action.parameters?.duration) {
      errors.push('Delay action requires a duration parameter');
    }

    return {
      valid: errors.length === 0,
      errors
    };
  }

  static validatePriority(priority: number): AutomationValidationResult {
    const errors: string[] = [];

    if (priority === undefined || priority === null) {
      errors.push('Priority is required');
    }

    if (typeof priority !== 'number') {
      errors.push('Priority must be a number');
    }

    if (priority < 0 || priority > 100) {
      errors.push('Priority must be between 0 and 100');
    }

    return {
      valid: errors.length === 0,
      errors
    };
  }

  static validateAutomation(automation: any): AutomationValidationResult {
    const errors: string[] = [];

    const nameValidation = this.validateAutomationName(automation.name);
    errors.push(...nameValidation.errors);

    if (!automation.triggers || automation.triggers.length === 0) {
      errors.push('At least one trigger is required');
    } else {
      automation.triggers.forEach((trigger: any, index: number) => {
        const triggerValidation = this.validateTrigger(trigger);
        triggerValidation.errors.forEach(error => {
          errors.push(`Trigger ${index + 1}: ${error}`);
        });
      });
    }

    if (automation.conditions && automation.conditions.length > 0) {
      automation.conditions.forEach((condition: any, index: number) => {
        const conditionValidation = this.validateCondition(condition);
        conditionValidation.errors.forEach(error => {
          errors.push(`Condition ${index + 1}: ${error}`);
        });
      });
    }

    if (!automation.actions || automation.actions.length === 0) {
      errors.push('At least one action is required');
    } else {
      automation.actions.forEach((action: any, index: number) => {
        const actionValidation = this.validateAction(action);
        actionValidation.errors.forEach(error => {
          errors.push(`Action ${index + 1}: ${error}`);
        });
      });
    }

    if (automation.priority !== undefined) {
      const priorityValidation = this.validatePriority(automation.priority);
      errors.push(...priorityValidation.errors);
    }

    return {
      valid: errors.length === 0,
      errors
    };
  }
}
