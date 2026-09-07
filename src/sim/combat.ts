import { clamp, dist } from '../core/vec';
import { BOSS_PHASE_SPEED_BONUS, BOSS_PHASE_THRESHOLDS, BOSS_SUMMON_COUNT } from '../data/enemies';
import type { DamageType, TargetMode } from '../data/types';
import type { Game } from './game';
import type { DamageSource, Enemy, Tower } from './state';

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
  if (type === 'physical' || type === 'water') mult *= 1 - clamp(enemy.def.armor - enemy.armorShred, 0, 1);
  mult *= enemy.def.damageMult?.[type] ?? 1;
  if (!enemy.def.flying && opts.groundMult !== undefined) mult *= opts.groundMult;
  const dealt = Math.min(enemy.hp, amount * mult);
  if (dealt <= 0) return 0;
  enemy.hp -= dealt;

  if (source === 'jeff') game.stats.jeffDamage += dealt;
  else game.stats.towerDamage[source] += dealt;

  if (enemy.hp <= 0) {
    enemy.dead = true;
    enemy.heldBy = null;
    const bounty = Math.round(enemy.def.bounty * game.mods.bounty);
    game.money += bounty;
    game.stats.moneyEarned += bounty;
    game.stats.kills++;
    if (source === 'jeff') game.stats.jeffKills++;
    game.addEffect({ kind: 'text', pos: { x: enemy.pos.x, y: enemy.pos.y - 14 }, text: `+$${bounty}`, color: '#ffe082', ttl: 0.9, max: 0.9 });
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

/** Furthest-along targetable enemy within range that the tower can hit. */
export function pickTarget(game: Game, tower: Tower, range: number): Enemy | null {
  let best: Enemy | null = null;
  let bestRemaining = Infinity;
  for (const e of game.enemies) {
    if (!isTargetable(e) || !matchesTargetMode(tower.def.targets, e)) continue;
    if (dist(e.pos, tower.pos) > range + e.def.radius) continue;
    const remaining = game.paths[e.pathIdx]!.length - e.progress;
    if (remaining < bestRemaining) {
      bestRemaining = remaining;
      best = e;
    }
  }
  return best;
}
