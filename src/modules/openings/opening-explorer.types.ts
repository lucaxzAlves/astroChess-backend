import type { Document, Types } from 'mongoose';

export type OpeningOutcome = 'win' | 'draw' | 'loss';

export type OpeningColorStats = {
  games: number;
  wins: number;
  draws: number;
  losses: number;
};

export type OpeningNode = {
  id: string;
  move: string | null;
  fen: string;
  depth: number;
  games: number;
  wins: number;
  draws: number;
  losses: number;
  whiteGames: number;
  blackGames: number;
  children: OpeningNode[];
};

export type CachedOpeningNode = Omit<OpeningNode, 'children'> & {
  whiteStats: OpeningColorStats;
  blackStats: OpeningColorStats;
  children: CachedOpeningNode[];
};

export type PersistedOpeningNode = Omit<CachedOpeningNode, 'children'> & {
  childIds: string[];
};

export type PersistedOpeningTree = {
  version: 1;
  rootId: string;
  nodes: Record<string, PersistedOpeningNode>;
};

export type OpeningMoveSummary = {
  move: string;
  fen: string;
  games: number;
  wins: number;
  draws: number;
  losses: number;
  score: number;
  whiteGames: number;
  blackGames: number;
};

export type OpeningNamedStat = {
  name: string;
  eco: string | null;
  games: number;
  wins: number;
  draws: number;
  losses: number;
  score: number;
  whiteGames: number;
  blackGames: number;
};

export type OpeningSummaryItem = {
  name: string;
  games?: number;
  score?: number;
};

export type OpeningExplorerSummary = {
  totalGames: number;
  whiteRepertoireSize: number;
  blackRepertoireSize: number;
  mostPlayedOpening: OpeningSummaryItem | null;
  bestOpening: OpeningSummaryItem | null;
  weakestOpening: OpeningSummaryItem | null;
};

export type OpeningExplorerInsight = {
  type: 'common_choice' | 'performance_warning' | 'repertoire_pattern' | 'strong_choice' | 'leaf_position';
  title: string;
  description: string;
};

export type OpeningExplorerCacheStats = OpeningExplorerSummary & {
  rootFen: string;
  skippedGames: number;
  namedOpeningStats: OpeningNamedStat[];
};

export type OpeningExplorerCacheRecord = {
  playerId: Types.ObjectId;
  root: PersistedOpeningTree;
  stats: OpeningExplorerCacheStats;
  dirty: boolean;
  updatedAt?: Date;
};

export type OpeningExplorerCacheDocument = Document<Types.ObjectId> & OpeningExplorerCacheRecord;

export type OpeningExplorerGameRecord = {
  _id: Types.ObjectId;
  gameId?: string;
  source?: string;
  createdAt?: Date;
  originalPgn: string;
  metadata?: {
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
  targetPlayer?: {
    username?: string;
    color?: 'white' | 'black' | 'unknown';
    platform?: 'chess.com' | 'lichess' | 'manual' | 'unknown';
  };
};
