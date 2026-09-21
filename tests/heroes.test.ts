import { describe, expect, it } from 'vitest';
import { HEROES, HERO_ORDER, COOLDOWN_FIELDS, type HeroId, type AbilitySlot } from '../src/data/heroes';
import { DIFFICULTIES } from '../src/data/difficulty';
import { CRAWLSPACE } from '../src/data/maps/crawlspace';
import { neutralModifiers } from '../src/data/skills';
import { TOWER_ORDER } from '../src/data/towers';
import { SaveStore } from '../src/save/save';
import { Game } from '../src/sim/game';
import { updateHero } from '../src/sim/hero';
import { updateAuras } from '../src/sim/towers';
import { updateEnemies } from '../src/sim/enemies';
import { applyDamage } from '../src/sim/combat';
import { updateHeroAura, updateHeroMissiles, updateHeroSummons, friendlyDamageBuff, friendlyMitigation } from '../src/sim/heroPowers';
import type { EnemyId } from '../src/data/types';
import { runHeadless } from './harness';
import { createBossVisualGame } from './fixtures/bossVisual';

function field(heroId: HeroId) {
  const g = new Game({ ...CRAWLSPACE, paths: [[{ x: 20, y: 250 }, { x: 940, y: 250 }]],
    jeffStart: { x: 300, y: 250 }, slots: [{ x: 320, y: 190 }, { x: 700, y: 180 }],
    allowedTowers: TOWER_ORDER, startMoney: 100000 }, { difficulty: DIFFICULTIES.journeyman, mods: neutralModifiers(), heroId, manualStart: true });
  g.deployHero({ ...g.map.jeffStart });
  return g;
}
function enemy(g: Game, x = 340, id: EnemyId = 'sludge') {
  const e = g.spawnEnemy(id, 0, x - 20); e.lane = 0; e.pos = { x, y: 250 };
  e.def = { ...e.def, dps: 0, speed: 0 }; e.hp = e.maxHp = 10000; return e;
}
function step(g: Game, secs: number) { for (let i = 0; i < Math.ceil(secs * 60); i++) g.update(1 / 60); }
function aimFor(g: Game, slot: AbilitySlot) {
  const ability = g.heroDef.abilities[slot];
  if (!ability.target) return undefined;
  const prey = g.enemies.find((e) => !e.dead && !e.escaped);
  return { pos: prey ? { ...prey.pos } : { ...g.hero.pos }, enemyId: prey?.id };
}
function fire(g: Game, slot: AbilitySlot) { return g.useAbility(slot, aimFor(g, slot)); }
function cast(g: Game, slot: AbilitySlot) { expect(fire(g, slot)).toBe(true); step(g, g.heroDef.abilities[slot].cast + .03); }

describe('Playable hero selection and legacy saves', () => {
  it.each(HERO_ORDER)('%s has an independent full kit, stats and persistent selection', id => {
    const data = new Map<string, string>();
    const storage = { length: 0, clear: () => data.clear(), key: () => null, getItem: (k: string) => data.get(k) ?? null, setItem: (k: string, v: string) => { data.set(k, v); }, removeItem: (k: string) => { data.delete(k); } };
    const save = new SaveStore(storage); save.recordClear('crawlspace', 'journeyman', 3); save.setHero(id);
    const restored = new SaveStore(storage); expect(restored.data.selectedHero).toBe(id); expect(restored.starsFor('crawlspace')).toBe(3);
    const g = field(id); expect(g.hero.id).toBe(id); expect(g.hero.hp).toBe(HEROES[id].hp);
    expect(new Set(HEROES[id].abilities.map(a => a.name)).size).toBe(5);
  });
  it('old saves and corrupt hero ids safely default to Jeff without erasing progression', () => {
    for (const selectedHero of [undefined, 'missing', null]) {
      const storage = { length: 0, clear() {}, key() { return null; }, getItem() { return JSON.stringify({ version: 1, selectedHero, skills: ['sharpTools'], serviceCallBest: 42 }); }, setItem() {}, removeItem() {} };
      const save = new SaveStore(storage); expect(save.data.selectedHero).toBe('jeff'); expect(save.data.serviceCallBest).toBe(42);
      expect(save.data.inventory.some(i => i.kind === 'armor' && i.name === 'Veteran Vest')).toBe(true);
    }
  });
});

describe('Attack and cast timing', () => {
  it.each([
    ['doni', 0], ['doni', 4], ['jayjay', 0],
  ] as const)('%s slot %s reacquires at contact or refunds when every legal target is lost', (id, slot) => {
    for (const loss of ['dead', 'escaped', 'phased', 'outOfRange'] as const) {
      for (const replacement of [false, true]) {
        const g = field(id), original = enemy(g, 340);
        g.hero.attackTimer = 100;
        expect(fire(g, slot)).toBe(true);
        if (loss === 'outOfRange') original.pos.x = 900;
        else original[loss] = true;
        const next = replacement ? enemy(g, 355) : undefined;
        const distant = enemy(g, 930);
        const phased = enemy(g, 320); phased.phased = true;
        const air = id === 'jayjay' ? enemy(g, 325, 'steamWisp') : undefined;
        updateHero(g, g.heroDef.abilities[slot].cast * .5);
        if (next) {
          expect(g.hero[COOLDOWN_FIELDS[slot]]).toBeGreaterThan(0);
          if (id === 'doni') expect(g.heroMissiles[0]?.targetId).toBe(next.id);
          else expect(next.hp).toBeLessThan(next.maxHp);
        } else {
          expect(g.hero[COOLDOWN_FIELDS[slot]]).toBe(0);
          expect(g.hero.cast).toBeUndefined();
          expect(g.heroMissiles).toHaveLength(0);
          expect(g.heroNotice?.detail).toContain('ability ready');
        }
        expect(original.hp).toBe(original.maxHp);
        expect(distant.hp).toBe(distant.maxHp);
        expect(phased.hp).toBe(phased.maxHp);
        if (air) expect(air.hp).toBe(air.maxHp);
      }
    }
  });
  it('the boss visual fixture trains a supported washer ability', () => {
    const g = createBossVisualGame();
    expect(g.towers[0]!.def.id).toBe('washer');
    expect(g.towers[0]!.abilities?.barrage?.rank).toBe(1);
  });
  it.each(['mike', 'bob', 'chris', 'becbec', 'cbj', 'doni', 'jayjay'] as HeroId[])('%s winds up, connects, and completes recovery', id => {
    const g = field(id), e = enemy(g); const before = e.hp;
    updateHero(g, .01); expect(g.hero.swing).toBeGreaterThan(0); expect(e.hp).toBe(before);
    updateHero(g, g.heroDef.swingTime * .2); expect(e.hp).toBe(before); expect(g.heroMissiles).toHaveLength(0);
    updateHero(g, g.heroDef.swingTime * .3);
    if (['mike', 'cbj', 'doni'].includes(id)) { expect(e.hp).toBe(before); expect(g.heroMissiles).toHaveLength(1); updateHeroMissiles(g, 2); }
    expect(e.hp).toBeLessThan(before); expect(g.hero.swing).toBeGreaterThan(0);
  });
  it.each(['mike', 'bob', 'cbj', 'doni'] as HeroId[])('%s attacks from range without blocking distant enemies', id => {
    const g = field(id), e = enemy(g, 450); step(g, 1.6);
    expect(e.hp).toBeLessThan(e.maxHp); expect(e.heldBy).toBeNull(); expect(g.hero.pos.x).toBe(300);
  });
  it('moving cancels a pending basic attack with no invisible hit', () => {
    const g = field('becbec'), e = enemy(g); updateHero(g, .01); g.commandHero({ x: 100, y: 150 }); step(g, .8);
    expect(e.hp).toBe(e.maxHp); expect(g.hero.pendingStrike).toBeUndefined(); expect(g.hero.pos.x).toBeLessThan(300);
  });
  it.each(['mike', 'bob', 'chris', 'becbec', 'cbj', 'doni', 'jayjay'] as HeroId[])('%s cannot cast without a target or while downed', id => {
    const g = field(id), slot = (id === 'chris' ? 1 : 0) as AbilitySlot;
    expect(g.useAbility(slot)).toBe(false); expect(g.hero[COOLDOWN_FIELDS[slot]]).toBe(0);
    enemy(g); g.damageHero(100000); expect(g.useAbility(slot)).toBe(false); expect(g.hero.cast).toBeUndefined();
  });
  it('casts cannot overlap; damage waits for frame five and death interrupts unreleased casts', () => {
    const g = field('bob'), e = enemy(g); expect(fire(g, 0)).toBe(true); expect(fire(g, 2)).toBe(false);
    step(g, .3); expect(e.hp).toBe(e.maxHp); g.damageHero(10000); step(g, 1);
    expect(e.hp).toBe(e.maxHp); expect(g.heroVisuals).toHaveLength(0); expect(g.hero.cast).toBeUndefined();
  });
  it.each(HERO_ORDER)('%s can activate all five abilities with separate cooldowns', id => {
    const g = field(id); enemy(g); g.hero.attackTimer = 100;
    for (const slot of [0, 1, 2, 3, 4] as const) {
      expect(fire(g, slot)).toBe(true); expect(g.hero[COOLDOWN_FIELDS[slot]]).toBeGreaterThan(0);
      step(g, HEROES[id].abilities[slot].cast + .03); expect(fire(g, slot)).toBe(false);
    }
  });
});

describe('Distinct active abilities', () => {
  it('Mike throws a three-plunger volley and nine timed rain projectiles, with no lingering zone', () => {
    const g = field('mike'); enemy(g, 480); g.hero.attackTimer = 100;
    expect(fire(g, 0)).toBe(true); step(g, .47); expect(g.heroMissiles).toHaveLength(3);
    step(g, 1); expect(g.heroMissiles).toHaveLength(0);
    cast(g, 4); const rain = g.heroZones.find(z => z.kind === 'rain')!;
    expect(rain).toBeDefined(); step(g, 4); expect(rain.ticks).toBe(9); expect(g.heroZones).toHaveLength(0);
    step(g, 2); expect(g.heroMissiles).toHaveLength(0);
  });
  it('Mike horn pushes ground units but not airborne units; supplies heal allies over time', () => {
    const g = field('mike'), e = enemy(g), flying = enemy(g, 345, 'steamWisp'); g.hero.attackTimer = 100;
    const old = e.progress, airOld = flying.progress; cast(g, 1); expect(e.progress).toBeLessThan(old); expect(flying.progress).toBe(airOld);
    g.hero.hp = 200; cast(g, 2); const before = g.hero.hp; step(g, 2); expect(g.hero.hp).toBeGreaterThan(before + 30);
  });
  it("You're Fired pierces enemies along its beam and spares enemies outside its width", () => {
    const g = field('bob'), a = enemy(g, 380), b = enemy(g, 570), c = enemy(g, 440);
    c.pos.y = 350; g.hero.attackTimer = 100; expect(fire(g, 0)).toBe(true);
    updateHero(g, .6); expect(a.hp).toBeLessThan(a.maxHp); expect(b.hp).toBeLessThan(b.maxHp); expect(c.hp).toBe(c.maxHp);
    expect(g.heroVisuals.some(f => f.kind === 'laser' && f.radius === 22)).toBe(true);
  });
  it('Bob marks the toughest three for allied focus fire and the mark expires', () => {
    const g = field('bob'); const es = [enemy(g, 380), enemy(g, 400), enemy(g, 420), enemy(g, 440)];
    es.forEach((e, i) => { e.maxHp = e.hp = 10000 + i * 1000; }); g.hero.attackTimer = 100; cast(g, 4);
    expect(es.filter(e => e.markBonus === .3)).toHaveLength(3); expect(es[0]!.marked).toBe(false);
    step(g, 10); expect(es.every(e => !e.marked)).toBe(true); expect(g.heroZones).toHaveLength(0);
  });
  it('FORE ricochets to three distinct targets at impact, never hitting the same target twice', () => {
    const g = field('chris'); const es = [enemy(g, 450), enemy(g, 510), enemy(g, 580)]; g.hero.attackTimer = 100;
    expect(fire(g, 1)).toBe(true); step(g, .3); expect(es.every(e => e.hp === e.maxHp)).toBe(true);
    step(g, 2); expect(es.every(e => e.hp < e.maxHp)).toBe(true); expect(g.heroMissiles).toHaveLength(0);
    expect(es[0]!.maxHp - es[0]!.hp).toBeGreaterThan(es[1]!.maxHp - es[1]!.hp);
  });
  it('Logan scurries, physically holds and fights, then expires and releases enemies', () => {
    const g = field('jeff'); const e = enemy(g, 460); g.hero.attackTimer = 100;
    expect(g.reinforce({ x: 460, y: 250 })).toBe(true);
    const s = g.heroSummons[0]!; expect(s).toBeDefined();
    step(g, 1.5); expect(e.hp).toBeLessThan(e.maxHp); expect(e.heldBy).toEqual({ kind: 'summon', id: s.id });
    s.left = .01; updateHeroSummons(g, .02); expect(g.heroSummons).toHaveLength(0); expect(e.heldBy).toBeNull();
  });
  it('enemies can hurt Logan and a dead summon cannot hold or deal phantom damage', () => {
    const g = field('jeff'); const e = enemy(g, 440); e.def = { ...e.def, dps: 1000 }; g.hero.attackTimer = 100;
    expect(g.reinforce({ x: 440, y: 250 })).toBe(true);
    step(g, 3); expect(g.heroSummons).toHaveLength(0); expect(e.heldBy).toBeNull();
  });
  it('Sand Trap slows and chips ground enemies while Chris keeps his golf kit', () => {
    const g = field('chris'); const e = enemy(g); g.hero.attackTimer = 100;
    cast(g, 0); expect(g.heroZones.some(z => z.kind === 'sand')).toBe(true);
    updateAuras(g, .01); expect(e.slow).toBeGreaterThanOrEqual(.55);
  });
  it('Becbec shreds armor before her haymaker, slams crowds, and finishes all five combo hits', () => {
    const g = field('becbec'), e = enemy(g); g.hero.attackTimer = 100;
    cast(g, 0); expect(e.armorShred).toBe(.45); expect(e.stun).toBeGreaterThan(0);
    cast(g, 1); expect(g.heroVisuals.some(f => f.kind === 'slam')).toBe(true);
    const before = e.hp; cast(g, 4); expect(before - e.hp).toBeCloseTo(175); expect(e.stun).toBeGreaterThan(0);
  });
  it('Becbec becomes a five-enemy blocker and Iron Will repairs damage without exceeding max HP', () => {
    const g = field('becbec'); for (let i = 0; i < 5; i++) enemy(g, 322 + i * 3); g.hero.attackTimer = 100;
    cast(g, 2); step(g, .1); expect(g.enemies.filter(e => e.heldBy?.kind === 'hero')).toHaveLength(5);
    g.hero.hp = 100; cast(g, 3); expect(g.hero.hp).toBe(260); expect(g.hero.shield).toBeGreaterThan(0);
    step(g, 7); expect(g.enemies.filter(e => e.heldBy?.kind === 'hero')).toHaveLength(4);
  });
});

describe('Auras use their owners and real range', () => {
  it('Jeff heals and protects friendly NPCs only while alive and nearby', () => {
    const g = field('jeff'); g.reinforce({ x: 320, y: 250 }); const f = g.heroSummons[0]!; f.hp = 100;
    updateHeroAura(g, 1); expect(f.hp).toBeGreaterThan(100); expect(friendlyMitigation(g, f.pos)).toBe(.85);
    g.hero.pos.x = 900; expect(friendlyMitigation(g, f.pos)).toBe(1); const before = f.hp; updateHeroAura(g, 1); expect(f.hp).toBe(before);
  });
  it('Mike tower aura refreshes without stacking every frame or lingering out of range', () => {
    const g = field('mike'); g.placeTower(0, 'torch'); const t = g.towers[0]!;
    for (let i = 0; i < 5; i++) { updateAuras(g, 1 / 60); }
    expect(g.buffs.get(t.id)?.rate).toBe(.12); expect(g.buffs.get(t.id)?.range).toBe(.08);
    g.hero.pos.x = 900; updateAuras(g, 1 / 60); expect(g.buffs.get(t.id)).toBeUndefined();
  });
  it('Bob reveals phased enemies and slows air units; Chris gas affects ground enemies', () => {
    const bob = field('bob'), phase = enemy(bob, 340, 'airlock'); phase.phased = true; phase.phaseTimer = .001;
    step(bob, .05); expect(phase.phased).toBe(false);
    const fly = enemy(bob, 350, 'steamWisp'); updateAuras(bob, .01); expect(fly.slow).toBe(.2);
    const chris = field('chris'), ground = enemy(chris), air = enemy(chris, 345, 'steamWisp'); updateHeroAura(chris, 1);
    expect(ground.hp).toBeLessThan(ground.maxHp); expect(ground.slow).toBe(.15); expect(air.hp).toBe(air.maxHp);
    cast(chris, 3); updateAuras(chris, .01); expect(ground.slow).toBe(.4);
  });
  it('Becbec empowers nearby NPC strikes only while alive', () => {
    const g = field('becbec'); expect(friendlyDamageBuff(g, { x: 340, y: 250 })).toBe(1.2);
    expect(friendlyDamageBuff(g, { x: 700, y: 250 })).toBe(1); g.damageHero(100000); expect(friendlyDamageBuff(g, g.hero.pos)).toBe(1);
  });
  it('Mr. Chris aura is Strongest Boy in the 8th Grade', () => {
    expect(HEROES.chris.aura.name).toBe('Strongest Boy in the 8th Grade');
    expect(HEROES.chris.aura.name.toLowerCase()).not.toContain('fart');
  });
});

describe('Campaign integration', () => {
  it.each(HERO_ORDER)('%s completes the opening job with ordinary resources and a tower build', id => {
    const result = runHeadless(CRAWLSPACE, { heroId: id, difficulty: 'apprentice', microJeff: true, maxSeconds: 1000 });
    expect(result.won).toBe(true); expect(result.game.stats.jeffDamage).toBeGreaterThan(0);
    expect(result.game.hero.id).toBe(id); expect(result.livesLeft).toBeGreaterThan(0);
  });
});

describe('CBJ, Doni and Jayjay playable kits', () => {
  it('keeps the requested aura names verbatim', () => {
    expect(HEROES.cbj.aura.name).toBe('trucks n taters');
    expect(HEROES.doni.aura.name).toBe('guided fishing tour');
    expect(HEROES.jayjay.aura.name).toBe('would beat ronda rousey in a 1v1 easily');
  });
  it('CBJ buffs nearby towers once per frame, heals living crew, and loses the aura when downed', () => {
    const g = field('cbj'); g.placeTower(0, 'torch'); g.placeTower(1, 'torch');
    g.reinforce({ x: 320, y: 250 }); const s = g.heroSummons[0]!; s.hp = 100;
    updateAuras(g, 1); expect(s.hp).toBe(106); expect(g.buffs.get(g.towers[0]!.id)?.dmg).toBe(.1);
    expect(g.buffs.get(g.towers[1]!.id)).toBeUndefined();
    updateAuras(g, 1); expect(g.buffs.get(g.towers[0]!.id)?.dmg).toBe(.1);
    g.hero.pos.x = 900; updateAuras(g, 1); expect(s.hp).toBe(112); expect(g.buffs.get(g.towers[0]!.id)).toBeUndefined();
    g.hero.pos.x = 300; s.hp = 0; updateAuras(g, 1); expect(s.hp).toBe(0);
    g.damageHero(100000); updateAuras(g, 1); expect(g.buffs.size).toBe(0);
  });
  it('Loaded Tater waits for contact, splashes nearby targets, and Fully Loaded delivers nine shots', () => {
    const g = field('cbj'), a = enemy(g, 480), b = enemy(g, 500), far = enemy(g, 700); g.hero.attackTimer = 100;
    expect(fire(g, 0)).toBe(true); updateHero(g, .4);
    expect(g.heroMissiles[0]?.kind).toBe('tater'); expect(a.hp).toBe(a.maxHp);
    updateHeroMissiles(g, 1); expect(a.maxHp - a.hp).toBe(90); expect(b.maxHp - b.hp).toBe(90); expect(far.hp).toBe(far.maxHp);
    step(g, .5); cast(g, 4); const rain = g.heroZones.find(z => z.kind === 'taterRain')!;
    expect(rain).toBeDefined(); step(g, 4); expect(rain.ticks).toBe(9); expect(g.heroZones).toHaveLength(0);
    step(g, 2); expect(g.heroMissiles).toHaveLength(0);
  });
  it('Doni aura affects ground targets only and immediately stops after leaving range', () => {
    const g = field('doni'), ground = enemy(g), air = enemy(g, 350, 'steamWisp');
    updateAuras(g, .01); expect(ground.slow).toBe(.12); expect(ground.markBonus).toBe(.1); expect(air.slow).toBe(0);
    expect(applyDamage(g, ground, 100, 'physical', 'jeff')).toBeCloseTo(110);
    g.hero.pos.x = 900; updateAuras(g, .01); expect(ground.slow).toBe(0); expect(ground.marked).toBe(false); expect(ground.markBonus).toBe(0);
    g.hero.pos.x = 300; g.damageHero(100000); updateAuras(g, .01); expect(ground.marked).toBe(false);
  });
  it('Set the Hook pulls only at impact, with boss resistance and no airborne displacement', () => {
    for (const [id, pull] of [['sludge', 60], ['rogueBoiler', 12], ['steamWisp', 0]] as const) {
      const g = field('doni'), e = enemy(g, 560, id); g.hero.attackTimer = 100;
      const before = e.progress; expect(fire(g, 0)).toBe(true); updateHero(g, .5);
      expect(e.progress).toBe(before); expect(e.hp).toBe(e.maxHp); expect(g.heroMissiles[0]?.kind).toBe('hook');
      updateHeroMissiles(g, 2); expect(e.progress).toBeCloseTo(before - pull); expect(e.hp).toBeLessThan(e.maxHp);
      expect(e.stun).toBe(pull ? 1.2 : 0);
    }
  });
  it('The Big One hooks three distinct targets and the net expires without lingering slows', () => {
    const g = field('doni'), es = [enemy(g, 480), enemy(g, 530), enemy(g, 580)]; g.hero.attackTimer = 100;
    expect(fire(g, 4)).toBe(true); updateHero(g, .6);
    for (let i = 0; i < 3; i++) updateHeroMissiles(g, 1);
    expect(es.map(e => e.maxHp - e.hp)).toEqual([150, 105, 73.5]); expect(g.heroMissiles).toHaveLength(0);
    step(g, .7); cast(g, 1); updateAuras(g, .1); expect(es[0]!.slow).toBe(.55);
    step(g, 7); expect(g.heroZones).toHaveLength(0); updateAuras(g, .01); expect(es[0]!.slow).toBe(.12);
    g.hero.pos.x = 900; updateAuras(g, .01); expect(es[0]!.slow).toBe(0);
  });
  it('Jayjay aura does not extend stronger timed armor debuffs and protects nearby companions', () => {
    const g = field('jayjay'), e = enemy(g, 340, 'scaleCrab'); e.armorShred = .45; e.shredTimer = .1;
    updateAuras(g, .01); expect(e.auraArmorShred).toBe(.15);
    updateEnemies(g, .2); expect(e.armorShred).toBe(0); expect(e.auraArmorShred).toBe(.15);
    expect(friendlyMitigation(g, e.pos)).toBe(.8);
    g.hero.pos.x = 900; updateAuras(g, .01); expect(e.auraArmorShred).toBe(0); expect(friendlyMitigation(g, e.pos)).toBe(1);
    g.hero.pos.x = 300; g.damageHero(100000); updateAuras(g, .01); expect(e.auraArmorShred).toBe(0);
  });
  it('Unanimous Decision has three separate contacts, with no early or duplicate damage', () => {
    const g = field('jayjay'), e = enemy(g); g.hero.attackTimer = 100;
    expect(fire(g, 4)).toBe(true); updateHero(g, .2); expect(e.hp).toBe(e.maxHp);
    updateHero(g, .1); expect(e.maxHp - e.hp).toBe(75);
    updateHero(g, .5); expect(e.maxHp - e.hp).toBe(75);
    updateHero(g, .1); expect(e.maxHp - e.hp).toBe(150);
    updateHero(g, .6); expect(e.maxHp - e.hp).toBe(225); expect(e.stun).toBe(1.7);
    updateHero(g, .31); expect(e.maxHp - e.hp).toBe(225); expect(g.hero.cast).toBeUndefined();
  });
  it('Jayjay rejects airborne punch targets without spending the cooldown', () => {
    const g = field('jayjay'), e = enemy(g, 340, 'steamWisp');
    expect(g.useAbility(0, { pos: e.pos, enemyId: e.id })).toBe(false); expect(g.hero.clampCooldown).toBe(0);
  });
  it.each(['cbj', 'doni', 'jayjay'] as const)('%s releases holds on defeat and can redeploy after recovery', id => {
    const g = field(id), e = enemy(g, 325); step(g, .2); expect(e.heldBy?.kind).toBe('hero');
    g.damageHero(100000); expect(e.heldBy).toBeNull(); expect(g.hero.downed).toBeGreaterThan(0);
    step(g, HEROES[id].respawn + .1); expect(g.hero.downed).toBeLessThanOrEqual(0); expect(g.hero.deployed).toBe(false);
    expect(g.deployHero(g.map.jeffStart)).toBe(true); expect(g.hero.hp).toBe(g.hero.maxHp);
  });
});
