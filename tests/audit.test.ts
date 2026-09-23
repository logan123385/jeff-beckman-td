import { expect, test } from 'vitest';
import { DIFFICULTIES } from '../src/data/difficulty';
import { CRAWLSPACE } from '../src/data/maps/crawlspace';
import { BOILER_ROOM } from '../src/data/maps/boilerRoom';
import { HEROES } from '../src/data/heroes';
import { neutralModifiers } from '../src/data/modifiers';
import { resolveLoadout } from '../src/data/loadout';
import { AIM_HINT, AIM_LABEL, AIM_ORDER } from '../src/sim/combat';
import { BUILD_TIME, Game, type GameOptions } from '../src/sim/game';

function play(opts: Partial<GameOptions> = {}): Game {
  return new Game(CRAWLSPACE, {
    difficulty: DIFFICULTIES.journeyman,
    mods: { ...neutralModifiers(), startMoney: 999 },
    seed: 1,
    heroEnabled: true,
    heroId: 'jeff',
    manualStart: true,
    ...opts,
  });
}

test('abilities fail until deployHero, then Jeff kit fires', () => {
  const game = play();
  expect(game.hero.deployed).toBe(false);
  expect(game.useAbility(0)).toBe(false);
  expect(game.useClamp()).toBe(false);
  expect(game.deployHero(CRAWLSPACE.jeffStart)).toBe(true);
  expect(game.hero.deployed).toBe(true);
  expect(game.useClamp()).toBe(true);
  expect(game.clamp).toBeTruthy();
  expect(game.useAbility(4)).toBe(true);
});

test('Bob respawns faster than Jeff', () => {
  const jeff = play({ heroId: 'jeff' });
  jeff.deployHero(CRAWLSPACE.jeffStart);
  jeff.damageHero(10_000);
  expect(jeff.hero.deployed).toBe(false);
  expect(jeff.hero.downed).toBe(HEROES.jeff.respawn);

  const bob = play({ heroId: 'bob' });
  bob.deployHero(CRAWLSPACE.jeffStart);
  bob.damageHero(10_000);
  expect(bob.hero.downed).toBe(HEROES.bob.respawn);
  expect(HEROES.bob.respawn).toBeLessThan(HEROES.jeff.respawn);
});

test('apprentices deploy during installation and cannot block before it finishes', () => {
  const game = play({ heroEnabled: false });
  expect(game.placeTower(0, 'barricade')).toBe(true);
  const t = game.towers[0]!;
  expect(t.build ?? 0).toBeGreaterThan(0);
  const near = game.paths[0]!.nearestPoint(t.rally);
  const spike = game.spawnEnemy('pressureSpike', 0, near.progress);
  game.update(0.08);
  expect(t.build ?? 0).toBeGreaterThan(0);
  expect(t.build ?? 0).toBeLessThan(BUILD_TIME);
  expect(spike.heldBy).toBeNull();
  expect(game.friendlies).toHaveLength(4);
  expect(game.friendlies.some(f => f.moving)).toBe(true);
});

test('stock barricades accept a rally order', () => {
  const game = play({ heroEnabled: false });
  expect(game.placeTower(0, 'barricade')).toBe(true);
  const t = game.towers[0]!;
  expect(t.def.recruits).toBe('apprentices');
  const path = game.paths[0]!;
  const here = path.nearestPoint(t.pos);
  const pos = path.pointAt(Math.min(path.length - 8, here.progress + 28));
  expect(game.setRally(t.id, pos)).toBe(true);
  expect(Math.hypot(t.rally.x - pos.x, t.rally.y - pos.y)).toBeLessThan(8);
});

test('Weak sits in the aim cycle and HUD labels', () => {
  const game = play({ heroEnabled: false });
  expect(game.placeTower(1, 'torch')).toBe(true);
  const t = game.towers[0]!;
  const seen: string[] = [];
  for (let i = 0; i < AIM_ORDER.length; i++) seen.push(game.cycleAim(t.id)!);
  expect(seen).toContain('weak');
  expect(AIM_LABEL.weak).toBe('Weak');
  expect(AIM_HINT.weak).toMatch(/frail/i);
});

test('Play UI resolveLoadout caps the kit at five; Game keeps an exact legal kit', () => {
  const pool = BOILER_ROOM.allowedTowers;
  expect(resolveLoadout(['torch', 'torch', 'washer', 'barricade', 'expansion', 'descaler', 'vent'], pool)).toEqual([
    'torch',
    'washer',
    'barricade',
    'expansion',
    'descaler',
  ]);
  const exact = new Game(BOILER_ROOM, {
    difficulty: DIFFICULTIES.journeyman,
    mods: { ...neutralModifiers(), startMoney: 999 },
    seed: 1,
    heroEnabled: false,
    manualStart: true,
    loadout: ['torch', 'washer'],
  });
  expect(exact.allowedTowers).toEqual(['torch', 'washer']);
  const full = new Game(BOILER_ROOM, {
    difficulty: DIFFICULTIES.journeyman,
    mods: { ...neutralModifiers(), startMoney: 999 },
    seed: 1,
    heroEnabled: false,
    manualStart: true,
  });
  expect(full.allowedTowers).toEqual(pool);
});
