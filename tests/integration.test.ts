import { describe, expect, it } from 'vitest';
import { CRAWLSPACE } from '../src/data/maps/crawlspace';
import { DIFFICULTIES } from '../src/data/difficulty';
import { neutralModifiers } from '../src/data/skills';
import { TOWER_ORDER } from '../src/data/towers';
import { Game } from '../src/sim/game';
import { applyDamage } from '../src/sim/combat';
import { updateHeroSummons } from '../src/sim/heroPowers';
import { updateSpecialistAbilities } from '../src/sim/specialistAbilities';
import { towerAbilityReady } from '../src/sim/towerAbilities';
import type { RemasterId } from '../src/data/types';

function field(remaster: RemasterId = 'classic') {
  return new Game({ ...CRAWLSPACE, startMoney: 10000, allowedTowers: TOWER_ORDER,
    paths: [[{ x: 20, y: 200 }, { x: 940, y: 200 }]], jeffStart: { x: 100, y: 200 },
    slots: [{ x: 600, y: 150 }],
  }, { difficulty: DIFFICULTIES.journeyman, mods: neutralModifiers(), remaster, manualStart: true });
}
function trained(g: Game) {
  g.placeTower(0, 'washer'); const t = g.towers[0]!;
  g.upgradeTower(t.id); g.upgradeTower(t.id); g.specializeTower(t.id, 'power');
  g.buySpecialistAbility(t.id, 'barrage'); return t;
}

describe('Cursor and tactical systems together', () => {
  it('Logan defends the deployment lane while the hero is still in the truck', () => {
    const g = field(); expect(g.reinforce({ x: 700, y: 200 })).toBe(true);
    const s = g.heroSummons[0]!;
    updateHeroSummons(g, 1); expect(s.pos).toEqual({ x: 700, y: 200 });
    const e = g.spawnEnemy('sludge', 0, 675);
    updateHeroSummons(g, .1);
    expect(s.targetId).toBe(e.id); expect(e.heldBy).toEqual({ kind: 'summon', id: s.id });
    e.dead = true; s.swing = 0;
    updateHeroSummons(g, .1); expect(s.targetId).toBeUndefined();
    expect(s.pos).toEqual(s.anchor);
  });
  it('automatic specialists wait for installation and pause while overheated', () => {
    const g = field(), t = trained(g), e = g.spawnEnemy('sludge', 0, 585);
    updateSpecialistAbilities(g, t, 1); expect(e.hp).toBe(e.maxHp);
    t.build = 0; t.overheated = 2;
    expect(towerAbilityReady(g, t)).toEqual({ ok: false, reason: 'Overheated by the furnace.' });
    updateSpecialistAbilities(g, t, 1); expect(e.hp).toBe(e.maxHp);
    t.overheated = 0; updateSpecialistAbilities(g, t, .1);
    expect(e.hp).toBeLessThan(e.maxHp);
  });
  it('a specialist blast cracks a cast shell before damaging the body, then preserves splits and parts', () => {
    const g = field(), t = trained(g); t.build = 0;
    const e = g.spawnEnemy('scaleCrab', 0, 585, ['cast']);
    updateSpecialistAbilities(g, t, .1);
    expect(e.shellHp).toBeLessThan(e.maxShell); expect(e.hp).toBe(e.maxHp);
    applyDamage(g, e, 100000, 'heat', 'washer');
    expect(e.dead).toBe(true); expect(g.parts).toBeGreaterThan(0);
    expect(g.enemies.filter(child => child.def.id === 'drip' && !child.dead)).toHaveLength(2);
  });
  it('specialist training does not replace a tower’s spare-parts active', () => {
    const g = field(), t = trained(g); t.build = 0; g.parts = 50;
    const rank = t.abilities!.barrage!.rank;
    expect(g.useTowerAbility(t.id)).toBe(true);
    expect(g.parts).toBeLessThan(50); expect(t.abilityCd).toBeGreaterThan(0);
    expect(t.abilities!.barrage!.rank).toBe(rank); expect(t.abilities!.barrage!.cooldown).toBe(0);
  });
  it('Clean Hands still rejects actives, Logan and selling after specialist training', () => {
    const g = field('cleanHands'), t = trained(g); t.build = 0; g.parts = 50;
    const money = g.money;
    expect(g.useTowerAbility(t.id)).toBe(false);
    expect(g.reinforce({ x: 600, y: 200 })).toBe(false);
    expect(g.sellTower(t.id)).toBe(false);
    expect(g.parts).toBe(50); expect(g.money).toBe(money);
  });
  it('healing a deployed Logan does not heal the hero waiting in the truck', () => {
    const g = field(); g.hero.pos = { x: 600, y: 200 }; g.hero.hp -= 50;
    g.placeTower(0, 'expansion'); const t = g.towers[0]!;
    g.upgradeTower(t.id); g.upgradeTower(t.id); g.specializeTower(t.id, 'power'); t.build = 0;
    g.buySpecialistAbility(t.id, 'mend'); g.reinforce({ x: 600, y: 200 });
    const s = g.heroSummons[0]!; s.hp -= 30;
    const hp = g.hero.hp; updateSpecialistAbilities(g, t, .1);
    expect(s.hp).toBe(s.maxHp); expect(g.hero.hp).toBe(hp);
  });
});
