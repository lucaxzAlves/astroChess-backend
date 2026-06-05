import type { PlayerProfileDocument } from '../player-profile/player-profile.types';
import type { ProfileSummary, WeakSkillSummary } from './profile-summary.types';

const DEFAULT_LIMIT = 5;

const toPlainValue = <TValue>(value: TValue | null | undefined): TValue | undefined => {
  if (value === undefined || value === null) {
    return undefined;
  }

  if (typeof value === 'object' && 'toObject' in (value as object)) {
    const maybeDocument = value as { toObject?: () => TValue };

    if (typeof maybeDocument.toObject === 'function') {
      return maybeDocument.toObject();
    }
  }

  return value;
};

const sortByFrequency = <TItem extends { frequency?: number; evidenceCount?: number }>(
  items: TItem[] | undefined,
): TItem[] => {
  return [...(items ?? [])].sort(
    (left, right) => (right.frequency ?? right.evidenceCount ?? 0) - (left.frequency ?? left.evidenceCount ?? 0),
  );
};

const buildWeakestSkills = (profile: PlayerProfileDocument): WeakSkillSummary[] => {
  const categories = profile.skillMap?.categories;

  if (!categories) {
    return [];
  }

  return Object.entries(categories)
    .map(([key, value]) => ({
      key: key as WeakSkillSummary['key'],
      value: value?.value ?? 0,
      label: value?.label,
      description: value?.description,
    }))
    .sort((left, right) => left.value - right.value)
    .slice(0, 3);
};

export const buildProfileSummary = (
  profile: PlayerProfileDocument | null,
): ProfileSummary | null => {
  if (!profile) {
    return null;
  }

  const openingsAsWhite = toPlainValue(profile.openingRepertoire?.asWhite) ?? [];
  const openingsAsBlack = [
    ...(toPlainValue(profile.openingRepertoire?.asBlack?.againstE4) ?? []),
    ...(toPlainValue(profile.openingRepertoire?.asBlack?.againstD4) ?? []),
    ...(toPlainValue(profile.openingRepertoire?.asBlack?.againstOther) ?? []),
  ].slice(0, DEFAULT_LIMIT);

  return {
    playingStyle: toPlainValue(profile.playingStyle),
    mainRecurringMistakes: sortByFrequency(toPlainValue(profile.recurringMistakes)).slice(
      0,
      DEFAULT_LIMIT,
    ),
    mainStrengths: sortByFrequency(toPlainValue(profile.strengths)).slice(0, DEFAULT_LIMIT),
    currentFocus:
      profile.recommendations?.currentFocus ?? profile.goals?.focusAreas?.[0] ?? undefined,
    weakestSkills: buildWeakestSkills(profile),
    openingNotes: {
      asWhite: openingsAsWhite.slice(0, DEFAULT_LIMIT),
      asBlack: openingsAsBlack,
    },
    criticalPhaseWeakness: toPlainValue(profile.criticalPhaseWeakness),
    decisionPatterns: toPlainValue(profile.decisionPatterns),
    profileConfidence: toPlainValue(profile.profileConfidence),
  };
};
