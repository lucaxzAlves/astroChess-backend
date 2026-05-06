import { TournamentSource, TournamentStatus } from '../tournament.types';

export type ImportedTournament = {
  source: TournamentSource;
  sourceId?: string;
  title: string;
  sourceUrl: string;
  rawDateText?: string;
  locationRaw?: string;
  description?: string;
  htmlSnippet?: string;
  timeControlRaw?: string;
  statusRaw?: string;
  status?: TournamentStatus;
  organizer?: string;
  ratingType?: string;
  enrichment?: {
    lastEnrichedAt?: Date;
    status?: 'success' | 'failed' | 'skipped';
    error?: string;
  };
  raw?: {
    title?: string;
    htmlSnippet?: string;
    data?: unknown;
  };
};
