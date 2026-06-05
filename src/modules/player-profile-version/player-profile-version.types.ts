import type { Document, Types } from 'mongoose';

export const playerProfileVersionSources = [
  'manual_snapshot',
  'before_batch_update',
  'after_batch_update',
  'restore',
  'system',
] as const;

export type PlayerProfileVersionSource = (typeof playerProfileVersionSources)[number];

export type ProfileSkillMapChange = {
  key: string;
  previousValue?: number;
  newValue?: number;
};

export type ProfileChangesSummary = {
  skillMapChanges?: ProfileSkillMapChange[];
  playingStyleChanged?: boolean;
  previousPrimaryStyle?: string;
  newPrimaryStyle?: string;
  newRecurringMistakes?: string[];
  removedRecurringMistakes?: string[];
  updatedRecurringMistakes?: string[];
  newStrengths?: string[];
  updatedStrengths?: string[];
  currentFocusChanged?: boolean;
  previousCurrentFocus?: string;
  newCurrentFocus?: string;
  criticalPhaseChanged?: boolean;
  previousCriticalPhase?: string;
  newCriticalPhase?: string;
};

export type PlayerProfileVersionRecord = {
  userId: Types.ObjectId;
  profileId: Types.ObjectId;
  batchId?: Types.ObjectId;
  source: PlayerProfileVersionSource;
  versionNumber: number;
  label?: string;
  description?: string;
  snapshot: Record<string, unknown>;
  changesSummary?: ProfileChangesSummary;
  relatedProfileDelta?: Record<string, unknown>;
  restoredFromVersionId?: Types.ObjectId;
  restoredAt?: Date;
  isRestorePoint: boolean;
  createdAt: Date;
  updatedAt: Date;
};

export type PlayerProfileVersionDocument = Document & PlayerProfileVersionRecord;

export type CreatePlayerProfileVersionInput = {
  userId: string;
  profileId: string;
  batchId?: string;
  source: PlayerProfileVersionSource;
  label?: string;
  description?: string;
  snapshot: Record<string, unknown>;
  changesSummary?: ProfileChangesSummary;
  relatedProfileDelta?: Record<string, unknown>;
  restoredFromVersionId?: string;
  restoredAt?: Date;
  isRestorePoint?: boolean;
};
