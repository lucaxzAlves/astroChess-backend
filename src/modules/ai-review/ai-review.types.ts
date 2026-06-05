import {
  AccuracyByColor,
  CriticalMoment,
  GamePhase,
  GameMetadata,
  MoveClassificationItem,
  MoveClassificationSummary,
  PlayerColor,
} from '../../chess/chess.types';
import type {
  RecurringMistakeCategory,
  SeverityLevel,
  StoredMoveClassificationSummaryEntry,
  StructuredGameSummary,
  StyleTrait,
} from '../player-profile/player-profile.types';

export type AiReviewTargetPlayer = {
  username?: string;
  color?: PlayerColor | 'unknown';
  platform?: 'chess.com' | 'lichess' | 'manual' | 'unknown';
};

export type AiReviewAnalysisType =
  | 'single_game'
  | 'profile_summary'
  | 'profile_game_evidence';

export type EvidenceBelongsTo = 'targetPlayer' | 'opponent' | 'both' | 'unknown';
export type SkillSignalKey =
  | 'calculation'
  | 'positionalUnderstanding'
  | 'openings'
  | 'tacticalThemes'
  | 'endgames'
  | 'middlegame'
  | 'timeManagement'
  | 'postBlunderRecovery';
export type SkillSignalDirection = 'positive' | 'negative' | 'mixed' | 'insufficient_data';
export type TrainingPrioritySignal = 'low' | 'medium' | 'high' | 'critical';
export type TargetPlayerResult = 'win' | 'draw' | 'loss' | 'unknown';

export type SkillSignalSummary = {
  signal?: SkillSignalDirection;
  confidence?: number;
  summary?: string;
  estimatedValue?: number | null;
  evidence?: string;
  belongsTo?: EvidenceBelongsTo;
};

export type ProfileGameEvidenceSummary = {
  gameId?: string;
  targetPlayer?: AiReviewTargetPlayer;
  metadata?: GameMetadata & {
    event?: string;
    opening?: string;
    eco?: string;
    timeControl?: string;
  };
  gameNarrative?: string;
  victoryConstruction?: {
    summary?: string;
    keyPreparatoryMoves?: Array<{
      moveNumber?: number | null;
      move?: string | null;
      side?: PlayerColor | 'unknown';
      idea?: string;
    }>;
    mainStrategicCause?: string;
  };
  decisiveMoment?: {
    moveNumber?: number | null;
    playedMove?: string | null;
    side?: PlayerColor | 'unknown';
    belongsTo?: EvidenceBelongsTo;
    category?: string;
    severity?: SeverityLevel;
    humanReason?: string;
    betterPlan?: string;
  };
  targetMistakes?: Array<{
    key?: string;
    category?: RecurringMistakeCategory;
    name?: string;
    description?: string;
    severity?: SeverityLevel;
    phase?: GamePhase;
    moveNumber?: number | null;
    playedMove?: string;
    explanation?: string;
    belongsTo?: EvidenceBelongsTo;
    sideThatErred?: PlayerColor | 'unknown';
    confidence?: number;
  }>;
  missedOpportunities?: Array<{
    key?: string;
    category?: RecurringMistakeCategory;
    theme?: string;
    phase?: GamePhase;
    severity?: SeverityLevel;
    moveNumber?: number | null;
    sideThatErred?: PlayerColor | 'unknown';
    whatHappened?: string;
    howToPunish?: string;
    belongsTo?: EvidenceBelongsTo;
    confidence?: number;
  }>;
  mistakePatterns?: Array<{
    key?: string;
    category?: RecurringMistakeCategory;
    name?: string;
    description?: string;
    evidence?: string;
    severity?: SeverityLevel;
    phase?: GamePhase;
    relatedMoves?: number[];
    belongsTo?: EvidenceBelongsTo;
    confidence?: number;
  }>;
  styleSignals?: Array<{
    trait?: StyleTrait | string;
    evidence?: string;
    belongsTo?: EvidenceBelongsTo;
    confidence?: number;
    summary?: string;
  }>;
  openingInsights?: Array<{
    openingName?: string | null;
    eco?: string | null;
    color?: PlayerColor | 'unknown';
    issue?: string;
    recommendation?: string;
    belongsTo?: EvidenceBelongsTo;
    confidence?: number;
    positiveSignal?: string;
  }>;
  endgameInsights?: Array<{
    type?: string;
    issue?: string;
    recommendation?: string;
    belongsTo?: EvidenceBelongsTo;
    confidence?: number;
    positiveSignal?: string;
  }>;
  strengths?: Array<{
    key?: string;
    name?: string;
    description?: string;
    evidence?: string;
    belongsTo?: EvidenceBelongsTo;
    confidence?: number;
    moveNumber?: number | null;
  }>;
  trainingTakeaways?: Array<{
    theme?: string;
    reason?: string;
    prioritySignal?: TrainingPrioritySignal;
    suggestedExerciseType?: string;
    relatedMistakeKeys?: string[];
    belongsTo?: EvidenceBelongsTo;
  }>;
  skillSignals?: Partial<Record<SkillSignalKey, SkillSignalSummary>>;
  profileTags?: string[];
  confidence?: {
    overall?: number;
    basedOnSample?: number;
    targetPlayerColorConfidence?: number;
    [key: string]: unknown;
  };
  notesForAggregation?: string[];
  targetPlayerAccuracy?: number | null;
  targetPlayerResult?: TargetPlayerResult;
  targetPlayerMoveClassificationSummary?: StoredMoveClassificationSummaryEntry;
};

export type ParsedProfileGameEvidenceAgentResponse = {
  success: boolean;
  gameEvidenceSummary?: ProfileGameEvidenceSummary;
  rawResponse: unknown;
  error?: string;
};

export type AiGameReviewInput = {
  analysisType?: AiReviewAnalysisType;
  gameId?: string;
  originalPgn: string;
  annotatedPgn: string;
  criticalMoments: CriticalMoment[];
  moveClassifications?: MoveClassificationItem[];
  moveClassificationSummary?: MoveClassificationSummary;
  accuracy?: AccuracyByColor;
  targetPlayer?: AiReviewTargetPlayer;
  metadata?: GameMetadata;
  profileSummary?: Record<string, unknown> | null;
};

export type AiGameReviewResult = {
  success: boolean;
  reviewText?: string;
  structuredSummary?: StructuredGameSummary | Record<string, unknown>;
  gameEvidenceSummary?: ProfileGameEvidenceSummary;
  rawResponse?: unknown;
  error?: string;
};

export type AiReviewWebhookPayload = {
  type: 'GAME_REVIEW_REQUEST';
  analysisType: AiReviewAnalysisType;
  targetPlayer?: AiReviewTargetPlayer;
  game: {
    id?: string;
    metadata?: GameMetadata;
    originalPgn: string;
    annotatedPgn: string;
    criticalMoments: CriticalMoment[];
    moveClassifications?: MoveClassificationItem[];
    moveClassificationSummary?: MoveClassificationSummary;
    accuracy?: AccuracyByColor;
    playerTarget?: AiReviewTargetPlayer;
  };
  profileSummary?: Record<string, unknown> | null;
  instructions: {
    language: 'pt-BR';
    style: 'human_chess_coach';
    goal: string;
  };
};
