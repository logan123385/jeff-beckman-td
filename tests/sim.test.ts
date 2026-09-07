import { describe, expect, it } from 'vitest';
import { FIXED_DT } from '../src/core/loop';
import { DIFFICULTIES } from '../src/data/difficulty';
import { ENEMIES } from '../src/data/enemies';
import { CRAWLSPACE } from '../src/data/maps/crawlspace';
import { buildModifiers, canUnlock, neutralModifiers } from '../src/data/skills';
import { TOWERS } from '../src/data/towers';
import type { MapDef } from '../src/data/types';
import { applyDamage, pickTarget } from '../src/sim/combat';
import { Game } from '../src/sim/game';
import { Path } from '../src/sim/path';
import { SaveStore, starsForClear } from '../src/save/save';

const STRAIGHT: MapDef = {
  ...CRAWLSPACE,
  id: 'test-straight',
  paths: [[{ x: 0, y: 100 }, { x: 400, y: 100 }]],
  slots: [{ x: 200, y: 60 }, { x: 200, y: 160 }, { x: 140, y: 60 }],
  jeffStart: { x: 200, y: 300 },
  startMoney: 1000,
  allowedTowers: ['torch', 'washer', 'barricade', 'vent', 'radiant', 'expansion'],
  waves: [{ groups: [{ enemy: 'drip', count: 1, interval: 1, delay: 0, path: 0 }] }],
};

function makeGame(overrides: Partial<MapDef> = {}, heroEnabled = false): Game {
  return new Game({ ...STRAIGHT, ...overrides }, { difficulty: DIFFICULTIES.journeyman, mods: neutralModifiers(), seed: 3, heroEnabled });
}

function step(game: Game, seconds: number): void {
  const n = Math.round(seconds / FIXED_DT);
  for (let i = 0; i < n; i++) game.update(FIXED_DT);
}

describe('Path', () => {
  it('positions by progress and reports length', () => {
    const p = new Path([{ x: 0, y: 0 }, { x: 100, y: 0 }, { x: 100, y: 50 }]);
    expect(p.length).toBe(150);
    expect(p.pointAt(50)).toEqual({ x: 50, y: 0 });
    expect(p.pointAt(125)).toEqual({ x: 100, y: 25 });
    expect(p.pointAt(999)).toEqual({ x: 100, y: 50 });
  });

  it('finds the nearest point on the polyline', () => {
    const p = new Path([{ x: 0, y: 0 }, { x: 100, y: 0 }]);
    const n = p.nearestPoint({ x: 40, y: 30 });
    expect(n.pos).toEqual({ x: 40, y: 0 });
    expect(n.dist).toBe(30);
    expect(n.progress).toBe(40);
  });
});

describe('Enemies and lives', () => {
  it('an unopposed drip walks the path and costs a life', () => {
    const game = makeGame();
    game.callNextWave();
    step(game, 400 / ENEMIES.drip.speed + 1);
    expect(game.lives).toBe(STRAIGHT.lives - 1);
    expect(game.stats.escaped).toBe(1);
  });

  it('spawned enemies are marked seen for the encyclopedia', () => {
    const game = makeGame();
    game.spawnEnemy('scaleCrab', 0);
    expect(game.seen.has('scaleCrab')).toBe(true);
  });
});

describe('Damage model', () => {
  it('armor reduces physical and water damage but not fire or heat', () => {
    const game = makeGame();
    const crab = game.spawnEnemy('scaleCrab', 0);
    const start = crab.hp;
    expect(applyDamage(game, crab, 100, 'physical', 'barricade')).toBeCloseTo(40);
    expect(applyDamage(game, crab, 100, 'water', 'washer')).toBeCloseTo(40);
    expect(applyDamage(game, crab, 10, 'fire', 'torch')).toBeCloseTo(10);
    expect(applyDamage(game, crab, 5, 'heat', 'radiant')).toBeCloseTo(5);
    expect(crab.hp).toBeCloseTo(start - 95);
  });

  it('sludge resists fire, drips are weak to water, frozen mains melt to heat', () => {
    const game = makeGame();
    expect(applyDamage(game, game.spawnEnemy('sludge', 0), 100, 'fire', 'torch')).toBeCloseTo(50);
    expect(applyDamage(game, game.spawnEnemy('drip', 0), 10, 'water', 'washer')).toBeCloseTo(15);
    expect(applyDamage(game, game.spawnEnemy('frozenMain', 0), 100, 'heat', 'radiant')).toBeCloseTo(200);
  });

  it('phased airlock bubbles take no damage; a stun pops the phase', () => {
    const game = makeGame();
    const bubble = game.spawnEnemy('airlock', 0);
    bubble.phased = true;
    expect(applyDamage(game, bubble, 50, 'fire', 'torch')).toBe(0);
    bubble.stun = 1;
    step(game, FIXED_DT);
    expect(bubble.phased).toBe(false);
  });

  it('kills pay bounty and attribute damage to the source', () => {
    const game = makeGame();
    const drip = game.spawnEnemy('drip', 0);
    const before = game.money;
    applyDamage(game, drip, 999, 'fire', 'torch');
    expect(drip.dead).toBe(true);
    expect(game.money).toBe(before + ENEMIES.drip.bounty);
    expect(game.stats.towerDamage.torch).toBe(ENEMIES.drip.hp);
    expect(game.stats.kills).toBe(1);
  });

  it('boss phase change summons drips and speeds it up', () => {
    const game = makeGame();
    const boss = game.spawnEnemy('rogueBoiler', 0, 200);
    applyDamage(game, boss, boss.maxHp * 0.4, 'fire', 'torch');
    expect(boss.bossPhase).toBe(1);
    expect(boss.speedMult).toBeGreaterThan(1);
    expect(game.enemies.filter((e) => e.def.id === 'drip').length).toBe(6);
  });
});

describe('Towers', () => {
  it('targets the enemy furthest along the path', () => {
    const game = makeGame();
    game.placeTower(0, 'torch');
    const t = game.towers[0]!;
    const behind = game.spawnEnemy('drip', 0, 170);
    const ahead = game.spawnEnemy('drip', 0, 230);
    behind.pos = game.paths[0]!.pointAt(170);
    ahead.pos = game.paths[0]!.pointAt(230);
    expect(pickTarget(game, t, 95)?.id).toBe(ahead.id);
  });

  it('washer cannot target flying enemies; torch can', () => {
    const game = makeGame();
    game.placeTower(0, 'washer');
    game.placeTower(1, 'torch');
    const wisp = game.spawnEnemy('steamWisp', 0, 200);
    wisp.pos = game.paths[0]!.pointAt(200);
    expect(pickTarget(game, game.towers[0]!, 200)).toBeNull();
    expect(pickTarget(game, game.towers[1]!, 200)?.id).toBe(wisp.id);
  });

  it('placing, upgrading and selling move money correctly', () => {
    const game = makeGame();
    const start = game.money;
    expect(game.placeTower(0, 'torch')).toBe(true);
    expect(game.money).toBe(start - TOWERS.torch.levels[0].cost);
    expect(game.placeTower(0, 'torch')).toBe(false); // occupied
    const t = game.towers[0]!;
    expect(game.upgradeTower(t.id)).toBe(true);
    expect(t.level).toBe(1);
    const invested = TOWERS.torch.levels[0].cost + TOWERS.torch.levels[1].cost;
    expect(game.sellValue(t)).toBe(Math.round(invested * 0.7));
    expect(game.sellTower(t.id)).toBe(true);
    expect(game.towers.length).toBe(0);
  });

  it('refuses towers the map does not allow', () => {
    const game = makeGame({ allowedTowers: ['torch'] });
    expect(game.placeTower(0, 'vent')).toBe(false);
  });

  it('a barricade deploys onto the pipe and holds a ground enemy', () => {
    const game = makeGame();
    game.placeTower(0, 'barricade');
    const b = game.towers[0]!;
    expect(b.rally).toEqual({ x: 200, y: 100 });
    game.callNextWave();
    step(game, 200 / ENEMIES.drip.speed + 0.5);
    const drip = game.enemies[0]!;
    expect(drip.heldBy).toEqual({ kind: 'tower', id: b.id });
    const held = drip.progress;
    step(game, 0.5);
    expect(drip.progress).toBe(held);
  });

  it('pressure spikes blow up barricades quickly', () => {
    const game = makeGame();
    game.placeTower(0, 'barricade');
    const b = game.towers[0]!;
    const spike = game.spawnEnemy('pressureSpike', 0, 190);
    spike.pos = game.paths[0]!.pointAt(190);
    step(game, 5);
    expect(b.rebuild > 0 || b.hp < b.maxHp).toBe(true);
  });

  it('radiant coil slows ground enemies and protects towers from freezing', () => {
    const game = makeGame();
    game.placeTower(0, 'radiant');
    game.placeTower(2, 'torch');
    const slug = game.spawnEnemy('sludge', 0, 200);
    step(game, FIXED_DT * 2);
    expect(slug.slow).toBeGreaterThan(0);
    const frozen = game.spawnEnemy('frozenMain', 0, 150);
    frozen.freezeTimer = FIXED_DT;
    step(game, FIXED_DT * 2);
    expect(game.towers.every((t) => t.frozen <= 0)).toBe(true);
  });

  it('frozen main freezes an unprotected tower', () => {
    const game = makeGame();
    game.placeTower(0, 'torch');
    const frozen = game.spawnEnemy('frozenMain', 0, 200);
    frozen.freezeTimer = FIXED_DT;
    step(game, FIXED_DT * 2);
    expect(game.towers[0]!.frozen).toBeGreaterThan(0);
  });

  it('expansion tank buffs neighbours and absorbs a surge', () => {
    const game = makeGame();
    game.placeTower(0, 'torch');
    game.placeTower(2, 'expansion');
    step(game, FIXED_DT);
    const torch = game.towers[0]!;
    expect(game.effectiveDamage(torch)).toBeGreaterThan(TOWERS.torch.levels[0].damage);
    const frozen = game.spawnEnemy('frozenMain', 0, 200);
    frozen.freezeTimer = FIXED_DT;
    step(game, FIXED_DT * 2);
    expect(torch.frozen).toBe(0);
    expect(game.towers[1]!.shieldCooldown).toBeGreaterThan(0);
  });
});

describe('Jeff', () => {
  it('moves where commanded and only when enabled', () => {
    const off = makeGame({}, false);
    expect(off.commandHero({ x: 10, y: 10 })).toBe(false);
    const on = makeGame({}, true);
    expect(on.commandHero({ x: 200, y: 100 })).toBe(true);
    step(on, 3);
    expect(on.hero.pos).toEqual({ x: 200, y: 100 });
  });

  it('engages and stuns a nearby enemy, attributing damage to jeff', () => {
    const game = makeGame({ jeffStart: { x: 200, y: 100 } }, true);
    const crab = game.spawnEnemy('scaleCrab', 0, 195);
    step(game, 1.5);
    expect(game.stats.jeffDamage).toBeGreaterThan(0);
    expect(crab.stun > 0 || crab.armorShred > 0).toBe(true);
    expect(crab.heldBy).toEqual({ kind: 'hero' });
  });

  it('abilities respect cooldowns and shutoff pauses spawns', () => {
    const game = makeGame({}, true);
    expect(game.useClamp()).toBe(true);
    expect(game.useClamp()).toBe(false);
    expect(game.clamp).not.toBeNull();
    expect(game.useShutoff()).toBe(true);
    expect(game.spawnPause).toBeGreaterThan(0);
    game.callNextWave();
    step(game, 2);
    expect(game.enemies.length).toBe(0);
    step(game, 3);
    expect(game.enemies.length).toBe(1);
  });

  it('goes down and comes back', () => {
    const game = makeGame({}, true);
    game.damageHero(9999);
    expect(game.hero.downed).toBeGreaterThan(0);
    step(game, 13);
    expect(game.hero.downed).toBeLessThanOrEqual(0);
    expect(game.hero.hp).toBe(game.hero.maxHp);
  });
});

describe('Waves and economy', () => {
  it('pays an early-call bonus and wins when the field clears', () => {
    const game = makeGame();
    game.placeTower(0, 'torch');
    game.placeTower(1, 'torch');
    const before = game.money;
    const bonus = game.callNextWave();
    expect(bonus).toBeGreaterThan(0);
    expect(game.money).toBe(before + bonus);
    step(game, 15);
    expect(game.status).toBe('won');
  });

  it('auto-starts the first wave after the countdown', () => {
    const game = makeGame();
    step(game, 21);
    expect(game.waveIdx).toBe(1);
  });

  it('difficulty scales hp and lives', () => {
    const master = new Game(STRAIGHT, { difficulty: DIFFICULTIES.master, mods: neutralModifiers(), seed: 1 });
    expect(master.lives).toBe(Math.round(STRAIGHT.lives * 0.5));
    expect(master.spawnEnemy('drip', 0).maxHp).toBe(Math.round(ENEMIES.drip.hp * 1.3));
  });
});

describe('Skills and save', () => {
  it('modifiers stack from unlocked nodes and tiers gate each other', () => {
    const m = buildModifiers(['sharpTools', 'startingFloat']);
    expect(m.towerDamage).toBeCloseTo(1.1);
    expect(m.startMoney).toBe(80);
    const owned = new Set(['sharpTools']);
    expect(canUnlock('bulkDiscount', owned)).toBe(true);
    expect(canUnlock('longReach', owned)).toBe(false);
    expect(canUnlock('sharpTools', owned)).toBe(false);
  });

  it('save store tracks stars forward-only and unlocks maps in order', () => {
    const save = new SaveStore(null);
    expect(save.isUnlocked(0)).toBe(true);
    expect(save.isUnlocked(1)).toBe(false);
    save.recordClear('crawlspace', 'journeyman', 2);
    save.recordClear('crawlspace', 'journeyman', 1);
    expect(save.starsFor('crawlspace')).toBe(2);
    expect(save.isUnlocked(1)).toBe(true);
    expect(save.unlockSkill('sharpTools')).toBe(true);
    expect(save.unlockSkill('bulkDiscount')).toBe(true);
    expect(save.unlockSkill('longReach')).toBe(false);
    save.respec();
    expect(save.availableStars()).toBe(2);
  });

  it('stars for a clear follow the lives kept', () => {
    expect(starsForClear(20, 20)).toBe(3);
    expect(starsForClear(12, 20)).toBe(2);
    expect(starsForClear(1, 20)).toBe(1);
  });
});
