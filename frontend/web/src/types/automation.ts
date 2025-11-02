export interface Automation {
  id: string;
  name: string;
  description?: string;
  enabled: boolean;
  triggers: AutomationTrigger[];
  conditions: AutomationCondition[];
  actions: AutomationAction[];
  createdAt: string;
  updatedAt: string;
  lastExecuted?: string;
  executionCount: number;
  userId: string;
  homeId: string;
}

export interface AutomationTrigger {
  id: string;
  type: TriggerType;
  config: TriggerConfig;
}

export enum TriggerType {
  DEVICE_STATE = 'device_state',
  TIME_SCHEDULE = 'time_schedule',
  SUNRISE_SUNSET = 'sunrise_sunset',
  GEOFENCE = 'geofence',
  WEATHER = 'weather',
  SENSOR_VALUE = 'sensor_value',
  WEBHOOK = 'webhook',
  MANUAL = 'manual'
}

export interface TriggerConfig {
  deviceId?: string;
  property?: string;
  operator?: ComparisonOperator;
  value?: any;
  time?: string;
  days?: number[];
  latitude?: number;
  longitude?: number;
  offset?: number;
  geofenceId?: string;
  weatherCondition?: string;
  threshold?: number;
  webhookUrl?: string;
}

export interface AutomationCondition {
  id: string;
  type: ConditionType;
  config: ConditionConfig;
  operator?: LogicalOperator;
}

export enum ConditionType {
  DEVICE_STATE = 'device_state',
  TIME_RANGE = 'time_range',
  DAY_OF_WEEK = 'day_of_week',
  WEATHER = 'weather',
  SENSOR_VALUE = 'sensor_value',
  USER_PRESENCE = 'user_presence',
  SCENE_ACTIVE = 'scene_active'
}

export interface ConditionConfig {
  deviceId?: string;
  property?: string;
  operator?: ComparisonOperator;
  value?: any;
  startTime?: string;
  endTime?: string;
  days?: number[];
  weatherCondition?: string;
  userId?: string;
  sceneId?: string;
}

export enum ComparisonOperator {
  EQUALS = 'equals',
  NOT_EQUALS = 'not_equals',
  GREATER_THAN = 'greater_than',
  LESS_THAN = 'less_than',
  GREATER_THAN_OR_EQUAL = 'greater_than_or_equal',
  LESS_THAN_OR_EQUAL = 'less_than_or_equal',
  CONTAINS = 'contains',
  IN = 'in',
  NOT_IN = 'not_in'
}

export enum LogicalOperator {
  AND = 'and',
  OR = 'or',
  NOT = 'not'
}

export interface AutomationAction {
  id: string;
  type: ActionType;
  config: ActionConfig;
  delay?: number;
}

export enum ActionType {
  DEVICE_CONTROL = 'device_control',
  SCENE_ACTIVATE = 'scene_activate',
  NOTIFICATION = 'notification',
  WEBHOOK = 'webhook',
  EMAIL = 'email',
  SMS = 'sms',
  DELAY = 'delay',
  CONDITIONAL = 'conditional'
}

export interface ActionConfig {
  deviceId?: string;
  property?: string;
  value?: any;
  sceneId?: string;
  message?: string;
  title?: string;
  priority?: NotificationPriority;
  webhookUrl?: string;
  emailTo?: string;
  emailSubject?: string;
  emailBody?: string;
  smsTo?: string;
  smsBody?: string;
  delayMs?: number;
  condition?: AutomationCondition;
  thenActions?: AutomationAction[];
  elseActions?: AutomationAction[];
}

export enum NotificationPriority {
  LOW = 'low',
  NORMAL = 'normal',
  HIGH = 'high',
  URGENT = 'urgent'
}

export interface AutomationExecution {
  id: string;
  automationId: string;
  status: ExecutionStatus;
  startedAt: string;
  completedAt?: string;
  triggeredBy: string;
  actionsExecuted: number;
  actionsFailed: number;
  error?: string;
  logs: ExecutionLog[];
}

export enum ExecutionStatus {
  PENDING = 'pending',
  RUNNING = 'running',
  COMPLETED = 'completed',
  FAILED = 'failed',
  CANCELLED = 'cancelled'
}

export interface ExecutionLog {
  timestamp: string;
  level: LogLevel;
  message: string;
  actionId?: string;
  data?: any;
}

export enum LogLevel {
  DEBUG = 'debug',
  INFO = 'info',
  WARNING = 'warning',
  ERROR = 'error'
}

export interface AutomationTemplate {
  id: string;
  name: string;
  description: string;
  category: string;
  icon: string;
  triggers: AutomationTrigger[];
  conditions: AutomationCondition[];
  actions: AutomationAction[];
  requiredDevices?: string[];
  tags: string[];
}

export interface AutomationStats {
  totalAutomations: number;
  activeAutomations: number;
  totalExecutions: number;
  successfulExecutions: number;
  failedExecutions: number;
  averageExecutionTime: number;
  mostUsedAutomations: Array<{
    id: string;
    name: string;
    executionCount: number;
  }>;
}
