import { describe, expect, it } from 'vitest';
import { DIFFICULTIES } from '../src/data/difficulty';
import { CRAWLSPACE } from '../src/data/maps/crawlspace';
import { neutralModifiers } from '../src/data/skills';
import { specializationInfo } from '../src/data/specializations';
import { TOWERS, TOWER_ORDER } from '../src/data/towers';
import type { TowerId } from '../src/data/types';
import { Game } from '../src/sim/game';
import { applyDamage } from '../src/sim/combat';

function game(): Game {
  return new Game({ ...CRAWLSPACE, paths: [[{ x: 20, y: 200 }, { x: 920, y: 200 }]],
    slots: [{ x: 300, y: 150 }, { x: 360, y: 150 }], startMoney: 6000,
    allowedTowers: TOWER_ORDER, jeffStart: { x: 300, y: 230 },
  }, { difficulty: DIFFICULTIES.journeyman, mods: neutralModifiers(), manualStart: true, heroEnabled: false });
}
function step(g: Game, seconds: number): void { for (let i = 0; i < seconds * 60; i++) g.update(1 / 60); }
function elite(g: Game, id: TowerId): number {
  expect(g.placeTower(0, id)).toBe(true);
  const t = g.towers[0]!;
  expect(g.upgradeTower(t.id)).toBe(true); expect(g.upgradeTower(t.id)).toBe(true);
  return t.id;
}

describe('Player preparation and wave intelligence', () => {
  it('waits indefinitely for the first player call, then resumes wave timing', () => {
    const g = game(); step(g, 60);
    expect(g.waveIdx).toBe(0); expect(g.enemies).toHaveLength(0);
    g.callNextWave(); step(g, 1);
    expect(g.waveIdx).toBe(1); expect(g.enemies.length).toBeGreaterThan(0);
  });
  it('previews exact counts per route without consuming waves', () => {
    const g = game();
    expect(g.nextWavePreview()).toEqual([{ enemy: 'drip', count: 6, path: 0 }]);
    expect(g.waveIdx).toBe(0); expect(g.seen.size).toBe(0);
  });
});

describe('Elite investments', () => {
  it.each(TOWER_ORDER)('%s can specialize without mutating the catalogue or another pad', id => {
    const g = game(); const tid = elite(g, id); g.placeTower(1, id);
    const original = JSON.stringify(TOWERS[id]);
    const cash = g.money, invested = g.towers[0]!.invested;
    const cost = specializationInfo(TOWERS[id], 'power').cost;
    expect(g.specializeTower(tid, 'power')).toBe(true);
    expect(g.money).toBe(cash - cost);
    expect(g.towers[0]!.invested).toBe(invested + cost);
    expect(JSON.stringify(TOWERS[id])).toBe(original);
    expect(g.towers[1]!.def).toBe(TOWERS[id]);
    expect(g.specializeTower(tid, 'control')).toBe(false);
    expect(g.money).toBe(cash - cost);
    expect(g.sellValue(g.towers[0]!)).toBe(Math.round((invested + cost) * g.mods.sellRate));
  });
  it('rejects early, unaffordable, and completed-run purchases without spending', () => {
    const g = game(); g.placeTower(0, 'torch'); const t = g.towers[0]!;
    const money = g.money;
    expect(g.specializeTower(t.id, 'control')).toBe(false); expect(g.money).toBe(money);
    g.upgradeTower(t.id); g.upgradeTower(t.id); g.money = 0;
    expect(g.specializeTower(t.id, 'power')).toBe(false); expect(t.specialization).toBeUndefined();
    g.money = 1000; g.status = 'won';
    expect(g.specializeTower(t.id, 'power')).toBe(false); expect(g.money).toBe(1000);
  });
  it('control pulses honor air/ground targeting, cooldowns, and armor shred', () => {
    const g = game(); const tid = elite(g, 'washer'); g.specializeTower(tid, 'control');
    const ground = g.spawnEnemy('sludge', 0, 280), air = g.spawnEnemy('steamWisp', 0, 280);
    step(g, 1 / 60);
    expect(ground.stun).toBeGreaterThan(0); expect(ground.armorShred).toBeGreaterThan(0);
    expect(air.stun).toBe(0);
    expect(g.towerById(tid)!.eliteCooldown).toBe(7);
    const late = g.spawnEnemy('sludge', 0, 280); step(g, 0.1);
    expect(late.stun).toBe(0);
  });
  it('medic barracks heal nearby Jeff without reviving a downed hero', () => {
    const g = game(); Object.defineProperty(g, 'heroEnabled', { value: true });
    const tid = elite(g, 'barricade'); g.specializeTower(tid, 'control');
    g.hero.hp = 50; step(g, 0.1); expect(g.hero.hp).toBeGreaterThan(50);
    g.hero.hp = 0; g.hero.downed = 10; step(g, 0.1); expect(g.hero.hp).toBe(0);
  });
  it('an elite camera strengthens the mark without stacking several cameras', () => {
    const g = game(); const tid = elite(g, 'camera'); g.specializeTower(tid, 'power'); g.placeTower(1, 'camera');
    const enemy = g.spawnEnemy('sludge', 0, 300); step(g, 1 / 60);
    expect(enemy.markBonus).toBe(0.38);
    const dealt = applyDamage(g, enemy, 10, 'heat', 'radiant');
    expect(dealt).toBeCloseTo(13.8);
  });
});

describe('Support crew and rally orders', () => {
  it('only spends a cooldown on a valid visible route, prevents repeat deployment', () => {
    const g = game();
    expect(g.reinforce({ x: 300, y: 500 })).toBe(false);
    expect(g.reinforce({ x: NaN, y: 200 })).toBe(false);
    expect(g.reinforce({ x: -10, y: 200 })).toBe(false);
    expect(g.crewCooldown).toBe(0);
    expect(g.reinforce({ x: 300, y: 190 })).toBe(true);
    expect(g.crew).toHaveLength(2); expect(g.crewCooldown).toBe(30);
    expect(g.reinforce({ x: 300, y: 200 })).toBe(false); expect(g.crew).toHaveLength(2);
  });
  it('holds only ground enemies and attributes damage separately from Jeff and towers', () => {
    const g = game(); g.reinforce({ x: 300, y: 200 });
    const enemy = g.spawnEnemy('sludge', 0, 280), flyer = g.spawnEnemy('steamWisp', 0, 280);
    const hp = enemy.hp; step(g, 0.5);
    expect(enemy.heldBy?.kind).toBe('crew'); expect(flyer.heldBy).toBeNull();
    expect(enemy.hp).toBeLessThan(hp); expect(g.stats.crewDamage).toBeGreaterThan(0);
    expect(g.stats.jeffDamage).toBe(0);
  });
  it('releases holds when the crew expires and allows a new deployment after recharge', () => {
    const g = game(); g.reinforce({ x: 300, y: 200 });
    const enemy = g.spawnEnemy('sludge', 0, 280);
    enemy.def = { ...enemy.def, dps: 0 }; enemy.hp = enemy.maxHp = 10000;
    step(g, 0.1); expect(enemy.heldBy?.kind).toBe('crew');
    step(g, 18); expect(g.crew).toHaveLength(0); expect(enemy.heldBy).toBeNull();
    step(g, 12); expect(g.reinforce({ x: 500, y: 200 })).toBe(true);
  });
  it('releases a killed helper immediately', () => {
    const g = game(); g.reinforce({ x: 300, y: 200 });
    const e = g.spawnEnemy('sludge', 0, 280); step(g, 0.1);
    const id = e.heldBy?.kind === 'crew' ? e.heldBy.id : -1;
    const c = g.crew.find(crew => crew.id === id)!;
    c.hp = 1; e.attackTimer = 0; step(g, 1 / 60);
    expect(c.hp).toBe(1); // Enemy damage waits for the contact frame.
    step(g, .35);
    expect(c.hp).toBe(0); expect(e.heldBy).not.toEqual({ kind: 'crew', id });
  });
  it('stuns stop an enemy attacking its holder', () => {
    const g = game(); g.reinforce({ x: 300, y: 200 });
    const e = g.spawnEnemy('sludge', 0, 280); e.stun = 2; e.attackTimer = 0;
    step(g, 0.5); expect(g.crew.every(c => c.hp === c.maxHp)).toBe(true);
  });
  it('bounds rally orders and releases enemies before moving a barricade crew', () => {
    const g = game(); g.placeTower(0, 'barricade'); const t = g.towers[0]!;
    const e = g.spawnEnemy('sludge', 0, 280); step(g, 0.1);
    expect(e.heldBy?.kind).toBe('tower'); const old = { ...t.rally };
    expect(g.setRally(t.id, { x: 800, y: 200 })).toBe(false); expect(t.rally).toEqual(old);
    expect(g.setRally(t.id, { x: 400, y: 210 })).toBe(true);
    expect(t.rally).toEqual({ x: 400, y: 200 }); expect(e.heldBy).toBeNull();
  });
});
