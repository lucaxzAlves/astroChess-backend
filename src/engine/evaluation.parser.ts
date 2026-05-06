import { StockfishAnalysis, StockfishEvaluation } from './stockfish.types';

const parseInfoLine = (
  line: string,
): (StockfishEvaluation & { depth: number; pv: string[] }) | null => {
  const depthMatch = line.match(/\bdepth\s+(\d+)/);
  const scoreMatch = line.match(/\bscore\s+(cp|mate)\s+(-?\d+)/);

  if (!depthMatch || !scoreMatch) {
    return null;
  }

  const pvMatch = line.match(/\bpv\s+(.+)$/);

  return {
    depth: Number(depthMatch[1]),
    evaluationType: scoreMatch[1] as StockfishEvaluation['evaluationType'],
    evaluation: Number(scoreMatch[2]),
    pv: pvMatch ? pvMatch[1].trim().split(/\s+/) : [],
  };
};

export const parseStockfishOutput = (
  outputLines: string[],
  options: { includePv: boolean; includeRawOutput?: boolean },
): StockfishAnalysis => {
  const bestMoveLine = [...outputLines].reverse().find((line) => line.startsWith('bestmove'));
  const bestMove = bestMoveLine?.split(/\s+/)[1] ?? '0000';

  const parsedInfo = outputLines
    .map(parseInfoLine)
    .filter((line): line is NonNullable<ReturnType<typeof parseInfoLine>> => Boolean(line))
    .sort((a, b) => a.depth - b.depth);

  const lastInfo = parsedInfo.at(-1);

  return {
    bestMove,
    evaluation: lastInfo?.evaluation ?? 0,
    evaluationType: lastInfo?.evaluationType ?? 'cp',
    pv: options.includePv ? (lastInfo?.pv ?? []) : [],
    depth: lastInfo?.depth ?? 0,
    ...(options.includeRawOutput ? { rawOutput: outputLines } : {}),
  };
};
