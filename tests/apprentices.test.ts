import { describe, expect, it } from 'vitest';
import { CRAWLSPACE } from '../src/data/maps/crawlspace';
import { DIFFICULTIES } from '../src/data/difficulty';
import { neutralModifiers } from '../src/data/modifiers';
import { Game } from '../src/sim/game';
import { damageFriendly, updateFriendlies, FRIENDLY_SWING } from '../src/sim/friendlies';
import { towerAbilityReady } from '../src/sim/towerAbilities';
import { TOWERS } from '../src/data/towers';
function field() {
  const g = new Game({ ...CRAWLSPACE, paths: [[{ x: 20, y: 250 }, { x: 940, y: 250 }]], slots: [{ x: 320, y: 190 }], startMoney: 100000 },
    { difficulty: DIFFICULTIES.journeyman, mods: neutralModifiers(), heroEnabled: false, manualStart: true });
  g.placeTower(0, 'barricade'); g.towers[0]!.build = 0;
  for (const f of g.friendlies) f.pos = { ...f.home };
  return g;
}
describe('Apprentice barricade squad', () => {
  it('uses four identities, four independent low health pools, and a fixed headcount at every tier', () => {
    const g = field(), t = g.towers[0]!;
    expect(t.def.name).toBe('Apprentice Barricade'); expect(g.friendlies.map(f => f.slot)).toEqual([0, 1, 2, 3]);
    expect(g.friendlies.reduce((n, f) => n + f.maxHp, 0)).toBe(192);
    expect(g.friendlies.every(f => f.holds === 1)).toBe(true);
    while (g.upgradeTower(t.id)) {
      expect(g.friendlies).toHaveLength(4);
      expect(g.friendlies.every(f => f.maxHp === t.def.levels[t.level]!.hp)).toBe(true);
    }
    expect(t.level).toBe(5);
    expect(TOWERS.barricade.levels.map(l => l.hp)).toEqual([48, 64, 88, 116, 150, 194]);
  });
  it('keeps knockout and respawn individual, releasing holds without reviving on an upgrade', () => {
    const g = field(), f = g.friendlies[0]!, t = g.towers[0]!, e = g.spawnEnemy('sludge', 0, 300);
    e.heldBy = { kind: 'friendly', id: f.id };
    damageFriendly(g, f, 1000); expect(f.hp).toBe(0); expect(f.respawn).toBe(9); expect(e.heldBy).toBeNull();
    expect(g.friendlies.slice(1).every(f => f.hp === f.maxHp)).toBe(true);
    g.upgradeTower(t.id); expect(f.hp).toBe(0); expect(f.respawn).toBe(9);
    updateFriendlies(g, 9); expect(f.respawn).toBe(0); expect(f.hp).toBe(f.maxHp); expect(f.pos).toEqual(t.pos);
  });
  it('lets idle apprentices help an ally fight instead of creating a regenerating stalemate', () => {
    const g = field(), e = g.spawnEnemy('sludge', 0, 300); e.pos = { ...g.towers[0]!.rally };
    e.def = { ...e.def, speed: 0, dps: 0 }; e.hp = e.maxHp = 10000;
    e.heldBy = { kind: 'friendly', id: g.friendlies[0]!.id };
    updateFriendlies(g, .01);
    expect(g.friendlies.every(f => f.targetId === e.id && f.swing === FRIENDLY_SWING)).toBe(true);
    updateFriendlies(g, .34); expect(e.hp).toBeLessThan(9990);
  });
  it('targets each held enemy with the barricade active, then releases everyone on sale', () => {
    const g = field(), t = g.towers[0]!; g.upgradeTower(t.id); t.build = 0;
    for (const f of g.friendlies) { const e = g.spawnEnemy('drip', 0, 300); e.heldBy = { kind: 'friendly', id: f.id }; }
    expect(towerAbilityReady(g, t).ok).toBe(true);
    expect(g.useTowerAbility(t.id)).toBe(true); expect(g.enemies.every(e => e.stun >= 1.8)).toBe(true);
    g.sellTower(t.id); expect(g.friendlies).toHaveLength(0); expect(g.enemies.every(e => e.heldBy === null)).toBe(true);
  });
  it('uses current tower range bonuses for apprentice reach and removes them when support ends', () => {
    const g = field(), t = g.towers[0]!; g.mods.towerRange = 1.2;
    g.buffs.set(t.id, { dmg: 0, rate: 0, range: .1 }); updateFriendlies(g, .01);
    expect(g.friendlies.every(f => Math.abs(f.range - 33) < .0001)).toBe(true);
    g.buffs.clear(); updateFriendlies(g, .01); expect(g.friendlies.every(f => f.range === 30)).toBe(true);
  });
});
