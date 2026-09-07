import type { TowerDef, TowerId } from './types';

export const TOWERS: Record<TowerId, TowerDef> = {
  torch: {
    id: 'torch',
    name: 'Soldering Torch',
    role: 'Single-target DPS',
    blurb: 'Burns straight through armored scale and thick pipe bosses. Reaches steam too.',
    damageType: 'fire',
    targets: 'both',
    kind: 'shooter',
    color: '#ff9f43',
    levels: [
      { cost: 90, damage: 14, range: 95, fireRate: 2.5 },
      { cost: 80, damage: 24, range: 105, fireRate: 2.5 },
      { cost: 120, damage: 40, range: 115, fireRate: 2.8 },
    ],
  },
  washer: {
    id: 'washer',
    name: 'Pressure Washer',
    role: 'AoE splash',
    blurb: 'Blasts sludge swarms with a wide spray. Ground only — steam just laughs.',
    damageType: 'water',
    targets: 'ground',
    kind: 'shooter',
    projectileSpeed: 280,
    color: '#4fc3f7',
    levels: [
      { cost: 110, damage: 22, range: 110, fireRate: 0.9, splash: 42 },
      { cost: 90, damage: 36, range: 115, fireRate: 0.9, splash: 48 },
      { cost: 140, damage: 58, range: 120, fireRate: 1.0, splash: 55 },
    ],
  },
  barricade: {
    id: 'barricade',
    name: 'Shutoff Valve Barricade',
    role: 'Block / stall',
    blurb: 'Holds ground threats in place so your DPS can work. Low damage, self-repairs when idle.',
    damageType: 'physical',
    targets: 'ground',
    kind: 'barricade',
    color: '#e74c3c',
    levels: [
      { cost: 60, damage: 6, range: 34, fireRate: 1.2, hp: 260, holds: 2 },
      { cost: 60, damage: 9, range: 36, fireRate: 1.2, hp: 420, holds: 3 },
      { cost: 90, damage: 13, range: 38, fireRate: 1.4, hp: 640, holds: 4 },
    ],
  },
  vent: {
    id: 'vent',
    name: 'Vent Stack',
    role: 'Anti-air',
    blurb: 'Air separator that snipes steam wisps out of the sky. Weak against anything on the ground.',
    damageType: 'physical',
    targets: 'both',
    groundMult: 0.35,
    kind: 'shooter',
    projectileSpeed: 440,
    color: '#b0bec5',
    levels: [
      { cost: 100, damage: 18, range: 130, fireRate: 2.0 },
      { cost: 80, damage: 30, range: 138, fireRate: 2.0 },
      { cost: 120, damage: 48, range: 145, fireRate: 2.2 },
    ],
  },
  radiant: {
    id: 'radiant',
    name: 'Radiant Loop Coil',
    role: 'Slow / zone control',
    blurb: 'Hydronic loop that turns a stretch of pipe into a sticky slow zone and keeps nearby towers thawed.',
    damageType: 'heat',
    targets: 'ground',
    kind: 'aura',
    color: '#ff7043',
    levels: [
      { cost: 100, damage: 4, range: 80, fireRate: 1, slow: 0.35 },
      { cost: 80, damage: 8, range: 90, fireRate: 1, slow: 0.45 },
      { cost: 120, damage: 14, range: 100, fireRate: 1, slow: 0.55 },
    ],
  },
  expansion: {
    id: 'expansion',
    name: 'Expansion Tank',
    role: 'Utility / support',
    blurb: 'Buffs nearby towers and soaks up one surge — a freeze or pressure hit — every so often.',
    damageType: 'physical',
    targets: 'both',
    kind: 'aura',
    color: '#ffd54f',
    levels: [
      { cost: 150, damage: 0, range: 90, fireRate: 0, dmgBuff: 0.15, rangeBuff: 0.1, shieldCooldown: 15 },
      { cost: 100, damage: 0, range: 100, fireRate: 0, dmgBuff: 0.25, rangeBuff: 0.15, shieldCooldown: 12 },
      { cost: 150, damage: 0, range: 110, fireRate: 0, dmgBuff: 0.35, rangeBuff: 0.2, shieldCooldown: 8 },
    ],
  },
};

export const TOWER_ORDER: TowerId[] = ['torch', 'washer', 'barricade', 'vent', 'radiant', 'expansion'];

export const BARRICADE_REGEN_PER_SEC = 12;
export const BARRICADE_REBUILD_SECONDS = 8;
