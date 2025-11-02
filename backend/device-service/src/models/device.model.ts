import { Schema, model, Document } from 'mongoose';

export interface IDevice extends Document {
  userId: string;
  name: string;
  type: 'light' | 'thermostat' | 'lock' | 'camera' | 'sensor' | 'switch' | 'outlet' | 'fan' | 'blinds' | 'speaker';
  manufacturer: string;
  model: string;
  firmwareVersion: string;
  protocol: 'zigbee' | 'zwave' | 'wifi' | 'bluetooth' | 'matter' | 'thread';
  macAddress: string;
  ipAddress?: string;
  location: {
    room: string;
    floor?: string;
    zone?: string;
  };
  status: 'online' | 'offline' | 'error' | 'updating';
  state: {
    power: boolean;
    brightness?: number;
    temperature?: number;
    humidity?: number;
    locked?: boolean;
    motion?: boolean;
    contact?: boolean;
    battery?: number;
    [key: string]: any;
  };
  capabilities: string[];
  settings: {
    autoUpdate: boolean;
    notifications: boolean;
    energySaving: boolean;
    schedule?: {
      enabled: boolean;
      rules: Array<{
        days: number[];
        time: string;
        action: string;
      }>;
    };
  };
  metadata: {
    installDate: Date;
    lastMaintenance?: Date;
    warrantyExpiry?: Date;
    purchasePrice?: number;
  };
  health: {
    signalStrength: number;
    uptime: number;
    lastSeen: Date;
    errorCount: number;
    lastError?: string;
  };
  groups: string[];
  tags: string[];
  isShared: boolean;
  sharedWith: Array<{
    userId: string;
    permissions: string[];
  }>;
  createdAt: Date;
  updatedAt: Date;
}

const deviceSchema = new Schema<IDevice>(
  {
    userId: {
      type: String,
      required: true,
      index: true,
    },
    name: {
      type: String,
      required: true,
      trim: true,
    },
    type: {
      type: String,
      required: true,
      enum: ['light', 'thermostat', 'lock', 'camera', 'sensor', 'switch', 'outlet', 'fan', 'blinds', 'speaker'],
    },
    manufacturer: {
      type: String,
      required: true,
    },
    model: {
      type: String,
      required: true,
    },
    firmwareVersion: {
      type: String,
      required: true,
    },
    protocol: {
      type: String,
      required: true,
      enum: ['zigbee', 'zwave', 'wifi', 'bluetooth', 'matter', 'thread'],
    },
    macAddress: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
    ipAddress: String,
    location: {
      room: {
        type: String,
        required: true,
      },
      floor: String,
      zone: String,
    },
    status: {
      type: String,
      enum: ['online', 'offline', 'error', 'updating'],
      default: 'offline',
    },
    state: {
      type: Schema.Types.Mixed,
      default: { power: false },
    },
    capabilities: [String],
    settings: {
      autoUpdate: {
        type: Boolean,
        default: true,
      },
      notifications: {
        type: Boolean,
        default: true,
      },
      energySaving: {
        type: Boolean,
        default: false,
      },
      schedule: {
        enabled: Boolean,
        rules: [
          {
            days: [Number],
            time: String,
            action: String,
          },
        ],
      },
    },
    metadata: {
      installDate: {
        type: Date,
        default: Date.now,
      },
      lastMaintenance: Date,
      warrantyExpiry: Date,
      purchasePrice: Number,
    },
    health: {
      signalStrength: {
        type: Number,
        default: 0,
      },
      uptime: {
        type: Number,
        default: 0,
      },
      lastSeen: {
        type: Date,
        default: Date.now,
      },
      errorCount: {
        type: Number,
        default: 0,
      },
      lastError: String,
    },
    groups: [String],
    tags: [String],
    isShared: {
      type: Boolean,
      default: false,
    },
    sharedWith: [
      {
        userId: String,
        permissions: [String],
      },
    ],
  },
  {
    timestamps: true,
  }
);

deviceSchema.index({ userId: 1, type: 1 });
deviceSchema.index({ 'location.room': 1 });
deviceSchema.index({ status: 1 });
deviceSchema.index({ tags: 1 });

export const Device = model<IDevice>('Device', deviceSchema);
