import type { Rng } from '../core/rng';
import type { AffixKey, ChestQuality, GearAffix, GearItem, GearSlot, Modifiers, Rarity } from './types';

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

const SLOT_AFFIXES: Record<GearSlot, readonly AffixKey[]> = {
  wrench: ['jeffDamage', 'stunDuration', 'jeffHolds', 'cooldown'],
  boots: ['jeffSpeed', 'jeffHp', 'jeffReach', 'jeffRespawn'],
  belt: ['jeffHolds', 'jeffRepair', 'startMoney', 'jeffReach'],
  shirt: ['jeffHp', 'jeffRespawn', 'jeffSpeed', 'cooldown'],
  gauges: ['cooldown', 'stunDuration', 'towerDamage', 'jeffDamage'],
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
      return a.amount * 100;
    default: {
      const _exhaustive: never = a.key;
      return _exhaustive;
    }
  }
}

const RARITY_SCORE: Record<Rarity, number> = { common: 0, uncommon: 18, rare: 36, relic: 54 };

/** Higher is better. Used when the locker is full and something has to go. */
export function gearScore(item: GearItem): number {
  return RARITY_SCORE[item.rarity] + item.affixes.reduce((sum, a) => sum + affixScore(a), 0);
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

export function rollChest(rng: Rng, quality: ChestQuality, id: string): GearItem {
  const rarity = pickWeighted(rng, RARITY_WEIGHTS[quality]);
  const slot = rng.pick(GEAR_SLOTS);
  const name = rng.pick(NAMES[slot]);
  const pool = [...SLOT_AFFIXES[slot]];
  const count = affixCount(rarity, rng);
  const affixes: GearAffix[] = [];
  for (let i = 0; i < count && pool.length > 0; i++) {
    const idx = rng.int(0, pool.length - 1);
    const key = pool.splice(idx, 1)[0]!;
    affixes.push(rollAffix(rng, key, rarity));
  }
  return { id, name, slot, rarity, affixes };
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
