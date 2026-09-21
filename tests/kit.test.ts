import { describe, expect, it } from 'vitest';
import { Rng } from '../src/core/rng';
import { HERO_ORDER } from '../src/data/heroes';
import { cardUnlocked, cardsFor, defaultCards, KIT_CARDS } from '../src/data/kitCards';
import { rollChest } from '../src/data/loot';
import { CRAWLSPACE } from '../src/data/maps/crawlspace';
import { DIFFICULTIES } from '../src/data/difficulty';
import { neutralModifiers } from '../src/data/skills';
import { defaultFamily, familyHero, familyStance, implicitFor } from '../src/data/weapons';
import { SAVE_KEY, normalizeSave, SaveStore } from '../src/save/save';
import { resolveAttackProfile as resolve } from '../src/sim/attackProfile';
import { Game } from '../src/sim/game';

function playJeff(family: 'jeff_melee' | 'jeff_ranged') {
  return new Game(CRAWLSPACE, { difficulty: DIFFICULTIES.apprentice, mods: neutralModifiers(), hero: 'jeff', kit: { family, weapon: null, cards: [null, null] } });
}

describe('profile basics', () => {
  it('lets a wand Jeff hit air and a wrench Jeff hold ground', () => {
    const melee = playJeff('jeff_melee');
    expect(melee.attackProfile.air).toBe(false);
    expect(melee.attackProfile.holds).toBeGreaterThanOrEqual(2);
    const wand = playJeff('jeff_ranged');
    expect(wand.attackProfile.air).toBe(true);
    expect(wand.attackProfile.holds).toBe(0);
    expect(wand.attackProfile.missile).toBe('hose');
  });
});

describe('weapon families', () => {
  it('gives each hero a default family matching today’s stance', () => {
    expect(defaultFamily('jeff')).toBe('jeff_melee');
    expect(defaultFamily('mike')).toBe('mike_ranged');
    expect(defaultFamily('bob')).toBe('bob_ranged');
    expect(defaultFamily('chris')).toBe('chris_melee');
    expect(defaultFamily('becbec')).toBe('becbec_melee');
    expect(defaultFamily('cbj')).toBe('cbj_ranged');
    expect(defaultFamily('doni')).toBe('doni_ranged');
    expect(defaultFamily('jayjay')).toBe('jayjay_melee');
  });
  it('exposes 16 families with air and hold rules from the spec', () => {
    expect(HERO_ORDER).toHaveLength(8);
    const jeffMelee = resolve('jeff_melee', 'common', []);
    expect(jeffMelee.air).toBe(false);
    expect(jeffMelee.holds).toBe(2);
    expect(jeffMelee.reach).toBe(42);
    const jeffWand = resolve('jeff_ranged', 'relic', []);
    expect(jeffWand.air).toBe(true);
    expect(jeffWand.holds).toBe(0);
    expect(jeffWand.pierce).toBe(2);
    expect(familyHero('mike_melee')).toBe('mike');
    expect(familyStance('mike_melee')).toBe('melee');
  });
  it('scales implicits by rarity and applies reach affixes', () => {
    expect(implicitFor('jayjay_melee', 'common').holds).toBe(0);
    expect(implicitFor('jayjay_melee', 'uncommon').holds).toBe(1);
    expect(implicitFor('jayjay_melee', 'relic').holds).toBe(2);
    const boosted = resolve('jeff_melee', 'uncommon', [{ key: 'jeffHolds', amount: 1 }, { key: 'jeffReach', amount: 0.1 }]);
    expect(boosted.holds).toBe(3);
    expect(boosted.reach).toBeCloseTo(42 * 1.1, 5);
  });
});

describe('kit chests', () => {
  it('leans armor on campaign clears and the played hero on endless', () => {
    const campaign = Array.from({ length: 200 }, (_, i) => rollChest(new Rng(i + 1), 'job', `c${i}`, 'jeff'));
    const armor = campaign.filter(item => item.kind === 'armor').length;
    expect(armor).toBeGreaterThan(110);
    const night = Array.from({ length: 200 }, (_, i) => rollChest(new Rng(1000 + i), 'deepNight', `n${i}`, 'doni'));
    const doniWeapons = night.filter(item => item.kind === 'weapon' && item.family.startsWith('doni_'));
    expect(doniWeapons.length).toBeGreaterThan(90);
    const relic = rollChest(new Rng(42), 'deepNight', 'r1', 'jeff');
    expect(['uncommon', 'rare', 'relic']).toContain(relic.rarity);
  });
});

describe('kit cards', () => {
  it('has four melee and four ranged cards per hero', () => {
    expect(KIT_CARDS).toHaveLength(64);
    for (const hero of HERO_ORDER) {
      expect(cardsFor(hero, 'melee').map(c => c.job)).toEqual(['anchor', 'breaker', 'crew', 'sweep']);
      expect(cardsFor(hero, 'ranged').map(c => c.job)).toEqual(['lane', 'pin', 'control', 'spot']);
    }
  });
  it('unlocks crew after one job and sweep after three', () => {
    const crew = cardsFor('jeff', 'melee').find(c => c.job === 'crew')!;
    const sweep = cardsFor('jeff', 'melee').find(c => c.job === 'sweep')!;
    expect(cardUnlocked(crew, 0)).toBe(false);
    expect(cardUnlocked(crew, 1)).toBe(true);
    expect(cardUnlocked(sweep, 2)).toBe(false);
    expect(cardUnlocked(sweep, 3)).toBe(true);
    expect(defaultCards('jeff')).toEqual(['jeff_anchor', 'jeff_breaker']);
    expect(defaultCards('mike')).toEqual(['mike_lane', 'mike_pin']);
  });
});

describe('save v2', () => {
  it('migrates a v1 tree save without stuffing starter weapons into the locker', () => {
    const data = normalizeSave({
      version: 1,
      jeffXp: 400,
      skills: ['sharpTools'],
      talents: ['ironGrip'],
      heroBuilds: { jeff: { nodes: ['venom:1', 'venom:2', 'venom:3', 'venom:4'], technique: 'venom' } },
      inventory: [{ id: 'g1', name: 'Hi-Vis Tee', slot: 'shirt', rarity: 'rare', affixes: [{ key: 'jeffHp', amount: 0.12 }] }],
      equipped: { shirt: 'g1' },
    } as never);
    expect(data.version).toBe(2);
    expect(data.inventory.some(i => i.kind === 'weapon' && i.rarity === 'common')).toBe(false);
    expect(data.kits.jeff?.family).toBe('jeff_melee');
    expect(data.kits.jeff?.cards).toEqual(['jeff_anchor', 'jeff_breaker']);
    expect(data.heroJobs.jeff).toBeGreaterThanOrEqual(3);
    expect(data.inventory.some(i => i.kind === 'armor' && i.slot === 'chest' && i.name === 'Veteran Vest')).toBe(true);
    const veteranBoots = data.inventory.find(i => i.kind === 'armor' && i.slot === 'boots' && i.id === 'g-veteran-boots');
    expect(veteranBoots?.name).toBe('Veteran Pacs');
    expect(veteranBoots?.rarity).toBe('rare');
    expect(data.inventory.find(i => i.id === 'g-veteran-chest')?.rarity).toBe('rare');
    expect((data as { skills?: unknown }).skills).toBeUndefined();
  });
  it('persists v2 kits, heroJobs, and armor across reload', () => {
    class MemoryStorage implements Storage {
      private readonly data = new Map<string, string>();
      get length(): number {
        return this.data.size;
      }
      clear(): void {
        this.data.clear();
      }
      getItem(key: string): string | null {
        return this.data.get(key) ?? null;
      }
      key(index: number): string | null {
        return [...this.data.keys()][index] ?? null;
      }
      removeItem(key: string): void {
        this.data.delete(key);
      }
      setItem(key: string, value: string): void {
        this.data.set(key, value);
      }
    }

    const storage = new MemoryStorage();
    const save = new SaveStore(storage);
    save.data.inventory.push(
      { kind: 'weapon', id: 'w-jeff', family: 'jeff_melee', name: 'Pipe Wrench', rarity: 'uncommon', affixes: [] },
      { kind: 'armor', id: 'chest-1', slot: 'chest', name: 'Hi-Vis', rarity: 'uncommon', affixes: [] },
      { kind: 'armor', id: 'boots-1', slot: 'boots', name: 'Steel Toes', rarity: 'common', affixes: [] },
    );
    save.recordHeroJob('jeff');
    save.recordHeroJob('jeff');
    save.recordHeroJob('jeff');
    save.setFamily('jeff', 'jeff_melee');
    save.equipWeapon('jeff', 'w-jeff');
    save.equipCard('jeff', 0, 'jeff_sweep');
    save.equipCard('jeff', 1, 'jeff_breaker');
    save.equipArmor('chest-1');
    save.equipArmor('boots-1');
    expect(save.save()).toBe(true);

    const reloaded = new SaveStore(storage);
    expect(reloaded.data.heroJobs.jeff).toBe(3);
    expect(reloaded.data.kits.jeff).toEqual({
      family: 'jeff_melee',
      weaponId: 'w-jeff',
      cards: ['jeff_sweep', 'jeff_breaker'],
    });
    expect(reloaded.data.chestId).toBe('chest-1');
    expect(reloaded.data.bootsId).toBe('boots-1');

    const normalized = normalizeSave(JSON.parse(storage.getItem(SAVE_KEY)!) as never);
    expect(normalized.kits.jeff).toEqual(reloaded.data.kits.jeff);
    expect(normalized.heroJobs.jeff).toBe(3);
    expect(normalized.chestId).toBe('chest-1');
    expect(normalized.bootsId).toBe('boots-1');
  });
  it('seeds stance-correct starter cards when v2 kit has family but no cards', () => {
    const data = normalizeSave({
      version: 2,
      kits: { jeff: { family: 'jeff_ranged' } },
    } as never);
    expect(data.kits.jeff?.family).toBe('jeff_ranged');
    expect(data.kits.jeff?.cards).toEqual(['jeff_lane', 'jeff_pin']);
  });
  it('keeps stored heroJobs when v1 heroBuilds would grant fewer', () => {
    const data = normalizeSave({
      version: 2,
      heroJobs: { jeff: 5 },
      heroBuilds: { jeff: { nodes: ['venom:1'], technique: 'venom' } },
    } as never);
    expect(data.heroJobs.jeff).toBe(5);
  });
  it('rejects a weapon for the wrong hero', () => {
    const save = new SaveStore(null);
    save.data.inventory.push({ kind: 'weapon', id: 'w1', family: 'mike_ranged', name: 'Test', rarity: 'rare', affixes: [] });
    expect(save.equipWeapon('jeff', 'w1')).toBe(false);
    expect(save.setFamily('jeff', 'mike_ranged')).toBe(false);
  });
});
