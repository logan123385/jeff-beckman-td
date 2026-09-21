import { afterEach, describe, expect, it, vi } from 'vitest';
import { GameLoop } from '../src/core/loop';
import { DIFFICULTIES } from '../src/data/difficulty';
import { COOLDOWN_FIELDS, type HeroId } from '../src/data/heroes';
import { CRAWLSPACE } from '../src/data/maps/crawlspace';
import { neutralModifiers } from '../src/data/skills';
import type { MapDef } from '../src/data/types';
import { Game } from '../src/sim/game';
import { applyDamage, pickTarget } from '../src/sim/combat';
import { updateHero } from '../src/sim/hero';
import { updateTowers } from '../src/sim/towers';
import { WaveReceiptFeed } from '../src/ui/play/receipts';
import type { WaveReport } from '../src/sim/state';

const waves: MapDef['waves'] = Array.from({ length: 3 }, () => ({ groups: [{ enemy: 'drip', count: 1, interval: 1, delay: 0, path: 0 }] }));
function field(heroId: HeroId = 'cbj', extra: Partial<MapDef> = {}) {
  return new Game({ ...CRAWLSPACE, paths: [[{ x: 20, y: 250 }, { x: 940, y: 250 }]],
    jeffStart: { x: 300, y: 250 }, slots: [{ x: 320, y: 200 }, { x: 400, y: 200 }],
    startMoney: 1000, waves, ...extra }, { heroId, difficulty: DIFFICULTIES.journeyman, mods: neutralModifiers(), manualStart: true });
}
function step(g: Game, seconds: number) { for (let i = 0; i < seconds * 60; i++) g.update(1 / 60); }
function stop(g: Game) { for (const e of g.enemies) e.def = { ...e.def, speed: 0, dps: 0 }; }

describe('Wave rhythm, overlap and honest rewards', () => {
  it('cannot buy a stack of unspawned waves by mashing the call key', () => {
    const g = field(); g.callNextWave(); const cash = g.money;
    for (let i = 0; i < 20; i++) expect(g.callNextWave()).toBe(0);
    expect(g.waveIdx).toBe(1); expect(g.money).toBe(cash);
    step(g, .1); stop(g); expect(g.canCallWave).toBe(true);
    g.callNextWave(); step(g, .1); stop(g);
    expect(g.waveIdx).toBe(2); expect(g.canCallWave).toBe(false);
    expect(g.callBlockReason).toContain('Clear a wave');
    const secondCash = g.money; g.callNextWave(); expect(g.money).toBe(secondCash);
  });
  it('caps automatic overlap at two waves and offers a six-second breather after clearing', () => {
    const g = field(); g.callNextWave();
    for (let i = 0; i < 1800; i++) { g.update(1 / 60); stop(g); }
    expect(g.waveIdx).toBe(2); expect(g.waveCountdown).toBe(0); expect(g.completedWaves).toBe(0);
    g.enemies.forEach(e => applyDamage(g, e, 1000, 'heat', 'torch')); step(g, .02);
    expect(g.waveCountdown).toBeGreaterThan(5.9); expect(g.completedWaves).toBe(2);
    step(g, 5); expect(g.waveIdx).toBe(2); step(g, 1.1); expect(g.waveIdx).toBe(3);
  });
  it('early calls recover active skills exactly once without changing respawn or buff duration', () => {
    const g = field(); g.callNextWave(); step(g, .1); stop(g);
    for (const key of COOLDOWN_FIELDS) g.hero[key] = 20;
    g.crewCooldown = 4; g.strikeCooldown = 40; g.hero.downed = 7; g.hero.overdrive = 5;
    const cash = g.money; const bonus = g.callBonus; const recovery = g.callCooldownRecovery;
    expect(recovery).toBe(8); expect(g.callNextWave()).toBe(bonus); expect(g.money).toBe(cash + bonus);
    for (const key of COOLDOWN_FIELDS) expect(g.hero[key]).toBe(12);
    expect(g.crewCooldown).toBe(0); expect(g.strikeCooldown).toBe(32);
    expect(g.hero.downed).toBe(7); expect(g.hero.overdrive).toBe(5);
    expect(g.callNextWave()).toBe(0); expect(g.callRecovery).toBe(8);
  });
  it('records a leaky wave and a clean overlapping wave independently with no duplicate payout', () => {
    const g = field(); g.callNextWave(); step(g, .1); stop(g);
    const first = g.enemies[0]!; g.callNextWave(); step(g, .1); stop(g);
    const second = g.enemies.find(e => e.waveId === 2)!;
    first.progress = g.paths[0]!.length; step(g, .1);
    expect(g.waveReports[0]).toMatchObject({ wave: 1, clean: false, leaks: 1, livesLost: 1, bonus: 0 });
    const bounty = second.def.bounty; const before = g.money;
    applyDamage(g, second, 1000, 'heat', 'torch'); step(g, .1);
    expect(g.waveReports[1]).toMatchObject({ wave: 2, clean: true, kills: 1, bonus: 20, bounty });
    expect(g.money - before).toBe(20 + bounty); expect(g.completedWaves).toBe(2);
    const paid = g.money; step(g, 1); expect(g.money).toBe(paid); expect(g.waveReports).toHaveLength(2);
  });
  it('split children retain the older wave and prevent a false clear after an early call', () => {
    const g = field('cbj', { waves: [{ groups: [{ enemy: 'scaleCrab', count: 1, interval: 1, delay: 0, path: 0 }] }, ...waves] });
    g.callNextWave(); step(g, .1); stop(g); const parent = g.enemies[0]!;
    g.callNextWave(); step(g, .1); stop(g); applyDamage(g, parent, 10000, 'heat', 'torch'); step(g, .1);
    const children = g.enemies.filter(e => !e.dead && e.waveId === 1);
    expect(children.length).toBeGreaterThan(0); expect(g.completedWaves).toBe(0);
    children.forEach(e => applyDamage(g, e, 10000, 'heat', 'torch')); step(g, .1);
    expect(g.waveReports[0]!.wave).toBe(1); expect(g.completedWaves).toBe(1);
    expect(g.waveActive).toBe(true);
  });
  it('orders clean streaks by wave number even when later waves clear first', () => {
    const g = field(); g.callNextWave(); step(g, .1); stop(g);
    const first = g.enemies[0]!;
    g.callNextWave(); step(g, .1); stop(g);
    const second = g.enemies.find(e => e.waveId === 2)!;
    second.progress = g.paths[0]!.length; step(g, .1);
    g.callNextWave(); step(g, .1); stop(g);
    const third = g.enemies.find(e => e.waveId === 3)!;
    applyDamage(g, third, 1000, 'heat', 'torch'); step(g, .1);
    applyDamage(g, first, 1000, 'heat', 'torch'); step(g, .1);
    expect(g.waveReports.map(r => r.wave)).toEqual([2, 3, 1]);
    expect(g.cleanStreak).toBe(1); expect(g.bestCleanStreak).toBe(1);
  });
  it('does not undercount a clean streak when a later leaky wave resolves first', () => {
    const g = field(); g.callNextWave(); step(g, .1); stop(g);
    const first = g.enemies[0]!;
    g.callNextWave(); step(g, .1); stop(g);
    applyDamage(g, g.enemies.find(e => e.waveId === 2)!, 1000, 'heat', 'torch'); step(g, .1);
    g.callNextWave(); step(g, .1); stop(g);
    g.enemies.find(e => e.waveId === 3)!.progress = g.paths[0]!.length; step(g, .1);
    applyDamage(g, first, 1000, 'heat', 'torch'); step(g, .1);
    expect(g.cleanStreak).toBe(0); expect(g.bestCleanStreak).toBe(2);
  });
  it('first-call cash is preserved but does not manufacture cooldown recovery', () => {
    const g = field(); g.hero.clampCooldown = 10;
    expect(g.callNextWave()).toBe(24); expect(g.hero.clampCooldown).toBe(10); expect(g.callRecovery).toBe(0);
  });
});

describe('Responsive hero orders and retreat', () => {
  it('buffers the latest move through a complete cast and executes it afterward', () => {
    const g = field(); g.deployHero(g.map.jeffStart); g.hero.hp = 200;
    expect(g.useAbility(2)).toBe(true);
    const cd = g.hero.pulseCooldown;
    expect(g.commandHero({ x: 600, y: 100 })).toBe(true);
    expect(g.commandHero({ x: 100, y: 100 })).toBe(true);
    updateHero(g, .3); expect(g.hero.pos).toEqual(g.map.jeffStart); expect(g.hero.cast).toBeDefined();
    updateHero(g, .6); expect(g.heroZones.some(z => z.kind === 'supply')).toBe(true);
    updateHero(g, .02); expect(g.hero.dest).toEqual({ x: 100, y: 100 });
    expect(g.hero.queuedOrder).toBeUndefined(); expect(g.hero.pulseCooldown).toBeLessThan(cd);
  });
  it('clears buffered orders on death and redeployment', () => {
    const g = field(); g.deployHero(g.map.jeffStart); g.useAbility(2); g.commandHero({ x: 800, y: 100 });
    g.damageHero(10000); expect(g.hero.queuedOrder).toBeUndefined(); step(g, 13);
    g.deployHero({ x: 100, y: 100 }); step(g, .1); expect(g.hero.dest).toBeNull();
  });
  it.each(['jeff', 'becbec', 'chris', 'jayjay'] as HeroId[])('%s ignores air for basic attacks and accepts ground orders', id => {
    const g = field(id); g.deployHero(g.map.jeffStart);
    const air = g.spawnEnemy('steamWisp', 0, 290); air.pos = { x: 310, y: 250 }; air.def = { ...air.def, speed: 0, dps: 0 };
    expect(g.commandHeroAttack(air.id)).toBe(false); updateHero(g, .1); expect(g.hero.pendingStrike).toBeUndefined();
    const ground = g.spawnEnemy('sludge', 0, 300); ground.pos = { x: 320, y: 250 };
    expect(g.commandHeroAttack(ground.id)).toBe(true);
  });
  it.each(['mike', 'bob', 'cbj', 'doni'] as HeroId[])('%s can still focus airborne enemies', id => {
    const g = field(id); g.deployHero(g.map.jeffStart); const air = g.spawnEnemy('steamWisp', 0, 320);
    expect(g.commandHeroAttack(air.id)).toBe(true);
  });
  it('recovers only after three quiet seconds, restarts on damage, and clamps to max health', () => {
    const g = field(); g.deployHero(g.map.jeffStart); g.hero.hp = 100;
    step(g, 2.9); expect(g.hero.hp).toBe(100);
    step(g, 1.1); expect(g.hero.hp).toBeGreaterThan(120); expect(g.hero.recovering).toBe(true);
    g.damageHero(10); const after = g.hero.hp; step(g, 2.9); expect(g.hero.hp).toBe(after);
    step(g, 30); expect(g.hero.hp).toBe(g.hero.maxHp);
  });
  it('cannot regenerate while actively fighting or before deploying', () => {
    const g = field(); g.hero.hp = 100; step(g, 6); expect(g.hero.hp).toBe(100);
    g.deployHero(g.map.jeffStart); g.hero.hp = 100;
    const e = g.spawnEnemy('sludge', 0, 320); e.hp = e.maxHp = 100000; e.def = { ...e.def, speed: 0, dps: 0 }; e.lane = 0;
    step(g, 6); expect(g.hero.hp).toBe(100); expect(g.hero.recovering).toBe(false);
  });
});

describe('Focus fire and continuous impacts', () => {
  it('focuses a selected in-range target without wasting reserved shots and returns to ordinary aim', () => {
    const g = field(); g.placeTower(0, 'torch'); const t = g.towers[0]!; t.build = 0;
    const first = g.spawnEnemy('sludge', 0, 320), focus = g.spawnEnemy('sludge', 0, 290);
    expect(pickTarget(g, t, g.effectiveRange(t))?.id).toBe(first.id);
    expect(g.focusTower(t.id, focus.id)).toBe(true); expect(pickTarget(g, t, g.effectiveRange(t))?.id).toBe(focus.id);
    focus.incoming = focus.hp + focus.shellHp; expect(pickTarget(g, t, g.effectiveRange(t))?.id).toBe(first.id);
    focus.pos.x = 900; updateTowers(g, .01); expect(t.focusTargetId).toBeUndefined();
    expect(g.hero.engaged).toBe(false);
  });
  it('rejects targets the selected tower cannot hit', () => {
    const g = field(); g.placeTower(0, 'washer'); const t = g.towers[0]!;
    const air = g.spawnEnemy('steamWisp', 0, 300); expect(g.focusTower(t.id, air.id)).toBe(false);
    const far = g.spawnEnemy('drip', 0, 850); expect(g.focusTower(t.id, far.id)).toBe(false);
    expect(t.focusTargetId).toBeUndefined();
  });
  it('skips immune mineral targets and actually fires at a vulnerable enemy behind them', () => {
    const g = field(); g.placeTower(0, 'washer'); const t = g.towers[0]!; t.build = 0; t.cooldown = 0;
    const mineral = g.spawnEnemy('limeScale', 0, 320);
    mineral.properties = [...new Set([...mineral.properties, 'mineral' as const])];
    const drip = g.spawnEnemy('drip', 0, 295);
    expect(g.focusTower(t.id, mineral.id)).toBe(false);
    // Also covers a previous focus that becomes immune after being selected.
    t.focusTargetId = mineral.id;
    expect(pickTarget(g, t, g.effectiveRange(t))?.id).toBe(drip.id);
    updateTowers(g, .2); updateTowers(g, .2);
    expect(g.projectiles[0]?.targetId).toBe(drip.id);
    expect(mineral.incoming).toBe(0);
    drip.dead = true;
    expect(pickTarget(g, t, g.effectiveRange(t))).toBeNull();
  });
  it('large ordinary kill streaks and split deaths do not freeze the simulation', () => {
    const g = field();
    for (let i = 0; i < 20; i++) applyDamage(g, g.spawnEnemy('drip', 0, 200), 1000, 'heat', 'torch');
    applyDamage(g, g.spawnEnemy('scaleCrab', 0, 200), 1000, 'heat', 'torch');
    expect(g.combo).toBeGreaterThan(20); expect(g.hitstop).toBe(0);
    const before = g.time; g.update(1 / 60); expect(g.time).toBeCloseTo(before + 1 / 60);
  });
});

describe('Pause inside a fixed-step frame', () => {
  afterEach(() => vi.unstubAllGlobals());
  it('stops the current frame immediately and discards accumulated catch-up time', () => {
    let callback: FrameRequestCallback = () => {}; let count = 0;
    vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback) => { callback = cb; return 1; });
    vi.stubGlobal('cancelAnimationFrame', () => {});
    vi.spyOn(performance, 'now').mockReturnValue(1000);
    const loop = new GameLoop({ update() { count++; loop.paused = true; }, render() {} });
    loop.speed = 3; loop.start(); callback(1100); expect(count).toBe(1);
    loop.paused = false; loop.speed = 1; callback(1110); expect(count).toBe(1);
    loop.stop(); vi.restoreAllMocks();
  });
});


describe('Every clear receipt is presented', () => {
  const report = (wave: number): WaveReport => ({ wave, kills: 1, leaks: 0, livesLost: 0, bounty: 4, bonus: 20, seconds: 10, clean: true });
  it('shows both simultaneous clears, retains reverse-order clears and never repeats them', () => {
    const feed = new WaveReceiptFeed(), reports = [report(2), report(1)];
    expect(feed.update(reports, 2, 10, false).map(r => r.wave)).toEqual([2, 1]);
    expect(feed.update(reports, 2, 11, false)).toHaveLength(2);
    expect(feed.update(reports, 2, 15, false)).toHaveLength(0);
    expect(feed.update([...reports, report(3)], 3, 16, false).map(r => r.wave)).toEqual([3]);
  });
  it('preserves receipt time while an early-call message covers it and handles a trimmed log', () => {
    const feed = new WaveReceiptFeed();
    feed.update([report(1)], 1, 10, true);
    feed.update([report(1)], 1, 15, true);
    expect(feed.update([report(1)], 1, 16, false).map(r => r.wave)).toEqual([1]);
    feed.update(Array.from({length: 30}, (_, i) => report(i + 2)), 31, 30, false);
    expect(feed.update(Array.from({length: 30}, (_, i) => report(i + 3)), 32, 35, false).map(r => r.wave)).toEqual([32]);
  });
});
