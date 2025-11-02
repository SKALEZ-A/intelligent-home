export interface Device {
  id: string;
  userId: string;
  name: string;
  type: DeviceType;
  manufacturer: string;
  model: string;
  firmwareVersion: string;
  protocol: DeviceProtocol;
  macAddress: string;
  ipAddress?: string;
  location: DeviceLocation;
  status: DeviceStatus;
  state: DeviceState;
  capabilities: string[];
  settings: DeviceSettings;
  metadata: DeviceMetadata;
  health: DeviceHealth;
  groups: string[];
  tags: string[];
  isShared: boolean;
  sharedWith: SharedUser[];
  createdAt: string;
  updatedAt: string;
}

export type DeviceType =
  | 'light'
  | 'thermostat'
  | 'lock'
  | 'camera'
  | 'sensor'
  | 'switch'
  | 'outlet'
  | 'fan'
  | 'blinds'
  | 'speaker';

export type DeviceProtocol = 'zigbee' | 'zwave' | 'wifi' | 'bluetooth' | 'matter' | 'thread';

export type DeviceStatus = 'online' | 'offline' | 'error' | 'updating';

export interface DeviceLocation {
  room: string;
  floor?: string;
  zone?: string;
}

export interface DeviceState {
  power: boolean;
  brightness?: number;
  temperature?: number;
  humidity?: number;
  locked?: boolean;
  motion?: boolean;
  contact?: boolean;
  battery?: number;
  [key: string]: any;
}

export interface DeviceSettings {
  autoUpdate: boolean;
  notifications: boolean;
  energySaving: boolean;
  schedule?: DeviceSchedule;
}

export interface DeviceSchedule {
  enabled: boolean;
  rules: ScheduleRule[];
}

export interface ScheduleRule {
  days: number[];
  time: string;
  action: string;
}

export interface DeviceMetadata {
  installDate: string;
  lastMaintenance?: string;
  warrantyExpiry?: string;
  purchasePrice?: number;
}

export interface DeviceHealth {
  signalStrength: number;
  uptime: number;
  lastSeen: string;
  errorCount: number;
  lastError?: string;
}

export interface SharedUser {
  userId: string;
  permissions: string[];
}

export interface DeviceCommand {
  command: string;
  parameters?: any;
}

export interface DeviceGroup {
  id: string;
  userId: string;
  name: string;
  description?: string;
  deviceIds: string[];
  icon?: string;
  color?: string;
  createdAt: string;
  updatedAt: string;
}

export interface DeviceTelemetry {
  time: string;
  deviceId: string;
  metrics: {
    power?: number;
    energy?: number;
    voltage?: number;
    current?: number;
    temperature?: number;
    humidity?: number;
    brightness?: number;
    signalStrength?: number;
    battery?: number;
    [key: string]: any;
  };
}

export interface DeviceEvent {
  time: string;
  deviceId: string;
  eventType: 'state_change' | 'error' | 'warning' | 'info' | 'command' | 'firmware_update';
  severity: 'low' | 'medium' | 'high' | 'critical';
  message: string;
  data?: any;
}

export interface FirmwareUpdate {
  version: string;
  releaseDate: string;
  size: number;
  changelog: string[];
  critical: boolean;
  url: string;
}

export interface DiscoveredDevice {
  id: string;
  name: string;
  type: string;
  manufacturer: string;
  model: string;
  protocol: DeviceProtocol;
  macAddress: string;
  ipAddress?: string;
  capabilities: string[];
  firmwareVersion: string;
  signalStrength: number;
}
