import type { Document, Types } from 'mongoose';

import type { GameMetadata, PlayerTarget } from '../../chess/chess.types';

export const analysisBatchStatuses = [
  'pending',
  'processing',
  'completed',
  'completed_with_errors',
  'failed',
  'awaiting_profile_update',
  'profile_update_processing',
  'profile_updated',
  'profile_update_failed',
] as const;

export const analysisBatchErrorStages = [
  'technical_analysis',
  'ai_review',
  'database_save',
  'profile_update',
  'unknown',
] as const;

export const analysisBatchTargetPlatforms = ['chess.com', 'lichess', 'manual', 'unknown'] as const;
export const analysisBatchSources = ['chess.com', 'lichess', 'upload', 'manual', 'unknown'] as const;
export const analysisBatchProfileStatuses = [
  'not_started',
  'skipped',
  'processing',
  'completed',
  'failed',
] as const;

export type AnalysisBatchStatus = (typeof analysisBatchStatuses)[number];
export type AnalysisBatchErrorStage = (typeof analysisBatchErrorStages)[number];
export type AnalysisBatchTargetPlatform = (typeof analysisBatchTargetPlatforms)[number];
export type AnalysisBatchSource = (typeof analysisBatchSources)[number];
export type AnalysisBatchProfileStatus = (typeof analysisBatchProfileStatuses)[number];

export type AnalysisBatchGameInput = {
  id?: string;
  pgn: string;
  playerTarget?: PlayerTarget;
  metadata?: GameMetadata & {
    event?: string;
    opening?: string;
    eco?: string;
    timeControl?: string;
  };
};

export type AnalysisBatchOptions = {
  includeAiReview: boolean;
  updateProfileAfterBatch: boolean;
  targetPlayer?: {
    username?: string;
    platform?: AnalysisBatchTargetPlatform;
  };
  timeControl?: string;
  source?: AnalysisBatchSource;
};

export type CreateAnalysisBatchBody = {
  games: AnalysisBatchGameInput[];
  options?: Partial<AnalysisBatchOptions>;
};

export type AnalysisBatchErrorItem = {
  gameId?: string;
  message: string;
  stage: AnalysisBatchErrorStage;
  createdAt: Date;
};

export type AnalysisBatchProfileUpdate = {
  status?: AnalysisBatchProfileStatus;
  inputPreview?: unknown;
  profileEvidence?: unknown;
  profileEvidencePayloadPreview?: unknown;
  profileDelta?: unknown;
  rawResponse?: unknown;
  error?: string;
  playerProfileUpdated?: boolean;
  profileVersionBeforeId?: Types.ObjectId;
  profileVersionAfterId?: Types.ObjectId;
  revertedAt?: Date;
  revertedToVersionId?: Types.ObjectId;
  profileImpactReverted?: boolean;
  processedAt?: Date;
};

export type AnalysisBatchRecord = {
  userId: Types.ObjectId;
  status: AnalysisBatchStatus;
  totalGames: number;
  processedGames: number;
  successfulGames: number;
  failedGames: number;
  analysisOptions: AnalysisBatchOptions;
  gameAnalysisIds: Types.ObjectId[];
  errors: AnalysisBatchErrorItem[];
  profileUpdate: AnalysisBatchProfileUpdate;
  startedAt?: Date;
  finishedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
};

export type AnalysisBatchDocument = Document & AnalysisBatchRecord;
