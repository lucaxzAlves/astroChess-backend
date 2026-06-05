import { ImportedTournament } from './importers/importer.types';
import {
  CanonicalTournamentSource,
  CanonicalTournamentStatus,
  RatingType,
  TournamentNormalizedInput,
  TournamentStatus,
} from './tournament.types';
import { extractTournamentDates } from './utils/date-parser';
import { parseBrazilianLocation } from './utils/location-parser';
import { parseTimeControl } from './utils/time-control-parser';

const normalizeSpaces = (value: string): string => {
  return value.replace(/\s+/g, ' ').trim();
};

const stripAccents = (value: string): string => {
  return value.normalize('NFD').replace(/\p{Diacritic}/gu, '');
};

export const normalizeText = (value: string): string => {
  return stripAccents(value).toLowerCase().replace(/\s+/g, ' ').trim();
};

const createSlug = (title: string): string => {
  return normalizeText(title)
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 120);
};

const inferStatus = (
  status: TournamentStatus | undefined,
  startDate?: Date,
  endDate?: Date,
): CanonicalTournamentStatus => {
  if (status) {
    if (status === 'upcoming') return 'not_started';
    if (status === 'ongoing') return 'playing';
    if (status === 'not_started' || status === 'playing' || status === 'finished') {
      return status;
    }
  }

  const now = new Date();

  if (startDate && startDate > now) {
    return 'not_started';
  }

  if (startDate && endDate && startDate <= now && endDate >= now) {
    return 'playing';
  }

  if (endDate && endDate < now) {
    return 'finished';
  }

  return 'unknown';
};

const normalizeLegacySource = (source: ImportedTournament['source']): CanonicalTournamentSource => {
  if (source === 'CHESS_RESULTS') return 'chess-results';
  if (source === 'CBX') return 'cbx';

  return 'unknown';
};

const normalizeLegacyRatingType = (value?: string): RatingType => {
  const normalized = normalizeText(value ?? '');

  if (normalized.includes('fide')) return 'fide';
  if (normalized.includes('cbx') || normalized.includes('nacional')) return 'national';
  if (normalized.includes('unrated')) return 'unrated';

  return 'unknown';
};

export const normalizeTournament = (
  importedTournament: ImportedTournament,
): TournamentNormalizedInput | null => {
  const title = normalizeSpaces(importedTournament.title);

  if (!title || !importedTournament.sourceUrl) {
    return null;
  }

  const location = parseBrazilianLocation(importedTournament.locationRaw ?? title);
  const dates = extractTournamentDates({
    title,
    rawDateText: importedTournament.rawDateText,
    locationRaw: importedTournament.locationRaw,
    description: importedTournament.description,
    htmlSnippet: importedTournament.htmlSnippet ?? importedTournament.raw?.htmlSnippet,
    source: normalizeLegacySource(importedTournament.source),
  });
  const timeControl = parseTimeControl(importedTournament.timeControlRaw ?? title);
  const tags = new Set<string>();

  if (!location.state && importedTournament.locationRaw) {
    tags.add('location_unparsed');
  }

  if (dates.confidence === 'none') {
    tags.add('missing_date');
  } else {
    tags.add(`date_confidence_${dates.confidence}`);
  }

  const searchableFields = [
    title,
    location.city,
    location.state,
    importedTournament.locationRaw,
    importedTournament.description,
    importedTournament.timeControlRaw,
    importedTournament.organizer,
    importedTournament.ratingType,
    importedTournament.source,
  ].filter(Boolean);

  return {
    title,
    normalizedTitle: normalizeText(title),
    slug: createSlug(title),
    source: normalizeLegacySource(importedTournament.source),
    sourceTournamentId: importedTournament.sourceId,
    sourceUrl: importedTournament.sourceUrl,
    sourceId: importedTournament.sourceId,
    startDate: dates.startDate,
    endDate: dates.endDate,
    dateText: dates.rawDateText ?? importedTournament.rawDateText,
    dateConfidence: dates.confidence === 'none' ? 'unknown' : dates.confidence,
    rawDateText: dates.rawDateText ?? importedTournament.rawDateText,
    city: location.city,
    state: location.state,
    country: 'BR',
    location: {
      city: location.city,
      state: location.state,
      country: 'BR',
      raw: importedTournament.locationRaw ?? location.locationRaw,
    },
    locationRaw: importedTournament.locationRaw ?? location.locationRaw,
    timeControl,
    timeControlRaw: importedTournament.timeControlRaw,
    status: inferStatus(importedTournament.status, dates.startDate, dates.endDate),
    organizer: importedTournament.organizer,
    ratingType: normalizeLegacyRatingType(importedTournament.ratingType),
    arbiter: null,
    federation: null,
    playersCount: null,
    rounds: null,
    system: 'unknown',
    category: null,
    links: {
      chessResults:
        importedTournament.source === 'CHESS_RESULTS' ? importedTournament.sourceUrl : null,
      cbx: importedTournament.source === 'CBX' ? importedTournament.sourceUrl : null,
    },
    metadata: importedTournament.raw?.data as Record<string, unknown> | undefined,
    parseWarnings: dates.confidence === 'none' ? ['No reliable tournament date found.'] : [],
    detailsScraped: Boolean(importedTournament.enrichment?.status === 'success'),
    lastScrapedAt: importedTournament.enrichment?.lastEnrichedAt,
    sourceLastUpdatedAt: null,
    cacheExpiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
    enrichment: importedTournament.enrichment,
    tags: [...tags],
    normalizedText: normalizeText(searchableFields.join(' ')),
    raw: importedTournament.raw,
  };
};
