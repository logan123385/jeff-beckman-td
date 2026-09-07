import { dist, moveToward } from '../core/vec';
import { JEFF } from '../data/jeff';
import { applyDamage, isTargetable } from './combat';
import type { Game } from './game';
import type { Enemy } from './state';

export function updateHero(game: Game, dt: number): void {
  if (!game.heroEnabled) return;
  const h = game.hero;
  if (h.clampCooldown > 0) h.clampCooldown -= dt;
  if (h.shutoffCooldown > 0) h.shutoffCooldown -= dt;
  if (h.tapTimer > 0) h.tapTimer -= dt;
  if (h.attackTimer > 0) h.attackTimer -= dt;
  if (h.swing > 0) h.swing -= dt;

  if (h.downed > 0) {
    h.downed -= dt;
    if (h.downed <= 0) {
      h.hp = h.maxHp;
      game.addEffect({ kind: 'text', pos: { x: h.pos.x, y: h.pos.y - 40 }, text: 'Back on the job', color: '#a5d6a7', ttl: 1.2, max: 1.2 });
    }
    return;
  }

  const speed = JEFF.speed * game.mods.jeffSpeed;
  if (h.dest) {
    const r = moveToward(h.pos, h.dest, speed * dt);
    h.facing = h.dest.x >= h.pos.x ? 1 : -1;
    h.pos = r.pos;
    if (r.arrived) h.dest = null;
    h.targetId = null;
    repairNearby(game, dt);
    return;
  }

  const target = findTarget(game);
  h.targetId = target?.id ?? null;
  if (target) {
    const reach = JEFF.reach + target.def.radius;
    if (dist(h.pos, target.pos) > reach) {
      const r = moveToward(h.pos, target.pos, speed * dt);
      h.pos = r.pos;
      h.facing = target.pos.x >= h.pos.x ? 1 : -1;
    } else if (h.attackTimer <= 0) {
      strike(game, target);
    }
  }
  holdNearby(game);
  repairNearby(game, dt);
}

/** Nearest targetable enemy near Jeff's anchor point (so he doesn't chase across the map). */
function findTarget(game: Game): Enemy | null {
  const h = game.hero;
  let best: Enemy | null = null;
  let bestD = Infinity;
  for (const e of game.enemies) {
    if (!isTargetable(e)) continue;
    const dAnchor = dist(h.anchor, e.pos);
    if (dAnchor > JEFF.aggro + e.def.radius) continue;
    const d = dist(h.pos, e.pos);
    if (d < bestD) {
      bestD = d;
      best = e;
    }
  }
  return best;
}

function strike(game: Game, target: Enemy): void {
  const h = game.hero;
  h.attackTimer = 1 / JEFF.attackRate;
  h.swing = 0.2;
  h.facing = target.pos.x >= h.pos.x ? 1 : -1;
  const dmg = JEFF.damage * game.mods.jeffDamage;
  if (h.tapTimer <= 0) {
    h.tapTimer = JEFF.wrenchTap.every * game.mods.cooldown;
    target.stun = Math.max(target.stun, JEFF.wrenchTap.stun * game.mods.stunDuration);
    game.addEffect({ kind: 'text', pos: { x: target.pos.x, y: target.pos.y - 22 }, text: 'WRENCH TAP', color: '#fff59d', ttl: 0.8, max: 0.8 });
  }
  target.armorShred = JEFF.armorShred;
  target.shredTimer = JEFF.shredDuration;
  applyDamage(game, target, dmg, 'physical', 'jeff');
  game.addEffect({ kind: 'hit', pos: { ...target.pos }, color: '#fff59d', ttl: 0.15, max: 0.15 });
}

function holdNearby(game: Game): void {
  const h = game.hero;
  let held = 0;
  for (const e of game.enemies) if (e.heldBy?.kind === 'hero' && !e.dead) held++;
  for (const e of game.enemies) {
    if (held >= JEFF.holds) break;
    if (!isTargetable(e) || e.def.flying || e.heldBy !== null) continue;
    if (dist(h.pos, e.pos) > JEFF.reach + e.def.radius) continue;
    e.heldBy = { kind: 'hero' };
    held++;
  }
}

function repairNearby(game: Game, dt: number): void {
  const h = game.hero;
  for (const t of game.towers) {
    if (t.def.kind !== 'barricade' || t.rebuild > 0 || t.hp >= t.maxHp) continue;
    if (dist(t.pos, h.pos) > JEFF.toolBelt.radius) continue;
    t.hp = Math.min(t.maxHp, t.hp + JEFF.toolBelt.repairPerSec * dt);
  }
}
