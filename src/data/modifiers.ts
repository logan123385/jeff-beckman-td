import type { Modifiers } from './types';

/** Neutral run modifiers — kit/armor affixes stack on top of this. */
export function neutralModifiers(): Modifiers {
  return {
    towerDamage: 1,
    towerCost: 1,
    towerRange: 1,
    jeffHp: 1,
    jeffSpeed: 1,
    jeffDamage: 1,
    cooldown: 1,
    stunDuration: 1,
    startMoney: 0,
    sellRate: 0.7,
    bounty: 1,
    jeffHolds: 0,
    jeffRepair: 1,
    jeffReach: 1,
    jeffRespawn: 1,
    jeffTapEvery: 1,
    heroRate: 1,
    onHitHeat: 0,
    crewHp: 1, crewDamage: 1, crewRespawn: 1,
  };
}
