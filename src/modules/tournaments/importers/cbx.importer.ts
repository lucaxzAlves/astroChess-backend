import axios from 'axios';
import * as cheerio from 'cheerio';

import { env } from '../../../config/env';
import { ImportedTournament } from './importer.types';

const cleanText = (value: string): string => {
  return value.replace(/\s+/g, ' ').trim();
};

const getMatch = (value: string, regex: RegExp): string | undefined => {
  const match = value.match(regex);

  return match?.[1]?.trim();
};

const toAbsoluteUrl = (href: string): string => {
  return new URL(href, env.cbxTournamentsUrl).toString();
};

const parseCbxBlock = (
  blockText: string,
  tournamentUrl: string,
  sourceIdFromUrl?: string,
): ImportedTournament | null => {
  const sourceId = getMatch(blockText, /ID do Torneio:\s*([^\s]+)/i) ?? sourceIdFromUrl;
  const title = cleanText(blockText.split(/ID do Torneio:/i)[0] ?? '');

  if (!title) {
    return null;
  }

  const timeControlRaw = getMatch(blockText, /Ritmo:\s*(.*?)\s+Rating:/i);
  const ratingType = getMatch(blockText, /Rating:\s*(.*?)(?:\s+Organizador:|\s+Local:|$)/i);
  const organizer = getMatch(blockText, /Organizador:\s*(.*?)(?:\s+Local:|$)/i);
  const locationRaw = getMatch(
    blockText,
    /Local:\s*(.*?)(?:\s+N[°º]\s*Jogadores FIDE:|\s+Período:|$)/i,
  );
  const rawDateText = getMatch(blockText, /Período:\s*(.*?)(?:\s+Observação:|$)/i);

  return {
    source: 'CBX',
    sourceId,
    title,
    sourceUrl: tournamentUrl,
    rawDateText,
    locationRaw,
    description: blockText,
    htmlSnippet: blockText.slice(0, 1000),
    timeControlRaw,
    ratingType,
    organizer,
    raw: {
      title,
      htmlSnippet: blockText.slice(0, 1000),
      data: {
        sourceId,
      },
    },
  };
};

export const importCbxTournaments = async (): Promise<ImportedTournament[]> => {
  try {
    const response = await axios.get<string>(env.cbxTournamentsUrl, {
      timeout: env.scraperTimeoutMs,
      headers: {
        'User-Agent': env.scraperUserAgent,
      },
    });
    const $ = cheerio.load(response.data);
    const tournaments: ImportedTournament[] = [];
    const seenUrls = new Set<string>();

    $('a[href^="/torneio/"]').each((_, element) => {
      const href = $(element).attr('href');

      if (!href) {
        return;
      }

      const tournamentUrl = toAbsoluteUrl(href);

      if (seenUrls.has(tournamentUrl)) {
        return;
      }

      seenUrls.add(tournamentUrl);

      const itemTable = $(element).closest('table').parent().closest('table');
      const blockText = cleanText(itemTable.text());
      const sourceIdFromUrl = href.match(/\/torneio\/(\d+)/)?.[1];
      const tournament = parseCbxBlock(blockText, tournamentUrl, sourceIdFromUrl);

      if (tournament) {
        tournaments.push(tournament);
      }
    });

    if (tournaments.length === 0) {
      console.warn('CBX importer returned no tournaments. Page structure may have changed.');
    } else {
      console.log(`CBX importer found ${tournaments.length} tournaments`);
    }

    return tournaments;
  } catch (error) {
    console.error('CBX importer failed', error);
    throw error;
  }
};
