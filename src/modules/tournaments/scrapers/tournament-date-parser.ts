import { DateConfidence } from '../tournament.types';
import { stripAccents } from './tournament-normalizer';

type DateSource = {
  text?: string;
  confidence: Exclude<DateConfidence, 'unknown'>;
};

export type ParsedTournamentDate = {
  startDate: Date | null;
  endDate: Date | null;
  dateText: string | null;
  dateConfidence: DateConfidence;
  warnings: string[];
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
  may: 4,
  junho: 5,
  jun: 5,
  julho: 6,
  jul: 6,
  agosto: 7,
  ago: 7,
  setembro: 8,
  set: 8,
  october: 9,
  outubro: 9,
  out: 9,
  novembro: 10,
  nov: 10,
  dezembro: 11,
  dez: 11,
  january: 0,
  february: 1,
  feb: 1,
  march: 2,
  april: 3,
  june: 5,
  july: 6,
  august: 7,
  september: 8,
  sep: 8,
  sept: 8,
  oct: 9,
  november: 10,
  december: 11,
  dec: 11,
};

const MONTH_PATTERN = Object.keys(MONTHS).sort((a, b) => b.length - a.length).join('|');

const cleanYear = (year: number): number => (year < 100 ? year + 2000 : year);

const toDate = (day: number, month: number, year: number): Date | null => {
  const date = new Date(Date.UTC(year, month, day, 12, 0, 0));

  if (
    date.getUTCDate() !== day ||
    date.getUTCMonth() !== month ||
    date.getUTCFullYear() !== year
  ) {
    return null;
  }

  return date;
};

const getMonth = (value: string): number | null => {
  const key = stripAccents(value).toLowerCase();

  return MONTHS[key] ?? null;
};

const pickRange = (
  startDate: Date | null,
  endDate: Date | null,
): { startDate: Date | null; endDate: Date | null } => {
  if (!startDate) {
    return { startDate: null, endDate: null };
  }

  if (endDate && endDate >= startDate) {
    return { startDate, endDate };
  }

  return { startDate, endDate: null };
};

const parseFromText = (
  text: string,
): { startDate: Date | null; endDate: Date | null; dateText: string; warning?: string } | null => {
  const normalized = text.replace(/\s+/g, ' ').trim();

  const iso = normalized.match(/\b(\d{4})-(\d{2})-(\d{2})\b/);
  if (iso) {
    const startDate = toDate(Number(iso[3]), Number(iso[2]) - 1, Number(iso[1]));
    if (startDate) return { startDate, endDate: null, dateText: iso[0] };
  }

  const fullRange = normalized.match(
    /\b(\d{1,2})[/\\.](\d{1,2})[/\\.](\d{2,4})\s*(?:a|ate|até|to|-|–)\s*(\d{1,2})[/\\.](\d{1,2})[/\\.](\d{2,4})\b/i,
  );
  if (fullRange) {
    const startDate = toDate(
      Number(fullRange[1]),
      Number(fullRange[2]) - 1,
      cleanYear(Number(fullRange[3])),
    );
    const endDate = toDate(
      Number(fullRange[4]),
      Number(fullRange[5]) - 1,
      cleanYear(Number(fullRange[6])),
    );
    const range = pickRange(startDate, endDate);
    if (range.startDate) return { ...range, dateText: fullRange[0] };
  }

  const splitMonthRange = normalized.match(
    /\b(\d{1,2})[/\\.](\d{1,2})\s*(?:a|ate|até|to|-|–)\s*(\d{1,2})[/\\.](\d{1,2})[/\\.](\d{2,4})\b/i,
  );
  if (splitMonthRange) {
    const year = cleanYear(Number(splitMonthRange[5]));
    const startDate = toDate(
      Number(splitMonthRange[1]),
      Number(splitMonthRange[2]) - 1,
      year,
    );
    const endDate = toDate(
      Number(splitMonthRange[3]),
      Number(splitMonthRange[4]) - 1,
      year,
    );
    const range = pickRange(startDate, endDate);
    if (range.startDate) return { ...range, dateText: splitMonthRange[0] };
  }

  const compactRange = normalized.match(
    /\b(\d{1,2})\s*(?:a|ate|até|to|-|–)\s*(\d{1,2})[/\\.](\d{1,2})[/\\.](\d{2,4})\b/i,
  );
  if (compactRange) {
    const year = cleanYear(Number(compactRange[4]));
    const month = Number(compactRange[3]) - 1;
    const startDate = toDate(Number(compactRange[1]), month, year);
    const endDate = toDate(Number(compactRange[2]), month, year);
    const range = pickRange(startDate, endDate);
    if (range.startDate) return { ...range, dateText: compactRange[0] };
  }

  const monthNameRange = normalized.match(
    new RegExp(
      `\\b(\\d{1,2})\\s*(?:a|ate|até|to|-|–)\\s*(\\d{1,2})\\s*(?:de\\s*)?(${MONTH_PATTERN})(?:\\s*de)?\\s*(\\d{4})\\b`,
      'i',
    ),
  );
  if (monthNameRange) {
    const month = getMonth(monthNameRange[3]);
    const startDate =
      month === null ? null : toDate(Number(monthNameRange[1]), month, Number(monthNameRange[4]));
    const endDate =
      month === null ? null : toDate(Number(monthNameRange[2]), month, Number(monthNameRange[4]));
    const range = pickRange(startDate, endDate);
    if (range.startDate) return { ...range, dateText: monthNameRange[0] };
  }

  const englishRange = normalized.match(
    new RegExp(`\\b(\\d{1,2})\\s*(?:-|–|to)\\s*(\\d{1,2})\\s+(${MONTH_PATTERN})\\s+(\\d{4})\\b`, 'i'),
  );
  if (englishRange) {
    const month = getMonth(englishRange[3]);
    const startDate =
      month === null ? null : toDate(Number(englishRange[1]), month, Number(englishRange[4]));
    const endDate =
      month === null ? null : toDate(Number(englishRange[2]), month, Number(englishRange[4]));
    const range = pickRange(startDate, endDate);
    if (range.startDate) return { ...range, dateText: englishRange[0] };
  }

  const singleNumeric = normalized.match(/\b(\d{1,2})[/\\.](\d{1,2})[/\\.](\d{2,4})\b/);
  if (singleNumeric) {
    const startDate = toDate(
      Number(singleNumeric[1]),
      Number(singleNumeric[2]) - 1,
      cleanYear(Number(singleNumeric[3])),
    );
    if (startDate) return { startDate, endDate: null, dateText: singleNumeric[0] };
  }

  const monthYear = normalized.match(new RegExp(`\\b(${MONTH_PATTERN})\\s+(\\d{4})\\b`, 'i'));
  if (monthYear) {
    return {
      startDate: null,
      endDate: null,
      dateText: monthYear[0],
      warning: 'Only month/year found; not using an invented tournament date.',
    };
  }

  return null;
};

export const parseTournamentDate = (input: {
  title?: string;
  rawDateText?: string;
  pageText?: string;
}): ParsedTournamentDate => {
  const warnings: string[] = [];
  const sources: DateSource[] = [
    { text: input.rawDateText, confidence: 'high' },
    { text: input.pageText, confidence: 'medium' },
    { text: input.title, confidence: 'low' },
  ];

  for (const source of sources) {
    if (!source.text?.trim()) continue;
    const parsed = parseFromText(source.text);

    if (!parsed) continue;

    if (parsed.warning) {
      warnings.push(parsed.warning);
      return {
        startDate: null,
        endDate: null,
        dateText: parsed.dateText,
        dateConfidence: 'low',
        warnings,
      };
    }

    return {
      startDate: parsed.startDate,
      endDate: parsed.endDate,
      dateText: parsed.dateText,
      dateConfidence: source.confidence,
      warnings,
    };
  }

  return {
    startDate: null,
    endDate: null,
    dateText: input.rawDateText ?? null,
    dateConfidence: 'unknown',
    warnings: ['No reliable tournament date found.'],
  };
};
