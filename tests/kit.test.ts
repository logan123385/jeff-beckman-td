import { describe, expect, it } from 'vitest';
import { Rng } from '../src/core/rng';
import { HERO_ORDER } from '../src/data/heroes';
import { cardUnlocked, cardsFor, defaultCards, KIT_CARDS } from '../src/data/kitCards';
import { rollChest } from '../src/data/loot';
import { CRAWLSPACE } from '../src/data/maps/crawlspace';
import { DIFFICULTIES } from '../src/data/difficulty';
import { neutralModifiers } from '../src/data/modifiers';
import { defaultFamily, familyHero, familyStance, implicitFor } from '../src/data/weapons';
import { SAVE_KEY, normalizeSave, SaveStore } from '../src/save/save';
import { kitSummary } from '../src/ui/screens/kit';
import { resolveAttackProfile as resolve } from '../src/sim/attackProfile';
import { Game } from '../src/sim/game';
import { updateEnemies } from '../src/sim/enemies';
import { updateHero } from '../src/sim/hero';
import { updateHeroMissiles } from '../src/sim/heroPowers';
import { updateAuras } from '../src/sim/towers';

function playJeff(family: 'jeff_melee' | 'jeff_ranged') {
  return new Game(CRAWLSPACE, { difficulty: DIFFICULTIES.apprentice, mods: neutralModifiers(), hero: 'jeff', kit: { family, weapon: null, cards: [null, null] } });
}

describe('kitSummary', () => {
  it('describes Jeff default kit with Pipe Wrench and starter verbs', () => {
    const save = new SaveStore(null);
    const kit = save.heroKit('jeff');
    const summary = kitSummary('jeff', kit, save.data.heroJobs.jeff ?? 0);
    expect(summary).toContain('Pipe Wrench');
    expect(summary).toContain('Hold');
    expect(summary).toContain('Tap');
  });

  it('describes Jeff ranged with Pressure Wand and signature basics when cards empty', () => {
    const save = new SaveStore(null);
    save.setFamily('jeff', 'jeff_ranged');
    const kit = { ...save.heroKit('jeff'), cards: [null, null] as [null, null] };
    const summary = kitSummary('jeff', kit, save.data.heroJobs.jeff ?? 0);
    expect(summary).toContain('Pressure Wand');
    expect(summary).toContain('signature basics');
  });
});

describe('profile basics', () => {
  it('lets a wand Jeff hit air and a wrench Jeff hold ground', () => {
    const melee = playJeff('jeff_melee');
    expect(melee.attackProfile.air).toBe(false);
    expect(melee.attackProfile.holds).toBeGreaterThanOrEqual(2);
    const wand = playJeff('jeff_ranged');
    expect(wand.attackProfile.air).toBe(true);
    expect(wand.attackProfile.holds).toBe(0);
    expect(wand.attackProfile.missile).toBe('hose');
  });
});

describe('weapon families', () => {
  it('gives each hero a default family matching today’s stance', () => {
    expect(defaultFamily('jeff')).toBe('jeff_melee');
    expect(defaultFamily('mike')).toBe('mike_ranged');
    expect(defaultFamily('bob')).toBe('bob_ranged');
    expect(defaultFamily('chris')).toBe('chris_melee');
    expect(defaultFamily('becbec')).toBe('becbec_melee');
    expect(defaultFamily('cbj')).toBe('cbj_ranged');
    expect(defaultFamily('doni')).toBe('doni_ranged');
    expect(defaultFamily('jayjay')).toBe('jayjay_melee');
  });
  it('exposes 16 families with air and hold rules from the spec', () => {
    expect(HERO_ORDER).toHaveLength(8);
    const jeffMelee = resolve('jeff_melee', 'common', []);
    expect(jeffMelee.air).toBe(false);
    expect(jeffMelee.holds).toBe(2);
    expect(jeffMelee.reach).toBe(42);
    const jeffWand = resolve('jeff_ranged', 'relic', []);
    expect(jeffWand.air).toBe(true);
    expect(jeffWand.holds).toBe(0);
    expect(jeffWand.pierce).toBe(2);
    expect(familyHero('mike_melee')).toBe('mike');
    expect(familyStance('mike_melee')).toBe('melee');
  });
  it('scales implicits by rarity and applies reach affixes', () => {
    expect(implicitFor('jayjay_melee', 'common').holds).toBe(0);
    expect(implicitFor('jayjay_melee', 'uncommon').holds).toBe(1);
    expect(implicitFor('jayjay_melee', 'relic').holds).toBe(2);
    const boosted = resolve('jeff_melee', 'uncommon', [{ key: 'jeffHolds', amount: 1 }, { key: 'jeffReach', amount: 0.1 }]);
    expect(boosted.holds).toBe(3);
    expect(boosted.reach).toBeCloseTo(42 * 1.1, 5);
    expect(implicitFor('cbj_melee', 'common').splash).toBeCloseTo(0.20, 5);
    expect(implicitFor('cbj_melee', 'common').splashRadius).toBe(36);
  });
});

describe('kit chests', () => {
  it('leans armor on campaign clears and the played hero on endless', () => {
    const campaign = Array.from({ length: 200 }, (_, i) => rollChest(new Rng(i + 1), 'job', `c${i}`, 'jeff'));
    const armor = campaign.filter(item => item.kind === 'armor').length;
    expect(armor).toBeGreaterThan(110);
    const night = Array.from({ length: 200 }, (_, i) => rollChest(new Rng(1000 + i), 'deepNight', `n${i}`, 'doni'));
    const doniWeapons = night.filter(item => item.kind === 'weapon' && item.family.startsWith('doni_'));
    expect(doniWeapons.length).toBeGreaterThan(90);
    const relic = rollChest(new Rng(42), 'deepNight', 'r1', 'jeff');
    expect(['uncommon', 'rare', 'relic']).toContain(relic.rarity);
  });
});

describe('kit cards', () => {
  it('has four melee and four ranged cards per hero', () => {
    expect(KIT_CARDS).toHaveLength(64);
    for (const hero of HERO_ORDER) {
      expect(cardsFor(hero, 'melee').map(c => c.job)).toEqual(['anchor', 'breaker', 'crew', 'sweep']);
      expect(cardsFor(hero, 'ranged').map(c => c.job)).toEqual(['lane', 'pin', 'control', 'spot']);
    }
  });
  it('unlocks crew after one job and sweep after three', () => {
    const crew = cardsFor('jeff', 'melee').find(c => c.job === 'crew')!;
    const sweep = cardsFor('jeff', 'melee').find(c => c.job === 'sweep')!;
    expect(cardUnlocked(crew, 0)).toBe(false);
    expect(cardUnlocked(crew, 1)).toBe(true);
    expect(cardUnlocked(sweep, 2)).toBe(false);
    expect(cardUnlocked(sweep, 3)).toBe(true);
    expect(defaultCards('jeff')).toEqual(['jeff_anchor', 'jeff_breaker']);
    expect(defaultCards('mike')).toEqual(['mike_lane', 'mike_pin']);
  });
});

function landContactBasic(g: Game) {
  const swing = g.heroDef.swingTime;
  updateHero(g, 0.01);
  updateHero(g, swing * 0.2);
  updateHero(g, swing * 0.3);
}

function waitBasicCooldown(g: Game) {
  const swing = g.heroDef.swingTime;
  const cooldown = 1 / (g.attackProfile.attackRate * g.mods.heroRate);
  updateHero(g, swing + cooldown + 0.05);
}

describe('kit combat', () => {
  it('Jeff anchor+crew raises holds to 3 and buffs nearby towers', () => {
    const g = new Game(CRAWLSPACE, {
      difficulty: DIFFICULTIES.apprentice,
      mods: neutralModifiers(),
      hero: 'jeff',
      kit: { family: 'jeff_melee', weapon: null, cards: ['jeff_anchor', 'jeff_crew'] },
      manualStart: true,
    });
    g.deployHero({ ...g.map.jeffStart });
    g.placeTower(1, 'torch');
    const tower = g.towers[0]!;
    updateHero(g, 0.01);
    expect(g.attackProfile.holds).toBe(3);
    updateAuras(g, 0.01);
    expect(g.buffs.get(tower.id)?.dmg).toBeCloseTo(0.12, 5);
  });

  it('Jeff lane+control slows hose targets', () => {
    const g = new Game(CRAWLSPACE, {
      difficulty: DIFFICULTIES.apprentice,
      mods: neutralModifiers(),
      hero: 'jeff',
      kit: { family: 'jeff_ranged', weapon: null, cards: ['jeff_lane', 'jeff_control'] },
      manualStart: true,
    });
    g.deployHero({ ...g.map.jeffStart });
    const e = g.spawnEnemy('sludge', 0, 320);
    e.lane = 0;
    e.pos = { x: 340, y: 250 };
    e.def = { ...e.def, dps: 0, speed: 0 };
    e.hp = e.maxHp = 10000;
    updateHero(g, 0.01);
    updateHero(g, g.heroDef.swingTime * 0.2);
    updateHero(g, g.heroDef.swingTime * 0.3);
    expect(g.heroMissiles).toHaveLength(1);
    updateHeroMissiles(g, 2);
    expect(e.slow).toBeGreaterThanOrEqual(0.2);
  });

  it('stuns on the third becbec_melee punch', () => {
    const g = new Game(CRAWLSPACE, {
      difficulty: DIFFICULTIES.apprentice,
      mods: neutralModifiers(),
      hero: 'becbec',
      kit: { family: 'becbec_melee', weapon: null, cards: [null, null] },
      manualStart: true,
    });
    g.deployHero({ ...g.map.jeffStart });
    const e = g.spawnEnemy('sludge', 0, 320);
    e.lane = 0;
    e.pos = { x: 340, y: 250 };
    e.def = { ...e.def, dps: 0, speed: 0 };
    e.hp = e.maxHp = 10000;
    landContactBasic(g);
    expect(e.stun).toBe(0);
    waitBasicCooldown(g);
    landContactBasic(g);
    expect(e.stun).toBe(0);
    waitBasicCooldown(g);
    landContactBasic(g);
    expect(e.stun).toBeGreaterThanOrEqual(0.35);
  });
  it('cbj lane+Extra Spud passes splash radius on tater basics', () => {
    const g = new Game(CRAWLSPACE, {
      difficulty: DIFFICULTIES.apprentice,
      mods: neutralModifiers(),
      hero: 'cbj',
      kit: { family: 'cbj_ranged', weapon: null, cards: ['cbj_lane', null] },
      manualStart: true,
    });
    g.deployHero({ ...g.map.jeffStart });
    expect(g.attackProfile.splashRadius).toBeGreaterThanOrEqual(18);
    const primary = g.spawnEnemy('sludge', 0, 320);
    primary.lane = 0;
    primary.pos = { x: 340, y: 250 };
    primary.def = { ...primary.def, dps: 0, speed: 0 };
    primary.hp = primary.maxHp = 10000;
    const nearby = g.spawnEnemy('sludge', 0, 320);
    nearby.lane = 0;
    nearby.pos = { x: 360, y: 250 };
    nearby.def = { ...nearby.def, dps: 0, speed: 0 };
    nearby.hp = nearby.maxHp = 10000;
    const nearbyHp = nearby.hp;
    updateHero(g, 0.01);
    updateHero(g, g.heroDef.swingTime * 0.2);
    updateHero(g, g.heroDef.swingTime * 0.3);
    expect(g.heroMissiles).toHaveLength(1);
    expect(g.heroMissiles[0]?.splash).toBeGreaterThanOrEqual(18);
    updateHeroMissiles(g, 2);
    expect(nearby.hp).toBeLessThan(nearbyHp);
  });

  it('cbj_melee common splash is ~20% of primary, not 20×', () => {
    const g = new Game(CRAWLSPACE, {
      difficulty: DIFFICULTIES.apprentice,
      mods: neutralModifiers(),
      hero: 'cbj',
      kit: { family: 'cbj_melee', weapon: null, cards: [null, null] },
      manualStart: true,
    });
    g.deployHero({ ...g.map.jeffStart });
    const primary = g.spawnEnemy('sludge', 0, 320);
    primary.lane = 0;
    primary.pos = { x: 340, y: 250 };
    primary.def = { ...primary.def, dps: 0, speed: 0 };
    primary.hp = primary.maxHp = 10000;
    const nearby = g.spawnEnemy('sludge', 0, 320);
    nearby.lane = 0;
    nearby.pos = { x: 365, y: 250 };
    nearby.def = { ...nearby.def, dps: 0, speed: 0 };
    nearby.hp = nearby.maxHp = 10000;
    const primaryHpBefore = primary.hp;
    const nearbyHpBefore = nearby.hp;
    landContactBasic(g);
    const primaryDmg = primaryHpBefore - primary.hp;
    const splashDmg = nearbyHpBefore - nearby.hp;
    expect(primaryDmg).toBeGreaterThan(0);
    expect(splashDmg).toBeGreaterThan(0);
    expect(splashDmg / primaryDmg).toBeCloseTo(0.20, 1);
    expect(splashDmg).toBeLessThan(primaryDmg);
  });

  it('applies weapon onHitHeat DoT on basic connect', () => {
    const g = new Game(CRAWLSPACE, {
      difficulty: DIFFICULTIES.apprentice,
      mods: neutralModifiers(),
      hero: 'jeff',
      kit: {
        family: 'jeff_melee',
        weapon: {
          kind: 'weapon',
          id: 'w-test',
          family: 'jeff_melee',
          name: 'Hot Wrench',
          rarity: 'rare',
          affixes: [{ key: 'onHitHeat', amount: 8 }],
        },
        cards: [null, null],
      },
      manualStart: true,
    });
    expect(g.mods.onHitHeat).toBe(8);
    g.deployHero({ ...g.map.jeffStart });
    const e = g.spawnEnemy('sludge', 0, 320);
    e.lane = 0;
    e.pos = { x: 340, y: 250 };
    e.def = { ...e.def, dps: 0, speed: 0 };
    e.hp = e.maxHp = 10000;
    landContactBasic(g);
    expect(e.dotDps).toBe(8);
    expect(e.dotTime).toBe(2);
    expect(e.dotSource).toBe('jeff');
    expect(e.dotType).toBe('heat');
  });

  it('ticks onHitHeat as heat through armor (CORR-001)', () => {
    const g = new Game(CRAWLSPACE, {
      difficulty: DIFFICULTIES.apprentice,
      mods: neutralModifiers(),
      hero: 'jeff',
      kit: {
        family: 'jeff_melee',
        weapon: {
          kind: 'weapon',
          id: 'w-hot',
          family: 'jeff_melee',
          name: 'Hot Wrench',
          rarity: 'rare',
          affixes: [{ key: 'onHitHeat', amount: 10 }],
        },
        cards: [null, null],
      },
      manualStart: true,
    });
    g.deployHero({ ...g.map.jeffStart });
    const e = g.spawnEnemy('scaleCrab', 0, 320);
    e.lane = 0;
    e.pos = { x: 340, y: 250 };
    e.properties = [];
    e.def = { ...e.def, dps: 0, speed: 0 };
    e.hp = e.maxHp = 10000;
    landContactBasic(g);
    expect(e.dotType).toBe('heat');
    expect(e.dotDps).toBe(10);
    const before = e.hp;
    updateEnemies(g, 1);
    const dealt = before - e.hp;
    const waterThroughArmor = 10 * (1 - e.def.armor);
    expect(dealt).toBeCloseTo(10, 0);
    expect(dealt).toBeGreaterThan(waterThroughArmor + 3);
  });

  it('counts Jeff pin cadence once per ranged basic', () => {
    const g = new Game(CRAWLSPACE, {
      difficulty: DIFFICULTIES.apprentice,
      mods: neutralModifiers(),
      hero: 'jeff',
      kit: { family: 'jeff_ranged', weapon: null, cards: ['jeff_pin', null] },
      manualStart: true,
    });
    g.deployHero({ ...g.map.jeffStart });
    const e = g.spawnEnemy('sludge', 0, 320);
    e.lane = 0;
    e.pos = { x: 340, y: 250 };
    e.def = { ...e.def, dps: 0, speed: 0 };
    e.hp = e.maxHp = 10000;
    const losses: number[] = [];
    for (let i = 0; i < 4; i++) {
      e.hp = 10000;
      g.hero.attackTimer = 0;
      g.hero.swing = 0;
      g.hero.pendingStrike = undefined;
      g.heroMissiles = [];
      const before = e.hp;
      updateHero(g, 0.01);
      updateHero(g, g.heroDef.swingTime * 0.55);
      updateHeroMissiles(g, 2);
      losses.push(before - e.hp);
    }
    expect(losses[0]).toBeGreaterThan(0);
    expect(losses[1]).toBeCloseTo(losses[0]!, 0);
    expect(losses[3]! / losses[0]!).toBeCloseTo(1.6, 1);
  });

  it('does not count pierce hops as extra pin basics (CORR-002)', () => {
    const g = new Game(CRAWLSPACE, {
      difficulty: DIFFICULTIES.apprentice,
      mods: neutralModifiers(),
      hero: 'jeff',
      kit: {
        family: 'jeff_ranged',
        weapon: {
          kind: 'weapon',
          id: 'w-pierce',
          family: 'jeff_ranged',
          name: 'Relic Wand',
          rarity: 'relic',
          affixes: [],
        },
        cards: ['jeff_pin', null],
      },
      manualStart: true,
    });
    expect(g.attackProfile.pierce).toBe(2);
    g.deployHero({ ...g.map.jeffStart });
    const pack = [320, 360, 400].map((progress) => {
      const e = g.spawnEnemy('sludge', 0, progress);
      e.lane = 0;
      e.pos = { x: 300 + (progress - 320), y: 250 };
      e.def = { ...e.def, dps: 0, speed: 0 };
      e.hp = e.maxHp = 10000;
      return e;
    });
    updateHero(g, 0.01);
    updateHero(g, g.heroDef.swingTime * 0.55);
    expect(g.heroMissiles).toHaveLength(1);
    updateHeroMissiles(g, 2);
    updateHeroMissiles(g, 2);
    updateHeroMissiles(g, 2);
    expect(pack.filter((e) => e.hp < e.maxHp).length).toBeGreaterThan(1);
    expect(g.kitState.hitCounts.jeff_pin).toBe(1);
  });

  it('does not count bounce hops as extra pin basics (CORR-002)', () => {
    const g = new Game(CRAWLSPACE, {
      difficulty: DIFFICULTIES.apprentice,
      mods: neutralModifiers(),
      hero: 'chris',
      kit: {
        family: 'chris_ranged',
        weapon: {
          kind: 'weapon',
          id: 'w-bounce',
          family: 'chris_ranged',
          name: 'Relic Iron',
          rarity: 'relic',
          affixes: [],
        },
        cards: ['chris_pin', null],
      },
      manualStart: true,
    });
    expect(g.attackProfile.bounce).toBe(2);
    g.deployHero({ ...g.map.jeffStart });
    for (const progress of [320, 360, 400]) {
      const e = g.spawnEnemy('sludge', 0, progress);
      e.lane = 0;
      e.pos = { x: 300 + (progress - 320), y: 250 };
      e.def = { ...e.def, dps: 0, speed: 0 };
      e.hp = e.maxHp = 10000;
    }
    updateHero(g, 0.01);
    updateHero(g, g.heroDef.swingTime * 0.55);
    expect(g.heroMissiles).toHaveLength(1);
    updateHeroMissiles(g, 2);
    updateHeroMissiles(g, 2);
    updateHeroMissiles(g, 2);
    expect(g.kitState.hitCounts.chris_pin).toBe(1);
  });

  it('splashes on a killing Basin Swing', () => {
    const g = new Game(CRAWLSPACE, {
      difficulty: DIFFICULTIES.apprentice,
      mods: neutralModifiers(),
      hero: 'jeff',
      kit: { family: 'jeff_melee', weapon: null, cards: ['jeff_sweep', null] },
      manualStart: true,
    });
    g.deployHero({ ...g.map.jeffStart });
    const primary = g.spawnEnemy('sludge', 0, 320);
    primary.lane = 0;
    primary.pos = { x: 340, y: 250 };
    primary.def = { ...primary.def, dps: 0, speed: 0 };
    primary.hp = primary.maxHp = 1;
    const nearby = g.spawnEnemy('sludge', 0, 320);
    nearby.lane = 0;
    nearby.pos = { x: 365, y: 250 };
    nearby.def = { ...nearby.def, dps: 0, speed: 0 };
    nearby.hp = nearby.maxHp = 10000;
    landContactBasic(g);
    expect(primary.dead).toBe(true);
    expect(nearby.hp).toBeLessThan(10000);
  });

  it('applies onHitHeat when a ranged basic connects', () => {
    const g = new Game(CRAWLSPACE, {
      difficulty: DIFFICULTIES.apprentice,
      mods: neutralModifiers(),
      hero: 'jeff',
      kit: {
        family: 'jeff_ranged',
        weapon: {
          kind: 'weapon',
          id: 'w-heat',
          family: 'jeff_ranged',
          name: 'Hot Wand',
          rarity: 'rare',
          affixes: [{ key: 'onHitHeat', amount: 8 }],
        },
        cards: [null, null],
      },
      manualStart: true,
    });
    g.deployHero({ ...g.map.jeffStart });
    const e = g.spawnEnemy('sludge', 0, 320);
    e.lane = 0;
    e.pos = { x: 340, y: 250 };
    e.def = { ...e.def, dps: 0, speed: 0 };
    e.hp = e.maxHp = 10000;
    updateHero(g, 0.01);
    updateHero(g, g.heroDef.swingTime * 0.2);
    updateHero(g, g.heroDef.swingTime * 0.3);
    updateHeroMissiles(g, 2);
    expect(e.dotDps).toBe(8);
    expect(e.dotTime).toBe(2);
  });

  it('starts helper cards on their own interval', () => {
    const cbj = new Game(CRAWLSPACE, {
      difficulty: DIFFICULTIES.apprentice,
      mods: neutralModifiers(),
      hero: 'cbj',
      kit: { family: 'cbj_melee', weapon: null, cards: ['cbj_crew', null] },
      manualStart: true,
    });
    const doni = new Game(CRAWLSPACE, {
      difficulty: DIFFICULTIES.apprentice,
      mods: neutralModifiers(),
      hero: 'doni',
      kit: { family: 'doni_melee', weapon: null, cards: ['doni_crew', null] },
      manualStart: true,
    });
    expect(cbj.kitState.helperTimer).toBe(28);
    expect(doni.kitState.helperTimer).toBe(20);
  });

  it('stuns on jayjay_ranged bell impact without pull', () => {
    const g = new Game(CRAWLSPACE, {
      difficulty: DIFFICULTIES.apprentice,
      mods: neutralModifiers(),
      hero: 'jayjay',
      kit: { family: 'jayjay_ranged', weapon: null, cards: [null, null] },
      manualStart: true,
    });
    g.deployHero({ ...g.map.jeffStart });
    const e = g.spawnEnemy('sludge', 0, 320);
    e.lane = 0;
    e.pos = { x: 340, y: 250 };
    e.def = { ...e.def, dps: 0, speed: 0 };
    e.hp = e.maxHp = 10000;
    updateHero(g, 0.01);
    updateHero(g, g.heroDef.swingTime * 0.2);
    updateHero(g, g.heroDef.swingTime * 0.3);
    expect(g.heroMissiles).toHaveLength(1);
    expect(g.heroMissiles[0]?.stun).toBe(0.4);
    updateHeroMissiles(g, 2);
    expect(e.stun).toBeGreaterThanOrEqual(0.4);
  });
});

describe('save v2', () => {
  it('migrates a v1 tree save without stuffing starter weapons into the locker', () => {
    const data = normalizeSave({
      version: 1,
      jeffXp: 400,
      skills: ['sharpTools'],
      talents: ['ironGrip'],
      heroBuilds: { jeff: { nodes: ['venom:1', 'venom:2', 'venom:3', 'venom:4'], technique: 'venom' } },
      inventory: [{ id: 'g1', name: 'Hi-Vis Tee', slot: 'shirt', rarity: 'rare', affixes: [{ key: 'jeffHp', amount: 0.12 }] }],
      equipped: { shirt: 'g1' },
    } as never);
    expect(data.version).toBe(2);
    expect(data.inventory.some(i => i.kind === 'weapon' && i.rarity === 'common')).toBe(false);
    expect(data.kits.jeff?.family).toBe('jeff_melee');
    expect(data.kits.jeff?.cards).toEqual(['jeff_anchor', 'jeff_breaker']);
    expect(data.heroJobs.jeff).toBeGreaterThanOrEqual(3);
    expect(data.inventory.some(i => i.kind === 'armor' && i.slot === 'chest' && i.name === 'Veteran Vest')).toBe(true);
    const veteranBoots = data.inventory.find(i => i.kind === 'armor' && i.slot === 'boots' && i.id === 'g-veteran-boots');
    expect(veteranBoots?.name).toBe('Veteran Pacs');
    expect(veteranBoots?.rarity).toBe('rare');
    expect(data.inventory.find(i => i.id === 'g-veteran-chest')?.rarity).toBe('rare');
    expect((data as { skills?: unknown }).skills).toBeUndefined();
  });
  it('keeps veteran armor when migrating a full v1 locker', () => {
    const fullInv = Array.from({ length: 24 }, (_, i) => ({
      id: `g${i}`,
      kind: 'armor',
      slot: i % 2 === 0 ? 'chest' : 'boots',
      name: `Item ${i}`,
      rarity: 'common',
      affixes: [],
    }));
    const data = normalizeSave({
      version: 1,
      skills: ['sharpTools'],
      inventory: fullInv,
    } as never);
    expect(data.inventory.some((i) => i.id === 'g-veteran-chest')).toBe(true);
    expect(data.inventory.some((i) => i.id === 'g-veteran-boots')).toBe(true);
    expect(data.inventory.length).toBeLessThanOrEqual(24);
  });
  it('persists v2 kits, heroJobs, and armor across reload', () => {
    class MemoryStorage implements Storage {
      private readonly data = new Map<string, string>();
      get length(): number {
        return this.data.size;
      }
      clear(): void {
        this.data.clear();
      }
      getItem(key: string): string | null {
        return this.data.get(key) ?? null;
      }
      key(index: number): string | null {
        return [...this.data.keys()][index] ?? null;
      }
      removeItem(key: string): void {
        this.data.delete(key);
      }
      setItem(key: string, value: string): void {
        this.data.set(key, value);
      }
    }

    const storage = new MemoryStorage();
    const save = new SaveStore(storage);
    save.data.inventory.push(
      { kind: 'weapon', id: 'w-jeff', family: 'jeff_melee', name: 'Pipe Wrench', rarity: 'uncommon', affixes: [] },
      { kind: 'armor', id: 'chest-1', slot: 'chest', name: 'Hi-Vis', rarity: 'uncommon', affixes: [] },
      { kind: 'armor', id: 'boots-1', slot: 'boots', name: 'Steel Toes', rarity: 'common', affixes: [] },
    );
    save.recordHeroJob('jeff');
    save.recordHeroJob('jeff');
    save.recordHeroJob('jeff');
    save.setFamily('jeff', 'jeff_melee');
    save.equipWeapon('jeff', 'w-jeff');
    save.equipCard('jeff', 0, 'jeff_sweep');
    save.equipCard('jeff', 1, 'jeff_breaker');
    save.equipArmor('chest-1');
    save.equipArmor('boots-1');
    expect(save.save()).toBe(true);

    const reloaded = new SaveStore(storage);
    expect(reloaded.data.heroJobs.jeff).toBe(3);
    expect(reloaded.data.kits.jeff).toEqual({
      family: 'jeff_melee',
      weaponId: 'w-jeff',
      cards: ['jeff_sweep', 'jeff_breaker'],
    });
    expect(reloaded.data.chestId).toBe('chest-1');
    expect(reloaded.data.bootsId).toBe('boots-1');

    const normalized = normalizeSave(JSON.parse(storage.getItem(SAVE_KEY)!) as never);
    expect(normalized.kits.jeff).toEqual(reloaded.data.kits.jeff);
    expect(normalized.heroJobs.jeff).toBe(3);
    expect(normalized.chestId).toBe('chest-1');
    expect(normalized.bootsId).toBe('boots-1');
  });
  it('seeds stance-correct starter cards when v2 kit has family but no cards', () => {
    const data = normalizeSave({
      version: 2,
      kits: { jeff: { family: 'jeff_ranged' } },
    } as never);
    expect(data.kits.jeff?.family).toBe('jeff_ranged');
    expect(data.kits.jeff?.cards).toEqual(['jeff_lane', 'jeff_pin']);
  });
  it('keeps stored heroJobs when v1 heroBuilds would grant fewer', () => {
    const data = normalizeSave({
      version: 2,
      heroJobs: { jeff: 5 },
      heroBuilds: { jeff: { nodes: ['venom:1'], technique: 'venom' } },
    } as never);
    expect(data.heroJobs.jeff).toBe(5);
  });
  it('rejects a weapon for the wrong hero', () => {
    const save = new SaveStore(null);
    save.data.inventory.push({ kind: 'weapon', id: 'w1', family: 'mike_ranged', name: 'Test', rarity: 'rare', affixes: [] });
    expect(save.equipWeapon('jeff', 'w1')).toBe(false);
    expect(save.setFamily('jeff', 'mike_ranged')).toBe(false);
  });
});

describe('hero job unlocks', () => {
  it('increments heroJobs on a finished run and stamps the played hero on the chest rng path', () => {
    const save = new SaveStore(null);
    const g = new Game(CRAWLSPACE, { difficulty: DIFFICULTIES.apprentice, mods: neutralModifiers(), hero: 'chris' });
    g.status = 'lost';
    g.stats.kills = 3;
    g.completedWaves = 1;
    save.recordHeroJob('chris');
    expect(save.data.heroJobs.chris).toBe(1);
    expect(cardUnlocked(cardsFor('chris', 'melee').find(c => c.job === 'crew')!, save.data.heroJobs.chris ?? 0)).toBe(true);
  });
});
