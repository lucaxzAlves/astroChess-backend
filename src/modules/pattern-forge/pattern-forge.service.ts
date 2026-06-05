import { createReadStream } from 'node:fs';
import readline from 'node:readline';

import type { AnyBulkWriteOperation } from 'mongoose';
import { Types } from 'mongoose';

import { AppError } from '../../utils/AppError';
import { getPlayerProfile } from '../player-profile/player-profile.service';
import type { PlayerProfileDocument } from '../player-profile/player-profile.types';
import { PatternForgeAttempt } from './pattern-forge-attempt.model';
import { PatternForgeCycle } from './pattern-forge-cycle.model';
import { PatternForgeDailySession } from './pattern-forge-daily-session.model';
import { buildPuzzlePayloadFromCsvRow, parseCsvLine } from './pattern-forge.puzzle-import';
import { Puzzle } from './puzzle.model';
import { ALL_PATTERN_FORGE_THEMES, PATTERN_FORGE_THEME_MAP } from './pattern-forge.theme-map';
import type {
  CreatePatternForgeCycleBody,
  GeneratePatternForgePuzzleSetInput,
  ImportPuzzleCsvRow,
  NormalizedPuzzleDifficulty,
  PatternForgeAttemptDocument,
  PatternForgeAttemptResult,
  PatternForgeCycleConfigInput,
  PatternForgeCycleDocument,
  PatternForgeDerivedThemes,
  PatternForgeDailySessionDocument,
  PatternForgePuzzlePublic,
  PatternForgeRoundPlan,
  PatternForgeThemeKey,
  PatternForgeThemeReason,
  PuzzleDocument,
} from './pattern-forge.types';

const MIN_POPULARITY_THRESHOLD = -100;
const SLOW_SOLVE_THRESHOLD_SECONDS: Record<NormalizedPuzzleDifficulty, number> = {
  beginner: 75,
  intermediate: 90,
  advanced: 120,
  expert: 150,
};

const isRecord = (value: unknown): value is Record<string, unknown> => {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
};

const ensureObjectId = (value: string, fieldName: string): Types.ObjectId => {
  if (!Types.ObjectId.isValid(value)) {
    throw new AppError(`Invalid ${fieldName}.`, 400);
  }

  return new Types.ObjectId(value);
};

const normalizeText = (value: string): string =>
  value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();

const unique = <TValue>(values: TValue[]): TValue[] => Array.from(new Set(values));

const sanitizeManualPuzzleThemes = (values: unknown): string[] => {
  if (!Array.isArray(values)) {
    return [];
  }

  return unique(
    values
      .filter((value): value is string => typeof value === 'string')
      .map((value) => value.trim())
      .filter((value) => value.length > 0),
  );
};

const getAuthenticatedUsernameFallback = (
  username: string,
  playerProfile: PlayerProfileDocument | null,
): string => {
  const trimmedUsername = username.trim();

  if (trimmedUsername) {
    return trimmedUsername;
  }

  return (
    playerProfile?.identities?.chessCom?.username ??
    playerProfile?.identities?.lichess?.username ??
    'pattern-forge-user'
  );
};

const getDifficultyRatingRange = (
  difficulty: NormalizedPuzzleDifficulty,
  minRating?: number,
  maxRating?: number,
) => {
  const defaults: Record<NormalizedPuzzleDifficulty, { min: number; max: number }> = {
    beginner: { min: 600, max: 1399 },
    intermediate: { min: 1400, max: 1899 },
    advanced: { min: 1900, max: 2299 },
    expert: { min: 2300, max: 3200 },
  };

  return {
    minRating: minRating ?? defaults[difficulty].min,
    maxRating: maxRating ?? defaults[difficulty].max,
  };
};

const normalizePatternForgeDifficulty = (value: unknown): NormalizedPuzzleDifficulty | null => {
  if (typeof value !== 'string') {
    return null;
  }

  const difficultyMap: Record<string, NormalizedPuzzleDifficulty> = {
    adaptive: 'intermediate',
    comfortable: 'beginner',
    challenging: 'advanced',
    punishing: 'expert',
    beginner: 'beginner',
    intermediate: 'intermediate',
    advanced: 'advanced',
    expert: 'expert',
  };

  return difficultyMap[value.trim()] ?? null;
};

const deterministicScore = (input: string): number => {
  let hash = 0;

  for (let index = 0; index < input.length; index += 1) {
    hash = (hash * 31 + input.charCodeAt(index)) >>> 0;
  }

  return hash;
};

const startOfToday = (): Date => {
  const date = new Date();
  date.setHours(0, 0, 0, 0);
  return date;
};

const uniqueObjectIds = (values: Types.ObjectId[]): Types.ObjectId[] => {
  const seen = new Set<string>();
  const result: Types.ObjectId[] = [];

  for (const value of values) {
    const key = value.toString();

    if (seen.has(key)) {
      continue;
    }

    seen.add(key);
    result.push(value);
  }

  return result;
};

const countOccurrencesByObjectId = (values: Types.ObjectId[]): Map<string, number> => {
  const counts = new Map<string, number>();

  for (const value of values) {
    const key = value.toString();
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }

  return counts;
};

const isThemeKey = (value: string): value is PatternForgeThemeKey => {
  return (ALL_PATTERN_FORGE_THEMES as readonly string[]).includes(value);
};

const getThemeKeywords = (value: string): PatternForgeThemeKey[] => {
  const normalized = normalizeText(value);
  const themes = new Set<PatternForgeThemeKey>();

  if (
    normalized.includes('tactic') ||
    normalized.includes('fork') ||
    normalized.includes('pin') ||
    normalized.includes('combina')
  ) {
    themes.add('tactics');
    themes.add('calculation');
  }

  if (normalized.includes('calculate') || normalized.includes('calculation')) {
    themes.add('calculation');
  }

  if (normalized.includes('king') || normalized.includes('mate') || normalized.includes('safety')) {
    themes.add('king_safety');
  }

  if (normalized.includes('endgame') || normalized.includes('rook ending')) {
    themes.add('endgames');
  }

  if (normalized.includes('convert') || normalized.includes('conversion')) {
    themes.add('conversion');
  }

  if (normalized.includes('defend') || normalized.includes('defensive')) {
    themes.add('defensive_resources');
  }

  if (normalized.includes('time') || normalized.includes('clock')) {
    themes.add('time_pressure');
  }

  if (normalized.includes('candidate')) {
    themes.add('candidate_moves');
  }

  if (normalized.includes('pawn')) {
    themes.add('pawn_breaks');
  }

  if (normalized.includes('opening') || normalized.includes('repertoire')) {
    themes.add('openings');
  }

  return [...themes];
};

const addReason = (
  reasonMap: Map<PatternForgeThemeKey, PatternForgeThemeReason>,
  reason: PatternForgeThemeReason,
): void => {
  const existing = reasonMap.get(reason.theme);

  if (!existing || existing.confidence < reason.confidence) {
    reasonMap.set(reason.theme, reason);
  }
};

export const derivePatternForgeThemesFromPlayerProfile = (
  playerProfile: PlayerProfileDocument | null,
): PatternForgeDerivedThemes => {
  if (!playerProfile) {
    return {
      themes: [],
      reasons: [],
    };
  }

  const reasonMap = new Map<PatternForgeThemeKey, PatternForgeThemeReason>();
  const skillMap = playerProfile.skillMap?.categories;

  const addSkillReason = (
    key: keyof typeof playerProfile.skillMap.categories,
    theme: PatternForgeThemeKey,
    threshold: number,
    reason: string,
  ) => {
    const score = skillMap?.[key]?.value;

    if (typeof score === 'number' && score <= threshold) {
      addReason(reasonMap, {
        theme,
        reason,
        sourceField: `skillMap.${key}`,
        confidence: Math.max(55, 100 - score),
      });
    }
  };

  addSkillReason('tacticalThemes', 'tactics', 65, 'Low tactical pattern score.');
  addSkillReason('calculation', 'calculation', 65, 'Low calculation score.');
  addSkillReason('endgames', 'endgames', 65, 'Endgame score suggests reinforcement.');
  addSkillReason('openings', 'openings', 65, 'Opening score suggests repertoire review.');
  addSkillReason('timeManagement', 'time_pressure', 70, 'Time management score is weak.');
  addSkillReason(
    'psychologicalResilience',
    'defensive_resources',
    65,
    'Low resilience score under pressure.',
  );

  for (const recurringMistake of playerProfile.recurringMistakes ?? []) {
    const joined = [
      recurringMistake.category,
      recurringMistake.name,
      recurringMistake.description,
    ]
      .filter(Boolean)
      .join(' ');

    for (const theme of getThemeKeywords(joined)) {
      addReason(reasonMap, {
        theme,
        reason: recurringMistake.name?.trim() || 'Recurring mistake detected in profile.',
        sourceField: 'recurringMistakes',
        confidence: 80,
      });
    }
  }

  for (const strengthOrFocus of [
    playerProfile.recommendations?.currentFocus,
    playerProfile.criticalPhaseWeakness?.description,
    playerProfile.decisionPatterns?.description,
    ...(playerProfile.goals?.focusAreas ?? []),
  ].filter((value): value is string => typeof value === 'string' && value.trim().length > 0)) {
    for (const theme of getThemeKeywords(strengthOrFocus)) {
      addReason(reasonMap, {
        theme,
        reason: strengthOrFocus,
        sourceField: 'recommendations/goals/decisionPatterns',
        confidence: 70,
      });
    }
  }

  const openingIssues = [
    ...(playerProfile.openingRepertoire?.asWhite ?? []),
    ...(playerProfile.openingRepertoire?.asBlack?.againstE4 ?? []),
    ...(playerProfile.openingRepertoire?.asBlack?.againstD4 ?? []),
    ...(playerProfile.openingRepertoire?.asBlack?.againstOther ?? []),
  ];

  for (const openingProfile of openingIssues) {
    if ((openingProfile.recurringIssues?.length ?? 0) > 0 || (openingProfile.commonMistakes?.length ?? 0) > 0) {
      addReason(reasonMap, {
        theme: 'openings',
        reason: openingProfile.name?.trim() || 'Opening issues detected in repertoire.',
        sourceField: 'openingRepertoire',
        confidence: 75,
      });
    }
  }

  const themes = [...reasonMap.keys()];

  return {
    themes,
    reasons: themes.map((theme) => reasonMap.get(theme)!).sort((left, right) => right.confidence - left.confidence),
  };
};

const getThemesMatchedByPuzzle = (
  puzzle: PuzzleDocument,
  targetThemes: string[],
): string[] => {
  const normalizedThemes = puzzle.themes.map((value) => normalizeText(value));
  const normalizedOpenings = puzzle.openingTags.map((value) => normalizeText(value));

  return targetThemes.filter((theme) => {
    if (!isThemeKey(theme)) {
      return normalizedThemes.includes(normalizeText(theme));
    }

    const mapping = PATTERN_FORGE_THEME_MAP[theme];
    const matchesTheme = mapping.lichessThemes.some((candidate) =>
      normalizedThemes.includes(normalizeText(candidate)),
    );
    const matchesOpeningTag = (mapping.openingTagKeywords ?? []).some((keyword) =>
      normalizedOpenings.some((openingTag) => openingTag.includes(normalizeText(keyword))),
    );

    return matchesTheme || matchesOpeningTag;
  });
};

const toPuzzlePublic = (puzzle: PuzzleDocument): PatternForgePuzzlePublic => {
  return {
    id: puzzle._id.toString(),
    externalId: puzzle.externalId,
    source: puzzle.source,
    playableFen: puzzle.playableFen,
    solutionMoves: puzzle.solutionMoves,
    rating: puzzle.rating,
    popularity: puzzle.popularity,
    themes: puzzle.themes,
    openingTags: puzzle.openingTags,
    normalizedDifficulty: puzzle.normalizedDifficulty,
    gameUrl: puzzle.gameUrl,
  };
};

export const getAvailablePatternForgeThemes = async () => {
  const themes = await Puzzle.aggregate<{ _id: string; count: number }>([
    { $match: { source: 'LICHESS' } },
    { $unwind: '$themes' },
    {
      $group: {
        _id: '$themes',
        count: { $sum: 1 },
      },
    },
    { $sort: { count: -1, _id: 1 } },
  ]).exec();

  return {
    success: true,
    themes: themes
      .filter((theme) => typeof theme._id === 'string' && theme._id.trim().length > 0)
      .map((theme) => ({
        id: theme._id,
        label: theme._id,
        count: theme.count,
      })),
  };
};

export const generatePatternForgePuzzleSet = async (
  input: GeneratePatternForgePuzzleSetInput,
) => {
  const derivedThemes =
    input.automaticThemesEnabled && input.includePersonalWeaknesses
      ? derivePatternForgeThemesFromPlayerProfile(input.playerProfile)
      : { themes: [], reasons: [] as PatternForgeThemeReason[] };
  const manualThemes = sanitizeManualPuzzleThemes(input.manualThemes);
  const automaticThemes = unique(derivedThemes.themes.filter(isThemeKey));
  const mergedThemes = unique([...automaticThemes, ...manualThemes]);
  const { minRating, maxRating } = getDifficultyRatingRange(
    input.difficulty,
    input.minRating,
    input.maxRating,
  );

  const themeClauses: Array<Record<string, unknown>> = mergedThemes.flatMap((theme) => {
    if (!isThemeKey(theme)) {
      return [{ themes: theme }];
    }

    const mapping = PATTERN_FORGE_THEME_MAP[theme];

    return [
      { themes: { $in: mapping.lichessThemes } },
      ...(mapping.openingTagKeywords?.length
        ? [{ openingTags: { $in: mapping.openingTagKeywords } }]
        : []),
    ] as Array<Record<string, unknown>>;
  });

  const query: Record<string, unknown> = {
    source: 'LICHESS',
    rating: { $gte: minRating, $lte: maxRating },
    popularity: { $gte: MIN_POPULARITY_THRESHOLD },
    normalizedDifficulty: input.difficulty,
  };

  if (themeClauses.length > 0) {
    query.$or = themeClauses;
  }

  let candidatePuzzles = await Puzzle.find(query).limit(Math.max(input.puzzleCount * 8, 120)).exec();

  if (candidatePuzzles.length < input.puzzleCount) {
    candidatePuzzles = await Puzzle.find({
      source: 'LICHESS',
      rating: { $gte: minRating, $lte: maxRating },
    })
      .limit(Math.max(input.puzzleCount * 10, 200))
      .exec();
  }

  if (candidatePuzzles.length === 0) {
    throw new AppError('No puzzles found for the selected Pattern Forge settings.', 404);
  }

  const pools = new Map<string | 'fallback', PuzzleDocument[]>();

  for (const puzzle of candidatePuzzles) {
    const matchedThemes = mergedThemes.length > 0 ? getThemesMatchedByPuzzle(puzzle, mergedThemes) : [];

    if (matchedThemes.length === 0) {
      const fallbackPool = pools.get('fallback') ?? [];
      fallbackPool.push(puzzle);
      pools.set('fallback', fallbackPool);
      continue;
    }

    for (const theme of matchedThemes) {
      const pool = pools.get(theme) ?? [];
      pool.push(puzzle);
      pools.set(theme, pool);
    }
  }

  for (const [theme, puzzles] of pools.entries()) {
    puzzles.sort((left, right) => {
      const leftScore = deterministicScore(`${input.userId}:${theme}:${left.externalId}`);
      const rightScore = deterministicScore(`${input.userId}:${theme}:${right.externalId}`);
      return rightScore - leftScore;
    });
  }

  const selected = new Map<string, PuzzleDocument>();
  const rotationOrder: Array<string | 'fallback'> =
    mergedThemes.length > 0 ? [...mergedThemes] : ['fallback'];
  let rotationIndex = 0;

  while (selected.size < input.puzzleCount) {
    const bucketKey = rotationOrder[rotationIndex % rotationOrder.length] ?? 'fallback';
    const bucket = pools.get(bucketKey) ?? [];
    const nextPuzzle = bucket.shift();

    rotationIndex += 1;

    if (!nextPuzzle) {
      if (rotationIndex > rotationOrder.length * Math.max(input.puzzleCount, 1)) {
        break;
      }
      continue;
    }

    selected.set(nextPuzzle._id.toString(), nextPuzzle);
  }

  if (selected.size < input.puzzleCount) {
    for (const puzzle of candidatePuzzles) {
      if (selected.size >= input.puzzleCount) {
        break;
      }
      selected.set(puzzle._id.toString(), puzzle);
    }
  }

  return {
    puzzles: [...selected.values()].slice(0, input.puzzleCount),
    automaticThemes,
    manualThemes,
    mergedThemes,
    themeReasons: derivedThemes.reasons,
    minRating,
    maxRating,
  };
};

const validateRules = (value: unknown): PatternForgeCycleConfigInput['rules'] => {
  if (!isRecord(value)) {
    throw new AppError('config.rules must be an object.', 400);
  }

  return {
    repeatMissedPuzzles: value.repeatMissedPuzzles !== false,
    repeatSlowSolves: value.repeatSlowSolves !== false,
    prioritizeWeaknesses: value.prioritizeWeaknesses !== false,
    endRoundWithMistakeReview: value.endRoundWithMistakeReview !== false,
  };
};

const validateRounds = (value: unknown): PatternForgeRoundPlan[] => {
  if (!Array.isArray(value) || value.length === 0) {
    throw new AppError('config.rounds must be a non-empty array.', 400);
  }

  return value.map((round, index) => {
    if (!isRecord(round)) {
      throw new AppError(`config.rounds[${index}] must be an object.`, 400);
    }

    const parsedRound = Number(round.round);
    const targetDays = Number(round.targetDays);
    const dailyTarget = Number(round.dailyTarget);

    if (!Number.isInteger(parsedRound) || parsedRound <= 0) {
      throw new AppError(`config.rounds[${index}].round must be a positive integer.`, 400);
    }

    if (!Number.isInteger(targetDays) || targetDays <= 0) {
      throw new AppError(`config.rounds[${index}].targetDays must be a positive integer.`, 400);
    }

    if (!Number.isInteger(dailyTarget) || dailyTarget <= 0) {
      throw new AppError(`config.rounds[${index}].dailyTarget must be a positive integer.`, 400);
    }

    return {
      round: parsedRound,
      targetDays,
      dailyTarget,
      goal: typeof round.goal === 'string' ? round.goal.trim() : undefined,
      status: index === 0 ? 'active' : 'pending',
      startedAt: index === 0 ? new Date() : undefined,
    };
  });
};

const validateCreateCycleBody = (body: unknown): CreatePatternForgeCycleBody => {
  if (!isRecord(body)) {
    throw new AppError('The request body must be an object.', 400);
  }

  if (typeof body.username !== 'string' || body.username.trim().length === 0) {
    throw new AppError('username is required.', 400);
  }

  if (!isRecord(body.config)) {
    throw new AppError('config is required and must be an object.', 400);
  }

  const puzzleCount = Number(body.config.puzzleCount);

  if (!Number.isInteger(puzzleCount) || puzzleCount <= 0) {
    throw new AppError('config.puzzleCount must be a positive integer.', 400);
  }

  const difficulty = normalizePatternForgeDifficulty(body.config.difficulty);

  if (!difficulty) {
    throw new AppError('config.difficulty must be valid.', 400);
  }

  const manualThemes = sanitizeManualPuzzleThemes(body.config.manualThemes);

  return {
    username: body.username.trim(),
    config: {
      puzzleCount,
      automaticThemesEnabled: body.config.automaticThemesEnabled !== false,
      manualThemes,
      difficulty,
      compressionPreset:
        typeof body.config.compressionPreset === 'string'
          ? body.config.compressionPreset.trim()
          : undefined,
      rounds: validateRounds(body.config.rounds),
      rules: validateRules(body.config.rules),
      includePersonalWeaknesses: body.config.includePersonalWeaknesses !== false,
      minRating:
        body.config.minRating !== undefined ? Number(body.config.minRating) : undefined,
      maxRating:
        body.config.maxRating !== undefined ? Number(body.config.maxRating) : undefined,
    },
  };
};

const getRotatedPuzzleIdsForDay = (
  cycle: PatternForgeCycleDocument,
  dayIndexZeroBased: number,
): Types.ObjectId[] => {
  if (cycle.puzzleIds.length === 0) {
    return [];
  }

  const offset = dayIndexZeroBased % cycle.puzzleIds.length;

  return [
    ...cycle.puzzleIds.slice(offset),
    ...cycle.puzzleIds.slice(0, offset),
  ];
};

const getSlowSolveThresholdSeconds = (difficulty: NormalizedPuzzleDifficulty): number => {
  return SLOW_SOLVE_THRESHOLD_SECONDS[difficulty];
};

const getOrderedPuzzlesForSession = async (
  session: PatternForgeDailySessionDocument,
): Promise<PuzzleDocument[]> => {
  const puzzles = await Puzzle.find({
    _id: { $in: session.puzzleIds },
  }).exec();
  const puzzleMap = new Map(puzzles.map((puzzle) => [puzzle._id.toString(), puzzle]));

  return session.puzzleIds.reduce<PuzzleDocument[]>((orderedPuzzles, puzzleId) => {
    const puzzle = puzzleMap.get(puzzleId.toString());

    if (puzzle) {
      orderedPuzzles.push(puzzle);
    }

    return orderedPuzzles;
  }, []);
};

const getRoundSessions = async (
  cycleId: Types.ObjectId,
  round: number,
): Promise<PatternForgeDailySessionDocument[]> => {
  return PatternForgeDailySession.find({
    cycleId,
    round,
  }).exec();
};

const getAttemptsForSessions = async (
  sessionIds: Types.ObjectId[],
): Promise<PatternForgeAttemptDocument[]> => {
  if (sessionIds.length === 0) {
    return [];
  }

  return PatternForgeAttempt.find({
    sessionId: { $in: sessionIds },
  }).exec();
};

const getScheduledPuzzleIdsInRound = async (
  cycle: PatternForgeCycleDocument,
  round: number,
): Promise<Set<string>> => {
  const sessions = await getRoundSessions(cycle._id, round);
  const scheduled = new Set<string>();

  for (const session of sessions) {
    for (const puzzleId of session.puzzleIds) {
      scheduled.add(puzzleId.toString());
    }
  }

  return scheduled;
};

const getCompletedPuzzleIdsInRound = async (
  cycle: PatternForgeCycleDocument,
  round: number,
): Promise<Set<string>> => {
  const sessions = await getRoundSessions(cycle._id, round);
  const completed = new Set<string>();

  for (const session of sessions) {
    for (const puzzleId of session.completedPuzzleIds) {
      completed.add(puzzleId.toString());
    }
  }

  return completed;
};

const queuePuzzleForRepetition = (
  cycle: PatternForgeCycleDocument,
  puzzleId: Types.ObjectId,
  reason: 'wrong' | 'slow',
): void => {
  const existing = cycle.mistakeQueue.find((entry) => entry.puzzleId.toString() === puzzleId.toString());

  if (existing) {
    existing.reason = existing.reason === 'wrong' ? 'wrong' : reason;
    existing.queuedAt = new Date();
    return;
  }

  cycle.mistakeQueue.push({
    puzzleId,
    reason,
    queuedAt: new Date(),
    servedCount: 0,
  });
};

const removePuzzleFromQueue = (
  cycle: PatternForgeCycleDocument,
  puzzleId: Types.ObjectId,
): void => {
  cycle.mistakeQueue = cycle.mistakeQueue.filter(
    (entry) => entry.puzzleId.toString() !== puzzleId.toString(),
  );
};

const getCurrentRoundPlan = (cycle: PatternForgeCycleDocument): PatternForgeRoundPlan => {
  const roundPlan = cycle.repetitionPlan.rounds.find(
    (round) => round.round === cycle.repetitionPlan.currentRound,
  );

  if (!roundPlan) {
    throw new AppError('Pattern Forge cycle round plan is invalid.', 500);
  }

  return roundPlan;
};

const getOrCreateTodaySession = async (
  cycle: PatternForgeCycleDocument,
): Promise<PatternForgeDailySessionDocument> => {
  const today = startOfToday();
  const currentRound = cycle.repetitionPlan.currentRound;
  const existingSession = await PatternForgeDailySession.findOne({
    cycleId: cycle._id,
    date: today,
    round: currentRound,
  }).exec();

  if (existingSession) {
    cycle.progress.currentDay = await PatternForgeDailySession.countDocuments({
      cycleId: cycle._id,
      round: currentRound,
    }).exec();
    return existingSession;
  }

  const roundPlan = getCurrentRoundPlan(cycle);
  const existingRoundSessionsCount = await PatternForgeDailySession.countDocuments({
    cycleId: cycle._id,
    round: currentRound,
  }).exec();
  const scheduledInRound = await getScheduledPuzzleIdsInRound(cycle, currentRound);
  const queueCandidates = cycle.rules.prioritizeWeaknesses
    ? cycle.mistakeQueue.filter(
        (entry) => !scheduledInRound.has(entry.puzzleId.toString()),
      )
    : [];
  const queuePuzzleIds = uniqueObjectIds(queueCandidates.map((entry) => entry.puzzleId));
  const remainingUniqueInRound = Math.max(0, cycle.puzzleIds.length - scheduledInRound.size);
  const baseTargetPuzzles = Math.min(roundPlan.dailyTarget, remainingUniqueInRound || cycle.puzzleIds.length);
  const sessionCapacity = Math.min(
    remainingUniqueInRound || cycle.puzzleIds.length,
    Math.max(baseTargetPuzzles, roundPlan.dailyTarget * 2),
  );
  const targetPuzzles = Math.max(baseTargetPuzzles, sessionCapacity);
  const selectedPuzzleIds: Types.ObjectId[] = queuePuzzleIds.slice(0, targetPuzzles);
  const freshCandidates = getRotatedPuzzleIdsForDay(cycle, existingRoundSessionsCount).filter(
    (puzzleId) =>
      !scheduledInRound.has(puzzleId.toString()) &&
      !selectedPuzzleIds.some((selectedPuzzleId) => selectedPuzzleId.toString() === puzzleId.toString()),
  );

  for (const puzzleId of freshCandidates) {
    if (selectedPuzzleIds.length >= targetPuzzles) {
      break;
    }

    selectedPuzzleIds.push(puzzleId);
  }

  if (selectedPuzzleIds.length < targetPuzzles) {
    for (const puzzleId of cycle.puzzleIds) {
      if (selectedPuzzleIds.length >= targetPuzzles) {
        break;
      }

      if (
        !scheduledInRound.has(puzzleId.toString()) &&
        !selectedPuzzleIds.some((selectedPuzzleId) => selectedPuzzleId.toString() === puzzleId.toString())
      ) {
        selectedPuzzleIds.push(puzzleId);
      }
    }
  }

  const session = await PatternForgeDailySession.create({
    cycleId: cycle._id,
    userId: cycle.userId,
    date: today,
    round: currentRound,
    dailyTarget: baseTargetPuzzles,
    targetPuzzles: selectedPuzzleIds.length,
    puzzleIds: selectedPuzzleIds,
    completedPuzzleIds: [],
    correctCount: 0,
    wrongCount: 0,
    skippedCount: 0,
    accuracy: 0,
    averageSolveTimeSeconds: 0,
    status: 'active',
  });

  for (const queueEntry of cycle.mistakeQueue) {
    if (selectedPuzzleIds.some((puzzleId) => puzzleId.toString() === queueEntry.puzzleId.toString())) {
      queueEntry.lastServedAt = new Date();
      queueEntry.servedCount = (queueEntry.servedCount ?? 0) + 1;
    }
  }

  cycle.progress.currentDay = existingRoundSessionsCount + 1;
  cycle.progress.completedToday = 0;
  cycle.progress.mistakesQueued = cycle.mistakeQueue.length;
  await cycle.save();

  return session;
};

const ensureCycleOwnership = (
  cycle: PatternForgeCycleDocument | null,
  userId: string,
): PatternForgeCycleDocument => {
  if (!cycle) {
    throw new AppError('Pattern Forge cycle not found.', 404);
  }

  if (cycle.userId.toString() !== userId) {
    throw new AppError('Forbidden', 403);
  }

  return cycle;
};

const buildTodaySessionResponse = async (cycle: PatternForgeCycleDocument) => {
  const todaySession = await getOrCreateTodaySession(cycle);
  const puzzles = (await getOrderedPuzzlesForSession(todaySession)).map(toPuzzlePublic);

  return {
    cycle,
    todaySession,
    puzzles,
    themeReasons: cycle.patternSet.themeReasons,
  };
};

export const createPatternForgeCycle = async (userId: string, body: unknown) => {
  const { username, config } = validateCreateCycleBody(body);
  const playerProfile = await getPlayerProfile(userId);
  const resolvedUsername = getAuthenticatedUsernameFallback(username, playerProfile);
  const existingActiveCycle = await PatternForgeCycle.findOne({
    userId: ensureObjectId(userId, 'user id'),
    username: resolvedUsername,
    status: 'active',
  }).exec();

  if (existingActiveCycle) {
    throw new AppError('An active Pattern Forge cycle already exists for this username.', 409);
  }

  const generatedSet = await generatePatternForgePuzzleSet({
    userId,
    puzzleCount: config.puzzleCount,
    automaticThemesEnabled: config.automaticThemesEnabled,
    manualThemes: config.manualThemes,
    difficulty: config.difficulty,
    includePersonalWeaknesses: config.includePersonalWeaknesses ?? true,
    minRating: config.minRating,
    maxRating: config.maxRating,
    playerProfile,
  });

  const firstRound = config.rounds[0];
  const cycle = await PatternForgeCycle.create({
    userId: ensureObjectId(userId, 'user id'),
    username: resolvedUsername,
    source: 'pattern_forge',
    status: 'active',
    patternSet: {
      puzzleCount: config.puzzleCount,
      themes: generatedSet.mergedThemes,
      automaticThemesEnabled: config.automaticThemesEnabled,
      automaticThemes: generatedSet.automaticThemes,
      manualThemes: generatedSet.manualThemes,
      themeReasons: generatedSet.themeReasons,
      difficulty: config.difficulty,
      minRating: generatedSet.minRating,
      maxRating: generatedSet.maxRating,
      includePersonalWeaknesses: config.includePersonalWeaknesses ?? true,
    },
    repetitionPlan: {
      compressionPreset: config.compressionPreset,
      rounds: config.rounds,
      currentRound: firstRound.round,
    },
    rules: config.rules,
    puzzleIds: generatedSet.puzzles.map((puzzle) => puzzle._id),
    progress: {
      currentRound: firstRound.round,
      currentDay: 1,
      completedPuzzlesInRound: 0,
      completedToday: 0,
      totalSolvedAcrossCycle: 0,
      streakDays: 0,
      accuracy: 0,
      mistakesQueued: 0,
      roundAccuracy: 0,
      roundAverageSolveTimeSeconds: 0,
    },
  });

  const { todaySession, puzzles, themeReasons } = await buildTodaySessionResponse(cycle);

  return {
    success: true,
    cycle,
    todaySession,
    puzzles,
    themeReasons,
  };
};

export const getActivePatternForgeCycle = async (userId: string, username?: string) => {
  const cycle = await PatternForgeCycle.findOne({
    userId: ensureObjectId(userId, 'user id'),
    status: 'active',
    ...(username ? { username: username.trim() } : {}),
  })
    .sort({ updatedAt: -1 })
    .exec();

  if (!cycle) {
    return {
      success: true,
      cycle: null,
      todaySession: null,
      puzzles: [],
      themeReasons: [],
    };
  }

  const { todaySession, puzzles, themeReasons } = await buildTodaySessionResponse(cycle);

  return {
    success: true,
    cycle,
    todaySession,
    puzzles,
    themeReasons,
  };
};

const updateSessionMetrics = async (
  session: PatternForgeDailySessionDocument,
  cycle: PatternForgeCycleDocument,
): Promise<void> => {
  const attempts = await PatternForgeAttempt.find({ sessionId: session._id }).exec();
  const totalAttempts = attempts.length;
  const completedCount = session.completedPuzzleIds.length;
  const correctCount = session.correctCount;

  session.accuracy =
    totalAttempts > 0 ? Number(((correctCount / totalAttempts) * 100).toFixed(2)) : 0;
  session.averageSolveTimeSeconds =
    totalAttempts > 0
      ? Number(
          (
            attempts.reduce((sum, attempt) => sum + attempt.timeSpentSeconds, 0) / totalAttempts
          ).toFixed(2),
        )
      : 0;
  session.status = session.completedAt || completedCount >= session.targetPuzzles ? 'completed' : 'active';

  if (session.status === 'completed' && !session.completedAt) {
    session.completedAt = new Date();
  }

  await session.save();

  const roundSessions = await PatternForgeDailySession.find({
    cycleId: cycle._id,
    round: cycle.repetitionPlan.currentRound,
  }).exec();
  const allSessions = await PatternForgeDailySession.find({
    cycleId: cycle._id,
  }).exec();
  const roundAttempts = await getAttemptsForSessions(roundSessions.map((savedSession) => savedSession._id));
  const allAttempts = await PatternForgeAttempt.find({
    cycleId: cycle._id,
  }).exec();
  const roundCompleted = await getCompletedPuzzleIdsInRound(
    cycle,
    cycle.repetitionPlan.currentRound,
  );
  const roundAccuracy =
    roundAttempts.length > 0
      ? Number(
          (
            (roundAttempts.filter((attempt) => attempt.isCorrect).length / roundAttempts.length) *
            100
          ).toFixed(2),
        )
      : 0;
  const roundAverageSolveTimeSeconds =
    roundAttempts.length > 0
      ? Number(
          (
            roundAttempts.reduce((sum, attempt) => sum + attempt.timeSpentSeconds, 0) /
            roundAttempts.length
          ).toFixed(2),
        )
      : 0;

  cycle.progress.completedToday = completedCount;
  cycle.progress.completedPuzzlesInRound = roundCompleted.size;
  cycle.progress.totalSolvedAcrossCycle = allSessions.reduce(
    (sum, savedSession) => sum + savedSession.completedPuzzleIds.length,
    0,
  );
  cycle.progress.accuracy =
    allAttempts.length > 0
      ? Number(
          (
            (allAttempts.filter((attempt) => attempt.isCorrect).length / allAttempts.length) *
            100
          ).toFixed(2),
        )
      : 0;
  cycle.progress.streakDays = allSessions.filter((savedSession) => savedSession.status === 'completed').length;
  cycle.progress.mistakesQueued = cycle.mistakeQueue.length;
  cycle.progress.roundAccuracy = roundAccuracy;
  cycle.progress.roundAverageSolveTimeSeconds = roundAverageSolveTimeSeconds;

  const currentRoundPlan = getCurrentRoundPlan(cycle);
  currentRoundPlan.completedPuzzles = roundCompleted.size;
  currentRoundPlan.accuracy = roundAccuracy;
  currentRoundPlan.averageSolveTimeSeconds = roundAverageSolveTimeSeconds;

  if (session.status === 'completed') {
    const isRoundBaseSetCovered = roundCompleted.size >= cycle.puzzleIds.length;
    const hasPendingQueue = cycle.rules.endRoundWithMistakeReview
      ? cycle.mistakeQueue.length > 0
      : false;

    if (isRoundBaseSetCovered && !hasPendingQueue) {
      const roundToUpdate = cycle.repetitionPlan.rounds.find(
        (round) => round.round === cycle.repetitionPlan.currentRound,
      );

      if (roundToUpdate) {
        roundToUpdate.status = 'completed';
        roundToUpdate.completedAt = new Date();
      }

      const nextRound = cycle.repetitionPlan.rounds.find(
        (round) => round.round === cycle.repetitionPlan.currentRound + 1,
      );

      if (nextRound) {
        cycle.repetitionPlan.currentRound = nextRound.round;
        cycle.progress.currentRound = nextRound.round;
        cycle.progress.currentDay = 0;
        cycle.progress.completedPuzzlesInRound = 0;
        cycle.progress.roundAccuracy = 0;
        cycle.progress.roundAverageSolveTimeSeconds = 0;
        nextRound.status = 'active';
        nextRound.startedAt = nextRound.startedAt ?? new Date();
      } else {
        cycle.status = 'completed';
      }
    }
  }

  await cycle.save();
};

const getAttemptFailureIndex = (selectedMoves: string[], solutionMoves: string[]): number | undefined => {
  for (let index = 0; index < selectedMoves.length; index += 1) {
    if (selectedMoves[index] !== solutionMoves[index]) {
      return index;
    }
  }

  return undefined;
};

export const submitPatternForgeAttempt = async (
  userId: string,
  body: unknown,
): Promise<{ success: true; result: PatternForgeAttemptResult }> => {
  if (!isRecord(body)) {
    throw new AppError('The request body must be an object.', 400);
  }

  if (typeof body.cycleId !== 'string' || typeof body.sessionId !== 'string' || typeof body.puzzleId !== 'string') {
    throw new AppError('cycleId, sessionId and puzzleId are required.', 400);
  }

  const selectedMoves = Array.isArray(body.selectedMoves)
    ? body.selectedMoves.filter((move): move is string => typeof move === 'string').map((move) => move.trim())
    : [];
  const timeSpentSeconds = typeof body.timeSpentSeconds === 'number' ? body.timeSpentSeconds : 0;
  const usedReveal = body.usedReveal === true;
  const cycle = ensureCycleOwnership(await PatternForgeCycle.findById(body.cycleId).exec(), userId);
  const session = await PatternForgeDailySession.findById(ensureObjectId(body.sessionId, 'session id')).exec();

  if (!session || session.cycleId.toString() !== cycle._id.toString()) {
    throw new AppError('Pattern Forge session not found for this cycle.', 404);
  }

  if (session.status === 'completed') {
    throw new AppError('This Pattern Forge session has already been completed.', 400);
  }

  const puzzle = await Puzzle.findById(ensureObjectId(body.puzzleId, 'puzzle id')).exec();

  if (!puzzle || !session.puzzleIds.some((puzzleId) => puzzleId.toString() === puzzle._id.toString())) {
    throw new AppError('Puzzle not found in this session.', 404);
  }

  const normalizedSelectedMoves = selectedMoves.map((move) => move.toLowerCase());
  const normalizedSolutionMoves = puzzle.solutionMoves.map((move) => move.toLowerCase());
  const failedAtMoveIndex = getAttemptFailureIndex(normalizedSelectedMoves, normalizedSolutionMoves);
  const isComplete = normalizedSelectedMoves.length === normalizedSolutionMoves.length && failedAtMoveIndex === undefined;
  const isCorrect = isComplete;
  const isSlowSolve =
    isCorrect && timeSpentSeconds > getSlowSolveThresholdSeconds(puzzle.normalizedDifficulty);

  await PatternForgeAttempt.create({
    cycleId: cycle._id,
    sessionId: session._id,
    puzzleId: puzzle._id,
    userId: ensureObjectId(userId, 'user id'),
    selectedMoves: normalizedSelectedMoves,
    solutionMoves: puzzle.solutionMoves,
    isCorrect,
    isComplete,
    failedAtMoveIndex,
    timeSpentSeconds,
    usedReveal,
    theme: puzzle.themes[0],
    rating: puzzle.rating,
    difficulty: puzzle.normalizedDifficulty,
  });

  const scheduledCounts = countOccurrencesByObjectId(session.puzzleIds);
  const completedCounts = countOccurrencesByObjectId(session.completedPuzzleIds);
  const scheduledForPuzzle = scheduledCounts.get(puzzle._id.toString()) ?? 0;
  const completedForPuzzle = completedCounts.get(puzzle._id.toString()) ?? 0;
  const alreadyCompletedAllScheduledOccurrences = completedForPuzzle >= scheduledForPuzzle;

  if (!alreadyCompletedAllScheduledOccurrences) {
    session.completedPuzzleIds.push(puzzle._id);

    if (usedReveal || normalizedSelectedMoves.length === 0) {
      session.skippedCount += 1;
      if (cycle.rules.repeatMissedPuzzles) {
        queuePuzzleForRepetition(cycle, puzzle._id, 'wrong');
      }
    } else if (isCorrect) {
      session.correctCount += 1;
      if (cycle.rules.repeatSlowSolves && isSlowSolve) {
        queuePuzzleForRepetition(cycle, puzzle._id, 'slow');
      } else {
        removePuzzleFromQueue(cycle, puzzle._id);
      }
    } else {
      session.wrongCount += 1;
      if (cycle.rules.repeatMissedPuzzles) {
        queuePuzzleForRepetition(cycle, puzzle._id, 'wrong');
      }
    }
  }

  await updateSessionMetrics(session, cycle);

  return {
    success: true,
    result: {
      isCorrect,
      isComplete,
      failedAtMoveIndex,
      solutionMoves: puzzle.solutionMoves,
      explanation: isCorrect
        ? 'Correct sequence.'
        : `Correct sequence: ${puzzle.solutionMoves.join(' ')}`,
      puzzle: toPuzzlePublic(puzzle),
      sessionProgress: {
        completed: session.completedPuzzleIds.length,
        dailyTarget: session.dailyTarget,
        targetPuzzles: session.targetPuzzles,
        correctCount: session.correctCount,
        wrongCount: session.wrongCount,
        skippedCount: session.skippedCount,
        accuracy: session.accuracy,
        mistakesQueued: cycle.progress.mistakesQueued,
      },
      cycleProgress: {
        currentRound: cycle.progress.currentRound,
        currentDay: cycle.progress.currentDay,
        totalSolvedAcrossCycle: cycle.progress.totalSolvedAcrossCycle,
        accuracy: cycle.progress.accuracy,
        mistakesQueued: cycle.progress.mistakesQueued,
        roundAccuracy: cycle.progress.roundAccuracy,
        roundAverageSolveTimeSeconds: cycle.progress.roundAverageSolveTimeSeconds,
      },
    },
  };
};

const groupAttemptsByTheme = (attempts: PatternForgeAttemptDocument[]) => {
  const themeMap = new Map<string, { correct: number; wrong: number; totalTime: number; total: number }>();

  for (const attempt of attempts) {
    const theme = attempt.theme?.trim() || 'general';
    const current = themeMap.get(theme) ?? { correct: 0, wrong: 0, totalTime: 0, total: 0 };

    if (attempt.isCorrect) {
      current.correct += 1;
    } else {
      current.wrong += 1;
    }
    current.totalTime += attempt.timeSpentSeconds;
    current.total += 1;

    themeMap.set(theme, current);
  }

  return [...themeMap.entries()].map(([theme, value]) => ({
    theme,
    score: value.correct - value.wrong,
    attempts: value.total,
    correct: value.correct,
    wrong: value.wrong,
    misses: value.wrong,
    accuracy:
      value.total > 0 ? Number(((value.correct / value.total) * 100).toFixed(2)) : 0,
    averageSolveTimeSeconds:
      value.total > 0 ? Number((value.totalTime / value.total).toFixed(2)) : 0,
  }));
};

const buildRecommendedNextFocus = (params: {
  weakestThemes: Array<{ theme: string; accuracy: number; attempts: number }>;
  slowestThemes: Array<{ theme: string; averageSolveTimeSeconds: number; attempts: number }>;
  mostMissedPuzzleThemes: Array<{ theme: string; misses: number; attempts: number }>;
}): string => {
  const weakestTheme = params.weakestThemes[0];
  const slowestTheme = params.slowestThemes[0];
  const mostMissedTheme = params.mostMissedPuzzleThemes[0];

  if (weakestTheme && weakestTheme.accuracy < 70) {
    return `Reinforce ${weakestTheme.theme.replace(/_/g, ' ')}. Accuracy dipped to ${weakestTheme.accuracy}%.`;
  }

  if (mostMissedTheme && mostMissedTheme.misses > 0) {
    return `Review ${mostMissedTheme.theme.replace(/_/g, ' ')} patterns. It produced the most misses today.`;
  }

  if (slowestTheme && slowestTheme.averageSolveTimeSeconds > 90) {
    return `Speed up decision-making in ${slowestTheme.theme.replace(/_/g, ' ')}. It was the slowest theme today.`;
  }

  return 'Keep reinforcing the current mix and push for cleaner, faster solves tomorrow.';
};

export const completePatternForgeSession = async (userId: string, sessionId: string) => {
  const session = await PatternForgeDailySession.findById(ensureObjectId(sessionId, 'session id')).exec();

  if (!session || session.userId.toString() !== userId) {
    throw new AppError('Pattern Forge session not found.', 404);
  }

  const cycle = ensureCycleOwnership(await PatternForgeCycle.findById(session.cycleId).exec(), userId);
  session.status = 'completed';
  session.completedAt = session.completedAt ?? new Date();
  await session.save();
  await updateSessionMetrics(session, cycle);

  const attempts = await PatternForgeAttempt.find({ sessionId: session._id }).exec();
  const groupedThemes = groupAttemptsByTheme(attempts);
  const strongestThemes = [...groupedThemes]
    .sort((left, right) => right.accuracy - left.accuracy)
    .slice(0, 3)
    .map((item) => ({
      theme: item.theme,
      accuracy: item.accuracy,
      attempts: item.attempts,
      correct: item.correct,
      wrong: item.wrong,
    }));
  const weakestThemes = [...groupedThemes]
    .sort((left, right) => left.accuracy - right.accuracy)
    .slice(0, 3)
    .map((item) => ({
      theme: item.theme,
      accuracy: item.accuracy,
      attempts: item.attempts,
      correct: item.correct,
      wrong: item.wrong,
    }));
  const slowestThemes = [...groupedThemes]
    .sort((left, right) => right.averageSolveTimeSeconds - left.averageSolveTimeSeconds)
    .slice(0, 3)
    .map((item) => ({
      theme: item.theme,
      attempts: item.attempts,
      averageSolveTimeSeconds: item.averageSolveTimeSeconds,
    }));
  const mostMissedPuzzleThemes = [...groupedThemes]
    .sort((left, right) => right.wrong - left.wrong)
    .slice(0, 3)
    .map((item) => ({
      theme: item.theme,
      attempts: item.attempts,
      misses: item.misses,
    }));
  const metDailyTarget = session.completedPuzzleIds.length >= session.dailyTarget;
  const reportRoundPlan =
    cycle.repetitionPlan.rounds.find((round) => round.round === session.round) ??
    getCurrentRoundPlan(cycle);
  const isNextRoundActive = cycle.progress.currentRound !== session.round;
  const nextRoundPlan = isNextRoundActive
    ? cycle.repetitionPlan.rounds.find((round) => round.round === cycle.progress.currentRound)
    : cycle.repetitionPlan.rounds.find((round) => round.round === session.round + 1);
  const recommendedNextFocus = buildRecommendedNextFocus({
    weakestThemes,
    slowestThemes,
    mostMissedPuzzleThemes,
  });
  const tomorrowTarget = nextRoundPlan
    ? {
        round: nextRoundPlan.round,
        dailyTarget: nextRoundPlan.dailyTarget,
        status: isNextRoundActive ? 'next_round' : 'current_round',
      }
    : {
        round: reportRoundPlan.round,
        dailyTarget: reportRoundPlan.dailyTarget,
        status: 'current_round',
      };

  return {
    success: true,
    report: {
      date: session.date,
      round: session.round,
      dailyTarget: session.dailyTarget,
      targetPuzzles: session.targetPuzzles,
      completed: session.completedPuzzleIds.length,
      correct: session.correctCount,
      wrong: session.wrongCount,
      skipped: session.skippedCount,
      accuracy: session.accuracy,
      averageSolveTimeSeconds: session.averageSolveTimeSeconds,
      strongestThemes,
      weakestThemes,
      slowestThemes,
      mostMissedPuzzleThemes,
      mistakesQueued: cycle.progress.mistakesQueued,
      metDailyTarget,
      nextRecommendation: recommendedNextFocus,
      tomorrowTarget,
      roundProgress: {
        currentRound: reportRoundPlan.round,
        completedPuzzlesInRound: reportRoundPlan.completedPuzzles ?? cycle.progress.completedPuzzlesInRound,
        roundAccuracy: reportRoundPlan.accuracy ?? cycle.progress.roundAccuracy,
        roundAverageSolveTimeSeconds:
          reportRoundPlan.averageSolveTimeSeconds ?? cycle.progress.roundAverageSolveTimeSeconds,
        roundCompletedAt: reportRoundPlan.completedAt ?? null,
      },
    },
  };
};

export const importPuzzlesFromCsv = async (params: {
  filePath: string;
  limit?: number;
}): Promise<{
  imported: number;
  skipped: number;
}> => {
  const fileStream = createReadStream(params.filePath, { encoding: 'utf-8' });
  const lineReader = readline.createInterface({
    input: fileStream,
    crlfDelay: Infinity,
  });
  const limit = params.limit ?? Number.POSITIVE_INFINITY;
  const bulkOperations: AnyBulkWriteOperation<PuzzleDocument>[] = [];
  let imported = 0;
  let skipped = 0;
  let headerColumns: string[] | null = null;

  for await (const line of lineReader) {
    if (!headerColumns) {
      headerColumns = parseCsvLine(line);
      continue;
    }

    if (imported >= limit) {
      break;
    }

    if (!line.trim()) {
      continue;
    }

    try {
      const values = parseCsvLine(line);
      const row = headerColumns.reduce<Record<string, string>>((accumulator, column, index) => {
        accumulator[column] = values[index] ?? '';
        return accumulator;
      }, {}) as unknown as ImportPuzzleCsvRow;
      const payload = buildPuzzlePayloadFromCsvRow(row);
      bulkOperations.push({
        updateOne: {
          filter: { externalId: payload.externalId },
          update: { $set: payload },
          upsert: true,
        },
      });
      imported += 1;

      if (bulkOperations.length >= 500) {
        await Puzzle.bulkWrite(bulkOperations, { ordered: false });
        bulkOperations.length = 0;
      }
    } catch {
      skipped += 1;
    }
  }

  if (bulkOperations.length > 0) {
    await Puzzle.bulkWrite(bulkOperations, { ordered: false });
  }

  return { imported, skipped };
};
