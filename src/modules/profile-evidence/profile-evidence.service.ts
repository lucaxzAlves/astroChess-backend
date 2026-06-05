import * as analysisBatchRepository from '../analysis-batch/analysis-batch.repository';
import * as gameAnalysisRepository from '../game-analysis/game-analysis.repository';
import { getPlayerProfile } from '../player-profile/player-profile.service';
import type {
  GameAnalysisDocument,
  GamePhase,
  PlayerProfileDocument,
  StoredMoveClassificationSummaryEntry,
} from '../player-profile/player-profile.types';
import { buildProfileSummary } from '../profile-summary/profile-summary.builder';
import type { ProfileSummary } from '../profile-summary/profile-summary.types';
import {
  normalizeGameEvidenceSummary,
} from '../ai-review/ai-review.service';
import type {
  AiReviewTargetPlayer,
  EvidenceBelongsTo,
  ProfileGameEvidenceSummary,
  SkillSignalKey,
  TargetPlayerResult,
  TrainingPrioritySignal,
} from '../ai-review/ai-review.types';
import type {
  AggregatedEndgameEvidence,
  AggregatedObservedMistakePattern,
  AggregatedObservedStrength,
  AggregatedOpeningEvidence,
  AggregatedStyleSignal,
  AggregatedTrainingTheme,
  GameEvidenceExtractionResult,
  ProfileEvidencePayload,
  ProfileUpdateAgentInput,
} from './profile-evidence.types';

const MAX_EXAMPLES = 5;
const MAX_NOTES = 30;
const ZERO_MOVE_CLASSIFICATION_TOTALS: Required<StoredMoveClassificationSummaryEntry> = {
  brilliant: 0,
  great: 0,
  best: 0,
  excellent: 0,
  good: 0,
  book: 0,
  inaccuracy: 0,
  mistake: 0,
  miss: 0,
  blunder: 0,
};

const ZERO_PHASE_COUNTS = {
  inaccuracies: 0,
  mistakes: 0,
  blunders: 0,
  misses: 0,
};

const PHASES: GamePhase[] = ['opening', 'middlegame', 'endgame', 'unknown'];
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

const normalizeText = (value: string): string => value.trim().toLowerCase();

const clamp = (value: number, min: number, max: number): number => {
  return Math.max(min, Math.min(max, value));
};

const uniqueStrings = (values: Array<string | null | undefined>): string[] => {
  return Array.from(
    new Set(
      values
        .map((value) => (typeof value === 'string' ? value.trim() : ''))
        .filter(Boolean),
    ),
  );
};

const toPlainObject = (value: unknown): Record<string, unknown> | null => {
  if (!value) {
    return null;
  }

  if (typeof value === 'object' && value !== null && 'toObject' in value) {
    const maybeDocument = value as { toObject?: () => Record<string, unknown> };

    if (typeof maybeDocument.toObject === 'function') {
      return maybeDocument.toObject();
    }
  }

  return isRecord(value) ? value : null;
};

const shouldIncludeBelongsTo = (
  belongsTo: EvidenceBelongsTo | undefined,
  defaultValue: 'targetPlayer' | 'skip' = 'skip',
): boolean => {
  if (belongsTo === 'targetPlayer' || belongsTo === 'both') {
    return true;
  }

  if (!belongsTo || belongsTo === 'unknown') {
    return defaultValue === 'targetPlayer';
  }

  return false;
};

const getTargetPlayerFromSummary = (
  analysis: GameAnalysisDocument,
  summary: ProfileGameEvidenceSummary | undefined,
): AiReviewTargetPlayer => {
  return {
    username: summary?.targetPlayer?.username ?? analysis.targetPlayer?.username,
    color: summary?.targetPlayer?.color ?? analysis.targetPlayer?.color ?? 'unknown',
    platform: summary?.targetPlayer?.platform ?? analysis.targetPlayer?.platform ?? 'unknown',
  };
};

const inferTargetPlayerResult = (
  result: string | undefined,
  targetColor: AiReviewTargetPlayer['color'],
): TargetPlayerResult => {
  if (!result || targetColor === 'unknown') {
    return 'unknown';
  }

  if (result === '1-0') {
    return targetColor === 'white' ? 'win' : 'loss';
  }

  if (result === '0-1') {
    return targetColor === 'black' ? 'win' : 'loss';
  }

  if (result === '1/2-1/2') {
    return 'draw';
  }

  return 'unknown';
};

const getTargetPlayerAccuracy = (
  analysis: GameAnalysisDocument,
  summary: ProfileGameEvidenceSummary | undefined,
): number | null => {
  if (typeof summary?.targetPlayerAccuracy === 'number') {
    return summary.targetPlayerAccuracy;
  }

  const targetColor = getTargetPlayerFromSummary(analysis, summary).color;

  if (targetColor === 'white') {
    return analysis.accuracy?.white ?? null;
  }

  if (targetColor === 'black') {
    return analysis.accuracy?.black ?? null;
  }

  return null;
};

const toMoveClassificationTotals = (
  entry: StoredMoveClassificationSummaryEntry | undefined,
): Required<StoredMoveClassificationSummaryEntry> => {
  return {
    brilliant: entry?.brilliant ?? 0,
    great: entry?.great ?? 0,
    best: entry?.best ?? 0,
    excellent: entry?.excellent ?? 0,
    good: entry?.good ?? 0,
    book: entry?.book ?? 0,
    inaccuracy: entry?.inaccuracy ?? 0,
    mistake: entry?.mistake ?? 0,
    miss: entry?.miss ?? 0,
    blunder: entry?.blunder ?? 0,
  };
};

const getTargetMoveClassificationSummary = (
  analysis: GameAnalysisDocument,
  summary: ProfileGameEvidenceSummary | undefined,
): Required<StoredMoveClassificationSummaryEntry> => {
  if (summary?.targetPlayerMoveClassificationSummary) {
    return toMoveClassificationTotals(summary.targetPlayerMoveClassificationSummary);
  }

  const targetColor = getTargetPlayerFromSummary(analysis, summary).color;

  if (targetColor === 'white') {
    return toMoveClassificationTotals(analysis.moveClassificationSummary?.white);
  }

  if (targetColor === 'black') {
    return toMoveClassificationTotals(analysis.moveClassificationSummary?.black);
  }

  return { ...ZERO_MOVE_CLASSIFICATION_TOTALS };
};

export const extractGameEvidenceSummaryFromAnalysis = (
  analysis: GameAnalysisDocument,
): GameEvidenceExtractionResult | null => {
  if (isRecord(analysis.gameEvidenceSummary)) {
    return {
      summary: normalizeGameEvidenceSummary(analysis.gameEvidenceSummary as ProfileGameEvidenceSummary),
      source: 'gameEvidenceSummary',
    };
  }

  const structuredSummary = isRecord(analysis.structuredSummary)
    ? (analysis.structuredSummary as Record<string, unknown>)
    : null;

  if (structuredSummary && isRecord(structuredSummary.gameEvidenceSummary)) {
    return {
      summary: normalizeGameEvidenceSummary(
        structuredSummary.gameEvidenceSummary as ProfileGameEvidenceSummary,
      ),
      source: 'structuredSummary.gameEvidenceSummary',
    };
  }

  if (structuredSummary) {
    return {
      summary: normalizeGameEvidenceSummary(structuredSummary as ProfileGameEvidenceSummary),
      source: 'structuredSummary',
    };
  }

  return null;
};

const appendExample = <TExample>(examples: TExample[], example: TExample): TExample[] => {
  if (examples.length >= MAX_EXAMPLES) {
    return examples;
  }

  return [...examples, example];
};

const getCanonicalTrainingTheme = (theme: string | undefined): string => {
  const normalizedTheme = normalizeText(theme ?? '');

  if (normalizedTheme.includes('tactic') || normalizedTheme.includes('blunder')) {
    return 'Tactical Blunders';
  }

  if (normalizedTheme.includes('calculation') || normalizedTheme.includes('calculate')) {
    return 'Calculation Accuracy';
  }

  if (normalizedTheme.includes('endgame')) {
    return 'Endgame Technique';
  }

  if (normalizedTheme.includes('opening')) {
    return 'Opening Review';
  }

  if (normalizedTheme.includes('time')) {
    return 'Time Management';
  }

  if (normalizedTheme.includes('king')) {
    return 'King Safety';
  }

  if (normalizedTheme.includes('convert')) {
    return 'Conversion';
  }

  return theme?.trim() || 'General Review';
};

const getPriorityScore = (priority: TrainingPrioritySignal | undefined): number => {
  switch (priority) {
    case 'critical':
      return 4;
    case 'high':
      return 3;
    case 'medium':
      return 2;
    case 'low':
    default:
      return 1;
  }
};

const getSeverityBucket = (
  severity: string | undefined,
  kind: 'mistake' | 'miss',
): keyof typeof ZERO_PHASE_COUNTS => {
  if (kind === 'miss') {
    return 'misses';
  }

  if (severity === 'critical') {
    return 'blunders';
  }

  if (severity === 'low') {
    return 'inaccuracies';
  }

  return 'mistakes';
};

const buildWarning = (
  gamesAnalyzed: number,
  failedAgentOneCount: number,
  unknownColorCount: number,
): string | null => {
  if (gamesAnalyzed <= 2) {
    return 'Profile evidence based on a very small sample.';
  }

  if (failedAgentOneCount > 0) {
    return 'Some game evidence summaries could not be generated by Agent 1.';
  }

  if (unknownColorCount > 0) {
    return 'Some games could not confidently determine the target player color.';
  }

  return null;
};

const sanitizeCurrentProfile = (
  profile: PlayerProfileDocument | null,
): Record<string, unknown> | null => {
  const plainProfile = toPlainObject(profile);

  if (!plainProfile) {
    return null;
  }

  const sanitizedProfile = { ...plainProfile };

  delete sanitizedProfile.userId;
  delete sanitizedProfile.identities;
  delete sanitizedProfile.__v;

  return sanitizedProfile;
};

const buildQuizAnswers = (profile: PlayerProfileDocument | null) => {
  return {
    selfDeclaredStyle: null,
    mainGoal: profile?.goals?.mainGoal ?? null,
    targetRating: profile?.goals?.targetRating?.value ?? null,
    preferredTimeControl: profile?.goals?.targetRating?.timeControl ?? null,
    availableTrainingMinutesPerDay: profile?.trainingPreferences?.dailyTrainingMinutes ?? null,
    preferredCoachStyle: profile?.coachPreferences?.selectedCoachStyle ?? null,
    declaredWeaknesses: profile?.goals?.focusAreas ?? [],
    declaredStrengths: [],
  };
};

export const buildProfileEvidenceFromGameAnalyses = (
  gameAnalyses: GameAnalysisDocument[],
): ProfileEvidencePayload => {
  const sample = {
    gamesAnalyzed: 0,
    timeControlsDetected: [] as string[],
    colorsPlayed: {
      white: 0,
      black: 0,
      unknown: 0,
    },
    openingsDetected: [] as string[],
  };
  const objectiveStats = {
    averageAccuracy: null as number | null,
    results: {
      win: 0,
      draw: 0,
      loss: 0,
      unknown: 0,
    } as Record<TargetPlayerResult, number>,
    moveClassificationTotals: { ...ZERO_MOVE_CLASSIFICATION_TOTALS },
    phaseMistakeDistribution: {
      opening: { ...ZERO_PHASE_COUNTS },
      middlegame: { ...ZERO_PHASE_COUNTS },
      endgame: { ...ZERO_PHASE_COUNTS },
      unknown: { ...ZERO_PHASE_COUNTS },
    } as ProfileEvidencePayload['objectiveStats']['phaseMistakeDistribution'],
  };
  const observedSkillSignals: ProfileEvidencePayload['observedSkillSignals'] = {};
  const styleSignalMap = new Map<string, AggregatedStyleSignal>();
  const mistakePatternMap = new Map<string, AggregatedObservedMistakePattern>();
  const strengthsMap = new Map<string, AggregatedObservedStrength>();
  const openingEvidenceMap = new Map<string, AggregatedOpeningEvidence>();
  const endgameEvidenceMap = new Map<string, AggregatedEndgameEvidence>();
  const trainingThemeMap = new Map<string, AggregatedTrainingTheme>();
  const notesForProfileUpdater: string[] = [];
  const accuracyValues: number[] = [];
  let unknownBelongsToCount = 0;
  let failedAgentOneCount = 0;
  let unknownColorCount = 0;

  for (const analysis of gameAnalyses) {
    const extractedEvidence = extractGameEvidenceSummaryFromAnalysis(analysis);

    if (!extractedEvidence?.summary) {
      failedAgentOneCount += 1;
      notesForProfileUpdater.push(
        `Game ${analysis.gameId ?? analysis._id.toString()} did not provide a valid gameEvidenceSummary.`,
      );
      continue;
    }

    const summary = extractedEvidence.summary;
    const targetPlayer = getTargetPlayerFromSummary(analysis, summary);
    const targetColor = targetPlayer.color ?? 'unknown';
    const targetAccuracy = getTargetPlayerAccuracy(analysis, summary);
    const targetResult =
      summary.targetPlayerResult ??
      inferTargetPlayerResult(summary.metadata?.result ?? analysis.metadata?.result, targetColor);
    const targetMoveSummary = getTargetMoveClassificationSummary(analysis, summary);

    sample.gamesAnalyzed += 1;
    sample.colorsPlayed[targetColor] += 1;
    sample.timeControlsDetected = uniqueStrings([
      ...sample.timeControlsDetected,
      summary.metadata?.timeControl ?? analysis.metadata?.timeControl,
    ]);
    sample.openingsDetected = uniqueStrings([
      ...sample.openingsDetected,
      summary.metadata?.opening ?? analysis.metadata?.opening,
    ]);

    if (targetColor === 'unknown') {
      unknownColorCount += 1;
    }

    if (typeof targetAccuracy === 'number') {
      accuracyValues.push(targetAccuracy);
    }

    objectiveStats.results[targetResult] += 1;

    for (const key of Object.keys(ZERO_MOVE_CLASSIFICATION_TOTALS) as Array<
      keyof typeof ZERO_MOVE_CLASSIFICATION_TOTALS
    >) {
      objectiveStats.moveClassificationTotals[key] += targetMoveSummary[key] ?? 0;
    }

    for (const note of summary.notesForAggregation ?? []) {
      if (notesForProfileUpdater.length < MAX_NOTES) {
        notesForProfileUpdater.push(note);
      }
    }

    for (const mistake of summary.targetMistakes ?? []) {
      const belongsTo = mistake.belongsTo ?? 'targetPlayer';

      if (!shouldIncludeBelongsTo(belongsTo, 'targetPlayer')) {
        if (belongsTo === 'unknown') {
          unknownBelongsToCount += 1;
        }
        continue;
      }

      const phase = mistake.phase ?? 'unknown';
      const bucket = getSeverityBucket(mistake.severity, 'mistake');
      objectiveStats.phaseMistakeDistribution[phase][bucket] += 1;

      const key = normalizeKey(
        `${mistake.key ?? `${mistake.category ?? 'unknown'}_${mistake.name ?? 'target_mistake'}`}`,
      );
      const existingPattern = mistakePatternMap.get(key);
      const example = {
        gameId: analysis.gameId,
        moveNumber: mistake.moveNumber ?? undefined,
        playedMove: mistake.playedMove,
        explanation: mistake.explanation ?? mistake.description,
      };

      if (existingPattern) {
        existingPattern.frequency += 1;
        existingPattern.confidence = clamp(existingPattern.confidence + 0.1, 0, 1);
        existingPattern.examples = appendExample(existingPattern.examples, example);
        existingPattern.phases = Array.from(new Set([...existingPattern.phases, phase]));
      } else {
        mistakePatternMap.set(key, {
          key,
          category: mistake.category,
          name: mistake.name ?? 'Target mistake',
          description: mistake.description ?? mistake.explanation,
          frequency: 1,
          severity: mistake.severity,
          phases: [phase],
          confidence: clamp(mistake.confidence ?? 0.35, 0, 1),
          examples: [example],
        });
      }
    }

    for (const opportunity of summary.missedOpportunities ?? []) {
      const belongsTo = opportunity.belongsTo ?? 'unknown';

      if (!shouldIncludeBelongsTo(belongsTo, 'skip')) {
        if (belongsTo === 'unknown') {
          unknownBelongsToCount += 1;
        }
        continue;
      }

      const phase = opportunity.phase ?? 'unknown';
      objectiveStats.phaseMistakeDistribution[phase].misses += 1;

      const key = normalizeKey(
        `${opportunity.key ?? `${opportunity.category ?? 'unknown'}_${opportunity.theme ?? 'missed_opportunity'}`}`,
      );
      const existingPattern = mistakePatternMap.get(key);
      const example = {
        gameId: analysis.gameId,
        moveNumber: opportunity.moveNumber ?? undefined,
        explanation: opportunity.whatHappened,
      };

      if (existingPattern) {
        existingPattern.frequency += 1;
        existingPattern.confidence = clamp(existingPattern.confidence + 0.1, 0, 1);
        existingPattern.examples = appendExample(existingPattern.examples, example);
        existingPattern.phases = Array.from(new Set([...existingPattern.phases, phase]));
      } else {
        mistakePatternMap.set(key, {
          key,
          category: opportunity.category,
          name: opportunity.theme ?? 'Missed opportunity',
          description: opportunity.whatHappened,
          frequency: 1,
          severity: opportunity.severity,
          phases: [phase],
          confidence: clamp(opportunity.confidence ?? 0.35, 0, 1),
          examples: [example],
        });
      }
    }

    for (const pattern of summary.mistakePatterns ?? []) {
      const belongsTo = pattern.belongsTo ?? 'unknown';

      if (!shouldIncludeBelongsTo(belongsTo, 'skip')) {
        if (belongsTo === 'unknown') {
          unknownBelongsToCount += 1;
        }
        continue;
      }

      const phase = pattern.phase ?? 'unknown';
      const key = normalizeKey(
        `${pattern.key ?? `${pattern.category ?? 'unknown'}_${pattern.name ?? 'mistake_pattern'}`}`,
      );
      const existingPattern = mistakePatternMap.get(key);
      const example = {
        gameId: analysis.gameId,
        moveNumber: pattern.relatedMoves?.[0],
        explanation: pattern.evidence ?? pattern.description,
      };

      if (existingPattern) {
        existingPattern.frequency += 1;
        existingPattern.confidence = clamp(existingPattern.confidence + 0.05, 0, 1);
        existingPattern.examples = appendExample(existingPattern.examples, example);
        existingPattern.phases = Array.from(new Set([...existingPattern.phases, phase]));
      } else {
        mistakePatternMap.set(key, {
          key,
          category: pattern.category,
          name: pattern.name ?? 'Mistake pattern',
          description: pattern.description ?? pattern.evidence,
          frequency: 1,
          severity: pattern.severity,
          phases: [phase],
          confidence: clamp(pattern.confidence ?? 0.3, 0, 1),
          examples: [example],
        });
      }
    }

    for (const strength of summary.strengths ?? []) {
      const belongsTo = strength.belongsTo ?? 'unknown';

      if (!shouldIncludeBelongsTo(belongsTo, 'skip')) {
        if (belongsTo === 'unknown') {
          unknownBelongsToCount += 1;
        }
        continue;
      }

      const key = normalizeKey(strength.key ?? strength.name ?? 'strength');
      const existingStrength = strengthsMap.get(key);
      const example = {
        gameId: analysis.gameId,
        moveNumber: strength.moveNumber ?? undefined,
        explanation: strength.evidence ?? strength.description,
      };

      if (existingStrength) {
        existingStrength.evidenceCount += 1;
        existingStrength.confidence = clamp(existingStrength.confidence + 0.1, 0, 1);
        existingStrength.examples = appendExample(existingStrength.examples, example);
      } else {
        strengthsMap.set(key, {
          key,
          name: strength.name ?? 'Strength',
          description: strength.description ?? strength.evidence,
          evidenceCount: 1,
          confidence: clamp(strength.confidence ?? 0.35, 0, 1),
          examples: [example],
        });
      }
    }

    for (const styleSignal of summary.styleSignals ?? []) {
      const belongsTo = styleSignal.belongsTo ?? 'unknown';

      if (!shouldIncludeBelongsTo(belongsTo, 'skip')) {
        if (belongsTo === 'unknown') {
          unknownBelongsToCount += 1;
        }
        continue;
      }

      const trait = styleSignal.trait?.toString().trim() || 'unknown';
      const key = normalizeKey(trait);
      const existingStyleSignal = styleSignalMap.get(key);
      const example = {
        gameId: analysis.gameId,
        evidence: styleSignal.evidence,
      };

      if (existingStyleSignal) {
        existingStyleSignal.evidenceCount += 1;
        existingStyleSignal.confidence = clamp(
          (existingStyleSignal.confidence + (styleSignal.confidence ?? 0.3)) / 2,
          0,
          1,
        );
        existingStyleSignal.examples = appendExample(existingStyleSignal.examples, example);
      } else {
        styleSignalMap.set(key, {
          trait,
          evidenceCount: 1,
          confidence: clamp(styleSignal.confidence ?? 0.3, 0, 1),
          summary: styleSignal.summary ?? styleSignal.evidence ?? `${trait} signal observed.`,
          examples: [example],
        });
      }
    }

    for (const [skillKey, skillSignal] of Object.entries(summary.skillSignals ?? {})) {
      if (!skillSignal) {
        continue;
      }

      const typedSkillKey = skillKey as SkillSignalKey;
      const existingSignal = observedSkillSignals[typedSkillKey];
      const normalizedSignal = skillSignal.signal ?? 'insufficient_data';
      const confidence = clamp(skillSignal.confidence ?? 0.25, 0, 1);
      const estimatedValue = skillSignal.estimatedValue ?? null;

      if (!existingSignal) {
        observedSkillSignals[typedSkillKey] = {
          signal: normalizedSignal,
          evidenceCount: 1,
          confidence,
          summary: skillSignal.summary ?? `${skillKey} evidence collected.`,
          estimatedValue,
        };
        continue;
      }

      const evidenceCount = existingSignal.evidenceCount + 1;
      const previousEstimatedValue = existingSignal.estimatedValue ?? 0;
      const nextEstimatedValue =
        estimatedValue === null
          ? existingSignal.estimatedValue
          : (previousEstimatedValue * existingSignal.evidenceCount + estimatedValue) / evidenceCount;
      const signalSet = new Set([existingSignal.signal, normalizedSignal]);
      const mergedSignal =
        signalSet.size === 1
          ? existingSignal.signal
          : signalSet.has('positive') && signalSet.has('negative')
            ? 'mixed'
            : signalSet.has('mixed')
              ? 'mixed'
              : normalizedSignal;

      observedSkillSignals[typedSkillKey] = {
        signal: mergedSignal,
        evidenceCount,
        confidence: clamp((existingSignal.confidence + confidence) / 2, 0, 1),
        summary: existingSignal.summary,
        estimatedValue: nextEstimatedValue ?? undefined,
      };
    }

    for (const insight of summary.openingInsights ?? []) {
      const belongsTo = insight.belongsTo ?? 'unknown';

      if (!shouldIncludeBelongsTo(belongsTo, 'skip')) {
        if (belongsTo === 'unknown') {
          unknownBelongsToCount += 1;
        }
        continue;
      }

      const key = normalizeKey(
        `${insight.openingName ?? 'unknown'}_${insight.eco ?? 'unknown'}_${insight.color ?? 'unknown'}`,
      );
      const existingOpening = openingEvidenceMap.get(key);

      if (existingOpening) {
        existingOpening.games += 1;
        existingOpening.resultSummary[targetResult] += 1;
        existingOpening.issues = uniqueStrings([...existingOpening.issues, insight.issue]);
        existingOpening.positiveSignals = uniqueStrings([
          ...existingOpening.positiveSignals,
          insight.positiveSignal,
        ]);
        existingOpening.confidence = clamp((existingOpening.confidence + (insight.confidence ?? 0.3)) / 2, 0, 1);
      } else {
        openingEvidenceMap.set(key, {
          eco: insight.eco,
          name: insight.openingName,
          color: insight.color,
          games: 1,
          resultSummary: {
            win: targetResult === 'win' ? 1 : 0,
            draw: targetResult === 'draw' ? 1 : 0,
            loss: targetResult === 'loss' ? 1 : 0,
            unknown: targetResult === 'unknown' ? 1 : 0,
          },
          issues: uniqueStrings([insight.issue]),
          positiveSignals: uniqueStrings([insight.positiveSignal]),
          confidence: clamp(insight.confidence ?? 0.3, 0, 1),
        });
      }
    }

    for (const insight of summary.endgameInsights ?? []) {
      const belongsTo = insight.belongsTo ?? 'unknown';

      if (!shouldIncludeBelongsTo(belongsTo, 'skip')) {
        if (belongsTo === 'unknown') {
          unknownBelongsToCount += 1;
        }
        continue;
      }

      const type = insight.type?.trim() || 'unknown';
      const key = normalizeKey(type);
      const existingEndgame = endgameEvidenceMap.get(key);

      if (existingEndgame) {
        existingEndgame.gamesInvolved += 1;
        existingEndgame.issues = uniqueStrings([...existingEndgame.issues, insight.issue]);
        existingEndgame.positiveSignals = uniqueStrings([
          ...existingEndgame.positiveSignals,
          insight.positiveSignal,
        ]);
        existingEndgame.confidence = clamp((existingEndgame.confidence + (insight.confidence ?? 0.3)) / 2, 0, 1);
      } else {
        endgameEvidenceMap.set(key, {
          type,
          issues: uniqueStrings([insight.issue]),
          positiveSignals: uniqueStrings([insight.positiveSignal]),
          gamesInvolved: 1,
          confidence: clamp(insight.confidence ?? 0.3, 0, 1),
        });
      }
    }

    for (const takeaway of summary.trainingTakeaways ?? []) {
      const belongsTo = takeaway.belongsTo ?? 'targetPlayer';

      if (!shouldIncludeBelongsTo(belongsTo, 'targetPlayer')) {
        continue;
      }

      const theme = getCanonicalTrainingTheme(takeaway.theme);
      const key = normalizeKey(theme);
      const existingTheme = trainingThemeMap.get(key);

      if (existingTheme) {
        if (getPriorityScore(takeaway.prioritySignal) > getPriorityScore(existingTheme.prioritySignal)) {
          existingTheme.prioritySignal = takeaway.prioritySignal ?? existingTheme.prioritySignal;
        }

        existingTheme.relatedMistakeKeys = uniqueStrings([
          ...existingTheme.relatedMistakeKeys,
          ...(takeaway.relatedMistakeKeys ?? []),
        ]);
      } else {
        trainingThemeMap.set(key, {
          theme,
          reason: takeaway.reason ?? `${theme} was repeatedly mentioned.`,
          prioritySignal: takeaway.prioritySignal ?? 'medium',
          suggestedExerciseType: takeaway.suggestedExerciseType,
          relatedMistakeKeys: uniqueStrings(takeaway.relatedMistakeKeys ?? []),
        });
      }
    }
  }

  objectiveStats.averageAccuracy =
    accuracyValues.length > 0
      ? Number((accuracyValues.reduce((sum, value) => sum + value, 0) / accuracyValues.length).toFixed(2))
      : null;

  const mostProblematicPhase = PHASES.map((phase) => ({
    phase,
    score:
      objectiveStats.phaseMistakeDistribution[phase].blunders * 4 +
      objectiveStats.phaseMistakeDistribution[phase].mistakes * 2 +
      objectiveStats.phaseMistakeDistribution[phase].inaccuracies +
      objectiveStats.phaseMistakeDistribution[phase].misses * 3,
  })).sort((left, right) => right.score - left.score)[0];

  const baseConfidence =
    sample.gamesAnalyzed <= 2
      ? 32
      : sample.gamesAnalyzed <= 7
        ? 52
        : sample.gamesAnalyzed <= 15
          ? 68
          : 82;
  const confidencePenalty =
    unknownColorCount * 4 + failedAgentOneCount * 6 + Math.min(unknownBelongsToCount, 10) * 2;
  const confidenceOverall = clamp(baseConfidence - confidencePenalty, 0, 100);

  return {
    sample,
    objectiveStats,
    observedSkillSignals,
    observedStyleSignals: Array.from(styleSignalMap.values()),
    observedMistakePatterns: Array.from(mistakePatternMap.values()),
    observedStrengths: Array.from(strengthsMap.values()),
    openingEvidence: Array.from(openingEvidenceMap.values()),
    endgameEvidence: Array.from(endgameEvidenceMap.values()),
    phaseEvidence: {
      criticalPhaseWeaknessCandidate:
        mostProblematicPhase && mostProblematicPhase.score > 0
          ? {
              phase: mostProblematicPhase.phase,
              reason: `Most issues accumulated in the ${mostProblematicPhase.phase} phase.`,
              confidence: clamp(mostProblematicPhase.score / Math.max(sample.gamesAnalyzed, 1), 0, 1),
            }
          : null,
    },
    trainingThemes: Array.from(trainingThemeMap.values()),
    confidence: {
      overall: confidenceOverall,
      basedOnGames: sample.gamesAnalyzed,
      warning: buildWarning(sample.gamesAnalyzed, failedAgentOneCount, unknownColorCount),
    },
    notesForProfileUpdater: notesForProfileUpdater.slice(0, MAX_NOTES),
  };
};

export const buildProfileUpdateAgentInput = async (
  userId: string,
  batchId: string,
): Promise<ProfileUpdateAgentInput> => {
  const [batch, playerProfile, gameAnalyses] = await Promise.all([
    analysisBatchRepository.findAnalysisBatchByIdForUser(userId, batchId),
    getPlayerProfile(userId),
    gameAnalysisRepository.findGameAnalysesByBatch(userId, batchId),
  ]);

  if (!batch) {
    throw new Error('Analysis batch not found.');
  }

  return {
    analysisType: 'profile_update',
    currentProfile: sanitizeCurrentProfile(playerProfile),
    quizAnswers: buildQuizAnswers(playerProfile),
    profileEvidence: buildProfileEvidenceFromGameAnalyses(gameAnalyses),
  };
};

export const buildAgentOneProfileSummary = async (
  userId: string,
): Promise<ProfileSummary | null> => {
  const playerProfile = await getPlayerProfile(userId);

  return buildProfileSummary(playerProfile);
};
