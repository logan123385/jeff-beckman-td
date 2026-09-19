import { updateHeroAura, updateHeroZones } from './heroPowers';
import { dist } from '../core/vec';
import { PHASE_VISIBLE_SECONDS } from '../data/enemies';
import { BARRICADE_REBUILD_SECONDS, BARRICADE_REGEN_PER_SEC, MINERAL_ENEMIES } from '../data/towers';
import type { EnemyId } from '../data/types';
import { applyDamage, isTargetable, matchesTargetMode, pickTarget } from './combat';
import type { Game } from './game';
import type { Enemy, Tower } from './state';

export function releaseHeldBy(game: Game, tower: Tower): void {
  for (const e of game.enemies) {
    if (e.heldBy?.kind === 'tower' && e.heldBy.id === tower.id) e.heldBy = null;
  }
}

/** Reset per-frame aura state, then apply support / zone towers. */
export function updateAuras(game: Game, dt: number): void {
  game.buffs.clear();
  game.projSpeedMult = 1;
  game.jeffSpeedAura = 1;
  game.jeffCdAura = 1;
  for (const e of game.enemies) {
    e.slow = game.globalSlowTimer > 0 ? game.globalSlow : 0;
    e.marked = false;
    e.markBonus = 0;
    e.haste = 0;
  }

  updateHeroAura(game, dt);
  updateHeroZones(game, dt);

  // Buff pads first so zone tools and Jeff haste read this frame's auras.
  for (const t of game.towers) {
    if (t.frozen > 0) continue;
    applySupportAura(game, t);
  }
  for (const t of game.towers) {
    if (t.frozen > 0) continue;
    applyZoneAura(game, t, dt);
  }

  if (game.clamp) {
    for (const e of game.enemies) {
      if (!isTargetable(e) || e.def.flying || dist(e.pos, game.clamp.pos) > game.clampRadius() + e.def.radius) continue;
      e.slow = Math.max(e.slow, game.clampSlow());
    }
  }
}

function applySupportAura(game: Game, t: Tower): void {
  switch (t.def.id) {
    case 'expansion':
      applyExpansion(game, t);
      return;
    case 'circulator':
      applyCirculator(game, t);
      return;
    case 'thermostat':
      applyThermostat(game, t);
      return;
    case 'radiant':
    case 'boiler':
    case 'glycol':
    case 'backflow':
    case 'prv':
    case 'sump':
    case 'camera':
    case 'mixingValve':
    case 'airSeparator':
    case 'zoneValve':
    case 'torch':
    case 'washer':
    case 'apprentices': case 'jayjay': case 'cbjDoni':
    case 'barricade':
    case 'vent':
    case 'pipeSnake':
    case 'descaler':
    case 'hammerDrill':
    case 'manifold':
    case 'heatExchanger':
    case 'dirtSep':
    case 'steamTrap':
      return;
    default: {
      const _exhaustive: never = t.def.id;
      return _exhaustive;
    }
  }
}

function applyZoneAura(game: Game, t: Tower, dt: number): void {
  switch (t.def.id) {
    case 'radiant':
      applyHeatZone(game, t, dt, 'radiant');
      return;
    case 'boiler':
      applyHeatZone(game, t, dt, 'boiler');
      return;
    case 'glycol':
      applyGlycol(game, t, dt);
      return;
    case 'backflow':
      applyBackflow(game, t, dt);
      return;
    case 'prv':
      applyPrv(game, t, dt);
      return;
    case 'sump':
      applySump(game, t, dt);
      return;
    case 'camera':
      applyCamera(game, t);
      return;
    case 'mixingValve':
      applyMixingValve(game, t, dt);
      return;
    case 'airSeparator':
      applyAirSeparator(game, t, dt);
      return;
    case 'zoneValve':
      applyZoneValve(game, t, dt);
      return;
    case 'expansion':
    case 'circulator':
    case 'thermostat':
    case 'torch':
    case 'washer':
    case 'apprentices': case 'jayjay': case 'cbjDoni':
    case 'barricade':
    case 'vent':
    case 'pipeSnake':
    case 'descaler':
    case 'hammerDrill':
    case 'manifold':
    case 'heatExchanger':
    case 'dirtSep':
    case 'steamTrap':
      return;
    default: {
      const _exhaustive: never = t.def.id;
      return _exhaustive;
    }
  }
}

function applyExpansion(game: Game, t: Tower): void {
  const lvl = t.def.levels[t.level]!;
  const range = game.effectiveRange(t);
  for (const other of game.towers) {
    if (other.id === t.id || dist(other.pos, t.pos) > range) continue;
    const cur = game.buffs.get(other.id) ?? { dmg: 0, range: 0, rate: 0 };
    cur.dmg = Math.max(cur.dmg, lvl.dmgBuff ?? 0);
    cur.range = Math.max(cur.range, lvl.rangeBuff ?? 0);
    game.buffs.set(other.id, cur);
  }
}

function applyHeatZone(game: Game, t: Tower, dt: number, source: 'radiant' | 'boiler' | 'glycol' | 'mixingValve'): void {
  const lvl = t.def.levels[t.level]!;
  const range = game.effectiveRange(t);
  t.cooldown -= dt;
  const tick = t.cooldown <= 0;
  if (tick) t.cooldown += 1 / Math.max(0.2, lvl.fireRate);
  for (const e of game.enemies) {
    if (!isTargetable(e) || e.def.flying || dist(e.pos, t.pos) > range + e.def.radius) continue;
    e.slow = Math.max(e.slow, lvl.slow ?? 0);
    if (tick) {
      let dmg = game.effectiveDamage(t);
      if (source === 'glycol' && e.def.traits.includes('freezes')) dmg *= 1.8;
      applyDamage(game, e, dmg, 'heat', source === 'mixingValve' ? 'mixingValve' : source);
    }
  }
}

function applyGlycol(game: Game, t: Tower, dt: number): void {
  applyHeatZone(game, t, dt, 'glycol');
  const range = game.effectiveRange(t);
  for (const other of game.towers) {
    if (dist(other.pos, t.pos) > range) continue;
    other.frozen = Math.max(0, other.frozen - dt * 1.8);
  }
}

function applySump(game: Game, t: Tower, dt: number): void {
  const lvl = t.def.levels[t.level]!;
  const range = game.effectiveRange(t);
  t.cooldown -= dt;
  if (t.cooldown > 0) return;
  t.cooldown = 1 / Math.max(0.2, lvl.fireRate);
  const pull = lvl.pull ?? 0;
  let pulled = false;
  for (const e of game.enemies) {
    if (!isTargetable(e) || e.def.flying || dist(e.pos, t.pos) > range + e.def.radius) continue;
    const path = game.paths[e.pathIdx];
    if (!path) continue;
    const basin = path.nearestPoint(t.pos).progress;
    if (e.progress <= basin) continue;
    e.progress = Math.max(basin, e.progress - pull * Math.max(1, e.speedMult));
    e.heldBy = null;
    pulled = true;
  }
  if (pulled) {
    t.recoil = 0.16;
    game.addEffect({ kind: 'ring', pos: { ...t.pos }, radius: range, color: t.def.color, ttl: 0.22, max: 0.22 });
  }
}

function applyMixingValve(game: Game, t: Tower, dt: number): void {
  applyHeatZone(game, t, dt, 'mixingValve');
  const lvl = t.def.levels[t.level]!;
  const range = game.effectiveRange(t);
  for (const e of game.enemies) {
    if (!isTargetable(e) || e.def.flying || dist(e.pos, t.pos) > range + e.def.radius) continue;
    e.armorShred = Math.max(e.armorShred, lvl.shred ?? 0);
    e.shredTimer = Math.max(e.shredTimer, 1.2);
  }
  for (const other of game.towers) {
    if (dist(other.pos, t.pos) > range) continue;
    other.frozen = Math.max(0, other.frozen - dt * 1.4);
  }
}

function applyAirSeparator(game: Game, t: Tower, dt: number): void {
  const lvl = t.def.levels[t.level]!;
  const range = game.effectiveRange(t);
  t.cooldown -= dt;
  const tick = t.cooldown <= 0;
  if (tick) t.cooldown += 1 / Math.max(0.2, lvl.fireRate * (1 + (game.buffs.get(t.id)?.rate ?? 0)));
  for (const e of game.enemies) {
    if (e.dead || e.escaped || dist(e.pos, t.pos) > range + e.def.radius) continue;
    if (e.phased) {
      e.phased = false;
      e.phaseTimer = PHASE_VISIBLE_SECONDS;
    }
    if (e.def.flying) e.marked = true;
    if (tick && e.def.flying && isTargetable(e)) {
      applyDamage(game, e, game.effectiveDamage(t), t.def.damageType, t.def.id);
    }
  }
}

function applyThermostat(game: Game, t: Tower): void {
  const lvl = t.def.levels[t.level]!;
  const range = game.effectiveRange(t);
  for (const other of game.towers) {
    if (other.id === t.id || dist(other.pos, t.pos) > range) continue;
    const cur = game.buffs.get(other.id) ?? { dmg: 0, range: 0, rate: 0 };
    cur.rate = Math.max(cur.rate, lvl.rateBuff ?? 0);
    game.buffs.set(other.id, cur);
  }
}

function applyZoneValve(game: Game, t: Tower, dt: number): void {
  const lvl = t.def.levels[t.level]!;
  const range = game.effectiveRange(t);
  t.cooldown -= dt;
  if (t.cooldown > 0) return;
  t.cooldown = 1 / Math.max(0.15, lvl.fireRate * (1 + (game.buffs.get(t.id)?.rate ?? 0)));
  t.recoil = 0.2;
  game.addEffect({ kind: 'ring', pos: { ...t.pos }, radius: range, color: t.def.color, ttl: 0.28, max: 0.28 });
  for (const e of game.enemies) {
    if (!isTargetable(e) || e.def.flying || dist(e.pos, t.pos) > range + e.def.radius) continue;
    e.stun = Math.max(e.stun, 0.55 * game.mods.stunDuration);
    if (lvl.damage > 0) applyDamage(game, e, game.effectiveDamage(t), t.def.damageType, t.def.id);
  }
}

function applyCamera(game: Game, t: Tower): void {
  const range = game.effectiveRange(t);
  for (const e of game.enemies) {
    if (e.dead || e.escaped || dist(e.pos, t.pos) > range + e.def.radius) continue;
    e.marked = true;
    e.markBonus = Math.max(e.markBonus ?? 0, t.specialization === 'power' ? 0.38 : 0.2);
    if (e.phased) {
      e.phased = false;
      e.phaseTimer = PHASE_VISIBLE_SECONDS;
    }
  }
}

function applyCirculator(game: Game, t: Tower): void {
  const lvl = t.def.levels[t.level]!;
  const range = game.effectiveRange(t);
  game.projSpeedMult = Math.max(game.projSpeedMult, lvl.projSpeed ?? 1);
  if (dist(game.hero.pos, t.pos) <= range) {
    game.jeffSpeedAura = Math.max(game.jeffSpeedAura, lvl.jeffHaste ?? 1);
    game.jeffCdAura = Math.max(game.jeffCdAura, lvl.jeffHaste ?? 1);
  }
}

function applyBackflow(game: Game, t: Tower, dt: number): void {
  const lvl = t.def.levels[t.level]!;
  const range = game.effectiveRange(t);
  t.cooldown -= dt;
  if (t.cooldown > 0) return;
  t.cooldown = 1 / Math.max(0.2, lvl.fireRate);
  const push = lvl.push ?? 0;
  let shoved = false;
  for (const e of game.enemies) {
    if (!isTargetable(e) || e.def.flying || dist(e.pos, t.pos) > range + e.def.radius) continue;
    e.progress = Math.max(0, e.progress - push * Math.max(1, e.speedMult));
    e.heldBy = null;
    shoved = true;
  }
  if (shoved) {
    t.recoil = 0.18;
    game.addEffect({ kind: 'ring', pos: { ...t.pos }, radius: range, color: t.def.color, ttl: 0.25, max: 0.25 });
  }
}

function applyPrv(game: Game, t: Tower, dt: number): void {
  const lvl = t.def.levels[t.level]!;
  const range = game.effectiveRange(t);
  let traffic = 0;
  for (const e of game.enemies) {
    if (!isTargetable(e) || dist(e.pos, t.pos) > range + e.def.radius) continue;
    traffic += e.def.traits.includes('damagesBarricades') ? 2 : 1;
  }
  t.charge += traffic * dt;
  const need = lvl.chargeNeed ?? 8;
  if (t.charge < need) return;
  t.charge = 0;
  t.recoil = 0.25;
  const burst = lvl.burstRadius ?? range;
  game.addEffect({ kind: 'splash', pos: { ...t.pos }, radius: burst, color: t.def.color, ttl: 0.35, max: 0.35 });
  game.addEffect({ kind: 'text', pos: { x: t.pos.x, y: t.pos.y - 28 }, text: 'RELIEF', color: t.def.color, ttl: 0.7, max: 0.7 });
  for (const e of game.enemies) {
    if (!isTargetable(e) || dist(e.pos, t.pos) > burst + e.def.radius) continue;
    applyDamage(game, e, game.effectiveDamage(t), t.def.damageType, 'prv');
  }
}

export function updateTowers(game: Game, dt: number): void {
  for (const t of game.towers) {
    if (t.frozen > 0) t.frozen -= dt;
    if (t.shieldCooldown > 0) t.shieldCooldown -= dt;
    if (t.recoil > 0) t.recoil -= dt;
    updateElite(game, t, dt);
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

function updateElite(game: Game, t: Tower, dt: number): void {
  if (t.specialization !== 'control' || t.frozen > 0 || t.rebuild > 0) return;
  if (t.def.kind === 'barricade') {
    t.hp = Math.min(t.maxHp, t.hp + 8 * dt);
    for (const f of game.friendlies) if (f.respawn <= 0 && dist(f.pos, t.rally) < 90) f.hp = Math.min(f.maxHp, f.hp + 8 * dt);
    if (game.heroEnabled && game.hero.downed <= 0 && dist(game.hero.pos, t.rally) < 90) game.hero.hp = Math.min(game.hero.maxHp, game.hero.hp + 8 * dt);
    return;
  }
  t.eliteCooldown = Math.max(0, (t.eliteCooldown ?? 0) - dt);
  if (t.eliteCooldown > 0) return;
  const targets = game.enemies.filter(e => isTargetable(e) && matchesTargetMode(t.def.targets, e) && dist(e.pos, t.pos) <= game.effectiveRange(t) + e.def.radius)
    .sort((a, b) => b.progress - a.progress).slice(0, 3);
  if (targets.length === 0) return;
  t.eliteCooldown = 7;
  for (const e of targets) {
    e.stun = Math.max(e.stun, e.def.traits.includes('boss') ? 0.35 : 1);
    e.armorShred = Math.max(e.armorShred, 0.2); e.shredTimer = Math.max(e.shredTimer, 3);
    game.addEffect({ kind: 'beam', from: { ...t.pos }, to: { ...e.pos }, color: '#9af5db', ttl: 0.28, max: 0.28 });
    game.addEffect({ kind: 'ring', pos: { ...e.pos }, radius: 22, color: '#bbffe4', ttl: 0.4, max: 0.4 });
  }
}

function updateShooter(game: Game, t: Tower, dt: number): void {
  if ((t.windup ?? 0) > 0) {
    t.windup = Math.max(0, t.windup! - dt);
    if (t.windup === 0) fireShooter(game, t, 0);
    return;
  }
  t.cooldown -= dt;
  if (t.cooldown > 0) return;
  const target = pickTarget(game, t, game.effectiveRange(t));
  if (!target && t.def.id !== 'pipeSnake') return;
  if (target) t.facing = Math.atan2(target.pos.y - t.pos.y, target.pos.x - t.pos.x);
  t.windup = 0.16;
}

function fireShooter(game: Game, t: Tower, dt: number): void {
  t.cooldown -= dt;
  if (t.cooldown > 0) return;
  const lvl = t.def.levels[t.level]!;
  if (t.def.id === 'pipeSnake') {
    const { pathIdx, progress } = game.nearestPath(t.pos);
    const pierce = lvl.pierce ?? 160;
    const any = game.enemies.some(
      (e) => isTargetable(e) && e.pathIdx === pathIdx && e.progress >= progress - 12 && e.progress <= progress + pierce,
    );
    if (!any) {
      t.cooldown = 0;
      return;
    }
    t.cooldown = Math.max(0.05, 1 / (lvl.fireRate * (1 + (game.buffs.get(t.id)?.rate ?? 0))) - 0.16);
    t.recoil = 0.28;
    firePipeSnake(game, t);
    return;
  }
  const range = game.effectiveRange(t);
  const target = pickTarget(game, t, range);
  if (!target) {
    t.cooldown = 0;
    return;
  }
  const rate = lvl.fireRate * (1 + (game.buffs.get(t.id)?.rate ?? 0));
  t.cooldown = Math.max(0.05, 1 / Math.max(0.2, rate) - 0.16);
  t.facing = Math.atan2(target.pos.y - t.pos.y, target.pos.x - t.pos.x);
  t.recoil = 0.28;
  const damage = game.effectiveDamage(t);
  if (t.def.projectileSpeed === undefined) {
    applyDamage(game, target, damage, t.def.damageType, t.def.id, { groundMult: t.def.groundMult });
    game.addEffect({ kind: 'beam', from: { ...t.pos }, to: { ...target.pos }, color: t.def.color, ttl: 0.1, max: 0.1 });
    game.addEffect({ kind: 'hit', pos: { ...target.pos }, color: t.def.color, ttl: 0.18, max: 0.18 });
    if (t.def.id === 'manifold') fireManifoldExtras(game, t, target, damage);
    if (t.def.id === 'heatExchanger') fireHeatJump(game, t, target, damage);
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
    shred: lvl.shred,
    dot: lvl.dot,
    dotTime: lvl.dotTime,
  });
}

function fireManifoldExtras(game: Game, t: Tower, primary: Enemy, damage: number): void {
  const range = game.effectiveRange(t);
  const extras = game.enemies
    .filter((e) => e.id !== primary.id && isTargetable(e) && dist(e.pos, t.pos) <= range + e.def.radius)
    .sort((a, b) => dist(a.pos, primary.pos) - dist(b.pos, primary.pos))
    .slice(0, 2);
  for (const e of extras) {
    applyDamage(game, e, damage * 0.62, t.def.damageType, t.def.id, { groundMult: t.def.groundMult });
    game.addEffect({ kind: 'beam', from: { ...primary.pos }, to: { ...e.pos }, color: t.def.color, ttl: 0.1, max: 0.1 });
  }
}

function fireHeatJump(game: Game, t: Tower, primary: Enemy, damage: number): void {
  let best: Enemy | null = null;
  let bestD = 78;
  for (const e of game.enemies) {
    if (e.id === primary.id || !isTargetable(e)) continue;
    const d = dist(e.pos, primary.pos);
    if (d < bestD) {
      bestD = d;
      best = e;
    }
  }
  if (!best) return;
  applyDamage(game, best, damage * 0.7, t.def.damageType, t.def.id, { groundMult: t.def.groundMult });
  game.addEffect({ kind: 'beam', from: { ...primary.pos }, to: { ...best.pos }, color: t.def.color, ttl: 0.12, max: 0.12 });
}

function firePipeSnake(game: Game, t: Tower): void {
  const lvl = t.def.levels[t.level]!;
  const pierce = lvl.pierce ?? 160;
  const { pathIdx, progress } = game.nearestPath(t.pos);
  const path = game.paths[pathIdx]!;
  const damage = game.effectiveDamage(t);
  game.addEffect({
    kind: 'beam',
    from: path.pointAt(progress),
    to: path.pointAt(Math.min(path.length, progress + pierce)),
    color: t.def.color,
    ttl: 0.12,
    max: 0.12,
  });
  for (const e of game.enemies) {
    if (!isTargetable(e) || e.pathIdx !== pathIdx) continue;
    if (e.progress < progress - 12 || e.progress > progress + pierce) continue;
    applyDamage(game, e, damage, t.def.damageType, 'pipeSnake');
  }
}

export function applyDescaler(e: Enemy, shred: number, dot: number, dotTime: number): void {
  const mineral = (MINERAL_ENEMIES as readonly EnemyId[]).includes(e.def.id);
  const shredAmt = shred * (mineral ? 1.4 : 1);
  e.armorShred = Math.max(e.armorShred, shredAmt);
  e.shredTimer = Math.max(e.shredTimer, 4);
  const dps = dot * (mineral ? 1.5 : 1);
  if (dps >= e.dotDps) {
    e.dotDps = dps;
    e.dotTime = dotTime;
    e.dotSource = 'descaler';
  }
}

function updateBarricade(game: Game, t: Tower, dt: number): void {
  if (t.rebuild > 0) {
    t.rebuild -= dt;
    t.hp = t.maxHp * (1 - Math.max(0, t.rebuild) / BARRICADE_REBUILD_SECONDS);
    if (t.rebuild <= 0) t.hp = t.maxHp;
    return;
  }
  if (t.def.recruits) return;
  const lvl = t.def.levels[t.level]!;
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
    t.cooldown = Math.max(0.05, 1 / (lvl.fireRate * (1 + (game.buffs.get(t.id)?.rate ?? 0))));
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
  if (t.def.id === 'radiant' || t.def.id === 'boiler' || t.def.id === 'glycol' || t.def.id === 'heatExchanger' || t.def.id === 'mixingValve') return true;
  for (const r of game.towers) {
    if ((r.def.id === 'radiant' || r.def.id === 'boiler' || r.def.id === 'glycol' || r.def.id === 'heatExchanger' || r.def.id === 'mixingValve') && dist(r.pos, t.pos) <= game.effectiveRange(r)) return true;
  }
  return false;
}
