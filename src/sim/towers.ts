import { dist } from '../core/vec';
import { BARRICADE_REBUILD_SECONDS, BARRICADE_REGEN_PER_SEC } from '../data/towers';
import { applyDamage, isTargetable, pickTarget } from './combat';
import type { Game } from './game';
import type { Tower } from './state';

export function releaseHeldBy(game: Game, tower: Tower): void {
  for (const e of game.enemies) {
    if (e.heldBy?.kind === 'tower' && e.heldBy.id === tower.id) e.heldBy = null;
  }
}

/** Reset per-frame aura state, then let Expansion Tanks buff towers and Radiant Coils slow enemies. */
export function updateAuras(game: Game, dt: number): void {
  game.buffs.clear();
  for (const e of game.enemies) e.slow = game.globalSlowTimer > 0 ? game.globalSlow : 0;

  for (const t of game.towers) {
    if (t.def.id !== 'expansion') continue;
    const lvl = t.def.levels[t.level];
    const range = game.effectiveRange(t);
    for (const other of game.towers) {
      if (other.id === t.id || dist(other.pos, t.pos) > range) continue;
      const cur = game.buffs.get(other.id) ?? { dmg: 0, range: 0 };
      cur.dmg = Math.max(cur.dmg, lvl.dmgBuff ?? 0);
      cur.range = Math.max(cur.range, lvl.rangeBuff ?? 0);
      game.buffs.set(other.id, cur);
    }
  }

  for (const t of game.towers) {
    if (t.def.id !== 'radiant') continue;
    const lvl = t.def.levels[t.level];
    const range = game.effectiveRange(t);
    t.cooldown -= dt;
    const tick = t.cooldown <= 0;
    if (tick) t.cooldown += 1 / lvl.fireRate;
    for (const e of game.enemies) {
      if (!isTargetable(e) || e.def.flying || dist(e.pos, t.pos) > range + e.def.radius) continue;
      e.slow = Math.max(e.slow, lvl.slow ?? 0);
      if (tick) applyDamage(game, e, game.effectiveDamage(t), 'heat', 'radiant');
    }
  }

  if (game.clamp) {
    for (const e of game.enemies) {
      if (!isTargetable(e) || e.def.flying || dist(e.pos, game.clamp.pos) > game.clampRadius() + e.def.radius) continue;
      e.slow = Math.max(e.slow, game.clampSlow());
    }
  }
}

export function updateTowers(game: Game, dt: number): void {
  for (const t of game.towers) {
    if (t.frozen > 0) t.frozen -= dt;
    if (t.shieldCooldown > 0) t.shieldCooldown -= dt;
    if (t.recoil > 0) t.recoil -= dt;
    switch (t.def.kind) {
      case 'shooter':
        if (t.frozen <= 0) updateShooter(game, t, dt);
        break;
      case 'barricade':
        updateBarricade(game, t, dt);
        break;
      case 'aura':
        break;
      default: {
        const _exhaustive: never = t.def.kind;
        return _exhaustive;
      }
    }
  }
}

function updateShooter(game: Game, t: Tower, dt: number): void {
  t.cooldown -= dt;
  if (t.cooldown > 0) return;
  const lvl = t.def.levels[t.level];
  const range = game.effectiveRange(t);
  const target = pickTarget(game, t, range);
  if (!target) {
    t.cooldown = 0;
    return;
  }
  t.cooldown = 1 / lvl.fireRate;
  t.facing = Math.atan2(target.pos.y - t.pos.y, target.pos.x - t.pos.x);
  t.recoil = 0.12;
  const damage = game.effectiveDamage(t);
  if (t.def.projectileSpeed === undefined) {
    applyDamage(game, target, damage, t.def.damageType, t.def.id, { groundMult: t.def.groundMult });
    game.addEffect({ kind: 'beam', from: { ...t.pos }, to: { ...target.pos }, color: t.def.color, ttl: 0.1, max: 0.1 });
    game.addEffect({ kind: 'hit', pos: { ...target.pos }, color: t.def.color, ttl: 0.18, max: 0.18 });
    return;
  }
  game.projectiles.push({
    id: game.nextEntityId(),
    pos: { ...t.pos },
    targetId: target.id,
    lastTargetPos: { ...target.pos },
    speed: t.def.projectileSpeed,
    damage,
    damageType: t.def.damageType,
    splash: lvl.splash ?? 0,
    source: t.def.id,
    groundMult: t.def.groundMult ?? 1,
    color: t.def.color,
  });
}

function updateBarricade(game: Game, t: Tower, dt: number): void {
  const lvl = t.def.levels[t.level];
  if (t.rebuild > 0) {
    t.rebuild -= dt;
    t.hp = t.maxHp * (1 - Math.max(0, t.rebuild) / BARRICADE_REBUILD_SECONDS);
    if (t.rebuild <= 0) t.hp = t.maxHp;
    return;
  }
  if (t.frozen > 0) return;

  const held = game.enemies.filter((e) => e.heldBy?.kind === 'tower' && e.heldBy.id === t.id && !e.dead && !e.escaped);
  let capacity = (lvl.holds ?? 0) - held.length;
  if (capacity > 0) {
    for (const e of game.enemies) {
      if (capacity <= 0) break;
      if (!isTargetable(e) || e.def.flying || e.heldBy !== null) continue;
      if (dist(e.pos, t.rally) > lvl.range + e.def.radius) continue;
      e.heldBy = { kind: 'tower', id: t.id };
      held.push(e);
      capacity--;
    }
  }

  if (held.length === 0) {
    t.hp = Math.min(t.maxHp, t.hp + BARRICADE_REGEN_PER_SEC * dt);
    t.cooldown = 0;
    return;
  }
  t.cooldown -= dt;
  if (t.cooldown <= 0) {
    t.cooldown = 1 / lvl.fireRate;
    const target = held.reduce((a, b) => (a.hp < b.hp ? a : b));
    applyDamage(game, target, game.effectiveDamage(t), t.def.damageType, t.def.id);
    game.addEffect({ kind: 'hit', pos: { ...target.pos }, color: t.def.color, ttl: 0.15, max: 0.15 });
    t.recoil = 0.15;
  }
}

export function damageBarricade(game: Game, t: Tower, amount: number): void {
  if (t.def.kind !== 'barricade' || t.rebuild > 0) return;
  t.hp -= amount;
  game.addEffect({ kind: 'hit', pos: { x: t.rally.x, y: t.rally.y - 10 }, color: '#ff8a80', ttl: 0.15, max: 0.15 });
  if (t.hp <= 0) {
    t.hp = 0;
    t.rebuild = BARRICADE_REBUILD_SECONDS;
    releaseHeldBy(game, t);
    game.addEffect({ kind: 'text', pos: { x: t.rally.x, y: t.rally.y - 24 }, text: 'valve blown!', color: '#ff8a80', ttl: 1.2, max: 1.2 });
  }
}

/** Radiant coils never freeze, and neither does anything inside one. */
export function towerHasFreezeProtection(game: Game, t: Tower): boolean {
  if (t.def.id === 'radiant') return true;
  for (const r of game.towers) {
    if (r.def.id === 'radiant' && dist(r.pos, t.pos) <= game.effectiveRange(r)) return true;
  }
  return false;
}
