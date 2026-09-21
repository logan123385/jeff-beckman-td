import type { TowerId } from './types';

export type SpecialistAbilityId = 'incinerate' | 'barrage' | 'deadeye' | 'chain' | 'freeze' | 'corrode' | 'mend' | 'overclock' | 'shockwave' | 'expose';
export interface SpecialistAbilityDef {
  id: SpecialistAbilityId;
  name: string;
  glyph: string;
  color: string;
  cost: number;
  cooldown: number;
  description(rank: number): string;
}

/** Purchased per building. Abilities add a behavior, never mutate the shared tower catalogue. */
export const SPECIALIST_ABILITIES: Record<SpecialistAbilityId, SpecialistAbilityDef> = {
  incinerate: { id: 'incinerate', name: 'Afterburner', glyph: '✦', color: '#ffb267', cost: 130, cooldown: 9,
    description: r => `Ignite one target for ${18 * r} fire damage/s for 4s. Ignores armor. Every 9s.` },
  barrage: { id: 'barrage', name: 'Pressure Bomb', glyph: '◉', color: '#8de3f4', cost: 140, cooldown: 10,
    description: r => `Blast a cluster for ${55 * r} damage in a ${50 + 8 * r}px radius. Every 10s.` },
  deadeye: { id: 'deadeye', name: 'Deadeye', glyph: '⌖', color: '#ffe5a1', cost: 150, cooldown: 11,
    description: r => `Strike the toughest target for ${125 * r} damage at 125% range. Every 11s.` },
  chain: { id: 'chain', name: 'Arc Flash', glyph: 'ϟ', color: '#c6bdff', cost: 145, cooldown: 10,
    description: r => `Arc between ${r + 2} nearby enemies for ${35 * r} heat damage each. Every 10s.` },
  freeze: { id: 'freeze', name: 'Cold Snap', glyph: '❄', color: '#a3ebfa', cost: 130, cooldown: 12,
    description: r => `Freeze up to ${r + 1} targets for ${(1 + r * .5).toFixed(1)}s. Bosses resist the stun. Every 12s.` },
  corrode: { id: 'corrode', name: 'Strip the Shell', glyph: '◇', color: '#bee480', cost: 125, cooldown: 8,
    description: r => `Remove ${20 + r * 15}% armor from up to 3 enemies for 6s. Every 8s.` },
  mend: { id: 'mend', name: 'Field Hospital', glyph: '+', color: '#bde8a0', cost: 130, cooldown: 10,
    description: r => `Restore ${45 * r} HP to nearby crew, hero and barricades. Never revives fallen units. Every 10s.` },
  overclock: { id: 'overclock', name: 'Overtime', glyph: '»', color: '#ffe096', cost: 150, cooldown: 13,
    description: r => `Nearby defenses attack ${20 * r}% faster for 5s. Does not stack with another Overtime. Every 13s.` },
  shockwave: { id: 'shockwave', name: 'Groundbreaker', glyph: '≋', color: '#efc593', cost: 140, cooldown: 11,
    description: r => `Hit ground enemies for ${45 * r} physical damage and push them back ${15 * r}px. Bosses resist displacement. Every 11s.` },
  expose: { id: 'expose', name: 'Fault Finder', glyph: '◎', color: '#b3f3d5', cost: 125, cooldown: 9,
    description: r => `Reveal up to ${r + 2} enemies and make them take ${15 + r * 10}% more damage for 5s. Every 9s.` },
};

export const SPECIALIST_KITS: Record<TowerId, readonly [SpecialistAbilityId, SpecialistAbilityId]> = {
  torch: ['incinerate', 'chain'], washer: ['barrage', 'freeze'], barricade: ['mend', 'shockwave'],
  vent: ['deadeye', 'chain'], radiant: ['incinerate', 'freeze'], expansion: ['mend', 'overclock'],
  pipeSnake: ['shockwave', 'corrode'], backflow: ['barrage', 'freeze'], descaler: ['corrode', 'incinerate'],
  circulator: ['overclock', 'mend'], prv: ['barrage', 'shockwave'], boiler: ['incinerate', 'barrage'],
  hammerDrill: ['deadeye', 'shockwave'], glycol: ['freeze', 'corrode'], sump: ['shockwave', 'barrage'],
  camera: ['expose', 'deadeye'], manifold: ['chain', 'barrage'], mixingValve: ['freeze', 'mend'],
  airSeparator: ['chain', 'expose'], thermostat: ['overclock', 'expose'], heatExchanger: ['chain', 'incinerate'],
  dirtSep: ['corrode', 'barrage'], steamTrap: ['deadeye', 'freeze'], zoneValve: ['freeze', 'overclock'],
};

export function specialistAbilityCost(id: SpecialistAbilityId, currentRank: number, costMultiplier = 1): number {
  return Math.round(SPECIALIST_ABILITIES[id].cost * (1 + currentRank * .65) * costMultiplier);
}
