import type { EnemyId, LeakProperty, SpawnGroup, WaveDef } from '../types';

export function grp(
  enemy: EnemyId,
  count: number,
  interval: number,
  delay = 0,
  path = 0,
  properties?: LeakProperty[],
): SpawnGroup {
  return { enemy, count, interval, delay, path, properties };
}

export function wave(...groups: SpawnGroup[]): WaveDef {
  return { groups };
}

/** Seconds between packed parents so they walk as a wall, not a trickle. */
export const RUSH_GAP: Partial<Record<EnemyId, number>> = {
  drip: 0.2,
  sludge: 0.28,
  scaleCrab: 0.3,
  flangeGremlin: 0.28,
  limeScale: 0.36,
  frozenMain: 0.5,
  sedimentBoulder: 0.62,
  biofilm: 0.4,
  glycolGolem: 1.05,
  condensateMoth: 0.34,
  steamWisp: 0.26,
  hardWaterGnat: 0.22,
  zincWhisker: 0.24,
};

/** Packed spawn group — interval comes from the leak, not the caller. */
export function pack(
  enemy: EnemyId,
  count: number,
  delay = 0,
  path = 0,
  properties?: LeakProperty[],
): SpawnGroup {
  return grp(enemy, count, RUSH_GAP[enemy] ?? 0.3, delay, path, properties);
}

/** Mark the whole wave as a rush so HUD, banners, and pipe glow tell the truth. */
export function rush(...groups: SpawnGroup[]): WaveDef {
  return { groups, rush: true };
}