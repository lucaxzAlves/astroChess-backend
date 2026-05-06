import axios from 'axios';
import * as cheerio from 'cheerio';

import { env } from '../../../config/env';
import { TournamentEnrichmentInput, TournamentEnrichmentResult } from './enricher.types';

const cleanText = (value: string): string => {
  return value.replace(/\s+/g, ' ').trim();
};

const getField = (text: string, labels: string[]): string | undefined => {
  const labelPattern = labels.join('|');
  const regex = new RegExp(
    `(?:${labelPattern})\\s*:?\\s*(.*?)(?=\\s+(?:Data|Per[ií]odo|Inicio|Início|T[eé]rmino|Termino|Local|Cidade|UF|Ritmo|Organizador|Rating|Regulamento|Chess-Results)\\s*:?|$)`,
    'i',
  );
  const match = text.match(regex);

  return match?.[1] ? cleanText(match[1]) : undefined;
};

const findUsefulLinks = ($: cheerio.CheerioAPI): TournamentEnrichmentResult['usefulLinks'] => {
  const links: TournamentEnrichmentResult['usefulLinks'] = {};

  $('a[href]').each((_, element) => {
    const href = $(element).attr('href');
    const label = cleanText($(element).text()).toLowerCase();

    if (!href) {
      return;
    }

    const absoluteUrl = new URL(href, env.cbxTournamentsUrl).toString();

    if (absoluteUrl.includes('chess-results.com')) {
      links.chessResultsUrl = absoluteUrl;
      return;
    }

    if (label.includes('regulamento') || absoluteUrl.includes('/torneio/')) {
      links.regulationUrl = absoluteUrl;
      return;
    }

    if (!links.officialUrl && /^https?:\/\//.test(absoluteUrl)) {
      links.officialUrl = absoluteUrl;
    }
  });

  return links;
};

export const enrichCbxTournament = async (
  input: TournamentEnrichmentInput,
): Promise<TournamentEnrichmentResult> => {
  try {
    const response = await axios.get<string>(input.sourceUrl, {
      timeout: env.tournamentsEnrichTimeoutMs,
      headers: {
        'User-Agent': env.scraperUserAgent,
      },
    });
    const $ = cheerio.load(response.data);
    const mainText = cleanText(
      $('main').text() || $('[id*="ContentPlaceHolder"]').text() || $('body').text(),
    );
    const title = cleanText($('h1').first().text() || $('title').text() || input.title || '');
    const rawDateText =
      getField(mainText, ['Per[ií]odo', 'Data', 'In[ií]cio', 'Realiza[cç][aã]o']) ?? mainText;

    return {
      source: input.source,
      sourceUrl: input.sourceUrl,
      sourceId: input.sourceId,
      title: title || input.title,
      rawDateText,
      locationRaw: getField(mainText, ['Local', 'Cidade']),
      timeControlRaw: getField(mainText, ['Ritmo']),
      organizer: getField(mainText, ['Organizador']),
      ratingType: getField(mainText, ['Rating']),
      description: mainText.slice(0, 4000),
      htmlSnippet: mainText.slice(0, 1200),
      usefulLinks: findUsefulLinks($),
      enrichmentStatus: 'success',
    };
  } catch (error) {
    return {
      source: input.source,
      sourceUrl: input.sourceUrl,
      sourceId: input.sourceId,
      title: input.title,
      enrichmentStatus: 'failed',
      enrichmentError: error instanceof Error ? error.message : 'CBX enrichment failed',
    };
  }
};
