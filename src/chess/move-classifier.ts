import {
  ClassificationDebug,
  GamePhase,
  MoveAnnotationSymbol,
  MoveClassification,
  MoveClassificationResult,
  NormalizedEvaluation,
  PlayerColor,
  PositionContext,
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

type ClassificationThresholds = {
  best: number;
  excellent: number;
  good: number;
  inaccuracy: number;
  mistake: number;
  blunder: number;
};

type ClassifyMoveInput = {
  moveNumber: number;
  color: PlayerColor;
  playedMoveUci: string;
  bestMoveUci?: string;
  bestMoveSan?: string;
  before: NormalizedEvaluation;
  after: NormalizedEvaluation;
  ignoreErrorsBeforeMove: number;
  isBookMove?: boolean;
  phase?: GamePhase;
  materialDelta?: number;
  enableMoveClassifications?: boolean;
  enableClassificationDebug?: boolean;
  bookMovesUsedBySide?: number;
  maxBookMovesPerSide?: number;
  greatMovesUsedBySide?: number;
  maxGreatMovesPerSide?: number;
  hasPriorProblematicMove?: boolean;
  previousMoveWasProblematic?: boolean;
};

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

const getThresholdsForContext = (positionContext: PositionContext): ClassificationThresholds => {
  switch (positionContext) {
    case 'winning':
      return {
        best: 0.08,
        excellent: 0.2,
        good: 0.45,
        inaccuracy: 0.55,
        mistake: 1.1,
        blunder: 2.4,
      };
    case 'better':
      return {
        best: 0.08,
        excellent: 0.22,
        good: 0.5,
        inaccuracy: 0.6,
        mistake: 1.1,
        blunder: 2.4,
      };
    case 'equal':
      return {
        best: 0.08,
        excellent: 0.2,
        good: 0.55,
        inaccuracy: 0.55,
        mistake: 1.1,
        blunder: 2.4,
      };
    case 'worse':
      return {
        best: 0.08,
        excellent: 0.22,
        good: 0.6,
        inaccuracy: 0.7,
        mistake: 1.2,
        blunder: 2.5,
      };
    case 'lost':
      return {
        best: 0.08,
        excellent: 0.25,
        good: 0.75,
        inaccuracy: 1.1,
        mistake: 1.8,
        blunder: 2.8,
      };
  }
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
  bestMoveSan: string | undefined,
  shouldAnnotate: boolean,
  reasonTags: string[],
  commentOverride?: string,
  classificationDebug?: ClassificationDebug,
): MoveClassificationResult => {
  return {
    classification,
    symbol,
    evalLoss,
    comment: shouldAnnotate
      ? (commentOverride ?? formatComment(classification, bestMoveSan))
      : (commentOverride ?? ''),
    reasonTags,
    shouldAnnotate,
    classificationDebug,
  };
};

export const classifyMove = ({
  moveNumber,
  color,
  playedMoveUci,
  bestMoveUci,
  bestMoveSan,
  before,
  after,
  ignoreErrorsBeforeMove,
  isBookMove = false,
  phase = getMovePhase(moveNumber),
  materialDelta = 0,
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
  const evalLoss = Math.max(0, Number((bestPlayerEval - playedPlayerEval).toFixed(2)));
  const missedGain = Number((bestPlayerEval - playedPlayerEval).toFixed(2));
  const isBestMove = Boolean(bestMoveUci) && playedMoveUci === bestMoveUci;
  const positionContext = getPositionContext(bestPlayerEval);
  const thresholds = getThresholdsForContext(positionContext);
  const reasonTags: string[] = phase !== 'unknown' ? [phase] : [];
  const debugBase = {
    playerEvalBefore: bestPlayerEval,
    bestPlayerEval,
    playedPlayerEval,
    evalLoss,
    missedGain,
    positionContext,
    thresholdsUsed: thresholds,
  };

  if (!enableMoveClassifications) {
    return createResult(
      'unknown',
      '',
      evalLoss,
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

      return createResult(
        'miss',
        mateLost ? '??' : '?',
        null,
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
    return createResult(
      'blunder',
      '??',
      null,
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

  const turnsWinningToLost = bestPlayerEval >= 1.5 && playedPlayerEval <= -1.5;
  const turnsPlayableToLost = bestPlayerEval > -1 && playedPlayerEval <= -3;

  if (
    evalLoss >= thresholds.blunder ||
    turnsWinningToLost ||
    turnsPlayableToLost ||
    (positionContext === 'winning' && playedPlayerEval <= 0 && evalLoss >= 1.8)
  ) {
    return createResult(
      'blunder',
      '??',
      evalLoss,
      bestMoveSan,
      true,
      [...reasonTags, 'large_eval_loss'],
      undefined,
      createDebugPayload(enableClassificationDebug, {
        ...debugBase,
        reason: turnsWinningToLost
          ? 'winning_to_lost'
          : turnsPlayableToLost
            ? 'playable_to_lost'
            : 'blunder_threshold',
      }),
    );
  }

  const isStrongMiss =
    !isBestMove &&
    bestPlayerEval >= 1.5 &&
    missedGain >= 1.5 &&
    playedPlayerEval > -1.5 &&
    evalLoss < thresholds.blunder;

  if (isStrongMiss) {
    return createResult(
      'miss',
      evalLoss >= thresholds.mistake ? '?' : '?!',
      evalLoss,
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

  const canBeBook =
    isBookMove &&
    moveNumber <= ignoreErrorsBeforeMove &&
    evalLoss <= 0.2 &&
    !hasPriorProblematicMove &&
    bookMovesUsedBySide < maxBookMovesPerSide;

  if (canBeBook) {
    return createResult(
      'book',
      '',
      evalLoss,
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

  const improvedSignificantly = playedPlayerEval - bestPlayerEval >= 0.6;
  const foundDefensiveResource =
    bestPlayerEval <= -1 &&
    playedPlayerEval >= bestPlayerEval - 0.15 &&
    playedPlayerEval >= bestPlayerEval + 0.6;
  const isGreatCandidate =
    greatMovesUsedBySide < maxGreatMovesPerSide &&
    phase !== 'opening' &&
    evalLoss <= 0.15 &&
    (improvedSignificantly ||
      foundDefensiveResource ||
      previousMoveWasProblematic ||
      (positionContext !== 'equal' && materialDelta <= 0));

  if (
    isBestMove &&
    phase !== 'opening' &&
    materialDelta <= -3 &&
    evalLoss <= 0.1 &&
    bestPlayerEval >= 1.5
  ) {
    return createResult(
      'brilliant',
      '',
      evalLoss,
      bestMoveSan,
      false,
      [...reasonTags, 'material_sacrifice', 'engine_best_move'],
      undefined,
      createDebugPayload(enableClassificationDebug, {
        ...debugBase,
        reason: 'brilliant_material_sacrifice',
      }),
    );
  }

  if (isBestMove && isGreatCandidate) {
    return createResult(
      'great',
      '',
      evalLoss,
      bestMoveSan,
      false,
      [...reasonTags, 'critical_resource'],
      undefined,
      createDebugPayload(enableClassificationDebug, {
        ...debugBase,
        reason: previousMoveWasProblematic
          ? 'great_after_previous_error'
          : foundDefensiveResource
            ? 'great_defensive_resource'
            : improvedSignificantly
              ? 'great_improves_eval'
              : 'great_critical_resource',
      }),
    );
  }

  if (isBestMove || evalLoss <= thresholds.best) {
    return createResult(
      'best',
      '',
      evalLoss,
      bestMoveSan,
      false,
      [...reasonTags, ...(bestMoveSan ? ['engine_best_move'] : [])],
      undefined,
      createDebugPayload(enableClassificationDebug, {
        ...debugBase,
        reason: isBestMove ? 'engine_best_move' : 'best_threshold',
      }),
    );
  }

  if (evalLoss <= thresholds.excellent) {
    return createResult(
      'excellent',
      '',
      evalLoss,
      bestMoveSan,
      false,
      reasonTags,
      undefined,
      createDebugPayload(enableClassificationDebug, {
        ...debugBase,
        reason: 'excellent_threshold',
      }),
    );
  }

  if (evalLoss < thresholds.good) {
    return createResult(
      'good',
      '',
      evalLoss,
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

  if (evalLoss < thresholds.mistake) {
    return createResult(
      'inaccuracy',
      '?!',
      evalLoss,
      bestMoveSan,
      true,
      [...reasonTags, 'eval_loss'],
      undefined,
      createDebugPayload(enableClassificationDebug, {
        ...debugBase,
        reason: 'inaccuracy_threshold',
      }),
    );
  }

  if (evalLoss < thresholds.blunder) {
    return createResult(
      'mistake',
      '?',
      evalLoss,
      bestMoveSan,
      true,
      [...reasonTags, 'significant_eval_loss'],
      undefined,
      createDebugPayload(enableClassificationDebug, {
        ...debugBase,
        reason: 'mistake_threshold',
      }),
    );
  }

  return createResult(
    'blunder',
    '??',
    evalLoss,
    bestMoveSan,
    true,
    [...reasonTags, 'large_eval_loss'],
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
