export interface User {
  id: string;
  email: string;
  username: string;
  firstName: string;
  lastName: string;
  avatar?: string;
  phoneNumber?: string;
  role: UserRole;
  status: UserStatus;
  emailVerified: boolean;
  phoneVerified: boolean;
  twoFactorEnabled: boolean;
  preferences: UserPreferences;
  createdAt: string;
  updatedAt: string;
  lastLoginAt?: string;
}

export enum UserRole {
  ADMIN = 'admin',
  OWNER = 'owner',
  MEMBER = 'member',
  GUEST = 'guest'
}

export enum UserStatus {
  ACTIVE = 'active',
  INACTIVE = 'inactive',
  SUSPENDED = 'suspended',
  PENDING = 'pending'
}

export interface UserPreferences {
  theme: Theme;
  language: string;
  timezone: string;
  temperatureUnit: TemperatureUnit;
  dateFormat: string;
  timeFormat: TimeFormat;
  notifications: NotificationSettings;
}

export enum Theme {
  LIGHT = 'light',
  DARK = 'dark',
  AUTO = 'auto'
}

export enum TemperatureUnit {
  CELSIUS = 'celsius',
  FAHRENHEIT = 'fahrenheit'
}

export enum TimeFormat {
  TWELVE_HOUR = '12h',
  TWENTY_FOUR_HOUR = '24h'
}

export interface NotificationSettings {
  email: boolean;
  push: boolean;
  sms: boolean;
  inApp: boolean;
}

export interface Home {
  id: string;
  name: string;
  address: string;
  city: string;
  state: string;
  country: string;
  postalCode: string;
  latitude: number;
  longitude: number;
  timezone: string;
  ownerId: string;
  members: HomeMember[];
  createdAt: string;
  updatedAt: string;
}

export interface HomeMember {
  userId: string;
  role: UserRole;
  permissions: Permission[];
  addedAt: string;
}

export enum Permission {
  VIEW_DEVICES = 'view_devices',
  CONTROL_DEVICES = 'control_devices',
  MANAGE_DEVICES = 'manage_devices',
  VIEW_AUTOMATIONS = 'view_automations',
  MANAGE_AUTOMATIONS = 'manage_automations',
  VIEW_SCENES = 'view_scenes',
  MANAGE_SCENES = 'manage_scenes',
  VIEW_ENERGY = 'view_energy',
  MANAGE_USERS = 'manage_users',
  MANAGE_HOME = 'manage_home'
}
