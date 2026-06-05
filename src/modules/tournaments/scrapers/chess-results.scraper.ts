import axios from 'axios';
import * as cheerio from 'cheerio';

import { env } from '../../../config/env';
import {
  DiscoveredTournament,
  TournamentDetails,
  TournamentSearchFilters,
} from '../tournament.types';
import { parseTournamentDate } from './tournament-date-parser';
import {
  extractCityFromText,
  extractStateFromText,
  normalizeRatingType,
  normalizeSpaces,
  normalizeStatus,
  normalizeSystem,
  normalizeTimeControl,
  normalizeTournamentTitle,
} from './tournament-normalizer';

const CHESS_RESULTS_BASE_URL = 'https://chess-results.com/';

const cleanText = (value: string): string => normalizeSpaces(value.replace(/\u00a0/g, ' '));

const toAbsoluteUrl = (href: string): string => {
  return new URL(href, CHESS_RESULTS_BASE_URL).toString();
};

const getSourceTournamentId = (url: string): string | null => {
  try {
    const parsedUrl = new URL(url);

    return (
      parsedUrl.searchParams.get('tnr') ??
      parsedUrl.searchParams.get('tn') ??
      parsedUrl.pathname.match(/tnr(\d+)\.aspx/i)?.[1] ??
      null
    );
  } catch {
    return null;
  }
};

const fetchHtml = async (url: string): Promise<string> => {
  const response = await axios.get<string>(url, {
    timeout: env.scraperTimeoutMs,
    headers: {
      'User-Agent': env.scraperUserAgent,
      Accept: 'text/html,application/xhtml+xml',
    },
  });

  return response.data;
};

const getField = (pageText: string, labels: string[]): string | null => {
  const labelPattern = labels.map((label) => label.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|');
  const regex = new RegExp(
    `(?:${labelPattern})\\s*:?\\s*(.*?)(?=\\s+(?:Organizer|Organiser|Chief Arbiter|Arbiter|Federation|Location|Place|City|Date|Start|End|Tempo|Time control|Number of rounds|Rounds|System|Rating|Category|Status|Last update)\\s*:?|$)`,
    'i',
  );
  const match = pageText.match(regex);

  return match?.[1] ? cleanText(match[1]).slice(0, 300) : null;
};

const getNumberField = (pageText: string, labels: string[]): number | null => {
  const raw = getField(pageText, labels);
  const match = raw?.match(/\d+/);

  return match ? Number(match[0]) : null;
};

const matchesDiscoveryFilters = (
  tournament: DiscoveredTournament,
  filters: TournamentSearchFilters,
): boolean => {
  const text = cleanText(
    `${tournament.title} ${tournament.surroundingText ?? ''} ${tournament.timeControlRaw ?? ''}`,
  );
  const normalizedText = normalizeTournamentTitle(text);

  if (filters.search && !normalizedText.includes(normalizeTournamentTitle(filters.search))) {
    return false;
  }

  if (filters.timeControl) {
    const timeControl = normalizeTimeControl(`${tournament.timeControlRaw ?? ''} ${text}`);
    if (timeControl !== 'unknown' && timeControl !== filters.timeControl) {
      return false;
    }
  }

  if (filters.status) {
    const status = normalizeStatus(tournament.statusRaw);
    if (status !== 'unknown' && status !== filters.status) {
      return false;
    }
  }

  if (filters.state) {
    const state = extractStateFromText(text);
    if (state && state !== filters.state) {
      return false;
    }
  }

  if (filters.city) {
    const city = extractCityFromText(text);
    if (city && normalizeTournamentTitle(city) !== normalizeTournamentTitle(filters.city)) {
      return false;
    }
  }

  return true;
};

export class ChessResultsScraper {
  async discoverBrazilTournaments(filters: TournamentSearchFilters): Promise<DiscoveredTournament[]> {
    const html = await fetchHtml(env.chessResultsBrazilUrl);
    const $ = cheerio.load(html);
    const found = new Map<string, DiscoveredTournament>();

    $('a[href*="tnr"], a[href*="tn="], a[href*="turdet"]').each((_, element) => {
      const anchor = $(element);
      const title = cleanText(anchor.text());
      const href = anchor.attr('href');

      if (!title || !href || title.length < 4) return;

      const sourceUrl = toAbsoluteUrl(href);
      const sourceTournamentId = getSourceTournamentId(sourceUrl);
      const parentText = cleanText(anchor.parent().text());
      const rowText = cleanText(anchor.closest('tr').text());
      const surroundingText = cleanText(`${rowText || parentText} ${anchor.parent().next().text()}`);
      const statusRaw =
        surroundingText.match(/\b(Not started|Playing|Finalized|Finished|Upcoming)\b/i)?.[1] ??
        null;
      const timeControlRaw = surroundingText.match(/\b(St|Std|Rp|Rapid|Bz|Blitz|Classical)\b/i)?.[1] ?? null;
      const tournament = {
        title,
        sourceUrl,
        sourceTournamentId,
        statusRaw,
        timeControlRaw,
        lastUpdatedRaw:
          surroundingText.match(/\b\d{1,2}[/.]\d{1,2}[/.]\d{2,4}\b/)?.[0] ?? null,
        surroundingText,
      };

      if (!matchesDiscoveryFilters(tournament, filters)) return;

      found.set(sourceTournamentId ?? sourceUrl, tournament);
    });

    return [...found.values()];
  }

  async scrapeTournamentDetails(sourceUrl: string): Promise<TournamentDetails> {
    const html = await fetchHtml(sourceUrl);
    const $ = cheerio.load(html);
    const title = cleanText(
      $('h1').first().text() ||
        $('.CRg1').first().text() ||
        $('title').text().replace(/Chess-Results Server Chess-results.com\s*-\s*/i, ''),
    );
    const pageText = cleanText($('body').text());
    const firstTableText = cleanText($('table').first().text());
    const rawDateText =
      getField(pageText, ['Date', 'Start', 'End', 'Tournament date', 'Period']) ??
      firstTableText ??
      pageText;
    const dateResult = parseTournamentDate({
      title,
      rawDateText,
      pageText,
    });
    const locationRaw =
      getField(pageText, ['Location', 'Place', 'City']) ??
      getField(firstTableText, ['Location', 'Place', 'City']) ??
      title;
    const timeControlRaw =
      getField(pageText, ['Tempo', 'Time control', 'Rate of play']) ??
      getField(firstTableText, ['Tempo', 'Time control']) ??
      title;
    const statusRaw = getField(pageText, ['Status']) ?? null;
    const systemRaw = getField(pageText, ['System']) ?? null;
    const ratingRaw = getField(pageText, ['Rating', 'Rating calculation']) ?? null;
    const sourceTournamentId = getSourceTournamentId(sourceUrl);

    return {
      source: 'chess-results',
      sourceTournamentId,
      sourceUrl,
      title: title || sourceTournamentId || sourceUrl,
      normalizedTitle: normalizeTournamentTitle(title || sourceUrl),
      description: pageText.slice(0, 5000),
      status: normalizeStatus(statusRaw || pageText),
      timeControl: normalizeTimeControl(timeControlRaw),
      startDate: dateResult.startDate,
      endDate: dateResult.endDate,
      dateText: dateResult.dateText,
      dateConfidence: dateResult.dateConfidence,
      location: {
        city: extractCityFromText(locationRaw),
        state: extractStateFromText(locationRaw ?? pageText),
        country: 'BR',
        venue: locationRaw,
        raw: locationRaw,
      },
      organizer: getField(pageText, ['Organizer', 'Organiser']) ?? null,
      arbiter: getField(pageText, ['Chief Arbiter', 'Arbiter']) ?? null,
      federation: getField(pageText, ['Federation']) ?? null,
      playersCount: getNumberField(pageText, ['Number of players', 'Players', 'Participants']),
      rounds: getNumberField(pageText, ['Number of rounds', 'Rounds']),
      system: normalizeSystem(systemRaw),
      category: getField(pageText, ['Category']) ?? null,
      ratingType: normalizeRatingType(ratingRaw || pageText),
      links: {
        chessResults: sourceUrl,
      },
      metadata: {
        firstTableText: firstTableText.slice(0, 2000),
      },
      parseWarnings: dateResult.warnings,
      detailsScraped: true,
      lastScrapedAt: new Date(),
      sourceLastUpdatedAt: null,
    };
  }
}
