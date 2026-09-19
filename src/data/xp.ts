import type { DifficultyId, RemasterId } from './types';

export const JEFF_LEVEL_CAP = 30;

/** XP needed to go from `level` to `level + 1`. */
export function xpToNext(level: number): number {
  return Math.round(40 + level * 28 + level * level * 4);
}

export function levelFromXp(totalXp: number): { level: number; into: number; need: number } {
  let level = 1;
  let remaining = Math.max(0, totalXp);
  while (level < JEFF_LEVEL_CAP) {
    const need = xpToNext(level);
    if (remaining < need) return { level, into: remaining, need };
    remaining -= need;
    level++;
  }
  return { level: JEFF_LEVEL_CAP, into: remaining, need: xpToNext(JEFF_LEVEL_CAP) };
}

export function xpBarCopy(xp: { level: number; into: number; need: number }): string {
  if (xp.level >= JEFF_LEVEL_CAP) return 'Max level';
  return `${xp.into} / ${xp.need} XP to next`;
}

export function talentPointsAvailable(totalXp: number, talentsOwned: number): number {
  return Math.max(0, levelFromXp(totalXp).level - 1 - talentsOwned);
}

export function campaignXp(opts: {
  won: boolean;
  stars: number;
  difficulty: DifficultyId;
  remaster: RemasterId;
  waveIdx: number;
}): number {
  if (!opts.won) return 8 + opts.waveIdx * 4;
  const diff = opts.difficulty === 'apprentice' ? 0 : opts.difficulty === 'journeyman' ? 12 : 28;
  const rem = opts.remaster === 'classic' ? 0 : 22;
  return 36 + opts.stars * 16 + diff + rem;
}

/** Waves completed on Night Shift (clock-out keeps the current wave; a drown drops the unfinished one). */
export function nightWavesCompleted(waveIdx: number, retired: boolean): number {
  return retired ? waveIdx : Math.max(0, waveIdx - 1);
}

export function nightXp(completed: number, retired: boolean): number {
  if (completed <= 0) return 0;
  let xp = 0;
  for (let i = 1; i <= completed; i++) xp += 7 + Math.floor(i / 5) * 2;
  if (retired) xp += 16 + Math.floor(completed / 5) * 10;
  return xp;
}

export function salvageXp(rarity: 'common' | 'uncommon' | 'rare' | 'relic'): number {
  switch (rarity) {
    case 'common':
      return 8;
    case 'uncommon':
      return 14;
    case 'rare':
      return 24;
    case 'relic':
      return 40;
    default: {
      const _exhaustive: never = rarity;
      return _exhaustive;
    }
  }
}
