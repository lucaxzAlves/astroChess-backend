import type {
  CriticalPhaseWeakness,
  DecisionPatterns,
  OpeningProfile,
  PlayerStrength,
  PlayingStyleProfile,
  ProfileConfidence,
  RecurringMistake,
  SkillMapCategoryKey,
} from '../player-profile/player-profile.types';

export type WeakSkillSummary = {
  key: SkillMapCategoryKey;
  value: number;
  label?: string;
  description?: string;
};

export type ProfileSummary = {
  playingStyle?: PlayingStyleProfile;
  mainRecurringMistakes: RecurringMistake[];
  mainStrengths: PlayerStrength[];
  currentFocus?: string;
  weakestSkills: WeakSkillSummary[];
  openingNotes: {
    asWhite: OpeningProfile[];
    asBlack: OpeningProfile[];
  };
  criticalPhaseWeakness?: CriticalPhaseWeakness;
  decisionPatterns?: DecisionPatterns;
  profileConfidence?: ProfileConfidence;
};
