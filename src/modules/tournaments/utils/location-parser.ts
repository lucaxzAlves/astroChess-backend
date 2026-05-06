const BRAZILIAN_STATES = new Set([
  'AC',
  'AL',
  'AP',
  'AM',
  'BA',
  'CE',
  'DF',
  'ES',
  'GO',
  'MA',
  'MT',
  'MS',
  'MG',
  'PA',
  'PB',
  'PR',
  'PE',
  'PI',
  'RJ',
  'RN',
  'RS',
  'RO',
  'RR',
  'SC',
  'SP',
  'SE',
  'TO',
]);

const STATE_NAMES: Record<string, string> = {
  ACRE: 'AC',
  ALAGOAS: 'AL',
  AMAPA: 'AP',
  AMAZONAS: 'AM',
  BAHIA: 'BA',
  CEARA: 'CE',
  'DISTRITO FEDERAL': 'DF',
  'ESPIRITO SANTO': 'ES',
  GOIAS: 'GO',
  MARANHAO: 'MA',
  'MATO GROSSO': 'MT',
  'MATO GROSSO DO SUL': 'MS',
  'MINAS GERAIS': 'MG',
  PARA: 'PA',
  PARAIBA: 'PB',
  PARANA: 'PR',
  PERNAMBUCO: 'PE',
  PIAUI: 'PI',
  'RIO DE JANEIRO': 'RJ',
  'RIO GRANDE DO NORTE': 'RN',
  'RIO GRANDE DO SUL': 'RS',
  RONDONIA: 'RO',
  RORAIMA: 'RR',
  'SANTA CATARINA': 'SC',
  'SAO PAULO': 'SP',
  SERGIPE: 'SE',
  TOCANTINS: 'TO',
};

const stripAccents = (value: string): string => {
  return value.normalize('NFD').replace(/\p{Diacritic}/gu, '');
};

const cleanLocation = (value: string): string => {
  return value
    .replace(/\bbrasil\b/gi, '')
    .replace(/\s*[-–]\s*/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
};

export const isValidBrazilianState = (state: string): boolean => {
  return BRAZILIAN_STATES.has(state.toUpperCase());
};

export const parseBrazilianLocation = (
  locationRaw?: string,
): { city?: string; state?: string; country: 'BR'; locationRaw?: string } => {
  if (!locationRaw) {
    return { country: 'BR' };
  }

  const cleaned = cleanLocation(locationRaw);
  const slashMatch = cleaned.match(/^(.+?)\s*\/\s*([A-Za-z]{2})$/);

  if (slashMatch) {
    const state = slashMatch[2].toUpperCase();

    if (BRAZILIAN_STATES.has(state)) {
      return { city: slashMatch[1].trim(), state, country: 'BR', locationRaw };
    }
  }

  const ufMatch = cleaned.match(/^(.+?)\s+([A-Za-z]{2})$/);

  if (ufMatch) {
    const state = ufMatch[2].toUpperCase();

    if (BRAZILIAN_STATES.has(state)) {
      return { city: ufMatch[1].trim(), state, country: 'BR', locationRaw };
    }
  }

  const normalized = stripAccents(cleaned).toUpperCase();

  for (const [stateName, state] of Object.entries(STATE_NAMES)) {
    if (normalized.endsWith(stateName)) {
      return {
        city: cleaned.slice(0, Math.max(0, cleaned.length - stateName.length)).trim() || undefined,
        state,
        country: 'BR',
        locationRaw,
      };
    }
  }

  return { country: 'BR', locationRaw };
};
