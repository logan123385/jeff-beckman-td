import type { EnemyId, WaveDef } from './types';
import { grp, wave } from './maps/helpers';

export type NightMutatorId =
  | 'rushHour'
  | 'mineralBloom'
  | 'steamLeak'
  | 'codeBlitz'
  | 'freezeSnap'
  | 'pressureSurge'
  | 'graveyard';

export const NIGHT_MUTATOR_ORDER: NightMutatorId[] = [
  'rushHour',
  'mineralBloom',
  'steamLeak',
  'codeBlitz',
  'freezeSnap',
  'pressureSurge',
  'graveyard',
];

export const NIGHT_MUTATORS: Record<NightMutatorId, { name: string; blurb: string }> = {
  rushHour: { name: 'Rush Hour', blurb: 'Drips come in packs. Keep the valves spinning.' },
  mineralBloom: { name: 'Mineral Bloom', blurb: 'Scale, sludge, and sediment — bring heat and acid.' },
  steamLeak: { name: 'Steam Leak', blurb: 'The air column is full. Vents and cameras earn their keep.' },
  codeBlitz: { name: 'Code Blitz', blurb: 'Violations swap lanes. Two lives if they leak.' },
  freezeSnap: { name: 'Freeze Snap', blurb: 'Ice and glycol. Keep the plant thawed.' },
  pressureSurge: { name: 'Pressure Surge', blurb: 'Spikes and airlocks. Don’t let the valves blow.' },
  graveyard: { name: 'Graveyard Shift', blurb: 'Everything at once. This is why you came back.' },
};

export function nightMutatorAt(waveIndex: number): NightMutatorId {
  return NIGHT_MUTATOR_ORDER[Math.floor(Math.max(0, waveIndex) / 5) % NIGHT_MUTATOR_ORDER.length]!;
}

/** 0-based index inside the procedural stretch, after the scripted opener. */
export function proceduralIndex(waveIndex: number, scriptedCount: number): number {
  return Math.max(0, waveIndex - scriptedCount);
}

/** Mutator for a Night Shift wave, ignoring the scripted opener so Rush Hour is wave 6. */
export function proceduralMutator(waveIndex: number, scriptedCount: number): NightMutatorId {
  return nightMutatorAt(proceduralIndex(waveIndex, scriptedCount));
}

function count(base: number, index: number): number {
  return Math.round(base * (1 + index * 0.11));
}

function boss(index: number): EnemyId {
  if (index > 0 && index % 20 === 19) return 'rogueBoiler';
  if (index > 0 && index % 10 === 9) return 'glycolGolem';
  return 'frozenMain';
}

/** Procedural Night Shift waves after the scripted opener. `index` is 0-based. */
export function generateEndlessWave(index: number, pathCount: number): WaveDef {
  const n = index + 1;
  const p0 = 0;
  const p1 = pathCount > 1 ? 1 : 0;
  const mut = nightMutatorAt(index);
  const c = (base: number) => count(base, index);

  switch (mut) {
    case 'rushHour':
      return wave(
        grp('drip', c(16), 0.48, 0, p0),
        grp('drip', c(12), 0.55, 2, p1),
        grp('hardWaterGnat', c(6), 0.7, 6, p0),
        grp('zincWhisker', c(5), 0.65, 8, p1),
        n % 5 === 0 ? grp('pressureSpike', c(3), 1.8, 10, p1) : grp('sludge', c(2), 2.4, 8, p1),
      );
    case 'mineralBloom':
      return wave(
        grp('scaleCrab', c(7), 1.5, 0, p0),
        grp('sedimentBoulder', c(2), 4.2, 3, p1),
        grp('limeScale', c(3), 2.4, 5, p0),
        grp('biofilm', c(2), 3.2, 7, p1),
        grp('sludge', c(4), 2.2, 6, p0),
        grp('drip', c(10), 0.65, 8, p1),
      );
    case 'steamLeak':
      return wave(
        grp('steamWisp', c(8), 1.15, 0, p0),
        grp('condensateMoth', c(4), 1.8, 2, p1),
        grp('hardWaterGnat', c(8), 0.8, 5, p1),
        grp('vacuumBreak', c(4), 1.6, 7, p0),
        grp('airlock', c(4), 1.7, 8, p0),
      );
    case 'codeBlitz':
      return wave(
        grp('codeViolation', Math.max(1, c(2)), 3.2, 0, p0),
        grp('codeViolation', Math.max(1, c(1)), 3.5, 4, p1),
        grp('drip', c(12), 0.6, 2, p0),
        grp('airlock', c(4), 1.8, 8, p1),
      );
    case 'freezeSnap': {
      const packs = [
        grp('frozenMain', Math.max(1, c(2)), 4.8, 0, p1),
        grp('drip', c(14), 0.55, 3, p0),
        grp('scaleCrab', c(5), 1.6, 10, p1),
      ];
      if (n % 8 === 0) packs.push(grp('glycolGolem', 1, 1, 6, p0));
      return wave(...packs);
    }
    case 'pressureSurge':
      return wave(
        grp('pressureSpike', c(5), 1.6, 0, p0),
        grp('waterHammer', c(3), 1.7, 2, p1),
        grp('airlock', c(5), 1.5, 3, p1),
        grp('drip', c(12), 0.55, 6, p0),
        grp('sedimentBoulder', c(2), 3.8, 10, p1),
      );
    case 'graveyard':
      return wave(
        grp(boss(index), 1, 1, 1, p1),
        grp('drip', c(16), 0.45, 5, p0),
        grp('steamWisp', c(7), 1.2, 8, p1),
        grp('codeViolation', Math.max(1, c(1)), 3, 12, p0),
        grp('condensateMoth', c(3), 1.8, 14, p1),
      );
    default: {
      const _exhaustive: never = mut;
      return _exhaustive;
    }
  }
}
