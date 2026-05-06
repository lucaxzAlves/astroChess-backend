export type TournamentSource = 'CBX' | 'CHESS_RESULTS';
export type TournamentStatus = 'upcoming' | 'ongoing' | 'finished' | 'unknown';
export type TournamentTimeControl = 'classical' | 'rapid' | 'blitz' | 'mixed' | 'unknown';

export type TournamentNormalizedInput = {
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
  country: 'BR';
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
};

export type TournamentListFilters = {
  search?: string;
  city?: string;
  state?: string;
  timeControl?: TournamentTimeControl;
  source?: TournamentSource;
  status?: TournamentStatus;
  startDateFrom?: Date;
  startDateTo?: Date;
  upcomingOnly?: boolean;
  page: number;
  limit: number;
};

export type TournamentSyncMetrics = {
  cbxFound: number;
  chessResultsFound: number;
  totalNormalized: number;
  created: number;
  updated: number;
  skipped: number;
  errors: string[];
  enrichment: {
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
  dateExtraction: {
    beforeEnrichment: {
      withStartDate: number;
      missingDate: number;
    };
    afterEnrichment: {
      withStartDate: number;
      missingDate: number;
    };
    withStartDate: number;
    withEndDate: number;
    missingDate: number;
    highConfidence: number;
    mediumConfidence: number;
    lowConfidence: number;
    bySource: Record<
      TournamentSource,
      {
        total: number;
        withStartDate: number;
        missingDate: number;
      }
    >;
  };
};

export type TournamentListItem = {
  id: string;
  title: string;
  source: TournamentSource;
  sourceUrl: string;
  startDate?: Date;
  endDate?: Date;
  city?: string;
  state?: string;
  timeControl: TournamentTimeControl;
  ratingType?: string;
  organizer?: string;
  status: TournamentStatus;
};
