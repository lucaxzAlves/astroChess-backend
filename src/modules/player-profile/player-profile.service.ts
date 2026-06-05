import { Types } from 'mongoose';

import { PlayerProfile } from '../../models/PlayerProfile';
import { AppError } from '../../utils/AppError';
import {
  type PlayerProfileDocument,
  type PlayerProfileRecord,
  type PlayerProfileUpdateInput,
  type ProfileDelta,
  type RecurringMistake,
  type StrengthExample,
  type StructuredGameSummary,
  recommendationTypes,
} from './player-profile.types';

const MAX_EXAMPLES_PER_ITEM = 5;
const defaultSkillMap = {
  overallScore: {
    value: 0,
    confidence: 0,
    evidenceCount: 0,
  },
  categories: {
    calculation: {
      value: 0,
      label: 'Calculation',
      confidence: 0,
      evidenceCount: 0,
    },
    positionalUnderstanding: {
      value: 0,
      label: 'Positional Understanding',
      confidence: 0,
      evidenceCount: 0,
    },
    openings: {
      value: 0,
      label: 'Openings',
      confidence: 0,
      evidenceCount: 0,
    },
    tacticalThemes: {
      value: 0,
      label: 'Tactical Themes',
      confidence: 0,
      evidenceCount: 0,
    },
    endgames: {
      value: 0,
      label: 'Endgames',
      confidence: 0,
      evidenceCount: 0,
    },
    middlegame: {
      value: 0,
      label: 'Middlegame',
      confidence: 0,
      evidenceCount: 0,
    },
    timeManagement: {
      value: 0,
      label: 'Time Management',
      confidence: 0,
      evidenceCount: 0,
    },
    psychologicalResilience: {
      value: 0,
      label: 'Psychological Resilience',
      confidence: 0,
      evidenceCount: 0,
    },
  },
} as const;
const severityRank = {
  low: 1,
  medium: 2,
  high: 3,
  critical: 4,
} as const;

const isRecord = (value: unknown): value is Record<string, unknown> => {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
};

const normalizeKey = (value: string): string => {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');
};

const ensureObjectId = (userId: string): Types.ObjectId => {
  if (!Types.ObjectId.isValid(userId)) {
    throw new AppError('Invalid user id.', 400);
  }

  return new Types.ObjectId(userId);
};

const toPlainObject = (value: unknown): Record<string, unknown> => {
  if (!value) {
    return {};
  }

  if (typeof value === 'object' && value !== null && 'toObject' in value) {
    const maybeDocument = value as { toObject?: () => Record<string, unknown> };

    if (typeof maybeDocument.toObject === 'function') {
      return maybeDocument.toObject();
    }
  }

  return isRecord(value) ? value : {};
};

const deepMerge = (
  target: Record<string, unknown>,
  source: Record<string, unknown>,
): Record<string, unknown> => {
  const result: Record<string, unknown> = { ...target };

  for (const [key, value] of Object.entries(source)) {
    if (value === undefined) {
      continue;
    }

    if (Array.isArray(value)) {
      result[key] = value;
      continue;
    }

    if (isRecord(value) && isRecord(result[key])) {
      result[key] = deepMerge(result[key] as Record<string, unknown>, value);
      continue;
    }

    result[key] = value;
  }

  return result;
};

const buildDefaultProfile = (userId: string): Partial<PlayerProfileRecord> => {
  return {
    userId: ensureObjectId(userId),
    identities: {},
    ratings: {
      estimatedStrength: {
        level: 'unknown',
        confidence: 0,
      },
    },
    playingStyle: {
      primaryStyle: 'unknown',
      secondaryStyles: [],
      styleScores: {
        aggression: 0,
        tacticalSharpness: 0,
        positionalUnderstanding: 0,
        riskTolerance: 0,
        defensiveSkill: 0,
        endgameSkill: 0,
        openingPreparation: 0,
        conversionSkill: 0,
        calculationSkill: 0,
      },
    },
    openingRepertoire: {
      asWhite: [],
      asBlack: {
        againstE4: [],
        againstD4: [],
        againstOther: [],
      },
    },
    chessStats: {
      totalGamesAnalyzed: 0,
      results: {
        wins: 0,
        draws: 0,
        losses: 0,
      },
      byPhase: {
        opening: {},
        middlegame: {},
        endgame: {},
      },
      byColor: {
        white: {},
        black: {},
      },
      mistakeDistribution: {
        inaccuracies: 0,
        mistakes: 0,
        blunders: 0,
      },
      conversion: {
        winningPositionsLost: 0,
        winningPositionsDrawn: 0,
        advantagesConverted: 0,
      },
      resilience: {
        worsePositionsSaved: 0,
        lostPositionsRecovered: 0,
      },
    },
    skillMap: defaultSkillMap,
    recurringMistakes: [],
    strengths: [],
    improvementHistory: [],
    coachPreferences: {},
    goals: {
      focusAreas: [],
      tournamentPreparation: {
        enabled: false,
      },
    },
    trainingPreferences: {
      preferredDays: [],
      preferredTrainingTypes: [],
      whatsappReminders: {
        enabled: false,
      },
    },
    recommendations: {
      studyPlan: [],
    },
    profileConfidence: {
      overall: 0,
      basedOnGames: 0,
      confidenceByArea: {
        openings: 0,
        tactics: 0,
        endgames: 0,
        style: 0,
        recurringMistakes: 0,
      },
    },
    decisionPatterns: {
      riskProfile: 'unknown',
      commonBehaviors: [],
    },
    criticalPhaseWeakness: {
      phase: 'unknown',
    },
  };
};

const mergeTopLevelPath = <TValue extends Record<string, unknown>>(
  profile: PlayerProfileDocument,
  path: string,
  value: TValue | undefined,
): void => {
  if (!value) {
    return;
  }

  profile.set(path, deepMerge(toPlainObject(profile.get(path)), value));
};

const clampConfidence = (value: number): number => {
  return Math.max(0, Math.min(1, value));
};

const chooseSeverity = (
  current?: RecurringMistake['severity'],
  incoming?: RecurringMistake['severity'],
): RecurringMistake['severity'] => {
  if (!current) {
    return incoming;
  }

  if (!incoming) {
    return current;
  }

  return severityRank[incoming] > severityRank[current] ? incoming : current;
};

const createGameAnalysisObjectId = (gameAnalysisId: string): Types.ObjectId | undefined => {
  return Types.ObjectId.isValid(gameAnalysisId) ? new Types.ObjectId(gameAnalysisId) : undefined;
};

const sanitizeExampleGameAnalysisIds = (
  items: unknown,
): Array<Record<string, unknown>> => {
  if (!Array.isArray(items)) {
    return [];
  }

  return items.map((item) => {
    if (!isRecord(item)) {
      return {};
    }

    const nextItem = { ...item };

    if (Array.isArray(nextItem.examples)) {
      nextItem.examples = nextItem.examples
        .filter(isRecord)
        .map((example) => {
          const nextExample = { ...example };
          const rawGameAnalysisId = nextExample.gameAnalysisId;

          if (rawGameAnalysisId instanceof Types.ObjectId) {
            return nextExample;
          }

          if (typeof rawGameAnalysisId === 'string') {
            const objectId = createGameAnalysisObjectId(rawGameAnalysisId);

            if (objectId) {
              nextExample.gameAnalysisId = objectId;
            } else {
              delete nextExample.gameAnalysisId;
            }
          }

          return nextExample;
        });
    }

    return nextItem;
  });
};

const sanitizeRecommendations = (
  recommendations: Record<string, unknown>,
): Record<string, unknown> => {
  const allowedRecommendationTypes = new Set<string>(recommendationTypes);
  const sanitizedRecommendations = { ...recommendations };

  if (Array.isArray(sanitizedRecommendations.studyPlan)) {
    sanitizedRecommendations.studyPlan = sanitizedRecommendations.studyPlan
      .filter(isRecord)
      .map((item) => {
        const nextItem = { ...item };

        if (
          typeof nextItem.type === 'string' &&
          !allowedRecommendationTypes.has(nextItem.type)
        ) {
          nextItem.type = 'routine';
        }

        return nextItem;
      });
  }

  return sanitizedRecommendations;
};

const limitExamples = <TExample>(examples: TExample[], nextExample: TExample): TExample[] => {
  const trimmedExamples = examples.slice(0, MAX_EXAMPLES_PER_ITEM - 1);

  return [...trimmedExamples, nextExample];
};

const stampSkillMapTimestamps = (skillMap: Record<string, unknown>, timestamp: Date): void => {
  if (!isRecord(skillMap.overallScore)) {
    skillMap.overallScore = {};
  }

  (skillMap.overallScore as Record<string, unknown>).lastUpdatedAt = timestamp;

  if (!isRecord(skillMap.categories)) {
    return;
  }

  for (const value of Object.values(skillMap.categories)) {
    if (isRecord(value)) {
      value.lastUpdatedAt = timestamp;
    }
  }
};

const updateProfileConfidence = (profile: PlayerProfileDocument): void => {
  const totalGamesAnalyzed = profile.chessStats.totalGamesAnalyzed ?? 0;
  const recurringMistakesCount = profile.recurringMistakes.length;
  const strengthsCount = profile.strengths.length;

  profile.profileConfidence = {
    ...toPlainObject(profile.profileConfidence),
    overall: clampConfidence(totalGamesAnalyzed / 20),
    basedOnGames: totalGamesAnalyzed,
    confidenceByArea: {
      ...toPlainObject(profile.profileConfidence?.confidenceByArea),
      recurringMistakes: clampConfidence(recurringMistakesCount / 10),
      style: clampConfidence(strengthsCount / 10),
    },
    warning:
      totalGamesAnalyzed < 5 ? 'Profile based on a limited number of analyzed games.' : undefined,
  };
};

const validateUpdateInput = (input: unknown): PlayerProfileUpdateInput => {
  if (!isRecord(input)) {
    throw new AppError('The request body must be an object.', 400);
  }

  const allowedKeys: Array<keyof PlayerProfileUpdateInput> = [
    'coachPreferences',
    'goals',
    'trainingPreferences',
    'identities',
    'ratings',
  ];
  const providedKeys = allowedKeys.filter((key) => input[key] !== undefined);

  if (providedKeys.length === 0) {
    throw new AppError('No supported player profile fields were provided.', 400, {
      allowedKeys,
    });
  }

  for (const key of providedKeys) {
    if (!isRecord(input[key])) {
      throw new AppError(`Field ${key} must be an object when provided.`, 400, { key });
    }
  }

  return input as PlayerProfileUpdateInput;
};

export const getPlayerProfile = async (userId: string): Promise<PlayerProfileDocument | null> => {
  return PlayerProfile.findOne({ userId: ensureObjectId(userId) }).exec();
};

export const getOrCreatePlayerProfile = async (userId: string): Promise<PlayerProfileDocument> => {
  const existingProfile = await getPlayerProfile(userId);

  if (existingProfile) {
    return existingProfile;
  }

  return PlayerProfile.create(buildDefaultProfile(userId));
};

export const updatePlayerProfileBasicInfo = async (
  userId: string,
  input: unknown,
): Promise<PlayerProfileDocument> => {
  const validatedInput = validateUpdateInput(input);
  const profile = await getOrCreatePlayerProfile(userId);

  mergeTopLevelPath(profile, 'coachPreferences', validatedInput.coachPreferences);
  mergeTopLevelPath(profile, 'goals', validatedInput.goals);
  mergeTopLevelPath(profile, 'trainingPreferences', validatedInput.trainingPreferences);
  mergeTopLevelPath(profile, 'identities', validatedInput.identities);
  mergeTopLevelPath(profile, 'ratings', validatedInput.ratings);

  profile.lastProfileUpdateAt = new Date();

  await profile.save();

  return profile;
};

export const updateChessComUsername = async (
  userId: string,
  username: string,
): Promise<PlayerProfileDocument> => {
  const normalizedUsername = username.trim();

  if (!normalizedUsername) {
    throw new AppError('Chess.com username is required.', 400);
  }

  const profile = await getOrCreatePlayerProfile(userId);

  mergeTopLevelPath(profile, 'identities', {
    chessCom: {
      username: normalizedUsername,
    },
  });

  profile.lastProfileUpdateAt = new Date();

  await profile.save();

  return profile;
};

export const applyGameSummaryToProfile = async (
  userId: string,
  gameAnalysisId: string,
  structuredSummary: StructuredGameSummary,
): Promise<{ profile: PlayerProfileDocument; delta: ProfileDelta }> => {
  const profile = await getOrCreatePlayerProfile(userId);
  const now = new Date();
  const relatedGameAnalysisId = createGameAnalysisObjectId(gameAnalysisId);
  const delta: ProfileDelta = {
    totalGamesAnalyzed: (profile.chessStats.totalGamesAnalyzed ?? 0) + 1,
    recurringMistakesCreated: 0,
    recurringMistakesUpdated: 0,
    strengthsCreated: 0,
    strengthsUpdated: 0,
    updatedAt: now,
  };

  profile.chessStats.totalGamesAnalyzed = delta.totalGamesAnalyzed;

  // TODO: when the profile synthesizer is available, derive 0-100 skillMap
  // scores from structuredSummary, objective chessStats and game history.
  profile.skillMap = profile.skillMap ?? { ...defaultSkillMap };

  for (const pattern of structuredSummary.mistakePatterns ?? []) {
    const category = pattern.category ?? 'unknown';
    const name = pattern.name?.trim() || 'Unnamed pattern';
    const key = normalizeKey(`${category}_${name}`);
    const existingMistake = profile.recurringMistakes.find((mistake) => mistake.key === key);
    const example = relatedGameAnalysisId
      ? {
          gameAnalysisId: relatedGameAnalysisId,
          moveNumber: pattern.relatedMoves?.[0],
          explanation: pattern.evidence,
        }
      : undefined;

    if (existingMistake) {
      existingMistake.frequency = (existingMistake.frequency ?? 0) + 1;
      existingMistake.lastDetectedAt = now;
      existingMistake.status = 'active';
      existingMistake.severity =
        chooseSeverity(existingMistake.severity, pattern.severity) ?? 'medium';
      existingMistake.description = existingMistake.description ?? pattern.evidence;
      existingMistake.phases = Array.from(
        new Set([...(existingMistake.phases ?? []), ...(pattern.phase ? [pattern.phase] : [])]),
      );
      existingMistake.confidence = clampConfidence((existingMistake.frequency ?? 1) / 10);

      if (example) {
        existingMistake.examples = limitExamples(existingMistake.examples ?? [], example);
      }

      delta.recurringMistakesUpdated += 1;
      continue;
    }

    profile.recurringMistakes.push({
      key,
      category,
      name,
      description: pattern.evidence,
      frequency: 1,
      severity: pattern.severity ?? 'medium',
      phases: pattern.phase ? [pattern.phase] : [],
      examples: example ? [example] : [],
      firstDetectedAt: now,
      lastDetectedAt: now,
      status: 'active',
      confidence: 0.1,
    });
    delta.recurringMistakesCreated += 1;
  }

  for (const strength of structuredSummary.strengths ?? []) {
    const name = strength.name?.trim();

    if (!name) {
      continue;
    }

    const key = normalizeKey(name);
    const existingStrength = profile.strengths.find((item) => item.key === key);
    const example: StrengthExample | undefined = relatedGameAnalysisId
      ? {
          gameAnalysisId: relatedGameAnalysisId,
          explanation: strength.evidence,
        }
      : undefined;

    if (existingStrength) {
      existingStrength.evidenceCount = (existingStrength.evidenceCount ?? 0) + 1;
      existingStrength.lastDetectedAt = now;
      existingStrength.description = existingStrength.description ?? strength.evidence;
      existingStrength.confidence = clampConfidence((existingStrength.evidenceCount ?? 1) / 10);

      if (example) {
        existingStrength.examples = limitExamples(existingStrength.examples ?? [], example);
      }

      delta.strengthsUpdated += 1;
      continue;
    }

    profile.strengths.push({
      key,
      name,
      description: strength.evidence,
      evidenceCount: 1,
      examples: example ? [example] : [],
      firstDetectedAt: now,
      lastDetectedAt: now,
      confidence: 0.1,
    });
    delta.strengthsCreated += 1;
  }

  profile.lastProfileUpdateAt = now;
  profile.markModified('recurringMistakes');
  profile.markModified('strengths');
  profile.markModified('chessStats');
  updateProfileConfidence(profile);

  await profile.save();

  return {
    profile,
    delta,
  };
};

export const applyProfileDeltaToPlayerProfile = async (
  userId: string,
  profileDelta: unknown,
): Promise<PlayerProfileDocument> => {
  if (!isRecord(profileDelta)) {
    throw new AppError('profileDelta must be an object.', 400);
  }

  const profile = await getOrCreatePlayerProfile(userId);
  const now = new Date();

  if (isRecord(profileDelta.skillMap)) {
    const nextSkillMap = deepMerge(toPlainObject(profile.skillMap), profileDelta.skillMap);
    stampSkillMapTimestamps(nextSkillMap, now);
    profile.set('skillMap', nextSkillMap);
  }

  if (isRecord(profileDelta.playingStyle)) {
    const nextPlayingStyle = deepMerge(
      toPlainObject(profile.playingStyle),
      profileDelta.playingStyle,
    );
    nextPlayingStyle.lastInferredAt = now;
    profile.set('playingStyle', nextPlayingStyle);
  }

  if (isRecord(profileDelta.openingRepertoire)) {
    profile.set(
      'openingRepertoire',
      deepMerge(toPlainObject(profile.openingRepertoire), profileDelta.openingRepertoire),
    );
  }

  if (isRecord(profileDelta.chessStats)) {
    profile.set('chessStats', deepMerge(toPlainObject(profile.chessStats), profileDelta.chessStats));
  }

  if (Array.isArray(profileDelta.recurringMistakes)) {
    profile.set('recurringMistakes', sanitizeExampleGameAnalysisIds(profileDelta.recurringMistakes));
  }

  if (Array.isArray(profileDelta.strengths)) {
    profile.set('strengths', sanitizeExampleGameAnalysisIds(profileDelta.strengths));
  }

  if (isRecord(profileDelta.recommendations)) {
    const nextRecommendations = deepMerge(
      toPlainObject(profile.recommendations),
      sanitizeRecommendations(profileDelta.recommendations),
    );
    nextRecommendations.lastGeneratedAt = now;
    profile.set('recommendations', nextRecommendations);
  } else {
    const nextRecommendations = toPlainObject(profile.recommendations);
    nextRecommendations.lastGeneratedAt = now;
    profile.set('recommendations', nextRecommendations);
  }

  if (isRecord(profileDelta.profileConfidence)) {
    profile.set(
      'profileConfidence',
      deepMerge(toPlainObject(profile.profileConfidence), profileDelta.profileConfidence),
    );
  }

  if (isRecord(profileDelta.decisionPatterns)) {
    profile.set(
      'decisionPatterns',
      deepMerge(toPlainObject(profile.decisionPatterns), profileDelta.decisionPatterns),
    );
  }

  if (isRecord(profileDelta.criticalPhaseWeakness)) {
    profile.set(
      'criticalPhaseWeakness',
      deepMerge(toPlainObject(profile.criticalPhaseWeakness), profileDelta.criticalPhaseWeakness),
    );
  }

  if (isRecord(profileDelta.estimatedStrengthSuggestion)) {
    const nextRatings = deepMerge(toPlainObject(profile.ratings), {
      estimatedStrength: profileDelta.estimatedStrengthSuggestion,
    });
    profile.set('ratings', nextRatings);
  }

  if (isRecord(profileDelta.improvementHistoryEntry)) {
    profile.improvementHistory.push({
      date: now,
      ...(profileDelta.improvementHistoryEntry as Record<string, unknown>),
    });
    profile.markModified('improvementHistory');
  }

  profile.lastProfileUpdateAt = now;

  await profile.save();

  return profile;
};
