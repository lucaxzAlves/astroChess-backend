import { Model, Schema, Types, model, models } from 'mongoose';

import type { PatternForgeDailySessionDocument } from './pattern-forge.types';

const patternForgeDailySessionSchema = new Schema<PatternForgeDailySessionDocument>(
  {
    cycleId: { type: Types.ObjectId, ref: 'PatternForgeCycle', required: true, index: true },
    userId: { type: Types.ObjectId, ref: 'User', required: true, index: true },
    date: { type: Date, required: true, index: true },
    round: { type: Number, required: true },
    dailyTarget: { type: Number, required: true },
    targetPuzzles: { type: Number, required: true },
    puzzleIds: {
      type: [{ type: Types.ObjectId, ref: 'Puzzle' }],
      default: [],
    },
    completedPuzzleIds: {
      type: [{ type: Types.ObjectId, ref: 'Puzzle' }],
      default: [],
    },
    correctCount: { type: Number, default: 0 },
    wrongCount: { type: Number, default: 0 },
    skippedCount: { type: Number, default: 0 },
    accuracy: { type: Number, default: 0 },
    averageSolveTimeSeconds: { type: Number, default: 0 },
    status: {
      type: String,
      enum: ['active', 'completed'],
      default: 'active',
    },
    completedAt: { type: Date },
  },
  { timestamps: { createdAt: true, updatedAt: false } },
);

patternForgeDailySessionSchema.index({ cycleId: 1, round: 1, date: 1 }, { unique: true });

export const PatternForgeDailySession: Model<PatternForgeDailySessionDocument> =
  models.PatternForgeDailySession ??
  model<PatternForgeDailySessionDocument>(
    'PatternForgeDailySession',
    patternForgeDailySessionSchema,
  );
