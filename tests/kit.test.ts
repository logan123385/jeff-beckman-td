import { describe, expect, it } from 'vitest';
import { Rng } from '../src/core/rng';
import { HERO_ORDER } from '../src/data/heroes';
import { cardUnlocked, cardsFor, defaultCards, KIT_CARDS } from '../src/data/kitCards';
import { rollChest } from '../src/data/loot';
import { defaultFamily, familyHero, familyStance, implicitFor } from '../src/data/weapons';
import { resolveAttackProfile as resolve } from '../src/sim/attackProfile';

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
