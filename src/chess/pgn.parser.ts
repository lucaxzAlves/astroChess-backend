import { Chess } from 'chess.js';

import { AppError } from '../utils/AppError';
import { GameMetadata, ParsedGame, ParsedMove, PlayerColor } from './chess.types';

type PgnGameInput = {
  id?: string;
  pgn: string;
  metadata?: GameMetadata;
};

const getMoveNumberFromFen = (fen: string): number => {
  const fullMoveNumber = fen.split(' ')[5];

  return Number(fullMoveNumber);
};

const toPlayerColor = (color: string): PlayerColor => {
  return color === 'w' ? 'white' : 'black';
};

const toUciMove = (move: { from: string; to: string; promotion?: string }): string => {
  return `${move.from}${move.to}${move.promotion ?? ''}`;
};

const getPly = (moveNumber: number, color: PlayerColor): number => {
  return color === 'white' ? moveNumber * 2 - 1 : moveNumber * 2;
};

export const parsePgnGame = (game: PgnGameInput, index: number): ParsedGame => {
  const chess = new Chess();

  try {
    chess.loadPgn(game.pgn, { strict: false });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown PGN parser error.';

    throw new AppError(`Invalid PGN for game at index ${index}: ${message}`, 400, {
      gameId: game.id,
      index,
    });
  }

  const moves = chess.history({ verbose: true }).map<ParsedMove>((move) => {
    const moveNumber = getMoveNumberFromFen(move.before);
    const color = toPlayerColor(move.color);

    return {
      ply: getPly(moveNumber, color),
      moveNumber,
      color,
      san: move.san,
      uci: toUciMove(move),
      fenBefore: move.before,
      fenAfter: move.after,
    };
  });

  if (moves.length === 0) {
    throw new AppError(`Invalid PGN for game at index ${index}: no moves were found.`, 400, {
      gameId: game.id,
      index,
    });
  }

  return {
    id: game.id,
    pgn: game.pgn,
    metadata: game.metadata,
    headers: chess.getHeaders(),
    moves,
  };
};
