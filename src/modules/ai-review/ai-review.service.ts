import axios from 'axios';

import { env } from '../../config/env';
import { AiGameReviewInput, AiGameReviewResult, AiReviewWebhookPayload } from './ai-review.types';
import type { StructuredGameSummary } from '../player-profile/player-profile.types';

const isRecord = (value: unknown): value is Record<string, unknown> => {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
};

const asNonEmptyString = (value: unknown): string | undefined => {
  return typeof value === 'string' && value.trim() ? value.trim() : undefined;
};

export const extractReviewText = (responseData: unknown): string | undefined => {
  if (typeof responseData === 'string') {
    return asNonEmptyString(responseData);
  }

  if (!isRecord(responseData)) {
    return undefined;
  }

  return (
    asNonEmptyString(responseData.reviewText) ??
    asNonEmptyString(responseData.text) ??
    asNonEmptyString(responseData.message) ??
    asNonEmptyString(responseData.output)
  );
};

export const extractStructuredSummary = (
  responseData: unknown,
): StructuredGameSummary | undefined => {
  if (!isRecord(responseData)) {
    return undefined;
  }

  if (isRecord(responseData.structuredSummary)) {
    return responseData.structuredSummary as StructuredGameSummary;
  }

  if (isRecord(responseData.summary)) {
    return responseData.summary as StructuredGameSummary;
  }

  return undefined;
};

const ensureWebhookConfig = (): string => {
  if (env.aiReviewEnabled && !env.aiReviewWebhookUrl) {
    throw new Error('AI_REVIEW_WEBHOOK_URL is required when AI_REVIEW_ENABLED=true');
  }

  return env.aiReviewWebhookUrl;
};

const buildPayload = (input: AiGameReviewInput): AiReviewWebhookPayload => {
  return {
    type: 'GAME_REVIEW_REQUEST',
    analysisType: 'single_game',
    game: {
      id: input.gameId,
      playerTarget: input.playerTarget,
      metadata: input.metadata,
      originalPgn: input.originalPgn,
      annotatedPgn: input.annotatedPgn,
      criticalMoments: input.criticalMoments,
    },
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
    const reviewText = extractReviewText(response.data);
    const structuredSummary = extractStructuredSummary(response.data);

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
