import {
  AccuracyByColor,
  AccuracyDetail,
  AccuracyDetailsByColor,
  AnalyzedMove,
  MoveClassification,
  PlayerColor,
} from './chess.types';
import { evaluationFromPlayerPerspective, normalizedEvaluationToPawns } from './move-classifier';

const SEVERE_MATE_LOSS = 6;

const roundTo = (value: number, decimals: number): number => {
  return Number(value.toFixed(decimals));
};

const getFallbackEvalLoss = (classification: MoveClassification): number => {
  switch (classification) {
    case 'blunder':
      return 4;
    case 'miss':
      return 2.2;
    case 'mistake':
      return 2;
    case 'inaccuracy':
      return 1;
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
  const evalLoss =
    move.evalLoss ??
    (move.reasonTags.some((tag) => tag.includes('mate'))
      ? SEVERE_MATE_LOSS
      : getFallbackEvalLoss(move.classification));

  if (move.reasonTags.some((tag) => tag.includes('mate')) && move.shouldAnnotate) {
    return move.classification === 'blunder' ? 5 : 10;
  }

  if (evalLoss <= 0.05) {
    return 100;
  }

  const rawAccuracy = 100 * Math.exp(-0.75 * evalLoss);

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
    const evalLoss =
      move.evalLoss ??
      (move.reasonTags.some((tag) => tag.includes('mate'))
        ? SEVERE_MATE_LOSS
        : getFallbackEvalLoss(move.classification));
    const weight = getMoveWeight(move);

    totalWeight += weight;
    weightedAccuracySum += moveAccuracy * weight;
    lossSum += evalLoss;
    weightedLossSum += evalLoss * weight;

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
      averageLoss: roundTo(lossSum / colorMoves.length, 2),
      weightedAverageLoss: roundTo(weightedLossSum / totalWeight, 2),
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
