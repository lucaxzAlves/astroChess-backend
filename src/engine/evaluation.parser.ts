import { StockfishAnalysis, StockfishCandidateLine, StockfishEvaluation } from './stockfish.types';

const parseInfoLine = (
  line: string,
): (StockfishEvaluation & { depth: number; multipv: number; pv: string[] }) | null => {
  const depthMatch = line.match(/\bdepth\s+(\d+)/);
  const scoreMatch = line.match(/\bscore\s+(cp|mate)\s+(-?\d+)/);

  if (!depthMatch || !scoreMatch) {
    return null;
  }

  const pvMatch = line.match(/\bpv\s+(.+)$/);
  const multipvMatch = line.match(/\bmultipv\s+(\d+)/);

  return {
    depth: Number(depthMatch[1]),
    multipv: multipvMatch ? Number(multipvMatch[1]) : 1,
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

  const latestByMultipv = new Map<number, NonNullable<ReturnType<typeof parseInfoLine>>>();

  for (const info of parsedInfo) {
    const current = latestByMultipv.get(info.multipv);

    if (!current || info.depth >= current.depth) {
      latestByMultipv.set(info.multipv, info);
    }
  }

  const candidateLines: StockfishCandidateLine[] = [...latestByMultipv.values()]
    .sort((left, right) => left.multipv - right.multipv)
    .map((info) => ({
      multipv: info.multipv,
      bestMove: info.pv[0] ?? (info.multipv === 1 ? bestMove : '0000'),
      evaluation: info.evaluation,
      evaluationType: info.evaluationType,
      pv: options.includePv ? info.pv : [],
      depth: info.depth,
    }));
  const lastInfo = latestByMultipv.get(1) ?? parsedInfo.at(-1);

  return {
    bestMove,
    evaluation: lastInfo?.evaluation ?? 0,
    evaluationType: lastInfo?.evaluationType ?? 'cp',
    pv: options.includePv ? (lastInfo?.pv ?? []) : [],
    depth: lastInfo?.depth ?? 0,
    candidateLines,
    ...(options.includeRawOutput ? { rawOutput: outputLines } : {}),
  };
};
