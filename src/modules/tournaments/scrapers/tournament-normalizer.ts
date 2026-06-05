import {
  CanonicalTournamentSource,
  CanonicalTournamentStatus,
  RatingType,
  TournamentSystem,
  TournamentTimeControl,
} from '../tournament.types';

const BRAZILIAN_STATES: Record<string, string> = {
  ac: 'AC',
  acre: 'AC',
  al: 'AL',
  alagoas: 'AL',
  ap: 'AP',
  amapa: 'AP',
  amapá: 'AP',
  am: 'AM',
  amazonas: 'AM',
  ba: 'BA',
  bahia: 'BA',
  ce: 'CE',
  ceara: 'CE',
  ceará: 'CE',
  df: 'DF',
  'distrito federal': 'DF',
  es: 'ES',
  'espirito santo': 'ES',
  'espírito santo': 'ES',
  go: 'GO',
  goias: 'GO',
  goiás: 'GO',
  ma: 'MA',
  maranhao: 'MA',
  maranhão: 'MA',
  mt: 'MT',
  'mato grosso': 'MT',
  ms: 'MS',
  'mato grosso do sul': 'MS',
  mg: 'MG',
  'minas gerais': 'MG',
  pa: 'PA',
  para: 'PA',
  pará: 'PA',
  pb: 'PB',
  paraiba: 'PB',
  paraíba: 'PB',
  pr: 'PR',
  parana: 'PR',
  paraná: 'PR',
  pe: 'PE',
  pernambuco: 'PE',
  pi: 'PI',
  piaui: 'PI',
  piauí: 'PI',
  rj: 'RJ',
  'rio de janeiro': 'RJ',
  rn: 'RN',
  'rio grande do norte': 'RN',
  rs: 'RS',
  'rio grande do sul': 'RS',
  ro: 'RO',
  rondonia: 'RO',
  rondônia: 'RO',
  rr: 'RR',
  roraima: 'RR',
  sc: 'SC',
  'santa catarina': 'SC',
  sp: 'SP',
  'sao paulo': 'SP',
  'são paulo': 'SP',
  se: 'SE',
  sergipe: 'SE',
  to: 'TO',
  tocantins: 'TO',
};

export const stripAccents = (value: string): string => {
  return value.normalize('NFD').replace(/\p{Diacritic}/gu, '');
};

export const normalizeSpaces = (value: string): string => {
  return value.replace(/\s+/g, ' ').trim();
};

export const normalizeTournamentTitle = (title: string): string => {
  return stripAccents(normalizeSpaces(title))
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
};

export const normalizeSource = (source?: string): CanonicalTournamentSource => {
  const normalized = String(source ?? '').toLowerCase();

  if (normalized === 'chess_results' || normalized === 'chess-results') return 'chess-results';
  if (normalized === 'cbx') return 'cbx';
  if (normalized === 'manual') return 'manual';

  return 'unknown';
};

export const normalizeStatus = (raw?: string | null): CanonicalTournamentStatus => {
  const text = stripAccents(String(raw ?? '').toLowerCase());

  if (!text) return 'unknown';
  if (text.includes('not started') || text.includes('upcoming') || text.includes('inscr')) {
    return 'not_started';
  }
  if (text.includes('playing') || text.includes('ongoing') || text.includes('em andamento')) {
    return 'playing';
  }
  if (text.includes('final') || text.includes('finished') || text.includes('encerr')) {
    return 'finished';
  }

  return 'unknown';
};

export const normalizeTimeControl = (raw?: string | null): TournamentTimeControl => {
  const text = stripAccents(String(raw ?? '').toLowerCase());

  if (!text) return 'unknown';
  if (/\b(bullet|hyperbullet)\b/.test(text)) return 'bullet';
  if (/\b(blitz|bz|relampago|relampago)\b/.test(text)) return 'blitz';
  if (/\b(rapid|rapido|rp|semirrapido|semi rapido|semi-rapido)\b/.test(text)) return 'rapid';
  if (/\b(classical|classic|standard|std|pensado|classico|lento)\b/.test(text)) {
    return 'classical';
  }
  if (text.includes('mixed') || text.includes('misto')) return 'mixed';

  return 'unknown';
};

export const normalizeState = (raw?: string | null): string | null => {
  if (!raw) return null;
  const compact = stripAccents(raw).toLowerCase().trim();
  const direct = BRAZILIAN_STATES[compact] ?? BRAZILIAN_STATES[compact.replace(/\./g, '')];

  return direct ?? null;
};

export const extractStateFromText = (text?: string | null): string | null => {
  if (!text) return null;
  const normalized = stripAccents(text).toLowerCase();
  const ufMatch = normalized.match(/(?:^|[\s,/-])([a-z]{2})(?:$|[\s,/-])/i);

  if (ufMatch) {
    const state = normalizeState(ufMatch[1]);
    if (state) return state;
  }

  for (const [key, state] of Object.entries(BRAZILIAN_STATES)) {
    if (key.length > 2 && normalized.includes(stripAccents(key).toLowerCase())) {
      return state;
    }
  }

  return null;
};

export const extractCityFromText = (text?: string | null): string | null => {
  if (!text) return null;
  const cleaned = normalizeSpaces(text);
  const cityStateMatch = cleaned.match(/([A-Za-zÀ-ÿ .'-]{3,})\s*[-/,]\s*[A-Z]{2}\b/);

  if (cityStateMatch?.[1]) {
    return normalizeSpaces(cityStateMatch[1]);
  }

  const locationMatch = cleaned.match(/(?:cidade|city|local|location|place)\s*:?\s*([^|;\n]+)/i);

  return locationMatch?.[1] ? normalizeSpaces(locationMatch[1]).slice(0, 120) : null;
};

export const normalizeSystem = (raw?: string | null): TournamentSystem => {
  const text = stripAccents(String(raw ?? '').toLowerCase());

  if (text.includes('swiss') || text.includes('suico')) return 'swiss';
  if (text.includes('round robin') || text.includes('todos contra')) return 'round_robin';
  if (text.includes('knockout') || text.includes('mata-mata')) return 'knockout';

  return 'unknown';
};

export const normalizeRatingType = (raw?: string | null): RatingType => {
  const text = stripAccents(String(raw ?? '').toLowerCase());

  if (text.includes('fide')) return 'fide';
  if (text.includes('cbx') || text.includes('nacional')) return 'national';
  if (text.includes('unrated') || text.includes('nao valido') || text.includes('não válido')) {
    return 'unrated';
  }

  return 'unknown';
};
