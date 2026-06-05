import type { StockfishAnalysis } from '../engine/stockfish.types';
import type { AiGameReviewResult } from '../modules/ai-review/ai-review.types';

export type PlayerColor = 'white' | 'black';
export type PlayerTarget = PlayerColor;
export type GamePhase = 'opening' | 'middlegame' | 'endgame' | 'unknown';
export type PositionContext = 'winning' | 'better' | 'equal' | 'worse' | 'lost';
export type MoveClassification =
  | 'brilliant'
  | 'great'
  | 'best'
  | 'excellent'
  | 'good'
  | 'book'
  | 'inaccuracy'
  | 'mistake'
  | 'miss'
  | 'blunder'
  | 'unknown';
export type MoveAnnotationSymbol = '' | '?!' | '?' | '??' | '!' | '!!';

export type GameMetadata = {
  white?: string;
  black?: string;
  result?: string;
  site?: string;
  date?: string;
  opening?: string;
  eco?: string;
};

export type ParsedMove = {
  ply: number;
  moveNumber: number;
  color: PlayerColor;
  san: string;
  uci: string;
  fenBefore: string;
  fenAfter: string;
};

export type ParsedGame = {
  id?: string;
  pgn: string;
  playerTarget?: PlayerTarget;
  metadata?: GameMetadata;
  headers: Record<string, string>;
  moves: ParsedMove[];
};

export type NormalizedEvaluation = {
  evaluation: number;
  evaluationType: 'cp' | 'mate';
};

export type SacrificeSignal = {
  offeredPieceValue: number;
  gainedPieceValue: number;
  netOfferValue: number;
  captureAvailable: boolean;
  captureMove: string | null;
  captureEval: number | null;
  currentEval: number;
  acceptedSacrifice: boolean;
  offeredSacrifice: boolean;
};

export type MoveClassificationResult = {
  classification: MoveClassification;
  symbol: MoveAnnotationSymbol;
  evalLoss: number | null;
  expectedBefore: number;
  expectedAfter: number;
  expectedLoss: number;
  expectedPointsLoss: number;
  centipawnLoss: number | null;
  bestExpectedAfter: number;
  playedExpectedAfter: number;
  missLoss: number;
  isBook: boolean;
  isOnlyMove: boolean;
  isSacrifice: boolean;
  isCritical: boolean;
  comment: string;
  reasonTags: string[];
  shouldAnnotate: boolean;
  classificationDebug?: ClassificationDebug;
};

export type ClassificationDebug = {
  playerEvalBefore: number;
  bestPlayerEval: number;
  playedPlayerEval: number;
  evalLoss: number | null;
  expectedBefore: number;
  expectedAfter: number;
  expectedLoss: number;
  expectedPointsLoss: number;
  centipawnLoss: number | null;
  bestExpectedAfter: number;
  playedExpectedAfter: number;
  missLoss: number;
  missedGain: number;
  positionContext: PositionContext;
  thresholdsUsed: {
    best: number;
    excellent: number;
    good: number;
    inaccuracy: number;
    mistake: number;
    blunder: number;
  };
  reason: string;
};

export type AnalyzedMove = ParsedMove & {
  sacrificeSignal?: SacrificeSignal;
  before?: StockfishAnalysis;
  after?: StockfishAnalysis;
  normalizedBefore: NormalizedEvaluation;
  normalizedAfter: NormalizedEvaluation;
  evalBefore: number | string;
  evalAfter: number | string;
  expectedBefore: number;
  expectedAfter: number;
  expectedLoss: number;
  expectedPointsLoss: number;
  centipawnLoss: number | null;
  bestExpectedAfter: number;
  playedExpectedAfter: number;
  missLoss: number;
  isBook: boolean;
  isOnlyMove: boolean;
  isSacrifice: boolean;
  isCritical: boolean;
  bestMove?: string;
  bestMoveUci?: string;
  classification: MoveClassification;
  symbol: MoveAnnotationSymbol;
  evalLoss: number | null;
  moveAccuracy: number;
  phase: GamePhase;
  comment: string;
  reasonTags: string[];
  shouldAnnotate: boolean;
  classificationDebug?: ClassificationDebug;
  pv: string[];
  shouldIncludePv: boolean;
};

export type PublicAnalyzedMove = Pick<
  AnalyzedMove,
  | 'ply'
  | 'moveNumber'
  | 'color'
  | 'san'
  | 'uci'
  | 'fenBefore'
  | 'fenAfter'
  | 'evalBefore'
  | 'evalAfter'
  | 'expectedBefore'
  | 'expectedAfter'
  | 'expectedLoss'
  | 'expectedPointsLoss'
  | 'centipawnLoss'
  | 'bestExpectedAfter'
  | 'playedExpectedAfter'
  | 'missLoss'
  | 'isBook'
  | 'isOnlyMove'
  | 'isSacrifice'
  | 'isCritical'
  | 'evalLoss'
  | 'bestMove'
  | 'classification'
  | 'moveAccuracy'
  | 'shouldAnnotate'
  | 'comment'
  | 'reasonTags'
  | 'classificationDebug'
  | 'pv'
>;

export type MoveClassificationItem = {
  ply: number;
  moveNumber: number;
  color: PlayerColor;
  san: string;
  classification: MoveClassification;
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

export type AccuracyByColor = {
  white: number;
  black: number;
};

export type AccuracyDetail = {
  movesCount: number;
  averageLoss: number;
  weightedAverageLoss: number;
};

export type AccuracyDetailsByColor = {
  white: AccuracyDetail;
  black: AccuracyDetail;
};

export type MoveClassificationSummaryEntry = {
  brilliant: number;
  great: number;
  best: number;
  excellent: number;
  good: number;
  book: number;
  inaccuracy: number;
  mistake: number;
  miss: number;
  blunder: number;
};

export type MoveClassificationSummary = {
  white: MoveClassificationSummaryEntry;
  black: MoveClassificationSummaryEntry;
};

export type CriticalMoment = {
  ply: number;
  moveNumber: number;
  color: PlayerColor;
  playedMove: string;
  bestMove?: string;
  classification: MoveClassification;
  evalBefore: number | string;
  evalAfter: number | string;
  evalLoss: number | null;
  expectedBefore: number;
  expectedAfter: number;
  expectedLoss: number;
  expectedPointsLoss: number;
  centipawnLoss: number | null;
  bestExpectedAfter: number;
  playedExpectedAfter: number;
  missLoss: number;
  isBook: boolean;
  isOnlyMove: boolean;
  isSacrifice: boolean;
  isCritical: boolean;
  fenBefore: string;
  fenAfter: string;
  pv: string[];
  comment: string;
  reasonTags: string[];
};

export type GameAnalysis = {
  gameId?: string;
  annotatedPgn: string;
  accuracy: AccuracyByColor;
  accuracyDetails: AccuracyDetailsByColor;
  moveClassificationSummary: MoveClassificationSummary;
  classificationDebugSummary?: MoveClassificationSummary;
  moveClassifications: MoveClassificationItem[];
  criticalMoments: CriticalMoment[];
  analyzedMoves: PublicAnalyzedMove[];
  aiReview?: AiGameReviewResult;
};

export type GameAnalysisMetrics = {
  totalTimeMs: number;
  fastPhaseTimeMs: number;
  deepPhaseTimeMs: number;
  positionsAnalyzed: number;
  deepAnalysesRun: number;
  skippedDeepAnalyses: number;
  cacheHits: number;
  criticalMoments: number;
};

export type GameAnalysisResult = {
  analysis: GameAnalysis;
  metrics: GameAnalysisMetrics;
};
