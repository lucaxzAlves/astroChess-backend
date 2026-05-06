import { calculateAccuracyByColor } from './accuracy-calculator';
import { StockfishClient } from '../engine/stockfish.client';
import { StockfishAnalysis } from '../engine/stockfish.types';
import {
  classifyMove,
  getMaterialDeltaForMove,
  getMovePhase,
  isProblematicClassification,
  isMoveClassificationSummaryKey,
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
    bestMove: move.bestMove,
    classification: move.classification,
    moveAccuracy: move.moveAccuracy,
    shouldAnnotate: move.shouldAnnotate,
    comment: move.comment,
    reasonTags: move.reasonTags,
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

  return moves.map((move) => {
    const classification = classifyMove({
      moveNumber: move.moveNumber,
      color: move.color,
      playedMoveUci: move.uci,
      bestMoveUci: move.bestMoveUci,
      bestMoveSan: move.bestMove,
      before: move.normalizedBefore,
      after: move.normalizedAfter,
      ignoreErrorsBeforeMove: options.ignoreErrorsBeforeMove,
      isBookMove: move.moveNumber <= 6,
      phase: move.phase,
      materialDelta: getMaterialDeltaForMove(move.fenBefore, move.fenAfter, move.color),
      enableMoveClassifications: options.enableMoveClassifications,
      enableClassificationDebug: options.enableClassificationDebug,
      bookMovesUsedBySide: bookMovesUsed[move.color],
      maxBookMovesPerSide: options.maxBookMovesPerSide,
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

  for (const move of game.moves) {
    const after = await stockfish.analyzePositionLight(move.fenAfter, options.fastMovetimeMs);
    const normalizedBefore = currentNormalizedEvaluation;
    const normalizedAfter = normalizeEvaluation(after, move.fenAfter);
    const bestMoveSan = toSanFromUci(move.fenBefore, currentPositionAnalysis.bestMove);
    const phase = getMovePhase(move.moveNumber);
    const materialDelta = getMaterialDeltaForMove(move.fenBefore, move.fenAfter, move.color);
    const classification = classifyMove({
      moveNumber: move.moveNumber,
      color: move.color,
      playedMoveUci: move.uci,
      bestMoveUci: currentPositionAnalysis.bestMove,
      bestMoveSan,
      before: normalizedBefore,
      after: normalizedAfter,
      ignoreErrorsBeforeMove: options.ignoreErrorsBeforeMove,
      phase,
      materialDelta,
      enableMoveClassifications: options.enableMoveClassifications,
      enableClassificationDebug: options.enableClassificationDebug,
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
      ignoreErrorsBeforeMove: options.ignoreErrorsBeforeMove,
      phase: move.phase,
      materialDelta: getMaterialDeltaForMove(move.fenBefore, move.fenAfter, move.color),
      enableMoveClassifications: options.enableMoveClassifications,
      enableClassificationDebug: options.enableClassificationDebug,
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
      comment: classification.comment,
      reasonTags: classification.reasonTags,
      shouldAnnotate: classification.shouldAnnotate,
      classificationDebug: classification.classificationDebug,
      pv,
      shouldIncludePv: classification.shouldAnnotate && pv.length > 0,
    };
  }

  const deepPhaseTimeMs = Date.now() - deepStartedAt;
  const finalizedMoves = applyFinalClassifications(analyzedMoves, options);
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
      moveClassifications,
      criticalMoments,
      analyzedMoves: movesWithAccuracy.map(toPublicAnalyzedMove),
    },
    metrics,
  };
};
