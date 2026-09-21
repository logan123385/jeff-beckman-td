import { describe, expect, it } from 'vitest';
import { HERO_ORDER } from '../src/data/heroes';
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
