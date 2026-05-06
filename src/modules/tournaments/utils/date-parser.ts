import { TournamentSource } from '../tournament.types';

export type DateExtractionConfidence = 'high' | 'medium' | 'low' | 'none';

export type DateExtractionInput = {
  title?: string;
  rawDateText?: string;
  locationRaw?: string;
  description?: string;
  htmlSnippet?: string;
  source?: TournamentSource;
  referenceDate?: Date;
};

export type DateExtractionResult = {
  startDate?: Date;
  endDate?: Date;
  rawDateText?: string;
  confidence: DateExtractionConfidence;
  matchedPattern?: string;
};

type DateMatch = {
  startDate: Date;
  endDate?: Date;
  rawDateText: string;
  matchedPattern: string;
  inferredYear: boolean;
};

const MONTHS: Record<string, number> = {
  janeiro: 0,
  jan: 0,
  fevereiro: 1,
  fev: 1,
  marco: 2,
  março: 2,
  mar: 2,
  abril: 3,
  abr: 3,
  maio: 4,
  mai: 4,
  junho: 5,
  jun: 5,
  julho: 6,
  jul: 6,
  agosto: 7,
  ago: 7,
  setembro: 8,
  set: 8,
  outubro: 9,
  out: 9,
  novembro: 10,
  nov: 10,
  dezembro: 11,
  dez: 11,
  january: 0,
  jan_en: 0,
  february: 1,
  feb: 1,
  march: 2,
  apr: 3,
  april: 3,
  may: 4,
  june: 5,
  jun_en: 5,
  july: 6,
  jul_en: 6,
  aug: 7,
  august: 7,
  sep: 8,
  sept: 8,
  september: 8,
  oct: 9,
  october: 9,
  nov_en: 10,
  november: 10,
  dec: 11,
  december: 11,
};

const MONTH_PATTERN =
  'janeiro|jan|fevereiro|fev|março|marco|mar|abril|abr|maio|mai|junho|jun|julho|jul|agosto|ago|setembro|set|outubro|out|novembro|nov|dezembro|dez|january|february|feb|march|april|apr|may|june|july|august|aug|september|sept|sep|october|oct|november|december|dec';

const normalize = (value: string): string => {
  return value
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase();
};

const cleanText = (value: string): string => {
  return value.replace(/\s+/g, ' ').trim();
};

const getMonthIndex = (monthText: string): number | undefined => {
  const key = normalize(monthText);

  if (key === 'jun') {
    return 5;
  }

  if (key === 'jul') {
    return 6;
  }

  if (key === 'nov') {
    return 10;
  }

  return MONTHS[key];
};

const toDate = (day: number, month: number | undefined, year: number): Date | undefined => {
  if (!day || month === undefined || !year) {
    return undefined;
  }

  const date = new Date(Date.UTC(year, month, day, 12, 0, 0));

  if (date.getUTCDate() !== day || date.getUTCMonth() !== month || date.getUTCFullYear() !== year) {
    return undefined;
  }

  return date;
};

const inferYear = (day: number, month: number, referenceDate: Date): number => {
  const currentYear = referenceDate.getFullYear();
  const candidate = toDate(day, month, currentYear);

  if (!candidate) {
    return currentYear;
  }

  const daysSinceCandidate =
    (referenceDate.getTime() - candidate.getTime()) / (1000 * 60 * 60 * 24);

  return daysSinceCandidate > 45 ? currentYear + 1 : currentYear;
};

const cleanYear = (year: number): number => {
  if (year < 1000) {
    return year + 2000;
  }

  return year;
};

const pickValidRange = (
  startDate: Date | undefined,
  endDate: Date | undefined,
): { startDate?: Date; endDate?: Date } => {
  if (!startDate) {
    return {};
  }

  if (!endDate || endDate < startDate) {
    return { startDate };
  }

  return { startDate, endDate };
};

const matchNumericFullRange = (text: string): DateMatch | undefined => {
  const regex =
    /(\d{1,2})[/\-.](\d{1,2})[/\-.](\d{2,4})\s*(?:a|ate|até|à|-|–)\s*(\d{1,2})[/\-.](\d{1,2})[/\-.](\d{2,4})/i;
  const match = text.match(regex);

  if (!match) {
    return undefined;
  }

  const startDate = toDate(Number(match[1]), Number(match[2]) - 1, cleanYear(Number(match[3])));
  const endDate = toDate(Number(match[4]), Number(match[5]) - 1, cleanYear(Number(match[6])));
  const range = pickValidRange(startDate, endDate);

  if (!range.startDate) {
    return undefined;
  }

  return {
    startDate: range.startDate,
    endDate: range.endDate,
    rawDateText: match[0],
    matchedPattern: 'numeric_full_range',
    inferredYear: false,
  };
};

const matchNumericCompactRange = (text: string, referenceDate: Date): DateMatch | undefined => {
  const regex = /(\d{1,2})\s*(?:a|ate|até|-|–)\s*(\d{1,2})[/\-.](\d{1,2})(?:[/\-.](\d{2,4}))?/i;
  const match = text.match(regex);

  if (!match) {
    return undefined;
  }

  const month = Number(match[3]) - 1;
  const year = match[4]
    ? cleanYear(Number(match[4]))
    : inferYear(Number(match[1]), month, referenceDate);
  const startDate = toDate(Number(match[1]), month, year);
  const endDate = toDate(Number(match[2]), month, year);
  const range = pickValidRange(startDate, endDate);

  if (!range.startDate) {
    return undefined;
  }

  return {
    startDate: range.startDate,
    endDate: range.endDate,
    rawDateText: match[0],
    matchedPattern: match[4] ? 'numeric_compact_range' : 'numeric_compact_range_inferred_year',
    inferredYear: !match[4],
  };
};

const matchNumericSingle = (text: string, referenceDate: Date): DateMatch | undefined => {
  const regex = /(\d{1,2})[/\-.](\d{1,2})(?:[/\-.](\d{2,4}))?/;
  const match = text.match(regex);

  if (!match) {
    return undefined;
  }

  const month = Number(match[2]) - 1;
  const year = match[3]
    ? cleanYear(Number(match[3]))
    : inferYear(Number(match[1]), month, referenceDate);
  const startDate = toDate(Number(match[1]), month, year);

  if (!startDate) {
    return undefined;
  }

  return {
    startDate,
    endDate: startDate,
    rawDateText: match[0],
    matchedPattern: match[3] ? 'numeric_single' : 'numeric_single_inferred_year',
    inferredYear: !match[3],
  };
};

const matchPortugueseMonthRange = (text: string, referenceDate: Date): DateMatch | undefined => {
  const regex = new RegExp(
    `(\\d{1,2})\\s*(?:a|ate|até|-|–)\\s*(\\d{1,2})\\s*(?:de\\s*)?(${MONTH_PATTERN})(?:\\s*de)?\\s*(\\d{4})?`,
    'i',
  );
  const match = text.match(regex);

  if (!match) {
    return undefined;
  }

  const month = getMonthIndex(match[3]);
  const year = match[4] ? Number(match[4]) : inferYear(Number(match[1]), month ?? 0, referenceDate);
  const startDate = toDate(Number(match[1]), month, year);
  const endDate = toDate(Number(match[2]), month, year);
  const range = pickValidRange(startDate, endDate);

  if (!range.startDate) {
    return undefined;
  }

  return {
    startDate: range.startDate,
    endDate: range.endDate,
    rawDateText: match[0],
    matchedPattern: match[4] ? 'month_name_range' : 'month_name_range_inferred_year',
    inferredYear: !match[4],
  };
};

const matchPortugueseMonthSingle = (text: string, referenceDate: Date): DateMatch | undefined => {
  const regex = new RegExp(
    `(\\d{1,2})\\s*(?:de\\s*)?(${MONTH_PATTERN})(?:\\s*de)?\\s*(\\d{4})?`,
    'i',
  );
  const match = text.match(regex);

  if (!match) {
    return undefined;
  }

  const month = getMonthIndex(match[2]);
  const year = match[3] ? Number(match[3]) : inferYear(Number(match[1]), month ?? 0, referenceDate);
  const startDate = toDate(Number(match[1]), month, year);

  if (!startDate) {
    return undefined;
  }

  return {
    startDate,
    endDate: startDate,
    rawDateText: match[0],
    matchedPattern: match[3] ? 'month_name_single' : 'month_name_single_inferred_year',
    inferredYear: !match[3],
  };
};

const matchEnglishMonthComma = (text: string): DateMatch | undefined => {
  const regex = new RegExp(`(${MONTH_PATTERN})\\s+(\\d{1,2}),\\s*(\\d{4})`, 'i');
  const match = text.match(regex);

  if (!match) {
    return undefined;
  }

  const startDate = toDate(Number(match[2]), getMonthIndex(match[1]), Number(match[3]));

  if (!startDate) {
    return undefined;
  }

  return {
    startDate,
    endDate: startDate,
    rawDateText: match[0],
    matchedPattern: 'english_month_comma',
    inferredYear: false,
  };
};

const matchEnglishMonthRange = (text: string): DateMatch | undefined => {
  const regex = new RegExp(
    `(\\d{1,2})\\s*(?:-|–|a|to)\\s*(\\d{1,2})\\s+(${MONTH_PATTERN})\\s+(\\d{4})`,
    'i',
  );
  const match = text.match(regex);

  if (!match) {
    return undefined;
  }

  const month = getMonthIndex(match[3]);
  const startDate = toDate(Number(match[1]), month, Number(match[4]));
  const endDate = toDate(Number(match[2]), month, Number(match[4]));
  const range = pickValidRange(startDate, endDate);

  if (!range.startDate) {
    return undefined;
  }

  return {
    startDate: range.startDate,
    endDate: range.endDate,
    rawDateText: match[0],
    matchedPattern: 'english_month_range',
    inferredYear: false,
  };
};

const matchers = [
  matchNumericFullRange,
  matchNumericCompactRange,
  matchPortugueseMonthRange,
  matchEnglishMonthRange,
  matchEnglishMonthComma,
  matchNumericSingle,
  matchPortugueseMonthSingle,
];

const getConfidence = (
  field: keyof DateExtractionInput,
  match: DateMatch,
): DateExtractionConfidence => {
  if (match.inferredYear) {
    return 'low';
  }

  if (field === 'rawDateText' || field === 'title') {
    return 'high';
  }

  return 'medium';
};

export const extractTournamentDates = (input: DateExtractionInput): DateExtractionResult => {
  const referenceDate = input.referenceDate ?? new Date();
  const fields: (keyof DateExtractionInput)[] = [
    'rawDateText',
    'title',
    'description',
    'locationRaw',
    'htmlSnippet',
  ];

  for (const field of fields) {
    const value = input[field];

    if (typeof value !== 'string' || !value.trim()) {
      continue;
    }

    const text = cleanText(value);

    for (const matcher of matchers) {
      const match = matcher(text, referenceDate);

      if (!match) {
        continue;
      }

      return {
        startDate: match.startDate,
        endDate: match.endDate,
        rawDateText: match.rawDateText,
        confidence: getConfidence(field, match),
        matchedPattern: match.matchedPattern,
      };
    }
  }

  return {
    rawDateText: input.rawDateText,
    confidence: 'none',
  };
};

export const parseTournamentDateRange = (
  rawDateText?: string,
): { startDate?: Date; endDate?: Date; rawDateText?: string } => {
  const result = extractTournamentDates({ rawDateText });

  return {
    startDate: result.startDate,
    endDate: result.endDate,
    rawDateText: result.rawDateText,
  };
};
