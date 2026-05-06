import { Model, Schema, Types, model, models } from 'mongoose';

import {
  analysisStatuses,
  criticalMomentColors,
  decisiveMomentCategories,
  gameAnalysisSources,
  gamePhases,
  recurringMistakeCategories,
  severityLevels,
  storedMoveClassifications,
  styleTraits,
  type GameAnalysisDocument,
} from '../modules/player-profile/player-profile.types';

const criticalMomentSchema = new Schema(
  {
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
      default: 'Unknown',
    },
    evalBefore: { type: Schema.Types.Mixed },
    evalAfter: { type: Schema.Types.Mixed },
    evalLoss: { type: Number },
    fenBefore: { type: String, trim: true },
    fenAfter: { type: String, trim: true },
    pv: { type: [String], default: [] },
    comment: { type: String, trim: true },
    reasonTags: { type: [String], default: [] },
  },
  { _id: false },
);

const structuredSummarySchema = new Schema(
  {
    gameNarrative: { type: String, trim: true },
    decisiveMoment: {
      moveNumber: { type: Number },
      playedMove: { type: String, trim: true },
      side: {
        type: String,
        enum: criticalMomentColors,
        default: 'unknown',
      },
      category: {
        type: String,
        enum: decisiveMomentCategories,
        default: 'unknown',
      },
      severity: {
        type: String,
        enum: severityLevels,
        default: 'medium',
      },
      humanReason: { type: String, trim: true },
      betterPlan: { type: String, trim: true },
    },
    missedOpportunities: {
      type: [
        new Schema(
          {
            moveNumber: { type: Number },
            sideThatErred: {
              type: String,
              enum: criticalMomentColors,
              default: 'unknown',
            },
            whatHappened: { type: String, trim: true },
            howToPunish: { type: String, trim: true },
            theme: { type: String, trim: true },
          },
          { _id: false },
        ),
      ],
      default: [],
    },
    mistakePatterns: {
      type: [
        new Schema(
          {
            category: {
              type: String,
              enum: recurringMistakeCategories,
              default: 'unknown',
            },
            name: { type: String, trim: true },
            severity: {
              type: String,
              enum: severityLevels,
              default: 'medium',
            },
            phase: {
              type: String,
              enum: gamePhases,
              default: 'unknown',
            },
            evidence: { type: String, trim: true },
            relatedMoves: { type: [Number], default: [] },
          },
          { _id: false },
        ),
      ],
      default: [],
    },
    styleSignals: {
      type: [
        new Schema(
          {
            trait: {
              type: String,
              enum: styleTraits,
              default: 'unknown',
            },
            confidence: { type: Number },
            evidence: { type: String, trim: true },
          },
          { _id: false },
        ),
      ],
      default: [],
    },
    openingInsights: {
      type: [
        new Schema(
          {
            openingName: { type: String, trim: true },
            eco: { type: String, trim: true },
            color: {
              type: String,
              enum: criticalMomentColors,
              default: 'unknown',
            },
            issue: { type: String, trim: true },
            recommendation: { type: String, trim: true },
          },
          { _id: false },
        ),
      ],
      default: [],
    },
    endgameInsights: {
      type: [
        new Schema(
          {
            type: { type: String, trim: true },
            issue: { type: String, trim: true },
            recommendation: { type: String, trim: true },
          },
          { _id: false },
        ),
      ],
      default: [],
    },
    strengths: {
      type: [
        new Schema(
          {
            name: { type: String, trim: true },
            evidence: { type: String, trim: true },
          },
          { _id: false },
        ),
      ],
      default: [],
    },
    recommendedFocus: { type: [String], default: [] },
    profileTags: { type: [String], default: [] },
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
    structuredSummary: {
      type: structuredSummarySchema,
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
gameAnalysisSchema.index({ createdAt: -1 });
gameAnalysisSchema.index({ 'metadata.opening': 1 });
gameAnalysisSchema.index({ 'metadata.eco': 1 });
gameAnalysisSchema.index({ source: 1 });

export const GameAnalysis: Model<GameAnalysisDocument> =
  models.GameAnalysis ?? model<GameAnalysisDocument>('GameAnalysis', gameAnalysisSchema);
