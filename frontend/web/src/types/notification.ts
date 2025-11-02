export interface Notification {
  id: string;
  userId: string;
  title: string;
  message: string;
  type: NotificationType;
  priority: NotificationPriority;
  read: boolean;
  createdAt: string;
  expiresAt?: string;
  actionUrl?: string;
  actionLabel?: string;
  metadata?: Record<string, any>;
}

export enum NotificationType {
  INFO = 'info',
  SUCCESS = 'success',
  WARNING = 'warning',
  ERROR = 'error',
  DEVICE_ALERT = 'device_alert',
  AUTOMATION_ALERT = 'automation_alert',
  SECURITY_ALERT = 'security_alert',
  ENERGY_ALERT = 'energy_alert'
}

export enum NotificationPriority {
  LOW = 'low',
  NORMAL = 'normal',
  HIGH = 'high',
  URGENT = 'urgent'
}

export interface NotificationPreferences {
  userId: string;
  emailEnabled: boolean;
  pushEnabled: boolean;
  smsEnabled: boolean;
  categories: NotificationCategoryPreference[];
  quietHours?: QuietHours;
}

export interface NotificationCategoryPreference {
  category: string;
  enabled: boolean;
  channels: NotificationChannel[];
}

export enum NotificationChannel {
  EMAIL = 'email',
  PUSH = 'push',
  SMS = 'sms',
  IN_APP = 'in_app'
}

export interface QuietHours {
  enabled: boolean;
  startTime: string;
  endTime: string;
  days: number[];
}
