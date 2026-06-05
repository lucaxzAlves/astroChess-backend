import { Model, Schema, Types, model, models } from 'mongoose';

import type { AcademyModuleDocument } from './academy.types';

const unlockRuleSchema = new Schema(
  {
    type: {
      type: String,
      enum: ['always', 'previous_module_completed', 'manual'],
      required: true,
    },
    requiredModuleId: { type: Types.ObjectId, ref: 'AcademyModule' },
  },
  { _id: false },
);

const academyModuleSchema = new Schema<AcademyModuleDocument>(
  {
    pathId: { type: Types.ObjectId, ref: 'AcademyPath', required: true, index: true },
    title: { type: String, required: true, trim: true },
    slug: { type: String, required: true, trim: true },
    subtitle: { type: String, trim: true },
    description: { type: String, required: true, trim: true },
    label: { type: String, trim: true },
    order: { type: Number, default: 0 },
    estimatedLessons: { type: Number },
    estimatedMinutes: { type: Number },
    status: {
      type: String,
      enum: ['draft', 'published', 'archived'],
      default: 'draft',
      index: true,
    },
    unlockRule: { type: unlockRuleSchema },
  },
  { timestamps: true },
);

academyModuleSchema.index({ pathId: 1, order: 1 });
academyModuleSchema.index({ pathId: 1, slug: 1 }, { unique: true });
academyModuleSchema.index({ status: 1 });

export const AcademyModule: Model<AcademyModuleDocument> =
  models.AcademyModule ?? model<AcademyModuleDocument>('AcademyModule', academyModuleSchema);

