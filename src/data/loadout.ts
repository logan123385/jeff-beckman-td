import { TOWER_ORDER } from './towers';
import type { RemasterId, TowerId } from './types';
import type { MapDef } from './types';
import type { SaveStore } from '../save/save';

/** Kingdom Rush-style kit size. Early jobs with fewer tools just fill the bag. */
export const LOADOUT_SIZE = 5;

/** Tools Jeff has on the truck — permanent licenses bought from the Supply Store. */
export function unlockedTowers(save: SaveStore): TowerId[] {
  return TOWER_ORDER.filter(id => save.data.ownedTowers.includes(id));
}

/** What you may pack for this specific call (owned licenses, minus inspection bans). */
export function availableTowers(save: SaveStore, map: MapDef, remaster: RemasterId): TowerId[] {
  const banned = remaster === 'codeInspection' ? (map.inspectionBan ?? []) : [];
  const unlocked = new Set(unlockedTowers(save));
  return TOWER_ORDER.filter((id) => unlocked.has(id) && !banned.includes(id));
}

export function loadoutCap(available: readonly TowerId[]): number {
  return Math.min(LOADOUT_SIZE, available.length);
}

/** Keep legal picks, then top up from the available list so a run always has a kit. */
export function resolveLoadout(picked: readonly TowerId[] | undefined, available: readonly TowerId[]): TowerId[] {
  const cap = loadoutCap(available);
  const chosen: TowerId[] = [];
  for (const id of picked ?? []) {
    if (available.includes(id) && !chosen.includes(id)) chosen.push(id);
    if (chosen.length >= cap) break;
  }
  for (const id of available) {
    if (chosen.length >= cap) break;
    if (!chosen.includes(id)) chosen.push(id);
  }
  return chosen;
}
