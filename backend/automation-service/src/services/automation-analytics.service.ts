interface AutomationExecution {
  automationId: string;
  executedAt: Date;
  duration: number;
  success: boolean;
  triggeredBy: string;
  actionsExecuted: number;
  errorMessage?: string;
}

export class AutomationAnalyticsService {
  private executionHistory: Map<string, AutomationExecution[]>;

  constructor() {
    this.executionHistory = new Map();
  }

  public recordExecution(execution: AutomationExecution): void {
    if (!this.executionHistory.has(execution.automationId)) {
      this.executionHistory.set(execution.automationId, []);
    }

    const history = this.executionHistory.get(execution.automationId)!;
    history.push(execution);

    if (history.length > 1000) {
      history.shift();
    }
  }

  public getExecutionStats(automationId: string): any {
    const history = this.executionHistory.get(automationId) || [];
    
    if (history.length === 0) {
      return null;
    }

    const successCount = history.filter(e => e.success).length;
    const failureCount = history.length - successCount;
    const avgDuration = history.reduce((sum, e) => sum + e.duration, 0) / history.length;
    
    return {
      totalExecutions: history.length,
      successCount,
      failureCount,
      successRate: (successCount / history.length) * 100,
      averageDuration: avgDuration,
      lastExecution: history[history.length - 1],
    };
  }

  public getTopAutomations(limit: number = 10): any[] {
    const stats: any[] = [];

    this.executionHistory.forEach((history, automationId) => {
      const successCount = history.filter(e => e.success).length;
      stats.push({
        automationId,
        executions: history.length,
        successRate: (successCount / history.length) * 100,
      });
    });

    return stats.sort((a, b) => b.executions - a.executions).slice(0, limit);
  }

  public getFailureAnalysis(automationId: string): any {
    const history = this.executionHistory.get(automationId) || [];
    const failures = history.filter(e => !e.success);

    const errorCounts = new Map<string, number>();
    failures.forEach(f => {
      const error = f.errorMessage || 'Unknown error';
      errorCounts.set(error, (errorCounts.get(error) || 0) + 1);
    });

    return {
      totalFailures: failures.length,
      errorBreakdown: Array.from(errorCounts.entries()).map(([error, count]) => ({
        error,
        count,
        percentage: (count / failures.length) * 100,
      })),
    };
  }
}
