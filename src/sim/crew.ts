import { friendlyDamageBuff } from './heroPowers';
import { dist, moveToward } from '../core/vec';
import { applyDamage, isTargetable } from './combat';
import type { Game } from './game';

export const CREW_COOLDOWN = 30;
export const CREW_DURATION = 18;
export const CREW_REACH = 35;

export function updateCrew(game: Game, dt: number): void {
  game.crewCooldown = Math.max(0, game.crewCooldown - dt);
  for (const crew of game.crew) {
    crew.timeLeft -= dt;
    crew.swing = Math.max(0, crew.swing - dt);
    if (crew.hp <= 0 || crew.timeLeft <= 0) continue;
    if (dist(crew.pos, crew.home) > 8) {
      const step = moveToward(crew.pos, crew.home, 118 * dt);
      crew.pos = step.pos;
      crew.facing = crew.home.x >= crew.pos.x ? 1 : -1;
      continue;
    }
    if (crew.pendingTarget !== undefined && crew.swing <= .68 * .52) {
      const target = game.enemies.find(e => e.id === crew.pendingTarget && isTargetable(e));
      crew.pendingTarget = undefined;
      if (target && dist(target.pos, crew.pos) <= CREW_REACH + target.def.radius) {
        applyDamage(game, target, 11 * friendlyDamageBuff(game, crew.pos), 'physical', 'crew');
        game.addEffect({ kind: 'hit', pos: { x: target.pos.x, y: target.pos.y - 15 }, color: '#badc8c', ttl: .18, max: .18 });
      }
    }
    const held = game.enemies.find(e => !e.dead && !e.escaped && e.heldBy?.kind === 'crew' && e.heldBy.id === crew.id);
    const target = held ?? game.enemies.find(e => isTargetable(e) && !e.def.flying && e.heldBy === null && dist(e.pos, crew.pos) <= CREW_REACH + e.def.radius);
    crew.attackTimer -= dt;
    if (!target) continue;
    target.heldBy = { kind: 'crew', id: crew.id };
    crew.facing = target.pos.x >= crew.pos.x ? 1 : -1;
    if (crew.attackTimer <= 0) {
      crew.attackTimer = .9; crew.swing = .68; crew.pendingTarget = target.id;
    }
  }
  game.crew = game.crew.filter(c => c.timeLeft > 0 && c.hp > 0);
  for (const e of game.enemies) if (e.heldBy?.kind === 'crew' && !game.crew.some(c => c.id === (e.heldBy as { id: number }).id)) e.heldBy = null;
}