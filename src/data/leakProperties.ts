import type { NightMutatorId } from './night';
import type { EnemyId, LeakProperty } from './types';

export const LEAK_PROPERTIES: LeakProperty[] = ['mineral', 'cast', 'regen', 'pressurized'];

export const PROPERTY_LABEL: Record<LeakProperty, string> = {
  mineral: 'Mineral-lined',
  cast: 'Cast-iron',
  regen: 'Biofilm',
  pressurized: 'Pressurized',
};

export const PROPERTY_HINT: Record<LeakProperty, string> = {
  mineral: 'Washer spray beads off. Torch, hammer, and descaler still eat the scale.',
  cast: 'A ceramic jacket of extra HP. When the shell cracks the inner leak keeps walking — and some mains still split when the body finally pops.',
  regen: 'Knits itself back together unless fire or heat cauterizes it.',
  pressurized: 'Fortified HP and a fatter bounty. Stacks with the other tags.',
};

export const PROPERTY_COLOR: Record<LeakProperty, string> = {
  mineral: '#d7ccc8',
  cast: '#6d4c41',
  regen: '#81c784',
  pressurized: '#ef6c00',
};

const MINERAL_TYPES: readonly EnemyId[] = ['scaleCrab', 'limeScale', 'sedimentBoulder'];
const REGEN_TYPES: readonly EnemyId[] = ['sludge', 'biofilm'];
const CAST_TYPES: readonly EnemyId[] = ['flangeGremlin', 'sedimentBoulder', 'frozenMain', 'glycolGolem'];
const PRESSURE_TYPES: readonly EnemyId[] = [
  'pressureSpike',
  'waterHammer',
  'sedimentBoulder',
  'rogueBoiler',
  'glycolGolem',
  'frozenMain',
];

/** Bloons-style stacked flags. Camo/invis is intentionally not a property. */
export function propertiesFor(
  enemy: EnemyId,
  waveIdx: number,
  mutator: NightMutatorId | null,
  explicit: readonly LeakProperty[] = [],
): LeakProperty[] {
  const out = new Set<LeakProperty>(explicit);
  if (waveIdx >= 4 && MINERAL_TYPES.includes(enemy)) out.add('mineral');
  if (waveIdx >= 5 && REGEN_TYPES.includes(enemy)) out.add('regen');
  if (waveIdx >= 7 && CAST_TYPES.includes(enemy)) out.add('cast');
  if (waveIdx >= 6 && PRESSURE_TYPES.includes(enemy)) out.add('pressurized');

  if (mutator === 'mineralBloom') {
    if (MINERAL_TYPES.includes(enemy) || enemy === 'sludge' || enemy === 'limeScale') out.add('mineral');
    if (waveIdx >= 12 && enemy !== 'zincWhisker' && enemy !== 'hardWaterGnat') out.add('pressurized');
  }
  if (mutator === 'freezeSnap' && (enemy === 'frozenMain' || enemy === 'glycolGolem')) {
    out.add('cast');
    out.add('pressurized');
  }
  if (mutator === 'graveyard') {
    if (MINERAL_TYPES.includes(enemy)) {
      out.add('mineral');
      out.add('cast');
    }
    if (REGEN_TYPES.includes(enemy)) out.add('regen');
    if (!['drip', 'zincWhisker', 'hardWaterGnat', 'steamWisp'].includes(enemy)) out.add('pressurized');
  }
  if (waveIdx >= 18) {
    if (MINERAL_TYPES.includes(enemy)) out.add('mineral');
    if (REGEN_TYPES.includes(enemy)) out.add('regen');
    if (enemy === 'drip' && mutator) out.add('regen');
  }
  return LEAK_PROPERTIES.filter((p) => out.has(p));
}

export function inheritProperties(props: readonly LeakProperty[]): LeakProperty[] {
  return props.filter((p) => p !== 'cast');
}

export function partsForKill(boss: boolean, bounty: number, pressurized: boolean): number {
  let n = 1;
  if (boss) n = 4;
  else if (bounty >= 20) n = 3;
  else if (bounty >= 10) n = 2;
  if (pressurized) n += 1;
  return n;
}
