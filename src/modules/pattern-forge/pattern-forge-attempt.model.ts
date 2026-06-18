import { Model, Schema, Types, model, models } from 'mongoose';

import type { PatternForgeAttemptDocument } from './pattern-forge.types';

const patternForgeAttemptSchema = new Schema<PatternForgeAttemptDocument>(
  {
    cycleId: { type: Types.ObjectId, ref: 'PatternForgeCycle', required: true, index: true },
    sessionId: {
      type: Types.ObjectId,
      ref: 'PatternForgeDailySession',
      required: true,
      index: true,
    },
    puzzleId: { type: Types.ObjectId, ref: 'Puzzle', required: true, index: true },
    userId: { type: Types.ObjectId, ref: 'User', required: true, index: true },
    selectedMoves: { type: [String], default: [] },
    solutionMoves: { type: [String], default: [] },
    isCorrect: { type: Boolean, required: true },
    isComplete: { type: Boolean, required: true },
    failedAtMoveIndex: { type: Number },
    timeSpentSeconds: { type: Number, required: true, default: 0 },
    usedReveal: { type: Boolean, default: false },
    theme: { type: String, trim: true },
    rating: { type: Number },
    difficulty: {
      type: String,
      enum: ['beginner', 'intermediate', 'advanced', 'expert'],
    },
  },
  { timestamps: true },
);

patternForgeAttemptSchema.index({ cycleId: 1, sessionId: 1, puzzleId: 1, createdAt: -1 });
patternForgeAttemptSchema.index({ isCorrect: 1, isComplete: 1, createdAt: -1, userId: 1 });

export const PatternForgeAttempt: Model<PatternForgeAttemptDocument> =
  models.PatternForgeAttempt ??
  model<PatternForgeAttemptDocument>('PatternForgeAttempt', patternForgeAttemptSchema);
