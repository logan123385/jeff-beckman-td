import type { HeroId } from '../src/data/heroes';
import { FIXED_DT } from '../src/core/loop';
import { dist } from '../src/core/vec';
import { DIFFICULTIES } from '../src/data/difficulty';
import { ENEMIES } from '../src/data/enemies';
import { buildRunModifiers } from '../src/data/progress';
import { TOWERS } from '../src/data/towers';
import type { DifficultyId, MapDef, Modifiers, TowerId } from '../src/data/types';
import { SaveStore } from '../src/save/save';
import { Game } from '../src/sim/game';

export interface HarnessOptions {
  difficulty?: DifficultyId;
  heroEnabled?: boolean;
  heroId?: HeroId;
  /** Kit/armor run modifiers. Defaults to an empty locker (neutral + no affixes). */
  mods?: Modifiers;
  seed?: number;
  /** Tower build priority; cycles through allowed towers in this order. */
  buildOrder?: TowerId[];
  /** Call waves early whenever the field is clear (aggressive play). */
  callEarly?: boolean;
  /** Move Jeff to the busiest barricade every few seconds. */
  microJeff?: boolean;
  maxSeconds?: number;
  /** Test exactly the same five-tool restriction as a player, rather than the entire catalogue. */
  loadout?: TowerId[];
}

export interface HarnessResult {
  game: Game;
  won: boolean;
  livesLeft: number;
  seconds: number;
  jeffShare: number;
  towersBuilt: number;
}

const DEFAULT_ORDER: TowerId[] = [
  'barricade',
  'vent',
  'torch',
  'hammerDrill',
  'washer',
  'camera',
  'radiant',
  'glycol',
  'expansion',
  'descaler',
  'pipeSnake',
  'prv',
  'sump',
  'backflow',
  'circulator',
  'boiler',
  'torch',
  'washer',
  'steamTrap',
  'airSeparator',
  'manifold',
  'dirtSep',
  'mixingValve',
  'heatExchanger',
  'zoneValve',
  'thermostat',
];

/** Path length (sampled) that a tower placed at a slot would cover with the given range. */
export function coverage(map: MapDef, game: Game, slot: number, range: number): number {
  const p = map.slots[slot]!;
  let covered = 0;
  for (const path of game.paths) {
    for (let d = 0; d < path.length; d += 8) {
      if (dist(path.pointAt(d), p) <= range) covered += 8;
    }
  }
  return covered;
}

/**
 * Greedy auto-builder: fills slots by coverage, then upgrades. Deliberately unsophisticated so it
 * approximates a competent-but-not-optimal player for the hero-off / tower-matter falsifiers.
 */
export function runHeadless(map: MapDef, opts: HarnessOptions = {}): HarnessResult {
  const difficulty = DIFFICULTIES[opts.difficulty ?? 'apprentice'];
  const mods = opts.mods ?? buildRunModifiers(new SaveStore(null));
  const game = new Game(map, { heroId: opts.heroId, difficulty, mods, seed: opts.seed ?? 7, heroEnabled: opts.heroEnabled ?? true, loadout: opts.loadout });
  if (game.heroEnabled) game.deployHero({ ...map.jeffStart });
  const order = (opts.buildOrder ?? DEFAULT_ORDER).filter((id) => game.allowedTowers.includes(id));
  const hasFliers = map.waves.some((w) => w.groups.some((g) => ENEMIES[g.enemy].flying));
  const plan = order.filter((id) => id !== 'vent' || hasFliers);
  let planIdx = 0;
  let decideTimer = 0;
  let jeffTimer = 0;
  const maxSeconds = opts.maxSeconds ?? 1800;

  while (game.status === 'playing' && game.time < maxSeconds) {
    while (game.pendingRankUps > 0) {
      const slot = game.abilityRanks.findIndex(rank => rank < 3);
      if (slot < 0 || !game.rankAbility(slot as 0 | 1 | 2 | 3 | 4)) break;
    }
    decideTimer -= FIXED_DT;
    if (decideTimer <= 0) {
      decideTimer = 0.5;
      act();
    }
    if (opts.microJeff && game.heroEnabled) {
      jeffTimer -= FIXED_DT;
      if (jeffTimer <= 0) {
        jeffTimer = 4;
        microJeff();
      }
    }
    if (opts.callEarly && !game.waveActive && !game.allWavesStarted) game.callNextWave();
    game.update(FIXED_DT);
  }

  const towerTotal = Object.values(game.stats.towerDamage).reduce((a, b) => a + b, 0);
  const total = towerTotal + game.stats.jeffDamage;
  return {
    game,
    won: game.status === 'won',
    livesLeft: game.lives,
    seconds: game.time,
    jeffShare: total === 0 ? 0 : game.stats.jeffDamage / total,
    towersBuilt: game.towers.length,
  };

  function act(): void {
    const emptySlots = map.slots.map((_, i) => i).filter((i) => !game.towerAt(i));
    if (emptySlots.length > 0 && plan.length > 0) {
      const id = plan[planIdx % plan.length]!;
      const cost = game.towerCost(id);
      if (game.money >= cost) {
        const range = id === 'barricade' ? 70 : TOWERS[id].levels[0].range;
        let best = emptySlots[0]!;
        let bestScore = -1;
        for (const s of emptySlots) {
          let score = coverage(map, game, s, range);
          if (id === 'expansion') score = game.towers.filter((t) => dist(t.pos, map.slots[s]!) <= TOWERS.expansion.levels[0].range).length * 100;
          if (score > bestScore) {
            bestScore = score;
            best = s;
          }
        }
        if (bestScore > 0 && game.placeTower(best, id)) planIdx++;
        else if (bestScore <= 0) planIdx++;
        return;
      }
      // Fall through to upgrades if the next planned tower is unaffordable but an upgrade is.
    }
    const upgradable = game.towers
      .filter((t) => game.upgradeCost(t) !== null && game.money >= (game.upgradeCost(t) ?? Infinity))
      .sort((a, b) => a.level - b.level || (game.upgradeCost(a) ?? 0) - (game.upgradeCost(b) ?? 0));
    const pick = upgradable[0];
    if (pick) game.upgradeTower(pick.id);
  }

  function microJeff(): void {
    const barricade = game.towers
      .filter((t) => t.def.kind === 'barricade' && t.rebuild <= 0)
      .sort((a, b) => a.hp / a.maxHp - b.hp / b.maxHp)[0];
    if (barricade && barricade.hp < barricade.maxHp * 0.9) {
      game.commandHero({ x: barricade.rally.x + 14, y: barricade.rally.y });
    } else if (game.enemies.length > 0) {
      const lead = game.enemies.reduce((a, b) =>
        game.paths[a.pathIdx]!.length - a.progress < game.paths[b.pathIdx]!.length - b.progress ? a : b,
      );
      if (!lead.def.flying) game.commandHeroAttack(lead.id);
      else game.commandHero({ x: lead.pos.x, y: lead.pos.y });
    }
    if (game.enemies.length >= 8) game.useClamp();
    if (game.enemies.length >= 14) game.useShutoff();
  }
}
