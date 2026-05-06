export type EvaluationType = 'cp' | 'mate';

export type StockfishEvaluation = {
  evaluation: number;
  evaluationType: EvaluationType;
};

export type StockfishAnalysis = StockfishEvaluation & {
  bestMove: string;
  pv: string[];
  depth: number;
  rawOutput?: string[];
};

export type StockfishAnalyzeOptions = {
  depth?: number;
  movetimeMs?: number;
  includePv: boolean;
  mode: 'fast' | 'deep';
};

export type StockfishClientOptions = {
  binaryPath?: string;
  timeoutMs?: number;
  includeRawOutput?: boolean;
  threads?: number;
  hashMb?: number;
};

export type StockfishCacheMetrics = {
  positionsAnalyzed: number;
  cacheHits: number;
};
