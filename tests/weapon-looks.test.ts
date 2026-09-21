import { describe, expect, it } from 'vitest';
import { allWeaponFamilies } from '../src/data/weapons';
import type { HeroMissile } from '../src/sim/state';
import { missileDrawer, missileTrailColor } from '../src/render/weaponActors';

const KINDS: HeroMissile['kind'][] = ['plunger', 'golf', 'tater', 'hook', 'hose', 'rebar', 'bell'];

describe('weapon family combat looks', () => {
  it('maps every missile kind to its own drawer', () => {
    const drawers = KINDS.map(missileDrawer);
    expect(new Set(drawers).size).toBe(KINDS.length);
  });

  it('gives every missile kind a distinct trail color', () => {
    const colors = KINDS.map(missileTrailColor);
    expect(new Set(colors).size).toBe(KINDS.length);
  });

  it('covers all sixteen weapon families', () => {
    expect(allWeaponFamilies()).toHaveLength(16);
  });
});
