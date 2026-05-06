import { GameAnalysis, GameAnalysisMetrics, GameMetadata } from '../../chess/chess.types';

export type AnalysisGameInput = {
  id?: string;
  pgn: string;
  metadata?: GameMetadata;
};

export type AnalysisPgnRequestBody = {
  games: AnalysisGameInput[];
  options?: {
    includeAiReview?: boolean;
  };
};

export type AnalysisPgnResponse = {
  analysisDepth: number;
  fastMovetimeMs: number;
  deepMovetimeMs: number;
  totalGames: number;
  metrics: GameAnalysisMetrics;
  results: GameAnalysis[];
};
