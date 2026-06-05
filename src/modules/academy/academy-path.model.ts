import { Model, Schema, Types, model, models } from 'mongoose';

import type { AcademyPathDocument } from './academy.types';

const coverSchema = new Schema(
  {
    type: {
      type: String,
      enum: ['icon', 'image', 'board_preview'],
      required: true,
    },
    imageUrl: { type: String, trim: true },
    icon: { type: String, trim: true },
  },
  { _id: false },
);

const academyPathSchema = new Schema<AcademyPathDocument>(
  {
    title: { type: String, required: true, trim: true },
    slug: { type: String, required: true, trim: true, unique: true, index: true },
    subtitle: { type: String, trim: true },
    description: { type: String, required: true, trim: true },
    level: {
      type: String,
      enum: ['beginner', 'beginner_to_intermediate', 'intermediate', 'advanced'],
      required: true,
      index: true,
    },
    category: {
      type: String,
      enum: ['calculation', 'tactics', 'strategy', 'endgame', 'opening', 'defense', 'attack'],
      required: true,
      index: true,
    },
    tags: { type: [String], default: [] },
    durationWeeks: { type: Number },
    moduleCount: { type: Number, default: 0 },
    lessonCount: { type: Number, default: 0 },
    status: {
      type: String,
      enum: ['draft', 'published', 'archived'],
      default: 'draft',
      index: true,
    },
    order: { type: Number, default: 0, index: true },
    cover: { type: coverSchema },
    createdBy: { type: Types.ObjectId, ref: 'User' },
  },
  { timestamps: true },
);

academyPathSchema.index({ slug: 1 }, { unique: true });
academyPathSchema.index({ status: 1 });
academyPathSchema.index({ category: 1 });
academyPathSchema.index({ level: 1 });
academyPathSchema.index({ order: 1 });

export const AcademyPath: Model<AcademyPathDocument> =
  models.AcademyPath ?? model<AcademyPathDocument>('AcademyPath', academyPathSchema);

