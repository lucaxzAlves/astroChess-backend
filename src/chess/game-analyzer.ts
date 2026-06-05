import { Chess, type Square } from 'chess.js';

import { calculateAccuracyByColor } from './accuracy-calculator';
import { StockfishClient } from '../engine/stockfish.client';
import { StockfishAnalysis } from '../engine/stockfish.types';
import {
  classifyMove,
  evaluationToExpectedPointsForColor,
  getMaterialDeltaForMove,
  getMovePhase,
  isProblematicClassification,
  isMoveClassificationSummaryKey,
  normalizedEvaluationToPawns,
} from './move-classifier';
import {
  AccuracyByColor,
  AccuracyDetailsByColor,
  AnalyzedMove,
  CriticalMoment,
  GameAnalysisMetrics,
  GameAnalysisResult,
  MoveClassificationSummary,
  MoveClassificationItem,
  MoveClassificationSummaryEntry,
  NormalizedEvaluation,
  ParsedGame,
  PublicAnalyzedMove,
  SacrificeSignal,
} from './chess.types';
import {
  buildAnnotatedPgn,
  formatEvalForStructuredOutput,
  toSanFromUci,
  toSanVariationFromUci,
} from './pgn-annotator';

const normalizeEvaluation = (analysis: StockfishAnalysis, fen: string): NormalizedEvaluation => {
  const colorToMove = fen.split(' ')[1];
  const multiplier = colorToMove === 'w' ? 1 : -1;

  return {
    evaluation: analysis.evaluation * multiplier,
    evaluationType: analysis.evaluationType,
  };
};

const normalizeBookSan = (san: string): string => {
  return san.replace(/[+#?!]+/g, '').trim();
};

const COMMON_BOOK_LINES = [
  ['e4', 'e5', 'Nf3', 'Nc6', 'Bb5', 'a6', 'Ba4', 'Nf6', 'O-O', 'Be7'],
  ['e4', 'e5', 'Nf3', 'Nc6', 'Bc4', 'Bc5'],
  ['e4', 'e5', 'Nf3', 'Nc6', 'd4', 'exd4'],
  ['e4', 'c5', 'Nf3', 'd6', 'd4', 'cxd4', 'Nxd4', 'Nf6', 'Nc3'],
  ['e4', 'c5', 'Nf3', 'Nc6', 'd4', 'cxd4', 'Nxd4'],
  ['e4', 'c5', 'Nf3', 'e6', 'd4', 'cxd4', 'Nxd4'],
  ['e4', 'e6', 'd4', 'd5'],
  ['e4', 'c6', 'd4', 'd5'],
  ['e4', 'd6', 'd4', 'Nf6', 'Nc3', 'g6'],
  ['e4', 'd5', 'exd5', 'Qxd5', 'Nc3'],
  ['d4', 'd5', 'c4', 'e6', 'Nc3', 'Nf6'],
  ['d4', 'd5', 'c4', 'c6'],
  ['d4', 'Nf6', 'c4', 'g6', 'Nc3', 'Bg7', 'e4', 'd6'],
  ['d4', 'Nf6', 'c4', 'e6', 'Nc3', 'Bb4'],
  ['d4', 'Nf6', 'c4', 'e6', 'Nf3', 'b6'],
  ['d4', 'Nf6', 'c4', 'c5', 'd5', 'e6'],
  ['c4', 'e5', 'Nc3', 'Nf6', 'g3'],
  ['Nf3', 'd5', 'g3', 'Nf6', 'Bg2'],
];

const hasOpeningMetadata = (game: ParsedGame): boolean => {
  return Boolean(
    game.metadata?.opening ||
      game.metadata?.eco ||
      game.headers.Opening ||
      game.headers.ECO,
  );
};

const isCommonBookMove = (moves: Array<{ san: string }>, moveIndex: number): boolean => {
  const playedPrefix = moves.slice(0, moveIndex + 1).map((move) => normalizeBookSan(move.san));

  return COMMON_BOOK_LINES.some((line) => {
    if (playedPrefix.length > line.length) {
      return false;
    }

    return playedPrefix.every((san, index) => san === line[index]);
  });
};

const isLikelyBookMove = (
  game: ParsedGame,
  moveIndex: number,
  moveNumber: number,
  ignoreErrorsBeforeMove: number,
): boolean => {
  if (moveNumber > ignoreErrorsBeforeMove) {
    return false;
  }

  if (hasOpeningMetadata(game)) {
    return true;
  }

  return isCommonBookMove(game.moves, moveIndex);
};

const getEffectiveBookMoveCap = (
  game: ParsedGame,
  configuredCap: number,
  ignoreErrorsBeforeMove: number,
): number => {
  if (!hasOpeningMetadata(game)) {
    return configuredCap;
  }

  return Math.max(configuredCap, ignoreErrorsBeforeMove);
};

const buildCandidateEvaluations = (
  analysis: StockfishAnalysis,
  fen: string,
  color: 'white' | 'black',
): Array<{ moveUci: string; expectedPoints: number }> => {
  return (analysis.candidateLines ?? [])
    .filter((line) => line.bestMove && line.bestMove !== '0000')
    .map((line) => {
      const normalized = normalizeEvaluation(line, fen);

      return {
        moveUci: line.bestMove,
        expectedPoints: Number(evaluationToExpectedPointsForColor(normalized, color).toFixed(4)),
      };
    });
};

const createNeutralAnalysis = (): StockfishAnalysis => {
  return {
    bestMove: '0000',
    evaluation: 0,
    evaluationType: 'cp',
    pv: [],
    depth: 0,
  };
};

const createNeutralEvaluation = (): NormalizedEvaluation => {
  return {
    evaluation: 0,
    evaluationType: 'cp',
  };
};

const createEmptyAccuracyDetails = (): AccuracyDetailsByColor => {
  return {
    white: {
      movesCount: 0,
      averageLoss: 0,
      weightedAverageLoss: 0,
    },
    black: {
      movesCount: 0,
      averageLoss: 0,
      weightedAverageLoss: 0,
    },
  };
};

const createEmptySummaryEntry = (): MoveClassificationSummaryEntry => {
  return {
    brilliant: 0,
    great: 0,
    best: 0,
    excellent: 0,
    good: 0,
    book: 0,
    inaccuracy: 0,
    mistake: 0,
    miss: 0,
    blunder: 0,
  };
};

const createEmptySummary = (): MoveClassificationSummary => {
  return {
    white: createEmptySummaryEntry(),
    black: createEmptySummaryEntry(),
  };
};

const SACRIFICE_ANALYSIS_MAX_EXPECTED_LOSS = 0.04;
const SACRIFICE_ANALYSIS_MIN_CURRENT_EXPECTED = 0.35;
const PIECE_VALUES: Record<string, number> = {
  p: 1,
  n: 3,
  b: 3,
  r: 5,
  q: 9,
  k: 0,
};

const parseUciMove = (uci: string): { from: Square; to: Square; promotion?: string } | null => {
  if (!/^[a-h][1-8][a-h][1-8][qrbn]?$/.test(uci)) {
    return null;
  }

  return {
    from: uci.slice(0, 2) as Square,
    to: uci.slice(2, 4) as Square,
    promotion: uci.length > 4 ? uci[4] : undefined,
  };
};

const buildFallbackSacrificeSignal = (materialDelta: number): SacrificeSignal => ({
  offeredPieceValue: 0,
  gainedPieceValue: 0,
  netOfferValue: 0,
  captureAvailable: false,
  captureMove: null,
  captureEval: null,
  currentEval: 0,
  acceptedSacrifice: materialDelta <= -2,
  offeredSacrifice: false,
});

const getMaterialDifference = (fen: string): number => {
  const board = new Chess(fen).board().flat();

  return board.reduce((acc, square) => {
    if (!square) {
      return acc;
    }

    const value = PIECE_VALUES[square.type] ?? 0;

    return square.color === 'w' ? acc + value : acc - value;
  }, 0);
};

const isSimplePieceRecapture = (fen: string, uciMoves: [string, string]): boolean => {
  const firstMove = parseUciMove(uciMoves[0]);
  const secondMove = parseUciMove(uciMoves[1]);

  if (!firstMove || !secondMove || firstMove.to !== secondMove.to) {
    return false;
  }

  const game = new Chess(fen);
  return Boolean(game.get(firstMove.to));
};

const getImmediateOfferValues = (fenBefore: string, playedMoveUci: string): {
  offeredPieceValue: number;
  gainedPieceValue: number;
  netOfferValue: number;
} => {
  const parsedMove = parseUciMove(playedMoveUci);

  if (!parsedMove) {
    return { offeredPieceValue: 0, gainedPieceValue: 0, netOfferValue: 0 };
  }

  const board = new Chess(fenBefore);
  const movedPiece = board.get(parsedMove.from);
  const capturedPiece = board.get(parsedMove.to);
  const offeredPieceValue = movedPiece ? (PIECE_VALUES[movedPiece.type] ?? 0) : 0;
  const gainedPieceValue = capturedPiece ? (PIECE_VALUES[capturedPiece.type] ?? 0) : 0;

  return {
    offeredPieceValue,
    gainedPieceValue,
    netOfferValue: offeredPieceValue - gainedPieceValue,
  };
};

const getIsPieceSacrificeSequence = (
  fenBefore: string,
  playedMoveUci: string,
  continuationPv: string[],
  color: 'white' | 'black',
): boolean => {
  if (!continuationPv.length) {
    return false;
  }

  const game = new Chess(fenBefore);
  const startingMaterialDifference = getMaterialDifference(fenBefore);
  const moves = [playedMoveUci, ...continuationPv];

  if (moves.length % 2 === 1) {
    moves.pop();
  }

  let nonCapturingMovesBudget = 1;
  const capturedPieces: { w: string[]; b: string[] } = { w: [], b: [] };

  for (const uciMove of moves) {
    const parsedMove = parseUciMove(uciMove);

    if (!parsedMove) {
      return false;
    }

    try {
      const fullMove = game.move(parsedMove);

      if (fullMove.captured) {
        capturedPieces[fullMove.color].push(fullMove.captured);
        nonCapturingMovesBudget = 1;
      } else {
        nonCapturingMovesBudget -= 1;

        if (nonCapturingMovesBudget < 0) {
          break;
        }
      }
    } catch {
      return false;
    }
  }

  for (const piece of [...capturedPieces.w]) {
    const index = capturedPieces.b.indexOf(piece);

    if (index !== -1) {
      capturedPieces.b.splice(index, 1);
      capturedPieces.w.splice(capturedPieces.w.indexOf(piece), 1);
    }
  }

  const allRemainingCapturedPieces = [...capturedPieces.w, ...capturedPieces.b];

  if (
    Math.abs(capturedPieces.w.length - capturedPieces.b.length) <= 1 &&
    allRemainingCapturedPieces.length > 0 &&
    allRemainingCapturedPieces.every((piece) => piece === 'p')
  ) {
    return false;
  }

  const endingMaterialDifference = getMaterialDifference(game.fen());
  const materialDiff = endingMaterialDifference - startingMaterialDifference;
  const materialDiffPlayerRelative = color === 'white' ? materialDiff : -materialDiff;

  return materialDiffPlayerRelative < 0;
};

const shouldAnalyzeSacrificeSignal = (input: {
  playedMoveUci: string;
  bestMoveUci?: string;
  moveNumber: number;
  expectedBefore: number;
  expectedAfter: number;
  bestExpectedAfter: number;
  materialDelta: number;
}): boolean => {
  if (input.moveNumber <= 4) {
    return false;
  }

  if (input.materialDelta <= -2) {
    return true;
  }

  const expectedPointsLoss = Math.max(0, Number((input.expectedBefore - input.expectedAfter).toFixed(4)));
  const missLoss = Math.max(0, Number((input.bestExpectedAfter - input.expectedAfter).toFixed(4)));
  const isEngineApproved =
    (Boolean(input.bestMoveUci) && input.playedMoveUci === input.bestMoveUci) ||
    expectedPointsLoss <= SACRIFICE_ANALYSIS_MAX_EXPECTED_LOSS ||
    missLoss <= 0.03;

  if (!isEngineApproved) {
    return false;
  }

  return input.expectedAfter >= SACRIFICE_ANALYSIS_MIN_CURRENT_EXPECTED;
};

const analyzeSacrificeSignalForMove = async (input: {
  move: ParsedGame['moves'][number];
  previousMoveUci?: string;
  fenTwoMovesAgo?: string;
  normalizedBefore: NormalizedEvaluation;
  normalizedAfter: NormalizedEvaluation;
  bestMoveUci?: string;
  candidateEvaluations: Array<{ moveUci: string; expectedPoints: number }>;
  materialDelta: number;
  stockfish: StockfishClient;
  movetimeMs: number;
}): Promise<SacrificeSignal> => {
  const {
    move,
    previousMoveUci,
    fenTwoMovesAgo,
    normalizedBefore,
    normalizedAfter,
    bestMoveUci,
    candidateEvaluations,
    materialDelta,
    stockfish,
    movetimeMs,
  } = input;
  const fallbackSignal = buildFallbackSacrificeSignal(materialDelta);
  const expectedBefore = Number(evaluationToExpectedPointsForColor(normalizedBefore, move.color).toFixed(4));
  const expectedAfter = Number(evaluationToExpectedPointsForColor(normalizedAfter, move.color).toFixed(4));
  const bestExpectedAfter = Number((candidateEvaluations[0]?.expectedPoints ?? expectedAfter).toFixed(4));
  const currentEval = Number(normalizedEvaluationToPawns(normalizedAfter).toFixed(2));
  const immediateOffer = getImmediateOfferValues(move.fenBefore, move.uci);

  if (
    !shouldAnalyzeSacrificeSignal({
      playedMoveUci: move.uci,
      bestMoveUci,
      moveNumber: move.moveNumber,
      expectedBefore,
      expectedAfter,
      bestExpectedAfter,
      materialDelta,
    })
  ) {
    return {
      ...fallbackSignal,
      currentEval,
      ...immediateOffer,
    };
  }

  if (
    previousMoveUci &&
    fenTwoMovesAgo &&
    isSimplePieceRecapture(fenTwoMovesAgo, [previousMoveUci, move.uci])
  ) {
    return {
      ...fallbackSignal,
      currentEval,
      ...immediateOffer,
    };
  }

  const continuationAnalysis = await stockfish.analyzePositionDeep({
    fen: move.fenAfter,
    movetimeMs: Math.max(movetimeMs * 4, 250),
    includePv: true,
  });

  const offeredSacrifice = getIsPieceSacrificeSequence(
    move.fenBefore,
    move.uci,
    continuationAnalysis.pv,
    move.color,
  );

  return {
    ...fallbackSignal,
    currentEval,
    ...immediateOffer,
    offeredSacrifice,
  };
};

const hasMateReason = (move: AnalyzedMove): boolean => {
  return move.reasonTags.some((tag) => tag.includes('mate'));
};

const getSeverityScore = (move: AnalyzedMove): number => {
  if (hasMateReason(move)) {
    return Number.MAX_SAFE_INTEGER;
  }

  switch (move.classification) {
    case 'blunder':
      return 5 + (move.evalLoss ?? 0);
    case 'miss':
      return 4.5 + (move.evalLoss ?? 0);
    case 'mistake':
      return 3 + (move.evalLoss ?? 0);
    case 'inaccuracy':
      return 1 + (move.evalLoss ?? 0);
    default:
      return move.evalLoss ?? 0;
  }
};

const shouldConsiderForPv = (move: AnalyzedMove): boolean => {
  return (
    move.classification === 'mistake' ||
    move.classification === 'blunder' ||
    move.classification === 'miss' ||
    hasMateReason(move)
  );
};

const toCriticalMoment = (move: AnalyzedMove): CriticalMoment => {
  return {
    ply: move.ply,
    moveNumber: move.moveNumber,
    color: move.color,
    playedMove: move.san,
    bestMove: move.bestMove,
    classification: move.classification,
    evalBefore: move.evalBefore,
    evalAfter: move.evalAfter,
    evalLoss: move.evalLoss,
    expectedBefore: move.expectedBefore,
    expectedAfter: move.expectedAfter,
    expectedLoss: move.expectedLoss,
    expectedPointsLoss: move.expectedPointsLoss,
    centipawnLoss: move.centipawnLoss,
    bestExpectedAfter: move.bestExpectedAfter,
    playedExpectedAfter: move.playedExpectedAfter,
    missLoss: move.missLoss,
    isBook: move.isBook,
    isOnlyMove: move.isOnlyMove,
    isSacrifice: move.isSacrifice,
    isCritical: move.isCritical,
    fenBefore: move.fenBefore,
    fenAfter: move.fenAfter,
    pv: move.pv,
    comment: move.comment,
    reasonTags: move.reasonTags,
  };
};

const buildMoveClassificationSummary = (moves: AnalyzedMove[]): MoveClassificationSummary => {
  const summary = createEmptySummary();

  for (const move of moves) {
    if (!isMoveClassificationSummaryKey(move.classification)) {
      continue;
    }

    summary[move.color][move.classification] += 1;
  }

  return summary;
};

const toMoveClassificationItem = (move: AnalyzedMove): MoveClassificationItem => {
  return {
    ply: move.ply,
    moveNumber: move.moveNumber,
    color: move.color,
    san: move.san,
    classification: move.classification ?? 'unknown',
    critical:
      move.shouldAnnotate ||
      ['inaccuracy', 'mistake', 'miss', 'blunder'].includes(move.classification),
    moveAccuracy: move.moveAccuracy,
    evalLoss: move.evalLoss,
    evalBefore: move.evalBefore,
    evalAfter: move.evalAfter,
    expectedBefore: move.expectedBefore,
    expectedAfter: move.expectedAfter,
    expectedLoss: move.expectedLoss,
    expectedPointsLoss: move.expectedPointsLoss,
    centipawnLoss: move.centipawnLoss,
    bestExpectedAfter: move.bestExpectedAfter,
    playedExpectedAfter: move.playedExpectedAfter,
    missLoss: move.missLoss,
    isBook: move.isBook,
    isOnlyMove: move.isOnlyMove,
    isSacrifice: move.isSacrifice,
    isCritical: move.isCritical,
    reasonTags: move.reasonTags,
  };
};

const toPublicAnalyzedMove = (move: AnalyzedMove): PublicAnalyzedMove => {
  return {
    ply: move.ply,
    moveNumber: move.moveNumber,
    color: move.color,
    san: move.san,
    uci: move.uci,
    fenBefore: move.fenBefore,
    fenAfter: move.fenAfter,
    evalBefore: move.evalBefore,
    evalAfter: move.evalAfter,
    evalLoss: move.evalLoss,
    expectedBefore: move.expectedBefore,
    expectedAfter: move.expectedAfter,
    expectedLoss: move.expectedLoss,
    expectedPointsLoss: move.expectedPointsLoss,
    centipawnLoss: move.centipawnLoss,
    bestExpectedAfter: move.bestExpectedAfter,
    playedExpectedAfter: move.playedExpectedAfter,
    missLoss: move.missLoss,
    isBook: move.isBook,
    isOnlyMove: move.isOnlyMove,
    isSacrifice: move.isSacrifice,
    isCritical: move.isCritical,
    bestMove: move.bestMove,
    classification: move.classification,
    moveAccuracy: move.moveAccuracy,
    shouldAnnotate: move.shouldAnnotate,
    comment: move.comment,
    reasonTags: move.reasonTags,
    classificationDebug: move.classificationDebug,
    pv: move.pv,
  };
};

type AnalyzeParsedGameOptions = {
  fastMovetimeMs: number;
  deepMovetimeMs: number;
  deepDepth: number;
  maxDeepAnalysisPerGame: number;
  maxPvMoves: number;
  ignoreErrorsBeforeMove: number;
  maxBookMovesPerSide: number;
  maxGreatMovesPerSide: number;
  enableMoveClassifications: boolean;
  enableAccuracy: boolean;
  enableClassificationDebug: boolean;
};

const applyFinalClassifications = (
  game: ParsedGame,
  moves: AnalyzedMove[],
  options: AnalyzeParsedGameOptions,
): AnalyzedMove[] => {
  const bookMovesUsed: Record<'white' | 'black', number> = {
    white: 0,
    black: 0,
  };
  const greatMovesUsed: Record<'white' | 'black', number> = {
    white: 0,
    black: 0,
  };
  let hasPriorProblematicMove = false;
  let previousMoveWasProblematic = false;
  const effectiveBookMoveCap = getEffectiveBookMoveCap(
    game,
    options.maxBookMovesPerSide,
    options.ignoreErrorsBeforeMove,
  );

  return moves.map((move, index) => {
    const classification = classifyMove({
      moveNumber: move.moveNumber,
      color: move.color,
      playedMoveUci: move.uci,
      bestMoveUci: move.bestMoveUci,
      bestMoveSan: move.bestMove,
      before: move.normalizedBefore,
      after: move.normalizedAfter,
      candidateEvaluations: move.before
        ? buildCandidateEvaluations(move.before, move.fenBefore, move.color)
        : undefined,
      ignoreErrorsBeforeMove: options.ignoreErrorsBeforeMove,
      isBookMove: isLikelyBookMove(game, index, move.moveNumber, options.ignoreErrorsBeforeMove),
      phase: move.phase,
      fenBefore: move.fenBefore,
      fenAfter: move.fenAfter,
      materialDelta: getMaterialDeltaForMove(move.fenBefore, move.fenAfter, move.color),
      sacrificeSignal: move.sacrificeSignal,
      enableMoveClassifications: options.enableMoveClassifications,
      enableClassificationDebug: options.enableClassificationDebug,
      bookMovesUsedBySide: bookMovesUsed[move.color],
      maxBookMovesPerSide: effectiveBookMoveCap,
      greatMovesUsedBySide: greatMovesUsed[move.color],
      maxGreatMovesPerSide: options.maxGreatMovesPerSide,
      hasPriorProblematicMove,
      previousMoveWasProblematic,
    });

    if (classification.classification === 'book') {
      bookMovesUsed[move.color] += 1;
    }

    if (classification.classification === 'great') {
      greatMovesUsed[move.color] += 1;
    }

    const isProblematic = isProblematicClassification(classification.classification);
    hasPriorProblematicMove = hasPriorProblematicMove || isProblematic;
    previousMoveWasProblematic = isProblematic;

    return {
      ...move,
      classification: classification.classification,
      symbol: classification.symbol,
      evalLoss: classification.evalLoss,
      expectedBefore: classification.expectedBefore,
      expectedAfter: classification.expectedAfter,
      expectedLoss: classification.expectedLoss,
      expectedPointsLoss: classification.expectedPointsLoss,
      centipawnLoss: classification.centipawnLoss,
      bestExpectedAfter: classification.bestExpectedAfter,
      playedExpectedAfter: classification.playedExpectedAfter,
      missLoss: classification.missLoss,
      isBook: classification.isBook,
      isOnlyMove: classification.isOnlyMove,
      isSacrifice: classification.isSacrifice,
      isCritical: classification.isCritical,
      comment: classification.comment,
      reasonTags: classification.reasonTags,
      shouldAnnotate: classification.shouldAnnotate,
      classificationDebug: classification.classificationDebug,
    };
  });
};

export const analyzeParsedGame = async (
  game: ParsedGame,
  stockfish: StockfishClient,
  options: AnalyzeParsedGameOptions,
): Promise<GameAnalysisResult> => {
  const totalStartedAt = Date.now();
  const analyzedMoves: AnalyzedMove[] = [];
  const cacheMetricsBefore = stockfish.getCacheMetrics();
  const fastStartedAt = Date.now();
  const effectiveBookMoveCap = getEffectiveBookMoveCap(
    game,
    options.maxBookMovesPerSide,
    options.ignoreErrorsBeforeMove,
  );
  let currentPositionAnalysis = createNeutralAnalysis();
  let currentNormalizedEvaluation = createNeutralEvaluation();

  if (game.moves.length > 0) {
    currentPositionAnalysis = await stockfish.analyzePositionLight(
      game.moves[0].fenBefore,
      options.fastMovetimeMs,
    );
    currentNormalizedEvaluation = normalizeEvaluation(
      currentPositionAnalysis,
      game.moves[0].fenBefore,
    );
  }

  for (const [index, move] of game.moves.entries()) {
    const after = await stockfish.analyzePositionLight(move.fenAfter, options.fastMovetimeMs);
    const normalizedBefore = currentNormalizedEvaluation;
    const normalizedAfter = normalizeEvaluation(after, move.fenAfter);
    const bestMoveSan = toSanFromUci(move.fenBefore, currentPositionAnalysis.bestMove);
    const phase = getMovePhase(move.moveNumber);
    const materialDelta = getMaterialDeltaForMove(move.fenBefore, move.fenAfter, move.color);
    const candidateEvaluations = buildCandidateEvaluations(
      currentPositionAnalysis,
      move.fenBefore,
      move.color,
    );
    const sacrificeSignal = await analyzeSacrificeSignalForMove({
      move,
      previousMoveUci: index > 0 ? game.moves[index - 1].uci : undefined,
      fenTwoMovesAgo: index > 0 ? game.moves[index - 1].fenBefore : undefined,
      normalizedBefore,
      normalizedAfter,
      bestMoveUci: currentPositionAnalysis.bestMove,
      candidateEvaluations,
      materialDelta,
      stockfish,
      movetimeMs: options.fastMovetimeMs,
    });
    const classification = classifyMove({
      moveNumber: move.moveNumber,
      color: move.color,
      playedMoveUci: move.uci,
      bestMoveUci: currentPositionAnalysis.bestMove,
      bestMoveSan,
      before: normalizedBefore,
      after: normalizedAfter,
      candidateEvaluations,
      ignoreErrorsBeforeMove: options.ignoreErrorsBeforeMove,
      isBookMove: isLikelyBookMove(game, index, move.moveNumber, options.ignoreErrorsBeforeMove),
      phase,
      fenBefore: move.fenBefore,
      fenAfter: move.fenAfter,
      materialDelta,
      sacrificeSignal,
      enableMoveClassifications: options.enableMoveClassifications,
      enableClassificationDebug: options.enableClassificationDebug,
      maxBookMovesPerSide: effectiveBookMoveCap,
    });

    analyzedMoves.push({
      ...move,
      before: currentPositionAnalysis,
      after,
      normalizedBefore,
      normalizedAfter,
      evalBefore: formatEvalForStructuredOutput(normalizedBefore),
      evalAfter: formatEvalForStructuredOutput(normalizedAfter),
      bestMove: bestMoveSan,
      bestMoveUci: currentPositionAnalysis.bestMove,
      classification: classification.classification,
      symbol: classification.symbol,
      evalLoss: classification.evalLoss,
      expectedBefore: classification.expectedBefore,
      expectedAfter: classification.expectedAfter,
      expectedLoss: classification.expectedLoss,
      expectedPointsLoss: classification.expectedPointsLoss,
      centipawnLoss: classification.centipawnLoss,
      bestExpectedAfter: classification.bestExpectedAfter,
      playedExpectedAfter: classification.playedExpectedAfter,
      missLoss: classification.missLoss,
      isBook: classification.isBook,
      isOnlyMove: classification.isOnlyMove,
      isSacrifice: classification.isSacrifice,
      isCritical: classification.isCritical,
      sacrificeSignal,
      moveAccuracy: 0,
      phase,
      comment: classification.comment,
      reasonTags: classification.reasonTags,
      shouldAnnotate: classification.shouldAnnotate,
      classificationDebug: classification.classificationDebug,
      pv: [],
      shouldIncludePv: false,
    });

    currentPositionAnalysis = after;
    currentNormalizedEvaluation = normalizedAfter;
  }

  const fastPhaseTimeMs = Date.now() - fastStartedAt;
  const deepStartedAt = Date.now();
  const pvCandidateIndexes = analyzedMoves
    .map((move, index) => ({ index, move }))
    .filter(({ move }) => move.shouldAnnotate && shouldConsiderForPv(move))
    .sort((a, b) => getSeverityScore(b.move) - getSeverityScore(a.move))
    .slice(0, options.maxDeepAnalysisPerGame)
    .map(({ index }) => index);
  const pvCandidateIndexSet = new Set(pvCandidateIndexes);
  let deepAnalysesRun = 0;

  for (const [index, move] of analyzedMoves.entries()) {
    if (!pvCandidateIndexSet.has(index)) {
      continue;
    }

    const before = await stockfish.analyzePositionDeep({
      fen: move.fenBefore,
      depth: options.deepDepth,
      movetimeMs: options.deepMovetimeMs,
      includePv: true,
    });
    deepAnalysesRun += 1;

    const normalizedBefore = normalizeEvaluation(before, move.fenBefore);
    const bestMoveSan = toSanFromUci(move.fenBefore, before.bestMove);
    const classification = classifyMove({
      moveNumber: move.moveNumber,
      color: move.color,
      playedMoveUci: move.uci,
      bestMoveUci: before.bestMove,
      bestMoveSan,
      before: normalizedBefore,
      after: move.normalizedAfter,
      candidateEvaluations: buildCandidateEvaluations(before, move.fenBefore, move.color),
      ignoreErrorsBeforeMove: options.ignoreErrorsBeforeMove,
      isBookMove: isLikelyBookMove(game, index, move.moveNumber, options.ignoreErrorsBeforeMove),
      phase: move.phase,
      fenBefore: move.fenBefore,
      fenAfter: move.fenAfter,
      materialDelta: getMaterialDeltaForMove(move.fenBefore, move.fenAfter, move.color),
      enableMoveClassifications: options.enableMoveClassifications,
      enableClassificationDebug: options.enableClassificationDebug,
      maxBookMovesPerSide: effectiveBookMoveCap,
    });
    const pv = classification.shouldAnnotate
      ? toSanVariationFromUci(move.fenBefore, before.pv, options.maxPvMoves)
      : [];

    analyzedMoves[index] = {
      ...move,
      before,
      normalizedBefore,
      evalBefore: formatEvalForStructuredOutput(normalizedBefore),
      bestMove: bestMoveSan,
      bestMoveUci: before.bestMove,
      classification: classification.classification,
      symbol: classification.symbol,
      evalLoss: classification.evalLoss,
      expectedBefore: classification.expectedBefore,
      expectedAfter: classification.expectedAfter,
      expectedLoss: classification.expectedLoss,
      expectedPointsLoss: classification.expectedPointsLoss,
      centipawnLoss: classification.centipawnLoss,
      bestExpectedAfter: classification.bestExpectedAfter,
      playedExpectedAfter: classification.playedExpectedAfter,
      missLoss: classification.missLoss,
      isBook: classification.isBook,
      isOnlyMove: classification.isOnlyMove,
      isSacrifice: classification.isSacrifice,
      isCritical: classification.isCritical,
      comment: classification.comment,
      reasonTags: classification.reasonTags,
      shouldAnnotate: classification.shouldAnnotate,
      classificationDebug: classification.classificationDebug,
      pv,
      shouldIncludePv: classification.shouldAnnotate && pv.length > 0,
    };
  }

  const deepPhaseTimeMs = Date.now() - deepStartedAt;
  const finalizedMoves = applyFinalClassifications(game, analyzedMoves, options);
  const accuracyResult = options.enableAccuracy
    ? calculateAccuracyByColor(finalizedMoves)
    : {
        accuracy: {
          white: 0,
          black: 0,
        } as AccuracyByColor,
        accuracyDetails: createEmptyAccuracyDetails(),
        moves: finalizedMoves,
      };
  const movesWithAccuracy = accuracyResult.moves;
  const criticalMoments = movesWithAccuracy
    .filter((move) => move.shouldAnnotate)
    .map(toCriticalMoment);
  const moveClassificationSummary = buildMoveClassificationSummary(movesWithAccuracy);
  const moveClassifications = movesWithAccuracy.map(toMoveClassificationItem);
  const cacheMetricsAfter = stockfish.getCacheMetrics();
  const metrics: GameAnalysisMetrics = {
    totalTimeMs: Date.now() - totalStartedAt,
    fastPhaseTimeMs,
    deepPhaseTimeMs,
    positionsAnalyzed: cacheMetricsAfter.positionsAnalyzed - cacheMetricsBefore.positionsAnalyzed,
    deepAnalysesRun,
    skippedDeepAnalyses: Math.max(
      0,
      finalizedMoves.filter((move) => move.shouldAnnotate && shouldConsiderForPv(move)).length -
        deepAnalysesRun,
    ),
    cacheHits: cacheMetricsAfter.cacheHits - cacheMetricsBefore.cacheHits,
    criticalMoments: criticalMoments.length,
  };

  return {
    analysis: {
      gameId: game.id,
      annotatedPgn: buildAnnotatedPgn(game, movesWithAccuracy),
      accuracy: accuracyResult.accuracy,
      accuracyDetails: accuracyResult.accuracyDetails,
      moveClassificationSummary,
      classificationDebugSummary: options.enableClassificationDebug
        ? moveClassificationSummary
        : undefined,
      moveClassifications,
      criticalMoments,
      analyzedMoves: movesWithAccuracy.map(toPublicAnalyzedMove),
    },
    metrics,
  };
};
