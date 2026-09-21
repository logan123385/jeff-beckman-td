import { dist, moveToward } from '../core/vec';
import { JEFF } from '../data/jeff';
import { advanceHeroCast, heroAttackSpeed, strikeFromProfile } from './heroPowers';
import { abilityRank, isTargetable } from './combat';
import type { Game } from './game';
import type { Enemy } from './state';

function softenFacing(current: number | undefined, want: number, dt: number, rate = 7): number {
  const cur = current ?? want;
  const d = want - cur;
  const step = rate * dt;
  if (Math.abs(d) <= step) return want;
  return cur + Math.sign(d) * step;
}

export function updateHero(game: Game, dt: number): void {
  if (!game.heroEnabled) return;
  const h = game.hero;
  const def = game.heroDef;
  const profile = game.attackProfile;
  h.moveBlend = Math.max(0, Math.min(1, (h.moveBlend ?? 0) + (h.moving ? 1 : -1) * dt * 4.5));
  h.moving = false;
  h.recovering = false;
  h.castTimer = Math.max(0, (h.castTimer ?? 0) - dt);
  if (h.clampCooldown > 0) h.clampCooldown -= dt;
  if (h.shutoffCooldown > 0) h.shutoffCooldown -= dt;
  if (h.pulseCooldown > 0) h.pulseCooldown -= dt;
  if (h.sleeveCooldown > 0) h.sleeveCooldown -= dt;
  if (h.coffeeCooldown > 0) h.coffeeCooldown -= dt;
  if (h.sleeveTimer > 0) h.sleeveTimer -= dt;
  if (h.coffeeTimer > 0) h.coffeeTimer -= dt;
  for (const key of ['overdrive', 'shield', 'lifesteal', 'taunt'] as const) h[key] = Math.max(0, (h[key] ?? 0) - dt);
  if (h.attackTimer > 0) h.attackTimer -= dt;
  if (h.swing > 0) h.swing -= dt;

  try {
  if (h.downed > 0) {
    h.pendingStrike = undefined;
    h.swing = 0;
    h.downed -= dt;
    h.orderTargetId = null;
    h.engaged = false;
    h.targetId = null;
    if (h.downed <= 0) {
      h.hp = h.maxHp;
      h.dest = null;
      h.orderTargetId = null;
      h.engaged = false;
      h.targetId = null;
      game.addEffect({ kind: 'ring', pos: { ...h.pos }, radius: 28, color: '#a5d6a7', ttl: 0.55, max: 0.55 });
      game.addEffect({
        kind: 'text',
        pos: { x: h.pos.x, y: h.pos.y - 40 },
        text: 'READY TO DEPLOY',
        color: '#a5d6a7',
        ttl: 1.4,
        max: 1.4,
      });
    }
    return;
  }
  if (!h.deployed) return;

  if (advanceHeroCast(game, dt)) { h.combatIdle = 0; holdNearby(game); return; }
  if (h.queuedOrder) {
    const order = h.queuedOrder; h.queuedOrder = undefined;
    if (order.kind === 'move') game.commandHero(order.pos);
    else game.commandHeroAttack(order.enemyId);
  }

  const coffee = h.coffeeTimer > 0 ? JEFF.coffee.speed * (1 + abilityRank(game, 4) * 0.08) : 1;
  const ramp = h.moveBlend ?? 0;
  const ease = ramp * ramp * (3 - 2 * ramp);
  const speed = def.speed * game.mods.jeffSpeed * game.jeffSpeedAura * coffee * ((h.overdrive ?? 0) > 0 ? def.id === 'mike' ? 1.65 : def.id === 'cbj' ? 1.22 : 1 : 1) * (0.78 + 0.22 * ease);

  const reach = profile.reach * game.mods.jeffReach;
  if (h.pendingStrike !== undefined && h.swing <= (h.swingDuration ?? def.swingTime) * 0.52) {
    const target = game.enemies.find(e => e.id === h.pendingStrike && isTargetable(e));
    h.pendingStrike = undefined;
    if (target && (profile.air || !target.def.flying) && !h.dest && dist(h.pos, target.pos) <= reach + target.def.radius + 10) {
      h.combatIdle = 0;
      strikeFromProfile(game, target);
    }
  }

  if (h.swing > 0 && !h.dest) { holdNearby(game); repairNearby(game, dt); return; }

  // Pure move order — no swinging while jogging to a point.
  if (h.dest) {
    const remaining = dist(h.pos, h.dest);
    const ease = remaining < 18 ? Math.max(0.6, remaining / 18) : 1;
    const r = moveToward(h.pos, h.dest, speed * dt * ease);
    h.facing = h.dest.x >= h.pos.x ? 1 : -1;
    h.walkPhase = (h.walkPhase ?? 0) + dist(h.pos, r.pos) * 0.1;
    h.moving = true;
    h.pos = r.pos;
    if (r.arrived) h.dest = null;
    h.targetId = null;
    recover(game, dt);
    repairNearby(game, dt);
    return;
  }

  const target = resolveOrderTarget(game);
  h.targetId = target?.id ?? null;
  if (target) {
    h.combatIdle = 0;
    if (h.engaged) h.anchor = { ...target.pos };
    const attackReach = reach + target.def.radius;
    if (dist(h.pos, target.pos) > attackReach) {
      const r = moveToward(h.pos, target.pos, speed * dt);
      h.walkPhase = (h.walkPhase ?? 0) + dist(h.pos, r.pos) * 0.1;
      h.moving = true;
      h.pos = r.pos;
      h.facing = target.pos.x >= h.pos.x ? 1 : -1;
    } else if (h.attackTimer <= 0) {
      const haste = heroAttackSpeed(game);
      h.attackTimer = 1 / (profile.attackRate * game.mods.heroRate * haste);
      h.swingDuration = def.swingTime / haste;
      h.swing = h.swingDuration;
      h.facing = target.pos.x >= h.pos.x ? 1 : -1;
      h.pendingStrike = target.id;
    }
  }
  else recover(game, dt);
  holdNearby(game);
  repairNearby(game, dt);
  } finally {
    h.faceVisual = softenFacing(h.faceVisual, h.facing, dt);
  }
}

/** Hunt started by one wrench click. The locked leak is waited out if it phases; once it dies, the nearest leak is next. A move order is the only off switch. */
function resolveOrderTarget(game: Game): Enemy | null {
  const h = game.hero;
  const profile = game.attackProfile;
  const reach = profile.reach * game.mods.jeffReach;
  if (!h.engaged) {
    // A posted hero defends his position automatically. Explicit attack orders still hunt.
    let guard: Enemy | null = null;
    let nearest = Infinity;
    for (const e of game.enemies) {
      if (!isTargetable(e) || (!profile.air && e.def.flying)) continue;
      const distance = dist(h.pos, e.pos);
      if (distance <= reach + e.def.radius && distance < nearest) { guard = e; nearest = distance; }
    }
    return guard;
  }
  const current = h.orderTargetId === null ? undefined : game.enemies.find((e) => e.id === h.orderTargetId);
  if (current && !current.dead && !current.escaped && (profile.air || !current.def.flying)) {
    if (!isTargetable(current)) return null;
    return current;
  }
  const next = nearestPrey(game, false) ?? nearestPrey(game, true);
  h.orderTargetId = next?.id ?? null;
  if (!next) {
    h.engaged = false;
    return null;
  }
  if (!isTargetable(next)) return null;
  return next;
}

const HUNT_RADIUS = 190;

function nearestPrey(game: Game, includePhased: boolean): Enemy | null {
  let best: Enemy | null = null;
  let bestD = Infinity;
  const origin = game.hero.anchor;
  const reach = game.attackProfile.reach * game.mods.jeffReach;
  for (const e of game.enemies) {
    if (e.dead || e.escaped) continue;
    if (!game.attackProfile.air && e.def.flying) continue;
    if (!includePhased && !isTargetable(e)) continue;
    const d = dist(origin, e.pos);
    if (d > HUNT_RADIUS + reach + e.def.radius) continue;
    if (d < bestD) {
      bestD = d;
      best = e;
    }
  }
  return best;
}

/** Retreat is a tactical choice: three quiet seconds, then steady recovery. */
function recover(game: Game, dt: number): void {
  const h = game.hero;
  h.combatIdle = (h.combatIdle ?? 0) + dt;
  if (h.combatIdle < 3 || h.hp >= h.maxHp || h.hp <= 0) return;
  h.recovering = true;
  h.hp = Math.min(h.maxHp, h.hp + h.maxHp * .04 * dt);
}

function holdNearby(game: Game): void {
  const h = game.hero;
  const profile = game.attackProfile;
  const cap = ((h.taunt ?? 0) > 0 ? 5 : profile.holds) + game.mods.jeffHolds + (h.sleeveTimer > 0 ? JEFF.sleeve.extraHolds + abilityRank(game, 3) : 0);
  let held = 0;
  for (const e of game.enemies) if (e.heldBy?.kind === 'hero' && !e.dead) {
    if (held < cap) held++;
    else { e.heldBy = null; e.attackSwing = 0; }
  }
  for (const e of game.enemies) {
    if (held >= cap) break;
    if (!isTargetable(e) || e.def.flying || e.heldBy !== null) continue;
    if (dist(h.pos, e.pos) > Math.min(44, profile.reach * game.mods.jeffReach) + e.def.radius) continue;
    e.heldBy = { kind: 'hero' };
    held++;
  }
}

function repairNearby(game: Game, dt: number): void {
  if (game.heroDef.id !== 'jeff') return;
  const h = game.hero;
  for (const f of game.friendlies) if (f.respawn <= 0 && f.hp > 0 && dist(f.pos, h.pos) <= JEFF.toolBelt.radius) {
    f.hp = Math.min(f.maxHp, f.hp + JEFF.toolBelt.repairPerSec * game.mods.jeffRepair * .25 * dt);
  }
  for (const t of game.towers) {
    if (t.def.kind !== 'barricade' || t.rebuild > 0 || t.hp >= t.maxHp) continue;
    if (dist(t.pos, h.pos) > JEFF.toolBelt.radius) continue;
    t.hp = Math.min(t.maxHp, t.hp + JEFF.toolBelt.repairPerSec * game.mods.jeffRepair * dt);
  }
}
