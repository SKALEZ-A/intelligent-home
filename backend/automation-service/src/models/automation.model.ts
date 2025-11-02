import { Schema, model, Document } from 'mongoose';

export interface ITrigger {
  type: 'time' | 'device' | 'sensor' | 'location' | 'weather' | 'manual';
  config: {
    // Time trigger
    schedule?: string; // cron expression
    time?: string;
    days?: number[];
    
    // Device trigger
    deviceId?: string;
    property?: string;
    operator?: 'equals' | 'greater' | 'less' | 'between' | 'changed';
    value?: any;
    
    // Location trigger
    latitude?: number;
    longitude?: number;
    radius?: number;
    event?: 'enter' | 'exit';
    
    // Weather trigger
    condition?: string;
    temperature?: number;
    
    // Sensor trigger
    sensorType?: string;
    threshold?: number;
  };
}

export interface ICondition {
  type: 'device' | 'time' | 'weather' | 'location' | 'custom';
  operator: 'and' | 'or';
  config: {
    deviceId?: string;
    property?: string;
    comparison?: 'equals' | 'greater' | 'less' | 'between';
    value?: any;
    
    timeStart?: string;
    timeEnd?: string;
    
    weatherCondition?: string;
    
    customScript?: string;
  };
}

export interface IAction {
  type: 'device' | 'notification' | 'scene' | 'delay' | 'webhook' | 'script';
  config: {
    // Device action
    deviceId?: string;
    deviceIds?: string[];
    command?: string;
    parameters?: any;
    
    // Notification action
    title?: string;
    message?: string;
    channels?: ('push' | 'email' | 'sms')[];
    priority?: 'low' | 'normal' | 'high';
    
    // Scene action
    sceneId?: string;
    
    // Delay action
    duration?: number; // milliseconds
    
    // Webhook action
    url?: string;
    method?: 'GET' | 'POST' | 'PUT';
    headers?: Record<string, string>;
    body?: any;
    
    // Script action
    script?: string;
  };
}

export interface IAutomation extends Document {
  userId: string;
  name: string;
  description?: string;
  enabled: boolean;
  triggers: ITrigger[];
  conditions: ICondition[];
  actions: IAction[];
  mode: 'single' | 'parallel' | 'queued' | 'restart';
  maxExecutions?: number;
  cooldown?: number; // seconds
  priority: number;
  tags: string[];
  statistics: {
    executionCount: number;
    lastExecuted?: Date;
    lastSuccess?: Date;
    lastFailure?: Date;
    failureCount: number;
    avgExecutionTime?: number;
  };
  metadata: {
    createdBy: string;
    category?: string;
    icon?: string;
    color?: string;
  };
  createdAt: Date;
  updatedAt: Date;
}

const triggerSchema = new Schema<ITrigger>({
  type: {
    type: String,
    required: true,
    enum: ['time', 'device', 'sensor', 'location', 'weather', 'manual'],
  },
  config: {
    type: Schema.Types.Mixed,
    required: true,
  },
});

const conditionSchema = new Schema<ICondition>({
  type: {
    type: String,
    required: true,
    enum: ['device', 'time', 'weather', 'location', 'custom'],
  },
  operator: {
    type: String,
    enum: ['and', 'or'],
    default: 'and',
  },
  config: {
    type: Schema.Types.Mixed,
    required: true,
  },
});

const actionSchema = new Schema<IAction>({
  type: {
    type: String,
    required: true,
    enum: ['device', 'notification', 'scene', 'delay', 'webhook', 'script'],
  },
  config: {
    type: Schema.Types.Mixed,
    required: true,
  },
});

const automationSchema = new Schema<IAutomation>(
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
    enabled: {
      type: Boolean,
      default: true,
    },
    triggers: {
      type: [triggerSchema],
      required: true,
      validate: {
        validator: (v: ITrigger[]) => v.length > 0,
        message: 'At least one trigger is required',
      },
    },
    conditions: [conditionSchema],
    actions: {
      type: [actionSchema],
      required: true,
      validate: {
        validator: (v: IAction[]) => v.length > 0,
        message: 'At least one action is required',
      },
    },
    mode: {
      type: String,
      enum: ['single', 'parallel', 'queued', 'restart'],
      default: 'single',
    },
    maxExecutions: Number,
    cooldown: Number,
    priority: {
      type: Number,
      default: 0,
    },
    tags: [String],
    statistics: {
      executionCount: {
        type: Number,
        default: 0,
      },
      lastExecuted: Date,
      lastSuccess: Date,
      lastFailure: Date,
      failureCount: {
        type: Number,
        default: 0,
      },
      avgExecutionTime: Number,
    },
    metadata: {
      createdBy: {
        type: String,
        required: true,
      },
      category: String,
      icon: String,
      color: String,
    },
  },
  {
    timestamps: true,
  }
);

automationSchema.index({ userId: 1, enabled: 1 });
automationSchema.index({ tags: 1 });
automationSchema.index({ 'triggers.type': 1 });

export const Automation = model<IAutomation>('Automation', automationSchema);
