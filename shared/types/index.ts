// Core Types for Intelligent Home Automation System

export type UserRole = 'owner' | 'admin' | 'member' | 'guest';
export type DeviceType = 'light' | 'switch' | 'thermostat' | 'lock' | 'camera' | 'sensor' | 'plug' | 'fan' | 'blind' | 'garage' | 'doorbell' | 'valve' | 'appliance' | 'speaker' | 'tv' | 'vacuum' | 'air_purifier' | 'humidifier' | 'dehumidifier' | 'heater' | 'cooler' | 'irrigation' | 'pool' | 'spa';
export type Protocol = 'zigbee' | 'zwave' | 'wifi' | 'bluetooth' | 'thread' | 'matter' | 'http' | 'mqtt' | 'modbus';
export type TriggerType = 'time' | 'device' | 'sensor' | 'location' | 'weather' | 'sunrise' | 'sunset' | 'manual';
export type ConditionOperator = 'and' | 'or' | 'not';
export type ActionType = 'device' | 'scene' | 'notification' | 'webhook' | 'delay' | 'script';
export type NotificationChannel = 'push' | 'email' | 'sms' | 'voice';
export type SecurityEventType = 'motion' | 'intrusion' | 'door' | 'window' | 'alarm' | 'face_detected' | 'package_delivery';
export type Severity = 'low' | 'medium' | 'high' | 'critical';
export type CommandStatus = 'pending' | 'executing' | 'completed' | 'failed' | 'timeout';

// User Management
export interface User {
  id: string;
  email: string;
  passwordHash: string;
  firstName: string;
  lastName: string;
  role: UserRole;
  mfaEnabled: boolean;
  mfaSecret?: string;
  phoneNumber?: string;
  avatar?: string;
  homes: string[];
  preferences: UserPreferences;
  createdAt: Date;
  updatedAt: Date;
  lastLogin?: Date;
  failedLoginAttempts: number;
  accountLockedUntil?: Date;
  emailVerified: boolean;
  phoneVerified: boolean;
}

export interface UserPreferences {
  language: string;
  timezone: string;
  temperatureUnit: 'celsius' | 'fahrenheit';
  currency: string;
  theme: 'light' | 'dark' | 'auto';
  notifications: NotificationPreferences;
  privacy: PrivacySettings;
}

export interface NotificationPreferences {
  enabledChannels: NotificationChannel[];
  quietHoursStart?: string;
  quietHoursEnd?: string;
  criticalOnly: boolean;
  preferences: Record<string, ChannelPreference>;
}

export interface ChannelPreference {
  enabled: boolean;
  eventTypes: string[];
}

export interface PrivacySettings {
  shareUsageData: boolean;
  shareEnergyData: boolean;
  allowRemoteAccess: boolean;
  localProcessingOnly: boolean;
}

export interface Session {
  userId: string;
  token: string;
  refreshToken: string;
  expiresAt: Date;
  deviceInfo: string;
  ipAddress: string;
  userAgent: string;
  createdAt: Date;
}

// Home Management
export interface Home {
  id: string;
  name: string;
  address: Address;
  ownerId: string;
  members: HomeMember[];
  timezone: string;
  location: GeoLocation;
  settings: HomeSettings;
  createdAt: Date;
  updatedAt: Date;
}

export interface Address {
  street: string;
  city: string;
  state: string;
  country: string;
  postalCode: string;
}

export interface GeoLocation {
  latitude: number;
  longitude: number;
  geofenceRadius: number; // in meters
}

export interface HomeMember {
  userId: string;
  role: UserRole;
  permissions: string[];
  addedAt: Date;
  expiresAt?: Date;
}

export interface HomeSettings {
  awayMode: boolean;
  vacationMode: boolean;
  guestMode: boolean;
  securityArmed: boolean;
  energySavingMode: boolean;
}

// Device Management
export interface Device {
  id: string;
  name: string;
  type: DeviceType;
  protocol: Protocol;
  manufacturer: string;
  model: string;
  firmwareVersion: string;
  hardwareVersion?: string;
  serialNumber?: string;
  capabilities: Capability[];
  location: string;
  room?: string;
  floor?: string;
  hubId: string;
  homeId: string;
  userId: string;
  state: DeviceState;
  metadata: DeviceMetadata;
  lastSeen: Date;
  batteryLevel?: number;
  batteryCharging?: boolean;
  isOnline: boolean;
  isPaired: boolean;
  isReachable: boolean;
  signalStrength?: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface Capability {
  name: string;
  type: 'boolean' | 'number' | 'string' | 'enum' | 'color' | 'temperature';
  readable: boolean;
  writable: boolean;
  min?: number;
  max?: number;
  step?: number;
  unit?: string;
  values?: string[];
}

export interface DeviceState {
  deviceId: string;
  attributes: Record<string, any>;
  timestamp: Date;
  version: number;
  source: 'user' | 'automation' | 'schedule' | 'ai' | 'external';
}

export interface DeviceMetadata {
  tags: string[];
  category: string;
  icon: string;
  color?: string;
  customFields: Record<string, any>;
  installDate?: Date;
  warrantyExpiry?: Date;
  purchasePrice?: number;
  energyRating?: string;
}

export interface DeviceCommand {
  id: string;
  deviceId: string;
  command: string;
  parameters: Record<string, any>;
  status: CommandStatus;
  priority: number;
  retryCount: number;
  maxRetries: number;
  createdAt: Date;
  executedAt?: Date;
  completedAt?: Date;
  error?: string;
  userId?: string;
  source: string;
}

export interface DeviceHealth {
  deviceId: string;
  healthScore: number; // 0-100
  uptime: number; // percentage
  avgResponseTime: number; // milliseconds
  errorRate: number; // percentage
  lastError?: string;
  lastErrorAt?: Date;
  batteryHealth?: number;
  signalQuality?: number;
  recommendations: string[];
}

// Automation
export interface Automation {
  id: string;
  name: string;
  description: string;
  homeId: string;
  userId: string;
  enabled: boolean;
  priority: number;
  triggers: Trigger[];
  conditions: Condition[];
  actions: Action[];
  mode: 'single' | 'restart' | 'queued' | 'parallel';
  maxExecutions?: number;
  cooldownPeriod?: number; // seconds
  createdAt: Date;
  updatedAt: Date;
  lastExecuted?: Date;
  executionCount: number;
  successCount: number;
  failureCount: number;
}

export interface Trigger {
  id: string;
  type: TriggerType;
  config: TriggerConfig;
  enabled: boolean;
}

export type TriggerConfig = 
  | TimeTriggerConfig
  | DeviceTriggerConfig
  | SensorTriggerConfig
  | LocationTriggerConfig
  | WeatherTriggerConfig
  | SunTriggerConfig;

export interface TimeTriggerConfig {
  type: 'time';
  time?: string; // HH:mm format
  days?: number[]; // 0-6, Sunday = 0
  cron?: string;
}

export interface DeviceTriggerConfig {
  type: 'device';
  deviceId: string;
  attribute: string;
  operator: 'eq' | 'ne' | 'gt' | 'lt' | 'gte' | 'lte' | 'contains';
  value: any;
  duration?: number; // seconds
}

export interface SensorTriggerConfig {
  type: 'sensor';
  sensorId: string;
  metric: string;
  operator: 'eq' | 'ne' | 'gt' | 'lt' | 'gte' | 'lte';
  value: number;
  duration?: number;
}

export interface LocationTriggerConfig {
  type: 'location';
  userId: string;
  event: 'enter' | 'exit' | 'dwell';
  geofenceId?: string;
  dwellTime?: number; // seconds
}

export interface WeatherTriggerConfig {
  type: 'weather';
  condition: 'temperature' | 'humidity' | 'precipitation' | 'wind' | 'condition';
  operator: 'eq' | 'ne' | 'gt' | 'lt' | 'gte' | 'lte';
  value: any;
}

export interface SunTriggerConfig {
  type: 'sunrise' | 'sunset';
  offset?: number; // minutes, can be negative
}

export interface Condition {
  id: string;
  type: 'device' | 'time' | 'weather' | 'location' | 'custom';
  operator: ConditionOperator;
  expression: string;
  config: Record<string, any>;
}

export interface Action {
  id: string;
  type: ActionType;
  target: string;
  parameters: Record<string, any>;
  delay?: number; // seconds
  enabled: boolean;
}

export interface AutomationExecution {
  id: string;
  automationId: string;
  triggeredBy: string;
  startedAt: Date;
  completedAt?: Date;
  status: 'running' | 'completed' | 'failed' | 'cancelled';
  actions: ActionExecution[];
  error?: string;
}

export interface ActionExecution {
  actionId: string;
  status: 'pending' | 'running' | 'completed' | 'failed' | 'skipped';
  startedAt?: Date;
  completedAt?: Date;
  result?: any;
  error?: string;
}

// Scene Management
export interface Scene {
  id: string;
  name: string;
  description?: string;
  homeId: string;
  userId: string;
  icon: string;
  color?: string;
  deviceStates: DeviceStateConfig[];
  isPredefined: boolean;
  category?: string;
  createdAt: Date;
  updatedAt: Date;
  lastActivated?: Date;
  activationCount: number;
}

export interface DeviceStateConfig {
  deviceId: string;
  attributes: Record<string, any>;
  transitionTime?: number; // milliseconds
}

// Energy Management
export interface EnergyReading {
  deviceId: string;
  timestamp: Date;
  powerWatts: number;
  energyWh: number;
  voltage?: number;
  current?: number;
  powerFactor?: number;
  frequency?: number;
}

export interface EnergyProfile {
  homeId: string;
  userId: string;
  utilityRate: number;
  currency: string;
  solarEnabled: boolean;
  solarCapacity?: number; // kW
  batteryEnabled: boolean;
  batteryCapacity?: number; // kWh
  peakHours: TimeRange[];
  offPeakRate: number;
  peakRate: number;
  demandCharge?: number;
  gridExportRate?: number;
}

export interface TimeRange {
  start: string; // HH:mm
  end: string; // HH:mm
  days?: number[];
}

export interface EnergyConsumption {
  homeId: string;
  period: 'hour' | 'day' | 'week' | 'month' | 'year';
  startDate: Date;
  endDate: Date;
  totalEnergyWh: number;
  totalCost: number;
  peakEnergyWh: number;
  offPeakEnergyWh: number;
  solarProductionWh?: number;
  gridImportWh?: number;
  gridExportWh?: number;
  batteryChargeWh?: number;
  batteryDischargeWh?: number;
  deviceBreakdown: DeviceEnergyBreakdown[];
}

export interface DeviceEnergyBreakdown {
  deviceId: string;
  deviceName: string;
  energyWh: number;
  cost: number;
  percentage: number;
  avgPowerWatts: number;
  peakPowerWatts: number;
  runtimeHours: number;
}

export interface EnergyForecast {
  homeId: string;
  period: 'day' | 'week' | 'month';
  forecastDate: Date;
  predictedEnergyWh: number;
  predictedCost: number;
  confidence: number; // 0-1
  factors: string[];
}

export interface EnergyRecommendation {
  id: string;
  homeId: string;
  type: 'schedule' | 'device' | 'behavior' | 'upgrade';
  title: string;
  description: string;
  potentialSavings: number; // percentage
  estimatedCostSavings: number;
  difficulty: 'easy' | 'medium' | 'hard';
  priority: number;
  actions: string[];
  createdAt: Date;
  implemented: boolean;
}

// Security
export interface SecurityEvent {
  id: string;
  homeId: string;
  type: SecurityEventType;
  severity: Severity;
  deviceId: string;
  timestamp: Date;
  imageUrl?: string;
  videoUrl?: string;
  thumbnailUrl?: string;
  faceId?: string;
  personName?: string;
  confidence?: number;
  location: string;
  description: string;
  resolved: boolean;
  resolvedAt?: Date;
  resolvedBy?: string;
  notes?: string;
  metadata: Record<string, any>;
}

export interface RegisteredFace {
  id: string;
  homeId: string;
  userId?: string;
  name: string;
  relationship?: string;
  encoding: number[];
  images: string[];
  createdAt: Date;
  updatedAt: Date;
  lastSeen?: Date;
  seenCount: number;
}

export interface SecurityCamera {
  id: string;
  deviceId: string;
  homeId: string;
  name: string;
  location: string;
  streamUrl: string;
  recordingEnabled: boolean;
  motionDetectionEnabled: boolean;
  faceRecognitionEnabled: boolean;
  resolution: string;
  fps: number;
  nightVisionEnabled: boolean;
  audioEnabled: boolean;
  ptzCapable: boolean;
  storageLocation: 'local' | 'cloud' | 'both';
  retentionDays: number;
}

// Notifications
export interface Notification {
  id: string;
  userId: string;
  homeId: string;
  type: string;
  priority: 'low' | 'normal' | 'high' | 'critical';
  title: string;
  message: string;
  channels: NotificationChannel[];
  data?: Record<string, any>;
  imageUrl?: string;
  actionUrl?: string;
  actions?: NotificationAction[];
  sentAt: Date;
  deliveredAt?: Date;
  readAt?: Date;
  expiresAt?: Date;
}

export interface NotificationAction {
  id: string;
  label: string;
  action: string;
  parameters?: Record<string, any>;
}

// Analytics
export interface DeviceUsageStats {
  deviceId: string;
  deviceName: string;
  period: 'day' | 'week' | 'month';
  startDate: Date;
  endDate: Date;
  activationCount: number;
  totalRuntimeHours: number;
  avgRuntimePerActivation: number;
  peakUsageHour: number;
  usageByHour: number[];
  usageByDay: number[];
}

export interface AutomationPerformance {
  automationId: string;
  automationName: string;
  period: 'day' | 'week' | 'month';
  startDate: Date;
  endDate: Date;
  executionCount: number;
  successCount: number;
  failureCount: number;
  successRate: number;
  avgExecutionTime: number;
  maxExecutionTime: number;
  minExecutionTime: number;
  errors: AutomationError[];
}

export interface AutomationError {
  timestamp: Date;
  error: string;
  actionId?: string;
  deviceId?: string;
}

// ML Models
export interface BehaviorPattern {
  id: string;
  homeId: string;
  userId?: string;
  type: 'routine' | 'preference' | 'anomaly';
  name: string;
  description: string;
  confidence: number;
  frequency: number;
  timePattern?: TimePattern;
  devicePattern?: DevicePattern[];
  conditions?: string[];
  suggestedAutomation?: Partial<Automation>;
  createdAt: Date;
  lastOccurred: Date;
}

export interface TimePattern {
  daysOfWeek: number[];
  timeRanges: TimeRange[];
  seasonality?: 'daily' | 'weekly' | 'monthly';
}

export interface DevicePattern {
  deviceId: string;
  action: string;
  sequence: number;
  probability: number;
}

export interface PresencePrediction {
  homeId: string;
  room?: string;
  timestamp: Date;
  occupied: boolean;
  confidence: number;
  occupants?: string[];
  predictedDuration?: number; // minutes
}

export interface AnomalyDetection {
  id: string;
  homeId: string;
  type: 'device' | 'energy' | 'security' | 'behavior';
  severity: Severity;
  deviceId?: string;
  timestamp: Date;
  description: string;
  anomalyScore: number;
  expectedValue?: any;
  actualValue?: any;
  possibleCauses: string[];
  recommendations: string[];
  acknowledged: boolean;
}

// Weather
export interface WeatherData {
  location: GeoLocation;
  timestamp: Date;
  temperature: number;
  feelsLike: number;
  humidity: number;
  pressure: number;
  windSpeed: number;
  windDirection: number;
  cloudCover: number;
  precipitation: number;
  uvIndex: number;
  visibility: number;
  condition: string;
  icon: string;
  sunrise: Date;
  sunset: Date;
}

export interface WeatherForecast {
  location: GeoLocation;
  forecastDate: Date;
  hourly: HourlyForecast[];
  daily: DailyForecast[];
}

export interface HourlyForecast {
  timestamp: Date;
  temperature: number;
  precipitation: number;
  precipitationProbability: number;
  windSpeed: number;
  condition: string;
}

export interface DailyForecast {
  date: Date;
  temperatureMin: number;
  temperatureMax: number;
  precipitation: number;
  precipitationProbability: number;
  condition: string;
  sunrise: Date;
  sunset: Date;
}

// Integration
export interface Integration {
  id: string;
  homeId: string;
  type: string;
  name: string;
  enabled: boolean;
  config: Record<string, any>;
  credentials?: Record<string, any>;
  lastSync?: Date;
  syncStatus: 'success' | 'failed' | 'pending';
  error?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface Webhook {
  id: string;
  homeId: string;
  userId: string;
  name: string;
  url: string;
  method: 'GET' | 'POST' | 'PUT' | 'DELETE';
  headers?: Record<string, string>;
  events: string[];
  enabled: boolean;
  secret?: string;
  retryCount: number;
  timeout: number;
  lastTriggered?: Date;
  successCount: number;
  failureCount: number;
  createdAt: Date;
}

// Backup & Restore
export interface Backup {
  id: string;
  homeId: string;
  userId: string;
  type: 'automatic' | 'manual';
  timestamp: Date;
  size: number;
  encrypted: boolean;
  location: string;
  checksum: string;
  includes: string[];
  status: 'creating' | 'completed' | 'failed';
  error?: string;
  expiresAt?: Date;
}

export interface RestoreJob {
  id: string;
  backupId: string;
  homeId: string;
  userId: string;
  startedAt: Date;
  completedAt?: Date;
  status: 'pending' | 'running' | 'completed' | 'failed';
  progress: number;
  currentStep?: string;
  error?: string;
  restoredItems: string[];
}

// API Response Types
export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: ApiError;
  meta?: ResponseMeta;
}

export interface ApiError {
  code: string;
  message: string;
  details?: Record<string, any>;
  timestamp: Date;
  requestId: string;
  path?: string;
}

export interface ResponseMeta {
  page?: number;
  limit?: number;
  total?: number;
  hasMore?: boolean;
  timestamp: Date;
}

export interface PaginatedResponse<T> {
  items: T[];
  meta: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
    hasMore: boolean;
  };
}

// WebSocket Events
export interface WebSocketMessage {
  type: string;
  payload: any;
  timestamp: Date;
  requestId?: string;
}

export interface DeviceStateUpdate extends WebSocketMessage {
  type: 'device:state';
  payload: {
    deviceId: string;
    state: DeviceState;
  };
}

export interface AutomationTriggered extends WebSocketMessage {
  type: 'automation:triggered';
  payload: {
    automationId: string;
    triggeredBy: string;
  };
}

export interface SecurityEventOccurred extends WebSocketMessage {
  type: 'security:event';
  payload: SecurityEvent;
}

// Room Management
export interface Room {
  id: string;
  homeId: string;
  name: string;
  floor: string;
  type: 'living_room' | 'bedroom' | 'kitchen' | 'bathroom' | 'office' | 'garage' | 'outdoor' | 'other';
  area?: number; // square meters
  devices: string[];
  sensors: string[];
  icon?: string;
  color?: string;
  createdAt: Date;
  updatedAt: Date;
}

// Floor Plan
export interface FloorPlan {
  id: string;
  homeId: string;
  name: string;
  level: number;
  imageUrl?: string;
  rooms: RoomLayout[];
  devices: DeviceLayout[];
  createdAt: Date;
  updatedAt: Date;
}

export interface RoomLayout {
  roomId: string;
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface DeviceLayout {
  deviceId: string;
  x: number;
  y: number;
}

// Voice Assistant
export interface VoiceCommand {
  id: string;
  userId: string;
  homeId: string;
  platform: 'alexa' | 'google' | 'siri' | 'custom';
  command: string;
  intent: string;
  entities: Record<string, any>;
  response: string;
  executed: boolean;
  timestamp: Date;
}

export interface VoiceProfile {
  id: string;
  userId: string;
  platform: string;
  voiceprint?: string;
  preferences: Record<string, any>;
  customCommands: CustomVoiceCommand[];
  createdAt: Date;
  updatedAt: Date;
}

export interface CustomVoiceCommand {
  phrase: string;
  action: string;
  parameters?: Record<string, any>;
  enabled: boolean;
}
