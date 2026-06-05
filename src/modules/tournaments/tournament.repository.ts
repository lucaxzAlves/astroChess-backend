import { Types } from 'mongoose';

import { AppError } from '../../utils/AppError';
import { Tournament, TournamentDocument } from './tournament.model';
import {
  CanonicalTournamentSource,
  TournamentListItem,
  TournamentNormalizedInput,
  TournamentSearchFilters,
  TournamentTimeControl,
  CanonicalTournamentStatus,
} from './tournament.types';

type UpsertResult = {
  action: 'created' | 'updated';
  tournament: TournamentDocument;
};

const escapeRegex = (value: string): string => {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
};

const toListItem = (tournament: TournamentDocument): TournamentListItem => {
  return {
    id: tournament._id.toString(),
    source: tournament.source,
    sourceTournamentId: tournament.sourceTournamentId ?? null,
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
    location: {
      city: tournament.location?.city ?? null,
      state: tournament.location?.state ?? null,
      country: tournament.location?.country ?? 'BR',
      venue: tournament.location?.venue ?? null,
      raw: tournament.location?.raw ?? null,
    },
    organizer: tournament.organizer ?? null,
    arbiter: tournament.arbiter ?? null,
    federation: tournament.federation ?? null,
    playersCount: tournament.playersCount ?? null,
    rounds: tournament.rounds ?? null,
    system: tournament.system,
    category: tournament.category ?? null,
    ratingType: tournament.ratingType,
    links: {
      chessResults: tournament.links?.chessResults ?? null,
      cbx: tournament.links?.cbx ?? null,
      official: tournament.links?.official ?? null,
    },
    parseWarnings: tournament.parseWarnings ?? [],
    detailsScraped: tournament.detailsScraped,
    lastScrapedAt: tournament.lastScrapedAt ?? null,
    sourceLastUpdatedAt: tournament.sourceLastUpdatedAt ?? null,
    cacheExpiresAt: tournament.cacheExpiresAt ?? null,
  };
};

type TournamentMongoQuery = Record<string, unknown>;

const buildTournamentQuery = (filters: TournamentSearchFilters): TournamentMongoQuery => {
  const query: TournamentMongoQuery = {};

  if (filters.search) {
    query.normalizedTitle = { $regex: escapeRegex(filters.search), $options: 'i' };
  }

  if (filters.city) {
    query['location.city'] = { $regex: `^${escapeRegex(filters.city)}$`, $options: 'i' };
  }

  if (filters.state) {
    query['location.state'] = filters.state;
  }

  if (filters.timeControl) {
    query.timeControl = filters.timeControl;
  }

  if (filters.source) {
    query.source = filters.source;
  }

  if (filters.status) {
    query.status = filters.status;
  }

  if (filters.from || filters.to) {
    query.startDate = {};

    if (filters.from) {
      (query.startDate as Record<string, Date>).$gte = filters.from;
    }

    if (filters.to) {
      (query.startDate as Record<string, Date>).$lte = filters.to;
    }
  }

  return query;
};

export const upsertTournament = async (
  tournament: TournamentNormalizedInput,
): Promise<UpsertResult> => {
  const now = new Date();
  const filter = tournament.sourceTournamentId
    ? { source: tournament.source, sourceTournamentId: tournament.sourceTournamentId }
    : { source: tournament.source, sourceUrl: tournament.sourceUrl };
  const existingTournament = await Tournament.findOne(filter);
  const legacySearchText = [
    tournament.title,
    tournament.normalizedTitle,
    tournament.location.city,
    tournament.location.state,
    tournament.location.raw,
    tournament.timeControl,
    tournament.status,
  ]
    .filter(Boolean)
    .join(' ');
  const payload = {
    ...tournament,
    normalizedText: legacySearchText,
    city: tournament.location.city ?? undefined,
    state: tournament.location.state ?? undefined,
    country: tournament.location.country ?? 'BR',
    locationRaw: tournament.location.raw ?? undefined,
    rawDateText: tournament.dateText ?? undefined,
    sourceId: tournament.sourceTournamentId ?? undefined,
    slug: tournament.normalizedTitle.replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, ''),
    lastSeenAt: now,
    lastSyncedAt: now,
    isActive: true,
  };

  if (!existingTournament) {
    const createdTournament = await Tournament.create({
      ...payload,
      firstSeenAt: now,
    });

    return {
      action: 'created',
      tournament: createdTournament,
    };
  }

  existingTournament.set({
    ...payload,
    firstSeenAt: existingTournament.firstSeenAt ?? now,
  });

  await existingTournament.save();

  return {
    action: 'updated',
    tournament: existingTournament,
  };
};

export const findTournaments = async (
  filters: TournamentSearchFilters,
): Promise<{
  page: number;
  limit: number;
  total: number;
  totalPages: number;
  items: TournamentListItem[];
  documents: TournamentDocument[];
}> => {
  const query = buildTournamentQuery(filters);
  const skip = (filters.page - 1) * filters.limit;
  const [total, tournaments] = await Promise.all([
    Tournament.countDocuments(query),
    Tournament.find(query).sort({ startDate: 1, title: 1 }).skip(skip).limit(filters.limit),
  ]);

  return {
    page: filters.page,
    limit: filters.limit,
    total,
    totalPages: Math.max(1, Math.ceil(total / filters.limit)),
    items: tournaments.map(toListItem),
    documents: tournaments,
  };
};

export const hasFreshCache = async (filters: TournamentSearchFilters): Promise<boolean> => {
  const query = buildTournamentQuery(filters);
  const now = new Date();
  const total = await Tournament.countDocuments(query);

  if (total === 0) return false;

  const stale = await Tournament.countDocuments({
    ...query,
    $or: [{ cacheExpiresAt: { $exists: false } }, { cacheExpiresAt: null }, { cacheExpiresAt: { $lte: now } }],
  });

  return stale === 0;
};

export const getLatestRefreshAt = async (
  filters: TournamentSearchFilters,
): Promise<Date | null> => {
  const query = buildTournamentQuery(filters);
  const latest = await Tournament.findOne(query).sort({ lastScrapedAt: -1, updatedAt: -1 });

  return latest?.lastScrapedAt ?? ((latest as TournamentDocument & { updatedAt?: Date })?.updatedAt ?? null);
};

export const getTournamentById = async (id: string): Promise<TournamentDocument> => {
  if (!Types.ObjectId.isValid(id)) {
    throw new AppError('Tournament not found', 404);
  }

  const tournament = await Tournament.findById(id);

  if (!tournament) {
    throw new AppError('Tournament not found', 404);
  }

  return tournament;
};

export const getAvailableFilters = async (): Promise<{
  states: string[];
  cities: string[];
  timeControls: TournamentTimeControl[];
  sources: CanonicalTournamentSource[];
  statuses: CanonicalTournamentStatus[];
}> => {
  const [states, cities, timeControls, sources, statuses] = await Promise.all([
    Tournament.distinct('location.state', { 'location.state': { $exists: true, $ne: null } }),
    Tournament.distinct('location.city', { 'location.city': { $exists: true, $ne: null } }),
    Tournament.distinct('timeControl'),
    Tournament.distinct('source'),
    Tournament.distinct('status'),
  ]);

  return {
    states: states.filter((value): value is string => typeof value === 'string').sort(),
    cities: cities.filter((value): value is string => typeof value === 'string').sort(),
    timeControls: timeControls.filter(Boolean).sort() as TournamentTimeControl[],
    sources: sources.filter(Boolean).sort() as CanonicalTournamentSource[],
    statuses: statuses.filter(Boolean).sort() as CanonicalTournamentStatus[],
  };
};

export const toTournamentListItem = toListItem;
