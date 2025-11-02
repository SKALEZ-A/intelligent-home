export interface Context {
  userId: string;
  location: {
    latitude: number;
    longitude: number;
    isHome: boolean;
  };
  time: {
    hour: number;
    dayOfWeek: number;
    isWeekend: boolean;
  };
  weather: {
    temperature: number;
    condition: string;
    humidity: number;
  };
  occupancy: {
    peopleCount: number;
    rooms: string[];
  };
  deviceStates: Record<string, any>;
}

export interface ContextRule {
  id: string;
  name: string;
  conditions: ContextCondition[];
  actions: ContextAction[];
  priority: number;
  enabled: boolean;
}

export interface ContextCondition {
  type: 'location' | 'time' | 'weather' | 'occupancy' | 'device';
  operator: 'equals' | 'greater_than' | 'less_than' | 'contains';
  field: string;
  value: any;
}

export interface ContextAction {
  deviceId: string;
  action: string;
  parameters?: any;
}

export class ContextAwareAutomationService {
  private rules: Map<string, ContextRule> = new Map();
  private contextHistory: Context[] = [];

  async evaluateContext(context: Context): Promise<ContextRule[]> {
    const matchingRules: ContextRule[] = [];

    for (const rule of this.rules.values()) {
      if (!rule.enabled) continue;

      if (this.evaluateRule(rule, context)) {
        matchingRules.push(rule);
      }
    }

    matchingRules.sort((a, b) => b.priority - a.priority);
    return matchingRules;
  }

  private evaluateRule(rule: ContextRule, context: Context): boolean {
    return rule.conditions.every(condition => 
      this.evaluateCondition(condition, context)
    );
  }

  private evaluateCondition(condition: ContextCondition, context: Context): boolean {
    let actualValue: any;

    switch (condition.type) {
      case 'location':
        actualValue = this.getNestedValue(context.location, condition.field);
        break;
      case 'time':
        actualValue = this.getNestedValue(context.time, condition.field);
        break;
      case 'weather':
        actualValue = this.getNestedValue(context.weather, condition.field);
        break;
      case 'occupancy':
        actualValue = this.getNestedValue(context.occupancy, condition.field);
        break;
      case 'device':
        actualValue = context.deviceStates[condition.field];
        break;
      default:
        return false;
    }

    return this.compareValues(actualValue, condition.operator, condition.value);
  }

  private getNestedValue(obj: any, path: string): any {
    return path.split('.').reduce((current, key) => current?.[key], obj);
  }

  private compareValues(actual: any, operator: string, expected: any): boolean {
    switch (operator) {
      case 'equals':
        return actual === expected;
      case 'greater_than':
        return actual > expected;
      case 'less_than':
        return actual < expected;
      case 'contains':
        return Array.isArray(actual) ? actual.includes(expected) : false;
      default:
        return false;
    }
  }

  async executeActions(rules: ContextRule[]): Promise<void> {
    for (const rule of rules) {
      for (const action of rule.actions) {
        try {
          await this.executeAction(action);
        } catch (error) {
          console.error(`Failed to execute action for rule ${rule.id}:`, error);
        }
      }
    }
  }

  private async executeAction(action: ContextAction): Promise<void> {
    console.log(`Executing action: ${action.action} on device ${action.deviceId}`);
  }

  addRule(rule: ContextRule): void {
    this.rules.set(rule.id, rule);
  }

  removeRule(ruleId: string): boolean {
    return this.rules.delete(ruleId);
  }

  updateRule(ruleId: string, updates: Partial<ContextRule>): boolean {
    const rule = this.rules.get(ruleId);
    if (!rule) return false;

    this.rules.set(ruleId, { ...rule, ...updates });
    return true;
  }

  getRules(): ContextRule[] {
    return Array.from(this.rules.values());
  }

  async predictNextActions(context: Context): Promise<ContextAction[]> {
    const recentContexts = this.contextHistory.slice(-10);
    const patterns = this.analyzePatterns(recentContexts);
    
    return patterns.map(pattern => ({
      deviceId: pattern.deviceId,
      action: pattern.action,
      parameters: pattern.parameters
    }));
  }

  private analyzePatterns(contexts: Context[]): any[] {
    return [];
  }

  storeContext(context: Context): void {
    this.contextHistory.push(context);
    if (this.contextHistory.length > 1000) {
      this.contextHistory.shift();
    }
  }

  async getContextInsights(userId: string): Promise<any> {
    const userContexts = this.contextHistory.filter(c => c.userId === userId);

    return {
      totalContexts: userContexts.length,
      averageOccupancy: this.calculateAverage(userContexts, 'occupancy.peopleCount'),
      mostCommonLocation: this.findMostCommon(userContexts, 'location.isHome'),
      peakActivityHours: this.findPeakHours(userContexts),
      weatherPreferences: this.analyzeWeatherPreferences(userContexts)
    };
  }

  private calculateAverage(contexts: Context[], path: string): number {
    const values = contexts.map(c => this.getNestedValue(c, path)).filter(v => v != null);
    return values.reduce((sum, v) => sum + v, 0) / values.length || 0;
  }

  private findMostCommon(contexts: Context[], path: string): any {
    const values = contexts.map(c => this.getNestedValue(c, path));
    const counts = new Map();
    
    values.forEach(v => counts.set(v, (counts.get(v) || 0) + 1));
    
    let maxCount = 0;
    let mostCommon = null;
    
    counts.forEach((count, value) => {
      if (count > maxCount) {
        maxCount = count;
        mostCommon = value;
      }
    });
    
    return mostCommon;
  }

  private findPeakHours(contexts: Context[]): number[] {
    const hourCounts = new Array(24).fill(0);
    
    contexts.forEach(c => {
      hourCounts[c.time.hour]++;
    });
    
    const maxCount = Math.max(...hourCounts);
    return hourCounts
      .map((count, hour) => ({ hour, count }))
      .filter(h => h.count === maxCount)
      .map(h => h.hour);
  }

  private analyzeWeatherPreferences(contexts: Context[]): any {
    return {
      preferredTemperature: this.calculateAverage(contexts, 'weather.temperature'),
      mostCommonCondition: this.findMostCommon(contexts, 'weather.condition')
    };
  }
}
