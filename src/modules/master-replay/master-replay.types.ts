import type { Document, Types } from 'mongoose';

export const masterReplayStatuses = ['draft', 'published', 'archived'] as const;
export const masterReplayCategories = [
  'attack',
  'defense',
  'calculation',
  'positional',
  'endgame',
  'opening',
  'tactics',
  'strategy',
] as const;
export const masterReplayDifficulties = [
  'beginner',
  'intermediate',
  'advanced',
  'master',
] as const;
export const masterReplayOrientations = ['white', 'black'] as const;
export const masterReplaySidesToGuess = ['white', 'black', 'both'] as const;
export const masterReplayAnnotationTypes = [
  'idea',
  'critical',
  'mistake',
  'brilliant',
  'turning_point',
  'quiet_move',
  'defensive_resource',
  'model_move',
] as const;
export const masterReplayMomentTypes = [
  'opening_idea',
  'critical_position',
  'turning_point',
  'combination',
  'defensive_resource',
  'conversion',
  'endgame_technique',
] as const;

export type MasterReplayStatus = (typeof masterReplayStatuses)[number];
export type MasterReplayCategory = (typeof masterReplayCategories)[number];
export type MasterReplayDifficulty = (typeof masterReplayDifficulties)[number];
export type MasterReplayOrientation = (typeof masterReplayOrientations)[number];
export type MasterReplaySideToGuess = (typeof masterReplaySidesToGuess)[number];
export type MasterReplayAnnotationType = (typeof masterReplayAnnotationTypes)[number];
export type MasterReplayMomentType = (typeof masterReplayMomentTypes)[number];

export type MasterReplayAnnotatedMove = {
  ply: number;
  moveNumber: number;
  color: 'white' | 'black';
  san: string;
  uci?: string;
  fenBefore?: string;
  fenAfter?: string;
  comment?: string;
  shortComment?: string;
  annotationType?: MasterReplayAnnotationType;
  arrows?: Array<{
    from: string;
    to: string;
    color?: string;
  }>;
  highlightSquares?: string[];
  evalBefore?: number;
  evalAfter?: number;
  isGuessMove?: boolean;
  question?: {
    prompt: string;
    candidateMoves?: string[];
    correctMove?: string;
    explanation?: string;
    hints?: string[];
  };
};

export type MasterReplayKeyMoment = {
  id?: string;
  ply: number;
  moveNumber: number;
  color: 'white' | 'black';
  title: string;
  description: string;
  type: MasterReplayMomentType;
  fen?: string;
  question?: string;
  answer?: string;
  lesson?: string;
  order: number;
};

export type MasterReplayGameRecord = {
  title: string;
  slug: string;
  description?: string;
  status: MasterReplayStatus;
  category: MasterReplayCategory;
  difficulty: MasterReplayDifficulty;
  tags: string[];
  players: {
    white: string;
    black: string;
  };
  gameInfo: {
    event?: string;
    site?: string;
    date?: string;
    round?: string;
    result?: string;
    eco?: string;
    opening?: string;
    year?: number;
  };
  pgn: string;
  initialFen?: string;
  orientation: MasterReplayOrientation;
  moveCount?: number;
  replayMode: {
    sideToGuess: MasterReplaySideToGuess;
    showEngineEval?: boolean;
    showHints?: boolean;
    allowRetry?: boolean;
  };
  annotatedMoves: MasterReplayAnnotatedMove[];
  keyMoments: MasterReplayKeyMoment[];
  studySummary?: {
    coreLesson?: string;
    whatToLearn?: string[];
    typicalMistakes?: string[];
    modelIdeas?: string[];
  };
  order: number;
  createdBy?: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
};

export type MasterReplayGameDocument = Document & MasterReplayGameRecord;

