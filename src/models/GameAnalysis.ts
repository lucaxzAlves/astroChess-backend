import { Model, Schema, Types, model, models } from 'mongoose';

import {
  analysisStatuses,
  criticalMomentColors,
  gameAnalysisSources,
  storedMoveClassifications,
  type GameAnalysisDocument,
} from '../modules/player-profile/player-profile.types';

const criticalMomentSchema = new Schema(
  {
    ply: { type: Number },
    moveNumber: { type: Number },
    color: {
      type: String,
      enum: criticalMomentColors,
      default: 'unknown',
    },
    playedMove: { type: String, trim: true },
    bestMove: { type: String, trim: true },
    classification: {
      type: String,
      enum: storedMoveClassifications,
      default: 'unknown',
    },
    evalBefore: { type: Schema.Types.Mixed },
    evalAfter: { type: Schema.Types.Mixed },
    evalLoss: { type: Number },
    expectedBefore: { type: Number },
    expectedAfter: { type: Number },
    expectedLoss: { type: Number },
    expectedPointsLoss: { type: Number },
    centipawnLoss: { type: Number },
    bestExpectedAfter: { type: Number },
    playedExpectedAfter: { type: Number },
    missLoss: { type: Number },
    isBook: { type: Boolean, default: false },
    isOnlyMove: { type: Boolean, default: false },
    isSacrifice: { type: Boolean, default: false },
    isCritical: { type: Boolean, default: false },
    fenBefore: { type: String, trim: true },
    fenAfter: { type: String, trim: true },
    pv: { type: [String], default: [] },
    comment: { type: String, trim: true },
    reasonTags: { type: [String], default: [] },
  },
  { _id: false },
);

const gameAnalysisSchema = new Schema<GameAnalysisDocument>(
  {
    userId: {
      type: Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    batchId: {
      type: Types.ObjectId,
      ref: 'AnalysisBatch',
      index: true,
    },
    gameId: {
      type: String,
      trim: true,
    },
    source: {
      type: String,
      enum: gameAnalysisSources,
      default: 'unknown',
      index: true,
    },
    targetPlayer: {
      username: { type: String, trim: true },
      color: {
        type: String,
        enum: criticalMomentColors,
        default: 'unknown',
      },
      platform: {
        type: String,
        enum: ['chess.com', 'lichess', 'manual', 'unknown'],
        default: 'unknown',
      },
    },
    metadata: {
      white: { type: String, trim: true },
      black: { type: String, trim: true },
      result: { type: String, trim: true },
      site: { type: String, trim: true },
      date: { type: String, trim: true },
      event: { type: String, trim: true },
      opening: { type: String, trim: true },
      eco: { type: String, trim: true },
      timeControl: { type: String, trim: true },
    },
    originalPgn: {
      type: String,
      required: true,
      trim: true,
    },
    annotatedPgn: {
      type: String,
      required: true,
      trim: true,
    },
    accuracy: {
      white: { type: Number },
      black: { type: Number },
    },
    moveClassificationSummary: {
      white: {
        brilliant: { type: Number, default: 0 },
        great: { type: Number, default: 0 },
        best: { type: Number, default: 0 },
        excellent: { type: Number, default: 0 },
        good: { type: Number, default: 0 },
        book: { type: Number, default: 0 },
        inaccuracy: { type: Number, default: 0 },
        mistake: { type: Number, default: 0 },
        miss: { type: Number, default: 0 },
        blunder: { type: Number, default: 0 },
      },
      black: {
        brilliant: { type: Number, default: 0 },
        great: { type: Number, default: 0 },
        best: { type: Number, default: 0 },
        excellent: { type: Number, default: 0 },
        good: { type: Number, default: 0 },
        book: { type: Number, default: 0 },
        inaccuracy: { type: Number, default: 0 },
        mistake: { type: Number, default: 0 },
        miss: { type: Number, default: 0 },
        blunder: { type: Number, default: 0 },
      },
    },
    classificationDebugSummary: {
      type: Schema.Types.Mixed,
      default: undefined,
    },
    moveClassifications: {
      type: [
        new Schema(
          {
            ply: { type: Number, required: true },
            moveNumber: { type: Number, required: true },
            color: {
              type: String,
              enum: ['white', 'black'],
              required: true,
            },
            san: { type: String, required: true, trim: true },
            classification: {
              type: String,
              enum: storedMoveClassifications,
              default: 'unknown',
            },
            critical: { type: Boolean, default: false },
            moveAccuracy: { type: Number },
            evalLoss: { type: Number },
            evalBefore: { type: Schema.Types.Mixed },
            evalAfter: { type: Schema.Types.Mixed },
            expectedBefore: { type: Number },
            expectedAfter: { type: Number },
            expectedLoss: { type: Number },
            expectedPointsLoss: { type: Number },
            centipawnLoss: { type: Number },
            bestExpectedAfter: { type: Number },
            playedExpectedAfter: { type: Number },
            missLoss: { type: Number },
            isBook: { type: Boolean, default: false },
            isOnlyMove: { type: Boolean, default: false },
            isSacrifice: { type: Boolean, default: false },
            isCritical: { type: Boolean, default: false },
            reasonTags: { type: [String], default: [] },
          },
          { _id: false },
        ),
      ],
      default: [],
    },
    criticalMoments: {
      type: [criticalMomentSchema],
      default: [],
    },
    aiReview: {
      success: { type: Boolean, required: true, default: false },
      reviewText: { type: String, trim: true },
      rawResponse: { type: Schema.Types.Mixed },
      error: { type: String, trim: true },
    },
    gameEvidenceSummary: {
      type: Schema.Types.Mixed,
      default: undefined,
    },
    structuredSummary: {
      type: Schema.Types.Mixed,
      default: undefined,
    },
    analysisStatus: {
      type: String,
      enum: analysisStatuses,
      default: 'technical_completed',
    },
  },
  {
    timestamps: true,
  },
);

gameAnalysisSchema.index({ userId: 1 });
gameAnalysisSchema.index({ batchId: 1 });
gameAnalysisSchema.index({ createdAt: -1 });
gameAnalysisSchema.index({ 'metadata.opening': 1 });
gameAnalysisSchema.index({ 'metadata.eco': 1 });
gameAnalysisSchema.index({ source: 1 });

export const GameAnalysis: Model<GameAnalysisDocument> =
  models.GameAnalysis ?? model<GameAnalysisDocument>('GameAnalysis', gameAnalysisSchema);
