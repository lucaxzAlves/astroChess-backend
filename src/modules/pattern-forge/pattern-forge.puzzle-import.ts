import { Chess } from 'chess.js';

import { AppError } from '../../utils/AppError';
import type { ImportPuzzleCsvRow, NormalizedPuzzleDifficulty, PuzzleRecord } from './pattern-forge.types';

const parseInteger = (value: string, fieldName: string): number => {
  const parsed = Number.parseInt(value, 10);

  if (!Number.isFinite(parsed)) {
    throw new AppError(`Invalid numeric field: ${fieldName}.`, 400);
  }

  return parsed;
};

export const parseCsvLine = (line: string): string[] => {
  const values: string[] = [];
  let current = '';
  let inQuotes = false;

  for (let index = 0; index < line.length; index += 1) {
    const character = line[index];
    const nextCharacter = line[index + 1];

    if (character === '"') {
      if (inQuotes && nextCharacter === '"') {
        current += '"';
        index += 1;
        continue;
      }

      inQuotes = !inQuotes;
      continue;
    }

    if (character === ',' && !inQuotes) {
      values.push(current);
      current = '';
      continue;
    }

    current += character;
  }

  values.push(current);
  return values.map((value) => value.trim());
};

export const normalizePuzzleDifficulty = (rating: number): NormalizedPuzzleDifficulty => {
  if (rating < 1400) {
    return 'beginner';
  }

  if (rating < 1900) {
    return 'intermediate';
  }

  if (rating < 2300) {
    return 'advanced';
  }

  return 'expert';
};

const applyInitialMove = (fen: string, initialMove: string): string => {
  const chess = new Chess(fen);
  const move = chess.move({
    from: initialMove.slice(0, 2),
    to: initialMove.slice(2, 4),
    promotion: initialMove.length > 4 ? initialMove[4] : undefined,
  });

  if (!move) {
    throw new AppError('Invalid initial puzzle move.', 400);
  }

  return chess.fen();
};

export const buildPuzzlePayloadFromCsvRow = (
  row: ImportPuzzleCsvRow,
): Omit<PuzzleRecord, 'createdAt' | 'updatedAt'> => {
  const fullMoveSequence = row.Moves.split(/\s+/).map((move) => move.trim()).filter(Boolean);

  if (fullMoveSequence.length < 2) {
    throw new AppError('Puzzle row must contain at least two moves.', 400);
  }

  const initialMove = fullMoveSequence[0];
  const playableFen = applyInitialMove(row.FEN, initialMove);
  const rating = parseInteger(row.Rating, 'Rating');

  return {
    externalId: row.PuzzleId,
    source: 'LICHESS',
    fen: row.FEN,
    initialMove,
    playableFen,
    solutionMoves: fullMoveSequence.slice(1),
    fullMoveSequence,
    rating,
    ratingDeviation: parseInteger(row.RatingDeviation, 'RatingDeviation'),
    popularity: parseInteger(row.Popularity, 'Popularity'),
    nbPlays: parseInteger(row.NbPlays, 'NbPlays'),
    themes: row.Themes.split(/\s+/).map((theme) => theme.trim()).filter(Boolean),
    openingTags: row.OpeningTags.split(/\s+/).map((tag) => tag.trim()).filter(Boolean),
    gameUrl: row.GameUrl,
    normalizedDifficulty: normalizePuzzleDifficulty(rating),
  };
};
