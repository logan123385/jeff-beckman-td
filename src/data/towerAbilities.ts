import type { TowerId } from './types';

export interface TowerAbilityDef {
  name: string;
  blurb: string;
  /** Seconds after a successful fire. */
  cooldown: number;
  /** Spare-parts cost. */
  parts: number;
  /** Tower.level index that unlocks the button (1 = Reinforced). */
  minLevel: number;
}

/** Activated tools, Bloons-style. Unlocked on the second kit. */
export const TOWER_ABILITIES: Partial<Record<TowerId, TowerAbilityDef>> = {
  torch: { name: 'Cut-in', blurb: 'Fire dump on the toughest leak in range, plus splash.', cooldown: 28, parts: 3, minLevel: 1 },
  washer: { name: 'Full Flush', blurb: 'A wide pressure blast. Slows the pack.', cooldown: 32, parts: 4, minLevel: 1 },
  barricade: { name: 'Crew Lockdown', blurb: 'Stun every enemy held by this apprentice squad.', cooldown: 30, parts: 3, minLevel: 1 },
  vent: { name: 'Draft', blurb: 'Yank flying leaks and clip their wings.', cooldown: 26, parts: 3, minLevel: 1 },
  radiant: { name: 'Overheat', blurb: 'Slow nova. Thaws neighboring tools.', cooldown: 30, parts: 3, minLevel: 1 },
  pipeSnake: { name: 'Rod Whip', blurb: 'Auger pulse down the pipe itself.', cooldown: 28, parts: 3, minLevel: 1 },
  backflow: { name: 'Slam Shut', blurb: 'Shove the ground wave a long way backward.', cooldown: 30, parts: 4, minLevel: 1 },
  descaler: { name: 'Soak', blurb: 'Drench the pad. Heavy shred and acid linger.', cooldown: 28, parts: 3, minLevel: 1 },
  circulator: { name: 'Surge', blurb: 'Nearby tools shoot faster for a few seconds.', cooldown: 36, parts: 4, minLevel: 1 },
  prv: { name: 'Pop-off', blurb: 'Dump the relief burst right now.', cooldown: 22, parts: 3, minLevel: 1 },
  boiler: { name: 'Relief Dump', blurb: 'A fat heat nova. Cooks the choke.', cooldown: 40, parts: 5, minLevel: 1 },
  hammerDrill: { name: 'Core Sample', blurb: 'One brutal hit. Loves mineral and cast-iron jackets.', cooldown: 26, parts: 3, minLevel: 1 },
  glycol: { name: 'Glycol Dump', blurb: 'Heat-transfer dump. Melts ice and thaws the plant.', cooldown: 30, parts: 3, minLevel: 1 },
  sump: { name: 'Emergency Pump', blurb: 'Hard pull toward the basin.', cooldown: 28, parts: 3, minLevel: 1 },
  camera: { name: 'Snapshot', blurb: 'Paint every leak in view. Marked targets take extra.', cooldown: 24, parts: 2, minLevel: 1 },
  thermostat: { name: 'Kick', blurb: 'Call for heat. Fire-rate pulse on the pad.', cooldown: 34, parts: 4, minLevel: 1 },
  dirtSep: { name: 'Grit Dump', blurb: 'Mineral splash across the ground run.', cooldown: 28, parts: 3, minLevel: 1 },
  zoneValve: { name: 'Lock', blurb: 'Stun the zone for a beat.', cooldown: 26, parts: 3, minLevel: 1 },
};

export function towerAbility(id: TowerId): TowerAbilityDef | undefined {
  return TOWER_ABILITIES[id];
}
