import { Chess, type Square } from 'chess.js';

import {
  ClassificationDebug,
  GamePhase,
  MoveAnnotationSymbol,
  MoveClassification,
  MoveClassificationResult,
  NormalizedEvaluation,
  PlayerColor,
  PositionContext,
  SacrificeSignal,
} from './chess.types';

export const MOVE_CLASSIFICATION_LABELS: Record<MoveClassification, string> = {
  brilliant: 'Brilliant',
  great: 'Great',
  best: 'Best',
  excellent: 'Excellent',
  good: 'Good',
  book: 'Book',
  inaccuracy: 'Inaccuracy',
  mistake: 'Mistake',
  miss: 'Miss',
  blunder: 'Blunder',
  unknown: 'Unknown',
};

type ClassifyMoveInput = {
  moveNumber: number;
  color: PlayerColor;
  playedMoveUci: string;
  bestMoveUci?: string;
  bestMoveSan?: string;
  before: NormalizedEvaluation;
  after: NormalizedEvaluation;
  candidateEvaluations?: Array<{
    moveUci: string;
    expectedPoints: number;
  }>;
  ignoreErrorsBeforeMove: number;
  isBookMove?: boolean;
  phase?: GamePhase;
  fenBefore?: string;
  fenAfter?: string;
  materialDelta?: number;
  sacrificeSignal?: SacrificeSignal;
  enableMoveClassifications?: boolean;
  enableClassificationDebug?: boolean;
  bookMovesUsedBySide?: number;
  maxBookMovesPerSide?: number;
  greatMovesUsedBySide?: number;
  maxGreatMovesPerSide?: number;
  hasPriorProblematicMove?: boolean;
  previousMoveWasProblematic?: boolean;
};

const EXPECTED_POINTS_THRESHOLDS = {
  best: 0.002,
  excellent: 0.02,
  good: 0.05,
  inaccuracy: 0.1,
  mistake: 0.2,
} as const;

const EXPECTED_POINTS_DEBUG_THRESHOLDS = {
  ...EXPECTED_POINTS_THRESHOLDS,
  blunder: EXPECTED_POINTS_THRESHOLDS.mistake,
};

const EXCELLENT_MAX_EXPECTED_LOSS = 0.008;
const EXCELLENT_MAX_CENTIPAWN_LOSS = 15;
const GREAT_MAX_EXPECTED_LOSS = 0.04;
const GREAT_MAX_CENTIPAWN_LOSS = 80;

const PIECE_VALUES: Record<string, number> = {
  p: 1,
  n: 3,
  b: 3,
  r: 5,
  q: 9,
  k: 0,
};

const formatBestMoveSuffix = (bestMoveSan?: string): string => {
  return bestMoveSan ? ` ${bestMoveSan} was best.` : '';
};

const formatComment = (classification: MoveClassification, bestMoveSan?: string): string => {
  return `${MOVE_CLASSIFICATION_LABELS[classification]}.${formatBestMoveSuffix(bestMoveSan)}`.trim();
};

export const evaluationFromPlayerPerspective = (
  evaluation: NormalizedEvaluation,
  color: PlayerColor,
): number => {
  return color === 'white' ? evaluation.evaluation : -evaluation.evaluation;
};

export const cpToWinPercent = (cp: number): number => {
  return 50 + 50 * (2 / (1 + Math.exp(-0.00368208 * cp)) - 1);
};

export const cpToExpectedPointsForColor = (
  cpWhitePerspective: number,
  color: PlayerColor,
): number => {
  const whiteWinPercent = cpToWinPercent(cpWhitePerspective);
  const whiteExpectedPoints = whiteWinPercent / 100;

  return color === 'white' ? whiteExpectedPoints : 1 - whiteExpectedPoints;
};

export const evaluationToExpectedPointsForColor = (
  evaluation: NormalizedEvaluation,
  color: PlayerColor,
): number => {
  if (evaluation.evaluationType === 'mate') {
    const mateForWhite = evaluation.evaluation > 0;
    return (color === 'white' && mateForWhite) || (color === 'black' && !mateForWhite) ? 1 : 0;
  }

  return cpToExpectedPointsForColor(evaluation.evaluation, color);
};

export const normalizedEvaluationToPawns = (evaluation: NormalizedEvaluation): number => {
  if (evaluation.evaluationType === 'mate') {
    return evaluation.evaluation > 0 ? 12 : -12;
  }

  return evaluation.evaluation / 100;
};

export const getMovePhase = (moveNumber: number): GamePhase => {
  if (moveNumber <= 10) {
    return 'opening';
  }

  if (moveNumber <= 30) {
    return 'middlegame';
  }

  return 'endgame';
};

export const getPositionContext = (playerEvalBefore: number): PositionContext => {
  if (playerEvalBefore >= 3) {
    return 'winning';
  }

  if (playerEvalBefore >= 1) {
    return 'better';
  }

  if (playerEvalBefore > -1) {
    return 'equal';
  }

  if (playerEvalBefore > -3) {
    return 'worse';
  }

  return 'lost';
};

export const getMaterialBalanceForColor = (fen: string, color: PlayerColor): number => {
  const board = fen.split(' ')[0];
  let score = 0;

  for (const char of board) {
    if (char === '/' || /\d/.test(char)) {
      continue;
    }

    const value = PIECE_VALUES[char.toLowerCase()] ?? 0;
    const isWhitePiece = char === char.toUpperCase();

    if ((color === 'white' && isWhitePiece) || (color === 'black' && !isWhitePiece)) {
      score += value;
    }
  }

  return score;
};

export const getMaterialDeltaForMove = (
  fenBefore: string,
  fenAfter: string,
  color: PlayerColor,
): number => {
  return getMaterialBalanceForColor(fenAfter, color) - getMaterialBalanceForColor(fenBefore, color);
};

const parseUciMove = (uci: string): { from: Square; to: Square; promotion?: string } | null => {
  if (!/^[a-h][1-8][a-h][1-8][qrbn]?$/.test(uci)) {
    return null;
  }

  const from = uci.slice(0, 2) as Square;
  const to = uci.slice(2, 4) as Square;
  const promotion = uci.length > 4 ? uci[4] : undefined;

  return { from, to, promotion };
};

const inferSacrificeSignalFromMoveContext = ({
  fenBefore,
  fenAfter,
  playedMoveUci,
  color,
  materialDelta,
}: {
  fenBefore?: string;
  fenAfter?: string;
  playedMoveUci: string;
  color: PlayerColor;
  materialDelta: number;
}): SacrificeSignal => {
  const acceptedSacrifice = materialDelta <= -2;
  const defaultSignal: SacrificeSignal = {
    offeredPieceValue: 0,
    gainedPieceValue: 0,
    netOfferValue: 0,
    captureAvailable: false,
    captureMove: null,
    captureEval: null,
    currentEval: 0,
    acceptedSacrifice,
    offeredSacrifice: false,
  };

  if (!fenBefore || !fenAfter) {
    return defaultSignal;
  }

  const parsedMove = parseUciMove(playedMoveUci);

  if (!parsedMove) {
    return defaultSignal;
  }

  try {
    const beforeBoard = new Chess(fenBefore);
    const movedPiece = beforeBoard.get(parsedMove.from);

    if (!movedPiece || movedPiece.color !== color[0]) {
      return defaultSignal;
    }

    const movedPieceValue = PIECE_VALUES[movedPiece.type] ?? 0;

    if (movedPieceValue < 3) {
      return defaultSignal;
    }

    const capturedPieceBeforeMove = beforeBoard.get(parsedMove.to);
    const capturedPieceValue = capturedPieceBeforeMove
      ? (PIECE_VALUES[capturedPieceBeforeMove.type] ?? 0)
      : 0;

    const afterBoard = new Chess(fenAfter);
    const pieceOnDestination = afterBoard.get(parsedMove.to);

    if (!pieceOnDestination || pieceOnDestination.color !== color[0]) {
      return defaultSignal;
    }

    const directRecaptures = afterBoard
      .moves({ verbose: true })
      .filter((move) => move.to === parsedMove.to && typeof move.captured === 'string');

    return {
      ...defaultSignal,
      offeredPieceValue: movedPieceValue,
      gainedPieceValue: capturedPieceValue,
      netOfferValue: movedPieceValue - capturedPieceValue,
      captureAvailable: directRecaptures.length > 0,
      captureMove: directRecaptures[0]?.lan ?? directRecaptures[0]?.san ?? null,
      offeredSacrifice: false,
    };
  } catch {
    return defaultSignal;
  }
};

const createDebugPayload = (
  enabled: boolean,
  payload: ClassificationDebug,
): ClassificationDebug | undefined => {
  return enabled ? payload : undefined;
};

const createResult = (
  classification: MoveClassification,
  symbol: MoveAnnotationSymbol,
  evalLoss: number | null,
  expectedBefore: number,
  expectedAfter: number,
  expectedPointsLoss: number,
  centipawnLoss: number | null,
  flags: {
    isBook: boolean;
    isOnlyMove: boolean;
    isSacrifice: boolean;
    isCritical: boolean;
  },
  bestMoveSan: string | undefined,
  shouldAnnotate: boolean,
  reasonTags: string[],
  commentOverride?: string,
  classificationDebug?: ClassificationDebug,
  expectedContext?: {
    bestExpectedAfter: number;
    playedExpectedAfter: number;
    missLoss: number;
  },
): MoveClassificationResult => {
  const playedExpectedAfter = expectedContext?.playedExpectedAfter ?? expectedAfter;
  const bestExpectedAfter = expectedContext?.bestExpectedAfter ?? expectedBefore;
  const missLoss =
    expectedContext?.missLoss ??
    Math.max(0, Number((bestExpectedAfter - playedExpectedAfter).toFixed(4)));

  return {
    classification,
    symbol,
    evalLoss,
    expectedBefore,
    expectedAfter,
    expectedLoss: expectedPointsLoss,
    expectedPointsLoss,
    centipawnLoss,
    bestExpectedAfter,
    playedExpectedAfter,
    missLoss,
    isBook: flags.isBook,
    isOnlyMove: flags.isOnlyMove,
    isSacrifice: flags.isSacrifice,
    isCritical: flags.isCritical,
    comment: shouldAnnotate
      ? (commentOverride ?? formatComment(classification, bestMoveSan))
      : (commentOverride ?? ''),
    reasonTags,
    shouldAnnotate,
    classificationDebug,
  };
};

const getBaseClassificationForExpectedLoss = (
  expectedPointsLoss: number,
  isBestLikeMove: boolean,
): MoveClassification => {
  if (expectedPointsLoss > EXPECTED_POINTS_THRESHOLDS.mistake) {
    return 'blunder';
  }

  if (expectedPointsLoss > EXPECTED_POINTS_THRESHOLDS.inaccuracy) {
    return 'mistake';
  }

  if (expectedPointsLoss > EXPECTED_POINTS_THRESHOLDS.good) {
    return 'inaccuracy';
  }

  return isBestLikeMove ? 'best' : 'good';
};

const getHasOutcomeSwing = (expectedBefore: number, expectedAfter: number): boolean => {
  return expectedAfter - expectedBefore >= 0.1 && expectedBefore < 0.5 && expectedAfter > 0.5;
};

const isClearlyDecidedPosition = (expectedPoints: number): boolean => {
  return expectedPoints >= 0.9 || expectedPoints <= 0.1;
};

export const classifyMove = ({
  moveNumber,
  color,
  playedMoveUci,
  bestMoveUci,
  bestMoveSan,
  before,
  after,
  candidateEvaluations = [],
  ignoreErrorsBeforeMove,
  isBookMove = false,
  phase = getMovePhase(moveNumber),
  fenBefore,
  fenAfter,
  materialDelta = 0,
  sacrificeSignal,
  enableMoveClassifications = true,
  enableClassificationDebug = false,
  bookMovesUsedBySide = 0,
  maxBookMovesPerSide = 3,
  greatMovesUsedBySide = 0,
  maxGreatMovesPerSide = 5,
  hasPriorProblematicMove = false,
  previousMoveWasProblematic = false,
}: ClassifyMoveInput): MoveClassificationResult => {
  const bestPlayerEval = normalizedEvaluationToPawns({
    evaluation: evaluationFromPlayerPerspective(before, color),
    evaluationType: before.evaluationType,
  });
  const playedPlayerEval = normalizedEvaluationToPawns({
    evaluation: evaluationFromPlayerPerspective(after, color),
    evaluationType: after.evaluationType,
  });
  const expectedBefore = Number(evaluationToExpectedPointsForColor(before, color).toFixed(4));
  const expectedAfter = Number(evaluationToExpectedPointsForColor(after, color).toFixed(4));
  const expectedPointsLoss = Math.max(0, Number((expectedBefore - expectedAfter).toFixed(4)));
  const centipawnLoss =
    before.evaluationType === 'cp' && after.evaluationType === 'cp'
      ? Math.max(
          0,
          Math.round(
            evaluationFromPlayerPerspective(before, color) -
              evaluationFromPlayerPerspective(after, color),
          ),
        )
      : null;
  const evalLoss =
    centipawnLoss === null
      ? null
      : Number((Math.max(0, centipawnLoss) / 100).toFixed(2));
  const missedGain = Number((expectedBefore - expectedAfter).toFixed(4));
  const isBestMove = Boolean(bestMoveUci) && playedMoveUci === bestMoveUci;
  const isBestLikeMove = isBestMove || (!bestMoveUci && expectedPointsLoss <= EXPECTED_POINTS_THRESHOLDS.best);
  const positionContext = getPositionContext(bestPlayerEval);
  const sortedCandidates = [...candidateEvaluations].sort(
    (left, right) => right.expectedPoints - left.expectedPoints,
  );
  const hasCandidateData = sortedCandidates.length > 0;
  const bestCandidateExpected = sortedCandidates[0]?.expectedPoints ?? expectedBefore;
  const secondCandidateExpected = sortedCandidates[1]?.expectedPoints;
  const playedExpectedAfter = expectedAfter;
  const bestExpectedAfter = Number(bestCandidateExpected.toFixed(4));
  const missLoss = Math.max(0, Number((bestExpectedAfter - playedExpectedAfter).toFixed(4)));
  const alternativeExpected =
    sortedCandidates.length === 0
      ? undefined
      : sortedCandidates[0]?.moveUci === playedMoveUci
        ? sortedCandidates[1]?.expectedPoints
        : sortedCandidates[0]?.expectedPoints;
  const bestToSecondGap =
    secondCandidateExpected === undefined
      ? 0
      : Number((bestCandidateExpected - secondCandidateExpected).toFixed(4));
  const candidatesCloseToBest = sortedCandidates.filter(
    (candidate) => bestCandidateExpected - candidate.expectedPoints <= 0.04,
  ).length;
  const isOnlyMove =
    sortedCandidates.length >= 2 &&
    bestCandidateExpected >= 0.35 &&
    (bestToSecondGap >= 0.1 || candidatesCloseToBest <= 1);
  const resolvedSacrificeSignal =
    sacrificeSignal ??
    inferSacrificeSignalFromMoveContext({
      fenBefore,
      fenAfter,
      playedMoveUci,
      color,
      materialDelta,
    });
  const isSacrifice =
    resolvedSacrificeSignal.acceptedSacrifice || resolvedSacrificeSignal.offeredSacrifice;
  const baseClassification = getBaseClassificationForExpectedLoss(
    expectedPointsLoss,
    isBestLikeMove,
  );
  const hasOutcomeSwing = getHasOutcomeSwing(expectedBefore, bestExpectedAfter);
  const isDecidedBefore = isClearlyDecidedPosition(expectedBefore);
  const isDecidedAfter = isClearlyDecidedPosition(bestExpectedAfter);
  const followsOpponentSlip = previousMoveWasProblematic && bestExpectedAfter - expectedBefore >= 0.12;
  const isTacticallyDemanding =
    isOnlyMove || hasOutcomeSwing || followsOpponentSlip || bestToSecondGap >= 0.08;
  const isCritical =
    baseClassification === 'inaccuracy' ||
    baseClassification === 'mistake' ||
    baseClassification === 'blunder' ||
    isOnlyMove ||
    hasOutcomeSwing ||
    before.evaluationType === 'mate' ||
    after.evaluationType === 'mate';
  const baseFlags = {
    isBook: false,
    isOnlyMove,
    isSacrifice,
    isCritical,
  };
  const reasonTags: string[] = phase !== 'unknown' ? [phase] : [];
  const expectedContext = {
    bestExpectedAfter,
    playedExpectedAfter,
    missLoss,
  };
  const debugBase = {
    playerEvalBefore: bestPlayerEval,
    bestPlayerEval,
    playedPlayerEval,
    evalLoss,
    expectedBefore,
    expectedAfter,
    expectedLoss: expectedPointsLoss,
    expectedPointsLoss,
    centipawnLoss,
    bestExpectedAfter,
    playedExpectedAfter,
    missLoss,
    missedGain,
    positionContext,
    thresholdsUsed: EXPECTED_POINTS_DEBUG_THRESHOLDS,
  };
  const createMoveResult = (
    classification: MoveClassification,
    symbol: MoveAnnotationSymbol,
    resultEvalLoss: number | null,
    resultExpectedBefore: number,
    resultExpectedAfter: number,
    resultExpectedPointsLoss: number,
    resultCentipawnLoss: number | null,
    flags: {
      isBook: boolean;
      isOnlyMove: boolean;
      isSacrifice: boolean;
      isCritical: boolean;
    },
    resultBestMoveSan: string | undefined,
    shouldAnnotate: boolean,
    resultReasonTags: string[],
    commentOverride?: string,
    classificationDebug?: ClassificationDebug,
  ): MoveClassificationResult => {
    return createResult(
      classification,
      symbol,
      resultEvalLoss,
      resultExpectedBefore,
      resultExpectedAfter,
      resultExpectedPointsLoss,
      resultCentipawnLoss,
      flags,
      resultBestMoveSan,
      shouldAnnotate,
      resultReasonTags,
      commentOverride,
      classificationDebug,
      expectedContext,
    );
  };

  if (!enableMoveClassifications) {
    return createMoveResult(
      'unknown',
      '',
      evalLoss,
      expectedBefore,
      expectedAfter,
      expectedPointsLoss,
      centipawnLoss,
      baseFlags,
      bestMoveSan,
      false,
      reasonTags,
      undefined,
      createDebugPayload(enableClassificationDebug, {
        ...debugBase,
        reason: 'move_classifications_disabled',
      }),
    );
  }

  if (before.evaluationType === 'mate' && evaluationFromPlayerPerspective(before, color) > 0) {
    if (playedMoveUci !== bestMoveUci) {
      const mateLost =
        after.evaluationType !== 'mate' || evaluationFromPlayerPerspective(after, color) <= 0;

      return createMoveResult(
        mateLost ? 'blunder' : 'miss',
        mateLost ? '??' : '?',
        null,
        expectedBefore,
        expectedAfter,
        expectedPointsLoss,
        centipawnLoss,
        { ...baseFlags, isCritical: true },
        bestMoveSan,
        true,
        [...reasonTags, mateLost ? 'lost_forced_mate' : 'missed_forced_mate'],
        `${mateLost ? 'Lost' : 'Missed'} forced checkmate sequence.${formatBestMoveSuffix(bestMoveSan)}`.trim(),
        createDebugPayload(enableClassificationDebug, {
          ...debugBase,
          evalLoss: null,
          reason: mateLost ? 'lost_forced_mate' : 'missed_forced_mate',
        }),
      );
    }
  }

  if (after.evaluationType === 'mate' && evaluationFromPlayerPerspective(after, color) < 0) {
    return createMoveResult(
      'blunder',
      '??',
      null,
      expectedBefore,
      expectedAfter,
      expectedPointsLoss,
      centipawnLoss,
      { ...baseFlags, isCritical: true },
      bestMoveSan,
      true,
      [...reasonTags, 'allowed_forced_mate'],
      `Allowed forced checkmate sequence.${formatBestMoveSuffix(bestMoveSan)}`.trim(),
      createDebugPayload(enableClassificationDebug, {
        ...debugBase,
        evalLoss: null,
        reason: 'allowed_forced_mate',
      }),
    );
  }

  const canBeBook =
    isBookMove &&
    moveNumber <= ignoreErrorsBeforeMove &&
    isBestLikeMove &&
    expectedPointsLoss <= 0.015 &&
    !hasPriorProblematicMove &&
    bookMovesUsedBySide < maxBookMovesPerSide;

  if (canBeBook) {
    return createMoveResult(
      'book',
      '',
      evalLoss,
      expectedBefore,
      expectedAfter,
      expectedPointsLoss,
      centipawnLoss,
      { ...baseFlags, isBook: true, isCritical: false },
      bestMoveSan,
      false,
      [...reasonTags, 'book_move'],
      undefined,
      createDebugPayload(enableClassificationDebug, {
        ...debugBase,
        reason: 'book_move',
      }),
    );
  }

  const isStrongMiss =
    !isBestLikeMove &&
    hasCandidateData &&
    missLoss >= 0.1 &&
    !isDecidedBefore &&
    !isDecidedAfter &&
    (isOnlyMove || hasOutcomeSwing || followsOpponentSlip);

  if (isStrongMiss) {
    return createMoveResult(
      'miss',
      baseClassification === 'mistake' || baseClassification === 'blunder' ? '?' : '?!',
      evalLoss,
      expectedBefore,
      expectedAfter,
      expectedPointsLoss,
      centipawnLoss,
      { ...baseFlags, isCritical: true },
      bestMoveSan,
      true,
      [...reasonTags, 'missed_strong_continuation'],
      `Missed strong continuation.${formatBestMoveSuffix(bestMoveSan)}`.trim(),
      createDebugPayload(enableClassificationDebug, {
        ...debugBase,
        reason: 'missed_strong_continuation',
      }),
    );
  }

  const isExcellentCandidate =
    isBestMove &&
    phase !== 'opening' &&
    !isDecidedBefore &&
    !isDecidedAfter &&
    isTacticallyDemanding &&
    expectedPointsLoss <= EXCELLENT_MAX_EXPECTED_LOSS &&
    (centipawnLoss === null || centipawnLoss <= EXCELLENT_MAX_CENTIPAWN_LOSS);
  const isGreatCandidate =
    greatMovesUsedBySide < maxGreatMovesPerSide &&
    phase !== 'opening' &&
    expectedPointsLoss <= GREAT_MAX_EXPECTED_LOSS &&
    !isDecidedBefore &&
    !isDecidedAfter &&
    (isTacticallyDemanding || isSacrifice || bestToSecondGap >= 0.06) &&
    (centipawnLoss === null || centipawnLoss <= GREAT_MAX_CENTIPAWN_LOSS) &&
    !isExcellentCandidate;

  const isBrilliantCandidate =
    isSacrifice &&
    phase !== 'opening' &&
    !isDecidedBefore &&
    expectedAfter >= 0.5 &&
    expectedAfter >= expectedBefore - 0.02 &&
    expectedPointsLoss <= 0.08 &&
    (isBestMove || missLoss <= 0.03) &&
    (alternativeExpected === undefined || alternativeExpected < 0.97);

  if (isBrilliantCandidate) {
    return createMoveResult(
      'brilliant',
      '!!',
      evalLoss,
      expectedBefore,
      expectedAfter,
      expectedPointsLoss,
      centipawnLoss,
      { ...baseFlags, isCritical: true },
      bestMoveSan,
      false,
      [
        ...reasonTags,
        resolvedSacrificeSignal.offeredSacrifice ? 'offered_sacrifice' : 'material_sacrifice',
        'engine_best_move',
      ],
      undefined,
      createDebugPayload(enableClassificationDebug, {
        ...debugBase,
        reason: 'brilliant_excellent_sacrifice',
      }),
    );
  }

  if (isExcellentCandidate) {
    return createMoveResult(
      'excellent',
      '!',
      evalLoss,
      expectedBefore,
      expectedAfter,
      expectedPointsLoss,
      centipawnLoss,
      { ...baseFlags, isCritical: true },
      bestMoveSan,
      false,
      [...reasonTags, 'hard_to_find_best_move'],
      undefined,
      createDebugPayload(enableClassificationDebug, {
        ...debugBase,
        reason: isOnlyMove ? 'excellent_only_move' : 'excellent_difficult_best_move',
      }),
    );
  }

  if (isGreatCandidate) {
    return createMoveResult(
      'great',
      '!',
      evalLoss,
      expectedBefore,
      expectedAfter,
      expectedPointsLoss,
      centipawnLoss,
      { ...baseFlags, isCritical: true },
      bestMoveSan,
      false,
      [...reasonTags, 'critical_resource'],
      undefined,
      createDebugPayload(enableClassificationDebug, {
        ...debugBase,
        reason: isOnlyMove ? 'great_near_best_only_move' : 'great_near_best_resource',
      }),
    );
  }

  if (baseClassification === 'best') {
    return createMoveResult(
      'best',
      '',
      evalLoss,
      expectedBefore,
      expectedAfter,
      expectedPointsLoss,
      centipawnLoss,
      baseFlags,
      bestMoveSan,
      false,
      [...reasonTags, ...(isBestMove ? ['engine_best_move'] : [])],
      undefined,
      createDebugPayload(enableClassificationDebug, {
        ...debugBase,
        reason: isBestMove ? 'engine_best_move' : 'best_threshold_without_engine_move',
      }),
    );
  }

  if (baseClassification === 'good') {
    return createMoveResult(
      'good',
      '',
      evalLoss,
      expectedBefore,
      expectedAfter,
      expectedPointsLoss,
      centipawnLoss,
      baseFlags,
      bestMoveSan,
      false,
      reasonTags,
      undefined,
      createDebugPayload(enableClassificationDebug, {
        ...debugBase,
        reason: 'good_threshold',
      }),
    );
  }

  if (baseClassification === 'inaccuracy') {
    return createMoveResult(
      'inaccuracy',
      '?!',
      evalLoss,
      expectedBefore,
      expectedAfter,
      expectedPointsLoss,
      centipawnLoss,
      { ...baseFlags, isCritical: true },
      bestMoveSan,
      true,
      [...reasonTags, 'expected_points_loss'],
      undefined,
      createDebugPayload(enableClassificationDebug, {
        ...debugBase,
        reason: 'inaccuracy_threshold',
      }),
    );
  }

  if (baseClassification === 'mistake') {
    return createMoveResult(
      'mistake',
      '?',
      evalLoss,
      expectedBefore,
      expectedAfter,
      expectedPointsLoss,
      centipawnLoss,
      { ...baseFlags, isCritical: true },
      bestMoveSan,
      true,
      [...reasonTags, 'significant_expected_points_loss'],
      undefined,
      createDebugPayload(enableClassificationDebug, {
        ...debugBase,
        reason: 'mistake_threshold',
      }),
    );
  }

  return createMoveResult(
    'blunder',
    '??',
    evalLoss,
    expectedBefore,
    expectedAfter,
    expectedPointsLoss,
    centipawnLoss,
    { ...baseFlags, isCritical: true },
    bestMoveSan,
    true,
    [...reasonTags, 'large_expected_points_loss'],
    undefined,
    createDebugPayload(enableClassificationDebug, {
      ...debugBase,
      reason: 'fallback_blunder',
    }),
  );
};

export const isMoveClassificationSummaryKey = (
  classification: MoveClassification,
): classification is Exclude<MoveClassification, 'unknown'> => {
  return classification !== 'unknown';
};

export const isProblematicClassification = (classification: MoveClassification): boolean => {
  return (
    classification === 'inaccuracy' ||
    classification === 'mistake' ||
    classification === 'miss' ||
    classification === 'blunder'
  );
};
