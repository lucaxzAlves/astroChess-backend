import { randomUUID } from 'node:crypto';

import { AppError } from '../../utils/AppError';
import * as masterReplayRepository from './master-replay.repository';
import type {
  MasterReplayAnnotatedMove,
  MasterReplayAnnotationType,
  MasterReplayCategory,
  MasterReplayDifficulty,
  MasterReplayGameDocument,
  MasterReplayKeyMoment,
  MasterReplayMomentType,
  MasterReplayOrientation,
  MasterReplaySideToGuess,
  MasterReplayStatus,
} from './master-replay.types';

// TODO: add PGN parser support to auto-generate ply, SAN, UCI and FEN states.
// TODO: add PGN import/header extraction workflow.
// TODO: add user progress and replay completion state.
// TODO: add guess-the-move scoring and answer persistence.
// TODO: add per-moment user attempt storage.
// TODO: allow Academy lessons to reference MasterReplay games directly.
// TODO: add optional engine eval enrichment.
// TODO: support AI-assisted commentary suggestions.

const STATUSES = new Set<MasterReplayStatus>(['draft', 'published', 'archived']);
const CATEGORIES = new Set<MasterReplayCategory>([
  'attack',
  'defense',
  'calculation',
  'positional',
  'endgame',
  'opening',
  'tactics',
  'strategy',
]);
const DIFFICULTIES = new Set<MasterReplayDifficulty>([
  'beginner',
  'intermediate',
  'advanced',
  'master',
]);
const ORIENTATIONS = new Set<MasterReplayOrientation>(['white', 'black']);
const SIDES_TO_GUESS = new Set<MasterReplaySideToGuess>(['white', 'black', 'both']);
const ANNOTATION_TYPES = new Set<MasterReplayAnnotationType>([
  'idea',
  'critical',
  'mistake',
  'brilliant',
  'turning_point',
  'quiet_move',
  'defensive_resource',
  'model_move',
]);
const MOMENT_TYPES = new Set<MasterReplayMomentType>([
  'opening_idea',
  'critical_position',
  'turning_point',
  'combination',
  'defensive_resource',
  'conversion',
  'endgame_technique',
]);

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const normalizeOptionalString = (value: unknown): string | undefined => {
  if (typeof value !== 'string') {
    return undefined;
  }

  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
};

const normalizeRequiredString = (value: unknown, fieldName: string): string => {
  const normalized = normalizeOptionalString(value);

  if (!normalized) {
    throw new AppError(`${fieldName} is required.`, 400);
  }

  return normalized;
};

const normalizeStringArray = (value: unknown): string[] => {
  if (!Array.isArray(value)) {
    return [];
  }

  return Array.from(
    new Set(
      value
        .filter((item): item is string => typeof item === 'string')
        .map((item) => item.trim())
        .filter(Boolean),
    ),
  );
};

const validateEnum = <TValue extends string>(
  value: unknown,
  allowed: Set<TValue>,
  fieldName: string,
): TValue | undefined => {
  if (value === undefined) {
    return undefined;
  }

  if (typeof value !== 'string' || !allowed.has(value as TValue)) {
    throw new AppError(`Invalid ${fieldName}.`, 400);
  }

  return value as TValue;
};

const validatePlyShape = (ply: number, moveNumber: number, color: 'white' | 'black'): void => {
  if (!Number.isInteger(ply) || ply <= 0) {
    throw new AppError('ply must be a positive integer.', 400);
  }

  const expectedColor = ply % 2 === 1 ? 'white' : 'black';

  if (color !== expectedColor) {
    throw new AppError(`color must match ply parity for ply ${ply}.`, 400);
  }

  if (moveNumber !== Math.ceil(ply / 2)) {
    throw new AppError(`moveNumber must match ply ${ply}.`, 400);
  }
};

const normalizeQuestion = (value: unknown) => {
  if (value === undefined) {
    return undefined;
  }

  if (!isRecord(value)) {
    throw new AppError('question must be an object.', 400);
  }

  const prompt = normalizeRequiredString(value.prompt, 'question.prompt');
  const candidateMoves = normalizeStringArray(value.candidateMoves);
  const correctMove = normalizeOptionalString(value.correctMove);

  if (correctMove && candidateMoves.length > 0 && !candidateMoves.includes(correctMove)) {
    throw new AppError('question.candidateMoves must include question.correctMove.', 400);
  }

  return {
    prompt,
    candidateMoves,
    correctMove,
    explanation: normalizeOptionalString(value.explanation),
    hints: normalizeStringArray(value.hints),
  };
};

const normalizeAnnotatedMove = (value: unknown): MasterReplayAnnotatedMove => {
  if (!isRecord(value)) {
    throw new AppError('annotatedMove must be an object.', 400);
  }

  const ply = Number(value.ply);
  const moveNumber = Number(value.moveNumber);
  const color = validateEnum(value.color, ORIENTATIONS, 'annotatedMove.color');

  if (!color) {
    throw new AppError('annotatedMove.color is required.', 400);
  }

  validatePlyShape(ply, moveNumber, color);

  return {
    ply,
    moveNumber,
    color,
    san: normalizeRequiredString(value.san, 'annotatedMove.san'),
    uci: normalizeOptionalString(value.uci),
    fenBefore: normalizeOptionalString(value.fenBefore),
    fenAfter: normalizeOptionalString(value.fenAfter),
    comment: normalizeOptionalString(value.comment),
    shortComment: normalizeOptionalString(value.shortComment),
    annotationType: validateEnum(
      value.annotationType,
      ANNOTATION_TYPES,
      'annotatedMove.annotationType',
    ),
    arrows: Array.isArray(value.arrows) ? (value.arrows as MasterReplayAnnotatedMove['arrows']) : [],
    highlightSquares: normalizeStringArray(value.highlightSquares),
    evalBefore: typeof value.evalBefore === 'number' ? value.evalBefore : undefined,
    evalAfter: typeof value.evalAfter === 'number' ? value.evalAfter : undefined,
    isGuessMove: value.isGuessMove === true,
    question: normalizeQuestion(value.question),
  };
};

const sortAnnotatedMoves = (moves: MasterReplayAnnotatedMove[]): MasterReplayAnnotatedMove[] => {
  return [...moves].sort((left, right) => left.ply - right.ply);
};

const validateAnnotatedMoves = (moves: MasterReplayAnnotatedMove[]): MasterReplayAnnotatedMove[] => {
  const seenPly = new Set<number>();

  for (const move of moves) {
    if (seenPly.has(move.ply)) {
      throw new AppError(`annotatedMoves contains duplicate ply ${move.ply}.`, 409);
    }

    seenPly.add(move.ply);
  }

  return sortAnnotatedMoves(moves);
};

const normalizeKeyMoment = (value: unknown): MasterReplayKeyMoment => {
  if (!isRecord(value)) {
    throw new AppError('keyMoment must be an object.', 400);
  }

  const ply = Number(value.ply);
  const moveNumber = Number(value.moveNumber);
  const color = validateEnum(value.color, ORIENTATIONS, 'keyMoment.color');
  const type = validateEnum(value.type, MOMENT_TYPES, 'keyMoment.type');

  if (!color || !type) {
    throw new AppError('keyMoment.color and keyMoment.type are required.', 400);
  }

  validatePlyShape(ply, moveNumber, color);

  return {
    id: normalizeOptionalString(value.id) ?? randomUUID(),
    ply,
    moveNumber,
    color,
    title: normalizeRequiredString(value.title, 'keyMoment.title'),
    description: normalizeRequiredString(value.description, 'keyMoment.description'),
    type,
    fen: normalizeOptionalString(value.fen),
    question: normalizeOptionalString(value.question),
    answer: normalizeOptionalString(value.answer),
    lesson: normalizeOptionalString(value.lesson),
    order: typeof value.order === 'number' ? value.order : 0,
  };
};

const validateKeyMoments = (moments: MasterReplayKeyMoment[]): MasterReplayKeyMoment[] => {
  const ids = new Set<string>();

  for (const moment of moments) {
    if (!moment.id) {
      moment.id = randomUUID();
    }

    if (ids.has(moment.id)) {
      throw new AppError(`keyMoments contains duplicate id ${moment.id}.`, 409);
    }

    ids.add(moment.id);
  }

  return [...moments].sort((left, right) =>
    left.order === right.order ? left.ply - right.ply : left.order - right.order,
  );
};

const computeMoveCount = (
  annotatedMoves: MasterReplayAnnotatedMove[],
  fallback?: number,
): number | undefined => {
  if (annotatedMoves.length > 0) {
    return Math.ceil(annotatedMoves[annotatedMoves.length - 1].ply / 2);
  }

  return fallback;
};

const escapeRegex = (value: string): string => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const toSummary = (game: MasterReplayGameDocument) => ({
  _id: game._id,
  title: game.title,
  slug: game.slug,
  description: game.description,
  status: game.status,
  category: game.category,
  difficulty: game.difficulty,
  tags: game.tags,
  players: game.players,
  gameInfo: game.gameInfo,
  moveCount: game.moveCount,
  keyMomentsCount: game.keyMoments.length,
  annotatedMovesCount: game.annotatedMoves.length,
  order: game.order,
  createdAt: game.createdAt,
  updatedAt: game.updatedAt,
});

const ensureGame = async (gameId: string): Promise<MasterReplayGameDocument> => {
  const game = await masterReplayRepository.findGameById(gameId);

  if (!game) {
    throw new AppError('Master Replay game not found.', 404);
  }

  return game;
};

const ensureSlugAvailable = async (slug: string, currentGameId?: string): Promise<void> => {
  const existing = await masterReplayRepository.findGameBySlug(slug);

  if (existing && existing._id.toString() !== currentGameId) {
    throw new AppError('Master Replay slug already exists.', 409);
  }
};

const buildGamePayload = (body: unknown, createdBy?: string): Record<string, unknown> => {
  if (!isRecord(body)) {
    throw new AppError('The request body must be an object.', 400);
  }

  const category = validateEnum(body.category, CATEGORIES, 'category');
  const difficulty = validateEnum(body.difficulty, DIFFICULTIES, 'difficulty');

  if (!category || !difficulty) {
    throw new AppError('category and difficulty are required.', 400);
  }

  if (!isRecord(body.players)) {
    throw new AppError('players is required.', 400);
  }

  const annotatedMoves = Array.isArray(body.annotatedMoves)
    ? validateAnnotatedMoves(body.annotatedMoves.map(normalizeAnnotatedMove))
    : [];
  const keyMoments = Array.isArray(body.keyMoments)
    ? validateKeyMoments(body.keyMoments.map(normalizeKeyMoment))
    : [];

  return {
    title: normalizeRequiredString(body.title, 'title'),
    slug: normalizeRequiredString(body.slug, 'slug').toLowerCase(),
    description: normalizeOptionalString(body.description),
    status: validateEnum(body.status, STATUSES, 'status') ?? 'draft',
    category,
    difficulty,
    tags: normalizeStringArray(body.tags),
    players: {
      white: normalizeRequiredString(body.players.white, 'players.white'),
      black: normalizeRequiredString(body.players.black, 'players.black'),
    },
    gameInfo: isRecord(body.gameInfo) ? body.gameInfo : {},
    pgn: normalizeRequiredString(body.pgn, 'pgn'),
    initialFen: normalizeOptionalString(body.initialFen),
    orientation: validateEnum(body.orientation, ORIENTATIONS, 'orientation') ?? 'white',
    moveCount:
      computeMoveCount(
        annotatedMoves,
        typeof body.moveCount === 'number' ? body.moveCount : undefined,
      ) ?? undefined,
    replayMode: isRecord(body.replayMode)
      ? {
          sideToGuess:
            validateEnum(body.replayMode.sideToGuess, SIDES_TO_GUESS, 'replayMode.sideToGuess') ??
            'both',
          showEngineEval: body.replayMode.showEngineEval === true,
          showHints: body.replayMode.showHints !== false,
          allowRetry: body.replayMode.allowRetry !== false,
        }
      : {
          sideToGuess: 'both',
          showEngineEval: false,
          showHints: true,
          allowRetry: true,
        },
    annotatedMoves,
    keyMoments,
    studySummary: isRecord(body.studySummary)
      ? {
          coreLesson: normalizeOptionalString(body.studySummary.coreLesson),
          whatToLearn: normalizeStringArray(body.studySummary.whatToLearn),
          typicalMistakes: normalizeStringArray(body.studySummary.typicalMistakes),
          modelIdeas: normalizeStringArray(body.studySummary.modelIdeas),
        }
      : undefined,
    order: typeof body.order === 'number' ? body.order : 0,
    createdBy: createdBy,
  };
};

export const createGame = async (userId: string, body: unknown) => {
  const payload = buildGamePayload(body, userId);
  await ensureSlugAvailable(String(payload.slug));
  return masterReplayRepository.createGame(payload);
};

export const listGames = async (query: Record<string, unknown>, canPreview: boolean) => {
  const page = Math.max(Number(query.page) || 1, 1);
  const limit = Math.min(Math.max(Number(query.limit) || 20, 1), 100);
  const filters: Record<string, unknown> = {};

  const status = validateEnum(query.status, STATUSES, 'status');
  if (status) {
    filters.status = canPreview ? status : status === 'published' ? 'published' : 'published';
  } else {
    filters.status = canPreview ? { $ne: 'archived' } : 'published';
  }

  const category = validateEnum(query.category, CATEGORIES, 'category');
  if (category) {
    filters.category = category;
  }

  const difficulty = validateEnum(query.difficulty, DIFFICULTIES, 'difficulty');
  if (difficulty) {
    filters.difficulty = difficulty;
  }

  const tag = normalizeOptionalString(query.tag);
  if (tag) {
    filters.tags = tag;
  }

  const player = normalizeOptionalString(query.player);
  if (player) {
    const pattern = new RegExp(escapeRegex(player), 'i');
    filters.$or = [{ 'players.white': pattern }, { 'players.black': pattern }];
  }

  const search = normalizeOptionalString(query.search);
  if (search) {
    const pattern = new RegExp(escapeRegex(search), 'i');
    const searchOr = [
      { title: pattern },
      { description: pattern },
      { 'players.white': pattern },
      { 'players.black': pattern },
      { tags: pattern },
      { 'gameInfo.opening': pattern },
      { 'gameInfo.event': pattern },
    ];

    if (filters.$or) {
      filters.$and = [{ $or: filters.$or as unknown[] }, { $or: searchOr }];
      delete filters.$or;
    } else {
      filters.$or = searchOr;
    }
  }

  const { items, total } = await masterReplayRepository.paginateGames(filters, page, limit);

  return {
    items: items.map(toSummary),
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.max(Math.ceil(total / limit), 1),
    },
  };
};

const ensureReadable = (game: MasterReplayGameDocument, canPreview: boolean) => {
  if (game.status !== 'published' && !canPreview) {
    throw new AppError('Master Replay game not found.', 404);
  }

  return game;
};

export const getGameById = async (gameId: string, canPreview: boolean) => {
  const game = await ensureGame(gameId);
  return ensureReadable(game, canPreview);
};

export const updateGame = async (gameId: string, body: unknown) => {
  const game = await ensureGame(gameId);

  if (!isRecord(body)) {
    throw new AppError('The request body must be an object.', 400);
  }

  if (body.slug !== undefined) {
    game.slug = normalizeRequiredString(body.slug, 'slug').toLowerCase();
    await ensureSlugAvailable(game.slug, game._id.toString());
  }

  if (body.title !== undefined) game.title = normalizeRequiredString(body.title, 'title');
  if (body.description !== undefined) game.description = normalizeOptionalString(body.description);

  const status = validateEnum(body.status, STATUSES, 'status');
  if (status) game.status = status;

  const category = validateEnum(body.category, CATEGORIES, 'category');
  if (category) game.category = category;

  const difficulty = validateEnum(body.difficulty, DIFFICULTIES, 'difficulty');
  if (difficulty) game.difficulty = difficulty;

  if (body.tags !== undefined) game.tags = normalizeStringArray(body.tags);

  if (body.players !== undefined) {
    if (!isRecord(body.players)) throw new AppError('players must be an object.', 400);
    game.players = {
      white: normalizeRequiredString(body.players.white, 'players.white'),
      black: normalizeRequiredString(body.players.black, 'players.black'),
    };
  }

  if (body.gameInfo !== undefined) {
    game.gameInfo = isRecord(body.gameInfo) ? (body.gameInfo as MasterReplayGameDocument['gameInfo']) : game.gameInfo;
  }

  if (body.pgn !== undefined) game.pgn = normalizeRequiredString(body.pgn, 'pgn');
  if (body.initialFen !== undefined) game.initialFen = normalizeOptionalString(body.initialFen);

  const orientation = validateEnum(body.orientation, ORIENTATIONS, 'orientation');
  if (orientation) game.orientation = orientation;

  if (body.replayMode !== undefined) {
    if (!isRecord(body.replayMode)) throw new AppError('replayMode must be an object.', 400);
    game.replayMode = {
      sideToGuess:
        validateEnum(body.replayMode.sideToGuess, SIDES_TO_GUESS, 'replayMode.sideToGuess') ??
        game.replayMode.sideToGuess ??
        'both',
      showEngineEval:
        body.replayMode.showEngineEval === undefined
          ? game.replayMode.showEngineEval
          : body.replayMode.showEngineEval === true,
      showHints:
        body.replayMode.showHints === undefined
          ? game.replayMode.showHints
          : body.replayMode.showHints !== false,
      allowRetry:
        body.replayMode.allowRetry === undefined
          ? game.replayMode.allowRetry
          : body.replayMode.allowRetry !== false,
    };
  }

  if (body.annotatedMoves !== undefined) {
    if (!Array.isArray(body.annotatedMoves)) {
      throw new AppError('annotatedMoves must be an array.', 400);
    }
    game.annotatedMoves = validateAnnotatedMoves(body.annotatedMoves.map(normalizeAnnotatedMove));
  }

  if (body.keyMoments !== undefined) {
    if (!Array.isArray(body.keyMoments)) {
      throw new AppError('keyMoments must be an array.', 400);
    }
    game.keyMoments = validateKeyMoments(body.keyMoments.map(normalizeKeyMoment));
  }

  if (body.studySummary !== undefined) {
    game.studySummary = isRecord(body.studySummary)
      ? ({
          coreLesson: normalizeOptionalString(body.studySummary.coreLesson),
          whatToLearn: normalizeStringArray(body.studySummary.whatToLearn),
          typicalMistakes: normalizeStringArray(body.studySummary.typicalMistakes),
          modelIdeas: normalizeStringArray(body.studySummary.modelIdeas),
        } as MasterReplayGameDocument['studySummary'])
      : undefined;
  }

  if (body.order !== undefined && typeof body.order === 'number') {
    game.order = body.order;
  }

  game.moveCount =
    computeMoveCount(
      game.annotatedMoves as unknown as MasterReplayAnnotatedMove[],
      typeof body.moveCount === 'number' ? body.moveCount : game.moveCount,
    ) ?? game.moveCount;

  return masterReplayRepository.saveGame(game);
};

export const archiveGame = async (gameId: string) => {
  const game = await ensureGame(gameId);
  game.status = 'archived';
  return masterReplayRepository.saveGame(game);
};

export const addAnnotatedMove = async (gameId: string, body: unknown) => {
  const game = await ensureGame(gameId);
  const move = normalizeAnnotatedMove(body);

  if (game.annotatedMoves.some((item) => item.ply === move.ply)) {
    throw new AppError(`Annotated move for ply ${move.ply} already exists.`, 409);
  }

  game.annotatedMoves = validateAnnotatedMoves([
    ...(game.annotatedMoves as unknown as MasterReplayAnnotatedMove[]),
    move,
  ]) as unknown as MasterReplayGameDocument['annotatedMoves'];
  game.moveCount = computeMoveCount(game.annotatedMoves as unknown as MasterReplayAnnotatedMove[], game.moveCount);
  await masterReplayRepository.saveGame(game);

  return move;
};

export const updateAnnotatedMove = async (gameId: string, plyParam: string, body: unknown) => {
  const game = await ensureGame(gameId);
  const ply = Number(plyParam);

  if (!Number.isInteger(ply) || ply <= 0) {
    throw new AppError('Invalid ply parameter.', 400);
  }

  if (!isRecord(body)) {
    throw new AppError('The request body must be an object.', 400);
  }

  if (body.ply !== undefined && Number(body.ply) !== ply) {
    throw new AppError('ply cannot be changed through this endpoint.', 400);
  }

  const index = game.annotatedMoves.findIndex((item) => item.ply === ply);
  if (index === -1) {
    throw new AppError('Annotated move not found.', 404);
  }

  const current = game.annotatedMoves[index] as unknown as MasterReplayAnnotatedMove;
  const updated = normalizeAnnotatedMove({
    ...current,
    ...body,
    ply: current.ply,
  });
  game.annotatedMoves[index] = updated as unknown as MasterReplayGameDocument['annotatedMoves'][number];
  game.annotatedMoves = validateAnnotatedMoves(
    game.annotatedMoves as unknown as MasterReplayAnnotatedMove[],
  ) as unknown as MasterReplayGameDocument['annotatedMoves'];
  game.moveCount = computeMoveCount(game.annotatedMoves as unknown as MasterReplayAnnotatedMove[], game.moveCount);
  await masterReplayRepository.saveGame(game);

  return updated;
};

export const deleteAnnotatedMove = async (gameId: string, plyParam: string) => {
  const game = await ensureGame(gameId);
  const ply = Number(plyParam);

  if (!Number.isInteger(ply) || ply <= 0) {
    throw new AppError('Invalid ply parameter.', 400);
  }

  game.annotatedMoves = (game.annotatedMoves as unknown as MasterReplayAnnotatedMove[])
    .filter((item) => item.ply !== ply) as unknown as MasterReplayGameDocument['annotatedMoves'];
  game.moveCount = computeMoveCount(game.annotatedMoves as unknown as MasterReplayAnnotatedMove[], game.moveCount);
  await masterReplayRepository.saveGame(game);

  return { removedPly: ply };
};

export const addKeyMoment = async (gameId: string, body: unknown) => {
  const game = await ensureGame(gameId);
  const moment = normalizeKeyMoment(body);

  if (!moment.id) {
    moment.id = randomUUID();
  }

  game.keyMoments = validateKeyMoments([
    ...(game.keyMoments as unknown as MasterReplayKeyMoment[]),
    moment,
  ]) as unknown as MasterReplayGameDocument['keyMoments'];
  await masterReplayRepository.saveGame(game);

  return moment;
};

export const updateKeyMoment = async (
  gameId: string,
  momentId: string,
  body: unknown,
) => {
  const game = await ensureGame(gameId);
  const normalizedMomentId = normalizeRequiredString(momentId, 'momentId');
  const index = game.keyMoments.findIndex((item) => item.id === normalizedMomentId);

  if (index === -1) {
    throw new AppError('Key moment not found.', 404);
  }

  if (!isRecord(body)) {
    throw new AppError('The request body must be an object.', 400);
  }

  const current = game.keyMoments[index] as unknown as MasterReplayKeyMoment;
  const updated = normalizeKeyMoment({
    ...current,
    ...body,
    id: current.id,
  });

  game.keyMoments[index] = updated as unknown as MasterReplayGameDocument['keyMoments'][number];
  game.keyMoments = validateKeyMoments(
    game.keyMoments as unknown as MasterReplayKeyMoment[],
  ) as unknown as MasterReplayGameDocument['keyMoments'];
  await masterReplayRepository.saveGame(game);

  return updated;
};

export const deleteKeyMoment = async (gameId: string, momentId: string) => {
  const game = await ensureGame(gameId);
  const normalizedMomentId = normalizeRequiredString(momentId, 'momentId');
  game.keyMoments = (game.keyMoments as unknown as MasterReplayKeyMoment[])
    .filter((item) => item.id !== normalizedMomentId) as unknown as MasterReplayGameDocument['keyMoments'];
  await masterReplayRepository.saveGame(game);

  return { removedMomentId: normalizedMomentId };
};

export const getPlayableGameById = async (gameId: string, canPreview: boolean) => {
  const game = await ensureGame(gameId);
  return ensureReadable(game, canPreview);
};

export const getPlayableGameBySlug = async (slug: string, canPreview: boolean) => {
  const game = await masterReplayRepository.findGameBySlug(slug);

  if (!game) {
    throw new AppError('Master Replay game not found.', 404);
  }

  return ensureReadable(game, canPreview);
};
