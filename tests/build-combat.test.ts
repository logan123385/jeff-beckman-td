import { describe, expect, it } from 'vitest';
import { HERO_ORDER, type HeroId } from '../src/data/heroes';
import { HERO_PATHS, type BuildStyle, type HeroBuild } from '../src/data/heroBuilds';
import { CRAWLSPACE } from '../src/data/maps/crawlspace';
import { TOWER_ORDER } from '../src/data/towers';
import { DIFFICULTIES } from '../src/data/difficulty';
import { neutralModifiers } from '../src/data/skills';
import { Game } from '../src/sim/game';
import { onBuildAttack, updateBuildEffects, spawnBuildHelpers } from '../src/sim/heroBuilds';
import { advanceHeroCast, strikeNewHero, updateHeroMissiles, summonLogan, updateHeroSummons } from '../src/sim/heroPowers';
import { updateHero } from '../src/sim/hero';
import { updateAuras } from '../src/sim/towers';
import type { EnemyId } from '../src/data/types';

function field(heroId: HeroId, style: BuildStyle, rank = 4, active = true) {
  const heroBuild: HeroBuild = { nodes: Array.from({ length: rank }, (_, i) => `${style}:${i + 1}`), technique: active && rank === 4 ? style : 'signature' };
  const g = new Game({ ...CRAWLSPACE, paths: [[{ x: 20, y: 250 }, { x: 940, y: 250 }]],
    jeffStart: { x: 300, y: 250 }, slots: [{ x: 320, y: 190 }, { x: 700, y: 180 }],
    allowedTowers: TOWER_ORDER, startMoney: 10000 }, { difficulty: DIFFICULTIES.journeyman, mods: neutralModifiers(), heroId, heroBuild, manualStart: true });
  g.deployHero({ ...g.map.jeffStart }); g.hero.attackTimer = 100;
  return g;
}
function prey(g: Game, x = 340, id: EnemyId = 'drip') {
  const e = g.spawnEnemy(id, 0, x - 20); e.lane = 0; e.pos = { x, y: 250 };
  e.def = { ...e.def, dps: 0, speed: 0, armor: 0 }; e.hp = e.maxHp = 10000; return e;
}

describe('Alternate skills reach real combat through C', () => {
  for (const hero of HERO_ORDER) for (const path of HERO_PATHS[hero]) {
    it(`${hero}: ${path.technique} releases once at contact with its own effect`, () => {
      const g = field(hero, path.style), e = prey(g); const initialHp = e.hp;
      const cast = () => g.useAbility(4, { pos: { ...e.pos }, enemyId: e.id });
      expect(cast()).toBe(true); expect(g.hero.cast?.buildTechnique).toBe(true); expect(cast()).toBe(false);
      advanceHeroCast(g, .4); expect(e.hp).toBe(initialHp); expect(g.buildZones).toHaveLength(0); expect(g.heroSummons).toHaveLength(0);
      advanceHeroCast(g, .1);
      if (path.style === 'engineer') expect(g.buildState.overtime).toBe(9);
      if (path.style === 'venom') expect(g.buildZones).toHaveLength(1);
      if (path.style === 'summoner') expect(g.heroSummons.filter(s => s.buildHelper)).toHaveLength(2);
      if (path.style === 'blast') { expect(e.hp).toBe(initialHp - 140); expect(e.stun).toBe(1); }
      if (path.style === 'hunter') { expect(e.hp).toBe(initialHp - 260); expect(e.exposed?.strength).toBe(.25); }
      const atContact = e.hp; advanceHeroCast(g, .41);
      expect(g.hero.cast).toBeUndefined(); expect(e.hp).toBe(atContact); expect(g.hero.coffeeCooldown).toBeGreaterThan(0);
      expect(cast()).toBe(false); expect(g.hero.coffeeTimer).toBe(0);
    });
  }
  it.each(['becbec', 'jayjay'] as const)('%s can target air with its unlocked precision skill and refunds a lost target', hero => {
    const g = field(hero, 'hunter'), e = prey(g, 400, 'steamWisp');
    expect(g.useAbility(4, { pos: e.pos, enemyId: e.id })).toBe(true);
    e.phased = true; advanceHeroCast(g, .5);
    expect(e.hp).toBe(e.maxHp); expect(g.hero.coffeeCooldown).toBe(0);
  });
  it('cancels an unfinished cast on knockout', () => {
    const g = field('jeff', 'venom'), e = prey(g);
    expect(g.useAbility(4, { pos: e.pos, enemyId: e.id })).toBe(true);
    expect(g.useAbility(0)).toBe(false);
    g.damageHero(100000); g.update(1); expect(g.buildZones).toHaveLength(0);
  });
});

describe('Passive build behavior', () => {
  it('poison refreshes without stacking and stops damaging after its duration', () => {
    const g = field('bob', 'venom', 3), e = prey(g);
    onBuildAttack(g, e, 20); onBuildAttack(g, e, 20);
    updateBuildEffects(g, 2); expect(e.hp).toBe(9980); expect(e.slow).toBe(.15);
    onBuildAttack(g, e, 20); updateBuildEffects(g, 10);
    expect(e.hp).toBe(9920); expect(e.buildPoison).toBeUndefined();
    updateBuildEffects(g, 10); expect(e.hp).toBe(9920);
  });
  it('support buffs follow the deployed hero and disappear on range exit or knockout', () => {
    const g = field('jeff', 'engineer', 3); g.placeTower(0, 'torch'); const t = g.towers[0]!;
    updateAuras(g, .01); expect(g.buffs.get(t.id)).toEqual({ dmg: .12, range: .1, rate: .12 });
    g.hero.pos.x = 900; updateAuras(g, .01); expect(g.buffs.get(t.id)?.dmg ?? 0).toBe(0);
    g.hero.pos.x = 300; g.hero.downed = 5; updateAuras(g, .01); expect(g.buffs.get(t.id)?.dmg ?? 0).toBe(0);
  });
  it('crowd splash reaches neighbors without hitting the original target twice or distant enemies', () => {
    const g = field('mike', 'blast', 3), e = prey(g), neighbor = prey(g, 390), distant = prey(g, 500);
    onBuildAttack(g, e, 100);
    expect(e.hp).toBe(10000); expect(neighbor.hp).toBe(9955); expect(distant.hp).toBe(10000);
  });
  it('focus builds on one target, caps, resets on switching, and adds boss damage', () => {
    const g = field('mike', 'hunter', 3), e = prey(g), next = prey(g, 400);
    onBuildAttack(g, e, 100); expect(e.hp).toBe(10000);
    for (let i = 0; i < 6; i++) onBuildAttack(g, e, 100);
    expect(g.buildState.focusHits).toBe(4); expect(e.hp).toBe(10000 - 12 - 24 - 36 - 48 * 3);
    onBuildAttack(g, next, 100); expect(next.hp).toBe(10000); expect(g.buildState.focusHits).toBe(0);
    const boss = prey(g, 410); boss.def = { ...boss.def, traits: ['boss'] };
    onBuildAttack(g, boss, 100); expect(boss.hp).toBe(9975);
  });
  it('Doni basic projectiles apply poison on impact, while his skill projectiles do not', () => {
    const g = field('doni', 'venom', 3), e = prey(g);
    strikeNewHero(g, e); expect(e.buildPoison).toBeUndefined();
    updateHeroMissiles(g, 2); expect(e.buildPoison?.left).toBe(6);
    e.buildPoison = undefined;
    expect(g.useAbility(0, { pos: e.pos, enemyId: e.id })).toBe(true);
    advanceHeroCast(g, 1); updateHeroMissiles(g, 2); expect(e.buildPoison).toBeUndefined();
  });
  it('Jeff basic melee applies poison only on its actual contact frame', () => {
    const g = field('jeff', 'venom', 1), e = prey(g, 320); g.hero.attackTimer = 0;
    updateHero(g, .01); expect(e.buildPoison).toBeUndefined();
    for (let i = 0; i < 30; i++) updateHero(g, 1 / 60);
    expect(e.buildPoison?.left).toBe(4);
  });
  it('helper summons coexist with Logan, cap at three, and release holds on expiration', () => {
    const g = field('cbj', 'summoner', 3); spawnBuildHelpers(g, 8);
    expect(g.heroSummons).toHaveLength(3); expect(g.heroSummons[0]?.maxHp).toBe(105);
    summonLogan(g, g.hero.pos); expect(g.heroSummons).toHaveLength(4);
    summonLogan(g, g.hero.pos); expect(g.heroSummons).toHaveLength(4);
    const helper = g.heroSummons.find(s => s.buildHelper)!, e = prey(g);
    e.heldBy = { kind: 'summon', id: helper.id }; helper.left = .01;
    updateHeroSummons(g, .1); expect(e.heldBy?.id).not.toBe(helper.id); expect(g.heroSummons.some(s => s.id === helper.id)).toBe(false);
  });
  it('a full helper squad still gets two fresh reinforcements from its active, preserving Logan', () => {
    const g = field('cbj', 'summoner'); spawnBuildHelpers(g, 3); summonLogan(g, g.hero.pos);
    const old = g.heroSummons.filter(s => s.buildHelper).map(s => s.id), logan = g.heroSummons.find(s => !s.buildHelper)!;
    expect(g.useAbility(4)).toBe(true); advanceHeroCast(g, 1);
    expect(g.heroSummons.filter(s => s.buildHelper)).toHaveLength(3);
    expect(g.heroSummons.filter(s => s.buildHelper && !old.includes(s.id))).toHaveLength(2);
    expect(g.heroSummons).toContain(logan);
  });
});
