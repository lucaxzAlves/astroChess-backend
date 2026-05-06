import { CriticalMoment, GameMetadata } from '../../chess/chess.types';
import type { StructuredGameSummary } from '../player-profile/player-profile.types';

export type AiGameReviewInput = {
  gameId?: string;
  originalPgn: string;
  annotatedPgn: string;
  criticalMoments: CriticalMoment[];
  metadata?: GameMetadata;
};

export type AiGameReviewResult = {
  success: boolean;
  reviewText?: string;
  structuredSummary?: StructuredGameSummary;
  rawResponse?: unknown;
  error?: string;
};

export type AiReviewWebhookPayload = {
  type: 'GAME_REVIEW_REQUEST';
  game: {
    id?: string;
    metadata?: GameMetadata;
    originalPgn: string;
    annotatedPgn: string;
    criticalMoments: CriticalMoment[];
  };
  instructions: {
    language: 'pt-BR';
    style: 'human_chess_coach';
    goal: string;
  };
};
