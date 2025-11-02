import { EventEmitter } from 'events';
import { logger } from '../../../shared/utils/logger';

interface AutomationRule {
  id: string;
  name: string;
  priority: number;
  conditions: Condition[];
  actions: Action[];
  enabled: boolean;
  conflictResolution: 'priority' | 'merge' | 'cancel' | 'user_prompt';
}

interface Condition {
  type: string;
  operator: string;
  value: any;
  deviceId?: string;
}

interface Action {
  deviceId: string;
  command: string;
  parameters: Record<string, any>;
  delay?: number;
}

interface Conflict {
  id: string;
  timestamp: Date;
  rules: string[];
  conflictType: 'device' | 'state' | 'timing' | 'resource';
  severity: 'low' | 'medium' | 'high';
  resolution?: ConflictResolution;
  resolved: boolean;
}

interface ConflictResolution {
  strategy: string;
  selectedRule?: string;
  mergedActions?: Action[];
  timestamp: Date;
  automatic: boolean;
}

export class AutomationConflictResolverService extends EventEmitter {
  private rules: Map<string, AutomationRule> = new Map();
  private conflicts: Map<string, Conflict> = new Map();
  private deviceStates: Map<string, any> = new Map();
  private executionHistory: Array<{ ruleId: string; timestamp: Date; success: boolean }> = [];

  constructor() {
    super();
  }

  registerRule(rule: AutomationRule): void {
    this.rules.set(rule.id, rule);
    logger.info(`Registered automation rule: ${rule.id} - ${rule.name}`);
  }

  unregisterRule(ruleId: string): void {
    this.rules.delete(ruleId);
    logger.info(`Unregistered automation rule: ${ruleId}`);
  }

  async evaluateRules(context: Record<string, any>): Promise<{
    toExecute: AutomationRule[];
    conflicts: Conflict[];
  }> {
    const triggeredRules: AutomationRule[] = [];

    // Find all rules that should trigger
    for (const rule of this.rules.values()) {
      if (!rule.enabled) continue;

      if (this.evaluateConditions(rule.conditions, context)) {
        triggeredRules.push(rule);
      }
    }

    // Detect conflicts
    const conflicts = this.detectConflicts(triggeredRules);

    // Resolve conflicts
    const resolvedRules = await this.resolveConflicts(triggeredRules, conflicts);

    return {
      toExecute: resolvedRules,
      conflicts
    };
  }

  private evaluateConditions(conditions: Condition[], context: Record<string, any>): boolean {
    return conditions.every(condition => {
      const value = condition.deviceId 
        ? this.deviceStates.get(condition.deviceId)?.[condition.type]
        : context[condition.type];

      return this.compareValues(value, condition.operator, condition.value);
    });
  }

  private compareValues(actual: any, operator: string, expected: any): boolean {
    switch (operator) {
      case '==':
        return actual == expected;
      case '===':
        return actual === expected;
      case '!=':
        return actual != expected;
      case '>':
        return actual > expected;
      case '>=':
        return actual >= expected;
      case '<':
        return actual < expected;
      case '<=':
        return actual <= expected;
      case 'contains':
        return Array.isArray(actual) && actual.includes(expected);
      case 'in':
        return Array.isArray(expected) && expected.includes(actual);
      default:
        return false;
    }
  }

  private detectConflicts(rules: AutomationRule[]): Conflict[] {
    const conflicts: Conflict[] = [];

    // Check for device conflicts (multiple rules trying to control same device)
    const deviceActions = new Map<string, string[]>();
    
    rules.forEach(rule => {
      rule.actions.forEach(action => {
        const existing = deviceActions.get(action.deviceId) || [];
        existing.push(rule.id);
        deviceActions.set(action.deviceId, existing);
      });
    });

    // Create conflicts for devices with multiple rules
    for (const [deviceId, ruleIds] of deviceActions.entries()) {
      if (ruleIds.length > 1) {
        const conflict: Conflict = {
          id: this.generateConflictId(),
          timestamp: new Date(),
          rules: ruleIds,
          conflictType: 'device',
          severity: this.calculateConflictSeverity(ruleIds),
          resolved: false
        };
        
        conflicts.push(conflict);
        this.conflicts.set(conflict.id, conflict);
      }
    }

    // Check for state conflicts (contradictory actions)
    const stateConflicts = this.detectStateConflicts(rules);
    conflicts.push(...stateConflicts);

    // Check for timing conflicts
    const timingConflicts = this.detectTimingConflicts(rules);
    conflicts.push(...timingConflicts);

    return conflicts;
  }

  private detectStateConflicts(rules: AutomationRule[]): Conflict[] {
    const conflicts: Conflict[] = [];
    const deviceCommands = new Map<string, Array<{ ruleId: string; command: string; params: any }>>();

    rules.forEach(rule => {
      rule.actions.forEach(action => {
        const key = action.deviceId;
        const existing = deviceCommands.get(key) || [];
        existing.push({
          ruleId: rule.id,
          command: action.command,
          params: action.parameters
        });
        deviceCommands.set(key, existing);
      });
    });

    for (const [deviceId, commands] of deviceCommands.entries()) {
      if (commands.length > 1) {
        // Check if commands are contradictory
        const isContradictory = this.areCommandsContradictory(commands);
        
        if (isContradictory) {
          const conflict: Conflict = {
            id: this.generateConflictId(),
            timestamp: new Date(),
            rules: commands.map(c => c.ruleId),
            conflictType: 'state',
            severity: 'high',
            resolved: false
          };
          
          conflicts.push(conflict);
          this.conflicts.set(conflict.id, conflict);
        }
      }
    }

    return conflicts;
  }

  private areCommandsContradictory(commands: Array<{ command: string; params: any }>): boolean {
    // Check for obvious contradictions
    const commandTypes = commands.map(c => c.command);
    
    if (commandTypes.includes('turnOn') && commandTypes.includes('turnOff')) {
      return true;
    }
    
    if (commandTypes.includes('lock') && commandTypes.includes('unlock')) {
      return true;
    }

    // Check for conflicting parameter values
    const setCommands = commands.filter(c => c.command.startsWith('set'));
    if (setCommands.length > 1) {
      const values = setCommands.map(c => JSON.stringify(c.params));
      return new Set(values).size > 1;
    }

    return false;
  }

  private detectTimingConflicts(rules: AutomationRule[]): Conflict[] {
    const conflicts: Conflict[] = [];
    
    // Check if rules have actions with conflicting delays
    const deviceDelays = new Map<string, Array<{ ruleId: string; delay: number }>>();

    rules.forEach(rule => {
      rule.actions.forEach(action => {
        if (action.delay !== undefined) {
          const key = action.deviceId;
          const existing = deviceDelays.get(key) || [];
          existing.push({
            ruleId: rule.id,
            delay: action.delay
          });
          deviceDelays.set(key, existing);
        }
      });
    });

    for (const [deviceId, delays] of deviceDelays.entries()) {
      if (delays.length > 1) {
        const conflict: Conflict = {
          id: this.generateConflictId(),
          timestamp: new Date(),
          rules: delays.map(d => d.ruleId),
          conflictType: 'timing',
          severity: 'medium',
          resolved: false
        };
        
        conflicts.push(conflict);
        this.conflicts.set(conflict.id, conflict);
      }
    }

    return conflicts;
  }

  private async resolveConflicts(
    rules: AutomationRule[],
    conflicts: Conflict[]
  ): Promise<AutomationRule[]> {
    if (conflicts.length === 0) {
      return rules;
    }

    const resolvedRules: AutomationRule[] = [];
    const conflictedRuleIds = new Set(conflicts.flatMap(c => c.rules));

    // Add non-conflicted rules
    rules.forEach(rule => {
      if (!conflictedRuleIds.has(rule.id)) {
        resolvedRules.push(rule);
      }
    });

    // Resolve each conflict
    for (const conflict of conflicts) {
      const conflictedRules = conflict.rules
        .map(id => this.rules.get(id))
        .filter((r): r is AutomationRule => r !== undefined);

      const resolution = await this.resolveConflict(conflict, conflictedRules);
      
      if (resolution.selectedRule) {
        const selectedRule = this.rules.get(resolution.selectedRule);
        if (selectedRule) {
          resolvedRules.push(selectedRule);
        }
      } else if (resolution.mergedActions) {
        // Create a temporary merged rule
        const mergedRule: AutomationRule = {
          id: `merged_${conflict.id}`,
          name: 'Merged Rule',
          priority: Math.max(...conflictedRules.map(r => r.priority)),
          conditions: [],
          actions: resolution.mergedActions,
          enabled: true,
          conflictResolution: 'merge'
        };
        resolvedRules.push(mergedRule);
      }

      conflict.resolution = resolution;
      conflict.resolved = true;
      this.conflicts.set(conflict.id, conflict);
    }

    return resolvedRules;
  }

  private async resolveConflict(
    conflict: Conflict,
    rules: AutomationRule[]
  ): Promise<ConflictResolution> {
    // Get the primary resolution strategy from the highest priority rule
    const sortedRules = rules.sort((a, b) => a.priority - b.priority);
    const primaryStrategy = sortedRules[0].conflictResolution;

    switch (primaryStrategy) {
      case 'priority':
        return {
          strategy: 'priority',
          selectedRule: sortedRules[0].id,
          timestamp: new Date(),
          automatic: true
        };

      case 'merge':
        return {
          strategy: 'merge',
          mergedActions: this.mergeActions(rules),
          timestamp: new Date(),
          automatic: true
        };

      case 'cancel':
        return {
          strategy: 'cancel',
          timestamp: new Date(),
          automatic: true
        };

      case 'user_prompt':
        // Emit event for user to resolve
        this.emit('conflictRequiresUserInput', conflict, rules);
        return {
          strategy: 'user_prompt',
          timestamp: new Date(),
          automatic: false
        };

      default:
        // Default to priority-based resolution
        return {
          strategy: 'priority',
          selectedRule: sortedRules[0].id,
          timestamp: new Date(),
          automatic: true
        };
    }
  }

  private mergeActions(rules: AutomationRule[]): Action[] {
    const mergedActions: Action[] = [];
    const deviceActions = new Map<string, Action[]>();

    // Group actions by device
    rules.forEach(rule => {
      rule.actions.forEach(action => {
        const existing = deviceActions.get(action.deviceId) || [];
        existing.push(action);
        deviceActions.set(action.deviceId, existing);
      });
    });

    // Merge actions for each device
    for (const [deviceId, actions] of deviceActions.entries()) {
      if (actions.length === 1) {
        mergedActions.push(actions[0]);
      } else {
        // Try to intelligently merge parameters
        const mergedAction: Action = {
          deviceId,
          command: actions[0].command,
          parameters: this.mergeParameters(actions.map(a => a.parameters)),
          delay: Math.min(...actions.map(a => a.delay || 0))
        };
        mergedActions.push(mergedAction);
      }
    }

    return mergedActions;
  }

  private mergeParameters(paramsList: Record<string, any>[]): Record<string, any> {
    const merged: Record<string, any> = {};

    paramsList.forEach(params => {
      Object.entries(params).forEach(([key, value]) => {
        if (merged[key] === undefined) {
          merged[key] = value;
        } else if (typeof value === 'number' && typeof merged[key] === 'number') {
          // Average numeric values
          merged[key] = (merged[key] + value) / 2;
        }
        // For other types, keep the first value
      });
    });

    return merged;
  }

  private calculateConflictSeverity(ruleIds: string[]): 'low' | 'medium' | 'high' {
    const rules = ruleIds.map(id => this.rules.get(id)).filter((r): r is AutomationRule => r !== undefined);
    
    const priorityRange = Math.max(...rules.map(r => r.priority)) - Math.min(...rules.map(r => r.priority));
    
    if (priorityRange > 5) return 'low';
    if (priorityRange > 2) return 'medium';
    return 'high';
  }

  updateDeviceState(deviceId: string, state: any): void {
    this.deviceStates.set(deviceId, state);
  }

  recordExecution(ruleId: string, success: boolean): void {
    this.executionHistory.push({
      ruleId,
      timestamp: new Date(),
      success
    });

    // Keep only last 1000 executions
    if (this.executionHistory.length > 1000) {
      this.executionHistory.shift();
    }
  }

  getConflictHistory(): Conflict[] {
    return Array.from(this.conflicts.values())
      .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
  }

  getUnresolvedConflicts(): Conflict[] {
    return Array.from(this.conflicts.values())
      .filter(c => !c.resolved);
  }

  async resolveConflictManually(conflictId: string, selectedRuleId: string): Promise<void> {
    const conflict = this.conflicts.get(conflictId);
    if (!conflict) {
      throw new Error(`Conflict ${conflictId} not found`);
    }

    conflict.resolution = {
      strategy: 'manual',
      selectedRule: selectedRuleId,
      timestamp: new Date(),
      automatic: false
    };
    conflict.resolved = true;

    this.conflicts.set(conflictId, conflict);
    this.emit('conflictResolved', conflict);
    
    logger.info(`Manually resolved conflict ${conflictId} with rule ${selectedRuleId}`);
  }

  private generateConflictId(): string {
    return `conflict_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  getStatistics(): {
    totalConflicts: number;
    resolvedConflicts: number;
    unresolvedConflicts: number;
    conflictsByType: Record<string, number>;
    averageResolutionTime: number;
  } {
    const conflicts = Array.from(this.conflicts.values());
    const resolved = conflicts.filter(c => c.resolved);
    
    const conflictsByType: Record<string, number> = {};
    conflicts.forEach(c => {
      conflictsByType[c.conflictType] = (conflictsByType[c.conflictType] || 0) + 1;
    });

    let totalResolutionTime = 0;
    resolved.forEach(c => {
      if (c.resolution) {
        totalResolutionTime += c.resolution.timestamp.getTime() - c.timestamp.getTime();
      }
    });

    return {
      totalConflicts: conflicts.length,
      resolvedConflicts: resolved.length,
      unresolvedConflicts: conflicts.length - resolved.length,
      conflictsByType,
      averageResolutionTime: resolved.length > 0 ? totalResolutionTime / resolved.length : 0
    };
  }
}

export const automationConflictResolver = new AutomationConflictResolverService();
