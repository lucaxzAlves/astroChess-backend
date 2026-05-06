import { ImportedTournament } from './importers/importer.types';
import { TournamentNormalizedInput, TournamentStatus } from './tournament.types';
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
): TournamentStatus => {
  if (status) {
    return status;
  }

  const now = new Date();

  if (startDate && startDate > now) {
    return 'upcoming';
  }

  if (startDate && endDate && startDate <= now && endDate >= now) {
    return 'ongoing';
  }

  if (endDate && endDate < now) {
    return 'finished';
  }

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
    source: importedTournament.source,
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
    slug: createSlug(title),
    source: importedTournament.source,
    sourceUrl: importedTournament.sourceUrl,
    sourceId: importedTournament.sourceId,
    startDate: dates.startDate,
    endDate: dates.endDate,
    rawDateText: dates.rawDateText ?? importedTournament.rawDateText,
    city: location.city,
    state: location.state,
    country: 'BR',
    locationRaw: importedTournament.locationRaw ?? location.locationRaw,
    timeControl,
    timeControlRaw: importedTournament.timeControlRaw,
    status: inferStatus(importedTournament.status, dates.startDate, dates.endDate),
    organizer: importedTournament.organizer,
    ratingType: importedTournament.ratingType,
    enrichment: importedTournament.enrichment,
    tags: [...tags],
    normalizedText: normalizeText(searchableFields.join(' ')),
    raw: importedTournament.raw,
  };
};
