import { clamp, dist } from '../core/vec';
import { ABILITY_RANK_CAP, type AbilitySlot } from '../data/heroes';
import { BOSS_PHASE_SPEED_BONUS, BOSS_PHASE_THRESHOLDS, BOSS_SUMMON_COUNT } from '../data/enemies';
import { inheritProperties, partsForKill } from '../data/leakProperties';
import { inheritSplitProperties, splitCount, splitOf } from '../data/splits';
import { MINERAL_ENEMIES, TOWERS } from '../data/towers';
import type { DamageType, EnemyId, LeakProperty, TargetMode, TowerId } from '../data/types';
import type { Game } from './game';
import type { AimPriority, DamageSource, Enemy, Tower } from './state';

/** Shared by aiming UI and cast validation. */
export function heroAbilityHitsAir(game: Game, _slot: AbilitySlot): boolean {
  return !['becbec', 'jayjay'].includes(game.heroDef.id);
}

export function hasProp(enemy: Enemy, prop: LeakProperty): boolean {
  return enemy.properties.includes(prop);
}

export function leakRemaining(enemy: Enemy): number {
  return Math.max(0, enemy.hp + enemy.shellHp);
}

export function leakMax(enemy: Enemy): number {
  return Math.max(1, enemy.maxHp + enemy.maxShell);
}
export const MARKED_DAMAGE = 1.2;
export const CORPSE_TIME = 0.46;
export { ABILITY_RANK_CAP };

export interface DamageOpts {
  /** Multiplier applied only when the victim is a ground enemy (anti-air specialists). */
  groundMult?: number;
}

/** True when the hero is actually on the yard and can fight. */
export function heroOnYard(game: Game): boolean {
  return game.heroEnabled && game.hero.deployed && game.hero.downed <= 0;
}

/** In-mission hero rank bonus (Kingdom Rush Frontiers-style leveling). */
export function heroRank(game: Game): number {
  return 1 + (game.heroLevel - 1) * 0.07;
}

export function missionXpToNext(level: number): number {
  return Math.round(55 + level * 48);
}

export function abilityRank(game: Game, slot: AbilitySlot): number {
  return game.abilityRanks[slot] ?? 0;
}

/** Damage / heal / duration multiplier from an ability's in-mission rank. */
export function abilityPower(game: Game, slot: AbilitySlot): number {
  return 1 + abilityRank(game, slot) * 0.18;
}

export function abilityCdFactor(game: Game, slot: AbilitySlot): number {
  return Math.max(0.72, 1 - abilityRank(game, slot) * 0.07);
}

export function abilityRangeFactor(game: Game, slot: AbilitySlot): number {
  return 1 + abilityRank(game, slot) * 0.06;
}

export function scaledAbilityCooldown(game: Game, slot: AbilitySlot): number {
  return game.heroDef.abilities[slot].cooldown * abilityCdFactor(game, slot) * game.mods.cooldown / game.jeffCdAura;
}

export function scaledCastRange(game: Game, slot: AbilitySlot): number {
  const base = game.heroDef.abilities[slot].castRange ?? 280;
  return Math.round(base * abilityRangeFactor(game, slot));
}

export function nextRankBlurb(game: Game, slot: AbilitySlot): string | null {
  const rank = abilityRank(game, slot);
  if (rank >= ABILITY_RANK_CAP) return null;
  return game.heroDef.abilities[slot].ranks[rank] ?? null;
}

/** Shared armor / resist / aura math so reservations match the hit that actually lands. */
export function damageMultiplier(
  game: Game,
  enemy: Enemy,
  type: DamageType,
  source: DamageSource,
  opts: DamageOpts = {},
): number {
  let mult = 1;
  // Armor stops wrenches and water; fire and radiant heat go straight through the shell.
  const armorBonus = source === 'jeff' ? undefined : TOWERS[source as TowerId]?.armorBonus;
  if (armorBonus) {
    // Armor breakers skip the usual shrink and hit harder the thicker the shell.
    mult *= 1 + enemy.def.armor * armorBonus;
  } else if (type === 'physical' || type === 'water') {
    mult *= 1 - clamp(enemy.def.armor - Math.max(enemy.armorShred, enemy.auraArmorShred ?? 0), 0, 1);
  }
  mult *= enemy.def.damageMult?.[type] ?? 1;
  if (!enemy.def.flying && opts.groundMult !== undefined) mult *= opts.groundMult;
  if ((source === 'descaler' || source === 'dirtSep') && (MINERAL_ENEMIES as readonly EnemyId[]).includes(enemy.def.id)) {
    mult *= source === 'descaler' ? 1.5 : 1.4;
  }
  if (hasProp(enemy, 'mineral')) {
    if (source === 'washer') return 0;
    if (source === 'descaler' || source === 'dirtSep' || source === 'hammerDrill' || type === 'fire' || type === 'heat') {
      mult *= source === 'hammerDrill' ? 1.35 : 1.2;
    }
  }
  if (hasProp(enemy, 'cast') && (source === 'hammerDrill' || source === 'torch')) mult *= 1.25;
  const vulnerability = Math.max(enemy.marked ? (enemy.markBonus || MARKED_DAMAGE - 1) : 0, enemy.exposed?.strength ?? 0);
  mult *= 1 + vulnerability;
  if (source !== 'jeff' && source !== 'crew' && enemy.heldBy?.kind === 'hero' && game.kitTowerMark > 0) {
    mult *= 1 + game.kitTowerMark;
  }
  if (source === 'jeff') mult *= heroRank(game);
  return mult;
}

/** Uncapped expected damage for overkill reservation. 0 if the leak cannot be hit. */
export function estimateDamage(
  game: Game,
  enemy: Enemy,
  amount: number,
  type: DamageType,
  source: DamageSource,
  opts: DamageOpts = {},
): number {
  if (enemy.dead || enemy.escaped || enemy.phased) return 0;
  return amount * damageMultiplier(game, enemy, type, source, opts);
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
  const dealt = Math.min(leakRemaining(enemy), estimateDamage(game, enemy, amount, type, source, opts));
  if (dealt <= 0) return 0;
  if (type === 'fire' || type === 'heat') enemy.burnTimer = Math.max(enemy.burnTimer, 3.2);
  let left = dealt;
  if (enemy.shellHp > 0) {
    const fromShell = Math.min(enemy.shellHp, left);
    enemy.shellHp -= fromShell;
    left -= fromShell;
    if (fromShell > 0 && enemy.shellHp <= 0) {
      game.addEffect({ kind: 'ring', pos: { ...enemy.pos }, radius: enemy.def.radius * 2.4, color: '#6d4c41', ttl: 0.36, max: 0.36 });
      game.addEffect({ kind: 'text', pos: { x: enemy.pos.x, y: enemy.pos.y - 26 }, text: 'JACKET GONE', color: '#d7ccc8', ttl: 0.7, max: 0.7 });
    }
  }
  if (left > 0) enemy.hp -= left;
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
    enemy.incoming = 0;
    enemy.deathAge = CORPSE_TIME;
    const pressurized = hasProp(enemy, 'pressurized');
    const bounty = Math.round(enemy.def.bounty * game.mods.bounty * game.difficulty.bountyMult * (pressurized ? 1.35 : 1));
    game.money += bounty;
    game.stats.moneyEarned += bounty;
    const parts = partsForKill(enemy.def.traits.includes('boss'), enemy.def.bounty, pressurized);
    if (game.remaster !== 'cleanHands') {
      game.parts += parts;
      game.stats.partsEarned += parts;
    }
    game.stats.kills++;
    game.recordKill(enemy, bounty);
    game.combo += 1;
    game.comboTimer = 1.85;
    game.grantHeroXp(Math.round(6 + enemy.def.bounty * 0.4 + leakMax(enemy) * 0.012));
    if (enemy.def.traits.includes('boss')) game.requestHitstop(.065);
    game.addEffect({ kind: 'death', pos: { ...enemy.pos }, enemy: enemy.def.id, radius: enemy.def.radius, ttl: 0.48, max: 0.48 });
    if (source === 'jeff') game.stats.jeffKills++;
    game.addEffect({ kind: 'text', pos: { x: enemy.pos.x, y: enemy.pos.y - 14 }, text: `+$${bounty}`, color: '#ffe082', ttl: 0.9, max: 0.9 });
    game.addEffect({ kind: 'splash', pos: { ...enemy.pos }, radius: Math.max(22, enemy.def.radius * 2.8), color: enemy.def.color, ttl: 0.32, max: 0.32 });
    game.addEffect({ kind: 'hit', pos: { ...enemy.pos }, color: enemy.def.color, ttl: 0.2, max: 0.2 });
    game.addEffect({ kind: 'ring', pos: { ...enemy.pos }, radius: Math.max(28, enemy.def.radius * 3.4), color: enemy.def.color, ttl: 0.28, max: 0.28 });
    spawnChildren(game, enemy);
  } else if (enemy.def.traits.includes('boss')) {
    checkBossPhase(game, enemy);
  }
  return dealt;
}

function spawnChildren(game: Game, enemy: Enemy): void {
  const def = splitOf(enemy.def.id);
  if (!def) return;
  const n = splitCount(enemy.def.id, hasProp(enemy, 'pressurized'));
  if (n <= 0) return;
  const kids = inheritSplitProperties(enemy.properties);
  const pathLen = game.paths[enemy.pathIdx]?.length ?? enemy.progress;
  for (let i = 0; i < n; i++) {
    const back = 8 + i * 16;
    const at = Math.max(0, Math.min(enemy.progress - back, pathLen - 4));
    const child = game.spawnEnemy(def.child, enemy.pathIdx, at, kids, enemy.waveId);
    child.hitFlash = Math.max(child.hitFlash, 0.28);
    child.wobble += 3 + i;
  }
  game.addEffect({ kind: 'splash', pos: { ...enemy.pos }, radius: Math.max(28, enemy.def.radius * 3.2), color: enemy.def.color, ttl: 0.36, max: 0.36 });
  game.addEffect({ kind: 'ring', pos: { ...enemy.pos }, radius: Math.max(40, enemy.def.radius * 4.2), color: '#ffe082', ttl: 0.42, max: 0.42 });
  game.addEffect({
    kind: 'text',
    pos: { x: enemy.pos.x, y: enemy.pos.y - 36 },
    text: n === 1 ? 'STILL WALKING' : `${n} MORE`,
    color: '#ffe082',
    ttl: 0.85,
    max: 0.85,
  });
}

function checkBossPhase(game: Game, boss: Enemy): void {
  const threshold = BOSS_PHASE_THRESHOLDS[boss.bossPhase];
  if (threshold === undefined) return;
  if (boss.hp / boss.maxHp > threshold) return;
  boss.bossPhase++;
  boss.speedMult += BOSS_PHASE_SPEED_BONUS;
  for (let i = 0; i < BOSS_SUMMON_COUNT; i++) {
    game.spawnEnemy('drip', boss.pathIdx, Math.max(0, boss.progress - 12 * (i + 1)), inheritProperties(boss.properties), boss.waveId);
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

export const AIM_ORDER: AimPriority[] = ['first', 'strong', 'close', 'last', 'weak'];

export const AIM_LABEL: Record<AimPriority, string> = {
  first: 'First',
  strong: 'Strong',
  close: 'Close',
  last: 'Last',
  weak: 'Weak',
};

export const AIM_HINT: Record<AimPriority, string> = {
  first: 'the leak closest to the valve',
  strong: 'the toughest leak in range',
  close: 'the nearest leak',
  last: 'the leak that just entered range',
  weak: 'the frailest leak in range',
};

/** Lead a shot along the pipe so splash and homing still meet a moving leak. */
export function predictedPos(game: Game, e: Enemy, lead: number): { x: number; y: number } {
  const path = game.paths[e.pathIdx];
  if (!path || lead <= 0 || e.heldBy || e.stun > 0) return { ...e.pos };
  const speed = e.def.speed * e.speedMult * (1 - e.slow) * (1 + e.haste);
  const ahead = e.progress + speed * lead;
  const base = path.pointAt(ahead);
  const dir = path.directionAt(ahead);
  return { x: base.x - dir.y * e.lane, y: base.y + dir.x * e.lane };
}

/** Shooters skip immune victims instead of spending every shot on an invulnerable front line. */
export function canTowerDamage(game: Game, tower: Tower, enemy: Enemy): boolean {
  return estimateDamage(game, enemy, game.effectiveDamage(tower), tower.def.damageType, tower.def.id,
    { groundMult: tower.def.groundMult }) > 0;
}

/** Targetable enemy within range, ordered by the tower's aim priority. Default is First. */
export function pickTarget(game: Game, tower: Tower, range: number): Enemy | null {
  if (tower.focusTargetId !== undefined) {
    const focus = game.enemies.find(e => e.id === tower.focusTargetId);
    if (focus && isTargetable(focus) && matchesTargetMode(tower.def.targets, focus)
      && dist(focus.pos, tower.pos) <= range + focus.def.radius) {
      // Respect shots already in flight: focusing a doomed target should not waste ammunition.
      if (focus.hp + focus.shellHp - focus.incoming > 0 && canTowerDamage(game, tower, focus)) return focus;
    }
  }
  let best: Enemy | null = null;
  let bestDist = Infinity;
  const aim = tower.aim ?? 'first';
  for (const e of game.enemies) {
    if (!isTargetable(e) || !matchesTargetMode(tower.def.targets, e)) continue;
    if (e.hp + e.shellHp - e.incoming <= 0) continue;
    const d = dist(e.pos, tower.pos);
    if (d > range + e.def.radius) continue;
    if (!canTowerDamage(game, tower, e)) continue;
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
      return leakMax(e) > leakMax(best) + 0.5 || (Math.abs(leakMax(e) - leakMax(best)) <= 0.5 && rem < bestRem);
    case 'weak':
      return leakRemaining(e) < leakRemaining(best) - 0.5 || (Math.abs(leakRemaining(e) - leakRemaining(best)) <= 0.5 && rem < bestRem);
    case 'close':
      return d < bestDist - 0.5 || (Math.abs(d - bestDist) <= 0.5 && rem < bestRem);
    default: {
      const _exhaustive: never = aim;
      return _exhaustive;
    }
  }
}
