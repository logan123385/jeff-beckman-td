import type { TowerDef, TowerId, TowerLevel } from './types';

export type Specialization = 'power' | 'control';
const NAMES: Record<TowerId, [string, string]> = {
  torch: ['Dragonfire Forge', 'Ember Sentinel'], washer: ['Tidal Artillery', 'Frostjet Battery'],
  barricade: ['Ironclad Workshop', 'Field Medic Lodge'], vent: ['Stormwatch Spire', 'Skybreaker Array'],
  radiant: ['Sunfire Crucible', 'Winter Ward'], expansion: ['Overpressure Shrine', 'Guardian Reservoir'],
  pipeSnake: ['Worldbreaker Auger', 'Serpent Watch'], backflow: ['Undertow Engine', 'Tidekeeper'],
  descaler: ['Alchemist’s Wrath', 'Corrosion Watch'], circulator: ['Turbine Citadel', 'Flowkeeper'],
  prv: ['Thunderhead Valve', 'Pressure Warden'], boiler: ['Inferno Foundry', 'Hearthkeeper'],
  hammerDrill: ['Earthshatter Engine', 'Siege Surveyor'], glycol: ['Glacier Heart', 'Frost Warden'],
  sump: ['Maelstrom Well', 'Deepwater Watch'], camera: ['All-seeing Beacon', 'Surveyor’s Keep'],
  manifold: ['Hydra Battery', 'Crossfire Command'], mixingValve: ['Thermal Reactor', 'Balance Shrine'],
  airSeparator: ['Cyclone Engine', 'Windkeeper'], thermostat: ['Command Furnace', 'Clockwork Council'],
  heatExchanger: ['Phoenix Engine', 'Thermal Sentinel'], dirtSep: ['Bedrock Crusher', 'Sediment Watch'],
  steamTrap: ['Vapor Cannon', 'Mistkeeper'], zoneValve: ['Ironbound Gate', 'Flow Sentinel'],
};

export function specializationInfo(def: TowerDef, choice: Specialization): { name: string; description: string; cost: number } {
  const name = NAMES[def.id][choice === 'power' ? 0 : 1];
  let description: string;
  if (def.kind === 'barricade') description = choice === 'power'
    ? '+70% durability, +60% damage, holds 2 extra enemies.'
    : '+25% reach and damage, +20% durability, 1 extra hold. Repairs itself and heals nearby Jeff.';
  else if (def.kind === 'aura') description = choice === 'power'
    ? '+45% damage and support strength. +15% area.'
    : '+30% area. Every 7s, stuns up to 3 enemies and strips armor.';
  else description = choice === 'power'
    ? '+55% damage, +30% splash. A heavy hitter with 8% less reach.'
    : '+20% reach and fire rate. Every 7s, stuns up to 3 enemies and strips armor. −10% damage.';
  if (def.id === 'camera' && choice === 'power') description = 'Marked enemies take 38% extra damage instead of 20%. +15% area.';
  return { name, description, cost: Math.round(140 + def.levels[2].cost * 0.8) };
}

/** Clone every level: one pad's investment must never change another pad or the catalogue. */
export function specializeDef(def: TowerDef, choice: Specialization): TowerDef {
  const levels = def.levels.map((l): TowerLevel => ({ ...l })) as TowerDef['levels'];
  for (const l of levels.slice(2)) {
  if (def.kind === 'barricade') {
    l.hp = Math.round((l.hp ?? 0) * (choice === 'power' ? 1.7 : 1.2));
    l.holds = (l.holds ?? 0) + (choice === 'power' ? 2 : 1);
    l.damage *= choice === 'power' ? 1.6 : 1.25;
    if (choice === 'control') l.range *= 1.25;
  } else if (def.kind === 'aura') {
    l.range *= choice === 'power' ? 1.15 : 1.3;
    if (choice === 'power') {
      l.damage *= 1.45;
      for (const key of ['dmgBuff', 'rangeBuff', 'rateBuff', 'push', 'pull'] as const) if (l[key]) l[key] *= 1.45;
      if (l.jeffHaste) l.jeffHaste = 1 + (l.jeffHaste - 1) * 1.45;
      if (l.projSpeed) l.projSpeed = 1 + (l.projSpeed - 1) * 1.45;
      if (l.shieldCooldown) l.shieldCooldown /= 1.45;
      if (l.slow) l.slow = Math.min(0.8, l.slow * 1.2);
      if (l.shred) l.shred *= 1.45;
    }
  } else {
    l.damage *= choice === 'power' ? 1.55 : 0.9;
    l.range *= choice === 'power' ? 0.92 : 1.2;
    if (choice === 'control') l.fireRate *= 1.2;
    if (choice === 'power' && l.splash) l.splash *= 1.3;
    if (l.pierce) l.pierce *= choice === 'power' ? 0.92 : 1.2;
  }
  }
  return { ...def, name: specializationInfo(def, choice).name, levels };
}
