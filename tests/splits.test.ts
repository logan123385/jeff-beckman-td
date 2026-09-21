import { expect, test } from 'vitest';
import { DIFFICULTIES } from '../src/data/difficulty';
import { CRAWLSPACE } from '../src/data/maps/crawlspace';
import { BOILER_ROOM } from '../src/data/maps/boilerRoom';
import { pack, RUSH_GAP, rush } from '../src/data/maps/helpers';
import { fieldRbe, leakRbe, previewRbe, splitCount, splitOf, splitPreview } from '../src/data/splits';
import { generateEndlessWave } from '../src/data/night';
import { neutralModifiers } from '../src/data/modifiers';
import { applyDamage } from '../src/sim/combat';
import { Game } from '../src/sim/game';

function makeGame(): Game {
  return new Game(CRAWLSPACE, {
    difficulty: DIFFICULTIES.journeyman,
    mods: neutralModifiers(),
    seed: 1,
    heroEnabled: false,
    manualStart: true,
  });
}

test('scale crab RBE includes the two drips', () => {
  expect(leakRbe('drip')).toBe(1);
  expect(leakRbe('scaleCrab')).toBe(3);
  expect(leakRbe('scaleCrab', true)).toBe(4);
  expect(splitCount('scaleCrab', false)).toBe(2);
  expect(splitCount('scaleCrab', true)).toBe(3);
});

test('glycol golem chain is a BFB-sized family', () => {
  expect(leakRbe('frozenMain')).toBe(7);
  expect(leakRbe('glycolGolem')).toBe(16);
  expect(splitOf('glycolGolem')?.child).toBe('frozenMain');
});

test('killing a scale crab spawns two drips on the pipe', () => {
  const game = makeGame();
  const crab = game.spawnEnemy('scaleCrab', 0, 80);
  applyDamage(game, crab, 10_000, 'fire', 'torch');
  expect(crab.dead).toBe(true);
  const kids = game.enemies.filter((e) => e.def.id === 'drip' && !e.dead && !e.escaped);
  expect(kids).toHaveLength(2);
  for (const kid of kids) {
    expect(kid.progress).toBeLessThanOrEqual(crab.progress);
    expect(kid.progress).toBeGreaterThanOrEqual(0);
  }
});

test('pressurized crab sheds a third drip', () => {
  const game = makeGame();
  const crab = game.spawnEnemy('scaleCrab', 0, 80, ['pressurized']);
  applyDamage(game, crab, 10_000, 'fire', 'torch');
  const kids = game.enemies.filter((e) => e.def.id === 'drip' && !e.dead && !e.escaped);
  expect(kids).toHaveLength(3);
});

test('clean hands blocks sell, crew, strike, and actives', () => {
  const game = new Game(CRAWLSPACE, {
    difficulty: DIFFICULTIES.journeyman,
    mods: { ...neutralModifiers(), startMoney: 999 },
    seed: 1,
    heroEnabled: false,
    remaster: 'cleanHands',
    manualStart: true,
  });
  expect(game.lives).toBe(1);
  expect(game.parts).toBe(0);
  expect(game.money).toBe(CRAWLSPACE.startMoney);
  expect(game.placeTower(0, 'torch')).toBe(true);
  const tower = game.towers[0]!;
  tower.build = 0;
  expect(game.sellTower(tower.id)).toBe(false);
  expect(game.reinforce({ x: 160, y: 120 })).toBe(false);
  expect(game.torchStrike({ x: 200, y: 200 })).toBe(false);
  expect(game.useTowerAbility(tower.id)).toBe(false);
});

test('wave preview expands children and RBE', () => {
  const kids = splitPreview('scaleCrab', 3, false);
  expect(kids).toEqual({ child: 'drip', count: 6 });
  expect(previewRbe([{ enemy: 'scaleCrab', count: 3, properties: [] }])).toBe(9);
  expect(previewRbe([{ enemy: 'drip', count: 6, properties: [] }])).toBe(6);
});

test('packed crabs walk as a wall, not a trickle', () => {
  const g = pack('scaleCrab', 14);
  expect(g.interval).toBe(RUSH_GAP.scaleCrab);
  expect(g.interval).toBeLessThanOrEqual(0.35);
  expect(rush(g).rush).toBe(true);
});

test('boiler room last wave is a crab rush', () => {
  const last = BOILER_ROOM.waves.at(-1)!;
  expect(last.rush).toBe(true);
  const crabs = last.groups.find((g) => g.enemy === 'scaleCrab');
  expect(crabs).toBeTruthy();
  expect(crabs!.count).toBe(14);
  expect(crabs!.interval).toBeLessThanOrEqual(0.35);
});

test('pipe RBE counts living parents plus their children', () => {
  expect(fieldRbe([{ id: 'scaleCrab', pressurized: false }])).toBe(3);
  expect(fieldRbe([{ id: 'scaleCrab', pressurized: true }], [{ enemy: 'drip', remaining: 2, properties: [] }])).toBe(6);
  const game = new Game(BOILER_ROOM, {
    difficulty: DIFFICULTIES.journeyman,
    mods: neutralModifiers(),
    seed: 1,
    heroEnabled: false,
    manualStart: true,
  });
  game.spawnEnemy('scaleCrab', 0, 40);
  game.spawnEnemy('scaleCrab', 0, 80);
  expect(game.pipeRbe()).toBe(6);
  expect(game.nextWaveIsRush()).toBe(false);
});

test('neverending rush hour actually packs drips', () => {
  const w = generateEndlessWave(0, 1);
  expect(w.rush).toBe(true);
  const drips = w.groups.find((g) => g.enemy === 'drip');
  expect(drips).toBeTruthy();
  expect(drips!.interval).toBeLessThanOrEqual(0.22);
});

test('Core Sample does not spend parts without a leak in range', () => {
  const game = new Game(
    { ...CRAWLSPACE, allowedTowers: [...CRAWLSPACE.allowedTowers, 'hammerDrill'], startMoney: 999 },
    {
      difficulty: DIFFICULTIES.journeyman,
      mods: { ...neutralModifiers(), startMoney: 999 },
      seed: 1,
      heroEnabled: false,
      manualStart: true,
      loadout: ['hammerDrill'],
    },
  );
  expect(game.placeTower(0, 'hammerDrill')).toBe(true);
  const t = game.towers[0]!;
  t.build = 0;
  t.level = 1;
  const parts = game.parts;
  expect(game.useTowerAbility(t.id)).toBe(false);
  expect(game.parts).toBe(parts);
  expect(game.stats.partsSpent).toBe(0);
  expect(t.abilityCd).toBe(0);

  const at = game.paths[0]!.nearestPoint(t.pos).progress;
  const leak = game.spawnEnemy('scaleCrab', 0, at);
  leak.pos = { ...game.paths[0]!.pointAt(at) };
  expect(game.useTowerAbility(t.id)).toBe(true);
  expect(game.stats.partsSpent).toBe(3);
  expect(t.abilityCd).toBeGreaterThan(0);
  expect(leak.hp).toBeLessThan(leak.maxHp);
});

test('Emergency Pump does not spend parts on leaks still approaching the basin', () => {
  const game = new Game(
    { ...CRAWLSPACE, allowedTowers: [...CRAWLSPACE.allowedTowers, 'sump'], startMoney: 999 },
    {
      difficulty: DIFFICULTIES.journeyman,
      mods: { ...neutralModifiers(), startMoney: 999 },
      seed: 1,
      heroEnabled: false,
      manualStart: true,
      loadout: ['sump'],
    },
  );
  expect(game.placeTower(0, 'sump')).toBe(true);
  const t = game.towers[0]!;
  t.build = 0;
  t.level = 1;
  const basin = game.paths[0]!.nearestPoint(t.pos).progress;
  const inbound = game.spawnEnemy('drip', 0, Math.max(0, basin - 40));
  inbound.pos = { ...game.paths[0]!.pointAt(inbound.progress) };
  const parts = game.parts;
  expect(game.useTowerAbility(t.id)).toBe(false);
  expect(game.parts).toBe(parts);
  expect(t.abilityCd).toBe(0);

  const past = game.spawnEnemy('drip', 0, basin + 50);
  past.pos = { ...game.paths[0]!.pointAt(past.progress) };
  expect(game.useTowerAbility(t.id)).toBe(true);
  expect(game.parts).toBe(parts - 3);
  expect(past.progress).toBeLessThan(basin + 50);
});
