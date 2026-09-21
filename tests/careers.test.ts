import { describe, expect, it } from 'vitest';
import { HERO_ORDER } from '../src/data/heroes';
import { defaultCards } from '../src/data/kitCards';
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
import { defaultFamily } from '../src/data/weapons';
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
    const old = normalizeSave({ version: 1, stars: { crawlspace: { apprentice: 3 } }, jeffXp: 120 } as never);
    for (const map of MAPS.slice(0, 2)) for (const id of map.allowedTowers) expect(old.ownedTowers).toContain(id);
    expect(old.jeffXp).toBe(120);
    expect(old.servicePoints).toBe(WELCOME_POINTS);
    const existing = normalizeSave({ ...old, ownedTowers: STARTER_TOWERS } as never);
    expect(existing.ownedTowers).toEqual(STARTER_TOWERS);
  });
  it('sanitizes bad currency and licenses without removing starter tools', () => {
    const value = normalizeSave({ servicePoints: Infinity, ownedTowers: ['bogus', 'vent', 'vent'] } as never);
    expect(value.servicePoints).toBe(WELCOME_POINTS); expect(value.ownedTowers).toEqual([...STARTER_TOWERS, 'vent']);
    expect(normalizeSave({ servicePoints: -100 } as never).servicePoints).toBe(0);
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

describe('Kit loadouts', () => {
  it.each(HERO_ORDER)('%s starts with default family and starter cards', hero => {
    const save = new SaveStore(null);
    const kit = save.heroKit(hero);
    expect(kit.family).toBe(defaultFamily(hero));
    expect(kit.cards).toEqual(defaultCards(hero));
    expect(kit.weaponId).toBeNull();
  });
  it('tracks hero jobs and unlocks cards by job count', () => {
    const save = new SaveStore(null);
    expect(save.equipCard('jeff', 0, 'jeff_crew')).toBe(false);
    save.recordHeroJob('jeff');
    expect(save.equipCard('jeff', 0, 'jeff_crew')).toBe(true);
    expect(save.equipCard('jeff', 1, 'jeff_sweep')).toBe(false);
    save.recordHeroJob('jeff');
    save.recordHeroJob('jeff');
    expect(save.equipCard('jeff', 1, 'jeff_sweep')).toBe(true);
  });
  it('clears wrong-stance cards when changing family', () => {
    const save = new SaveStore(null);
    save.recordHeroJob('jeff');
    save.recordHeroJob('jeff');
    save.recordHeroJob('jeff');
    save.equipCard('jeff', 0, 'jeff_sweep');
    save.setFamily('jeff', 'jeff_ranged');
    expect(save.heroKit('jeff').cards).toEqual([null, null]);
  });
  it('migrates v1 hero builds into heroJobs and default kits', () => {
    const data = normalizeSave({
      version: 1,
      heroBuilds: { jeff: { nodes: ['venom:1', 'venom:2', 'venom:3', 'venom:4'], technique: 'venom' }, mike: { nodes: ['engineer:1'], technique: 'signature' } },
    } as never);
    expect(data.heroJobs.jeff).toBeGreaterThanOrEqual(3);
    expect(data.heroJobs.mike).toBeGreaterThanOrEqual(1);
    expect(data.kits.jeff?.family).toBe('jeff_melee');
    expect(data.kits.mike?.family).toBe('mike_ranged');
  });
});
