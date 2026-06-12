import { Model, Schema, Types, model, models } from 'mongoose';

import {
  coachStyles,
  coachTones,
  explanationDepthLevels,
  skillMapCategoryKeys,
  gamePhases,
  profilePrimaryStyles,
  profileRiskProfiles,
  preferredLanguages,
  ratingTimeControls,
  recommendationPriorities,
  recommendationTypes,
  recurringMistakeCategories,
  recurringMistakeStatuses,
  severityLevels,
  targetRatingSources,
  trainingTypes,
  estimatedStrengthLevels,
  type PlayerProfileDocument,
} from '../modules/player-profile/player-profile.types';

const OpeningProfileSchema = new Schema(
  {
    eco: { type: String, trim: true },
    name: { type: String, trim: true },
    moves: { type: String, trim: true },
    games: { type: Number, default: 0 },
    wins: { type: Number, default: 0 },
    draws: { type: Number, default: 0 },
    losses: { type: Number, default: 0 },
    scorePercent: { type: Number, default: 0 },
    performance: { type: Number, default: 0 },
    commonMistakes: { type: [String], default: [] },
    recurringIssues: { type: [String], default: [] },
    recommendedStudy: { type: [String], default: [] },
    lastSeenAt: { type: Date },
  },
  { _id: false },
);

const PhaseStatsSchema = new Schema(
  {
    games: { type: Number, default: 0 },
    inaccuracies: { type: Number, default: 0 },
    mistakes: { type: Number, default: 0 },
    blunders: { type: Number, default: 0 },
    description: { type: String, trim: true },
  },
  { _id: false },
);

const ColorStatsSchema = new Schema(
  {
    games: { type: Number, default: 0 },
    wins: { type: Number, default: 0 },
    draws: { type: Number, default: 0 },
    losses: { type: Number, default: 0 },
    commonIssues: { type: [String], default: [] },
  },
  { _id: false },
);

const RecurringMistakeExampleSchema = new Schema(
  {
    gameAnalysisId: { type: Types.ObjectId, ref: 'GameAnalysis' },
    moveNumber: { type: Number },
    fen: { type: String, trim: true },
    playedMove: { type: String, trim: true },
    bestMove: { type: String, trim: true },
    explanation: { type: String, trim: true },
  },
  { _id: false },
);

const StrengthExampleSchema = new Schema(
  {
    gameAnalysisId: { type: Types.ObjectId, ref: 'GameAnalysis' },
    moveNumber: { type: Number },
    explanation: { type: String, trim: true },
  },
  { _id: false },
);

const ImprovementAreaDeltaSchema = new Schema(
  {
    area: { type: String, trim: true },
    previousScore: { type: Number },
    currentScore: { type: Number },
    evidence: { type: String, trim: true },
  },
  { _id: false },
);

const SkillScoreSchema = new Schema(
  {
    value: { type: Number, default: 0, min: 0, max: 100 },
    label: { type: String, trim: true },
    description: { type: String, trim: true },
    confidence: { type: Number, default: 0, min: 0, max: 100 },
    evidenceCount: { type: Number, default: 0, min: 0 },
    lastUpdatedAt: { type: Date },
  },
  { _id: false },
);

const playerProfileSchema = new Schema<PlayerProfileDocument>(
  {
    userId: {
      type: Types.ObjectId,
      ref: 'User',
      required: true,
      unique: true,
      index: true,
    },
    identities: {
      chessCom: {
        username: { type: String, trim: true },
        avatarUrl: { type: String, trim: true },
        lastSyncedAt: { type: Date },
      },
      lichess: {
        username: { type: String, trim: true },
        lastSyncedAt: { type: Date },
      },
      fide: {
        fideId: { type: String, trim: true },
        name: { type: String, trim: true },
        lastSyncedAt: { type: Date },
      },
    },
    ratings: {
      fide: {
        classical: { type: Number },
        rapid: { type: Number },
        blitz: { type: Number },
        lastUpdatedAt: { type: Date },
      },
      chessCom: {
        rapid: { type: Number },
        blitz: { type: Number },
        bullet: { type: Number },
        daily: { type: Number },
        lastUpdatedAt: { type: Date },
      },
      lichess: {
        rapid: { type: Number },
        blitz: { type: Number },
        bullet: { type: Number },
        classical: { type: Number },
        lastUpdatedAt: { type: Date },
      },
      estimatedStrength: {
        level: {
          type: String,
          enum: estimatedStrengthLevels,
          default: 'unknown',
        },
        confidence: { type: Number, default: 0 },
        description: { type: String, trim: true },
      },
    },
    playingStyle: {
      primaryStyle: {
        type: String,
        enum: profilePrimaryStyles,
        default: 'unknown',
      },
      secondaryStyles: { type: [String], default: [] },
      styleScores: {
        aggression: { type: Number, default: 0 },
        tacticalSharpness: { type: Number, default: 0 },
        positionalUnderstanding: { type: Number, default: 0 },
        riskTolerance: { type: Number, default: 0 },
        defensiveSkill: { type: Number, default: 0 },
        endgameSkill: { type: Number, default: 0 },
        openingPreparation: { type: Number, default: 0 },
        conversionSkill: { type: Number, default: 0 },
        calculationSkill: { type: Number, default: 0 },
      },
      description: { type: String, trim: true },
      lastInferredAt: { type: Date },
    },
    openingRepertoire: {
      asWhite: {
        type: [OpeningProfileSchema],
        default: [],
      },
      asBlack: {
        againstE4: {
          type: [OpeningProfileSchema],
          default: [],
        },
        againstD4: {
          type: [OpeningProfileSchema],
          default: [],
        },
        againstOther: {
          type: [OpeningProfileSchema],
          default: [],
        },
      },
    },
    chessStats: {
      totalGamesAnalyzed: { type: Number, default: 0 },
      results: {
        wins: { type: Number, default: 0 },
        draws: { type: Number, default: 0 },
        losses: { type: Number, default: 0 },
      },
      byPhase: {
        opening: { type: PhaseStatsSchema, default: () => ({}) },
        middlegame: { type: PhaseStatsSchema, default: () => ({}) },
        endgame: { type: PhaseStatsSchema, default: () => ({}) },
      },
      byColor: {
        white: { type: ColorStatsSchema, default: () => ({}) },
        black: { type: ColorStatsSchema, default: () => ({}) },
      },
      averageAccuracy: { type: Number, default: 0 },
      mistakeDistribution: {
        inaccuracies: { type: Number, default: 0 },
        mistakes: { type: Number, default: 0 },
        blunders: { type: Number, default: 0 },
      },
      conversion: {
        winningPositionsLost: { type: Number, default: 0 },
        winningPositionsDrawn: { type: Number, default: 0 },
        advantagesConverted: { type: Number, default: 0 },
      },
      resilience: {
        worsePositionsSaved: { type: Number, default: 0 },
        lostPositionsRecovered: { type: Number, default: 0 },
      },
    },
    skillMap: {
      overallScore: {
        type: SkillScoreSchema,
        default: () => ({
          value: 0,
          confidence: 0,
          evidenceCount: 0,
        }),
      },
      categories: {
        calculation: {
          type: SkillScoreSchema,
          default: () => ({
            value: 0,
            label: 'Calculation',
            confidence: 0,
            evidenceCount: 0,
          }),
        },
        positionalUnderstanding: {
          type: SkillScoreSchema,
          default: () => ({
            value: 0,
            label: 'Positional Understanding',
            confidence: 0,
            evidenceCount: 0,
          }),
        },
        openings: {
          type: SkillScoreSchema,
          default: () => ({
            value: 0,
            label: 'Openings',
            confidence: 0,
            evidenceCount: 0,
          }),
        },
        tacticalThemes: {
          type: SkillScoreSchema,
          default: () => ({
            value: 0,
            label: 'Tactical Themes',
            confidence: 0,
            evidenceCount: 0,
          }),
        },
        endgames: {
          type: SkillScoreSchema,
          default: () => ({
            value: 0,
            label: 'Endgames',
            confidence: 0,
            evidenceCount: 0,
          }),
        },
        middlegame: {
          type: SkillScoreSchema,
          default: () => ({
            value: 0,
            label: 'Middlegame',
            confidence: 0,
            evidenceCount: 0,
          }),
        },
        timeManagement: {
          type: SkillScoreSchema,
          default: () => ({
            value: 0,
            label: 'Time Management',
            confidence: 0,
            evidenceCount: 0,
          }),
        },
        psychologicalResilience: {
          type: SkillScoreSchema,
          default: () => ({
            value: 0,
            label: 'Psychological Resilience',
            confidence: 0,
            evidenceCount: 0,
          }),
        },
      },
    },
    recurringMistakes: {
      type: [
        new Schema(
          {
            key: { type: String, trim: true },
            category: {
              type: String,
              enum: recurringMistakeCategories,
              default: 'unknown',
            },
            name: { type: String, trim: true },
            description: { type: String, trim: true },
            frequency: { type: Number, default: 0 },
            severity: {
              type: String,
              enum: severityLevels,
              default: 'medium',
            },
            phases: {
              type: [String],
              enum: gamePhases,
              default: [],
            },
            examples: {
              type: [RecurringMistakeExampleSchema],
              default: [],
            },
            firstDetectedAt: { type: Date },
            lastDetectedAt: { type: Date },
            status: {
              type: String,
              enum: recurringMistakeStatuses,
              default: 'active',
            },
            confidence: { type: Number, default: 0 },
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
            key: { type: String, trim: true },
            name: { type: String, trim: true },
            description: { type: String, trim: true },
            evidenceCount: { type: Number, default: 0 },
            examples: {
              type: [StrengthExampleSchema],
              default: [],
            },
            firstDetectedAt: { type: Date },
            lastDetectedAt: { type: Date },
            confidence: { type: Number, default: 0 },
          },
          { _id: false },
        ),
      ],
      default: [],
    },
    improvementHistory: {
      type: [
        new Schema(
          {
            date: { type: Date },
            periodLabel: { type: String, trim: true },
            summary: { type: String, trim: true },
            improvedAreas: {
              type: [ImprovementAreaDeltaSchema],
              default: [],
            },
            worsenedAreas: {
              type: [ImprovementAreaDeltaSchema],
              default: [],
            },
            resolvedMistakes: { type: [String], default: [] },
            newProblems: { type: [String], default: [] },
            analyzedGamesCount: { type: Number, default: 0 },
          },
          { _id: false },
        ),
      ],
      default: [],
    },
    coachPreferences: {
      selectedCoachStyle: {
        type: String,
        enum: coachStyles,
      },
      tone: {
        type: String,
        enum: coachTones,
      },
      explanationDepth: {
        type: String,
        enum: explanationDepthLevels,
      },
      preferredLanguage: {
        type: String,
        enum: preferredLanguages,
      },
    },
    goals: {
      targetRating: {
        source: {
          type: String,
          enum: targetRatingSources,
        },
        timeControl: {
          type: String,
          enum: ratingTimeControls,
        },
        value: { type: Number },
        deadline: { type: Date },
      },
      mainGoal: { type: String, trim: true },
      focusAreas: { type: [String], default: [] },
      tournamentPreparation: {
        enabled: { type: Boolean, default: false },
        tournamentName: { type: String, trim: true },
        date: { type: Date },
      },
    },
    trainingPreferences: {
      dailyTrainingMinutes: { type: Number, default: 0 },
      preferredDays: { type: [String], default: [] },
      puzzleFrequency: {
        type: String,
        enum: ['daily', 'every_two_days', 'weekly'],
      },
      preferredTrainingTypes: {
        type: [String],
        enum: trainingTypes,
        default: [],
      },
      whatsappReminders: {
        enabled: { type: Boolean, default: false },
        phone: { type: String, trim: true },
        reminderTime: { type: String, trim: true },
      },
    },
    recommendations: {
      currentFocus: { type: String, trim: true },
      studyPlan: {
        type: [
          new Schema(
            {
              title: { type: String, trim: true },
              reason: { type: String, trim: true },
              type: {
                type: String,
                enum: recommendationTypes,
              },
              url: { type: String, trim: true },
              priority: {
                type: String,
                enum: recommendationPriorities,
              },
            },
            { _id: false },
          ),
        ],
        default: [],
      },
      trainingRoutine: {
        title: { type: String, trim: true },
        description: { type: String, trim: true },
        durationDays: { type: Number },
        dailyTasks: {
          type: [
            new Schema(
              {
                task: { type: String, trim: true },
                minutes: { type: Number },
                theme: { type: String, trim: true },
              },
              { _id: false },
            ),
          ],
          default: [],
        },
      },
      lastGeneratedAt: { type: Date },
    },
    profileConfidence: {
      overall: { type: Number, default: 0 },
      basedOnGames: { type: Number, default: 0 },
      confidenceByArea: {
        openings: { type: Number, default: 0 },
        tactics: { type: Number, default: 0 },
        endgames: { type: Number, default: 0 },
        style: { type: Number, default: 0 },
        recurringMistakes: { type: Number, default: 0 },
      },
      warning: { type: String, trim: true },
    },
    decisionPatterns: {
      riskProfile: {
        type: String,
        enum: profileRiskProfiles,
        default: 'unknown',
      },
      commonBehaviors: { type: [String], default: [] },
      description: { type: String, trim: true },
    },
    criticalPhaseWeakness: {
      phase: {
        type: String,
        enum: gamePhases,
        default: 'unknown',
      },
      description: { type: String, trim: true },
    },
    lastProfileUpdateAt: { type: Date },
  },
  {
    timestamps: true,
  },
);

playerProfileSchema.index({ userId: 1 }, { unique: true });
playerProfileSchema.index({ 'playingStyle.primaryStyle': 1 });
playerProfileSchema.index({ 'recurringMistakes.category': 1 });
playerProfileSchema.index({ 'recurringMistakes.status': 1 });
playerProfileSchema.index({ updatedAt: -1 });

void skillMapCategoryKeys;

export const PlayerProfile: Model<PlayerProfileDocument> =
  models.PlayerProfile ?? model<PlayerProfileDocument>('PlayerProfile', playerProfileSchema);
