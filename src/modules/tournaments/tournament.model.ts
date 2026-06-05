import { Document, Model, Schema, model, models } from 'mongoose';

import {
  CanonicalTournamentSource,
  CanonicalTournamentStatus,
  DateConfidence,
  RatingType,
  TournamentSystem,
  TournamentTimeControl,
} from './tournament.types';

export type TournamentDocument = Document & {
  source: CanonicalTournamentSource;
  sourceTournamentId?: string | null;
  sourceUrl: string;
  title: string;
  normalizedTitle: string;
  description?: string | null;
  status: CanonicalTournamentStatus;
  timeControl: TournamentTimeControl;
  startDate?: Date | null;
  endDate?: Date | null;
  dateText?: string | null;
  dateConfidence: DateConfidence;
  location: {
    city?: string | null;
    state?: string | null;
    country?: string | null;
    venue?: string | null;
    raw?: string | null;
  };
  organizer?: string | null;
  arbiter?: string | null;
  federation?: string | null;
  playersCount?: number | null;
  rounds?: number | null;
  system: TournamentSystem;
  category?: string | null;
  ratingType: RatingType;
  links: {
    chessResults?: string | null;
    cbx?: string | null;
    official?: string | null;
  };
  metadata?: Record<string, unknown>;
  parseWarnings: string[];
  detailsScraped: boolean;
  lastScrapedAt?: Date | null;
  sourceLastUpdatedAt?: Date | null;
  cacheExpiresAt?: Date | null;

  // Legacy fields kept optional so older saved documents do not explode while reading.
  slug?: string;
  sourceId?: string;
  rawDateText?: string;
  city?: string;
  state?: string;
  country?: string;
  locationRaw?: string;
  timeControlRaw?: string;
  tags?: string[];
  normalizedText?: string;
  firstSeenAt?: Date;
  lastSeenAt?: Date;
  lastSyncedAt?: Date;
  isActive?: boolean;
  raw?: {
    title?: string;
    htmlSnippet?: string;
    data?: unknown;
  };
};

const tournamentSchema = new Schema<TournamentDocument>(
  {
    source: {
      type: String,
      enum: ['chess-results', 'cbx', 'manual', 'unknown'],
      required: true,
      index: true,
    },
    sourceTournamentId: { type: String, trim: true },
    sourceUrl: { type: String, required: true, trim: true },
    title: { type: String, required: true, trim: true },
    normalizedTitle: { type: String, required: true, trim: true, index: true },
    description: { type: String, trim: true, default: null },
    status: {
      type: String,
      enum: ['not_started', 'playing', 'finished', 'unknown'],
      default: 'unknown',
      index: true,
    },
    timeControl: {
      type: String,
      enum: ['classical', 'rapid', 'blitz', 'bullet', 'mixed', 'unknown'],
      default: 'unknown',
      index: true,
    },
    startDate: { type: Date, default: null, index: true },
    endDate: { type: Date, default: null },
    dateText: { type: String, trim: true, default: null },
    dateConfidence: {
      type: String,
      enum: ['high', 'medium', 'low', 'unknown'],
      default: 'unknown',
    },
    location: {
      city: { type: String, trim: true, default: null, index: true },
      state: { type: String, trim: true, uppercase: true, default: null, index: true },
      country: { type: String, trim: true, default: 'BR' },
      venue: { type: String, trim: true, default: null },
      raw: { type: String, trim: true, default: null },
    },
    organizer: { type: String, trim: true, default: null },
    arbiter: { type: String, trim: true, default: null },
    federation: { type: String, trim: true, default: null },
    playersCount: { type: Number, default: null },
    rounds: { type: Number, default: null },
    system: {
      type: String,
      enum: ['swiss', 'round_robin', 'knockout', 'unknown'],
      default: 'unknown',
    },
    category: { type: String, trim: true, default: null },
    ratingType: {
      type: String,
      enum: ['fide', 'national', 'unrated', 'unknown'],
      default: 'unknown',
    },
    links: {
      chessResults: { type: String, trim: true, default: null },
      cbx: { type: String, trim: true, default: null },
      official: { type: String, trim: true, default: null },
    },
    metadata: { type: Schema.Types.Mixed },
    parseWarnings: { type: [String], default: [] },
    detailsScraped: { type: Boolean, default: false },
    lastScrapedAt: { type: Date, default: null, index: true },
    sourceLastUpdatedAt: { type: Date, default: null },
    cacheExpiresAt: { type: Date, default: null, index: true },

    // Legacy field definitions.
    slug: { type: String, trim: true },
    sourceId: { type: String, trim: true },
    rawDateText: { type: String, trim: true },
    city: { type: String, trim: true },
    state: { type: String, trim: true, uppercase: true },
    country: { type: String, default: 'BR' },
    locationRaw: { type: String, trim: true },
    timeControlRaw: { type: String, trim: true },
    tags: { type: [String], default: [] },
    normalizedText: { type: String, index: true },
    firstSeenAt: { type: Date },
    lastSeenAt: { type: Date },
    lastSyncedAt: { type: Date },
    isActive: { type: Boolean, default: true },
    raw: {
      title: { type: String },
      htmlSnippet: { type: String },
      data: { type: Schema.Types.Mixed },
    },
  },
  {
    timestamps: true,
  },
);

tournamentSchema.index(
  { source: 1, sourceTournamentId: 1 },
  {
    unique: true,
    partialFilterExpression: { sourceTournamentId: { $type: 'string' } },
  },
);
tournamentSchema.index({ source: 1, sourceUrl: 1 }, { unique: true });
tournamentSchema.index({ normalizedTitle: 1 });
tournamentSchema.index({ status: 1 });
tournamentSchema.index({ timeControl: 1 });
tournamentSchema.index({ startDate: 1 });
tournamentSchema.index({ 'location.state': 1 });
tournamentSchema.index({ 'location.city': 1 });
tournamentSchema.index({ lastScrapedAt: 1 });
tournamentSchema.index({ cacheExpiresAt: 1 });

export const Tournament: Model<TournamentDocument> =
  models.Tournament ?? model<TournamentDocument>('Tournament', tournamentSchema);
