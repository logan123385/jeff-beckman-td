import { describe, expect, it } from 'vitest';
import { FIXED_DT } from '../src/core/loop';
import { DIFFICULTIES } from '../src/data/difficulty';
import { ENEMIES, ENEMY_ORDER } from '../src/data/enemies';
import { Rng } from '../src/core/rng';
import { applyAffix, gearScore, rollChest } from '../src/data/loot';
import { availableTowers, LOADOUT_SIZE, resolveLoadout, unlockedTowers } from '../src/data/loadout';
import { CORE_MAPS, MAPS } from '../src/data/maps';
import { CRAWLSPACE } from '../src/data/maps/crawlspace';
import { MECHANICAL_ROOM } from '../src/data/maps/mechanicalRoom';
import { SERVICE_CALL } from '../src/data/maps/serviceCall';
import { generateEndlessWave, nightMutatorAt } from '../src/data/night';
import { buildRunModifiers, chestsForRun, xpForRun } from '../src/data/progress';
import { buildModifiers, canUnlock, neutralModifiers } from '../src/data/skills';
import { applyTalents, canUnlockTalent } from '../src/data/talents';
import { TOWERS, TOWER_ORDER } from '../src/data/towers';
import type { MapDef, TowerId } from '../src/data/types';
import { JEFF } from '../src/data/jeff';
import { JEFF_LEVEL_CAP, levelFromXp, nightXp, talentPointsAvailable, xpBarCopy, xpToNext } from '../src/data/xp';
import { applyDamage, estimateDamage, pickTarget } from '../src/sim/combat';
import { Game } from '../src/sim/game';
import { Path } from '../src/sim/path';
import { INVENTORY_CAP, SaveStore, starsForClear } from '../src/save/save';

const STRAIGHT: MapDef = {
  ...CRAWLSPACE,
  id: 'test-straight',
  paths: [[{ x: 0, y: 100 }, { x: 400, y: 100 }]],
  slots: [{ x: 200, y: 60 }, { x: 200, y: 160 }, { x: 140, y: 60 }],
  jeffStart: { x: 200, y: 300 },
  startMoney: 1000,
  allowedTowers: [
    'torch',
    'washer',
    'barricade',
    'vent',
    'radiant',
    'expansion',
    'pipeSnake',
    'backflow',
    'descaler',
    'circulator',
    'prv',
    'boiler',
    'hammerDrill',
    'glycol',
    'sump',
    'camera',
  ],
  waves: [{ groups: [{ enemy: 'drip', count: 1, interval: 1, delay: 0, path: 0 }] }],
};

function makeGame(overrides: Partial<MapDef> = {}, heroEnabled = false, loadout?: TowerId[]): Game {
  const game = new Game({ ...STRAIGHT, ...overrides }, { difficulty: DIFFICULTIES.journeyman, mods: neutralModifiers(), seed: 3, heroEnabled, loadout });
  if (heroEnabled) game.deployHero({ ...game.map.jeffStart });
  return game;
}

function finishBuild(game: Game): void {
  for (const t of game.towers) t.build = 0;
}

function step(game: Game, seconds: number): void {
  const n = Math.round(seconds / FIXED_DT);
  for (let i = 0; i < n; i++) game.update(FIXED_DT);
}

describe('Path', () => {
  it('positions by progress and reports length', () => {
    const p = new Path([{ x: 0, y: 0 }, { x: 100, y: 0 }, { x: 100, y: 50 }]);
    expect(p.length).toBeGreaterThan(149);
    expect(p.length).toBeLessThan(160);
    expect(p.pointAt(0)).toEqual({ x: 0, y: 0 });
    expect(p.pointAt(p.length).x).toBeCloseTo(100, 5);
    expect(p.pointAt(p.length).y).toBeCloseTo(50, 5);
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
    expect(game.lives).toBe(Math.round(STRAIGHT.lives * DIFFICULTIES.journeyman.livesMult) - 1);
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
    expect(game.money).toBe(before + Math.round(ENEMIES.drip.bounty * game.difficulty.bountyMult));
    expect(game.stats.towerDamage.torch).toBe(drip.maxHp);
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

  it('strong aim prefers the tougher leak even if it is further back', () => {
    const game = makeGame();
    game.placeTower(0, 'torch');
    const t = game.towers[0]!;
    t.aim = 'strong';
    const drip = game.spawnEnemy('drip', 0, 240);
    const crab = game.spawnEnemy('scaleCrab', 0, 180);
    drip.pos = game.paths[0]!.pointAt(240);
    crab.pos = game.paths[0]!.pointAt(180);
    expect(crab.maxHp).toBeGreaterThan(drip.maxHp);
    expect(pickTarget(game, t, 400)?.id).toBe(crab.id);
    t.aim = 'first';
    expect(pickTarget(game, t, 400)?.id).toBe(drip.id);
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
    expect(drip.heldBy?.kind).toBe('friendly');
    const holder = drip.heldBy;
    expect(game.friendlies.find(f => holder?.kind === 'friendly' && f.id === holder.id)?.towerId).toBe(b.id);
    const held = drip.progress;
    step(game, 0.5);
    expect(drip.progress).toBe(held);
  });

  it('apprentice melee waits for the contact pose and respects attack recovery', () => {
    const game = makeGame();
    game.placeTower(0, 'barricade');
    const b = game.towers[0]!;
    finishBuild(game);
    for (const f of game.friendlies) f.pos = { ...b.rally };
    const drip = game.spawnEnemy('drip', 0, 200);
    drip.pos = { ...b.rally };
    drip.def = { ...drip.def, dps: 0, speed: 0 };
    drip.hp = drip.maxHp = 10000;
    step(game, FIXED_DT);
    expect(drip.hp).toBe(10000);
    step(game, .34);
    const afterFirst = drip.hp;
    expect(afterFirst).toBeLessThan(10000);
    step(game, 0.6);
    expect(drip.hp).toBe(afterFirst);
    step(game, 0.45);
    expect(drip.hp).toBeLessThan(afterFirst);
  });

  it('pressure spikes knock out individual apprentices quickly', () => {
    const game = makeGame();
    game.placeTower(0, 'barricade');
    const b = game.towers[0]!;
    finishBuild(game);
    for (const f of game.friendlies) f.pos = { ...b.rally };
    const spike = game.spawnEnemy('pressureSpike', 0, 190);
    spike.pos = game.paths[0]!.pointAt(190);
    step(game, 5);
    expect(game.friendlies.some(f => f.respawn > 0 || f.hp < f.maxHp)).toBe(true);
    expect(b.rebuild).toBe(0);
  });

  it('radiant coil slows ground enemies and protects towers from freezing', () => {
    const game = makeGame();
    game.placeTower(0, 'radiant');
    game.placeTower(2, 'torch');
    finishBuild(game);
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
    finishBuild(game);
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

  it('engages a clicked enemy, attributing damage to jeff', () => {
    const game = makeGame({ jeffStart: { x: 200, y: 100 } }, true);
    const crab = game.spawnEnemy('scaleCrab', 0, 195);
    expect(game.commandHeroAttack(crab.id)).toBe(true);
    step(game, 2.5);
    expect(game.stats.jeffDamage).toBeGreaterThan(0);
    expect(crab.armorShred).toBeGreaterThan(0);
    expect(crab.heldBy).toEqual({ kind: 'hero' });
  });

  it('keeps a wrench order while an airlock phases', () => {
    const game = makeGame({ jeffStart: { x: 200, y: 100 } }, true);
    const bubble = game.spawnEnemy('airlock', 0, 195);
    const other = game.spawnEnemy('drip', 0, 195);
    expect(game.commandHeroAttack(bubble.id)).toBe(true);
    bubble.phased = true;
    step(game, 0.3);
    expect(game.hero.orderTargetId).toBe(bubble.id);
    expect(game.hero.engaged).toBe(true);
    expect(game.stats.jeffDamage).toBe(0);
    expect(other.hp).toBe(other.maxHp);
    bubble.phased = false;
    step(game, 1.2);
    expect(game.stats.jeffDamage).toBeGreaterThan(0);
  });

  it('can lock a wrench order onto a phased leak', () => {
    const game = makeGame({ jeffStart: { x: 200, y: 100 } }, true);
    const bubble = game.spawnEnemy('airlock', 0, 195);
    bubble.phased = true;
    expect(game.commandHeroAttack(bubble.id)).toBe(true);
    expect(game.hero.orderTargetId).toBe(bubble.id);
  });

  it('defends his posted position without chasing when no attack order is given', () => {
    const game = makeGame({ jeffStart: { x: 200, y: 100 } }, true);
    const crab = game.spawnEnemy('scaleCrab', 0, 195);
    step(game, 1.5);
    expect(game.stats.jeffDamage).toBeGreaterThan(0);
    expect(game.hero.orderTargetId).toBeNull();
    expect(crab.hp).toBeLessThan(crab.maxHp);
    expect(game.hero.pos).toEqual({ x: 200, y: 100 });
    expect(game.hero.engaged).toBe(false);
  });

  it('keeps hunting the next leak after the clicked one dies', () => {
    const game = makeGame({ jeffStart: { x: 200, y: 100 } }, true);
    const first = game.spawnEnemy('drip', 0, 195);
    first.hp = 8;
    const second = game.spawnEnemy('drip', 0, 195);
    second.pos = { x: first.pos.x + 18, y: first.pos.y };
    second.def = { ...second.def, speed: 0, dps: 0 };
    second.hp = second.maxHp = 10000;
    expect(game.commandHeroAttack(first.id)).toBe(true);
    step(game, 4);
    expect(first.dead).toBe(true);
    expect(game.hero.engaged).toBe(true);
    expect(second.hp).toBeLessThan(second.maxHp);
  });

  it('a move order calls Jeff off the hunt', () => {
    const game = makeGame({ jeffStart: { x: 200, y: 100 } }, true);
    const crab = game.spawnEnemy('scaleCrab', 0, 195);
    expect(game.commandHeroAttack(crab.id)).toBe(true);
    expect(game.commandHero({ x: 40, y: 40 })).toBe(true);
    expect(game.hero.engaged).toBe(false);
    const before = crab.hp;
    step(game, 1.2);
    expect(crab.hp).toBe(before);
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
    step(game, JEFF.shutoff.duration);
    expect(game.enemies.length).toBeGreaterThan(0);
  });

  it('goes down and comes back', () => {
    const game = makeGame({}, true);
    game.damageHero(9999);
    expect(game.hero.downed).toBeGreaterThan(0);
    expect(game.hero.orderTargetId).toBeNull();
    step(game, 13);
    expect(game.hero.downed).toBeLessThanOrEqual(0);
    expect(game.hero.hp).toBe(game.hero.maxHp);
  });

  it('is ready to redeploy after the downed timer', () => {
    const game = makeGame({ jeffStart: { x: 40, y: 50 } }, true);
    expect(game.commandHero({ x: 400, y: 300 })).toBe(true);
    step(game, 5);
    expect(game.hero.pos.x).toBeGreaterThan(100);
    game.damageHero(9999);
    expect(game.hero.deployed).toBe(false);
    step(game, 13);
    expect(game.hero.downed).toBeLessThanOrEqual(0);
    expect(game.hero.deployed).toBe(false);
    expect(game.hero.hp).toBe(game.hero.maxHp);
    expect(game.deployHero({ x: 40, y: 50 })).toBe(true);
    expect(game.hero.pos).toEqual({ x: 40, y: 50 });
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
    expect(master.lives).toBe(Math.round(STRAIGHT.lives * DIFFICULTIES.master.livesMult));
    expect(master.spawnEnemy('drip', 0).maxHp).toBe(Math.round(ENEMIES.drip.hp * DIFFICULTIES.master.hpMult));
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
    expect(save.availableStars()).toBe(2);
  });

  it('stars for a clear follow the lives kept', () => {
    expect(starsForClear(20, 20)).toBe(3);
    expect(starsForClear(12, 20)).toBe(2);
    expect(starsForClear(1, 20)).toBe(1);
  });

  it('remaster first-clears add one star and The Neverending Service Call records waves', () => {
    const save = new SaveStore(null);
    save.recordClear('crawlspace', 'journeyman', 2);
    expect(save.recordRemaster('crawlspace', 'codeInspection')).toBe(true);
    expect(save.recordRemaster('crawlspace', 'codeInspection')).toBe(false);
    expect(save.totalStars()).toBe(3);
    save.recordServiceCall(12);
    save.recordServiceCall(8);
    expect(save.data.serviceCallBest).toBe(12);
    expect(save.campaignComplete()).toBe(false);
  });

  it('unlocks The Neverending Service Call after the first four service calls', () => {
    const save = new SaveStore(null);
    expect(save.serviceCallUnlocked()).toBe(false);
    for (const map of CORE_MAPS.slice(0, 3)) save.recordClear(map.id, 'journeyman', 1);
    expect(save.serviceCallUnlocked()).toBe(false);
    save.recordClear(CORE_MAPS[3]!.id, 'journeyman', 1);
    expect(save.serviceCallUnlocked()).toBe(true);
    expect(save.campaignComplete()).toBe(false);
  });
});

describe('Stage 2 towers and remasters', () => {
  it('Code Inspection bans the map’s intended tools', () => {
    const game = new Game(STRAIGHT, {
      difficulty: DIFFICULTIES.journeyman,
      mods: neutralModifiers(),
      remaster: 'codeInspection',
    });
    expect(game.allowedTowers.includes('washer')).toBe(false);
    expect(game.placeTower(0, 'washer')).toBe(false);
    expect(game.placeTower(0, 'torch')).toBe(true);
  });

  it('Frozen Main is one life and lengthens freezes', () => {
    const game = new Game(STRAIGHT, {
      difficulty: DIFFICULTIES.master,
      mods: neutralModifiers(),
      remaster: 'frozenMain',
    });
    expect(game.lives).toBe(1);
    expect(game.freezeDurationMult).toBeGreaterThan(1);
  });

  it('Pipe Snake hits every enemy on its pipe stretch', () => {
    const game = makeGame();
    game.placeTower(0, 'pipeSnake');
    const a = game.spawnEnemy('drip', 0, 200);
    const b = game.spawnEnemy('drip', 0, 280);
    a.pos = game.paths[0]!.pointAt(200);
    b.pos = game.paths[0]!.pointAt(280);
    step(game, 1.2);
    expect(a.hp).toBeLessThan(a.maxHp);
    expect(b.hp).toBeLessThan(b.maxHp);
  });

  it('Backflow shoves a ground enemy backward along the pipe', () => {
    const game = makeGame();
    game.placeTower(0, 'backflow');
    finishBuild(game);
    const drip = game.spawnEnemy('drip', 0, 200);
    drip.pos = game.paths[0]!.pointAt(200);
    const before = drip.progress;
    step(game, 1);
    expect(drip.progress).toBeLessThan(before);
  });

  it('Descaler shreds mineral armor and applies a DoT', () => {
    const game = makeGame();
    game.placeTower(0, 'descaler');
    const crab = game.spawnEnemy('scaleCrab', 0, 200);
    crab.pos = game.paths[0]!.pointAt(200);
    step(game, 1.5);
    expect(crab.armorShred).toBeGreaterThan(0);
    expect(crab.dotDps).toBeGreaterThan(0);
  });

  it('The Neverending Service Call can clock out as a soft exit after a wave starts', () => {
    const game = new Game(SERVICE_CALL, { difficulty: DIFFICULTIES.apprentice, mods: neutralModifiers(), seed: 2 });
    expect(game.endless).toBe(true);
    expect(game.retire()).toBe(false);
    expect(nightXp(0, true)).toBe(0);
    game.callNextWave();
    expect(game.retire()).toBe(true);
    expect(game.status).toBe('retired');
  });
});

describe('Stage 3 progression and kit', () => {
  it('Hammer Drill deals extra damage to armored targets', () => {
    const game = makeGame();
    const crab = game.spawnEnemy('scaleCrab', 0);
    const drip = game.spawnEnemy('drip', 0);
    const vsCrab = applyDamage(game, crab, 10, 'physical', 'hammerDrill');
    const vsDrip = applyDamage(game, drip, 10, 'physical', 'hammerDrill');
    expect(vsDrip).toBeCloseTo(10);
    expect(vsCrab).toBeCloseTo(10 * (1 + ENEMIES.scaleCrab.armor * TOWERS.hammerDrill.armorBonus!));
    expect(vsCrab).toBeGreaterThan(vsDrip);
  });

  it('Sump Pump pulls a ground enemy back toward the basin', () => {
    const game = makeGame();
    game.placeTower(0, 'sump');
    const drip = game.spawnEnemy('drip', 0, 260);
    drip.pos = game.paths[0]!.pointAt(260);
    drip.stun = 4;
    const before = drip.progress;
    step(game, 1.2);
    expect(drip.progress).toBeLessThan(before);
  });

  it('Inspection Camera marks enemies and pops a phase', () => {
    const game = makeGame();
    game.placeTower(0, 'camera');
    finishBuild(game);
    const bubble = game.spawnEnemy('airlock', 0, 200);
    bubble.pos = game.paths[0]!.pointAt(200);
    bubble.phased = true;
    step(game, FIXED_DT);
    expect(bubble.phased).toBe(false);
    expect(bubble.marked).toBe(true);
  });

  it('Jeff XP and talent points track from jobs', () => {
    expect(levelFromXp(0).level).toBe(1);
    expect(levelFromXp(xpToNext(1)).level).toBe(2);
    expect(talentPointsAvailable(xpToNext(1), 0)).toBe(1);
    const owned = new Set<string>();
    expect(canUnlockTalent('ironGrip', owned)).toBe(true);
    expect(canUnlockTalent('wreckingTap', owned)).toBe(false);
  });

  it('folds equipped armor into a run', () => {
    const save = new SaveStore(null);
    const item = {
      kind: 'armor' as const,
      id: 'g-run',
      name: 'test vest',
      slot: 'chest' as const,
      rarity: 'rare' as const,
      affixes: [{ key: 'towerDamage' as const, amount: 0.1 }],
    };
    expect(save.addGear(item).kept).toBe(true);
    expect(save.equipArmor(item.id)).toBe(true);
    const m = buildRunModifiers(save);
    expect(m.towerDamage).toBeCloseTo(1.1);
    expect(save.hasAnyProgress()).toBe(true);
  });

  it('Get Closer spends on reach and wrench damage, not leftover aggro', () => {
    const m = neutralModifiers();
    applyTalents(m, ['closer']);
    expect(m.jeffReach).toBeCloseTo(1.2);
    expect(m.jeffDamage).toBeCloseTo(1.15);
  });

  it('chests roll gear and affixes fold into modifiers', () => {
    const item = rollChest(new Rng(11), 'clean', 'g-test');
    expect(item.affixes.length).toBeGreaterThan(0);
    const m = neutralModifiers();
    applyAffix(m, { key: 'jeffDamage', amount: 0.1 });
    expect(m.jeffDamage).toBeCloseTo(1.1);
    expect(item.kind === 'weapon' || item.kind === 'armor').toBe(true);
  });

  it('The Neverending Service Call mutators rotate and clock-out banks chests', () => {
    expect(nightMutatorAt(0)).toBe('rushHour');
    expect(nightMutatorAt(5)).not.toBe(nightMutatorAt(0));
    const wave = generateEndlessWave(12, 2);
    expect(wave.groups.length).toBeGreaterThan(0);
    const game = new Game(SERVICE_CALL, { difficulty: DIFFICULTIES.apprentice, mods: neutralModifiers(), seed: 4 });
    expect(game.nightMutator).toBeNull();
    for (let i = 0; i < SERVICE_CALL.waves.length; i++) {
      expect(game.callNextWave()).toBeGreaterThanOrEqual(0);
      expect(game.nightMutator).toBeNull();
      game.spawns.length = 0;
      for (const e of game.enemies) e.dead = true;
    }
    game.callNextWave();
    expect(game.nightMutator).toBe('rushHour');
    expect(game.nightMutator).toBe(nightMutatorAt(0));
    const mid = new Game(SERVICE_CALL, { difficulty: DIFFICULTIES.apprentice, mods: neutralModifiers(), seed: 4 });
    mid.waveIdx = 12; mid.completedWaves = 11;
    mid.retire();
    expect(chestsForRun(mid, 0).length).toBeGreaterThan(0);
    expect(xpForRun(mid, 0)).toBeGreaterThan(0);
    const mile = new Game(SERVICE_CALL, { difficulty: DIFFICULTIES.apprentice, mods: neutralModifiers(), seed: 5 });
    mile.waveIdx = 15; mile.completedWaves = 15;
    mile.retire();
    expect(chestsForRun(mile, 0)).toEqual(['night', 'night', 'deepNight']);
  });

  it('only first-clears drop campaign chests', () => {
    const classic = makeGame();
    classic.status = 'won';
    expect(chestsForRun(classic, 3, true)).toEqual(['clean']);
    expect(chestsForRun(classic, 2, true)).toEqual(['job']);
    expect(chestsForRun(classic, 3, false)).toEqual([]);
    const remaster = new Game(STRAIGHT, {
      difficulty: DIFFICULTIES.journeyman,
      mods: neutralModifiers(),
      remaster: 'codeInspection',
      seed: 1,
    });
    remaster.status = 'won';
    expect(chestsForRun(remaster, 1, true)).toEqual(['remaster']);
    expect(chestsForRun(remaster, 1, false)).toEqual([]);
  });

  it('save store banks XP and locker gear', () => {
    const save = new SaveStore(null);
    save.addXp(xpToNext(1) + xpToNext(2));
    expect(save.jeffLevel()).toBe(3);
    const item = rollChest(new Rng(3), 'job', save.nextGearId());
    expect(save.addGear(item).kept).toBe(true);
    expect(save.itemById(item.id)?.id).toBe(item.id);
  });

  it('full locker salvages the weakest item, not just the lowest rarity', () => {
    const save = new SaveStore(null);
    const weak = { kind: 'armor' as const, id: 'weak', name: 'weak', slot: 'boots' as const, rarity: 'uncommon' as const, affixes: [{ key: 'jeffSpeed' as const, amount: 0.01 }] };
    const strongCommon = { kind: 'armor' as const, id: 'strong', name: 'strong', slot: 'chest' as const, rarity: 'common' as const, affixes: [{ key: 'jeffHp' as const, amount: 0.2 }] };
    expect(gearScore(strongCommon)).toBeGreaterThan(gearScore(weak));
    for (let i = 0; i < INVENTORY_CAP - 1; i++) {
      const pad = { kind: 'armor' as const, id: `pad-${i}`, name: 'pad', slot: 'chest' as const, rarity: 'uncommon' as const, affixes: [{ key: 'cooldown' as const, amount: 0.12 }] };
      save.addGear(pad);
    }
    save.addGear(weak);
    const junkIn = { kind: 'armor' as const, id: 'junk-in', name: 'junk', slot: 'chest' as const, rarity: 'common' as const, affixes: [{ key: 'startMoney' as const, amount: 20 }] };
    expect(gearScore(junkIn)).toBeLessThan(gearScore(weak));
    expect(save.addGear(junkIn).kept).toBe(false);
    expect(save.itemById('weak')).toBeTruthy();
    const kept = save.addGear(strongCommon);
    expect(kept.kept).toBe(true);
    expect(save.itemById('strong')).toBeTruthy();
    expect(save.itemById('weak')).toBeUndefined();
  });

  it('hides XP-to-next once Jeff is max level', () => {
    expect(xpBarCopy({ level: JEFF_LEVEL_CAP, into: 12, need: 40 })).toBe('Max level');
    expect(xpBarCopy({ level: 1, into: 4, need: 40 })).toBe('4 / 40 XP to next');
  });
});

describe('Loadout and new kit', () => {
  it('fills a Kingdom Rush-style bag and ignores illegal picks', () => {
    expect(resolveLoadout(['vent', 'torch', 'torch'], ['torch', 'washer', 'barricade'])).toEqual(['torch', 'washer', 'barricade']);
    expect(resolveLoadout(['washer', 'torch', 'barricade', 'vent', 'radiant', 'expansion'], CRAWLSPACE.allowedTowers)).toEqual([
      'washer',
      'torch',
      'barricade',
    ]);
    expect(resolveLoadout(undefined, CRAWLSPACE.allowedTowers)).toHaveLength(CRAWLSPACE.allowedTowers.length);
    expect(LOADOUT_SIZE).toBe(5);
  });

  it('uses permanent store licenses on every job while respecting inspection bans', () => {
    const save = new SaveStore(null);
    expect(save.data.lastLoadout).toEqual([]);
    expect(unlockedTowers(save)).toEqual(['torch', 'washer', 'barricade']);
    expect(availableTowers(save, SERVICE_CALL, 'classic')).toEqual(['torch', 'washer', 'barricade']);
    save.setLoadout(['torch', 'washer']);
    expect(save.data.lastLoadout).toEqual(['torch', 'washer']);
    for (const map of MAPS.slice(0, 7)) save.recordClear(map.id, 'journeyman', 1);
    expect(unlockedTowers(save)).not.toContain('manifold');
    save.addServicePoints(1000); expect(save.buyTower('manifold')).toBe(true);
    expect(unlockedTowers(save)).toContain('manifold');
    expect(availableTowers(save, MECHANICAL_ROOM, 'classic')).toContain('manifold');
    expect(availableTowers(save, MECHANICAL_ROOM, 'codeInspection')).not.toContain('manifold');
    expect(availableTowers(save, SERVICE_CALL, 'classic')).toContain('manifold');
  });

  it('a picked kit is the only thing you can build; an empty kit falls back to the job pool', () => {
    const kit = makeGame({}, false, ['torch', 'washer']);
    expect(kit.allowedTowers).toEqual(['torch', 'washer']);
    expect(kit.placeTower(0, 'torch')).toBe(true);
    expect(kit.placeTower(1, 'barricade')).toBe(false);
    expect(makeGame({}, false, ['manifold']).allowedTowers).toEqual(['manifold']);
    const fallback = makeGame({}, false, []);
    expect(fallback.allowedTowers).toEqual(STRAIGHT.allowedTowers);
  });

  it('pulse shreds and stuns, sleeve and coffee respect cooldowns', () => {
    const game = makeGame({ jeffStart: { x: 200, y: 100 } }, true);
    const crab = game.spawnEnemy('scaleCrab', 0, 195);
    expect(game.usePulse()).toBe(true);
    expect(crab.stun).toBeGreaterThan(0);
    expect(crab.armorShred).toBeGreaterThan(0);
    expect(game.stats.jeffDamage).toBeGreaterThan(0);
    expect(game.usePulse()).toBe(false);
    expect(game.useSleeve()).toBe(true);
    expect(game.hero.sleeveTimer).toBeGreaterThan(0);
    expect(game.useSleeve()).toBe(false);
    game.damageHero(120);
    const hp = game.hero.hp;
    expect(game.useCoffee()).toBe(true);
    expect(game.hero.hp).toBeGreaterThan(hp);
    expect(game.hero.coffeeTimer).toBeGreaterThan(0);
    expect(game.useCoffee()).toBe(false);
  });

  it('a flange gremlin splits into two drips', () => {
    const game = makeGame();
    const gremlin = game.spawnEnemy('flangeGremlin', 0, 80);
    applyDamage(game, gremlin, 9999, 'physical', 'torch');
    expect(gremlin.dead).toBe(true);
    const kids = game.enemies.filter((e) => e.def.id === 'drip' && !e.dead);
    expect(kids.length).toBe(2);
    expect(kids.every((e) => e.progress < gremlin.progress)).toBe(true);
  });

  it('lists every enemy and tower in the catalogs', () => {
    expect([...ENEMY_ORDER].sort()).toEqual(Object.keys(ENEMIES).sort());
    expect([...TOWER_ORDER].sort()).toEqual(Object.keys(TOWERS).sort());
  });

  it('gives every campaign job an inspection lockout', () => {
    expect(MAPS.every((m) => (m.inspectionBan?.length ?? 0) > 0)).toBe(true);
  });

  it('zone valve stun respects stun-duration modifiers', () => {
    const mods = neutralModifiers();
    mods.stunDuration = 2;
    const game = new Game(
      { ...STRAIGHT, allowedTowers: [...STRAIGHT.allowedTowers, 'zoneValve'] },
      { difficulty: DIFFICULTIES.journeyman, mods, seed: 3, heroEnabled: false },
    );
    expect(game.placeTower(0, 'zoneValve')).toBe(true);
    finishBuild(game);
    const drip = game.spawnEnemy('drip', 0, 200);
    drip.pos = game.paths[0]!.pointAt(200);
    step(game, FIXED_DT * 2);
    expect(drip.stun).toBeGreaterThan(1);
  });

  it('a radiant manifold heats the primary leak and neighbors', () => {
    const game = makeGame({ allowedTowers: [...STRAIGHT.allowedTowers, 'manifold'] });
    expect(game.placeTower(0, 'manifold')).toBe(true);
    const a = game.spawnEnemy('drip', 0, 180);
    const b = game.spawnEnemy('drip', 0, 200);
    const c = game.spawnEnemy('drip', 0, 220);
    step(game, 1.2);
    expect([a, b, c].filter((e) => e.hp < e.maxHp).length).toBeGreaterThanOrEqual(2);
  });
});

describe('Review fixes', () => {
  it('reserves mitigated projectile damage, not raw tower damage', () => {
    const game = makeGame();
    expect(game.placeTower(0, 'vent')).toBe(true);
    game.towers[0]!.build = 0;
    const crab = game.spawnEnemy('scaleCrab', 0, 200);
    crab.def = { ...crab.def, speed: 0 };
    const raw = game.effectiveDamage(game.towers[0]!);
    const expected = estimateDamage(game, crab, raw, 'physical', 'vent', { groundMult: TOWERS.vent.groundMult });
    expect(expected).toBeLessThan(raw);
    expect(expected).toBeCloseTo(raw * (1 - crab.def.armor) * (TOWERS.vent.groundMult ?? 1));
    step(game, 0.14);
    expect(game.projectiles.length).toBeGreaterThan(0);
    const shot = game.projectiles[0]!;
    expect(shot.reserved).toBeCloseTo(expected);
    expect(shot.reserved).toBeLessThan(shot.damage);
    expect(crab.incoming).toBeCloseTo(expected);
    expect(crab.hp - crab.incoming).toBeGreaterThan(0);
  });

  it('keeps leak count when the next wave starts over leftovers', () => {
    const game = makeGame({
      waves: [
        { groups: [{ enemy: 'drip', count: 1, interval: 1, delay: 0, path: 0 }] },
        { groups: [{ enemy: 'drip', count: 1, interval: 1, delay: 0, path: 0 }] },
      ],
    });
    game.callNextWave();
    const a = game.spawnEnemy('drip', 0, 10);
    const b = game.spawnEnemy('drip', 0, 10);
    a.progress = game.paths[0]!.length;
    b.def = { ...b.def, speed: 0 };
    step(game, FIXED_DT);
    expect(a.escaped).toBe(true);
    expect(game.waveLeaks).toBeGreaterThan(0);
    const leaks = game.waveLeaks;
    expect(b.escaped).toBe(false);
    game.callNextWave();
    expect(game.waveLeaks).toBe(leaks);
    for (const e of game.enemies) {
      if (!e.dead && !e.escaped) {
        e.dead = true;
        e.deathAge = 0;
      }
    }
    game.spawns = [];
    const money = game.money;
    step(game, FIXED_DT);
    expect(game.effects.some((fx) => fx.kind === 'text' && String(fx.text).includes('CLEAN CALL'))).toBe(false);
    expect(game.money).toBe(money);
  });
});
