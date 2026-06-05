import { Model, Schema, Types, model, models } from 'mongoose';

import {
  analysisBatchErrorStages,
  analysisBatchProfileStatuses,
  analysisBatchSources,
  analysisBatchStatuses,
  analysisBatchTargetPlatforms,
  type AnalysisBatchDocument,
} from './analysis-batch.types';

const analysisBatchErrorSchema = new Schema(
  {
    gameId: { type: String, trim: true },
    message: { type: String, required: true, trim: true },
    stage: {
      type: String,
      enum: analysisBatchErrorStages,
      default: 'unknown',
    },
    createdAt: { type: Date, default: Date.now },
  },
  { _id: false },
);

const analysisBatchSchemaDefinition: Record<string, unknown> = {
    userId: {
      type: Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    status: {
      type: String,
      enum: analysisBatchStatuses,
      default: 'pending',
      index: true,
    },
    totalGames: {
      type: Number,
      required: true,
    },
    processedGames: {
      type: Number,
      default: 0,
    },
    successfulGames: {
      type: Number,
      default: 0,
    },
    failedGames: {
      type: Number,
      default: 0,
    },
    analysisOptions: {
      includeAiReview: { type: Boolean, default: false },
      updateProfileAfterBatch: { type: Boolean, default: false },
      targetPlayer: {
        username: { type: String, trim: true },
        platform: {
          type: String,
          enum: analysisBatchTargetPlatforms,
          default: 'unknown',
        },
      },
      timeControl: { type: String, trim: true },
      source: {
        type: String,
        enum: analysisBatchSources,
        default: 'unknown',
      },
    },
    gameAnalysisIds: {
      type: [{ type: Types.ObjectId, ref: 'GameAnalysis' }],
      default: [],
    },
    errors: {
      type: [analysisBatchErrorSchema],
      default: [],
    },
    profileUpdate: {
      status: {
        type: String,
        enum: analysisBatchProfileStatuses,
        default: 'not_started',
      },
      inputPreview: { type: Schema.Types.Mixed },
      profileEvidence: { type: Schema.Types.Mixed },
      profileEvidencePayloadPreview: { type: Schema.Types.Mixed },
      profileDelta: { type: Schema.Types.Mixed },
      rawResponse: { type: Schema.Types.Mixed },
      error: { type: String, trim: true },
      playerProfileUpdated: { type: Boolean, default: false },
      profileVersionBeforeId: {
        type: Types.ObjectId,
        ref: 'PlayerProfileVersion',
      },
      profileVersionAfterId: {
        type: Types.ObjectId,
        ref: 'PlayerProfileVersion',
      },
      revertedAt: { type: Date },
      revertedToVersionId: {
        type: Types.ObjectId,
        ref: 'PlayerProfileVersion',
      },
      profileImpactReverted: { type: Boolean, default: false },
      processedAt: { type: Date },
    },
    startedAt: { type: Date },
    finishedAt: { type: Date },
  };

const analysisBatchSchema = new Schema<AnalysisBatchDocument>(
  analysisBatchSchemaDefinition,
  {
    timestamps: true,
  },
);

analysisBatchSchema.index({ userId: 1 });
analysisBatchSchema.index({ status: 1 });
analysisBatchSchema.index({ createdAt: -1 });

export const AnalysisBatch: Model<AnalysisBatchDocument> =
  models.AnalysisBatch ?? model<AnalysisBatchDocument>('AnalysisBatch', analysisBatchSchema);
