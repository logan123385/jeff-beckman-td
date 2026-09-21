import { dist, moveToward } from '../core/vec';
import { applyDamage, isTargetable } from './combat';
import { friendlyDamageBuff, friendlyMitigation } from './heroPowers';
import type { Game } from './game';
import type { Enemy, Friendly, Tower } from './state';

export const FRIENDLY_SWING = 0.68;
export function releaseFriendly(game: Game, id: number): void {
  for (const e of game.enemies) if (e.heldBy?.kind === 'friendly' && e.heldBy.id === id)  { e.heldBy = null; e.attackSwing = 0; }
}
export function syncRecruits(game: Game, t: Tower): void {
  if (!t.def.recruits) return;
  const l = t.def.levels[t.level]!;
  const count = l.recruits ?? 1;
  for (let i = 0; i < count; i++) {
    let f = game.friendlies.find(n => n.towerId === t.id && n.slot === i);
    const role = t.def.recruits === 'apprentices' ? 'apprentice' : t.def.recruits === 'jayjay' ? 'jayjay' : i === 0 ? 'cbj' : 'doni';
    const hp = Math.round((l.hp ?? 100) * game.mods.crewHp * (role === 'cbj' ? 0.72 : role === 'doni' ? 1.3 : 1));
    const angle = i * Math.PI * 2 / count;
    const home = { x: t.rally.x + (count > 1 ? Math.cos(angle) * 19 : 0), y: t.rally.y + (count > 1 ? Math.sin(angle) * 15 : 0) };
    if (!f) {
      f = { id: game.nextEntityId(), towerId: t.id, role, slot: i, pos: { ...t.pos }, prev: { ...t.pos }, home,
        hp, maxHp: hp, armor: 0, damage: 0, range: 0, rate: 1, holds: 1, respawn: 0,
        targetId: null, attackTimer: 0, swing: 0, hitLanded: false, facing: 1, moving: false, walkPhase: i, tier: t.level };
      game.friendlies.push(f);
    }
    const ratio = f.maxHp > 0 ? f.hp / f.maxHp : 1;
    f.home = home; f.tier = t.level; f.maxHp = hp; f.hp = hp * ratio;
    f.armor = Math.min(0.72, l.armor ?? 0); f.damage = l.damage * game.mods.towerDamage * game.mods.crewDamage * (role === 'cbj' ? 0.7 : role === 'doni' ? 1.35 : 1);
    f.range = l.range; f.rate = l.fireRate * (role === 'cbj' ? 1.45 : role === 'doni' ? 0.85 : 1); f.holds = l.holds ?? 1;
  }
}
export function damageFriendly(game: Game, f: Friendly, damage: number): void {
  if (f.respawn > 0 || f.hp <= 0) return;
  f.hp = Math.max(0, f.hp - damage * (1 - f.armor) * friendlyMitigation(game, f.pos));
  if (f.hp === 0) {
    f.respawn = (f.role === 'jayjay' ? 14 : f.role === 'apprentice' ? 9 : 11) * game.mods.crewRespawn;
    f.fall = .55; f.targetId = null; f.swing = 0; f.moving = false; releaseFriendly(game, f.id);
  }
}
export function updateFriendlies(game: Game, dt: number): void {
  for (const f of game.friendlies) {
    const tower = game.towerById(f.towerId);
    if (!tower) continue;
    f.range = game.effectiveRange(tower);
    f.moveBlend = Math.max(0,Math.min(1,(f.moveBlend??0)+(f.moving?1:-1)*dt*8));
    f.moving = false;
    f.fall = Math.max(0,(f.fall??0)-dt);
    if (f.respawn > 0) {
      f.respawn = Math.max(0, f.respawn - dt);
      if (f.respawn === 0) { f.hp = f.maxHp; f.pos = { ...tower.pos }; f.prev = { ...tower.pos }; game.addEffect({ kind: 'ring', pos: { ...f.pos }, radius: 24, color: '#b1e5bd', ttl: 0.5, max: 0.5 }); }
      continue;
    }
    if (tower.frozen > 0 || tower.rebuild > 0) { releaseFriendly(game, f.id); f.targetId = null; f.swing = 0; continue; }
    if ((tower.build ?? 0) > 0) {
      releaseFriendly(game, f.id);
      f.targetId = null;
      f.swing = 0;
      f.hitLanded = false;
      const goal = f.home;
      if (dist(f.pos, goal) > 2) {
        const step = moveToward(f.pos, goal, (f.role === 'jayjay' ? 65 : 92) * dt * (0.45 + 0.55 * (f.moveBlend ?? 0)));
        f.walkPhase += dist(f.pos, step.pos) * 0.13; f.pos = step.pos; f.facing = goal.x >= f.pos.x ? 1 : -1; f.moving = true;
      }
      continue;
    }
    f.attackTimer = Math.max(0, f.attackTimer - dt * (game.overtime > 0 ? 1.85 : 1));
    if (f.swing > 0) {
      f.swing = Math.max(0, f.swing - dt);
      if (!f.hitLanded && f.swing <= FRIENDLY_SWING * 0.52) {
        f.hitLanded = true;
        const target = game.enemies.find(e => e.id === f.targetId && isTargetable(e));
        if (target && dist(target.pos, f.pos) <= f.range + target.def.radius + 12) {
          applyDamage(game, target, f.damage * friendlyDamageBuff(game, f.pos) * (1 + (game.buffs.get(tower.id)?.dmg ?? 0)), 'physical', tower.def.id);
          game.addEffect({ kind: 'hit', pos: { x: target.pos.x, y: target.pos.y - 15 }, color: tower.def.color, ttl: 0.18, max: 0.18 });
          if (f.role === 'doni') game.addEffect({ kind: 'text', pos: { x: f.pos.x, y: f.pos.y - 54 }, text: 'NYEH!', color: '#ffe4ae', ttl: 0.9, max: 0.9 });
          if (f.role === 'jayjay') target.stun = Math.max(target.stun, target.def.traits.includes('boss') ? 0.15 : 0.3);
        }
      }
      continue;
    }
    const held = game.enemies.filter(e => e.heldBy?.kind === 'friendly' && e.heldBy.id === f.id && isTargetable(e));
    const leash = Math.max(112, f.range + 78);
    for (const e of game.enemies) {
      if (held.length >= f.holds) break;
      if (!isTargetable(e) || e.def.flying || e.heldBy || dist(e.pos, f.home) > leash) continue;
      if (dist(e.pos, f.pos) <= f.range + e.def.radius) { e.heldBy = { kind: 'friendly', id: f.id }; held.push(e); }
    }
    let target: Enemy | null = held[0] ?? null;
    if (!target) {
      let best: Enemy | null = null;
      let bestRem = Infinity;
      for (const e of game.enemies) {
        if (!isTargetable(e) || e.def.flying || dist(e.pos, f.home) > leash) continue;
        // Intercept loose leaks first; otherwise help the ally holding a tough target.
        // A lone regenerating enemy must not lock one apprentice in an endless duel
        // while the other three stand idle next to it.
        const rem = (game.paths[e.pathIdx]?.length ?? 0) - e.progress + (e.heldBy ? 10_000 : 0);
        if (!best || rem < bestRem) { best = e; bestRem = rem; }
      }
      target = best;
    }
    if (held.length > 1 && f.holds > 1) {
      target = held.reduce((a, b) => (a.hp <= b.hp ? a : b));
    }
    f.targetId = target?.id ?? null;
    const goal = target ? target.pos : f.home;
    if (dist(f.pos, goal) > (target ? f.range + target.def.radius - 3 : 2)) {
      const step = moveToward(f.pos, goal, (f.role === 'jayjay' ? 65 : 92) * dt * (0.45 + 0.55 * (f.moveBlend ?? 0)));
      f.walkPhase += dist(f.pos, step.pos) * 0.13; f.pos = step.pos; f.facing = goal.x >= f.pos.x ? 1 : -1; f.moving = true;
    } else if (target && f.attackTimer <= 0) {
      f.facing = target.pos.x >= f.pos.x ? 1 : -1; f.swing = FRIENDLY_SWING; f.hitLanded = false;
      f.attackTimer = Math.max(FRIENDLY_SWING + 0.04, 1 / (f.rate * (1 + (game.buffs.get(tower.id)?.rate ?? 0))));
    } else if (!target) f.hp = Math.min(f.maxHp, f.hp + f.maxHp * 0.035 * dt);
  }
}
