import { Document, Model, Schema, model, models } from 'mongoose';

import { TournamentSource, TournamentStatus, TournamentTimeControl } from './tournament.types';

export type TournamentDocument = Document & {
  title: string;
  slug: string;
  source: TournamentSource;
  sourceUrl: string;
  sourceId?: string;
  startDate?: Date;
  endDate?: Date;
  rawDateText?: string;
  city?: string;
  state?: string;
  country: string;
  locationRaw?: string;
  timeControl: TournamentTimeControl;
  timeControlRaw?: string;
  status: TournamentStatus;
  organizer?: string;
  ratingType?: string;
  enrichment?: {
    lastEnrichedAt?: Date;
    status?: 'success' | 'failed' | 'skipped';
    error?: string;
  };
  tags: string[];
  normalizedText: string;
  raw?: {
    title?: string;
    htmlSnippet?: string;
    data?: unknown;
  };
  firstSeenAt: Date;
  lastSeenAt: Date;
  lastSyncedAt: Date;
  isActive: boolean;
};

const tournamentSchema = new Schema<TournamentDocument>(
  {
    title: { type: String, required: true, trim: true },
    slug: { type: String, required: true, trim: true },
    source: { type: String, enum: ['CBX', 'CHESS_RESULTS'], required: true },
    sourceUrl: { type: String, required: true, trim: true },
    sourceId: { type: String, trim: true },
    startDate: { type: Date },
    endDate: { type: Date },
    rawDateText: { type: String, trim: true },
    city: { type: String, trim: true },
    state: { type: String, trim: true, uppercase: true },
    country: { type: String, default: 'BR' },
    locationRaw: { type: String, trim: true },
    timeControl: {
      type: String,
      enum: ['classical', 'rapid', 'blitz', 'mixed', 'unknown'],
      default: 'unknown',
    },
    timeControlRaw: { type: String, trim: true },
    status: {
      type: String,
      enum: ['upcoming', 'ongoing', 'finished', 'unknown'],
      default: 'unknown',
    },
    organizer: { type: String, trim: true },
    ratingType: { type: String, trim: true },
    enrichment: {
      lastEnrichedAt: { type: Date },
      status: { type: String, enum: ['success', 'failed', 'skipped'] },
      error: { type: String },
    },
    tags: { type: [String], default: [] },
    normalizedText: { type: String, required: true, index: true },
    raw: {
      title: { type: String },
      htmlSnippet: { type: String },
      data: { type: Schema.Types.Mixed },
    },
    firstSeenAt: { type: Date, required: true },
    lastSeenAt: { type: Date, required: true },
    lastSyncedAt: { type: Date, required: true },
    isActive: { type: Boolean, default: true },
  },
  {
    timestamps: true,
  },
);

tournamentSchema.index(
  { source: 1, sourceId: 1 },
  {
    unique: true,
    partialFilterExpression: { sourceId: { $type: 'string' } },
  },
);
tournamentSchema.index({ source: 1, sourceUrl: 1 }, { unique: true });
tournamentSchema.index({ slug: 1 });
tournamentSchema.index({ startDate: 1 });
tournamentSchema.index({ state: 1 });
tournamentSchema.index({ city: 1 });
tournamentSchema.index({ timeControl: 1 });
tournamentSchema.index({ status: 1 });

export const Tournament: Model<TournamentDocument> =
  models.Tournament ?? model<TournamentDocument>('Tournament', tournamentSchema);
