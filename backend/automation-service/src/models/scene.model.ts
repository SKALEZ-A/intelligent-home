import mongoose, { Schema, Document } from 'mongoose';

export interface SceneAction {
  deviceId: string;
  action: string;
  parameters: Record<string, any>;
  delay?: number;
  order: number;
}

export interface Scene extends Document {
  id: string;
  userId: string;
  name: string;
  description?: string;
  icon?: string;
  category?: string;
  actions: SceneAction[];
  executionCount?: number;
  lastExecuted?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const SceneActionSchema = new Schema({
  deviceId: { type: String, required: true },
  action: { type: String, required: true },
  parameters: { type: Schema.Types.Mixed, default: {} },
  delay: { type: Number, default: 0 },
  order: { type: Number, required: true },
});

const SceneSchema = new Schema({
  userId: { type: String, required: true, index: true },
  name: { type: String, required: true },
  description: { type: String },
  icon: { type: String },
  category: { type: String, index: true },
  actions: { type: [SceneActionSchema], required: true },
  executionCount: { type: Number, default: 0 },
  lastExecuted: { type: Date },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now },
});

SceneSchema.index({ userId: 1, createdAt: -1 });
SceneSchema.index({ userId: 1, executionCount: -1 });

export const SceneModel = mongoose.model<Scene>('Scene', SceneSchema);
