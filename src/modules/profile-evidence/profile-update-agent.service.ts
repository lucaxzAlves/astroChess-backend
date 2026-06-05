import axios from 'axios';

import { env } from '../../config/env';
import type { ProfileUpdateAgentInput, ProfileUpdateAgentResult } from './profile-evidence.types';

const isRecord = (value: unknown): value is Record<string, unknown> => {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
};

const stripMarkdownCodeFence = (value: string): string => {
  return value
    .trim()
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/\s*```$/i, '')
    .trim();
};

const tryParseJsonString = (value: string): unknown | undefined => {
  try {
    return JSON.parse(stripMarkdownCodeFence(value));
  } catch {
    return undefined;
  }
};

const normalizeAgentResponseData = (responseData: unknown): unknown => {
  if (Array.isArray(responseData)) {
    return responseData.length > 0 ? normalizeAgentResponseData(responseData[0]) : responseData;
  }

  if (typeof responseData === 'string') {
    return tryParseJsonString(responseData) ?? responseData;
  }

  if (!isRecord(responseData)) {
    return responseData;
  }

  for (const key of ['output', 'text', 'message', 'rawOutput', 'data']) {
    const nestedValue = responseData[key];

    if (nestedValue !== undefined) {
      const normalizedNestedValue = normalizeAgentResponseData(nestedValue);

      if (normalizedNestedValue !== undefined) {
        return normalizedNestedValue;
      }
    }
  }

  return responseData;
};

export const parseProfileUpdateAgentResponse = (
  rawResponse: unknown,
): ProfileUpdateAgentResult => {
  const normalizedData = normalizeAgentResponseData(rawResponse);

  if (!isRecord(normalizedData)) {
    return {
      success: false,
      rawResponse,
      error: 'Agent 2 response could not be normalized into an object.',
    };
  }

  if (!isRecord(normalizedData.profileDelta)) {
    return {
      success: false,
      rawResponse,
      error: 'Agent 2 response did not include a valid profileDelta.',
    };
  }

  return {
    success: normalizedData.success === false ? false : true,
    rawResponse,
    profileDelta: normalizedData.profileDelta,
  };
};

export const requestProfileUpdate = async (
  input: ProfileUpdateAgentInput,
): Promise<ProfileUpdateAgentResult> => {
  if (!env.profileUpdateEnabled) {
    return {
      success: false,
      error: 'Profile update agent disabled.',
    };
  }

  if (!env.profileUpdateWebhookUrl) {
    return {
      success: false,
      error: 'PROFILE_UPDATE_WEBHOOK_URL is not configured.',
    };
  }

  try {
    const response = await axios.post<unknown>(env.profileUpdateWebhookUrl, input, {
      timeout: env.profileUpdateTimeoutMs,
      headers: {
        'Content-Type': 'application/json',
      },
    });

    return parseProfileUpdateAgentResponse(response.data);
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Profile update webhook failed.',
    };
  }
};
