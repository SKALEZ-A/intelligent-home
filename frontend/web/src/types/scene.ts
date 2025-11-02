export interface Scene {
  id: string;
  name: string;
  description?: string;
  icon?: string;
  color?: string;
  actions: SceneAction[];
  createdAt: string;
  updatedAt: string;
  userId: string;
  homeId: string;
  isActive: boolean;
  isFavorite: boolean;
  executionCount: number;
  lastExecuted?: string;
}

export interface SceneAction {
  id: string;
  deviceId: string;
  property: string;
  value: any;
  delay?: number;
  transition?: TransitionConfig;
}

export interface TransitionConfig {
  duration: number;
  easing?: EasingFunction;
}

export enum EasingFunction {
  LINEAR = 'linear',
  EASE_IN = 'ease-in',
  EASE_OUT = 'ease-out',
  EASE_IN_OUT = 'ease-in-out'
}

export interface SceneExecution {
  id: string;
  sceneId: string;
  status: SceneExecutionStatus;
  startedAt: string;
  completedAt?: string;
  actionsExecuted: number;
  actionsFailed: number;
  error?: string;
}

export enum SceneExecutionStatus {
  PENDING = 'pending',
  RUNNING = 'running',
  COMPLETED = 'completed',
  FAILED = 'failed',
  CANCELLED = 'cancelled'
}

export interface SceneTemplate {
  id: string;
  name: string;
  description: string;
  category: SceneCategory;
  icon: string;
  actions: SceneAction[];
  requiredDeviceTypes: string[];
  tags: string[];
}

export enum SceneCategory {
  MORNING = 'morning',
  EVENING = 'evening',
  NIGHT = 'night',
  AWAY = 'away',
  HOME = 'home',
  ENTERTAINMENT = 'entertainment',
  WORK = 'work',
  CUSTOM = 'custom'
}

export interface SceneSchedule {
  id: string;
  sceneId: string;
  enabled: boolean;
  time: string;
  days: number[];
  timezone: string;
}
