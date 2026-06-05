import type { PatternForgeThemeKey } from './pattern-forge.types';

export const PATTERN_FORGE_THEME_MAP: Record<
  PatternForgeThemeKey,
  { lichessThemes: string[]; openingTagKeywords?: string[] }
> = {
  tactics: {
    lichessThemes: [
      'fork',
      'pin',
      'skewer',
      'discoveredAttack',
      'sacrifice',
      'attraction',
      'deflection',
      'intermezzo',
    ],
  },
  calculation: {
    lichessThemes: ['long', 'veryLong', 'advantage', 'crushing', 'quietMove'],
  },
  king_safety: {
    lichessThemes: [
      'mate',
      'mateIn1',
      'mateIn2',
      'mateIn3',
      'backRankMate',
      'exposedKing',
      'hookMate',
      'arabianMate',
    ],
  },
  endgames: {
    lichessThemes: [
      'endgame',
      'pawnEndgame',
      'rookEndgame',
      'queenRookEndgame',
      'bishopEndgame',
      'knightEndgame',
    ],
  },
  conversion: {
    lichessThemes: ['advantage', 'crushing', 'endgame'],
  },
  defensive_resources: {
    lichessThemes: ['defensiveMove', 'equality', 'intermezzo'],
  },
  time_pressure: {
    lichessThemes: ['oneMove', 'short', 'mateIn1', 'mateIn2'],
  },
  candidate_moves: {
    lichessThemes: ['quietMove', 'intermezzo', 'deflection', 'clearance'],
  },
  pawn_breaks: {
    lichessThemes: ['advancedPawn', 'promotion', 'pawnEndgame'],
  },
  openings: {
    lichessThemes: ['opening'],
    openingTagKeywords: ['sicilian', 'french', 'caro', 'ruy', 'italian', 'queens', 'kings'],
  },
};

export const ALL_PATTERN_FORGE_THEMES = Object.keys(
  PATTERN_FORGE_THEME_MAP,
) as PatternForgeThemeKey[];
