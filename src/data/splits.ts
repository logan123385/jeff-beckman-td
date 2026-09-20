import { ENEMIES } from './enemies';
import type { EnemyId, LeakProperty } from './types';

export interface SplitDef {
  child: EnemyId;
  count: number;
}

/**
 * Bloons-style layered pops. The parent layer dies, the children keep walking.
 * Early drips and sludge never split — Crawlspace stays a teaching call.
 */
export const SPLITS: Partial<Record<EnemyId, SplitDef>> = {
  flangeGremlin: { child: 'drip', count: 2 },
  scaleCrab: { child: 'drip', count: 2 },
  limeScale: { child: 'scaleCrab', count: 2 },
  sedimentBoulder: { child: 'limeScale', count: 2 },
  biofilm: { child: 'sludge', count: 2 },
  frozenMain: { child: 'scaleCrab', count: 2 },
  glycolGolem: { child: 'frozenMain', count: 2 },
  rogueBoiler: { child: 'flangeGremlin', count: 3 },
  condensateMoth: { child: 'steamWisp', count: 2 },
};

export function splitOf(id: EnemyId): SplitDef | undefined {
  return SPLITS[id];
}

/** Pressurized mains shed one extra child, like a fortified ceramic. */
export function splitCount(id: EnemyId, pressurized: boolean): number {
  const def = SPLITS[id];
  if (!def) return 0;
  return def.count + (pressurized ? 1 : 0);
}

export function inheritSplitProperties(props: readonly LeakProperty[]): LeakProperty[] {
  return props.filter((p) => p !== 'cast' && p !== 'pressurized');
}

/** Lives lost if this leak walks off the job, including children that never get a chance to pop. */
export function leakRbe(id: EnemyId, pressurized = false, seen: readonly EnemyId[] = []): number {
  const self = ENEMIES[id].livesCost;
  if (seen.includes(id)) return self;
  const def = SPLITS[id];
  if (!def) return self;
  const n = def.count + (pressurized ? 1 : 0);
  return self + n * leakRbe(def.child, false, [...seen, id]);
}

export function splitPreview(
  id: EnemyId,
  count: number,
  pressurized = false,
): { child: EnemyId; count: number } | null {
  const def = SPLITS[id];
  if (!def) return null;
  return { child: def.child, count: count * splitCount(id, pressurized) };
}

export function splitLine(id: EnemyId, pressurized = false): string | null {
  const def = SPLITS[id];
  if (!def) return null;
  const n = splitCount(id, pressurized);
  return `${ENEMIES[id].name} → ${n} ${ENEMIES[def.child].name}`;
}

/** Lives on the line if every leak in this preview walks off, including children. */
export function previewRbe(
  entries: readonly { enemy: EnemyId; count: number; properties: readonly LeakProperty[] }[],
): number {
  return entries.reduce((sum, p) => sum + p.count * leakRbe(p.enemy, p.properties.includes('pressurized')), 0);
}

/** Lives on the pipe right now, including children still inside living parents and leaks still queued. */
export function fieldRbe(
  living: readonly { id: EnemyId; pressurized: boolean }[],
  queued: readonly { enemy: EnemyId; remaining: number; properties: readonly LeakProperty[] }[] = [],
): number {
  let n = 0;
  for (const e of living) n += leakRbe(e.id, e.pressurized);
  for (const s of queued) n += s.remaining * leakRbe(s.enemy, s.properties.includes('pressurized'));
  return n;
}

export const SPLIT_CHAIN: { parent: EnemyId; label: string }[] = [
  { parent: 'scaleCrab', label: 'Scale Crab → 2 Drips' },
  { parent: 'flangeGremlin', label: 'Flange Gremlin → 2 Drips' },
  { parent: 'limeScale', label: 'Lime Scale → 2 Scale Crabs' },
  { parent: 'sedimentBoulder', label: 'Sediment Boulder → 2 Lime Scale' },
  { parent: 'biofilm', label: 'Biofilm Mat → 2 Sludge' },
  { parent: 'frozenMain', label: 'Frozen Main → 2 Scale Crabs' },
  { parent: 'glycolGolem', label: 'Glycol Golem → 2 Frozen Mains' },
  { parent: 'condensateMoth', label: 'Condensate Moth → 2 Steam Wisps' },
  { parent: 'rogueBoiler', label: 'Rogue Boiler → 3 Flange Gremlins' },
];
