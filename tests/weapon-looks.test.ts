import { describe, expect, it } from 'vitest';
import { allWeaponFamilies, familyStance } from '../src/data/weapons';
import type { HeroMissile } from '../src/sim/state';
import { drawMeleeProp, drawMissileBody, drawRangedProp, missileDrawer, missileTrailColor } from '../src/render/weaponActors';

const KINDS: HeroMissile['kind'][] = ['plunger', 'golf', 'tater', 'hook', 'hose', 'rebar', 'bell'];

function recordingCtx(): { ctx: CanvasRenderingContext2D; fingerprint: () => string; depth: () => number } {
  const ops: string[] = [];
  let depth = 0;
  const gradient = { addColorStop() { ops.push('addColorStop'); } };
  const ctx = new Proxy({} as CanvasRenderingContext2D, {
    get(_target, prop) {
      if (typeof prop !== 'string') return undefined;
      return (..._args: unknown[]) => {
        ops.push(prop);
        if (prop === 'save') depth += 1;
        if (prop === 'restore') depth -= 1;
        if (prop === 'createRadialGradient') return gradient;
        return undefined;
      };
    },
    set(_target, prop, value) {
      ops.push(`set:${String(prop)}=${String(value).slice(0, 32)}`);
      return true;
    },
  });
  return { ctx, fingerprint: () => ops.join('|'), depth: () => depth };
}

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

  it('draws a distinct prop for each family and restores the canvas', () => {
    const prints = new Set<string>();
    for (const family of allWeaponFamilies()) {
      const rec = recordingCtx();
      if (familyStance(family) === 'melee') drawMeleeProp(rec.ctx, family, 0.4, true);
      else drawRangedProp(rec.ctx, family, 1);
      expect(rec.depth()).toBe(0);
      expect(rec.fingerprint().length).toBeGreaterThan(10);
      prints.add(rec.fingerprint());
    }
    expect(prints.size).toBe(16);
  });

  it('draws a distinct body for each missile kind', () => {
    const prints = new Set<string>();
    for (const kind of KINDS) {
      const rec = recordingCtx();
      rec.ctx.save();
      drawMissileBody(rec.ctx, kind, 0.2, kind === 'tater' ? 12 : 0);
      rec.ctx.restore();
      expect(rec.depth()).toBe(0);
      prints.add(rec.fingerprint());
    }
    expect(prints.size).toBe(KINDS.length);
  });
});
