import { clamp, dist } from '../core/vec';
import { BOSS_PHASE_SPEED_BONUS, BOSS_PHASE_THRESHOLDS, BOSS_SUMMON_COUNT } from '../data/enemies';
import { MINERAL_ENEMIES, TOWERS } from '../data/towers';
import type { DamageType, EnemyId, TargetMode, TowerId } from '../data/types';
import type { Game } from './game';
import type { AimPriority, DamageSource, Enemy, Tower } from './state';

export const MARKED_DAMAGE = 1.2;

export interface DamageOpts {
  /** Multiplier applied only when the victim is a ground enemy (anti-air specialists). */
  groundMult?: number;
}

/** Apply damage with armor / resistances; handles kills, bounty, and boss phase changes. Returns damage dealt. */
export function applyDamage(
  game: Game,
  enemy: Enemy,
  amount: number,
  type: DamageType,
  source: DamageSource,
  opts: DamageOpts = {},
): number {
  if (enemy.dead || enemy.escaped || enemy.phased) return 0;
  let mult = 1;
  // Armor stops wrenches and water; fire and radiant heat go straight through the shell.
  const armorBonus = source === 'jeff' ? undefined : TOWERS[source as TowerId]?.armorBonus;
  if (armorBonus) {
    // Armor breakers skip the usual shrink and hit harder the thicker the shell.
    mult *= 1 + enemy.def.armor * armorBonus;
  } else if (type === 'physical' || type === 'water') {
    mult *= 1 - clamp(enemy.def.armor - enemy.armorShred, 0, 1);
  }
  mult *= enemy.def.damageMult?.[type] ?? 1;
  if (!enemy.def.flying && opts.groundMult !== undefined) mult *= opts.groundMult;
  if ((source === 'descaler' || source === 'dirtSep') && (MINERAL_ENEMIES as readonly EnemyId[]).includes(enemy.def.id)) {
    mult *= source === 'descaler' ? 1.5 : 1.4;
  }
  if (enemy.marked) mult *= 1 + (enemy.markBonus || MARKED_DAMAGE - 1);
  const dealt = Math.min(enemy.hp, amount * mult);
  if (dealt <= 0) return 0;
  enemy.hp -= dealt;
  if (dealt >= 4) enemy.hitFlash = Math.max(enemy.hitFlash, Math.min(0.22, 0.08 + dealt / 180));
  // Discrete hits only — aura ticks and DoT are tiny per frame and would flood the yard.
  if (dealt >= 6 && amount >= 6 && game.effects.length < 280) {
    game.addEffect({
      kind: 'text',
      pos: { x: enemy.pos.x + ((enemy.id * 17) % 11) - 5, y: enemy.pos.y - 22 },
      text: String(Math.round(dealt)),
      color: type === 'fire' || type === 'heat' ? '#ffcc80' : type === 'water' ? '#b3e5fc' : '#fff8e1',
      ttl: 0.45,
      max: 0.45,
    });
  }

  if (source === 'jeff') game.stats.jeffDamage += dealt;
  else if (source === 'crew') game.stats.crewDamage += dealt;
  else game.stats.towerDamage[source] += dealt;

  if (enemy.hp <= 0) {
    enemy.dead = true;
    enemy.heldBy = null;
    const bounty = Math.round(enemy.def.bounty * game.mods.bounty * game.difficulty.bountyMult);
    game.money += bounty;
    game.stats.moneyEarned += bounty;
    game.stats.kills++;
    game.addEffect({ kind: 'death', pos: { ...enemy.pos }, enemy: enemy.def.id, radius: enemy.def.radius, ttl: 0.48, max: 0.48 });
    if (source === 'jeff') game.stats.jeffKills++;
    game.addEffect({ kind: 'text', pos: { x: enemy.pos.x, y: enemy.pos.y - 14 }, text: `+$${bounty}`, color: '#ffe082', ttl: 0.9, max: 0.9 });
    game.addEffect({ kind: 'splash', pos: { ...enemy.pos }, radius: Math.max(22, enemy.def.radius * 2.8), color: enemy.def.color, ttl: 0.32, max: 0.32 });
    game.addEffect({ kind: 'hit', pos: { ...enemy.pos }, color: enemy.def.color, ttl: 0.2, max: 0.2 });
    game.addEffect({ kind: 'ring', pos: { ...enemy.pos }, radius: Math.max(28, enemy.def.radius * 3.4), color: enemy.def.color, ttl: 0.28, max: 0.28 });
    if (enemy.def.traits.includes('splits')) {
      const pathLen = game.paths[enemy.pathIdx]?.length ?? enemy.progress;
      const childAt = (back: number) => Math.max(0, Math.min(enemy.progress - back, pathLen * 0.72));
      game.spawnEnemy('drip', enemy.pathIdx, childAt(90));
      game.spawnEnemy('drip', enemy.pathIdx, childAt(150));
      game.addEffect({ kind: 'splash', pos: { ...enemy.pos }, radius: 22, color: enemy.def.color, ttl: 0.28, max: 0.28 });
    }
  } else if (enemy.def.traits.includes('boss')) {
    checkBossPhase(game, enemy);
  }
  return dealt;
}

function checkBossPhase(game: Game, boss: Enemy): void {
  const threshold = BOSS_PHASE_THRESHOLDS[boss.bossPhase];
  if (threshold === undefined) return;
  if (boss.hp / boss.maxHp > threshold) return;
  boss.bossPhase++;
  boss.speedMult += BOSS_PHASE_SPEED_BONUS;
  for (let i = 0; i < BOSS_SUMMON_COUNT; i++) {
    game.spawnEnemy('drip', boss.pathIdx, Math.max(0, boss.progress - 12 * (i + 1)));
  }
  game.addEffect({ kind: 'ring', pos: { ...boss.pos }, radius: 90, color: '#ff7043', ttl: 0.6, max: 0.6 });
  game.addEffect({ kind: 'text', pos: { x: boss.pos.x, y: boss.pos.y - 40 }, text: 'PRESSURE RISING', color: '#ff7043', ttl: 1.4, max: 1.4 });
}

export function matchesTargetMode(mode: TargetMode, enemy: Enemy): boolean {
  if (mode === 'both') return true;
  return mode === 'air' ? enemy.def.flying : !enemy.def.flying;
}

export function isTargetable(enemy: Enemy): boolean {
  return !enemy.dead && !enemy.escaped && !enemy.phased;
}

export const AIM_ORDER: AimPriority[] = ['first', 'strong', 'close', 'last'];

export const AIM_LABEL: Record<AimPriority, string> = {
  first: 'First',
  strong: 'Strong',
  close: 'Close',
  last: 'Last',
};

export const AIM_HINT: Record<AimPriority, string> = {
  first: 'the leak closest to the valve',
  strong: 'the toughest leak in range',
  close: 'the nearest leak',
  last: 'the leak that just entered range',
};

/** Targetable enemy within range, ordered by the tower's aim priority. Default is First. */
export function pickTarget(game: Game, tower: Tower, range: number): Enemy | null {
  let best: Enemy | null = null;
  let bestDist = Infinity;
  const aim = tower.aim ?? 'first';
  for (const e of game.enemies) {
    if (!isTargetable(e) || !matchesTargetMode(tower.def.targets, e)) continue;
    const d = dist(e.pos, tower.pos);
    if (d > range + e.def.radius) continue;
    if (!best || preferTarget(game, aim, e, best, d, bestDist)) {
      best = e;
      bestDist = d;
    }
  }
  return best;
}

function remaining(game: Game, e: Enemy): number {
  return game.paths[e.pathIdx]!.length - e.progress;
}

function preferTarget(game: Game, aim: AimPriority, e: Enemy, best: Enemy, d: number, bestDist: number): boolean {
  const rem = remaining(game, e);
  const bestRem = remaining(game, best);
  switch (aim) {
    case 'first':
      return rem < bestRem - 0.5 || (Math.abs(rem - bestRem) <= 0.5 && d < bestDist);
    case 'last':
      return rem > bestRem + 0.5 || (Math.abs(rem - bestRem) <= 0.5 && d < bestDist);
    case 'strong':
      return e.maxHp > best.maxHp + 0.5 || (Math.abs(e.maxHp - best.maxHp) <= 0.5 && rem < bestRem);
    case 'close':
      return d < bestDist - 0.5 || (Math.abs(d - bestDist) <= 0.5 && rem < bestRem);
    default: {
      const _exhaustive: never = aim;
      return _exhaustive;
    }
  }
}
