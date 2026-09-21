import type { Rng } from '../core/rng';
import type { HeroId } from './heroes';
import type {
  AffixKey,
  ArmorItem,
  ArmorSlot,
  ChestQuality,
  GearAffix,
  GearItem,
  GearSlot,
  KitItem,
  Modifiers,
  Rarity,
  WeaponStance,
} from './types';
import { allWeaponFamilies, familyStance, type WeaponFamilyId } from './weapons';

export const GEAR_SLOTS: GearSlot[] = ['wrench', 'boots', 'belt', 'shirt', 'gauges'];

export const SLOT_LABEL: Record<GearSlot, string> = {
  wrench: 'Wrench',
  boots: 'Boots',
  belt: 'Belt',
  shirt: 'Shirt',
  gauges: 'Gauges',
};

export const RARITY_LABEL: Record<Rarity, string> = {
  common: 'Common',
  uncommon: 'Uncommon',
  rare: 'Rare',
  relic: 'Relic',
};

const NAMES: Record<GearSlot, readonly string[]> = {
  wrench: ['18-inch Crescent', 'Dead-Blow', 'Brass Soft-Face', 'Offset Basin Wrench', 'Ridgid Pipe Wrench'],
  boots: ['Composite Toe', 'Insulated Pacs', 'Metatarsal Guards', 'Slip-Resist Work Boot'],
  belt: ['Leather Rig', 'Suspender Rig', 'Padded Tool Belt', 'Quick-Draw Holster'],
  shirt: ['Dickies Work Shirt', 'Hi-Vis Tee', 'Quilted Flannel', 'Shop Hoodie'],
  gauges: ['Steel Plugs', 'Jade Tunnels', 'Brass Flares', 'Silicone Skins'],
};

const ARMOR_NAMES: Record<ArmorSlot, readonly string[]> = {
  chest: NAMES.shirt,
  boots: NAMES.boots,
};

const WEAPON_NAMES: Record<WeaponFamilyId, readonly string[]> = {
  jeff_melee: ['18-inch Crescent', 'Dead-Blow', 'Brass Soft-Face'],
  jeff_ranged: ['Garden Hose Lance', 'Pressure Wand', 'Jet Stream Nozzle'],
  mike_melee: ['Offset Basin Wrench', 'Ridgid Pipe Wrench', 'Heavy Pipe Wrench'],
  mike_ranged: ['Red Plunger', 'Industrial Plunger', 'Mega Plunger'],
  bob_melee: ['Torch Hammer', 'Heat Rod', 'Flame Wrench'],
  bob_ranged: ['Propane Torch', 'Blue Flame Lance', 'Heat Gun'],
  chris_melee: ['Golf Wedge', 'Fairway Iron', 'Sand Wedge'],
  chris_ranged: ['Range Ball Launcher', 'Fairway Driver', 'Chip Shotter'],
  becbec_melee: ['Rebar Club', 'Steel Rod', 'Iron Pipe'],
  becbec_ranged: ['Rebar Launcher', 'Steel Bolt Gun', 'Iron Spike Thrower'],
  cbj_melee: ['Tater Masher', 'Spud Wrench', 'Heavy Spudger'],
  cbj_ranged: ['Tater Cannon', 'Spud Launcher', 'Potato Gun'],
  doni_melee: ['Hook Wrench', 'Chain Hook', 'Grapple Hook'],
  doni_ranged: ['Hook Shot', 'Chain Puller', 'Grapple Launcher'],
  jayjay_melee: ['Service Bell', 'Brass Bell', 'Alarm Bell'],
  jayjay_ranged: ['Bell Launcher', 'Brass Chime Gun', 'Alarm Bell Shot'],
};

const WEAPON_AFFIXES: readonly AffixKey[] = ['jeffDamage', 'heroRate', 'jeffReach', 'cooldown', 'onHitHeat'];

const CHEST_AFFIXES: readonly AffixKey[] = ['jeffHp', 'jeffRespawn', 'cooldown', 'towerDamage', 'jeffRepair', 'bounty'];

const BOOTS_AFFIXES: readonly AffixKey[] = ['jeffSpeed', 'jeffReach', 'startMoney', 'jeffHolds', 'sellRate', 'jeffRespawn'];

const ARMOR_AFFIXES: Record<ArmorSlot, readonly AffixKey[]> = {
  chest: CHEST_AFFIXES,
  boots: BOOTS_AFFIXES,
};

const AFFIX_ROLL: Record<AffixKey, { min: number; max: number; label: (n: number) => string }> = {
  jeffDamage: { min: 0.06, max: 0.16, label: (n) => `+${pct(n)} hero damage` },
  jeffHp: { min: 0.08, max: 0.2, label: (n) => `+${pct(n)} hero health` },
  jeffSpeed: { min: 0.06, max: 0.16, label: (n) => `+${pct(n)} move speed` },
  cooldown: { min: 0.06, max: 0.14, label: (n) => `−${pct(n)} cooldowns` },
  stunDuration: { min: 0.1, max: 0.28, label: (n) => `+${pct(n)} stun duration` },
  jeffHolds: { min: 1, max: 1, label: () => '+1 melee hold' },
  jeffRepair: { min: 0.15, max: 0.4, label: (n) => `+${pct(n)} barricade repair` },
  jeffReach: { min: 0.08, max: 0.2, label: (n) => `+${pct(n)} melee reach` },
  jeffRespawn: { min: 0.08, max: 0.2, label: (n) => `−${pct(n)} downed time` },
  startMoney: { min: 20, max: 50, label: (n) => `+$${Math.round(n)} starting cash` },
  towerDamage: { min: 0.04, max: 0.1, label: (n) => `+${pct(n)} tower damage` },
  heroRate: { min: 0.06, max: 0.14, label: (n) => `+${pct(n)} attack rate` },
  onHitHeat: { min: 4, max: 10, label: (n) => `${n.toFixed(0)} heat/s on hit` },
  bounty: { min: 0.08, max: 0.16, label: (n) => `+${pct(n)} bounty` },
  sellRate: { min: 0.1, max: 0.2, label: (n) => `+${pct(n)} sell` },
};

function pct(n: number): string {
  return `${Math.round(n * 100)}%`;
}

export function affixLabel(a: GearAffix): string {
  return AFFIX_ROLL[a.key].label(a.amount);
}

function affixScore(a: GearAffix): number {
  switch (a.key) {
    case 'jeffHolds':
      return 28 * a.amount;
    case 'startMoney':
      return a.amount * 0.5;
    case 'jeffDamage':
    case 'jeffHp':
    case 'jeffSpeed':
    case 'cooldown':
    case 'stunDuration':
    case 'jeffRepair':
    case 'jeffReach':
    case 'jeffRespawn':
    case 'towerDamage':
    case 'heroRate':
    case 'bounty':
    case 'sellRate':
      return a.amount * 100;
    case 'onHitHeat':
      return a.amount * 3;
    default: {
      const _exhaustive: never = a.key;
      return _exhaustive;
    }
  }
}

const RARITY_SCORE: Record<Rarity, number> = { common: 0, uncommon: 18, rare: 36, relic: 54 };

/** Higher is better. Used when the locker is full and something has to go. */
export function gearScore(item: KitItem | GearItem): number {
  return RARITY_SCORE[item.rarity] + item.affixes.reduce((sum, a) => sum + affixScore(a), 0);
}

export function isKitItem(value: unknown): value is KitItem {
  if (!value || typeof value !== 'object') return false;
  const row = value as Record<string, unknown>;
  if (row.kind === 'weapon') {
    return (
      typeof row.id === 'string'
      && typeof row.family === 'string'
      && typeof row.name === 'string'
      && typeof row.rarity === 'string'
      && Array.isArray(row.affixes)
    );
  }
  if (row.kind === 'armor') {
    return (
      typeof row.id === 'string'
      && (row.slot === 'chest' || row.slot === 'boots')
      && typeof row.name === 'string'
      && typeof row.rarity === 'string'
      && Array.isArray(row.affixes)
    );
  }
  return false;
}

export function applyAffix(m: Modifiers, a: GearAffix): void {
  switch (a.key) {
    case 'jeffDamage':
      m.jeffDamage *= 1 + a.amount;
      return;
    case 'jeffHp':
      m.jeffHp *= 1 + a.amount;
      return;
    case 'jeffSpeed':
      m.jeffSpeed *= 1 + a.amount;
      return;
    case 'cooldown':
      m.cooldown *= 1 - a.amount;
      return;
    case 'stunDuration':
      m.stunDuration *= 1 + a.amount;
      return;
    case 'jeffHolds':
      m.jeffHolds += a.amount;
      return;
    case 'jeffRepair':
      m.jeffRepair *= 1 + a.amount;
      return;
    case 'jeffReach':
      m.jeffReach *= 1 + a.amount;
      return;
    case 'jeffRespawn':
      m.jeffRespawn *= 1 - a.amount;
      return;
    case 'startMoney':
      m.startMoney += a.amount;
      return;
    case 'towerDamage':
      m.towerDamage *= 1 + a.amount;
      return;
    case 'heroRate':
      m.heroRate *= 1 + a.amount;
      return;
    case 'onHitHeat':
      m.onHitHeat += a.amount;
      return;
    case 'bounty':
      m.bounty *= 1 + a.amount;
      return;
    case 'sellRate':
      m.sellRate = Math.min(1, m.sellRate + a.amount);
      return;
    default: {
      const _exhaustive: never = a.key;
      return _exhaustive;
    }
  }
}

const RARITY_WEIGHTS: Record<ChestQuality, Record<Rarity, number>> = {
  job: { common: 70, uncommon: 25, rare: 5, relic: 0 },
  clean: { common: 30, uncommon: 48, rare: 20, relic: 2 },
  remaster: { common: 10, uncommon: 45, rare: 35, relic: 10 },
  night: { common: 8, uncommon: 42, rare: 38, relic: 12 },
  deepNight: { common: 0, uncommon: 15, rare: 50, relic: 35 },
};

function pickWeighted<T extends string>(rng: Rng, weights: Record<T, number>): T {
  const entries = (Object.entries(weights) as [T, number][]).filter(([, w]) => w > 0);
  const total = entries.reduce((s, [, w]) => s + w, 0);
  let roll = rng.next() * total;
  for (const [key, w] of entries) {
    roll -= w;
    if (roll <= 0) return key;
  }
  return entries[entries.length - 1]![0];
}

function affixCount(rarity: Rarity, rng: Rng): number {
  switch (rarity) {
    case 'common':
      return 1;
    case 'uncommon':
      return 2;
    case 'rare':
      return rng.next() < 0.35 ? 3 : 2;
    case 'relic':
      return 3;
    default: {
      const _exhaustive: never = rarity;
      return _exhaustive;
    }
  }
}

function rollAffix(rng: Rng, key: AffixKey, rarity: Rarity): GearAffix {
  const spec = AFFIX_ROLL[key];
  const t = rng.next();
  let amount = spec.min + (spec.max - spec.min) * t;
  if (rarity === 'rare') amount *= 1.12;
  if (rarity === 'relic') amount *= 1.28;
  if (key === 'jeffHolds') amount = 1;
  if (key === 'startMoney') amount = Math.round(amount);
  else if (key !== 'jeffHolds') amount = Math.round(amount * 100) / 100;
  return { key, amount };
}

function rollAffixes(rng: Rng, pool: readonly AffixKey[], rarity: Rarity): GearAffix[] {
  const scratch = [...pool];
  const count = affixCount(rarity, rng);
  const affixes: GearAffix[] = [];
  for (let i = 0; i < count && scratch.length > 0; i++) {
    const idx = rng.int(0, scratch.length - 1);
    const key = scratch.splice(idx, 1)[0]!;
    affixes.push(rollAffix(rng, key, rarity));
  }
  return affixes;
}

function isEndlessQuality(quality: ChestQuality): boolean {
  return quality === 'night' || quality === 'deepNight';
}

function rollKind(rng: Rng, quality: ChestQuality): KitItem['kind'] {
  const weaponChance = isEndlessQuality(quality) ? 0.7 : 0.35;
  return rng.next() < weaponChance ? 'weapon' : 'armor';
}

function rollWeaponFamily(rng: Rng, playedHero?: HeroId): WeaponFamilyId {
  if (playedHero && rng.next() < 0.8) {
    const stance = rng.pick(['melee', 'ranged'] satisfies WeaponStance[]);
    return `${playedHero}_${stance}`;
  }
  return rng.pick(allWeaponFamilies());
}

function weaponAffixPool(family: WeaponFamilyId): AffixKey[] {
  const pool = [...WEAPON_AFFIXES];
  if (familyStance(family) === 'melee') pool.push('jeffHolds');
  return pool;
}

export function rollChest(rng: Rng, quality: ChestQuality, id: string, playedHero?: HeroId): KitItem {
  const rarity = pickWeighted(rng, RARITY_WEIGHTS[quality]);
  const kind = rollKind(rng, quality);
  if (kind === 'weapon') {
    const family = rollWeaponFamily(rng, playedHero);
    return {
      kind: 'weapon',
      id,
      family,
      name: rng.pick(WEAPON_NAMES[family]),
      rarity,
      affixes: rollAffixes(rng, weaponAffixPool(family), rarity),
    };
  }
  const slot = rng.pick(['chest', 'boots'] satisfies ArmorSlot[]);
  const armor: ArmorItem = {
    kind: 'armor',
    id,
    slot,
    name: rng.pick(ARMOR_NAMES[slot]),
    rarity,
    affixes: rollAffixes(rng, ARMOR_AFFIXES[slot], rarity),
  };
  return armor;
}

export function chestBlurb(quality: ChestQuality): string {
  switch (quality) {
    case 'job':
      return 'Job chest';
    case 'clean':
      return 'Clean-sheet chest';
    case 'remaster':
      return 'Remaster chest';
    case 'night':
      return 'The Neverending Service Call crate';
    case 'deepNight':
      return 'Deep-night crate';
    default: {
      const _exhaustive: never = quality;
      return _exhaustive;
    }
  }
}
