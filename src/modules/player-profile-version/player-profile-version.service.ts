import { Types } from 'mongoose';

import { AnalysisBatch } from '../analysis-batch/analysis-batch.model';
import { PlayerProfileVersion } from '../../models/PlayerProfileVersion';
import { AppError } from '../../utils/AppError';
import { getOrCreatePlayerProfile } from '../player-profile/player-profile.service';
import type { PlayerProfileDocument } from '../player-profile/player-profile.types';
import type {
  CreatePlayerProfileVersionInput,
  PlayerProfileVersionDocument,
  ProfileChangesSummary,
} from './player-profile-version.types';

const SNAPSHOT_KEYS = [
  'identities',
  'ratings',
  'playingStyle',
  'openingRepertoire',
  'chessStats',
  'skillMap',
  'recurringMistakes',
  'strengths',
  'improvementHistory',
  'coachPreferences',
  'goals',
  'trainingPreferences',
  'recommendations',
  'profileConfidence',
  'decisionPatterns',
  'criticalPhaseWeakness',
  'lastProfileUpdateAt',
  'createdAt',
] as const;

type CreateAfterBatchSnapshotInput = {
  userId: string;
  batchId: string;
  profileDelta: Record<string, unknown>;
  beforeSnapshot: Record<string, unknown>;
  updatedProfile: PlayerProfileDocument;
};

type ListProfileVersionsOptions = {
  limit?: number;
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

const getSkillValue = (snapshot: Record<string, unknown>, key: string): number | undefined => {
  const categories = snapshot.skillMap;

  if (!isRecord(categories)) {
    return undefined;
  }

  const skillMapCategories = categories.categories;

  if (!isRecord(skillMapCategories)) {
    return undefined;
  }

  const skill = skillMapCategories[key];

  if (!isRecord(skill) || typeof skill.value !== 'number') {
    return undefined;
  }

  return skill.value;
};

const getStringArrayFromItems = (
  items: unknown,
  field: 'key' | 'name',
): string[] => {
  if (!Array.isArray(items)) {
    return [];
  }

  return items
    .map((item) => {
      if (!isRecord(item)) {
        return '';
      }

      const value = item[field];

      return typeof value === 'string' ? value.trim() : '';
    })
    .filter(Boolean);
};

const getChangedKeys = (
  beforeItems: unknown,
  afterItems: unknown,
  keyField: 'key' | 'name',
): string[] => {
  if (!Array.isArray(beforeItems) || !Array.isArray(afterItems)) {
    return [];
  }

  const beforeMap = new Map<string, string>();

  for (const item of beforeItems) {
    if (!isRecord(item)) {
      continue;
    }

    const key = typeof item[keyField] === 'string' ? item[keyField].trim() : '';

    if (!key) {
      continue;
    }

    beforeMap.set(key, JSON.stringify(item));
  }

  return afterItems
    .map((item) => {
      if (!isRecord(item)) {
        return '';
      }

      const key = typeof item[keyField] === 'string' ? item[keyField].trim() : '';

      if (!key) {
        return '';
      }

      return beforeMap.get(key) !== JSON.stringify(item) ? key : '';
    })
    .filter(Boolean);
};

export const sanitizePlayerProfileSnapshot = (
  profile: PlayerProfileDocument | Record<string, unknown>,
): Record<string, unknown> => {
  const plainProfile = toPlainObject(profile);
  const snapshot: Record<string, unknown> = {};

  for (const key of SNAPSHOT_KEYS) {
    if (plainProfile[key] !== undefined) {
      snapshot[key] = plainProfile[key];
    }
  }

  delete snapshot.__v;
  delete snapshot._id;
  delete snapshot.userId;
  delete snapshot.updatedAt;

  return snapshot;
};

export const buildProfileChangesSummary = (
  beforeProfile: Record<string, unknown>,
  afterProfile: Record<string, unknown>,
  _profileDelta?: Record<string, unknown>,
): ProfileChangesSummary => {
  const skillKeys = [
    'calculation',
    'positionalUnderstanding',
    'openings',
    'tacticalThemes',
    'endgames',
    'middlegame',
    'timeManagement',
    'psychologicalResilience',
  ];

  const skillMapChanges = skillKeys
    .map((key) => {
      const previousValue = getSkillValue(beforeProfile, key);
      const newValue = getSkillValue(afterProfile, key);

      if (previousValue === newValue) {
        return null;
      }

      return {
        key,
        previousValue,
        newValue,
      };
    })
    .filter(Boolean) as NonNullable<ProfileChangesSummary['skillMapChanges']>;

  const beforePrimaryStyle = isRecord(beforeProfile.playingStyle)
    ? beforeProfile.playingStyle.primaryStyle
    : undefined;
  const afterPrimaryStyle = isRecord(afterProfile.playingStyle)
    ? afterProfile.playingStyle.primaryStyle
    : undefined;

  const beforeRecurringMistakes = getStringArrayFromItems(beforeProfile.recurringMistakes, 'key');
  const afterRecurringMistakes = getStringArrayFromItems(afterProfile.recurringMistakes, 'key');
  const beforeStrengths = getStringArrayFromItems(beforeProfile.strengths, 'key');
  const afterStrengths = getStringArrayFromItems(afterProfile.strengths, 'key');
  const beforeCurrentFocus = isRecord(beforeProfile.recommendations)
    ? beforeProfile.recommendations.currentFocus
    : undefined;
  const afterCurrentFocus = isRecord(afterProfile.recommendations)
    ? afterProfile.recommendations.currentFocus
    : undefined;
  const beforeCriticalPhase = isRecord(beforeProfile.criticalPhaseWeakness)
    ? beforeProfile.criticalPhaseWeakness.phase
    : undefined;
  const afterCriticalPhase = isRecord(afterProfile.criticalPhaseWeakness)
    ? afterProfile.criticalPhaseWeakness.phase
    : undefined;

  return {
    skillMapChanges,
    playingStyleChanged: beforePrimaryStyle !== afterPrimaryStyle,
    previousPrimaryStyle:
      typeof beforePrimaryStyle === 'string' ? beforePrimaryStyle : undefined,
    newPrimaryStyle: typeof afterPrimaryStyle === 'string' ? afterPrimaryStyle : undefined,
    newRecurringMistakes: afterRecurringMistakes.filter(
      (key) => !beforeRecurringMistakes.includes(key),
    ),
    removedRecurringMistakes: beforeRecurringMistakes.filter(
      (key) => !afterRecurringMistakes.includes(key),
    ),
    updatedRecurringMistakes: getChangedKeys(
      beforeProfile.recurringMistakes,
      afterProfile.recurringMistakes,
      'key',
    ),
    newStrengths: afterStrengths.filter((key) => !beforeStrengths.includes(key)),
    updatedStrengths: getChangedKeys(beforeProfile.strengths, afterProfile.strengths, 'key'),
    currentFocusChanged: beforeCurrentFocus !== afterCurrentFocus,
    previousCurrentFocus:
      typeof beforeCurrentFocus === 'string' ? beforeCurrentFocus : undefined,
    newCurrentFocus: typeof afterCurrentFocus === 'string' ? afterCurrentFocus : undefined,
    criticalPhaseChanged: beforeCriticalPhase !== afterCriticalPhase,
    previousCriticalPhase:
      typeof beforeCriticalPhase === 'string' ? beforeCriticalPhase : undefined,
    newCriticalPhase: typeof afterCriticalPhase === 'string' ? afterCriticalPhase : undefined,
  };
};

export const getNextVersionNumber = async (userId: string): Promise<number> => {
  const latestVersion = await PlayerProfileVersion.findOne({
    userId: ensureObjectId(userId, 'user id'),
  })
    .sort({ versionNumber: -1 })
    .select({ versionNumber: 1 })
    .exec();

  return (latestVersion?.versionNumber ?? 0) + 1;
};

export const createProfileVersion = async (
  input: CreatePlayerProfileVersionInput,
): Promise<PlayerProfileVersionDocument> => {
  const versionNumber = await getNextVersionNumber(input.userId);

  return PlayerProfileVersion.create({
    userId: ensureObjectId(input.userId, 'user id'),
    profileId: ensureObjectId(input.profileId, 'profile id'),
    ...(input.batchId ? { batchId: ensureObjectId(input.batchId, 'batch id') } : {}),
    source: input.source,
    versionNumber,
    label: input.label,
    description: input.description,
    snapshot: input.snapshot,
    changesSummary: input.changesSummary,
    relatedProfileDelta: input.relatedProfileDelta,
    ...(input.restoredFromVersionId
      ? {
          restoredFromVersionId: ensureObjectId(
            input.restoredFromVersionId,
            'restored from version id',
          ),
        }
      : {}),
    restoredAt: input.restoredAt,
    isRestorePoint: input.isRestorePoint ?? true,
  });
};

export const createSnapshotBeforeBatchUpdate = async (
  userId: string,
  batchId: string,
): Promise<PlayerProfileVersionDocument> => {
  const profile = await getOrCreatePlayerProfile(userId);

  return createProfileVersion({
    userId,
    profileId: profile._id.toString(),
    batchId,
    source: 'before_batch_update',
    label: 'Before batch profile update',
    description: 'Snapshot created before applying profile update from analysis batch.',
    snapshot: sanitizePlayerProfileSnapshot(profile),
  });
};

export const getCurrentPlayerProfileSnapshot = async (
  userId: string,
): Promise<{
  profile: PlayerProfileDocument;
  snapshot: Record<string, unknown>;
}> => {
  const profile = await getOrCreatePlayerProfile(userId);

  return {
    profile,
    snapshot: sanitizePlayerProfileSnapshot(profile),
  };
};

export const createSnapshotAfterBatchUpdate = async ({
  userId,
  batchId,
  profileDelta,
  beforeSnapshot,
  updatedProfile,
}: CreateAfterBatchSnapshotInput): Promise<PlayerProfileVersionDocument> => {
  const afterSnapshot = sanitizePlayerProfileSnapshot(updatedProfile);

  return createProfileVersion({
    userId,
    profileId: updatedProfile._id.toString(),
    batchId,
    source: 'after_batch_update',
    label: 'After batch profile update',
    description: 'Snapshot created after applying profile update from analysis batch.',
    snapshot: afterSnapshot,
    relatedProfileDelta: profileDelta,
    changesSummary: buildProfileChangesSummary(beforeSnapshot, afterSnapshot, profileDelta),
  });
};

export const getProfileVersion = async (
  userId: string,
  versionId: string,
): Promise<PlayerProfileVersionDocument> => {
  const version = await PlayerProfileVersion.findOne({
    _id: ensureObjectId(versionId, 'version id'),
    userId: ensureObjectId(userId, 'user id'),
  }).exec();

  if (!version) {
    throw new AppError('Player profile version not found.', 404);
  }

  return version;
};

export const getPreviousProfileVersionIdForBatch = async (
  userId: string,
  batchId: string,
): Promise<string | null> => {
  const batchVersion = await PlayerProfileVersion.findOne({
    userId: ensureObjectId(userId, 'user id'),
    batchId: ensureObjectId(batchId, 'batch id'),
    source: 'after_batch_update',
  })
    .sort({ versionNumber: -1 })
    .select({ versionNumber: 1 })
    .exec();

  if (!batchVersion) {
    return null;
  }

  const previousVersion = await PlayerProfileVersion.findOne({
    userId: ensureObjectId(userId, 'user id'),
    versionNumber: { $lt: batchVersion.versionNumber },
    source: { $ne: 'restore' },
  })
    .sort({ versionNumber: -1 })
    .select({ _id: 1 })
    .exec();

  return previousVersion?._id.toString() ?? null;
};

export const listProfileVersions = async (
  userId: string,
  options?: ListProfileVersionsOptions,
): Promise<{
  items: Array<Record<string, unknown>>;
}> => {
  const limit = Math.min(options?.limit ?? 50, 100);
  const versions = await PlayerProfileVersion.find({
    userId: ensureObjectId(userId, 'user id'),
  })
    .sort({ versionNumber: -1 })
    .limit(limit)
    .exec();

  const batchIds = versions
    .map((version) => version.batchId?.toString())
    .filter((value): value is string => Boolean(value));
  const batches = batchIds.length
    ? await AnalysisBatch.find({ _id: { $in: batchIds.map((id) => ensureObjectId(id, 'batch id')) } })
        .select({ totalGames: 1 })
        .exec()
    : [];
  const batchGamesMap = new Map(batches.map((batch) => [batch._id.toString(), batch.totalGames]));
  const currentVersionId = versions[0]?._id.toString();

  return {
    items: versions.map((version) => ({
      id: version._id.toString(),
      versionNumber: version.versionNumber,
      source: version.source,
      batchId: version.batchId?.toString(),
      label: version.label,
      description: version.description,
      changesSummary: version.changesSummary,
      gamesAnalyzed: version.batchId
        ? batchGamesMap.get(version.batchId.toString()) ?? null
        : null,
      status:
        version.source === 'restore'
          ? 'restored'
          : version._id.toString() === currentVersionId
            ? 'current'
            : 'historical',
      createdAt: version.createdAt,
    })),
  };
};

const applySnapshotToProfile = (
  profile: PlayerProfileDocument,
  snapshot: Record<string, unknown>,
): void => {
  for (const key of SNAPSHOT_KEYS) {
    if (snapshot[key] !== undefined) {
      profile.set(key, snapshot[key]);
    }
  }
};

const markBatchesAfterVersionAsReverted = async (
  userId: string,
  restoredVersion: PlayerProfileVersionDocument,
  revertedToVersionId: string,
): Promise<void> => {
  const revertedBatchVersions = await PlayerProfileVersion.find({
    userId: ensureObjectId(userId, 'user id'),
    versionNumber: { $gt: restoredVersion.versionNumber },
    source: 'after_batch_update',
    batchId: { $exists: true, $ne: null },
  })
    .select({ batchId: 1 })
    .exec();

  const revertedBatchIds = revertedBatchVersions
    .map((batchVersion) => batchVersion.batchId)
    .filter((batchId): batchId is Types.ObjectId => Boolean(batchId));

  if (revertedBatchIds.length === 0) {
    return;
  }

  await AnalysisBatch.updateMany(
    {
      userId: ensureObjectId(userId, 'user id'),
      _id: { $in: revertedBatchIds },
    },
    {
      $set: {
        'profileUpdate.profileImpactReverted': true,
        'profileUpdate.revertedAt': new Date(),
        'profileUpdate.revertedToVersionId': ensureObjectId(
          revertedToVersionId,
          'reverted to version id',
        ),
      },
    },
  ).exec();
};

export const restoreProfileVersion = async (
  userId: string,
  versionId: string,
): Promise<{
  restored: true;
  restoredVersionId: string;
  newVersionId: string;
  profile: PlayerProfileDocument;
}> => {
  const version = await getProfileVersion(userId, versionId);
  const profile = await getOrCreatePlayerProfile(userId);

  const originalCreatedAt = profile.createdAt;
  const originalUserId = profile.userId;
  applySnapshotToProfile(profile, version.snapshot);
  profile.userId = originalUserId;
  profile.createdAt = originalCreatedAt;
  profile.lastProfileUpdateAt = new Date();
  await profile.save();

  await markBatchesAfterVersionAsReverted(
    userId,
    version,
    version._id.toString(),
  );

  return {
    restored: true,
    restoredVersionId: version._id.toString(),
    newVersionId: version._id.toString(),
    profile,
  };
};

export const getProfileVersionDetails = async (userId: string, versionId: string) => {
  const version = await getProfileVersion(userId, versionId);

  return {
    id: version._id.toString(),
    versionNumber: version.versionNumber,
    source: version.source,
    batchId: version.batchId?.toString(),
    label: version.label,
    description: version.description,
    snapshot: version.snapshot,
    changesSummary: version.changesSummary,
    relatedProfileDelta: version.relatedProfileDelta,
    restoredFromVersionId: version.restoredFromVersionId?.toString(),
    restoredAt: version.restoredAt ?? null,
    createdAt: version.createdAt,
    updatedAt: version.updatedAt,
  };
};

export const getProfileVersionProfileView = async (userId: string, versionId: string) => {
  const version = await getProfileVersion(userId, versionId);

  return {
    mode: 'historical',
    isHistoricalVersion: true,
    versionId: version._id.toString(),
    versionNumber: version.versionNumber,
    source: version.source,
    batchId: version.batchId?.toString(),
    createdAt: version.createdAt,
    restoredFromVersionId: version.restoredFromVersionId?.toString() ?? null,
    profile: version.snapshot,
  };
};
