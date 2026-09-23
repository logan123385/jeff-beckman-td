import { earnedCommendations } from './commendations';
import { servicePointsForRun } from './store';
import { Rng } from '../core/rng';
import { isOneLife } from './remasters';
import { starsForClear, type SaveStore } from '../save/save';
import type { Game } from '../sim/game';
import type { GameStatus } from '../sim/state';
import { applyAffix, rollChest } from './loot';
import { campaignXp, nightXp } from './xp';
import { neutralModifiers } from './modifiers';
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

export function emptyRunReward(): RunReward {
  return { xp: 0, servicePoints: 0, leveledTo: null, items: [], salvagedXp: 0, chests: [] };
}

export function isTerminalStatus(status: GameStatus): boolean {
  return status === 'won' || status === 'lost' || status === 'retired';
}

/** Quit/dispose after a decided job must still persist. Mid-run leave stays a discard. */
export function shouldBankOnLeave(status: GameStatus, finished: boolean): boolean {
  return !finished && isTerminalStatus(status);
}

/** Do not claim the record is on disk until bankTerminalRun has run. */
export function clockOutHint(recordPersisted: boolean): string {
  return recordPersisted ? 'Clocked out. Record saved.' : 'Clocked out. Banking the record…';
}

/** Pause must not freeze the post-terminal settle ticker. */
export function pauseBlocksSettle(status: GameStatus): boolean {
  return status === 'playing';
}

export interface BankedRun {
  earned: number;
  firstClear: boolean;
  reward: RunReward;
}

/**
 * Persist stars, remasters, jobs, and rewards for a terminal run.
 * First-clear + chest write as one save (SR-004) via SaveStore.transact.
 */
export function bankTerminalRun(save: SaveStore, game: Game): BankedRun {
  if (game.rewardsClaimed || !isTerminalStatus(game.status)) {
    return { earned: 0, firstClear: false, reward: emptyRunReward() };
  }

  let earned = 0;
  let firstClear = true;
  let reward = emptyRunReward();
  save.transact(() => {
    save.markSeen(game.seen);
    if (game.status === 'won' && !game.endless) {
      if (game.remaster === 'classic') {
        firstClear = save.starsFor(game.map.id) === 0;
        const startLives = isOneLife(game.remaster) ? 1 : Math.max(1, Math.round(game.map.lives * game.difficulty.livesMult));
        earned = starsForClear(game.lives, startLives);
        save.recordClear(game.map.id, game.difficulty.id, earned);
      } else {
        firstClear = !save.remasterCleared(game.map.id, game.remaster);
        if (firstClear) save.recordRemaster(game.map.id, game.remaster);
        earned = firstClear ? 1 : 0;
      }
      save.recordCommendations(game.map.id, game.difficulty.id, game.remaster, earnedCommendations(game));
    } else if (game.status === 'retired' || (game.status === 'lost' && game.endless)) {
      save.recordServiceCall(game.completedWaves);
    }
    if (game.status === 'won' || game.completedWaves > 0 || game.stats.kills > 0) save.recordHeroJob(game.heroDef.id);
    reward = grantRunRewards(save, game, earned, firstClear);
  });
  return { earned, firstClear, reward };
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
  if (game.rewardsClaimed || !isTerminalStatus(game.status)) return emptyRunReward();
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
