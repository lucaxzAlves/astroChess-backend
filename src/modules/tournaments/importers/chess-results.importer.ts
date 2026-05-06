import axios from 'axios';
import * as cheerio from 'cheerio';

import { env } from '../../../config/env';
import { TournamentStatus } from '../tournament.types';
import { ImportedTournament } from './importer.types';

const CHESS_RESULTS_BASE_URL = 'https://chess-results.com/';

const cleanText = (value: string): string => {
  return value.replace(/\s+/g, ' ').trim();
};

const toAbsoluteUrl = (href: string): string => {
  return new URL(href, CHESS_RESULTS_BASE_URL).toString();
};

const getSourceId = (url: string): string | undefined => {
  const parsedUrl = new URL(url);

  return (
    parsedUrl.searchParams.get('tnr') ??
    parsedUrl.searchParams.get('tn') ??
    parsedUrl.pathname.match(/tnr(\d+)\.aspx/i)?.[1] ??
    undefined
  );
};

const parseStatus = (value: string): TournamentStatus => {
  const normalized = value.toLowerCase();

  if (normalized.includes('not started')) {
    return 'upcoming';
  }

  if (normalized.includes('playing')) {
    return 'ongoing';
  }

  if (normalized.includes('finalized')) {
    return 'finished';
  }

  return 'unknown';
};

export const importChessResultsBrazilTournaments = async (): Promise<ImportedTournament[]> => {
  try {
    const response = await axios.get<string>(env.chessResultsBrazilUrl, {
      timeout: env.scraperTimeoutMs,
      headers: {
        'User-Agent': env.scraperUserAgent,
      },
    });
    const $ = cheerio.load(response.data);
    const tournaments: ImportedTournament[] = [];

    $('a[href*="tnr"], a[href*="tn="], a[href*="turdet"]').each((_, element) => {
      const anchor = $(element);
      const title = cleanText(anchor.text());
      const href = anchor.attr('href');

      if (!title || !href) {
        return;
      }

      const sourceUrl = toAbsoluteUrl(href);
      const parentText = cleanText(anchor.parent().text());
      const nextText = cleanText(anchor.parent().next().text());
      const surroundingText = `${parentText} ${nextText}`;
      const timeControlRaw = surroundingText.match(/\b(St|Rp|Bz)\b/i)?.[1];
      const statusRaw = surroundingText.match(/\b(Not started|Playing|Finalized)\b/i)?.[1];

      tournaments.push({
        source: 'CHESS_RESULTS',
        sourceId: getSourceId(sourceUrl),
        title,
        sourceUrl,
        timeControlRaw,
        statusRaw,
        status: statusRaw ? parseStatus(statusRaw) : undefined,
        locationRaw: title,
        rawDateText: surroundingText,
        description: surroundingText,
        htmlSnippet: parentText.slice(0, 1000),
        raw: {
          title,
          htmlSnippet: parentText.slice(0, 1000),
          data: {
            surroundingText: surroundingText.slice(0, 1000),
          },
        },
      });
    });

    if (tournaments.length === 0) {
      console.warn(
        'Chess-Results importer returned no tournaments. Page structure may have changed.',
      );
    } else {
      console.log(`Chess-Results importer found ${tournaments.length} tournaments`);
    }

    return tournaments;
  } catch (error) {
    console.error('Chess-Results importer failed', error);
    throw error;
  }
};
