import { Chess } from 'chess.js';

import { AnalyzedMove, GameMetadata, NormalizedEvaluation, ParsedGame } from './chess.types';

const HEADER_MAP: Partial<Record<keyof GameMetadata, string>> = {
  white: 'White',
  black: 'Black',
  result: 'Result',
  site: 'Site',
  date: 'Date',
};

const formatHeaderValue = (value: string): string => {
  return value.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
};

const formatEvalForHumans = (evaluation: NormalizedEvaluation): string => {
  if (evaluation.evaluationType === 'mate') {
    return `Mate in ${evaluation.evaluation}`;
  }

  return (evaluation.evaluation / 100).toFixed(2);
};

export const formatEvalForStructuredOutput = (
  evaluation: NormalizedEvaluation,
): number | string => {
  if (evaluation.evaluationType === 'mate') {
    return `#${evaluation.evaluation}`;
  }

  return Number((evaluation.evaluation / 100).toFixed(2));
};

const formatLichessEval = (evaluation: NormalizedEvaluation): string => {
  if (evaluation.evaluationType === 'mate') {
    return `#${evaluation.evaluation}`;
  }

  return (evaluation.evaluation / 100).toFixed(2);
};

const extractClockAnnotationsByPly = (pgn: string): Map<number, string> => {
  const clockByPly = new Map<number, string>();
  const clockMatches = [...pgn.matchAll(/\[%clk\s+([^\]]+)\]/gi)];

  clockMatches.forEach((match, index) => {
    const clockValue = match[1]?.trim();

    if (clockValue) {
      clockByPly.set(index + 1, `[%clk ${clockValue}]`);
    }
  });

  return clockByPly;
};

const getColorToMoveFromFen = (fen: string): 'white' | 'black' => {
  return fen.split(' ')[1] === 'w' ? 'white' : 'black';
};

const getMoveNumberFromFen = (fen: string): number => {
  return Number(fen.split(' ')[5]);
};

export const formatVariation = (fenBefore: string, sanMoves: string[]): string | undefined => {
  if (sanMoves.length === 0) {
    return undefined;
  }

  let moveNumber = getMoveNumberFromFen(fenBefore);
  let colorToMove = getColorToMoveFromFen(fenBefore);

  const parts = sanMoves.map((san, index) => {
    let formattedMove: string;

    if (colorToMove === 'white') {
      formattedMove = `${moveNumber}. ${san}`;
      colorToMove = 'black';
    } else {
      formattedMove = index === 0 ? `${moveNumber}... ${san}` : san;
      colorToMove = 'white';
      moveNumber += 1;
    }

    return formattedMove;
  });

  return `(${parts.join(' ')})`;
};

const buildHeaders = (game: ParsedGame): string[] => {
  const headers = new Map<string, string>(Object.entries(game.headers));

  for (const [metadataKey, headerKey] of Object.entries(HEADER_MAP) as [
    keyof GameMetadata,
    string,
  ][]) {
    const value = game.metadata?.[metadataKey];

    if (value) {
      headers.set(headerKey, value);
    }
  }

  if (!headers.has('Result')) {
    headers.set('Result', game.metadata?.result ?? '*');
  }

  return [...headers.entries()].map(([key, value]) => `[${key} "${formatHeaderValue(value)}"]`);
};

export const toSanFromUci = (fen: string, uciMove: string): string | undefined => {
  if (!uciMove || uciMove === '0000') {
    return undefined;
  }

  const chess = new Chess(fen);
  const move = chess.move({
    from: uciMove.slice(0, 2),
    to: uciMove.slice(2, 4),
    promotion: uciMove.slice(4, 5) || undefined,
  });

  return move?.san;
};

export const toSanVariationFromUci = (
  fen: string,
  uciMoves: string[],
  maxMoves?: number,
): string[] => {
  const chess = new Chess(fen);
  const sanMoves: string[] = [];
  const limitedUciMoves = maxMoves ? uciMoves.slice(0, maxMoves) : uciMoves;

  for (const uciMove of limitedUciMoves) {
    if (!uciMove || uciMove === '0000') {
      break;
    }

    try {
      const move = chess.move({
        from: uciMove.slice(0, 2),
        to: uciMove.slice(2, 4),
        promotion: uciMove.slice(4, 5) || undefined,
      });

      sanMoves.push(move.san);
    } catch {
      break;
    }
  }

  return sanMoves;
};

export const buildAnnotatedPgn = (game: ParsedGame, moves: AnalyzedMove[]): string => {
  const headers = buildHeaders(game);
  const bodyParts: string[] = [];
  const clockAnnotationsByPly = extractClockAnnotationsByPly(game.pgn);

  for (const move of moves) {
    if (move.color === 'white') {
      bodyParts.push(`${move.moveNumber}.`);
    } else {
      bodyParts.push(`${move.moveNumber}...`);
    }

    const moveText = `${move.san}${move.symbol}`;
    const lichessEval = `[%eval ${formatLichessEval(move.normalizedAfter)}]`;
    const clockAnnotation = clockAnnotationsByPly.get(move.ply);
    const structuredAnnotations = [lichessEval, clockAnnotation].filter(Boolean).join(' ');

    bodyParts.push(moveText);

    if (move.shouldAnnotate && move.comment) {
      const evalComment = `(${formatEvalForHumans(move.normalizedBefore)} -> ${formatEvalForHumans(
        move.normalizedAfter,
      )}) ${move.comment}`;
      const variation = move.shouldIncludePv ? formatVariation(move.fenBefore, move.pv) : undefined;

      bodyParts.push(`{ ${evalComment} }`);
      bodyParts.push(`{ ${structuredAnnotations} }`);

      if (variation) {
        bodyParts.push(variation);
      }

      continue;
    }

    bodyParts.push(`{ ${structuredAnnotations} }`);
  }

  const result = game.metadata?.result ?? game.headers.Result ?? '*';

  bodyParts.push(result);

  return `${headers.join('\n')}\n\n${bodyParts.join(' ')}`;
};
