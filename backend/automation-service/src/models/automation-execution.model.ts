import mongoose, { Schema, Document } from 'mongoose';

export interface AutomationExecution extends Document {
  id: string;
  automationId: string;
  userId: string;
  status: 'success' | 'failed' | 'partial';
  executedAt: Date;
  executionTime: number;
  triggerData?: Record<string, any>;
  conditionResults?: Record<string, boolean>;
  actionResults?: Array<{
    actionId: string;
    status: 'success' | 'failed';
    error?: string;
    executionTime: number;
  }>;
  error?: string;
  metadata?: Record<string, any>;
}

const AutomationExecutionSchema = new Schema({
  automationId: { type: String, required: true, index: true },
  userId: { type: String, required: true, index: true },
  status: { 
    type: String, 
    required: true, 
    enum: ['success', 'failed', 'partial'],
    index: true 
  },
  executedAt: { type: Date, default: Date.now, index: true },
  executionTime: { type: Number, required: true },
  triggerData: { type: Schema.Types.Mixed },
  conditionResults: { type: Schema.Types.Mixed },
  actionResults: [{
    actionId: { type: String, required: true },
    status: { type: String, required: true, enum: ['success', 'failed'] },
    error: { type: String },
    executionTime: { type: Number, required: true },
  }],
  error: { type: String },
  metadata: { type: Schema.Types.Mixed },
});

AutomationExecutionSchema.index({ automationId: 1, executedAt: -1 });
AutomationExecutionSchema.index({ userId: 1, executedAt: -1 });
AutomationExecutionSchema.index({ status: 1, executedAt: -1 });

export const AutomationExecutionModel = mongoose.model<AutomationExecution>(
  'AutomationExecution',
  AutomationExecutionSchema
);
