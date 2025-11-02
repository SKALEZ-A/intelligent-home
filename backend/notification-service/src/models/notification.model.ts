import { Schema, model, Document } from 'mongoose';

export interface INotification extends Document {
  userId: string;
  type: 'info' | 'warning' | 'error' | 'success' | 'alert';
  category: 'device' | 'automation' | 'energy' | 'security' | 'system' | 'update';
  title: string;
  message: string;
  data?: any;
  priority: 'low' | 'normal' | 'high' | 'critical';
  channels: ('push' | 'email' | 'sms' | 'in_app')[];
  status: 'pending' | 'sent' | 'delivered' | 'read' | 'failed';
  deliveryStatus: {
    push?: {
      sent: boolean;
      sentAt?: Date;
      error?: string;
    };
    email?: {
      sent: boolean;
      sentAt?: Date;
      error?: string;
    };
    sms?: {
      sent: boolean;
      sentAt?: Date;
      error?: string;
    };
    in_app?: {
      delivered: boolean;
      deliveredAt?: Date;
      readAt?: Date;
    };
  };
  actionable: boolean;
  actions?: Array<{
    label: string;
    action: string;
    data?: any;
  }>;
  expiresAt?: Date;
  readAt?: Date;
  dismissedAt?: Date;
  metadata: {
    deviceId?: string;
    automationId?: string;
    source?: string;
    correlationId?: string;
  };
  createdAt: Date;
  updatedAt: Date;
}

const notificationSchema = new Schema<INotification>(
  {
    userId: {
      type: String,
      required: true,
      index: true,
    },
    type: {
      type: String,
      required: true,
      enum: ['info', 'warning', 'error', 'success', 'alert'],
    },
    category: {
      type: String,
      required: true,
      enum: ['device', 'automation', 'energy', 'security', 'system', 'update'],
    },
    title: {
      type: String,
      required: true,
    },
    message: {
      type: String,
      required: true,
    },
    data: Schema.Types.Mixed,
    priority: {
      type: String,
      enum: ['low', 'normal', 'high', 'critical'],
      default: 'normal',
    },
    channels: {
      type: [String],
      enum: ['push', 'email', 'sms', 'in_app'],
      default: ['in_app'],
    },
    status: {
      type: String,
      enum: ['pending', 'sent', 'delivered', 'read', 'failed'],
      default: 'pending',
    },
    deliveryStatus: {
      push: {
        sent: Boolean,
        sentAt: Date,
        error: String,
      },
      email: {
        sent: Boolean,
        sentAt: Date,
        error: String,
      },
      sms: {
        sent: Boolean,
        sentAt: Date,
        error: String,
      },
      in_app: {
        delivered: Boolean,
        deliveredAt: Date,
        readAt: Date,
      },
    },
    actionable: {
      type: Boolean,
      default: false,
    },
    actions: [
      {
        label: String,
        action: String,
        data: Schema.Types.Mixed,
      },
    ],
    expiresAt: Date,
    readAt: Date,
    dismissedAt: Date,
    metadata: {
      deviceId: String,
      automationId: String,
      source: String,
      correlationId: String,
    },
  },
  {
    timestamps: true,
  }
);

notificationSchema.index({ userId: 1, status: 1 });
notificationSchema.index({ userId: 1, category: 1 });
notificationSchema.index({ userId: 1, createdAt: -1 });
notificationSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

export const Notification = model<INotification>('Notification', notificationSchema);
