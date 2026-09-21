import { servicePointsForRun } from './store';
import { Rng } from '../core/rng';
import type { SaveStore } from '../save/save';
import type { Game } from '../sim/game';
import { applyAffix, rollChest } from './loot';
import { campaignXp, nightXp } from './xp';
import { neutralModifiers } from './skills';
import type { ChestQuality, KitItem, Modifiers } from './types';

export function buildRunModifiers(save: SaveStore): Modifiers {
  const m = neutralModifiers();
  for (const item of save.equippedArmor()) {
    for (const affix of item.affixes) applyAffix(m, affix);
  }
  return m;
}

export interface RunReward {
  xp: number;
  servicePoints: number;
  leveledTo: number | null;
  items: KitItem[];
  salvagedXp: number;
  chests: ChestQuality[];
}

export function chestsForRun(game: Game, earnedStars: number, firstClear = true): ChestQuality[] {
  if (game.status === 'won' && !game.endless) {
    if (!firstClear) return [];
    if (game.remaster !== 'classic') return ['remaster'];
    return [earnedStars >= 3 ? 'clean' : 'job'];
  }
  if (!game.endless) return [];
  const completed = game.completedWaves;
  const out: ChestQuality[] = [];
  for (let n = 5; n <= completed; n += 5) {
    out.push(n >= 15 ? 'deepNight' : 'night');
  }
  if (game.status === 'retired' && completed >= 8 && completed % 5 !== 0) {
    out.push(completed >= 15 ? 'deepNight' : 'night');
  }
  return out;
}

export function xpForRun(game: Game, earnedStars: number): number {
  if (game.endless) {
    return nightXp(game.completedWaves, game.status === 'retired');
  }
  return campaignXp({
    won: game.status === 'won',
    stars: earnedStars,
    difficulty: game.difficulty.id,
    remaster: game.remaster,
    waveIdx: game.waveIdx,
  });
}

export function grantRunRewards(save: SaveStore, game: Game, earnedStars: number, firstClear = true): RunReward {
  if (game.rewardsClaimed || !['won', 'lost', 'retired'].includes(game.status)) return { xp: 0, servicePoints: 0, leveledTo: null, items: [], salvagedXp: 0, chests: [] };
  game.rewardsClaimed = true;
  const xp = xpForRun(game, earnedStars);
  const servicePoints = servicePointsForRun(game);
  save.addServicePoints(servicePoints);
  const before = save.jeffLevel();
  save.addXp(xp);
  const items: KitItem[] = [];
  let salvagedXp = 0;
  const chests = chestsForRun(game, earnedStars, firstClear);
  const rng = new Rng(((save.data.jeffXp * 7919) ^ (game.waveIdx * 997) ^ (game.stats.kills * 13) ^ 0x9e3779b9) >>> 0);
  for (const quality of chests) {
    const item = rollChest(rng, quality, save.nextGearId(), game.heroDef.id);
    const added = save.addGear(item);
    if (added.kept) items.push(item);
    salvagedXp += added.salvagedXp;
  }
  const after = save.jeffLevel();
  return {
    xp,
    servicePoints,
    leveledTo: after > before ? after : null,
    items,
    salvagedXp,
    chests,
  };
}
