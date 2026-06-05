import { Model, Schema, Types, model, models } from 'mongoose';

import type { PatternForgeCycleDocument } from './pattern-forge.types';

const themeReasonSchema = new Schema(
  {
    theme: { type: String, required: true, trim: true },
    reason: { type: String, required: true, trim: true },
    sourceField: { type: String, required: true, trim: true },
    confidence: { type: Number, required: true },
  },
  { _id: false },
);

const roundPlanSchema = new Schema(
  {
    round: { type: Number, required: true },
    targetDays: { type: Number, required: true },
    dailyTarget: { type: Number, required: true },
    goal: { type: String, trim: true },
    status: {
      type: String,
      enum: ['pending', 'active', 'completed'],
      default: 'pending',
    },
    completedPuzzles: { type: Number, default: 0 },
    accuracy: { type: Number, default: 0 },
    averageSolveTimeSeconds: { type: Number, default: 0 },
    startedAt: { type: Date },
    completedAt: { type: Date },
  },
  { _id: false },
);

const patternForgeCycleSchema = new Schema<PatternForgeCycleDocument>(
  {
    userId: { type: Types.ObjectId, ref: 'User', required: true, index: true },
    username: { type: String, required: true, trim: true, index: true },
    source: {
      type: String,
      enum: ['pattern_forge'],
      default: 'pattern_forge',
      required: true,
    },
    status: {
      type: String,
      enum: ['active', 'paused', 'completed', 'cancelled'],
      default: 'active',
      index: true,
    },
    patternSet: {
      puzzleCount: { type: Number, required: true },
      themes: { type: [String], default: [] },
      automaticThemesEnabled: { type: Boolean, default: true },
      automaticThemes: { type: [String], default: [] },
      manualThemes: { type: [String], default: [] },
      themeReasons: { type: [themeReasonSchema], default: [] },
      difficulty: {
        type: String,
        enum: ['beginner', 'intermediate', 'advanced', 'expert'],
        required: true,
      },
      minRating: { type: Number, required: true },
      maxRating: { type: Number, required: true },
      includePersonalWeaknesses: { type: Boolean, default: true },
    },
    repetitionPlan: {
      compressionPreset: { type: String, trim: true },
      rounds: { type: [roundPlanSchema], default: [] },
      currentRound: { type: Number, default: 1 },
    },
    rules: {
      repeatMissedPuzzles: { type: Boolean, default: true },
      repeatSlowSolves: { type: Boolean, default: true },
      prioritizeWeaknesses: { type: Boolean, default: true },
      endRoundWithMistakeReview: { type: Boolean, default: true },
    },
    puzzleIds: {
      type: [{ type: Types.ObjectId, ref: 'Puzzle' }],
      default: [],
    },
    mistakeQueue: {
      type: [
        new Schema(
          {
            puzzleId: { type: Types.ObjectId, ref: 'Puzzle', required: true },
            reason: {
              type: String,
              enum: ['wrong', 'slow'],
              required: true,
            },
            queuedAt: { type: Date, required: true, default: Date.now },
            lastServedAt: { type: Date },
            servedCount: { type: Number, default: 0 },
          },
          { _id: false },
        ),
      ],
      default: [],
    },
    progress: {
      currentRound: { type: Number, default: 1 },
      currentDay: { type: Number, default: 1 },
      completedPuzzlesInRound: { type: Number, default: 0 },
      completedToday: { type: Number, default: 0 },
      totalSolvedAcrossCycle: { type: Number, default: 0 },
      streakDays: { type: Number, default: 0 },
      accuracy: { type: Number, default: 0 },
      mistakesQueued: { type: Number, default: 0 },
      roundAccuracy: { type: Number, default: 0 },
      roundAverageSolveTimeSeconds: { type: Number, default: 0 },
    },
  },
  { timestamps: true },
);

patternForgeCycleSchema.index({ userId: 1, username: 1, status: 1 });

export const PatternForgeCycle: Model<PatternForgeCycleDocument> =
  models.PatternForgeCycle ??
  model<PatternForgeCycleDocument>('PatternForgeCycle', patternForgeCycleSchema);
