import type { RpgExperienceEntry, RpgLevelProgress } from '../../domain/models/rpg';

export function expRequiredForNextLevel(level: number): number {
  return Math.round(100 * Math.pow(Math.max(1, level), 1.5));
}

export function totalExpRequiredForLevel(level: number): number {
  let total = 0;
  for (let current = 1; current < Math.max(1, level); current += 1) {
    total += expRequiredForNextLevel(current);
  }
  return total;
}

export function calculateLevelProgress(
  entries: RpgExperienceEntry[],
  lastLevelUpAt?: string,
): RpgLevelProgress {
  const totalExp = entries.reduce((sum, entry) => sum + Math.max(0, entry.effectiveAmount), 0);
  let currentLevel = 1;
  let remaining = totalExp;

  while (remaining >= expRequiredForNextLevel(currentLevel)) {
    remaining -= expRequiredForNextLevel(currentLevel);
    currentLevel += 1;
  }

  const levelStartTotalExp = totalExpRequiredForLevel(currentLevel);
  const expToNextLevel = expRequiredForNextLevel(currentLevel) - remaining;

  return {
    currentLevel,
    currentExp: remaining,
    totalExp,
    expToNextLevel,
    levelStartTotalExp,
    nextLevelTotalExp: levelStartTotalExp + expRequiredForNextLevel(currentLevel),
    lastLevelUpAt,
  };
}
