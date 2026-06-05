import axios from 'axios';

import { env } from '../../config/env';
import {
  AiGameReviewInput,
  AiGameReviewResult,
  AiReviewWebhookPayload,
  ParsedProfileGameEvidenceAgentResponse,
  ProfileGameEvidenceSummary,
} from './ai-review.types';
import type { StructuredGameSummary } from '../player-profile/player-profile.types';

const isRecord = (value: unknown): value is Record<string, unknown> => {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
};

const asNonEmptyString = (value: unknown): string | undefined => {
  return typeof value === 'string' && value.trim() ? value.trim() : undefined;
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

const extractNestedResponseCandidate = (responseData: unknown): unknown => {
  if (Array.isArray(responseData)) {
    return responseData.length > 0 ? extractNestedResponseCandidate(responseData[0]) : responseData;
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
      const normalizedNestedValue = extractNestedResponseCandidate(nestedValue);

      if (normalizedNestedValue !== undefined) {
        return normalizedNestedValue;
      }
    }
  }

  return responseData;
};

const normalizeWebhookResponseData = (responseData: unknown): unknown => {
  return extractNestedResponseCandidate(responseData);
};

export const extractReviewText = (responseData: unknown): string | undefined => {
  const normalizedData = normalizeWebhookResponseData(responseData);

  if (typeof normalizedData === 'string') {
    return asNonEmptyString(normalizedData);
  }

  if (!isRecord(normalizedData)) {
    return undefined;
  }

  return (
    asNonEmptyString(normalizedData.reviewText) ??
    asNonEmptyString(normalizedData.text) ??
    asNonEmptyString(normalizedData.message) ??
    asNonEmptyString(normalizedData.output)
  );
};

export const extractStructuredSummary = (
  responseData: unknown,
): StructuredGameSummary | undefined => {
  const normalizedData = normalizeWebhookResponseData(responseData);

  if (!isRecord(normalizedData)) {
    return undefined;
  }

  if (isRecord(normalizedData.structuredSummary)) {
    return normalizedData.structuredSummary as StructuredGameSummary;
  }

  if (isRecord(normalizedData.summary)) {
    return normalizedData.summary as StructuredGameSummary;
  }

  return undefined;
};

const ensureWebhookConfig = (): string => {
  if (env.aiReviewEnabled && !env.aiReviewWebhookUrl) {
    throw new Error('AI_REVIEW_WEBHOOK_URL is required when AI_REVIEW_ENABLED=true');
  }

  return env.aiReviewWebhookUrl;
};

const isProfileGameEvidenceSummary = (
  value: unknown,
): value is ProfileGameEvidenceSummary => {
  return isRecord(value);
};

export const normalizeGameEvidenceSummary = (
  summary: ProfileGameEvidenceSummary,
): ProfileGameEvidenceSummary => {
  const targetColor = summary.targetPlayer?.color ?? 'unknown';
  const notesForAggregation = [...(summary.notesForAggregation ?? [])];

  const normalizeBelongsTo = (
    belongsTo: string | undefined,
    side: string | undefined,
  ): 'targetPlayer' | 'opponent' | 'both' | 'unknown' | undefined => {
    if (belongsTo !== 'targetPlayer' && belongsTo !== 'opponent' && belongsTo !== 'both') {
      return belongsTo === 'unknown' ? 'unknown' : undefined;
    }

    if (
      belongsTo === 'targetPlayer' &&
      targetColor !== 'unknown' &&
      side &&
      side !== targetColor &&
      side !== 'unknown'
    ) {
      notesForAggregation.push(
        `Corrected belongsTo from targetPlayer to opponent for side ${side}.`,
      );

      return 'opponent';
    }

    return belongsTo;
  };

  const normalizedDecisiveMoment = summary.decisiveMoment
    ? {
        ...summary.decisiveMoment,
        belongsTo: normalizeBelongsTo(
          summary.decisiveMoment.belongsTo,
          summary.decisiveMoment.side,
        ),
      }
    : undefined;

  const normalizedTargetMistakes = (summary.targetMistakes ?? []).flatMap((mistake) => {
    const side = mistake.sideThatErred;
    const belongsTo = normalizeBelongsTo(mistake.belongsTo, side);

    if (belongsTo === 'opponent') {
      notesForAggregation.push(
        `Removed targetMistake ${mistake.name ?? mistake.key ?? 'unknown'} because it belonged to the opponent.`,
      );

      return [];
    }

    return [
      {
        ...mistake,
        belongsTo: belongsTo ?? 'targetPlayer',
      },
    ];
  });

  const normalizedMissedOpportunities = (summary.missedOpportunities ?? []).map((opportunity) => ({
    ...opportunity,
    belongsTo: normalizeBelongsTo(opportunity.belongsTo, opportunity.sideThatErred) ?? opportunity.belongsTo,
  }));

  const normalizedMistakePatterns = (summary.mistakePatterns ?? []).map((pattern) => ({
    ...pattern,
    belongsTo: normalizeBelongsTo(pattern.belongsTo, undefined) ?? pattern.belongsTo,
  }));

  const normalizedStrengths = (summary.strengths ?? []).map((strength) => ({
    ...strength,
    belongsTo: normalizeBelongsTo(strength.belongsTo, undefined) ?? strength.belongsTo,
  }));

  return {
    ...summary,
    decisiveMoment: normalizedDecisiveMoment,
    targetMistakes: normalizedTargetMistakes,
    missedOpportunities: normalizedMissedOpportunities,
    mistakePatterns: normalizedMistakePatterns,
    strengths: normalizedStrengths,
    notesForAggregation,
  };
};

export const parseProfileGameEvidenceAgentResponse = (
  rawResponse: unknown,
): ParsedProfileGameEvidenceAgentResponse => {
  const normalizedData = normalizeWebhookResponseData(rawResponse);

  if (!isRecord(normalizedData)) {
    return {
      success: false,
      rawResponse,
      error: 'Agent 1 response could not be normalized into an object.',
    };
  }

  const candidateSummary = normalizedData.gameEvidenceSummary;

  if (!isProfileGameEvidenceSummary(candidateSummary)) {
    return {
      success: false,
      rawResponse,
      error: 'Agent 1 response did not include a valid gameEvidenceSummary.',
    };
  }

  return {
    success: normalizedData.success === false ? false : true,
    gameEvidenceSummary: normalizeGameEvidenceSummary(candidateSummary),
    rawResponse,
  };
};

const buildPayload = (input: AiGameReviewInput): AiReviewWebhookPayload => {
  return {
    type: 'GAME_REVIEW_REQUEST',
    analysisType: input.analysisType ?? 'single_game',
    targetPlayer: input.targetPlayer,
    game: {
      id: input.gameId,
      playerTarget: input.targetPlayer,
      metadata: input.metadata,
      originalPgn: input.originalPgn,
      annotatedPgn: input.annotatedPgn,
      criticalMoments: input.criticalMoments,
      moveClassifications: input.moveClassifications,
      moveClassificationSummary: input.moveClassificationSummary,
      accuracy: input.accuracy,
    },
    profileSummary: input.profileSummary ?? null,
    instructions: {
      language: 'pt-BR',
      style: 'human_chess_coach',
      goal: 'Transformar a análise técnica em uma explicação humana, didática e útil para o jogador.',
    },
  };
};

export const requestAiGameReview = async (
  input: AiGameReviewInput,
): Promise<AiGameReviewResult> => {
  if (!env.aiReviewEnabled) {
    return {
      success: false,
      error: 'AI review is disabled',
    };
  }

  const webhookUrl = ensureWebhookConfig();
  const startedAt = Date.now();

  try {
    console.log('Calling AI review webhook', {
      gameId: input.gameId,
      criticalMoments: input.criticalMoments.length,
    });

    const response = await axios.post<unknown>(webhookUrl, buildPayload(input), {
      timeout: env.aiReviewTimeoutMs,
      headers: {
        'Content-Type': 'application/json',
      },
    });
    const normalizedResponseData = normalizeWebhookResponseData(response.data);

    if (input.analysisType === 'profile_game_evidence') {
      const parsedEvidenceResponse = parseProfileGameEvidenceAgentResponse(response.data);

      console.log('AI review webhook responded', {
        gameId: input.gameId,
        durationMs: Date.now() - startedAt,
        hasGameEvidenceSummary: Boolean(parsedEvidenceResponse.gameEvidenceSummary),
      });

      if (!parsedEvidenceResponse.success || !parsedEvidenceResponse.gameEvidenceSummary) {
        return {
          success: false,
          rawResponse: parsedEvidenceResponse.rawResponse,
          error:
            parsedEvidenceResponse.error ??
            'AI review response did not include a valid gameEvidenceSummary.',
        };
      }

      return {
        success: true,
        gameEvidenceSummary: parsedEvidenceResponse.gameEvidenceSummary,
        structuredSummary: {
          type: 'profile_game_evidence',
          gameEvidenceSummary: parsedEvidenceResponse.gameEvidenceSummary,
        },
        rawResponse: parsedEvidenceResponse.rawResponse,
      };
    }

    const reviewText = extractReviewText(normalizedResponseData);
    const structuredSummary = extractStructuredSummary(normalizedResponseData);

    console.log('AI review webhook responded', {
      gameId: input.gameId,
      durationMs: Date.now() - startedAt,
      hasReviewText: Boolean(reviewText),
      hasStructuredSummary: Boolean(structuredSummary),
    });

    return {
      success: Boolean(reviewText),
      reviewText,
      structuredSummary,
      rawResponse: response.data,
      ...(reviewText ? {} : { error: 'AI review response did not include review text' }),
    };
  } catch (error) {
    console.error('AI review webhook failed', {
      gameId: input.gameId,
      durationMs: Date.now() - startedAt,
      error: error instanceof Error ? error.message : error,
    });

    return {
      success: false,
      error: 'AI review webhook failed',
    };
  }
};

export const requestSingleGameReview = requestAiGameReview;
