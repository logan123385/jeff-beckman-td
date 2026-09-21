import { describe, expect, it } from 'vitest';
import { DIFFICULTIES } from '../src/data/difficulty';
import { ENEMIES } from '../src/data/enemies';
import { HEAT_PLANT } from '../src/data/maps/heatPlant';
import { CRAWLSPACE } from '../src/data/maps/crawlspace';
import { MAPS } from '../src/data/maps';
import { loadoutWarnings } from '../src/data/intel';
import { neutralModifiers } from '../src/data/skills';
import { SPECIALIST_ABILITIES, SPECIALIST_KITS, specialistAbilityCost } from '../src/data/specialistAbilities';
import { TOWERS, TOWER_ORDER } from '../src/data/towers';
import type { TowerId } from '../src/data/types';
import { Game } from '../src/sim/game';
import { applyDamage } from '../src/sim/combat';
import { updateEnemies } from '../src/sim/enemies';
import { updateAuras, updateTowers } from '../src/sim/towers';
import { updateSpecialistAbilities } from '../src/sim/specialistAbilities';

function field(mapId = 'crawlspace'): Game {
  const game = new Game({ ...CRAWLSPACE, id: mapId, startMoney: 50000, allowedTowers: TOWER_ORDER,
    paths: [[{ x: 20, y: 200 }, { x: 920, y: 200 }]],
    slots: [{ x: 300, y: 150 }, { x: 370, y: 150 }, { x: 500, y: 150 }], jeffStart: { x: 300, y: 210 },
  }, { difficulty: DIFFICULTIES.journeyman, mods: neutralModifiers(), manualStart: true });
  game.deployHero({ ...game.map.jeffStart });
  return game;
}
function specialist(g: Game, id: TowerId, slot = 0) {
  g.placeTower(slot, id); const t = g.towerAt(slot)!;
  g.upgradeTower(t.id); g.upgradeTower(t.id); g.specializeTower(t.id, 'power'); t.build = 0; return t;
}
function target(g: Game, id: keyof typeof ENEMIES = 'sludge', at = 285) {
  const e = g.spawnEnemy(id, 0, at); e.def = { ...e.def, speed: 0 }; e.lane = 0; return e;
}

describe('Specialist ability economy', () => {
  it.each(TOWER_ORDER)('%s has two per-building, refundable abilities with three bounded ranks', id => {
    const g = field(), original = JSON.stringify(TOWERS[id]), t = specialist(g, id);
    g.placeTower(1, id);
    for (const ability of SPECIALIST_KITS[id]) {
      for (let rank = 0; rank < 3; rank++) {
        const before = g.money, invested = t.invested;
        expect(g.buySpecialistAbility(t.id, ability)).toBe(true);
        expect(t.abilities?.[ability]?.rank).toBe(rank + 1);
        expect(before - g.money).toBe(specialistAbilityCost(ability, rank));
        expect(t.invested - invested).toBe(specialistAbilityCost(ability, rank));
      }
      const before = g.money; expect(g.buySpecialistAbility(t.id, ability)).toBe(false); expect(g.money).toBe(before);
    }
    expect(JSON.stringify(TOWERS[id])).toBe(original); expect(g.towerAt(1)!.abilities).toBeUndefined();
    const refund = g.sellValue(t), cash = g.money; g.sellTower(t.id); expect(g.money).toBe(cash + refund);
  });
  it('rejects untrained, wrong-kit, unaffordable and finished-run purchases atomically', () => {
    const g = field(); g.placeTower(0, 'torch'); const t = g.towers[0]!;
    const cash = g.money; expect(g.buySpecialistAbility(t.id, 'incinerate')).toBe(false); expect(g.money).toBe(cash);
    g.upgradeTower(t.id); g.upgradeTower(t.id); g.specializeTower(t.id, 'power');
    expect(g.buySpecialistAbility(t.id, 'mend')).toBe(false);
    g.money = 0; expect(g.buySpecialistAbility(t.id, 'chain')).toBe(false); expect(t.abilities).toBeUndefined();
    g.money = 1000; g.status = 'won'; expect(g.buySpecialistAbility(t.id, 'chain')).toBe(false); expect(g.money).toBe(1000);
  });
  it('upgrading an ability preserves its active cooldown; idle abilities do not waste their cast', () => {
    const g = field(), t = specialist(g, 'torch'); g.buySpecialistAbility(t.id, 'chain');
    updateSpecialistAbilities(g, t, .1); expect(t.abilities!.chain!.cooldown).toBe(0);
    target(g); updateSpecialistAbilities(g, t, .1); const cooldown = t.abilities!.chain!.cooldown;
    g.buySpecialistAbility(t.id, 'chain'); expect(t.abilities!.chain!.cooldown).toBe(cooldown);
    t.frozen = 2; const e = target(g); updateSpecialistAbilities(g, t, 10); expect(e.hp).toBe(e.maxHp);
  });
});

describe('Abilities produce distinct combat outcomes', () => {
  it('burn ignores armor, obeys fire resistance, expires, and attributes the damage', () => {
    const g = field(), t = specialist(g, 'torch'); g.buySpecialistAbility(t.id, 'incinerate');
    const crab = target(g, 'scaleCrab'); updateSpecialistAbilities(g, t, .01);
    updateEnemies(g, 1); expect(crab.hp).toBe(crab.maxHp - 18); expect(g.stats.towerDamage.torch).toBe(18);
    updateEnemies(g, 5); expect(crab.burn).toBeUndefined(); expect(crab.hp).toBe(crab.maxHp - 72);
  });
  it('ground splash never hits fliers and only hits enemies in its impact radius', () => {
    const g = field(), t = specialist(g, 'washer'); g.buySpecialistAbility(t.id, 'barrage');
    const ground = target(g), air = target(g, 'steamWisp'), nearby = target(g, 'sludge', 280), far = target(g, 'sludge', 650);
    updateSpecialistAbilities(g, t, .01);
    expect(air.hp).toBe(air.maxHp); expect(far.hp).toBe(far.maxHp); expect(ground.hp).toBeLessThan(ground.maxHp); expect(nearby.hp).toBeLessThan(nearby.maxHp);
  });
  it('chain hits three distinct enemies once; deadeye picks the toughest target', () => {
    const g = field(), t = specialist(g, 'vent'); g.buySpecialistAbility(t.id, 'chain');
    const foes = [target(g, 'sludge', 275), target(g, 'sludge', 290), target(g, 'sludge', 310), target(g, 'sludge', 325)];
    updateSpecialistAbilities(g, t, .01); expect(foes.filter(e => e.hp < e.maxHp)).toHaveLength(3);
    const strong = target(g, 'glycolGolem', 250); g.buySpecialistAbility(t.id, 'deadeye'); updateSpecialistAbilities(g, t, .01);
    expect(strong.hp).toBeLessThan(strong.maxHp); expect(t.abilities!.deadeye!.cooldown).toBe(SPECIALIST_ABILITIES.deadeye.cooldown);
  });
  it('healing is capped and does not resurrect fallen crew or hero', () => {
    const g = field(), t = specialist(g, 'barricade'); g.buySpecialistAbility(t.id, 'mend');
    g.reinforce({ ...t.pos });
    const healthy = g.heroSummons[0]!, dead = { ...healthy, id: g.nextEntityId(), hp: 0 };
    g.heroSummons.push(dead); healthy.hp -= 20;
    g.hero.hp = 0; g.hero.downed = 10; updateSpecialistAbilities(g, t, .01);
    expect(healthy.hp).toBe(healthy.maxHp); expect(dead.hp).toBe(0); expect(g.hero.hp).toBe(0);
  });
  it('overtime buffs expire and multiple buildings do not multiply the effect', () => {
    const g = field(), a = specialist(g, 'thermostat'), b = specialist(g, 'thermostat', 1);
    for (const t of [a, b]) g.buySpecialistAbility(t.id, 'overclock');
    target(g); updateSpecialistAbilities(g, a, .01); updateSpecialistAbilities(g, b, .01);
    expect(a.overclock?.strength).toBe(.2); updateAuras(g, .1); expect(g.buffs.get(a.id)?.rate).toBeGreaterThanOrEqual(.2);
    updateAuras(g, 5); expect(a.overclock).toBeUndefined();
  });
  it('freeze respects boss resistance and corrode removes armor for a limited time', () => {
    const g = field(), t = specialist(g, 'glycol'); g.buySpecialistAbility(t.id, 'freeze'); g.buySpecialistAbility(t.id, 'corrode');
    const boss = target(g, 'rogueBoiler', 300), crab = target(g, 'scaleCrab', 310);
    updateSpecialistAbilities(g, t, .01); expect(boss.stun).toBe(.4); expect(crab.stun).toBe(1.5); expect(crab.armorShred).toBeCloseTo(.35);
    expect(applyDamage(g, crab, 100, 'physical', 'crew')).toBeCloseTo(75);
    updateEnemies(g, 6); expect(crab.armorShred).toBe(0);
  });
  it('fault finder reveals phased enemies and its vulnerability expires', () => {
    const g = field(), t = specialist(g, 'camera'); g.buySpecialistAbility(t.id, 'expose');
    const foe = target(g, 'airlock'); foe.phased = true;
    updateSpecialistAbilities(g, t, .01); expect(foe.phased).toBe(false); expect(foe.revealTimer).toBe(5);
    expect(applyDamage(g, foe, 20, 'heat', 'crew')).toBe(25);
    updateEnemies(g, 5); expect(foe.exposed).toBeUndefined();
  });
  it('groundbreaker displaces ground targets but never bosses or fliers', () => {
    const g = field(), t = specialist(g, 'barricade'); g.buySpecialistAbility(t.id, 'shockwave');
    const ground = target(g), boss = target(g, 'rogueBoiler'), air = target(g, 'steamWisp');
    updateSpecialistAbilities(g, t, .01); expect(ground.progress).toBe(270); expect(boss.progress).toBe(285); expect(air.hp).toBe(air.maxHp);
  });
});

describe('Readable boss encounters', () => {
  it('a boss breach fails the mission even if ordinary lives remain', () => {
    const g = field(), boss = target(g, 'rogueBoiler', 950);
    g.waveIdx = g.map.waves.length;
    g.update(.01);
    expect(boss.escaped).toBe(true); expect(g.status).toBe('lost'); expect(g.lives).toBe(0);
    expect(g.stats.escapedByType.rogueBoiler).toBe(1);
  });
  it('telegraphs a fixed location before damage and lets the hero dodge it', () => {
    const g = field(), boss = target(g, 'rogueBoiler'); boss.ventTimer = .01;
    const hp = g.hero.hp; updateEnemies(g, .02); expect(boss.ventCast).toBeDefined(); expect(g.hero.hp).toBe(hp);
    const marked = { ...boss.ventCast!.pos }; boss.pos.x += 50;
    expect(boss.ventCast!.pos).toEqual(marked);
    g.hero.pos = { x: 850, y: 400 }; updateEnemies(g, 2.1); expect(g.hero.hp).toBe(hp); expect(boss.ventCast).toBeUndefined();
  });
  it('hits allies on impact once and releases defeated crew holds', () => {
    const g = field(), boss = target(g, 'rogueBoiler'); g.reinforce({ x: 305, y: 200 });
    const logan = g.heroSummons[0]!; logan.hp = 50; boss.heldBy = { kind: 'summon', id: logan.id };
    boss.ventTimer = 0; updateEnemies(g, .01); const hp = g.hero.hp;
    updateEnemies(g, 1); expect(g.hero.hp).toBe(hp);
    updateEnemies(g, 1.1); expect(g.hero.hp).toBeLessThan(hp); expect(logan.hp).toBe(0); expect(boss.heldBy).toBeNull();
    const after = g.hero.hp; updateEnemies(g, .1); expect(g.hero.hp).toBe(after);
  });
  it('a stun or killing the boss cancels a pending impact', () => {
    for (const kill of [false, true]) {
      const g = field(), boss = target(g, 'rogueBoiler'); boss.ventTimer = 0; updateEnemies(g, .01);
      const hp = g.hero.hp;
      if (kill) applyDamage(g, boss, 100000, 'heat', 'crew'); else boss.stun = 1;
      updateEnemies(g, .1); updateEnemies(g, 2.1); expect(g.hero.hp).toBeGreaterThanOrEqual(hp); // Kills can grant a rank and heal the hero.
      if (!kill) expect(boss.ventCast).toBeUndefined();
    }
  });
  it('the final boss targets the largest nearby investment without mutating other bosses', () => {
    const g = field('heatPlant'), t = specialist(g, 'torch'); g.placeTower(1, 'washer');
    const boss = target(g, 'rogueBoiler'); boss.ventTimer = 0; updateEnemies(g, .01);
    expect(boss.def.name).toBe('The First Furnace'); expect(boss.def.hp).toBe(ENEMIES.rogueBoiler.hp); expect(boss.ventCast?.pos).toEqual(t.pos);
    expect(ENEMIES.rogueBoiler.name).toBe('Rogue Boiler');
    expect(HEAT_PLANT.waves.at(-1)!.groups.some(group => group.enemy === 'rogueBoiler')).toBe(true);
  });
  it('furnace impacts overheat defenses temporarily; an expansion shield prevents it', () => {
    for (const shielded of [false, true]) {
      const g = field('heatPlant'), t = specialist(g, 'torch');
      if (shielded) g.placeTower(1, 'expansion');
      const boss = target(g, 'rogueBoiler'); boss.ventTimer = 0;
      updateEnemies(g, .01); updateEnemies(g, 2.5);
      if (shielded) expect(t.overheated ?? 0).toBe(0);
      else {
        expect(t.overheated).toBe(2.5); updateTowers(g, 1); expect(t.windup ?? 0).toBe(0);
        updateTowers(g, 1.6); expect(t.overheated).toBe(0); expect(t.windup).toBeGreaterThan(0);
      }
    }
  });
  it('a damage-over-time kill cannot produce a final phantom boss impact', () => {
    const g = field(), boss = target(g, 'rogueBoiler'); boss.ventTimer = 0; updateEnemies(g, .01);
    boss.ventCast!.left = .01; boss.hp = 1; boss.dotDps = 100; boss.dotTime = 1; boss.dotSource = 'descaler';
    const hp = g.hero.hp; updateEnemies(g, .1); expect(boss.dead).toBe(true); expect(g.hero.hp).toBeGreaterThanOrEqual(hp);
  });
});

describe('Honest mission intelligence', () => {
  it('warns about an anti-air gap even with a support camera and clears it for a damaging tower', () => {
    const map = MAPS.find(m => m.id === 'attic')!;
    expect(loadoutWarnings(map, ['camera', 'washer', 'barricade']).some(w => w.includes('anti-air'))).toBe(true);
    expect(loadoutWarnings(map, ['vent', 'washer', 'barricade']).some(w => w.includes('anti-air'))).toBe(false);
  });
  it('scouting does not advance waves, grant money, or reveal entries in the save', () => {
    const g = field(), cash = g.money;
    for (let i = 0; i < 10; i++) g.nextWavePreview();
    expect(g.waveIdx).toBe(0); expect(g.money).toBe(cash); expect(g.seen.size).toBe(0);
  });
});
