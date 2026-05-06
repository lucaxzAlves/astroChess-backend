import { TournamentTimeControl } from '../tournament.types';

const normalize = (value: string): string => {
  return value
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase();
};

export const parseTimeControl = (value?: string): TournamentTimeControl => {
  if (!value) {
    return 'unknown';
  }

  const normalized = normalize(value);
  const hasClassical = /\b(classico|classical|std|standard|st)\b/.test(normalized);
  const hasRapid = /\b(rapido|rapid|rpd|rp)\b/.test(normalized);
  const hasBlitz = /\b(blitz|blz|bz|relampago)\b/.test(normalized);
  const matches = [hasClassical, hasRapid, hasBlitz].filter(Boolean).length;

  if (matches > 1) {
    return 'mixed';
  }

  if (hasClassical) {
    return 'classical';
  }

  if (hasRapid) {
    return 'rapid';
  }

  if (hasBlitz) {
    return 'blitz';
  }

  return 'unknown';
};
