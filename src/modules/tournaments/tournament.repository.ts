import { Types } from 'mongoose';

import { AppError } from '../../utils/AppError';
import { Tournament, TournamentDocument } from './tournament.model';
import {
  TournamentListFilters,
  TournamentListItem,
  TournamentNormalizedInput,
  TournamentStatus,
  TournamentTimeControl,
  TournamentSource,
} from './tournament.types';

type UpsertResult = {
  action: 'created' | 'updated';
  tournament: TournamentDocument;
};

type TournamentMongoQuery = {
  isActive?: boolean;
  normalizedText?: { $regex: string; $options: string };
  city?: { $regex: string; $options: string };
  state?: string;
  timeControl?: TournamentTimeControl;
  source?: TournamentSource;
  status?: TournamentStatus;
  startDate?: { $gte?: Date; $lte?: Date };
};

const toListItem = (tournament: TournamentDocument): TournamentListItem => {
  return {
    id: tournament._id.toString(),
    title: tournament.title,
    source: tournament.source,
    sourceUrl: tournament.sourceUrl,
    startDate: tournament.startDate,
    endDate: tournament.endDate,
    city: tournament.city,
    state: tournament.state,
    timeControl: tournament.timeControl,
    ratingType: tournament.ratingType,
    organizer: tournament.organizer,
    status: tournament.status,
  };
};

const buildTournamentQuery = (filters: TournamentListFilters): TournamentMongoQuery => {
  const query: TournamentMongoQuery = {
    isActive: true,
  };

  if (filters.search) {
    query.normalizedText = { $regex: filters.search, $options: 'i' };
  }

  if (filters.city) {
    query.city = { $regex: `^${filters.city}$`, $options: 'i' };
  }

  if (filters.state) {
    query.state = filters.state;
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

  if (filters.startDateFrom || filters.startDateTo) {
    query.startDate = {};

    if (filters.startDateFrom) {
      query.startDate.$gte = filters.startDateFrom;
    }

    if (filters.startDateTo) {
      query.startDate.$lte = filters.startDateTo;
    }
  }

  if (filters.upcomingOnly) {
    query.startDate = {
      ...(query.startDate ?? {}),
      $gte: new Date(),
    };
  }

  return query;
};

export const upsertTournament = async (
  tournament: TournamentNormalizedInput,
): Promise<UpsertResult> => {
  const now = new Date();
  const filter = tournament.sourceId
    ? { source: tournament.source, sourceId: tournament.sourceId }
    : { source: tournament.source, sourceUrl: tournament.sourceUrl };
  const existingTournament = await Tournament.findOne(filter);

  if (!existingTournament) {
    const createdTournament = await Tournament.create({
      ...tournament,
      firstSeenAt: now,
      lastSeenAt: now,
      lastSyncedAt: now,
      isActive: true,
    });

    return {
      action: 'created',
      tournament: createdTournament,
    };
  }

  existingTournament.set({
    ...tournament,
    firstSeenAt: existingTournament.firstSeenAt,
    lastSeenAt: now,
    lastSyncedAt: now,
    isActive: true,
  });

  await existingTournament.save();

  return {
    action: 'updated',
    tournament: existingTournament,
  };
};

export const findTournaments = async (
  filters: TournamentListFilters,
): Promise<{ page: number; limit: number; total: number; items: TournamentListItem[] }> => {
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
    items: tournaments.map(toListItem),
  };
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
  sources: TournamentSource[];
  statuses: TournamentStatus[];
}> => {
  const [states, cities, timeControls, sources, statuses] = await Promise.all([
    Tournament.distinct('state', { isActive: true, state: { $exists: true, $ne: '' } }),
    Tournament.distinct('city', { isActive: true, city: { $exists: true, $ne: '' } }),
    Tournament.distinct('timeControl', { isActive: true }),
    Tournament.distinct('source', { isActive: true }),
    Tournament.distinct('status', { isActive: true }),
  ]);

  return {
    states: states.sort(),
    cities: cities.sort(),
    timeControls: timeControls.sort() as TournamentTimeControl[],
    sources: sources.sort() as TournamentSource[],
    statuses: statuses.sort() as TournamentStatus[],
  };
};
