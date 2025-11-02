import { Schema, model, Document } from 'mongoose';

export interface IEnergyProfile extends Document {
  userId: string;
  name: string;
  description?: string;
  settings: {
    peakHours: Array<{
      start: string;
      end: string;
      days: number[];
    }>;
    offPeakHours: Array<{
      start: string;
      end: string;
      days: number[];
    }>;
    rates: {
      peak: number;
      offPeak: number;
      shoulder?: number;
      currency: string;
    };
    solarEnabled: boolean;
    solarCapacity?: number;
    batteryEnabled: boolean;
    batteryCapacity?: number;
    gridExportEnabled: boolean;
    gridExportRate?: number;
  };
  goals: {
    dailyLimit?: number;
    monthlyLimit?: number;
    costLimit?: number;
    carbonReduction?: number;
  };
  preferences: {
    prioritizeRenewable: boolean;
    allowLoadShifting: boolean;
    comfortLevel: 'low' | 'medium' | 'high';
    notifications: {
      highUsage: boolean;
      goalReached: boolean;
      costAlert: boolean;
      threshold: number;
    };
  };
  statistics: {
    totalConsumption: number;
    totalCost: number;
    totalSavings: number;
    carbonFootprint: number;
    lastUpdated: Date;
  };
  createdAt: Date;
  updatedAt: Date;
}

const energyProfileSchema = new Schema<IEnergyProfile>(
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
    description: {
      type: String,
      trim: true,
    },
    settings: {
      peakHours: [
        {
          start: String,
          end: String,
          days: [Number],
        },
      ],
      offPeakHours: [
        {
          start: String,
          end: String,
          days: [Number],
        },
      ],
      rates: {
        peak: {
          type: Number,
          required: true,
        },
        offPeak: {
          type: Number,
          required: true,
        },
        shoulder: Number,
        currency: {
          type: String,
          default: 'USD',
        },
      },
      solarEnabled: {
        type: Boolean,
        default: false,
      },
      solarCapacity: Number,
      batteryEnabled: {
        type: Boolean,
        default: false,
      },
      batteryCapacity: Number,
      gridExportEnabled: {
        type: Boolean,
        default: false,
      },
      gridExportRate: Number,
    },
    goals: {
      dailyLimit: Number,
      monthlyLimit: Number,
      costLimit: Number,
      carbonReduction: Number,
    },
    preferences: {
      prioritizeRenewable: {
        type: Boolean,
        default: true,
      },
      allowLoadShifting: {
        type: Boolean,
        default: true,
      },
      comfortLevel: {
        type: String,
        enum: ['low', 'medium', 'high'],
        default: 'medium',
      },
      notifications: {
        highUsage: {
          type: Boolean,
          default: true,
        },
        goalReached: {
          type: Boolean,
          default: true,
        },
        costAlert: {
          type: Boolean,
          default: true,
        },
        threshold: {
          type: Number,
          default: 80,
        },
      },
    },
    statistics: {
      totalConsumption: {
        type: Number,
        default: 0,
      },
      totalCost: {
        type: Number,
        default: 0,
      },
      totalSavings: {
        type: Number,
        default: 0,
      },
      carbonFootprint: {
        type: Number,
        default: 0,
      },
      lastUpdated: {
        type: Date,
        default: Date.now,
      },
    },
  },
  {
    timestamps: true,
  }
);

energyProfileSchema.index({ userId: 1, name: 1 });

export const EnergyProfile = model<IEnergyProfile>('EnergyProfile', energyProfileSchema);
