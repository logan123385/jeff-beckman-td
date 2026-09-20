import { dist } from '../core/vec';
import { towerAbility } from '../data/towerAbilities';
import { isNoPowers } from '../data/remasters';
import type { DamageType, TowerId } from '../data/types';
import { applyDamage, hasProp, isTargetable, matchesTargetMode, pickTarget } from './combat';
import type { Game } from './game';
import type { Enemy, Tower } from './state';

export function towerAbilityReady(game: Game, t: Tower): { ok: true } | { ok: false; reason: string } {
  const def = towerAbility(t.def.id);
  if (!def) return { ok: false, reason: 'This tool has no active.' };
  if (isNoPowers(game.remaster)) return { ok: false, reason: 'Clean Hands — no actives.' };
  if ((t.build ?? 0) > 0) return { ok: false, reason: 'Still installing.' };
  if (t.frozen > 0) return { ok: false, reason: 'Frozen solid.' };
  if (t.rebuild > 0) return { ok: false, reason: 'Rebuilding.' };
  if (t.level < def.minLevel) return { ok: false, reason: `Unlocks at ${def.minLevel === 1 ? 'Reinforced' : 'a higher tier'}.` };
  if (t.abilityCd > 0) return { ok: false, reason: `Cooling ${Math.ceil(t.abilityCd)}s.` };
  if (game.parts < def.parts) return { ok: false, reason: `Need ${def.parts} spare parts.` };
  if (!abilityHasWork(game, t)) return { ok: false, reason: 'No leak in range.' };
  return { ok: true };
}

export function useTowerAbility(game: Game, towerId: number): boolean {
  if (game.status !== 'playing') return false;
  const t = game.towerById(towerId);
  if (!t) return false;
  const def = towerAbility(t.def.id);
  if (!def) return false;
  const gate = towerAbilityReady(game, t);
  if (!gate.ok) return false;
  game.parts -= def.parts;
  game.stats.partsSpent += def.parts;
  t.abilityCd = def.cooldown;
  t.recoil = 0.32;
  fireAbility(game, t);
  game.addEffect({ kind: 'text', pos: { x: t.pos.x, y: t.pos.y - 42 }, text: def.name.toUpperCase(), color: t.def.color, ttl: 0.9, max: 0.9 });
  game.addEffect({ kind: 'ring', pos: { ...t.pos }, radius: game.effectiveRange(t), color: t.def.color, ttl: 0.45, max: 0.45 });
  return true;
}

/** Target-dependent actives (Core Sample, Draft, Snapshot, …) must have work on the yard. */
function abilityHasWork(game: Game, t: Tower): boolean {
  const range = game.effectiveRange(t);
  switch (t.def.id) {
    case 'hammerDrill': {
      const saved = t.aim;
      t.aim = 'strong';
      const target = pickTarget(game, t, range);
      t.aim = saved;
      return Boolean(target);
    }
    case 'vent':
      return inRange(game, t, range, (e) => e.def.flying).length > 0;
    case 'barricade':
      return game.enemies.some((e) => e.heldBy?.kind === 'tower' && e.heldBy.id === t.id);
    case 'pipeSnake': {
      const { pathIdx, progress } = game.nearestPath(t.pos);
      const pierce = (t.def.levels[t.level]!.pierce ?? 160) * 1.35;
      return game.enemies.some(
        (e) =>
          isTargetable(e) &&
          e.pathIdx === pathIdx &&
          e.progress >= progress - 12 &&
          e.progress <= progress + pierce,
      );
    }
    case 'backflow':
    case 'sump':
      return inRange(game, t, range, (e) => !e.def.flying).length > 0;
    case 'camera':
      return inRange(game, t, range).length > 0;
    default:
      return true;
  }
}

function fireAbility(game: Game, t: Tower): void {
  const range = game.effectiveRange(t);
  const dmg = game.effectiveDamage(t);
  switch (t.def.id) {
    case 'torch':
      burst(game, t, range, dmg * 4.2, 'fire', 28, { shred: 0.35 });
      return;
    case 'washer':
      burst(game, t, range * 1.15, dmg * 2.4, 'water', 48, { slow: 0.55, groundOnly: true });
      return;
    case 'barricade':
      for (const e of game.enemies) {
        if (e.heldBy?.kind === 'tower' && e.heldBy.id === t.id) e.stun = Math.max(e.stun, 1.8 * game.mods.stunDuration);
      }
      return;
    case 'vent':
      for (const e of inRange(game, t, range, (n) => n.def.flying)) {
        applyDamage(game, e, dmg * 3.2, 'physical', 'vent', { groundMult: t.def.groundMult });
        e.progress = Math.max(0, e.progress - 40);
      }
      return;
    case 'radiant':
      burst(game, t, range, dmg * 3, 'heat', 0, { slow: 0.7, groundOnly: true });
      thaw(game, t, range);
      return;
    case 'pipeSnake': {
      const { pathIdx, progress } = game.nearestPath(t.pos);
      const pierce = (t.def.levels[t.level]!.pierce ?? 160) * 1.35;
      for (const e of game.enemies) {
        if (!isTargetable(e) || e.pathIdx !== pathIdx) continue;
        if (e.progress < progress - 12 || e.progress > progress + pierce) continue;
        applyDamage(game, e, dmg * 2.6, 'physical', 'pipeSnake');
      }
      return;
    }
    case 'backflow':
      for (const e of inRange(game, t, range, (n) => !n.def.flying)) {
        e.progress = Math.max(0, e.progress - 110);
      }
      return;
    case 'descaler':
      burst(game, t, range, dmg * 1.8, 'water', 0, { groundOnly: true, shred: 0.5, dot: 18, dotTime: 4 });
      return;
    case 'circulator':
    case 'thermostat':
      for (const other of game.towers) {
        if (dist(other.pos, t.pos) > range) continue;
        other.surge = Math.max(other.surge ?? 0, 8);
      }
      return;
    case 'prv': {
      const burstR = t.def.levels[t.level]!.burstRadius ?? range;
      t.charge = 0;
      burst(game, t, burstR, Math.max(dmg, 90) * 1.6, 'physical', burstR);
      return;
    }
    case 'boiler':
      burst(game, t, range * 1.1, dmg * 5, 'heat', 0, { slow: 0.4, groundOnly: true });
      thaw(game, t, range);
      return;
    case 'hammerDrill': {
      const saved = t.aim;
      t.aim = 'strong';
      const target = pickTarget(game, t, range);
      t.aim = saved;
      if (!target) return;
      const extra = hasProp(target, 'mineral') || hasProp(target, 'cast') ? 1.6 : 1;
      applyDamage(game, target, dmg * 5.5 * extra, 'physical', 'hammerDrill');
      game.addEffect({ kind: 'beam', from: { ...t.pos }, to: { ...target.pos }, color: t.def.color, ttl: 0.22, max: 0.22 });
      return;
    }
    case 'glycol':
      burst(game, t, range, dmg * 3.4, 'heat', 0, { groundOnly: true });
      thaw(game, t, range * 1.2);
      return;
    case 'sump':
      for (const e of inRange(game, t, range, (n) => !n.def.flying)) {
        const path = game.paths[e.pathIdx];
        if (!path) continue;
        const basin = path.nearestPoint(t.pos).progress;
        if (e.progress > basin) e.progress = Math.max(basin, e.progress - 90);
      }
      return;
    case 'camera':
      for (const e of inRange(game, t, range)) {
        e.marked = true;
        e.markBonus = Math.max(e.markBonus ?? 0, 0.45);
        e.markHold = Math.max(e.markHold, 6);
        if (e.phased) {
          e.phased = false;
          e.phaseTimer = 3;
        }
        applyDamage(game, e, Math.max(12, dmg * 0.8), 'physical', 'camera');
      }
      return;
    case 'dirtSep':
      burst(game, t, range, dmg * 2.2, 'water', 40, { groundOnly: true });
      return;
    case 'zoneValve':
      burst(game, t, range, dmg * 1.4, 'physical', 0, { groundOnly: true, stun: 1.1 });
      return;
    case 'apprentices':
    case 'jayjay':
    case 'cbjDoni':
      game.overtime = Math.max(game.overtime, 8);
      for (const f of game.friendlies) {
        if (f.towerId !== t.id || f.respawn > 0) continue;
        f.hp = Math.min(f.maxHp, f.hp + f.maxHp * 0.35);
      }
      return;
    default:
      burst(game, t, range, dmg * 2.2, t.def.damageType, 24);
  }
}

function inRange(game: Game, t: Tower, range: number, pred?: (e: Enemy) => boolean): Enemy[] {
  return game.enemies.filter((e) => {
    if (!isTargetable(e) || !matchesTargetMode(t.def.targets, e)) return false;
    if (pred && !pred(e)) return false;
    return dist(e.pos, t.pos) <= range + e.def.radius;
  });
}

function thaw(game: Game, t: Tower, range: number): void {
  for (const other of game.towers) {
    if (dist(other.pos, t.pos) <= range) other.frozen = 0;
  }
}

function burst(
  game: Game,
  t: Tower,
  range: number,
  amount: number,
  type: DamageType,
  splash: number,
  opts: { groundOnly?: boolean; slow?: number; shred?: number; dot?: number; dotTime?: number; stun?: number } = {},
): void {
  const source = t.def.id as TowerId;
  game.addEffect({ kind: 'splash', pos: { ...t.pos }, radius: Math.max(range, splash || range), color: t.def.color, ttl: 0.4, max: 0.4 });
  for (const e of game.enemies) {
    if (!isTargetable(e)) continue;
    if (opts.groundOnly && e.def.flying) continue;
    if (dist(e.pos, t.pos) > range + e.def.radius) continue;
    applyDamage(game, e, amount, type, source, { groundMult: t.def.groundMult });
    if (opts.slow) e.slow = Math.max(e.slow, opts.slow);
    if (opts.shred) {
      e.armorShred = Math.max(e.armorShred, opts.shred);
      e.shredTimer = Math.max(e.shredTimer, 4);
    }
    if (opts.dot && opts.dotTime) {
      e.dotDps = Math.max(e.dotDps, opts.dot);
      e.dotTime = Math.max(e.dotTime, opts.dotTime);
      e.dotSource = source;
    }
    if (opts.stun) e.stun = Math.max(e.stun, opts.stun * game.mods.stunDuration);
  }
}
