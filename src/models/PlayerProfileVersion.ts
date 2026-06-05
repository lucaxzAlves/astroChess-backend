import { Model, Schema, Types, model, models } from 'mongoose';

import {
  playerProfileVersionSources,
  type PlayerProfileVersionDocument,
} from '../modules/player-profile-version/player-profile-version.types';

const skillMapChangeSchema = new Schema(
  {
    key: { type: String, required: true, trim: true },
    previousValue: { type: Number },
    newValue: { type: Number },
  },
  { _id: false },
);

const changesSummarySchema = new Schema(
  {
    skillMapChanges: {
      type: [skillMapChangeSchema],
      default: [],
    },
    playingStyleChanged: { type: Boolean, default: false },
    previousPrimaryStyle: { type: String, trim: true },
    newPrimaryStyle: { type: String, trim: true },
    newRecurringMistakes: { type: [String], default: [] },
    removedRecurringMistakes: { type: [String], default: [] },
    updatedRecurringMistakes: { type: [String], default: [] },
    newStrengths: { type: [String], default: [] },
    updatedStrengths: { type: [String], default: [] },
    currentFocusChanged: { type: Boolean, default: false },
    previousCurrentFocus: { type: String, trim: true },
    newCurrentFocus: { type: String, trim: true },
    criticalPhaseChanged: { type: Boolean, default: false },
    previousCriticalPhase: { type: String, trim: true },
    newCriticalPhase: { type: String, trim: true },
  },
  { _id: false },
);

const playerProfileVersionSchema = new Schema<PlayerProfileVersionDocument>(
  {
    userId: {
      type: Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    profileId: {
      type: Types.ObjectId,
      ref: 'PlayerProfile',
      required: true,
      index: true,
    },
    batchId: {
      type: Types.ObjectId,
      ref: 'AnalysisBatch',
      index: true,
    },
    source: {
      type: String,
      enum: playerProfileVersionSources,
      required: true,
    },
    versionNumber: {
      type: Number,
      required: true,
    },
    label: { type: String, trim: true },
    description: { type: String, trim: true },
    snapshot: {
      type: Schema.Types.Mixed,
      required: true,
    },
    changesSummary: {
      type: changesSummarySchema,
      default: undefined,
    },
    relatedProfileDelta: {
      type: Schema.Types.Mixed,
      default: undefined,
    },
    restoredFromVersionId: {
      type: Types.ObjectId,
      ref: 'PlayerProfileVersion',
    },
    restoredAt: { type: Date },
    isRestorePoint: {
      type: Boolean,
      default: true,
    },
  },
  {
    timestamps: true,
  },
);

playerProfileVersionSchema.index({ userId: 1, versionNumber: 1 }, { unique: true });
playerProfileVersionSchema.index({ userId: 1, createdAt: -1 });
playerProfileVersionSchema.index({ batchId: 1 });
playerProfileVersionSchema.index({ profileId: 1 });

export const PlayerProfileVersion: Model<PlayerProfileVersionDocument> =
  models.PlayerProfileVersion ??
  model<PlayerProfileVersionDocument>('PlayerProfileVersion', playerProfileVersionSchema);
