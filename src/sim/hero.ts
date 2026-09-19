import { dist, moveToward } from '../core/vec';
import { JEFF } from '../data/jeff';
import { advanceHeroCast, heroAttackSpeed, strikeNewHero } from './heroPowers';
import { applyDamage, isTargetable } from './combat';
import type { Game } from './game';
import type { Enemy } from './state';

export function updateHero(game: Game, dt: number): void {
  if (!game.heroEnabled) return;
  const h = game.hero;
  const def = game.heroDef;
  h.moveBlend = Math.max(0,Math.min(1,(h.moveBlend??0)+(h.moving?1:-1)*dt*8));
  h.moving = false;
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

  if (h.downed > 0) {
    h.pendingStrike = undefined;
    h.swing = 0;
    h.downed -= dt;
    h.orderTargetId = null;
    h.engaged = false;
    h.targetId = null;
    if (h.downed <= 0) {
      h.hp = h.maxHp;
      h.pos = { ...game.map.jeffStart };
      h.anchor = { ...game.map.jeffStart };
      h.dest = null;
      h.orderTargetId = null;
      h.engaged = false;
      h.targetId = null;
      game.addEffect({ kind: 'ring', pos: { ...h.pos }, radius: 28, color: '#a5d6a7', ttl: 0.55, max: 0.55 });
      game.addEffect({ kind: 'text', pos: { x: h.pos.x, y: h.pos.y - 40 }, text: 'Back on the job', color: '#a5d6a7', ttl: 1.2, max: 1.2 });
    }
    return;
  }

  if (advanceHeroCast(game, dt)) { holdNearby(game); return; }

  const coffee = h.coffeeTimer > 0 ? JEFF.coffee.speed : 1;
  const speed = def.speed * game.mods.jeffSpeed * game.jeffSpeedAura * coffee * (def.id === 'mike' && (h.overdrive ?? 0) > 0 ? 1.65 : 1);

  if (h.pendingStrike !== undefined && h.swing <= (h.swingDuration ?? def.swingTime) * 0.52) {
    const target = game.enemies.find(e => e.id === h.pendingStrike && isTargetable(e));
    h.pendingStrike = undefined;
    if (target && !h.dest && dist(h.pos, target.pos) <= game.heroDef.reach * game.mods.jeffReach + target.def.radius + 10) { if (def.id === 'jeff') strike(game, target); else strikeNewHero(game, target); }
  }

  if (h.swing > 0 && !h.dest) { holdNearby(game); repairNearby(game, dt); return; }

  // Pure move order — no swinging while jogging to a point.
  if (h.dest) {
    const r = moveToward(h.pos, h.dest, speed * dt);
    h.facing = h.dest.x >= h.pos.x ? 1 : -1;
    h.walkPhase = (h.walkPhase ?? 0) + dist(h.pos, r.pos) * 0.1;
    h.moving = true;
    h.pos = r.pos;
    if (r.arrived) h.dest = null;
    h.targetId = null;
    repairNearby(game, dt);
    return;
  }

  const target = resolveOrderTarget(game);
  h.targetId = target?.id ?? null;
  if (target) {
    if (h.engaged) h.anchor = { ...target.pos };
    const reach = game.heroDef.reach * game.mods.jeffReach + target.def.radius;
    if (dist(h.pos, target.pos) > reach) {
      const r = moveToward(h.pos, target.pos, speed * dt);
      h.walkPhase = (h.walkPhase ?? 0) + dist(h.pos, r.pos) * 0.1;
    h.moving = true;
    h.pos = r.pos;
      h.facing = target.pos.x >= h.pos.x ? 1 : -1;
    } else if (h.attackTimer <= 0) {
      const haste = heroAttackSpeed(game);
      h.attackTimer = 1 / (def.attackRate * haste); h.swingDuration = def.swingTime / haste; h.swing = h.swingDuration;
      h.facing = target.pos.x >= h.pos.x ? 1 : -1; h.pendingStrike = target.id;
    }
  }
  holdNearby(game);
  repairNearby(game, dt);
}

/** Hunt started by one wrench click. The locked leak is waited out if it phases; once it dies, the nearest leak is next. A move order is the only off switch. */
function resolveOrderTarget(game: Game): Enemy | null {
  const h = game.hero;
  if (!h.engaged) {
    // A posted hero defends his position automatically. Explicit attack orders still hunt.
    let guard: Enemy | null = null;
    let nearest = Infinity;
    for (const e of game.enemies) {
      if (!isTargetable(e)) continue;
      const distance = dist(h.pos, e.pos);
      if (distance <= game.heroDef.reach * game.mods.jeffReach + e.def.radius && distance < nearest) { guard = e; nearest = distance; }
    }
    return guard;
  }
  const current = h.orderTargetId === null ? undefined : game.enemies.find((e) => e.id === h.orderTargetId);
  if (current && !current.dead && !current.escaped) {
    if (!isTargetable(current)) return null;
    return current;
  }
  const next = nearestPrey(game, false) ?? nearestPrey(game, true);
  h.orderTargetId = next?.id ?? null;
  if (!next || !isTargetable(next)) return null;
  return next;
}

function nearestPrey(game: Game, includePhased: boolean): Enemy | null {
  let best: Enemy | null = null;
  let bestD = Infinity;
  for (const e of game.enemies) {
    if (e.dead || e.escaped) continue;
    if (!includePhased && !isTargetable(e)) continue;
    const d = dist(game.hero.pos, e.pos);
    if (d < bestD) {
      bestD = d;
      best = e;
    }
  }
  return best;
}

function strike(game: Game, target: Enemy): void {
  const h = game.hero;

  h.facing = target.pos.x >= h.pos.x ? 1 : -1;
  const dmg = JEFF.damage * game.mods.jeffDamage;
  const tapEvery = Math.max(1, Math.round(JEFF.wrenchTap.every * game.mods.jeffTapEvery));
  h.tapCount += 1;
  const tapped = h.tapCount >= tapEvery;
  if (tapped) {
    h.tapCount = 0;
    target.stun = Math.max(target.stun, JEFF.wrenchTap.stun * game.mods.stunDuration);
    game.addEffect({ kind: 'text', pos: { x: target.pos.x, y: target.pos.y - 28 }, text: 'WRENCH TAP', color: '#fff59d', ttl: 1.0, max: 1.0 });
    game.addEffect({ kind: 'ring', pos: { ...target.pos }, radius: 48, color: '#fff59d', ttl: 0.48, max: 0.48 });
  }
  target.armorShred = JEFF.armorShred;
  target.shredTimer = JEFF.shredDuration;
  applyDamage(game, target, dmg, 'physical', 'jeff');
  const from = { x: h.pos.x + h.facing * 22, y: h.pos.y - 18 };
  game.addEffect({
    kind: 'beam',
    from,
    to: { ...target.pos },
    color: tapped ? '#fff59d' : '#ffe082',
    ttl: 0.24,
    max: 0.24,
  });
  game.addEffect({ kind: 'hit', pos: { ...target.pos }, color: tapped ? '#fffde7' : '#ffecb3', ttl: 0.42, max: 0.42 });
  game.addEffect({ kind: 'splash', pos: { ...target.pos }, radius: tapped ? 46 : 30, color: '#ffe082', ttl: 0.32, max: 0.32 });
  game.addEffect({
    kind: 'ring',
    pos: { x: h.pos.x + h.facing * 10, y: h.pos.y + 12 },
    radius: tapped ? 26 : 20,
    color: tapped ? '#fff59d' : '#ffe082',
    ttl: 0.26,
    max: 0.26,
  });
  game.addEffect({
    kind: 'ring',
    pos: { ...target.pos },
    radius: tapped ? 36 : 22,
    color: '#fff8e1',
    ttl: 0.18,
    max: 0.18,
  });
}

function holdNearby(game: Game): void {
  const h = game.hero;
  const cap = ((h.taunt ?? 0) > 0 ? 5 : game.heroDef.holds) + game.mods.jeffHolds + (h.sleeveTimer > 0 ? JEFF.sleeve.extraHolds : 0);
  let held = 0;
  for (const e of game.enemies) if (e.heldBy?.kind === 'hero' && !e.dead) {
    if (held < cap) held++;
    else { e.heldBy = null; e.attackSwing = 0; }
  }
  for (const e of game.enemies) {
    if (held >= cap) break;
    if (!isTargetable(e) || e.def.flying || e.heldBy !== null) continue;
    if (dist(h.pos, e.pos) > Math.min(44, game.heroDef.reach * game.mods.jeffReach) + e.def.radius) continue;
    e.heldBy = { kind: 'hero' };
    held++;
  }
}

function repairNearby(game: Game, dt: number): void {
  if (game.heroDef.id !== 'jeff') return;
  const h = game.hero;
  for (const t of game.towers) {
    if (t.def.kind !== 'barricade' || t.rebuild > 0 || t.hp >= t.maxHp) continue;
    if (dist(t.pos, h.pos) > JEFF.toolBelt.radius) continue;
    t.hp = Math.min(t.maxHp, t.hp + JEFF.toolBelt.repairPerSec * game.mods.jeffRepair * dt);
  }
}
