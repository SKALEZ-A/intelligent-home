export interface SceneExecution {
  id: string;
  sceneId: string;
  userId: string;
  startedAt: Date;
  completedAt?: Date;
  status: 'pending' | 'running' | 'completed' | 'failed' | 'cancelled';
  actions: ActionExecution[];
  error?: string;
  metadata?: Record<string, any>;
}

export interface ActionExecution {
  actionId: string;
  deviceId: string;
  command: any;
  status: 'pending' | 'running' | 'completed' | 'failed' | 'skipped';
  startedAt?: Date;
  completedAt?: Date;
  error?: string;
  retryCount: number;
  duration?: number;
}

export class SceneExecutionModel {
  static create(data: Partial<SceneExecution>): SceneExecution {
    return {
      id: data.id || this.generateId(),
      sceneId: data.sceneId!,
      userId: data.userId!,
      startedAt: data.startedAt || new Date(),
      status: data.status || 'pending',
      actions: data.actions || [],
      metadata: data.metadata || {},
    };
  }

  static createActionExecution(data: Partial<ActionExecution>): ActionExecution {
    return {
      actionId: data.actionId!,
      deviceId: data.deviceId!,
      command: data.command!,
      status: data.status || 'pending',
      retryCount: data.retryCount || 0,
    };
  }

  private static generateId(): string {
    return `exec_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  static calculateDuration(execution: SceneExecution): number {
    if (!execution.completedAt) {
      return Date.now() - execution.startedAt.getTime();
    }
    return execution.completedAt.getTime() - execution.startedAt.getTime();
  }

  static getSuccessRate(executions: SceneExecution[]): number {
    if (executions.length === 0) return 0;
    const successful = executions.filter(e => e.status === 'completed').length;
    return (successful / executions.length) * 100;
  }

  static getAverageDuration(executions: SceneExecution[]): number {
    const completed = executions.filter(e => e.completedAt);
    if (completed.length === 0) return 0;
    
    const totalDuration = completed.reduce((sum, e) => {
      return sum + this.calculateDuration(e);
    }, 0);
    
    return totalDuration / completed.length;
  }
}
