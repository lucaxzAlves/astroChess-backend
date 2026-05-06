import { ChildProcessWithoutNullStreams, spawn } from 'node:child_process';

import { AppError } from '../utils/AppError';
import { parseStockfishOutput } from './evaluation.parser';
import {
  StockfishAnalysis,
  StockfishAnalyzeOptions,
  StockfishCacheMetrics,
  StockfishClientOptions,
} from './stockfish.types';

type LineWaiter = {
  predicate: (line: string) => boolean;
  resolve: (line: string) => void;
  reject: (error: Error) => void;
  timer: NodeJS.Timeout;
};

export class StockfishConfigurationError extends AppError {
  constructor() {
    super('STOCKFISH_PATH precisa ser configurado com o caminho do binario Stockfish.', 500);
    this.name = 'StockfishConfigurationError';
  }
}

export class StockfishClient {
  private readonly binaryPath: string;
  private readonly timeoutMs: number;
  private readonly includeRawOutput: boolean;
  private readonly threads: number;
  private readonly hashMb: number;
  private readonly cache = new Map<string, StockfishAnalysis>();
  private positionsAnalyzed = 0;
  private cacheHits = 0;
  private process?: ChildProcessWithoutNullStreams;
  private stdoutBuffer = '';
  private outputLines: string[] = [];
  private waiters: LineWaiter[] = [];
  private processError?: Error;

  constructor(options: StockfishClientOptions) {
    if (!options.binaryPath) {
      throw new StockfishConfigurationError();
    }

    this.binaryPath = options.binaryPath;
    this.timeoutMs = options.timeoutMs ?? 15_000;
    this.includeRawOutput = options.includeRawOutput ?? false;
    this.threads = options.threads ?? 1;
    this.hashMb = options.hashMb ?? 128;
  }

  async start(): Promise<void> {
    if (this.process) {
      return;
    }

    this.process = spawn(this.binaryPath, [], {
      stdio: 'pipe',
    });

    this.process.stdout.on('data', (chunk: Buffer) => this.handleStdout(chunk));
    this.process.stderr.on('data', (chunk: Buffer) =>
      this.outputLines.push(chunk.toString().trim()),
    );
    this.process.on('error', (error) => this.rejectWaiters(error));
    this.process.on('exit', (code) => {
      if (code && code !== 0) {
        this.rejectWaiters(new Error(`Stockfish process exited with code ${code}.`));
      }
    });

    const uciStartIndex = this.outputLines.length;

    this.sendCommand('uci');
    await this.waitForLine((line) => line === 'uciok', uciStartIndex);
    this.sendCommand(`setoption name Threads value ${this.threads}`);
    this.sendCommand(`setoption name Hash value ${this.hashMb}`);
    await this.isReady();
  }

  async isReady(): Promise<void> {
    const outputStartIndex = this.outputLines.length;

    this.sendCommand('isready');
    await this.waitForLine((line) => line === 'readyok', outputStartIndex);
  }

  async analyzePosition(
    fen: string,
    { depth, movetimeMs, includePv, mode }: StockfishAnalyzeOptions,
  ): Promise<StockfishAnalysis> {
    await this.start();

    const cacheKey = this.buildCacheKey(fen, {
      depth,
      movetimeMs,
      includePv,
      mode,
    });

    const cachedAnalysis = this.cache.get(cacheKey);

    if (cachedAnalysis) {
      this.cacheHits += 1;

      return cachedAnalysis;
    }

    const outputStartIndex = this.outputLines.length;

    this.sendCommand(`position fen ${fen}`);
    this.sendCommand(this.buildGoCommand({ depth, movetimeMs }));

    await this.waitForLine((line) => line.startsWith('bestmove'), outputStartIndex);

    const analysisOutput = this.outputLines.slice(outputStartIndex);
    const analysis = parseStockfishOutput(analysisOutput, {
      includePv,
      includeRawOutput: this.includeRawOutput,
    });

    this.positionsAnalyzed += 1;
    this.cache.set(cacheKey, analysis);

    return analysis;
  }

  async analyzePositionLight(fen: string, movetimeMs: number): Promise<StockfishAnalysis> {
    return this.analyzePosition(fen, {
      movetimeMs,
      includePv: false,
      mode: 'fast',
    });
  }

  async analyzePositionDeep(options: {
    fen: string;
    depth?: number;
    movetimeMs?: number;
    includePv: boolean;
  }): Promise<StockfishAnalysis> {
    const { fen, depth, movetimeMs, includePv } = options;

    return this.analyzePosition(fen, {
      depth,
      movetimeMs,
      includePv,
      mode: 'deep',
    });
  }

  async analyzeFen(fen: string, depth: number): Promise<StockfishAnalysis> {
    return this.analyzePositionDeep({
      fen,
      depth,
      includePv: true,
    });
  }

  getCacheMetrics(): StockfishCacheMetrics {
    return {
      positionsAnalyzed: this.positionsAnalyzed,
      cacheHits: this.cacheHits,
    };
  }

  close(): void {
    if (!this.process) {
      return;
    }

    this.sendCommand('quit');
    this.process.kill();
    this.process = undefined;
  }

  private sendCommand(command: string): void {
    if (!this.process) {
      throw new AppError('Stockfish process is not running.');
    }

    this.process.stdin.write(`${command}\n`);
  }

  private buildGoCommand({
    depth,
    movetimeMs,
  }: Pick<StockfishAnalyzeOptions, 'depth' | 'movetimeMs'>): string {
    const commandParts = ['go'];

    if (depth) {
      commandParts.push('depth', String(depth));
    }

    if (movetimeMs) {
      commandParts.push('movetime', String(movetimeMs));
    }

    if (commandParts.length === 1) {
      throw new AppError('Stockfish analysis requires either depth or movetimeMs.');
    }

    return commandParts.join(' ');
  }

  private buildCacheKey(fen: string, options: StockfishAnalyzeOptions): string {
    return [
      fen,
      options.mode,
      options.includePv ? 'pv' : 'nopv',
      options.depth ? `depth:${options.depth}` : '',
      options.movetimeMs ? `movetime:${options.movetimeMs}` : '',
    ].join('|');
  }

  private handleStdout(chunk: Buffer): void {
    this.stdoutBuffer += chunk.toString();

    const lines = this.stdoutBuffer.split(/\r?\n/);
    this.stdoutBuffer = lines.pop() ?? '';

    for (const rawLine of lines) {
      const line = rawLine.trim();

      if (!line) {
        continue;
      }

      this.outputLines.push(line);
      this.resolveMatchingWaiters(line);
    }
  }

  private waitForLine(predicate: (line: string) => boolean, fromIndex = 0): Promise<string> {
    if (this.processError) {
      return Promise.reject(this.processError);
    }

    const existingLine = this.outputLines.slice(fromIndex).find(predicate);

    if (existingLine) {
      return Promise.resolve(existingLine);
    }

    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        this.waiters = this.waiters.filter((waiter) => waiter.timer !== timer);
        reject(new AppError('Stockfish analysis timed out.', 504));
      }, this.timeoutMs);

      this.waiters.push({
        predicate,
        resolve,
        reject,
        timer,
      });
    });
  }

  private resolveMatchingWaiters(line: string): void {
    const matchingWaiters = this.waiters.filter((waiter) => waiter.predicate(line));

    for (const waiter of matchingWaiters) {
      clearTimeout(waiter.timer);
      waiter.resolve(line);
    }

    this.waiters = this.waiters.filter((waiter) => !matchingWaiters.includes(waiter));
  }

  private rejectWaiters(error: Error): void {
    this.processError = error;

    for (const waiter of this.waiters) {
      clearTimeout(waiter.timer);
      waiter.reject(error);
    }

    this.waiters = [];
  }
}
