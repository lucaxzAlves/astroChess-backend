import type { AnalysisBatchTargetPlatform } from '../analysis-batch/analysis-batch.types';
import type {
  EvidenceBelongsTo,
  ProfileGameEvidenceSummary,
  SkillSignalDirection,
  SkillSignalKey,
  TargetPlayerResult,
  TrainingPrioritySignal,
} from '../ai-review/ai-review.types';
import type {
  GamePhase,
  StoredMoveClassificationSummaryEntry,
} from '../player-profile/player-profile.types';
import type { ProfileSummary } from '../profile-summary/profile-summary.types';

export type ProfileEvidenceSample = {
  gamesAnalyzed: number;
  timeControlsDetected: string[];
  colorsPlayed: {
    white: number;
    black: number;
    unknown: number;
  };
  openingsDetected: string[];
};

export type ProfileEvidenceObjectiveStats = {
  averageAccuracy: number | null;
  results: Record<TargetPlayerResult, number>;
  moveClassificationTotals: Required<StoredMoveClassificationSummaryEntry>;
  phaseMistakeDistribution: Record<
    GamePhase,
    {
      inaccuracies: number;
      mistakes: number;
      blunders: number;
      misses: number;
    }
  >;
};

export type AggregatedSkillSignal = {
  signal: SkillSignalDirection;
  evidenceCount: number;
  confidence: number;
  summary: string;
  estimatedValue?: number | null;
};

export type AggregatedObservedMistakePattern = {
  key: string;
  category?: string;
  name: string;
  description?: string;
  frequency: number;
  severity?: string;
  phases: GamePhase[];
  confidence: number;
  examples: Array<{
    gameId?: string;
    moveNumber?: number | null;
    playedMove?: string;
    explanation?: string;
  }>;
};

export type AggregatedObservedStrength = {
  key: string;
  name: string;
  description?: string;
  evidenceCount: number;
  confidence: number;
  examples: Array<{
    gameId?: string;
    moveNumber?: number | null;
    explanation?: string;
  }>;
};

export type AggregatedStyleSignal = {
  trait: string;
  evidenceCount: number;
  confidence: number;
  summary: string;
  examples: Array<{
    gameId?: string;
    evidence?: string;
  }>;
};

export type AggregatedOpeningEvidence = {
  eco?: string | null;
  name?: string | null;
  color?: string;
  games: number;
  resultSummary: Record<TargetPlayerResult, number>;
  issues: string[];
  positiveSignals: string[];
  confidence: number;
};

export type AggregatedEndgameEvidence = {
  type: string;
  issues: string[];
  positiveSignals: string[];
  gamesInvolved: number;
  confidence: number;
};

export type AggregatedTrainingTheme = {
  theme: string;
  reason: string;
  prioritySignal: TrainingPrioritySignal;
  suggestedExerciseType?: string;
  relatedMistakeKeys: string[];
};

export type ProfileEvidencePayload = {
  sample: ProfileEvidenceSample;
  objectiveStats: ProfileEvidenceObjectiveStats;
  observedSkillSignals: Partial<Record<SkillSignalKey, AggregatedSkillSignal>>;
  observedStyleSignals: AggregatedStyleSignal[];
  observedMistakePatterns: AggregatedObservedMistakePattern[];
  observedStrengths: AggregatedObservedStrength[];
  openingEvidence: AggregatedOpeningEvidence[];
  endgameEvidence: AggregatedEndgameEvidence[];
  phaseEvidence: {
    criticalPhaseWeaknessCandidate: {
      phase: GamePhase;
      reason: string;
      confidence: number;
    } | null;
  };
  trainingThemes: AggregatedTrainingTheme[];
  confidence: {
    overall: number;
    basedOnGames: number;
    warning: string | null;
  };
  notesForProfileUpdater: string[];
};

export type ProfileUpdateAgentInput = {
  analysisType: 'profile_update';
  currentProfile: Record<string, unknown> | null;
  quizAnswers: {
    selfDeclaredStyle: string | null;
    mainGoal: string | null;
    targetRating: number | null;
    preferredTimeControl: string | null;
    availableTrainingMinutesPerDay: number | null;
    preferredCoachStyle: string | null;
    declaredWeaknesses: string[];
    declaredStrengths: string[];
  };
  profileEvidence: ProfileEvidencePayload;
};

export type ProfileUpdateAgentResult = {
  success: boolean;
  rawResponse?: unknown;
  profileDelta?: Record<string, unknown>;
  error?: string;
};

export type GameEvidenceExtractionResult = {
  summary?: ProfileGameEvidenceSummary;
  source: 'gameEvidenceSummary' | 'structuredSummary.gameEvidenceSummary' | 'structuredSummary';
};

export type ProfileSummaryAgentInput = {
  analysisType: 'profile_game_evidence';
  targetPlayer?: {
    username?: string;
    color?: string;
    platform?: AnalysisBatchTargetPlatform;
  };
  profileSummary?: ProfileSummary | null;
};

export type AllowedBelongsTo = EvidenceBelongsTo;
