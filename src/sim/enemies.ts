import { dist } from '../core/vec';
import {
  BOSS_VENT_DAMAGE,
  BOSS_VENT_INTERVAL,
  BOSS_VENT_RADIUS,
  FREEZE_DURATION,
  FREEZE_INTERVAL,
  FREEZE_RADIUS,
  HASTE_AURA_AMOUNT,
  HASTE_AURA_RADIUS,
  LANE_SWAP_SECONDS,
  PHASE_HIDDEN_SECONDS,
  PHASE_VISIBLE_SECONDS,
} from '../data/enemies';
import { JEFF } from '../data/jeff';
import { friendlyMitigation } from './heroPowers';
import { damageFriendly } from './friendlies';
import { CREW_REACH } from './crew';
import type { Game } from './game';
import type { Enemy } from './state';
import { applyDamage } from './combat';
import { damageBarricade, releaseHeldBy, towerHasFreezeProtection } from './towers';

export function updateEnemies(game: Game, dt: number): void {
  for (const e of game.enemies) {
    if (e.dead || e.escaped) continue;
    tickTimers(game, e, dt);
    validateHold(game, e);
    if (!e.heldBy) e.attackSwing = 0;
    if (e.heldBy === null && e.stun <= 0) {
      const speed = e.def.speed * e.speedMult * (1 - e.slow) * (1 + e.haste);
      e.progress += speed * dt;
      e.wobble += dt * 6;
    }
    const path = game.paths[e.pathIdx]!;
    if (e.progress >= path.length) {
      e.escaped = true;
      e.heldBy = null;
      game.lives -= e.def.livesCost;
      game.stats.escaped++;
      game.addEffect({ kind: 'text', pos: { x: e.pos.x - 30, y: e.pos.y - 20 }, text: `-${e.def.livesCost} life`, color: '#ff5252', ttl: 1.2, max: 1.2 });
      continue;
    }
    const base = path.pointAt(e.progress);
    const dir = path.directionAt(e.progress);
    e.pos = { x: base.x - dir.y * e.lane, y: base.y + dir.x * e.lane };
    if (e.heldBy !== null && e.stun <= 0) attackHolder(game, e, dt);
  }
}

function tickTimers(game: Game, e: Enemy, dt: number): void {
  if (e.dotTime > 0 && e.dotDps > 0 && e.dotSource) {
    applyDamage(game, e, e.dotDps * dt, 'water', e.dotSource);
    e.dotTime -= dt;
    if (e.dotTime <= 0) {
      e.dotDps = 0;
      e.dotSource = null;
    }
  }
  if (e.stun > 0) e.stun -= dt;
  if (e.hitFlash > 0) e.hitFlash = Math.max(0, e.hitFlash - dt);
  if (e.shredTimer > 0) {
    e.shredTimer -= dt;
    if (e.shredTimer <= 0) e.armorShred = 0;
  }
  e.revealTimer = Math.max(0, (e.revealTimer ?? 0) - dt);
  if (e.def.traits.includes('phases') && (e.revealTimer ?? 0) <= 0) {
    if (e.stun > 0 && e.phased) {
      e.phased = false;
      e.phaseTimer = PHASE_VISIBLE_SECONDS;
    } else {
      e.phaseTimer -= dt;
      if (e.phaseTimer <= 0) {
        e.phased = !e.phased;
        e.phaseTimer = e.phased ? PHASE_HIDDEN_SECONDS : PHASE_VISIBLE_SECONDS;
        if (e.phased) e.heldBy = null;
      }
    }
  }
  if (e.def.traits.includes('freezes')) {
    e.freezeTimer -= dt;
    if (e.freezeTimer <= 0) {
      e.freezeTimer = FREEZE_INTERVAL;
      freezePulse(game, e);
    }
  }
  if (e.def.traits.includes('boss')) {
    e.ventTimer -= dt;
    if (e.ventTimer <= 0) {
      e.ventTimer = BOSS_VENT_INTERVAL;
      bossVent(game, e);
    }
  }
  if (e.def.traits.includes('laneSwap') && game.paths.length > 1) {
    e.laneTimer -= dt;
    if (e.laneTimer <= 0) {
      e.laneTimer = LANE_SWAP_SECONDS;
      const next = (e.pathIdx + 1) % game.paths.length;
      const path = game.paths[next]!;
      e.pathIdx = next;
      e.progress = Math.min(e.progress, Math.max(0, path.length - 8));
      e.heldBy = null;
    }
  }
  if (e.def.traits.includes('hasteAura')) {
    for (const other of game.enemies) {
      if (other.id === e.id || other.dead || other.escaped) continue;
      if (dist(other.pos, e.pos) <= HASTE_AURA_RADIUS + other.def.radius) {
        other.haste = Math.max(other.haste, HASTE_AURA_AMOUNT);
      }
    }
  }
}

/** Drop a hold whose holder has moved, broken, or died. */
function validateHold(game: Game, e: Enemy): void {
  const h = e.heldBy;
  if (h === null) return;
  if (e.def.flying) {
    e.heldBy = null;
    return;
  }
  switch (h.kind) {
    case 'summon': {
      const s = game.heroSummons.find(s => s.id === h.id);
      if (!s || s.hp <= 0 || s.left <= 0 || dist(s.pos, e.pos) > 35 + e.def.radius) e.heldBy = null;
      return;
    }
    case 'friendly': {
      const f = game.friendlies.find(n => n.id === h.id);
      if (!f || f.respawn > 0 || f.hp <= 0 || dist(f.pos, e.pos) > f.range + e.def.radius + 15) e.heldBy = null;
      return;
    }
    case 'crew': {
      const crew = game.crew.find(c => c.id === h.id);
      if (!crew || crew.hp <= 0 || crew.timeLeft <= 0 || dist(crew.pos, e.pos) > CREW_REACH + e.def.radius + 6) e.heldBy = null;
      return;
    }
    case 'tower': {
      const t = game.towers.find((x) => x.id === h.id);
      if (!t || t.rebuild > 0 || t.frozen > 0 || dist(t.rally, e.pos) > t.def.levels[t.level]!.range + e.def.radius + 6) e.heldBy = null;
      return;
    }
    case 'hero': {
      const hero = game.hero;
      if (!game.heroEnabled || hero.downed > 0 || hero.dest !== null || dist(hero.pos, e.pos) > Math.min(44, game.heroDef.reach * game.mods.jeffReach) + e.def.radius + 6) e.heldBy = null;
      return;
    }
    case 'clamp': {
      if (!game.clamp || dist(game.clamp.pos, e.pos) > JEFF.clamp.radius + e.def.radius) e.heldBy = null;
      return;
    }
    default: {
      const _exhaustive: never = h;
      return _exhaustive;
    }
  }
}

function attackHolder(game: Game, e: Enemy, dt: number): void {
  if (e.attackSwing && e.attackSwing > 0) {
    e.attackSwing = Math.max(0, e.attackSwing - dt);
    if (e.attackLanded || e.attackSwing > 0.32) return;
    e.attackLanded = true;
  } else {
    e.attackTimer -= dt;
    if (e.attackTimer > 0 || e.def.dps <= 0) return;
    e.attackTimer = 0.36; e.attackSwing = 0.64; e.attackLanded = false;
    return;
  }

  const h = e.heldBy;
  if (h === null) return;
  switch (h.kind) {
    case 'summon': {
      const s = game.heroSummons.find(s => s.id === h.id);
      if (s) s.hp = Math.max(0, s.hp - e.def.dps);
      if (!s || s.hp <= 0) e.heldBy = null;
      return;
    }
    case 'friendly': {
      const f = game.friendlies.find(n => n.id === h.id);
      if (f) damageFriendly(game, f, e.def.dps);
      return;
    }
    case 'crew': {
      const crew = game.crew.find(c => c.id === h.id);
      if (crew) crew.hp = Math.max(0, crew.hp - e.def.dps * friendlyMitigation(game, crew.pos));
      if (!crew || crew.hp <= 0) e.heldBy = null;
      return;
    }
    case 'tower': {
      const t = game.towers.find((x) => x.id === h.id);
      if (t) damageBarricade(game, t, e.def.dps * (e.def.barricadeMult ?? 1));
      return;
    }
    case 'hero': {
      game.damageHero(e.def.dps);
      return;
    }
    case 'clamp':
      return;
    default: {
      const _exhaustive: never = h;
      return _exhaustive;
    }
  }
}

function freezePulse(game: Game, e: Enemy): void {
  game.addEffect({ kind: 'ring', pos: { ...e.pos }, radius: FREEZE_RADIUS, color: '#81d4fa', ttl: 0.7, max: 0.7 });
  for (const t of game.towers) {
    if (dist(t.pos, e.pos) > FREEZE_RADIUS) continue;
    if (towerHasFreezeProtection(game, t)) continue;
    if (game.consumeShield(t)) continue;
    t.frozen = Math.max(t.frozen, FREEZE_DURATION * game.freezeDurationMult);
    if (t.def.kind === 'barricade') releaseHeldBy(game, t);
  }
}

function bossVent(game: Game, boss: Enemy): void {
  game.addEffect({ kind: 'ring', pos: { ...boss.pos }, radius: BOSS_VENT_RADIUS, color: '#ffab91', ttl: 0.6, max: 0.6 });
  for (const t of game.towers) {
    if (t.def.kind !== 'barricade' || dist(t.rally, boss.pos) > BOSS_VENT_RADIUS) continue;
    if (game.consumeShield(t)) continue;
    damageBarricade(game, t, BOSS_VENT_DAMAGE);
  }
}
