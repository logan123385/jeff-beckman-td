import { HERO_ORDER, type HeroId } from './heroes';
import type { DamageType, Rarity, WeaponStance } from './types';
export type WeaponFamilyId = `${HeroId}_${WeaponStance}`;

export interface AttackProfile {
  family: WeaponFamilyId;
  hero: HeroId;
  stance: WeaponStance;
  reach: number;
  damage: number;
  attackRate: number;
  holds: number;
  air: boolean;
  damageType: DamageType;
  basic: 'contact' | 'missile' | 'laser';
  missile?: 'plunger' | 'golf' | 'tater' | 'hook' | 'hose' | 'rebar' | 'bell';
  pierce: number;
  bounce: number;
  splash: number;
  splashRadius: number;
  pull: number;
  stun: number;
  stunChance: number;
  shred: number;
  tapStunEvery: number | null;
}

const RARITY_ORDER: Rarity[] = ['common', 'uncommon', 'rare', 'relic'];

type FamilyBase = Omit<AttackProfile, 'family' | 'hero' | 'stance'>;

const FAMILY_BASE: Record<WeaponFamilyId, FamilyBase> = {
  jeff_melee: {
    reach: 42, damage: 22, attackRate: 1.35, holds: 2, air: false, damageType: 'physical',
    basic: 'contact', pierce: 0, bounce: 0, splash: 0, splashRadius: 0, pull: 0,
    stun: 0, stunChance: 0, shred: 0, tapStunEvery: null,
  },
  jeff_ranged: {
    reach: 170, damage: 18, attackRate: 1.10, holds: 0, air: true, damageType: 'water',
    basic: 'missile', missile: 'hose', pierce: 0, bounce: 0, splash: 0, splashRadius: 0, pull: 0,
    stun: 0, stunChance: 0, shred: 0, tapStunEvery: null,
  },
  mike_melee: {
    reach: 44, damage: 28, attackRate: 1.05, holds: 2, air: false, damageType: 'physical',
    basic: 'contact', pierce: 0, bounce: 0, splash: 0, splashRadius: 0, pull: 0,
    stun: 0, stunChance: 0, shred: 0, tapStunEvery: null,
  },
  mike_ranged: {
    reach: 195, damage: 39, attackRate: 0.85, holds: 1, air: true, damageType: 'physical',
    basic: 'missile', missile: 'plunger', pierce: 0, bounce: 0, splash: 0, splashRadius: 0, pull: 0,
    stun: 0, stunChance: 0, shred: 0, tapStunEvery: null,
  },
  bob_melee: {
    reach: 40, damage: 24, attackRate: 1.20, holds: 1, air: false, damageType: 'heat',
    basic: 'contact', pierce: 0, bounce: 0, splash: 0, splashRadius: 0, pull: 0,
    stun: 0, stunChance: 0, shred: 0, tapStunEvery: null,
  },
  bob_ranged: {
    reach: 175, damage: 27, attackRate: 1.18, holds: 1, air: true, damageType: 'heat',
    basic: 'laser', pierce: 0, bounce: 0, splash: 0, splashRadius: 0, pull: 0,
    stun: 0, stunChance: 0, shred: 0, tapStunEvery: null,
  },
  chris_melee: {
    reach: 44, damage: 19, attackRate: 1.65, holds: 2, air: false, damageType: 'physical',
    basic: 'contact', pierce: 0, bounce: 0, splash: 0, splashRadius: 0, pull: 0,
    stun: 0, stunChance: 0, shred: 0, tapStunEvery: null,
  },
  chris_ranged: {
    reach: 165, damage: 21, attackRate: 1.00, holds: 0, air: true, damageType: 'physical',
    basic: 'missile', missile: 'golf', pierce: 0, bounce: 0, splash: 0, splashRadius: 0, pull: 0,
    stun: 0, stunChance: 0, shred: 0, tapStunEvery: null,
  },
  becbec_melee: {
    reach: 43, damage: 32, attackRate: 1.18, holds: 3, air: false, damageType: 'physical',
    basic: 'contact', pierce: 0, bounce: 0, splash: 0, splashRadius: 0, pull: 0,
    stun: 0.35, stunChance: 0, shred: 0, tapStunEvery: 3,
  },
  becbec_ranged: {
    reach: 160, damage: 26, attackRate: 1.05, holds: 0, air: true, damageType: 'physical',
    basic: 'missile', missile: 'rebar', pierce: 0, bounce: 0, splash: 0, splashRadius: 0, pull: 0,
    stun: 0, stunChance: 0, shred: 0, tapStunEvery: null,
  },
  cbj_melee: {
    reach: 46, damage: 30, attackRate: 0.95, holds: 2, air: false, damageType: 'physical',
    basic: 'contact', pierce: 0, bounce: 0, splash: 0, splashRadius: 0, pull: 0,
    stun: 0, stunChance: 0, shred: 0, tapStunEvery: null,
  },
  cbj_ranged: {
    reach: 155, damage: 28, attackRate: 1.00, holds: 1, air: true, damageType: 'physical',
    basic: 'missile', missile: 'tater', pierce: 0, bounce: 0, splash: 0, splashRadius: 0, pull: 0,
    stun: 0, stunChance: 0, shred: 0, tapStunEvery: null,
  },
  doni_melee: {
    reach: 52, damage: 22, attackRate: 1.15, holds: 2, air: false, damageType: 'physical',
    basic: 'contact', pierce: 0, bounce: 0, splash: 0, splashRadius: 0, pull: 0,
    stun: 0, stunChance: 0, shred: 0, tapStunEvery: null,
  },
  doni_ranged: {
    reach: 170, damage: 24, attackRate: 1.10, holds: 1, air: true, damageType: 'physical',
    basic: 'missile', missile: 'hook', pierce: 0, bounce: 0, splash: 0, splashRadius: 0, pull: 0,
    stun: 0, stunChance: 0, shred: 0, tapStunEvery: null,
  },
  jayjay_melee: {
    reach: 48, damage: 42, attackRate: 0.83, holds: 4, air: false, damageType: 'physical',
    basic: 'contact', pierce: 0, bounce: 0, splash: 0, splashRadius: 0, pull: 0,
    stun: 0.35, stunChance: 0, shred: 0, tapStunEvery: 3,
  },
  jayjay_ranged: {
    reach: 150, damage: 34, attackRate: 0.90, holds: 0, air: true, damageType: 'physical',
    basic: 'missile', missile: 'bell', pierce: 0, bounce: 0, splash: 0, splashRadius: 0, pull: 0,
    stun: 0.4, stunChance: 0, shred: 0, tapStunEvery: null,
  },
};

const DEFAULT_FAMILY: Record<HeroId, WeaponFamilyId> = {
  jeff: 'jeff_melee',
  mike: 'mike_ranged',
  bob: 'bob_ranged',
  chris: 'chris_melee',
  becbec: 'becbec_melee',
  cbj: 'cbj_ranged',
  doni: 'doni_ranged',
  jayjay: 'jayjay_melee',
};

const HOLD_IMPLICIT: Partial<Record<WeaponFamilyId, readonly [number, number, number, number]>> = {
  jeff_melee: [0, 0, 1, 1],
  mike_melee: [1, 1, 1, 2],
  becbec_melee: [0, 0, 1, 1],
  jayjay_melee: [0, 1, 1, 2],
};

const PIERCE_IMPLICIT: Partial<Record<WeaponFamilyId, readonly [number, number, number, number]>> = {
  jeff_ranged: [1, 1, 2, 2],
  becbec_ranged: [1, 1, 2, 2],
};

const REACH_IMPLICIT: Partial<Record<WeaponFamilyId, readonly [number, number, number, number]>> = {
  mike_ranged: [10, 16, 24, 34],
  doni_melee: [6, 10, 16, 24],
};

const BOUNCE_IMPLICIT: Partial<Record<WeaponFamilyId, readonly [number, number, number, number]>> = {
  chris_ranged: [1, 1, 2, 2],
};

const PULL_IMPLICIT: Partial<Record<WeaponFamilyId, readonly [number, number, number, number]>> = {
  doni_ranged: [8, 12, 18, 26],
};

const STUN_CHANCE_IMPLICIT: Partial<Record<WeaponFamilyId, readonly [number, number, number, number]>> = {
  bob_melee: [0.10, 0.15, 0.22, 0.30],
};

const BOB_RANGED_HEAT: readonly [number, number, number, number] = [0.06, 0.10, 0.16, 0.24];

const SHRED_IMPLICIT: Partial<Record<WeaponFamilyId, readonly [number, number, number, number]>> = {
  chris_melee: [0.08, 0.12, 0.16, 0.22],
};

const SPLASH_IMPLICIT: Partial<Record<WeaponFamilyId, readonly [number, number, number, number]>> = {
  cbj_melee: [20, 28, 40, 55],
};

const SPLASH_RADIUS_IMPLICIT: Partial<Record<WeaponFamilyId, readonly [number, number, number, number]>> = {
  cbj_ranged: [8, 12, 18, 26],
};

const STUN_IMPLICIT: Partial<Record<WeaponFamilyId, readonly [number, number, number, number]>> = {
  jayjay_ranged: [0.4, 0.5, 0.65, 0.85],
};

function rarityIndex(rarity: Rarity): number {
  return RARITY_ORDER.indexOf(rarity);
}

function parseFamily(family: WeaponFamilyId): { hero: HeroId; stance: WeaponStance } {
  const idx = family.lastIndexOf('_');
  const hero = family.slice(0, idx) as HeroId;
  const stance = family.slice(idx + 1) as WeaponStance;
  return { hero, stance };
}

const FAMILY_LABEL: Record<WeaponFamilyId, string> = {
  jeff_melee: 'Pipe Wrench',
  jeff_ranged: 'Pressure Wand',
  mike_melee: 'Tire Iron',
  mike_ranged: 'Plunger Javelin',
  bob_melee: 'Shock Prod',
  bob_ranged: 'Hand Cannon',
  chris_melee: 'Recip Saw',
  chris_ranged: 'Golf Iron',
  becbec_melee: 'Work Gloves',
  becbec_ranged: 'Rebar Darts',
  cbj_melee: 'Spud Masher',
  cbj_ranged: 'Tater Cannon',
  doni_melee: 'Gaff',
  doni_ranged: 'Casting Rig',
  jayjay_melee: 'Ring Fists',
  jayjay_ranged: 'Bell Plate',
};

export function familyLabel(family: WeaponFamilyId): string {
  return FAMILY_LABEL[family];
}

export function defaultFamily(hero: HeroId): WeaponFamilyId {
  return DEFAULT_FAMILY[hero];
}

export function familyHero(family: WeaponFamilyId): HeroId {
  return parseFamily(family).hero;
}

export function familyStance(family: WeaponFamilyId): WeaponStance {
  return parseFamily(family).stance;
}

export function isWeaponFamilyId(id: string): id is WeaponFamilyId {
  const idx = id.lastIndexOf('_');
  if (idx <= 0) return false;
  const hero = id.slice(0, idx);
  const stance = id.slice(idx + 1);
  if (stance !== 'melee' && stance !== 'ranged') return false;
  return (HERO_ORDER as readonly string[]).includes(hero);
}

export function baseProfile(family: WeaponFamilyId): AttackProfile {
  const { hero, stance } = parseFamily(family);
  return { family, hero, stance, ...FAMILY_BASE[family] };
}

export function implicitFor(family: WeaponFamilyId, rarity: Rarity): Partial<AttackProfile> {
  const idx = rarityIndex(rarity);
  const out: Partial<AttackProfile> = {};

  const holds = HOLD_IMPLICIT[family];
  if (holds) out.holds = holds[idx];

  const pierce = PIERCE_IMPLICIT[family];
  if (pierce) out.pierce = pierce[idx];

  const reach = REACH_IMPLICIT[family];
  if (reach) out.reach = reach[idx];

  const bounce = BOUNCE_IMPLICIT[family];
  if (bounce) out.bounce = bounce[idx];

  const pull = PULL_IMPLICIT[family];
  if (pull) out.pull = pull[idx];

  const stunChance = STUN_CHANCE_IMPLICIT[family];
  if (stunChance) {
    out.stunChance = stunChance[idx];
    out.stun = 0.35;
  }

  if (family === 'bob_ranged') {
    const heatBonus = BOB_RANGED_HEAT[idx] ?? 0;
    out.damage = FAMILY_BASE.bob_ranged.damage * (1 + heatBonus);
  }

  const shred = SHRED_IMPLICIT[family];
  if (shred) out.shred = shred[idx];

  const splash = SPLASH_IMPLICIT[family];
  if (splash) {
    out.splash = splash[idx];
    out.splashRadius = 36;
  }

  const splashRadius = SPLASH_RADIUS_IMPLICIT[family];
  if (splashRadius) out.splashRadius = splashRadius[idx];

  const stun = STUN_IMPLICIT[family];
  if (stun) out.stun = stun[idx];

  return out;
}

export function allWeaponFamilies(): WeaponFamilyId[] {
  const families: WeaponFamilyId[] = [];
  for (const hero of HERO_ORDER) {
    families.push(`${hero}_melee`, `${hero}_ranged`);
  }
  return families;
}
