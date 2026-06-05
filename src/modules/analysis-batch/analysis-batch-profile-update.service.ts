import { env } from '../../config/env';
import { applyProfileDeltaToPlayerProfile } from '../player-profile/player-profile.service';
import { buildProfileUpdateAgentInput } from '../profile-evidence/profile-evidence.service';
import {
  createSnapshotAfterBatchUpdate,
  getCurrentPlayerProfileSnapshot,
} from '../player-profile-version/player-profile-version.service';
import { markBatchAnalysesAsProfileProcessed } from '../game-analysis/game-analysis.service';
import { requestProfileUpdate } from '../profile-evidence/profile-update-agent.service';
import type { AnalysisBatchDocument } from './analysis-batch.types';

type ExecuteBatchProfileUpdateResult = {
  success: boolean;
  enabled: boolean;
  batchId: string;
  profileUpdateStatus: 'not_started' | 'skipped' | 'processing' | 'completed' | 'failed';
  playerProfileUpdated: boolean;
  profileDelta?: Record<string, unknown>;
  payload?: Record<string, unknown>;
  error?: string;
};

const saveBatch = async (batch: AnalysisBatchDocument): Promise<void> => {
  await batch.save();
};

export const executeBatchProfileUpdate = async (
  batch: AnalysisBatchDocument,
  userId: string,
): Promise<ExecuteBatchProfileUpdateResult> => {
  const input = await buildProfileUpdateAgentInput(userId, batch._id.toString());

  if (!env.profileUpdateEnabled) {
    batch.profileUpdate = {
      ...batch.profileUpdate,
      status: 'skipped',
      inputPreview: input,
      profileEvidence: input.profileEvidence,
      profileEvidencePayloadPreview: input.profileEvidence,
      processedAt: new Date(),
      error: undefined,
      rawResponse: undefined,
      playerProfileUpdated: false,
    };
    batch.status = 'awaiting_profile_update';
    await saveBatch(batch);

    return {
      success: true,
      enabled: false,
      batchId: batch._id.toString(),
      profileUpdateStatus: 'skipped',
      playerProfileUpdated: false,
      payload: input as Record<string, unknown>,
    };
  }

  batch.status = 'profile_update_processing';
  batch.profileUpdate = {
    ...batch.profileUpdate,
    status: 'processing',
    inputPreview: input,
    profileEvidence: input.profileEvidence,
    profileEvidencePayloadPreview: input.profileEvidence,
    error: undefined,
    playerProfileUpdated: false,
  };
  await saveBatch(batch);

  const result = await requestProfileUpdate(input);

  if (!result.success || !result.profileDelta) {
    batch.status = 'profile_update_failed';
    batch.profileUpdate = {
      ...batch.profileUpdate,
      status: 'failed',
      profileDelta: result.profileDelta,
      rawResponse: result.rawResponse,
      error: result.error ?? 'Profile update agent failed.',
      processedAt: new Date(),
      playerProfileUpdated: false,
    };
    batch.errors.push({
      message: result.error ?? 'Profile update agent failed.',
      stage: 'profile_update',
      createdAt: new Date(),
    });
    await saveBatch(batch);

    return {
      success: false,
      enabled: true,
      batchId: batch._id.toString(),
      profileUpdateStatus: 'failed',
      playerProfileUpdated: false,
      error: result.error ?? 'Profile update agent failed.',
    };
  }

  let playerProfileUpdated = false;

  if (env.profileUpdateApplyToPlayerProfile) {
    try {
      const beforeProfileState = await getCurrentPlayerProfileSnapshot(userId);
      const updatedProfile = await applyProfileDeltaToPlayerProfile(userId, result.profileDelta);
      const afterVersion = await createSnapshotAfterBatchUpdate({
        userId,
        batchId: batch._id.toString(),
        profileDelta: result.profileDelta,
        beforeSnapshot: beforeProfileState.snapshot,
        updatedProfile,
      });

      batch.profileUpdate = {
        ...batch.profileUpdate,
        profileVersionAfterId: afterVersion._id,
      };
      await markBatchAnalysesAsProfileProcessed(batch._id.toString());
      playerProfileUpdated = true;
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : 'Profile delta could not be applied to PlayerProfile.';

      batch.status = 'profile_update_failed';
      batch.profileUpdate = {
        ...batch.profileUpdate,
        status: 'failed',
        profileDelta: result.profileDelta,
        rawResponse: result.rawResponse,
        error: message,
        processedAt: new Date(),
        playerProfileUpdated: false,
      };
      batch.errors.push({
        message,
        stage: 'profile_update',
        createdAt: new Date(),
      });
      await saveBatch(batch);

      return {
        success: false,
        enabled: true,
        batchId: batch._id.toString(),
        profileUpdateStatus: 'failed',
        playerProfileUpdated: false,
        error: message,
      };
    }
  }

  batch.status = 'profile_updated';
  batch.profileUpdate = {
    ...batch.profileUpdate,
    status: 'completed',
    profileDelta: result.profileDelta,
    rawResponse: result.rawResponse,
    processedAt: new Date(),
    error: undefined,
    playerProfileUpdated,
  };
  await saveBatch(batch);

  return {
    success: true,
    enabled: true,
    batchId: batch._id.toString(),
    profileUpdateStatus: 'completed',
    profileDelta: result.profileDelta,
    playerProfileUpdated,
  };
};
