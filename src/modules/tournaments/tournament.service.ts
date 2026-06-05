import { env } from '../../config/env';
import { AppError } from '../../utils/AppError';
import { TournamentDocument } from './tournament.model';
import * as tournamentRepository from './tournament.repository';
import { ChessResultsScraper } from './scrapers/chess-results.scraper';
import {
  extractCityFromText,
  extractStateFromText,
  normalizeSource,
  normalizeSpaces,
  normalizeStatus,
  normalizeTimeControl,
  normalizeTournamentTitle,
} from './scrapers/tournament-normalizer';
import {
  CanonicalTournamentSource,
  CanonicalTournamentStatus,
  TournamentNormalizedInput,
  TournamentSearchFilters,
  TournamentSearchResponse,
  TournamentSyncMetrics,
  TournamentTimeControl,
} from './tournament.types';
import { parseTournamentDate } from './scrapers/tournament-date-parser';

const TIME_CONTROLS = new Set<TournamentTimeControl>([
  'classical',
  'rapid',
  'blitz',
  'bullet',
  'mixed',
  'unknown',
]);
const SOURCES = new Set<CanonicalTournamentSource>(['chess-results', 'cbx', 'manual', 'unknown']);
const STATUSES = new Set<CanonicalTournamentStatus>([
  'not_started',
  'playing',
  'finished',
  'unknown',
]);

const sleep = (ms: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms));

const parsePositiveIntegerQuery = (value: unknown, fallback: number, max: number): number => {
  const parsedValue = typeof value === 'string' ? Number(value) : fallback;

  if (!Number.isInteger(parsedValue) || parsedValue <= 0) {
    return fallback;
  }

  return Math.min(parsedValue, max);
};

const parseBooleanQuery = (value: unknown): boolean | undefined => {
  if (value === undefined) return undefined;
  return value === 'true' || value === true;
};

const parseDateQuery = (value: unknown, fieldName: string): Date | undefined => {
  if (typeof value !== 'string' || !value) return undefined;
  const date = new Date(`${value}T00:00:00.000Z`);

  if (Number.isNaN(date.getTime())) {
    throw new AppError(`${fieldName} must be a valid date`, 400);
  }

  return date;
};

const getCacheExpiresAt = (tournament: TournamentNormalizedInput): Date => {
  const now = new Date();
  const ttlHours =
    tournament.status === 'playing'
      ? 3
      : tournament.status === 'finished'
        ? 24 * 7
        : env.tournamentCacheTtlHours;

  return new Date(now.getTime() + ttlHours * 60 * 60 * 1000);
};

const getDetailLimit = (filters: TournamentSearchFilters): number => {
  return Math.min(filters.limit, env.tournamentScrapeMaxDetailsPerSearch);
};

const parseTournamentSearchFilters = (
  query: Record<string, unknown>,
  forceRefreshOverride?: boolean,
): TournamentSearchFilters => {
  const source =
    typeof query.source === 'string' ? normalizeSource(query.source) : undefined;
  const status =
    typeof query.status === 'string' ? (query.status as CanonicalTournamentStatus) : undefined;
  const timeControl =
    typeof query.timeControl === 'string'
      ? (query.timeControl as TournamentTimeControl)
      : undefined;
  const state = typeof query.state === 'string' ? query.state.trim().toUpperCase() : undefined;

  if (source && source !== 'unknown' && !SOURCES.has(source)) {
    throw new AppError('Invalid source filter', 400);
  }

  if (status && !STATUSES.has(status)) {
    throw new AppError('Invalid status filter', 400);
  }

  if (timeControl && !TIME_CONTROLS.has(timeControl)) {
    throw new AppError('Invalid timeControl filter', 400);
  }

  return {
    state,
    city: typeof query.city === 'string' ? normalizeSpaces(query.city) : undefined,
    timeControl,
    from:
      parseDateQuery(query.from, 'from') ??
      parseDateQuery(query.startDateFrom, 'startDateFrom'),
    to:
      parseDateQuery(query.to, 'to') ?? parseDateQuery(query.startDateTo, 'startDateTo'),
    status,
    search:
      typeof query.search === 'string' && query.search.trim()
        ? normalizeTournamentTitle(query.search)
        : undefined,
    source: source && source !== 'unknown' ? source : undefined,
    forceRefresh: forceRefreshOverride ?? parseBooleanQuery(query.forceRefresh) ?? false,
    page: parsePositiveIntegerQuery(query.page, 1, 100_000),
    limit: parsePositiveIntegerQuery(query.limit, 20, 100),
  };
};

const discoveryToTournament = (
  discovery: {
    title: string;
    sourceUrl: string;
    sourceTournamentId?: string | null;
    statusRaw?: string | null;
    timeControlRaw?: string | null;
    surroundingText?: string | null;
  },
): TournamentNormalizedInput => {
  const dateResult = parseTournamentDate({
    title: discovery.title,
    rawDateText: discovery.surroundingText ?? undefined,
  });
  const normalizedTitle = normalizeTournamentTitle(discovery.title);
  const locationText = discovery.surroundingText ?? discovery.title;
  const tournament: TournamentNormalizedInput = {
    source: 'chess-results',
    sourceTournamentId: discovery.sourceTournamentId ?? undefined,
    sourceUrl: discovery.sourceUrl,
    title: discovery.title,
    normalizedTitle,
    description: discovery.surroundingText ?? null,
    status: normalizeStatus(discovery.statusRaw),
    timeControl: normalizeTimeControl(`${discovery.timeControlRaw ?? ''} ${discovery.title}`),
    startDate: dateResult.startDate,
    endDate: dateResult.endDate,
    dateText: dateResult.dateText,
    dateConfidence: dateResult.dateConfidence,
    location: {
      city: extractCityFromText(locationText),
      state: extractStateFromText(locationText),
      country: 'BR',
      raw: locationText,
    },
    organizer: null,
    arbiter: null,
    federation: null,
    playersCount: null,
    rounds: null,
    system: 'unknown',
    category: null,
    ratingType: 'unknown',
    links: {
      chessResults: discovery.sourceUrl,
    },
    metadata: {
      discovery: true,
    },
    parseWarnings: dateResult.warnings,
    detailsScraped: false,
    lastScrapedAt: new Date(),
    sourceLastUpdatedAt: null,
  };

  return {
    ...tournament,
    cacheExpiresAt: getCacheExpiresAt(tournament),
  };
};

const mergeDiscoveryAndDetails = (
  fallback: TournamentNormalizedInput,
  details: Partial<TournamentNormalizedInput>,
): TournamentNormalizedInput => {
  const merged: TournamentNormalizedInput = {
    ...fallback,
    ...details,
    source: 'chess-results',
    sourceTournamentId: details.sourceTournamentId ?? fallback.sourceTournamentId,
    sourceUrl: details.sourceUrl ?? fallback.sourceUrl,
    title: details.title ?? fallback.title,
    normalizedTitle: normalizeTournamentTitle(details.title ?? fallback.title),
    status:
      details.status && details.status !== 'unknown'
        ? details.status
        : fallback.status,
    timeControl:
      details.timeControl && details.timeControl !== 'unknown'
        ? details.timeControl
        : fallback.timeControl,
    location: {
      city: details.location?.city ?? fallback.location.city ?? null,
      state: details.location?.state ?? fallback.location.state ?? null,
      country: details.location?.country ?? fallback.location.country ?? 'BR',
      venue: details.location?.venue ?? fallback.location.venue ?? null,
      raw: details.location?.raw ?? fallback.location.raw ?? null,
    },
    links: {
      ...fallback.links,
      ...details.links,
      chessResults: details.links?.chessResults ?? fallback.sourceUrl,
    },
    parseWarnings: [...(fallback.parseWarnings ?? []), ...(details.parseWarnings ?? [])],
    detailsScraped: details.detailsScraped ?? fallback.detailsScraped,
    lastScrapedAt: details.lastScrapedAt ?? new Date(),
  };

  return {
    ...merged,
    cacheExpiresAt: getCacheExpiresAt(merged),
  };
};

export const refreshSearch = async (
  filters: TournamentSearchFilters,
): Promise<{ created: number; updated: number; skipped: number; errors: string[] }> => {
  const scraper = new ChessResultsScraper();
  const discovered = await scraper.discoverBrazilTournaments(filters);
  const detailLimit = getDetailLimit(filters);
  const candidates = discovered.slice(0, detailLimit);
  const result = {
    created: 0,
    updated: 0,
    skipped: 0,
    errors: [] as string[],
  };

  for (const [index, discovery] of candidates.entries()) {
    if (index > 0 && env.tournamentScrapeRequestDelayMs > 0) {
      await sleep(env.tournamentScrapeRequestDelayMs);
    }

    const fallback = discoveryToTournament(discovery);

    try {
      const details = await scraper.scrapeTournamentDetails(discovery.sourceUrl);
      const normalized = mergeDiscoveryAndDetails(fallback, details);
      const upsert = await tournamentRepository.upsertTournament(normalized);

      if (upsert.action === 'created') result.created += 1;
      else result.updated += 1;
    } catch (error) {
      result.errors.push(
        error instanceof Error
          ? `${discovery.title}: ${error.message}`
          : `${discovery.title}: unknown scraping error`,
      );

      try {
        const upsert = await tournamentRepository.upsertTournament(fallback);
        if (upsert.action === 'created') result.created += 1;
        else result.updated += 1;
      } catch (upsertError) {
        result.skipped += 1;
        result.errors.push(
          upsertError instanceof Error ? upsertError.message : 'Tournament fallback upsert failed',
        );
      }
    }
  }

  return result;
};

export const searchWithCache = async (
  query: Record<string, unknown>,
  forceRefreshOverride?: boolean,
): Promise<TournamentSearchResponse> => {
  const filters = parseTournamentSearchFilters(query, forceRefreshOverride);
  const usedCache = !filters.forceRefresh && (await tournamentRepository.hasFreshCache(filters));
  let refreshed = false;

  if (!usedCache) {
    await refreshSearch(filters);
    refreshed = true;
  }

  const result = await tournamentRepository.findTournaments(filters);
  const lastRefreshAt = await tournamentRepository.getLatestRefreshAt(filters);

  return {
    success: true,
    data: {
      items: result.items,
      pagination: {
        page: result.page,
        limit: result.limit,
        total: result.total,
        totalPages: result.totalPages,
      },
      cache: {
        usedCache,
        refreshed,
        lastRefreshAt: lastRefreshAt ? lastRefreshAt.toISOString() : null,
      },
    },
  };
};

export const listTournaments = async (query: Record<string, unknown>) => {
  return searchWithCache(query);
};

export const getTournament = async (id: string, refresh = false): Promise<TournamentDocument> => {
  const tournament = await tournamentRepository.getTournamentById(id);

  if (!refresh || !tournament.sourceUrl || tournament.source !== 'chess-results') {
    return tournament;
  }

  const scraper = new ChessResultsScraper();
  const fallback: TournamentNormalizedInput = {
    source: tournament.source,
    sourceTournamentId: tournament.sourceTournamentId,
    sourceUrl: tournament.sourceUrl,
    title: tournament.title,
    normalizedTitle: tournament.normalizedTitle,
    description: tournament.description ?? null,
    status: tournament.status,
    timeControl: tournament.timeControl,
    startDate: tournament.startDate ?? null,
    endDate: tournament.endDate ?? null,
    dateText: tournament.dateText ?? null,
    dateConfidence: tournament.dateConfidence,
    location: tournament.location,
    organizer: tournament.organizer ?? null,
    arbiter: tournament.arbiter ?? null,
    federation: tournament.federation ?? null,
    playersCount: tournament.playersCount ?? null,
    rounds: tournament.rounds ?? null,
    system: tournament.system,
    category: tournament.category ?? null,
    ratingType: tournament.ratingType,
    links: tournament.links,
    metadata: tournament.metadata,
    parseWarnings: tournament.parseWarnings,
    detailsScraped: tournament.detailsScraped,
    lastScrapedAt: tournament.lastScrapedAt ?? null,
    sourceLastUpdatedAt: tournament.sourceLastUpdatedAt ?? null,
  };
  const details = await scraper.scrapeTournamentDetails(tournament.sourceUrl);
  const normalized = mergeDiscoveryAndDetails(fallback, details);
  const upsert = await tournamentRepository.upsertTournament(normalized);

  return upsert.tournament;
};

export const getTournamentFilters = async () => {
  return tournamentRepository.getAvailableFilters();
};

export const forceRefresh = async (body: Record<string, unknown>) => {
  return searchWithCache(body, true);
};

export const syncTournamentsFromSources = async (): Promise<TournamentSyncMetrics> => {
  if (!env.tournamentGlobalCronEnabled) {
    throw new AppError(
      'Global tournament sync is disabled. Use /tournaments/search or /tournaments/refresh with filters.',
      410,
    );
  }

  const response = await searchWithCache({ forceRefresh: true, limit: env.tournamentScrapeMaxDetailsPerSearch }, true);

  return {
    cbxFound: 0,
    chessResultsFound: response.data.items.length,
    totalNormalized: response.data.items.length,
    created: 0,
    updated: response.data.items.length,
    skipped: 0,
    errors: [],
    enrichment: {
      enabled: true,
      attempted: response.data.items.length,
      success: response.data.items.length,
      failed: 0,
      skipped: 0,
      withDateAfterEnrichment: response.data.items.filter((item) => item.startDate).length,
      errors: [],
    },
    dateExtraction: {
      beforeEnrichment: { withStartDate: 0, missingDate: 0 },
      afterEnrichment: { withStartDate: 0, missingDate: 0 },
      withStartDate: response.data.items.filter((item) => item.startDate).length,
      withEndDate: response.data.items.filter((item) => item.endDate).length,
      missingDate: response.data.items.filter((item) => !item.startDate).length,
      highConfidence: response.data.items.filter((item) => item.dateConfidence === 'high').length,
      mediumConfidence: response.data.items.filter((item) => item.dateConfidence === 'medium').length,
      lowConfidence: response.data.items.filter((item) => item.dateConfidence === 'low').length,
      bySource: {
        'chess-results': {
          total: response.data.items.length,
          withStartDate: response.data.items.filter((item) => item.startDate).length,
          missingDate: response.data.items.filter((item) => !item.startDate).length,
        },
        cbx: { total: 0, withStartDate: 0, missingDate: 0 },
        manual: { total: 0, withStartDate: 0, missingDate: 0 },
        unknown: { total: 0, withStartDate: 0, missingDate: 0 },
        CHESS_RESULTS: { total: 0, withStartDate: 0, missingDate: 0 },
        CBX: { total: 0, withStartDate: 0, missingDate: 0 },
      },
    },
  };
};

export const debugExtractDate = (text: string) => {
  if (env.nodeEnv === 'production') {
    throw new AppError('Debug endpoint is not available in production', 404);
  }

  return parseTournamentDate({
    title: text,
    rawDateText: text,
    pageText: text,
  });
};
