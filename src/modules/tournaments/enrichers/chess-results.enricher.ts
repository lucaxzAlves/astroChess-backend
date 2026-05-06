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
    `(?:${labelPattern})\\s*:?\\s*(.*?)(?=\\s+(?:Location|Place|Federation|Date|Start|End|Tempo|Time control|Chief|Organizer|Arbiter|Status)\\s*:?|$)`,
    'i',
  );
  const match = text.match(regex);

  return match?.[1] ? cleanText(match[1]) : undefined;
};

export const enrichChessResultsTournament = async (
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
    const title = cleanText(
      $('h1').first().text() ||
        $('.CRg1').first().text() ||
        $('title').text().replace('Chess-Results Server Chess-results.com -', '') ||
        input.title ||
        '',
    );
    const bodyText = cleanText($('body').text());
    const tableText = cleanText($('table').first().text());
    const description = cleanText(`${title} ${tableText || bodyText}`);

    return {
      source: input.source,
      sourceUrl: input.sourceUrl,
      sourceId: input.sourceId,
      title: title || input.title,
      rawDateText: description,
      locationRaw: getField(description, ['Location', 'Place', 'Federation']),
      timeControlRaw: getField(description, ['Tempo', 'Time control']),
      organizer: getField(description, ['Organizer', 'Chief']),
      statusRaw: getField(description, ['Status']),
      description: description.slice(0, 5000),
      htmlSnippet: description.slice(0, 1200),
      enrichmentStatus: 'success',
    };
  } catch (error) {
    return {
      source: input.source,
      sourceUrl: input.sourceUrl,
      sourceId: input.sourceId,
      title: input.title,
      enrichmentStatus: 'failed',
      enrichmentError: error instanceof Error ? error.message : 'Chess-Results enrichment failed',
    };
  }
};
