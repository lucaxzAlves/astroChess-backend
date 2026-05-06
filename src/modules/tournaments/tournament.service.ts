import { AppError } from '../../utils/AppError';
import { env } from '../../config/env';
import { enrichTournaments } from './enrichers/tournament.enricher';
import { importCbxTournaments } from './importers/cbx.importer';
import { importChessResultsBrazilTournaments } from './importers/chess-results.importer';
import { ImportedTournament } from './importers/importer.types';
import { normalizeTournament, normalizeText } from './tournament.normalizer';
import * as tournamentRepository from './tournament.repository';
import {
  TournamentListFilters,
  TournamentSource,
  TournamentStatus,
  TournamentSyncMetrics,
  TournamentTimeControl,
} from './tournament.types';
import { extractTournamentDates } from './utils/date-parser';
import { isValidBrazilianState } from './utils/location-parser';

const TIME_CONTROLS = new Set<TournamentTimeControl>([
  'classical',
  'rapid',
  'blitz',
  'mixed',
  'unknown',
]);
const SOURCES = new Set<TournamentSource>(['CBX', 'CHESS_RESULTS']);
const STATUSES = new Set<TournamentStatus>(['upcoming', 'ongoing', 'finished', 'unknown']);

const getStartDateSummary = (tournaments: ImportedTournament[]) => {
  let withStartDate = 0;
  let missingDate = 0;

  for (const tournament of tournaments) {
    const normalizedTournament = normalizeTournament(tournament);

    if (normalizedTournament?.startDate) {
      withStartDate += 1;
    } else {
      missingDate += 1;
    }
  }

  return {
    withStartDate,
    missingDate,
  };
};

const parsePositiveIntegerQuery = (value: unknown, fallback: number, max: number): number => {
  const parsedValue = typeof value === 'string' ? Number(value) : fallback;

  if (!Number.isInteger(parsedValue) || parsedValue <= 0) {
    return fallback;
  }

  return Math.min(parsedValue, max);
};

const parseBooleanQuery = (value: unknown): boolean | undefined => {
  if (value === undefined) {
    return undefined;
  }

  return value === 'true';
};

const parseDateQuery = (value: unknown, fieldName: string): Date | undefined => {
  if (typeof value !== 'string' || !value) {
    return undefined;
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    throw new AppError(`${fieldName} must be a valid date`, 400);
  }

  return date;
};

export const parseTournamentFilters = (query: Record<string, unknown>): TournamentListFilters => {
  const state = typeof query.state === 'string' ? query.state.trim().toUpperCase() : undefined;
  const timeControl =
    typeof query.timeControl === 'string'
      ? (query.timeControl as TournamentTimeControl)
      : undefined;
  const source = typeof query.source === 'string' ? (query.source as TournamentSource) : undefined;
  const status = typeof query.status === 'string' ? (query.status as TournamentStatus) : undefined;

  if (state && !isValidBrazilianState(state)) {
    throw new AppError('Invalid state filter', 400);
  }

  if (timeControl && !TIME_CONTROLS.has(timeControl)) {
    throw new AppError('Invalid timeControl filter', 400);
  }

  if (source && !SOURCES.has(source)) {
    throw new AppError('Invalid source filter', 400);
  }

  if (status && !STATUSES.has(status)) {
    throw new AppError('Invalid status filter', 400);
  }

  return {
    search: typeof query.search === 'string' ? normalizeText(query.search) : undefined,
    city: typeof query.city === 'string' ? query.city.trim() : undefined,
    state,
    timeControl,
    source,
    status,
    startDateFrom: parseDateQuery(query.startDateFrom, 'startDateFrom'),
    startDateTo: parseDateQuery(query.startDateTo, 'startDateTo'),
    upcomingOnly: parseBooleanQuery(query.upcomingOnly),
    page: parsePositiveIntegerQuery(query.page, 1, 100_000),
    limit: parsePositiveIntegerQuery(query.limit, 20, 100),
  };
};

export const syncTournamentsFromSources = async (): Promise<TournamentSyncMetrics> => {
  const metrics: TournamentSyncMetrics = {
    cbxFound: 0,
    chessResultsFound: 0,
    totalNormalized: 0,
    created: 0,
    updated: 0,
    skipped: 0,
    errors: [],
    enrichment: {
      enabled: env.tournamentsEnrichEnabled,
      attempted: 0,
      success: 0,
      failed: 0,
      skipped: 0,
      withDateAfterEnrichment: 0,
      errors: [],
    },
    dateExtraction: {
      beforeEnrichment: {
        withStartDate: 0,
        missingDate: 0,
      },
      afterEnrichment: {
        withStartDate: 0,
        missingDate: 0,
      },
      withStartDate: 0,
      withEndDate: 0,
      missingDate: 0,
      highConfidence: 0,
      mediumConfidence: 0,
      lowConfidence: 0,
      bySource: {
        CBX: {
          total: 0,
          withStartDate: 0,
          missingDate: 0,
        },
        CHESS_RESULTS: {
          total: 0,
          withStartDate: 0,
          missingDate: 0,
        },
      },
    },
  };
  const importedTournaments = [];

  try {
    const cbxTournaments = await importCbxTournaments();
    metrics.cbxFound = cbxTournaments.length;
    importedTournaments.push(...cbxTournaments);
  } catch (error) {
    metrics.errors.push(error instanceof Error ? error.message : 'CBX importer failed');
  }

  try {
    const chessResultsTournaments = await importChessResultsBrazilTournaments();
    metrics.chessResultsFound = chessResultsTournaments.length;
    importedTournaments.push(...chessResultsTournaments);
  } catch (error) {
    metrics.errors.push(error instanceof Error ? error.message : 'Chess-Results importer failed');
  }

  metrics.dateExtraction.beforeEnrichment = getStartDateSummary(importedTournaments);

  const enrichmentResult = await enrichTournaments(importedTournaments);
  metrics.enrichment = enrichmentResult.metrics;
  metrics.dateExtraction.afterEnrichment = getStartDateSummary(enrichmentResult.tournaments);

  for (const importedTournament of enrichmentResult.tournaments) {
    const normalizedTournament = normalizeTournament(importedTournament);

    if (!normalizedTournament) {
      metrics.skipped += 1;
      continue;
    }

    metrics.totalNormalized += 1;
    metrics.dateExtraction.bySource[normalizedTournament.source].total += 1;

    if (normalizedTournament.startDate) {
      metrics.dateExtraction.withStartDate += 1;
      metrics.dateExtraction.bySource[normalizedTournament.source].withStartDate += 1;
    } else {
      metrics.dateExtraction.missingDate += 1;
      metrics.dateExtraction.bySource[normalizedTournament.source].missingDate += 1;
    }

    if (normalizedTournament.endDate) {
      metrics.dateExtraction.withEndDate += 1;
    }

    if (normalizedTournament.tags.includes('date_confidence_high')) {
      metrics.dateExtraction.highConfidence += 1;
    }

    if (normalizedTournament.tags.includes('date_confidence_medium')) {
      metrics.dateExtraction.mediumConfidence += 1;
    }

    if (normalizedTournament.tags.includes('date_confidence_low')) {
      metrics.dateExtraction.lowConfidence += 1;
    }

    if (env.tournamentsDateDebug) {
      console.log('Tournament date extraction', {
        title: normalizedTournament.title,
        rawDateText: normalizedTournament.rawDateText,
        confidence: normalizedTournament.tags.find((tag) => tag.startsWith('date_confidence_')),
        startDate: normalizedTournament.startDate,
        endDate: normalizedTournament.endDate,
        source: normalizedTournament.source,
      });
    }

    try {
      const result = await tournamentRepository.upsertTournament(normalizedTournament);

      if (result.action === 'created') {
        metrics.created += 1;
      } else {
        metrics.updated += 1;
      }
    } catch (error) {
      metrics.skipped += 1;
      metrics.errors.push(error instanceof Error ? error.message : 'Tournament upsert failed');
    }
  }

  return metrics;
};

export const listTournaments = async (query: Record<string, unknown>) => {
  return tournamentRepository.findTournaments(parseTournamentFilters(query));
};

export const getTournament = async (id: string) => {
  return tournamentRepository.getTournamentById(id);
};

export const getTournamentFilters = async () => {
  return tournamentRepository.getAvailableFilters();
};

export const debugExtractDate = (text: string) => {
  if (env.nodeEnv === 'production') {
    throw new AppError('Debug endpoint is not available in production', 404);
  }

  return extractTournamentDates({
    title: text,
    rawDateText: text,
    description: text,
    htmlSnippet: text,
  });
};
