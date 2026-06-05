import type { Types } from 'mongoose';

import type {
  CriticalMoment,
  GameMetadata,
  MoveClassificationItem,
  PlayerColor,
} from '../../chess/chess.types';
import type { AiGameReviewResult, ProfileGameEvidenceSummary } from '../ai-review/ai-review.types';
import type {
  StoredAccuracyByColor,
  StoredMoveClassificationSummary,
  StructuredGameSummary,
} from '../player-profile/player-profile.types';

export type GameAnalysisSourceInput = 'lichess' | 'chess.com' | 'upload' | 'manual' | 'unknown';
export type GameAnalysisStoredSource = 'lichess' | 'chess_com' | 'upload' | 'manual' | 'unknown';
export type GameAnalysisTargetPlayerPlatform = 'chess.com' | 'lichess' | 'manual' | 'unknown';
export type GameAnalysisTargetPlayerColor = PlayerColor | 'unknown';

export type TargetPlayerSnapshot = {
  username?: string;
  color?: GameAnalysisTargetPlayerColor;
  platform?: GameAnalysisTargetPlayerPlatform;
};

export type TechnicalGameAnalysisSnapshot = {
  gameId?: string;
  annotatedPgn: string;
  accuracy: StoredAccuracyByColor;
  moveClassificationSummary: StoredMoveClassificationSummary;
  classificationDebugSummary?: StoredMoveClassificationSummary;
  moveClassifications: MoveClassificationItem[];
  criticalMoments: CriticalMoment[];
};

export type SaveGameAnalysisInput = {
  userId: string;
  batchId?: string;
  allowExistingNonBatch?: boolean;
  gameId?: string;
  source?: GameAnalysisSourceInput;
  targetPlayer?: TargetPlayerSnapshot;
  metadata?: GameMetadata & {
    event?: string;
    opening?: string;
    eco?: string;
    timeControl?: string;
  };
  originalPgn: string;
  technicalAnalysis: TechnicalGameAnalysisSnapshot;
  aiReview?: AiGameReviewResult;
  gameEvidenceSummary?: ProfileGameEvidenceSummary;
  structuredSummary?: StructuredGameSummary | Record<string, unknown>;
};

export type PersistedGameAnalysisPreview = {
  id: string;
  gameId?: string;
  metadata?: SaveGameAnalysisInput['metadata'];
  targetPlayer?: TargetPlayerSnapshot;
  accuracy?: StoredAccuracyByColor;
  moveClassificationSummary?: StoredMoveClassificationSummary;
  aiReview: {
    success: boolean;
    reviewTextPreview?: string;
    error?: string;
  };
  hasGameEvidenceSummary: boolean;
  analysisStatus: 'technical_completed' | 'ai_review_completed' | 'profile_processed' | 'failed';
  createdAt: Date;
  annotatedPgn?: string;
};

export type PersistedGameAnalysisRecord = {
  _id: Types.ObjectId;
  userId: Types.ObjectId;
  batchId?: Types.ObjectId;
  gameId?: string;
  source: GameAnalysisStoredSource;
  targetPlayer?: TargetPlayerSnapshot;
  metadata?: SaveGameAnalysisInput['metadata'];
  originalPgn: string;
  annotatedPgn: string;
  accuracy?: StoredAccuracyByColor;
  moveClassificationSummary?: StoredMoveClassificationSummary;
  moveClassifications?: MoveClassificationItem[];
  criticalMoments: CriticalMoment[];
  aiReview: {
    success: boolean;
    reviewText?: string;
    rawResponse?: unknown;
    error?: string;
  };
  gameEvidenceSummary?: ProfileGameEvidenceSummary;
  structuredSummary?: StructuredGameSummary | Record<string, unknown>;
  analysisStatus: 'technical_completed' | 'ai_review_completed' | 'profile_processed' | 'failed';
  createdAt: Date;
  updatedAt: Date;
};
