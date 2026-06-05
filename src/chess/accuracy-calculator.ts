import {
  AccuracyByColor,
  AccuracyDetail,
  AccuracyDetailsByColor,
  AnalyzedMove,
  MoveClassification,
  PlayerColor,
} from './chess.types';
import { evaluationFromPlayerPerspective, normalizedEvaluationToPawns } from './move-classifier';

const SEVERE_MATE_EXPECTED_LOSS = 1;

const roundTo = (value: number, decimals: number): number => {
  return Number(value.toFixed(decimals));
};

const getFallbackEvalLoss = (classification: MoveClassification): number => {
  switch (classification) {
    case 'blunder':
      return 0.35;
    case 'miss':
      return 0.18;
    case 'mistake':
      return 0.14;
    case 'inaccuracy':
      return 0.08;
    default:
      return 0;
  }
};

const getMoveWeight = (move: AnalyzedMove): number => {
  const beforeForPlayer = evaluationFromPlayerPerspective(move.normalizedBefore, move.color);
  const beforePawns = normalizedEvaluationToPawns({
    evaluation: beforeForPlayer,
    evaluationType: move.normalizedBefore.evaluationType,
  });

  if (move.reasonTags.some((tag) => tag.includes('mate'))) {
    return 1.2;
  }

  const absoluteEval = Math.abs(beforePawns);

  if (absoluteEval >= 5) {
    return 0.4;
  }

  if (absoluteEval >= 3) {
    return 0.6;
  }

  if (absoluteEval >= 1.5) {
    return 0.8;
  }

  return 1;
};

const getMoveAccuracy = (move: AnalyzedMove): number => {
  const expectedLoss =
    move.expectedPointsLoss ??
    (move.reasonTags.some((tag) => tag.includes('mate'))
      ? SEVERE_MATE_EXPECTED_LOSS
      : getFallbackEvalLoss(move.classification));

  if (move.reasonTags.some((tag) => tag.includes('mate')) && move.shouldAnnotate) {
    return move.classification === 'blunder' ? 5 : 10;
  }

  if (expectedLoss <= 0.002) {
    return 100;
  }

  const winPercentLoss = expectedLoss * 100;
  const rawAccuracy =
    103.1668100711649 * Math.exp(-0.04354415386753951 * winPercentLoss) -
    3.166924740191411;

  return Math.max(0, Math.min(100, roundTo(rawAccuracy, 1)));
};

const createEmptyAccuracyDetail = (): AccuracyDetail => {
  return {
    movesCount: 0,
    averageLoss: 0,
    weightedAverageLoss: 0,
  };
};

const calculateColorAccuracy = (
  moves: AnalyzedMove[],
  color: PlayerColor,
): {
  accuracy: number;
  detail: AccuracyDetail;
  movesWithAccuracy: Array<{ move: AnalyzedMove; moveAccuracy: number }>;
} => {
  const colorMoves = moves.filter((move) => move.color === color);

  if (colorMoves.length === 0) {
    return {
      accuracy: 0,
      detail: createEmptyAccuracyDetail(),
      movesWithAccuracy: [],
    };
  }

  let totalWeight = 0;
  let weightedAccuracySum = 0;
  let lossSum = 0;
  let weightedLossSum = 0;

  const movesWithAccuracy = colorMoves.map((move) => {
    const moveAccuracy = getMoveAccuracy(move);
    const expectedLoss =
      move.expectedPointsLoss ??
      (move.reasonTags.some((tag) => tag.includes('mate'))
        ? SEVERE_MATE_EXPECTED_LOSS
        : getFallbackEvalLoss(move.classification));
    const weight = getMoveWeight(move);

    totalWeight += weight;
    weightedAccuracySum += moveAccuracy * weight;
    lossSum += expectedLoss;
    weightedLossSum += expectedLoss * weight;

    return {
      move,
      moveAccuracy,
    };
  });

  const accuracy = totalWeight > 0 ? weightedAccuracySum / totalWeight : 0;

  return {
    accuracy: roundTo(accuracy, 1),
    detail: {
      movesCount: colorMoves.length,
      averageLoss: roundTo(lossSum / colorMoves.length, 4),
      weightedAverageLoss: roundTo(weightedLossSum / totalWeight, 4),
    },
    movesWithAccuracy,
  };
};

export const calculateAccuracyByColor = (
  moves: AnalyzedMove[],
): {
  accuracy: AccuracyByColor;
  accuracyDetails: AccuracyDetailsByColor;
  moves: AnalyzedMove[];
} => {
  const white = calculateColorAccuracy(moves, 'white');
  const black = calculateColorAccuracy(moves, 'black');
  const moveAccuracyMap = new Map(
    [...white.movesWithAccuracy, ...black.movesWithAccuracy].map(({ move, moveAccuracy }) => [
      `${move.moveNumber}-${move.color}-${move.uci}`,
      moveAccuracy,
    ]),
  );
  const movesWithAccuracy = moves.map((move) => {
    return {
      ...move,
      moveAccuracy: moveAccuracyMap.get(`${move.moveNumber}-${move.color}-${move.uci}`) ?? 0,
    };
  });

  return {
    accuracy: {
      white: white.accuracy,
      black: black.accuracy,
    },
    accuracyDetails: {
      white: white.detail,
      black: black.detail,
    },
    moves: movesWithAccuracy,
  };
};
