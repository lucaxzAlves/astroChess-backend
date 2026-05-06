import { TournamentSource } from '../tournament.types';

export interface TournamentEnrichmentInput {
  source: TournamentSource;
  sourceUrl: string;
  sourceId?: string;
  title?: string;
}

export interface TournamentEnrichmentResult {
  source: TournamentSource;
  sourceUrl: string;
  sourceId?: string;
  title?: string;
  rawDateText?: string;
  locationRaw?: string;
  city?: string;
  state?: string;
  timeControlRaw?: string;
  organizer?: string;
  ratingType?: string;
  statusRaw?: string;
  description?: string;
  htmlSnippet?: string;
  usefulLinks?: {
    chessResultsUrl?: string;
    regulationUrl?: string;
    officialUrl?: string;
  };
  enrichmentStatus: 'success' | 'failed' | 'skipped';
  enrichmentError?: string;
}

export type EnrichmentBatchResult = {
  enabled: boolean;
  attempted: number;
  success: number;
  failed: number;
  skipped: number;
  withDateAfterEnrichment: number;
  errors: {
    source: TournamentSource;
    sourceUrl: string;
    message: string;
  }[];
};
