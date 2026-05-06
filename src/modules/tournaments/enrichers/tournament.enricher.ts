import { env } from '../../../config/env';
import { ImportedTournament } from '../importers/importer.types';
import { normalizeTournament } from '../tournament.normalizer';
import { extractTournamentDates } from '../utils/date-parser';
import { enrichCbxTournament } from './cbx.enricher';
import {
  EnrichmentBatchResult,
  TournamentEnrichmentInput,
  TournamentEnrichmentResult,
} from './enricher.types';
import { enrichChessResultsTournament } from './chess-results.enricher';

const sleep = async (ms: number): Promise<void> => {
  if (ms <= 0) {
    return;
  }

  await new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
};

const combineText = (...values: (string | undefined)[]): string | undefined => {
  const combined = values.filter(Boolean).join(' ').replace(/\s+/g, ' ').trim();

  return combined || undefined;
};

const shouldEnrichTournament = (tournament: ImportedTournament): boolean => {
  if (!tournament.sourceUrl) {
    return false;
  }

  if (!env.tournamentsEnrichOnlyMissingDate) {
    return true;
  }

  const normalizedTournament = normalizeTournament(tournament);

  return !normalizedTournament?.startDate;
};

const enrichTournament = async (
  input: TournamentEnrichmentInput,
): Promise<TournamentEnrichmentResult> => {
  if (input.source === 'CBX') {
    return enrichCbxTournament(input);
  }

  return enrichChessResultsTournament(input);
};

export const mergeTournamentWithEnrichment = (
  tournament: ImportedTournament,
  enrichment?: TournamentEnrichmentResult,
): ImportedTournament => {
  if (!enrichment || enrichment.enrichmentStatus === 'skipped') {
    return {
      ...tournament,
      enrichment: {
        lastEnrichedAt: new Date(),
        status: 'skipped',
      },
    };
  }

  const merged: ImportedTournament = {
    ...tournament,
    title: tournament.title || enrichment.title || '',
    rawDateText: tournament.rawDateText || enrichment.rawDateText,
    locationRaw: tournament.locationRaw || enrichment.locationRaw,
    description: combineText(tournament.description, enrichment.description),
    htmlSnippet: enrichment.htmlSnippet || tournament.htmlSnippet,
    timeControlRaw: tournament.timeControlRaw || enrichment.timeControlRaw,
    statusRaw: tournament.statusRaw || enrichment.statusRaw,
    organizer: tournament.organizer || enrichment.organizer,
    ratingType: tournament.ratingType || enrichment.ratingType,
    enrichment: {
      lastEnrichedAt: new Date(),
      status: enrichment.enrichmentStatus,
      error: enrichment.enrichmentError,
    },
    raw: {
      ...tournament.raw,
      htmlSnippet: enrichment.htmlSnippet || tournament.raw?.htmlSnippet,
      data: {
        ...(typeof tournament.raw?.data === 'object' && tournament.raw.data
          ? tournament.raw.data
          : {}),
        enrichmentUsefulLinks: enrichment.usefulLinks,
      },
    },
  };

  return merged;
};

export const enrichTournaments = async (
  tournaments: ImportedTournament[],
): Promise<{ tournaments: ImportedTournament[]; metrics: EnrichmentBatchResult }> => {
  const metrics: EnrichmentBatchResult = {
    enabled: env.tournamentsEnrichEnabled,
    attempted: 0,
    success: 0,
    failed: 0,
    skipped: 0,
    withDateAfterEnrichment: 0,
    errors: [],
  };

  if (!env.tournamentsEnrichEnabled) {
    return {
      tournaments,
      metrics: {
        ...metrics,
        skipped: tournaments.length,
      },
    };
  }

  const candidates = tournaments
    .map((tournament, index) => ({ tournament, index }))
    .filter(({ tournament }) => shouldEnrichTournament(tournament))
    .slice(0, env.tournamentsEnrichMaxPerSync);
  const candidateIndexes = new Set(candidates.map(({ index }) => index));
  const enrichedTournaments = tournaments.map((tournament, index) =>
    candidateIndexes.has(index) ? tournament : mergeTournamentWithEnrichment(tournament),
  );

  metrics.skipped = tournaments.length - candidates.length;

  for (let index = 0; index < candidates.length; index += env.tournamentsEnrichConcurrency) {
    const batch = candidates.slice(index, index + env.tournamentsEnrichConcurrency);
    const results = await Promise.all(
      batch.map(async ({ tournament, index: tournamentIndex }) => {
        metrics.attempted += 1;

        const enrichment = await enrichTournament({
          source: tournament.source,
          sourceUrl: tournament.sourceUrl,
          sourceId: tournament.sourceId,
          title: tournament.title,
        });

        if (enrichment.enrichmentStatus === 'success') {
          metrics.success += 1;
        } else {
          metrics.failed += 1;
          metrics.errors.push({
            source: tournament.source,
            sourceUrl: tournament.sourceUrl,
            message: enrichment.enrichmentError ?? 'Enrichment failed',
          });
        }

        const mergedTournament = mergeTournamentWithEnrichment(tournament, enrichment);
        const dateResult = extractTournamentDates({
          title: mergedTournament.title,
          rawDateText: mergedTournament.rawDateText,
          locationRaw: mergedTournament.locationRaw,
          description: mergedTournament.description,
          htmlSnippet: mergedTournament.htmlSnippet ?? mergedTournament.raw?.htmlSnippet,
          source: mergedTournament.source,
        });

        if (dateResult.startDate) {
          metrics.withDateAfterEnrichment += 1;
        }

        return {
          tournamentIndex,
          mergedTournament,
        };
      }),
    );

    for (const result of results) {
      enrichedTournaments[result.tournamentIndex] = result.mergedTournament;
    }

    if (index + env.tournamentsEnrichConcurrency < candidates.length) {
      await sleep(env.tournamentsEnrichDelayMs);
    }
  }

  return {
    tournaments: enrichedTournaments,
    metrics,
  };
};
