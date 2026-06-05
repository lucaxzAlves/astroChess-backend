export type TournamentSource = 'chess-results' | 'cbx' | 'manual' | 'unknown' | 'CHESS_RESULTS' | 'CBX';
export type CanonicalTournamentSource = 'chess-results' | 'cbx' | 'manual' | 'unknown';
export type TournamentStatus =
  | 'not_started'
  | 'playing'
  | 'finished'
  | 'unknown'
  | 'upcoming'
  | 'ongoing';
export type CanonicalTournamentStatus = 'not_started' | 'playing' | 'finished' | 'unknown';
export type TournamentTimeControl =
  | 'classical'
  | 'rapid'
  | 'blitz'
  | 'bullet'
  | 'mixed'
  | 'unknown';
export type DateConfidence = 'high' | 'medium' | 'low' | 'unknown';
export type TournamentSystem = 'swiss' | 'round_robin' | 'knockout' | 'unknown';
export type RatingType = 'fide' | 'national' | 'unrated' | 'unknown';

export type TournamentLocation = {
  city?: string | null;
  state?: string | null;
  country?: string | null;
  venue?: string | null;
  raw?: string | null;
};

export type TournamentLinks = {
  chessResults?: string | null;
  cbx?: string | null;
  official?: string | null;
};

export type TournamentSearchFilters = {
  state?: string;
  city?: string;
  timeControl?: TournamentTimeControl;
  from?: Date;
  to?: Date;
  status?: CanonicalTournamentStatus;
  search?: string;
  source?: CanonicalTournamentSource;
  forceRefresh?: boolean;
  page: number;
  limit: number;
};

export type TournamentListFilters = TournamentSearchFilters & {
  startDateFrom?: Date;
  startDateTo?: Date;
  upcomingOnly?: boolean;
};

export type TournamentNormalizedInput = {
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
  location: TournamentLocation;
  organizer?: string | null;
  arbiter?: string | null;
  federation?: string | null;
  playersCount?: number | null;
  rounds?: number | null;
  system: TournamentSystem;
  category?: string | null;
  ratingType: RatingType;
  links: TournamentLinks;
  metadata?: Record<string, unknown>;
  parseWarnings: string[];
  detailsScraped: boolean;
  lastScrapedAt?: Date | null;
  sourceLastUpdatedAt?: Date | null;
  cacheExpiresAt?: Date | null;

  // Legacy compatibility while old importers/enrichers are still present.
  slug?: string;
  sourceId?: string;
  rawDateText?: string;
  city?: string;
  state?: string;
  country?: 'BR';
  locationRaw?: string;
  timeControlRaw?: string;
  enrichment?: {
    lastEnrichedAt?: Date;
    status?: 'success' | 'failed' | 'skipped';
    error?: string;
  };
  tags?: string[];
  normalizedText?: string;
  raw?: {
    title?: string;
    htmlSnippet?: string;
    data?: unknown;
  };
};

export type TournamentListItem = {
  id: string;
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
  location: TournamentLocation;
  organizer?: string | null;
  arbiter?: string | null;
  federation?: string | null;
  playersCount?: number | null;
  rounds?: number | null;
  system: TournamentSystem;
  category?: string | null;
  ratingType: RatingType;
  links: TournamentLinks;
  parseWarnings: string[];
  detailsScraped: boolean;
  lastScrapedAt?: Date | null;
  sourceLastUpdatedAt?: Date | null;
  cacheExpiresAt?: Date | null;
};

export type TournamentSearchResponse = {
  success: true;
  data: {
    items: TournamentListItem[];
    pagination: {
      page: number;
      limit: number;
      total: number;
      totalPages: number;
    };
    cache: {
      usedCache: boolean;
      refreshed: boolean;
      lastRefreshAt: string | null;
    };
  };
};

export type DiscoveredTournament = {
  title: string;
  sourceUrl: string;
  sourceTournamentId?: string | null;
  statusRaw?: string | null;
  timeControlRaw?: string | null;
  lastUpdatedRaw?: string | null;
  surroundingText?: string | null;
};

export type TournamentDetails = Partial<TournamentNormalizedInput> & {
  title: string;
  sourceUrl: string;
  sourceTournamentId?: string | null;
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
