import { describe, expect, it } from 'vitest';
import { HEROES, HERO_ORDER } from '../src/data/heroes';
import { HERO_PATHS, buildBudget, normalizeHeroBuild, heroForBuild } from '../src/data/heroBuilds';
import { TOWER_ORDER } from '../src/data/towers';
import { TOWER_PRICES, WELCOME_POINTS, STARTER_TOWERS, servicePointsForRun } from '../src/data/store';
import { availableTowers } from '../src/data/loadout';
import { CRAWLSPACE } from '../src/data/maps/crawlspace';
import { MAPS } from '../src/data/maps';
import { DIFFICULTIES } from '../src/data/difficulty';
import { neutralModifiers } from '../src/data/skills';
import { grantRunRewards } from '../src/data/progress';
import { serviceRewardCopy } from '../src/ui/play/results';
import { SaveStore, normalizeSave } from '../src/save/save';
import { Game } from '../src/sim/game';

function storage() {
  const values = new Map<string, string>();
  return { length: 0, clear: () => values.clear(), key: () => null, getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => { values.set(key, value); }, removeItem: (key: string) => { values.delete(key); } };
}
function game() { return new Game(CRAWLSPACE, { difficulty: DIFFICULTIES.apprentice, mods: neutralModifiers(), manualStart: true }); }

describe('Permanent tower store', () => {
  it('starts with three tools and enough credit for a first purchase, with every license available regardless of maps', () => {
    for (const id of TOWER_ORDER) {
      const save = new SaveStore(null);
      expect(save.data.ownedTowers).toEqual(STARTER_TOWERS);
      expect(save.data.servicePoints).toBe(WELCOME_POINTS);
      expect(TOWER_PRICES[id]).toBeGreaterThanOrEqual(0);
      if (STARTER_TOWERS.includes(id)) continue;
      save.addServicePoints(TOWER_PRICES[id]);
      expect(save.buyTower(id)).toBe(true);
      expect(availableTowers(save, CRAWLSPACE, 'classic')).toContain(id);
      expect(save.totalStars()).toBe(0);
    }
    expect(new SaveStore(null).buyTower('vent')).toBe(true);
  });
  it('persists ownership and charges exactly once; rejects unaffordable and unknown tools', () => {
    const disk = storage(), save = new SaveStore(disk);
    expect(save.buyTower('zoneValve')).toBe(false);
    expect(save.buyTower('missing' as 'torch')).toBe(false);
    expect(save.buyTower('vent')).toBe(true);
    expect(save.buyTower('vent')).toBe(false);
    const restored = new SaveStore(disk);
    expect(restored.data.servicePoints).toBe(WELCOME_POINTS - TOWER_PRICES.vent);
    expect(restored.data.ownedTowers).toEqual([...STARTER_TOWERS, 'vent']);
    for (const map of MAPS) save.recordClear(map.id, 'apprentice', 3);
    expect(save.data.ownedTowers).not.toContain('zoneValve');
  });
  it('preserves tools from previously unlocked maps when migrating an old save', () => {
    const old = normalizeSave({ version: 1, stars: { crawlspace: { apprentice: 3 } }, jeffXp: 120, talents: [], skills: [] });
    for (const map of MAPS.slice(0, 2)) for (const id of map.allowedTowers) expect(old.ownedTowers).toContain(id);
    expect(old.jeffXp).toBe(120);
    expect(old.servicePoints).toBe(WELCOME_POINTS);
    const existing = normalizeSave({ ...old, ownedTowers: STARTER_TOWERS });
    expect(existing.ownedTowers).toEqual(STARTER_TOWERS);
  });
  it('sanitizes bad currency and licenses without removing starter tools', () => {
    const value = normalizeSave({ servicePoints: Infinity, ownedTowers: ['bogus', 'vent', 'vent'] } as never);
    expect(value.servicePoints).toBe(WELCOME_POINTS); expect(value.ownedTowers).toEqual([...STARTER_TOWERS, 'vent']);
    expect(normalizeSave({ servicePoints: -100 }).servicePoints).toBe(0);
  });
  it('pays wins, reduced losses, and partial combat but does not pay an idle exit', () => {
    const g = game();
    g.status = 'lost'; expect(servicePointsForRun(g)).toBe(0);
    g.stats.kills = 1; expect(servicePointsForRun(g)).toBeGreaterThan(0);
    g.waveIdx = 6; g.completedWaves = 5; g.stats.kills = 40;
    const loss = servicePointsForRun(g); expect(loss).toBe(20);
    g.status = 'won'; const win = servicePointsForRun(g); expect(win).toBe(85); expect(loss).toBeLessThan(win / 2);
    g.status = 'playing'; expect(servicePointsForRun(g)).toBe(0);
  });
  it('awards each completed run only once while paying a separate replay', () => {
    const save = new SaveStore(null), g = game(); g.stats.kills = 12; g.completedWaves = 2;
    expect(grantRunRewards(save, g, 0).servicePoints).toBe(0);
    g.status = 'lost'; const first = grantRunRewards(save, g, 0), after = save.exportJson();
    expect(first.servicePoints).toBeGreaterThan(0);
    expect(grantRunRewards(save, g, 0).xp).toBe(0); expect(save.exportJson()).toBe(after);
    const replay = game(); replay.status = 'lost'; replay.stats.kills = 12; replay.completedWaves = 2;
    expect(grantRunRewards(save, replay, 0).servicePoints).toBe(first.servicePoints);
    expect(save.data.servicePoints).toBe(WELCOME_POINTS + first.servicePoints * 2);
  });
  it('does not present a zero payout as completed work', () => {
    const idle = serviceRewardCopy(0, false);
    expect(idle.paid).toBe(false);
    if (idle.paid) return;
    expect(idle.text).not.toMatch(/work completed/i);
    expect(idle.text).toMatch(/no service points/i);
    const paid = serviceRewardCopy(20, false);
    expect(paid.paid).toBe(true);
    if (!paid.paid) return;
    expect(paid.title).toBe('+20 service points');
    expect(paid.detail).toMatch(/work completed/i);
    const win = serviceRewardCopy(85, true);
    if (!win.paid) return;
    expect(win.detail).toMatch(/full job payment/i);
  });
});

describe('Independent hero careers', () => {
  it.each(HERO_ORDER)('%s supports three branches, hybrid investment and a selected alternate C', hero => {
    const disk = storage(), save = new SaveStore(disk); save.addXp(100_000);
    const paths = HERO_PATHS[hero]; expect(new Set(paths.map(p => p.style)).size).toBe(3);
    for (const path of paths.slice(0, 2)) for (const tier of [1, 2, 3, 4]) expect(save.unlockBuildNode(hero, `${path.style}:${tier}`)).toBe(true);
    expect(save.unlockBuildNode(hero, `${paths[2]!.style}:1`)).toBe(false);
    save.equipTechnique(hero, paths[0]!.style);
    const restored = new SaveStore(disk), build = restored.heroBuild(hero);
    expect(build.nodes).toHaveLength(8); expect(build.technique).toBe(paths[0]!.style);
    expect(heroForBuild(hero, build).abilities[4].name).toBe(paths[0]!.technique);
    expect(heroForBuild(hero, build).abilities.slice(0, 4)).toEqual(HEROES[hero].abilities.slice(0, 4));
    expect(HEROES[hero].abilities[4].name).not.toBe(paths[0]!.technique);
    const other = HERO_ORDER.find(id => id !== hero)!; expect(restored.heroBuild(other).nodes).toHaveLength(0);
    const xp = restored.data.jeffXp; restored.resetBuild(hero);
    expect(restored.data.jeffXp).toBe(xp); expect(restored.heroBuild(hero)).toEqual({ nodes: [], technique: 'signature' });
  });
  it('grants a first point immediately and enforces ordered prerequisites and earned budgets', () => {
    const save = new SaveStore(null);
    expect(buildBudget(0)).toBe(1);
    expect(save.unlockBuildNode('jeff', 'venom:2')).toBe(false);
    expect(save.unlockBuildNode('jeff', 'venom:1')).toBe(true);
    expect(save.unlockBuildNode('jeff', 'venom:1')).toBe(false);
    expect(save.unlockBuildNode('jeff', 'venom:2')).toBe(false);
    save.equipTechnique('jeff', 'venom'); expect(save.heroBuild().technique).toBe('signature');
    save.addXp(72); expect(save.unlockBuildNode('jeff', 'venom:2')).toBe(true);
    expect(save.unlockBuildNode('mike', 'engineer:1')).toBe(true);
    save.resetBuild('jeff'); expect(save.heroBuild('mike').nodes).toEqual(['engineer:1']);
  });
  it('rejects foreign branches, overbudget nodes, duplicates, and unearned active skills on import', () => {
    const raw = { nodes: ['blast:1', 'venom:3', 'venom:1', 'venom:1', 'venom:2', 'venom:3', 'venom:4'], technique: 'venom' };
    expect(normalizeHeroBuild('jeff', raw, 2)).toEqual({ nodes: ['venom:1', 'venom:2'], technique: 'signature' });
    const data = normalizeSave({ jeffXp: 0, heroBuilds: { jeff: raw } } as never);
    expect(data.heroBuilds.jeff?.nodes).toEqual(['venom:1']);
  });
});
