import type { Document, Types } from 'mongoose';

export const gameAnalysisSources = ['lichess', 'chess_com', 'upload', 'manual', 'unknown'] as const;
export const criticalMomentColors = ['white', 'black', 'unknown'] as const;
export const storedMoveClassifications = [
  'brilliant',
  'great',
  'best',
  'excellent',
  'good',
  'book',
  'inaccuracy',
  'mistake',
  'miss',
  'blunder',
  'unknown',
] as const;
export const decisiveMomentCategories = [
  'hanging_piece',
  'tactical',
  'positional',
  'plan_error',
  'calculation',
  'initiative',
  'opening',
  'endgame',
  'time_management',
  'unknown',
] as const;
export const recurringMistakeCategories = [
  'tactical',
  'positional',
  'opening',
  'endgame',
  'calculation',
  'time_management',
  'conversion',
  'king_safety',
  'plan_selection',
  'initiative',
  'unknown',
] as const;
export const severityLevels = ['low', 'medium', 'high', 'critical'] as const;
export const gamePhases = ['opening', 'middlegame', 'endgame', 'unknown'] as const;
export const styleTraits = [
  'aggressive',
  'tactical',
  'positional',
  'solid',
  'defensive',
  'dynamic',
  'risk_taking',
  'endgame_oriented',
  'unknown',
] as const;
export const profilePrimaryStyles = [
  'aggressive',
  'positional',
  'tactical',
  'solid',
  'dynamic',
  'defensive',
  'endgame_oriented',
  'unknown',
] as const;
export const estimatedStrengthLevels = [
  'beginner',
  'intermediate',
  'advanced',
  'expert',
  'master_candidate',
  'unknown',
] as const;
export const recurringMistakeStatuses = ['active', 'improving', 'resolved', 'regressed'] as const;
export const profileRiskProfiles = ['too_safe', 'balanced', 'too_risky', 'unknown'] as const;
export const coachStyles = [
  'tactical_master',
  'positional_strategist',
  'endgame_specialist',
  'aggressive_trainer',
  'calm_mentor',
  'strict_coach',
] as const;
export const coachTones = ['direct', 'encouraging', 'strict', 'detailed', 'short'] as const;
export const explanationDepthLevels = ['simple', 'intermediate', 'advanced'] as const;
export const preferredLanguages = ['pt-BR', 'en'] as const;
export const targetRatingSources = ['fide', 'chessCom', 'lichess'] as const;
export const ratingTimeControls = ['classical', 'rapid', 'blitz', 'bullet'] as const;
export const trainingTypes = [
  'puzzles',
  'annotated_games',
  'endgames',
  'openings',
  'calculation',
  'strategy',
] as const;
export const recommendationTypes = [
  'book',
  'course',
  'video',
  'puzzle_set',
  'routine',
  'annotated_games',
] as const;
export const recommendationPriorities = ['low', 'medium', 'high'] as const;
export const analysisStatuses = [
  'technical_completed',
  'ai_review_completed',
  'profile_processed',
  'failed',
] as const;
export const skillMapCategoryKeys = [
  'calculation',
  'positionalUnderstanding',
  'openings',
  'tacticalThemes',
  'endgames',
  'middlegame',
  'timeManagement',
  'psychologicalResilience',
] as const;

export type GameAnalysisSource = (typeof gameAnalysisSources)[number];
export type CriticalMomentColor = (typeof criticalMomentColors)[number];
export type StoredMoveClassification = (typeof storedMoveClassifications)[number];
export type DecisiveMomentCategory = (typeof decisiveMomentCategories)[number];
export type RecurringMistakeCategory = (typeof recurringMistakeCategories)[number];
export type SeverityLevel = (typeof severityLevels)[number];
export type GamePhase = (typeof gamePhases)[number];
export type StyleTrait = (typeof styleTraits)[number];
export type ProfilePrimaryStyle = (typeof profilePrimaryStyles)[number];
export type EstimatedStrengthLevel = (typeof estimatedStrengthLevels)[number];
export type RecurringMistakeStatus = (typeof recurringMistakeStatuses)[number];
export type ProfileRiskProfile = (typeof profileRiskProfiles)[number];
export type CoachStyle = (typeof coachStyles)[number];
export type CoachTone = (typeof coachTones)[number];
export type ExplanationDepthLevel = (typeof explanationDepthLevels)[number];
export type PreferredLanguage = (typeof preferredLanguages)[number];
export type TargetRatingSource = (typeof targetRatingSources)[number];
export type RatingTimeControl = (typeof ratingTimeControls)[number];
export type PreferredTrainingType = (typeof trainingTypes)[number];
export type RecommendationType = (typeof recommendationTypes)[number];
export type RecommendationPriority = (typeof recommendationPriorities)[number];
export type GameAnalysisStatus = (typeof analysisStatuses)[number];
export type SkillMapCategoryKey = (typeof skillMapCategoryKeys)[number];

export type GameAnalysisMetadata = {
  white?: string;
  black?: string;
  result?: string;
  site?: string;
  date?: string;
  event?: string;
  opening?: string;
  eco?: string;
  timeControl?: string;
};

export type CriticalMoment = {
  ply?: number;
  moveNumber?: number;
  color?: CriticalMomentColor;
  playedMove?: string;
  bestMove?: string;
  classification?: StoredMoveClassification;
  evalBefore?: number | string | null;
  evalAfter?: number | string | null;
  evalLoss?: number | null;
  fenBefore?: string;
  fenAfter?: string;
  pv?: string[];
  comment?: string;
  reasonTags?: string[];
};

export type StructuredGameSummary = {
  gameNarrative?: string;
  victoryConstruction?: {
    summary?: string;
    keyPreparatoryMoves?: Array<{
      moveNumber?: number | null;
      move?: string | null;
      side?: CriticalMomentColor;
      idea?: string;
    }>;
    mainStrategicCause?: string;
  };
  decisiveMoment?: {
    moveNumber?: number | null;
    playedMove?: string | null;
    side?: CriticalMomentColor;
    category?: DecisiveMomentCategory;
    severity?: SeverityLevel;
    humanReason?: string;
    betterPlan?: string;
  };
  missedOpportunities?: Array<{
    moveNumber?: number | null;
    sideThatErred?: CriticalMomentColor;
    whatHappened?: string;
    howToPunish?: string;
    theme?: string;
  }>;
  mistakePatterns?: Array<{
    category?: RecurringMistakeCategory;
    name?: string;
    severity?: SeverityLevel;
    phase?: GamePhase;
    evidence?: string;
    relatedMoves?: number[];
  }>;
  styleSignals?: Array<{
    trait?: StyleTrait;
    confidence?: number;
    evidence?: string;
  }>;
  openingInsights?: Array<{
    openingName?: string | null;
    eco?: string | null;
    color?: CriticalMomentColor;
    issue?: string;
    recommendation?: string;
  }>;
  endgameInsights?: Array<{
    type?: string;
    issue?: string;
    recommendation?: string;
  }>;
  strengths?: Array<{
    name?: string;
    evidence?: string;
  }>;
  recommendedFocus?: string[];
  profileTags?: string[];
};

export type StoredAiReview = {
  success: boolean;
  reviewText?: string;
  rawResponse?: unknown;
  error?: string;
};

export type StoredGameEvidenceSummary = Record<string, unknown>;

export type StoredTargetPlayer = {
  username?: string;
  color?: CriticalMomentColor;
  platform?: 'chess.com' | 'lichess' | 'manual' | 'unknown';
};

export type StoredAccuracyByColor = {
  white?: number;
  black?: number;
};

export type StoredMoveClassificationSummaryEntry = {
  brilliant?: number;
  great?: number;
  best?: number;
  excellent?: number;
  good?: number;
  book?: number;
  inaccuracy?: number;
  mistake?: number;
  miss?: number;
  blunder?: number;
};

export type StoredMoveClassificationSummary = {
  white?: StoredMoveClassificationSummaryEntry;
  black?: StoredMoveClassificationSummaryEntry;
};

export type StoredMoveClassificationItem = {
  ply: number;
  moveNumber: number;
  color: 'white' | 'black';
  san: string;
  classification: StoredMoveClassification;
  critical: boolean;
  moveAccuracy?: number;
  evalLoss?: number | null;
  evalBefore?: number | string;
  evalAfter?: number | string;
  expectedBefore?: number;
  expectedAfter?: number;
  expectedLoss?: number;
  expectedPointsLoss?: number;
  centipawnLoss?: number | null;
  bestExpectedAfter?: number;
  playedExpectedAfter?: number;
  missLoss?: number;
  isBook?: boolean;
  isOnlyMove?: boolean;
  isSacrifice?: boolean;
  isCritical?: boolean;
  reasonTags?: string[];
};

export type OpeningProfile = {
  eco?: string;
  name?: string;
  moves?: string;
  games?: number;
  wins?: number;
  draws?: number;
  losses?: number;
  scorePercent?: number;
  performance?: number;
  commonMistakes?: string[];
  recurringIssues?: string[];
  recommendedStudy?: string[];
  lastSeenAt?: Date;
};

export type PhaseStats = {
  games?: number;
  inaccuracies?: number;
  mistakes?: number;
  blunders?: number;
  description?: string;
};

export type ColorStats = {
  games?: number;
  wins?: number;
  draws?: number;
  losses?: number;
  commonIssues?: string[];
};

export type SkillScore = {
  value: number;
  label?: string;
  description?: string;
  confidence?: number;
  evidenceCount?: number;
  lastUpdatedAt?: Date;
};

export type SkillMap = {
  overallScore: SkillScore;
  categories: Record<SkillMapCategoryKey, SkillScore>;
};

export type RecurringMistakeExample = {
  gameAnalysisId?: Types.ObjectId;
  moveNumber?: number;
  fen?: string;
  playedMove?: string;
  bestMove?: string;
  explanation?: string;
};

export type RecurringMistake = {
  key?: string;
  category?: RecurringMistakeCategory;
  name?: string;
  description?: string;
  frequency?: number;
  severity?: SeverityLevel;
  phases?: GamePhase[];
  examples?: RecurringMistakeExample[];
  firstDetectedAt?: Date;
  lastDetectedAt?: Date;
  status?: RecurringMistakeStatus;
  confidence?: number;
};

export type StrengthExample = {
  gameAnalysisId?: Types.ObjectId;
  moveNumber?: number;
  explanation?: string;
};

export type PlayerStrength = {
  key?: string;
  name?: string;
  description?: string;
  evidenceCount?: number;
  examples?: StrengthExample[];
  firstDetectedAt?: Date;
  lastDetectedAt?: Date;
  confidence?: number;
};

export type ImprovementAreaDelta = {
  area?: string;
  previousScore?: number;
  currentScore?: number;
  evidence?: string;
};

export type ImprovementHistoryEntry = {
  date?: Date;
  periodLabel?: string;
  summary?: string;
  improvedAreas?: ImprovementAreaDelta[];
  worsenedAreas?: ImprovementAreaDelta[];
  resolvedMistakes?: string[];
  newProblems?: string[];
  analyzedGamesCount?: number;
};

export type PlayerIdentities = {
  chessCom?: {
    username?: string;
    avatarUrl?: string;
    lastSyncedAt?: Date;
  };
  lichess?: {
    username?: string;
    lastSyncedAt?: Date;
  };
  fide?: {
    fideId?: string;
    name?: string;
    lastSyncedAt?: Date;
  };
};

export type PlayerRatings = {
  fide?: {
    classical?: number;
    rapid?: number;
    blitz?: number;
    lastUpdatedAt?: Date;
  };
  chessCom?: {
    rapid?: number;
    blitz?: number;
    bullet?: number;
    daily?: number;
    lastUpdatedAt?: Date;
  };
  lichess?: {
    rapid?: number;
    blitz?: number;
    bullet?: number;
    classical?: number;
    lastUpdatedAt?: Date;
  };
  estimatedStrength?: {
    level?: EstimatedStrengthLevel;
    confidence?: number;
    description?: string;
  };
};

export type PlayingStyleProfile = {
  primaryStyle?: ProfilePrimaryStyle;
  secondaryStyles?: string[];
  styleScores?: {
    aggression?: number;
    tacticalSharpness?: number;
    positionalUnderstanding?: number;
    riskTolerance?: number;
    defensiveSkill?: number;
    endgameSkill?: number;
    openingPreparation?: number;
    conversionSkill?: number;
    calculationSkill?: number;
  };
  description?: string;
  lastInferredAt?: Date;
};

export type OpeningRepertoire = {
  asWhite?: OpeningProfile[];
  asBlack?: {
    againstE4?: OpeningProfile[];
    againstD4?: OpeningProfile[];
    againstOther?: OpeningProfile[];
  };
};

export type ChessStatsProfile = {
  totalGamesAnalyzed?: number;
  results?: {
    wins?: number;
    draws?: number;
    losses?: number;
  };
  byPhase?: {
    opening?: PhaseStats;
    middlegame?: PhaseStats;
    endgame?: PhaseStats;
  };
  byColor?: {
    white?: ColorStats;
    black?: ColorStats;
  };
  averageAccuracy?: number;
  mistakeDistribution?: {
    inaccuracies?: number;
    mistakes?: number;
    blunders?: number;
  };
  conversion?: {
    winningPositionsLost?: number;
    winningPositionsDrawn?: number;
    advantagesConverted?: number;
  };
  resilience?: {
    worsePositionsSaved?: number;
    lostPositionsRecovered?: number;
  };
};

export type CoachPreferences = {
  selectedCoachStyle?: CoachStyle;
  tone?: CoachTone;
  explanationDepth?: ExplanationDepthLevel;
  preferredLanguage?: PreferredLanguage;
};

export type PlayerGoals = {
  targetRating?: {
    source?: TargetRatingSource;
    timeControl?: RatingTimeControl;
    value?: number;
    deadline?: Date;
  };
  mainGoal?: string;
  focusAreas?: string[];
  tournamentPreparation?: {
    enabled?: boolean;
    tournamentName?: string;
    date?: Date;
  };
};

export type TrainingPreferences = {
  dailyTrainingMinutes?: number;
  preferredDays?: string[];
  puzzleFrequency?: 'daily' | 'every_two_days' | 'weekly';
  preferredTrainingTypes?: PreferredTrainingType[];
  whatsappReminders?: {
    enabled?: boolean;
    phone?: string;
    reminderTime?: string;
  };
};

export type RecommendationsProfile = {
  currentFocus?: string;
  studyPlan?: Array<{
    title?: string;
    reason?: string;
    type?: RecommendationType;
    url?: string;
    priority?: RecommendationPriority;
  }>;
  trainingRoutine?: {
    title?: string;
    description?: string;
    durationDays?: number;
    dailyTasks?: Array<{
      task?: string;
      minutes?: number;
      theme?: string;
    }>;
  };
  lastGeneratedAt?: Date;
};

export type ProfileConfidence = {
  overall?: number;
  basedOnGames?: number;
  confidenceByArea?: {
    openings?: number;
    tactics?: number;
    endgames?: number;
    style?: number;
    recurringMistakes?: number;
  };
  warning?: string;
};

export type DecisionPatterns = {
  riskProfile?: ProfileRiskProfile;
  commonBehaviors?: string[];
  description?: string;
};

export type CriticalPhaseWeakness = {
  phase?: GamePhase;
  description?: string;
};

export type GameAnalysisRecord = {
  userId: Types.ObjectId;
  batchId?: Types.ObjectId;
  gameId?: string;
  source: GameAnalysisSource;
  targetPlayer?: StoredTargetPlayer;
  metadata?: GameAnalysisMetadata;
  originalPgn: string;
  annotatedPgn: string;
  accuracy?: StoredAccuracyByColor;
  moveClassificationSummary?: StoredMoveClassificationSummary;
  classificationDebugSummary?: StoredMoveClassificationSummary;
  moveClassifications?: StoredMoveClassificationItem[];
  criticalMoments: CriticalMoment[];
  aiReview: StoredAiReview;
  gameEvidenceSummary?: StoredGameEvidenceSummary;
  structuredSummary?: StructuredGameSummary | Record<string, unknown>;
  analysisStatus: GameAnalysisStatus;
  createdAt: Date;
  updatedAt: Date;
};

export type PlayerProfileRecord = {
  userId: Types.ObjectId;
  identities: PlayerIdentities;
  ratings: PlayerRatings;
  playingStyle: PlayingStyleProfile;
  openingRepertoire: OpeningRepertoire;
  chessStats: ChessStatsProfile;
  skillMap: SkillMap;
  recurringMistakes: RecurringMistake[];
  strengths: PlayerStrength[];
  improvementHistory: ImprovementHistoryEntry[];
  coachPreferences: CoachPreferences;
  goals: PlayerGoals;
  trainingPreferences: TrainingPreferences;
  recommendations: RecommendationsProfile;
  profileConfidence: ProfileConfidence;
  decisionPatterns: DecisionPatterns;
  criticalPhaseWeakness: CriticalPhaseWeakness;
  lastProfileUpdateAt?: Date;
  createdAt: Date;
  updatedAt: Date;
};

export type GameAnalysisDocument = Document & GameAnalysisRecord;
export type PlayerProfileDocument = Document & PlayerProfileRecord;

export type PlayerProfileUpdateInput = {
  coachPreferences?: Partial<CoachPreferences>;
  goals?: Partial<PlayerGoals>;
  trainingPreferences?: Partial<TrainingPreferences>;
  identities?: Partial<PlayerIdentities>;
  ratings?: Partial<PlayerRatings>;
};

export type ProfileDelta = {
  totalGamesAnalyzed: number;
  recurringMistakesCreated: number;
  recurringMistakesUpdated: number;
  strengthsCreated: number;
  strengthsUpdated: number;
  updatedAt: Date;
};
