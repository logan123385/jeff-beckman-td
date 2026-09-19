import { dist, moveToward, type Vec } from '../core/vec';
import { COOLDOWN_FIELDS, type AbilitySlot } from '../data/heroes';
import { applyDamage, isTargetable } from './combat';
import type { Game } from './game';
import type { Enemy, HeroMissile, HeroVisual, HeroZone } from './state';

export function friendlyDamageBuff(game: Game, pos: Vec): number {
  return game.heroEnabled && game.hero.downed <= 0 && game.heroDef.id === 'becbec' && dist(game.hero.pos, pos) <= game.heroDef.aura.radius ? 1.2 : 1;
}

export function friendlyMitigation(game: Game, pos: Vec): number {
  return game.heroEnabled && game.hero.downed <= 0 && game.heroDef.id === 'jeff' && dist(game.hero.pos, pos) <= game.heroDef.aura.radius ? .85 : 1;
}

/** Runs after tower aura reset and before any attacks, so buffs never linger after leaving range. */
export function updateHeroAura(game: Game, dt: number): void {
  const h = game.hero, def = game.heroDef;
  if (!game.heroEnabled || h.downed > 0) return;
  const nearby = (p: Vec) => dist(h.pos, p) <= def.aura.radius;
  switch (def.id) {
    case 'jeff':
      for (const f of game.friendlies) if (f.hp > 0 && f.respawn <= 0 && nearby(f.pos)) f.hp = Math.min(f.maxHp, f.hp + f.maxHp * .02 * dt);
      for (const c of game.crew) if (c.hp > 0 && nearby(c.pos)) c.hp = Math.min(c.maxHp, c.hp + c.maxHp * .02 * dt);
      break;
    case 'mike':
      for (const t of game.towers) if (nearby(t.pos)) {
        const buff = game.buffs.get(t.id) ?? { dmg: 0, range: 0, rate: 0 };
        game.buffs.set(t.id, { ...buff, range: buff.range + .08, rate: buff.rate + .12 });
      }
      break;
    case 'bob':
      for (const e of game.enemies) if (!e.dead && !e.escaped && nearby(e.pos)) {
        e.phased = false; e.revealTimer = Math.max(e.revealTimer ?? 0, .15);
        if (e.def.flying) e.slow = Math.max(e.slow, .2);
      }
      break;
    case 'becbec': break; // Applied at each NPC's actual strike position.
    case 'chris':
      for (const e of game.enemies) if (isTargetable(e) && !e.def.flying && nearby(e.pos)) {
        e.slow = Math.max(e.slow, .15);
        applyDamage(game, e, 4 * game.mods.jeffDamage * dt, 'heat', 'jeff');
      }
      break;
  }
}

function targets(game: Game, radius: number, center = game.hero.pos): Enemy[] {
  const ordered = game.hero.orderTargetId;
  return game.enemies.filter(e => isTargetable(e) && dist(e.pos, center) <= radius + e.def.radius)
    .sort((a, b) => a.id === ordered ? -1 : b.id === ordered ? 1 : dist(a.pos, center) - dist(b.pos, center));
}

export function useHeroAbility(game: Game, slot: AbilitySlot): boolean {
  const h = game.hero, ability = game.heroDef.abilities[slot];
  if (!game.heroEnabled || game.status !== 'playing' || h.downed > 0 || h.cast || h[COOLDOWN_FIELDS[slot]] > 0) return false;
  const radius = game.heroDef.id === 'becbec' ? 75 : game.heroDef.id === 'bob' && slot === 0 ? 300 : 280;
  const prey = targets(game, radius).find(e => game.heroDef.id !== 'becbec' || !e.def.flying);
  if (ability.target && !prey) return false;
  h[COOLDOWN_FIELDS[slot]] = ability.cooldown * game.mods.cooldown / game.jeffCdAura;
  h.pendingStrike = undefined; h.swing = 0; h.dest = null;
  if (prey && ability.target) h.facing = prey.pos.x >= h.pos.x ? 1 : -1;
  h.cast = { slot, left: ability.cast, duration: ability.cast, fired: false, target: { ...(prey?.pos ?? h.pos) }, targetId: prey?.id, hits: 0 };
  h.castTimer = ability.cast;
  game.heroNotice = { name: ability.name, detail: ability.short, color: game.heroDef.color, left: ability.cast + 1.6 };
  return true;
}

export function advanceHeroCast(game: Game, dt: number): boolean {
  const h = game.hero, cast = h.cast;
  if (!cast) return false;
  cast.left = Math.max(0, cast.left - dt); h.castTimer = cast.left;
  const phase = 1 - cast.left / cast.duration;
  // The three saw contacts have their own visible swing; other casts release at frame five.
  if (game.heroDef.id === 'chris' && cast.slot === 2) {
    const contacts = [.16, .493333, .826667];
    while (cast.hits < contacts.length && phase >= contacts[cast.hits]!) {
      cast.hits++; cast.fired = true;
      for (const e of targets(game, 82).filter(e => !e.def.flying)) {
        e.armorShred = Math.max(e.armorShred, .35); e.shredTimer = Math.max(e.shredTimer, 4);
        applyDamage(game, e, 30 * game.mods.jeffDamage, 'physical', 'jeff');
      }
      visual(game, 'saw', h.pos, cast.target, 82, '#ffcd78', .3);
    }
  } else if (game.heroDef.id === 'becbec' && cast.slot === 4) {
    const contacts = [.096, .296, .496, .696, .896];
    while (cast.hits < contacts.length && phase >= contacts[cast.hits]!) {
      cast.hits++; cast.fired = true;
      for (const e of targets(game, 68).filter(e => !e.def.flying)) {
        applyDamage(game, e, 35 * game.mods.jeffDamage, 'physical', 'jeff');
        if (cast.hits === 5) e.stun = Math.max(e.stun, 1 * game.mods.stunDuration);
      }
      visual(game, 'punch', h.pos, cast.target, 55, game.heroDef.color, .25);
    }
  } else if (!cast.fired && phase >= .48) {
    cast.fired = true; resolveAbility(game, cast.slot, cast.target, cast.targetId);
  }
  if (cast.left <= 0) { h.cast = undefined; h.castTimer = 0; }
  return true;
}

function visual(game: Game, kind: HeroVisual['kind'], from: Vec, to: Vec, radius: number, color: string, duration: number): void {
  if (game.heroVisuals.length >= 100) return;
  game.heroVisuals.push({ kind, from: { ...from }, to: { ...to }, radius, color, left: duration, duration });
}
function zone(game: Game, kind: HeroZone['kind'], pos: Vec, radius: number, duration: number, targetIds?: number[]): void {
  game.heroZones.push({ id: game.nextEntityId(), kind, pos: { ...pos }, radius, left: duration, duration, tick: 0, ticks: 0, targetIds });
}
export function fireHeroMissile(game: Game, kind: HeroMissile['kind'], goal: Vec, damage: number, targetId?: number, splash = 0, bounces = 0, from?: Vec): void {
  const origin = from ?? (kind === 'golf'
    ? { x: game.hero.pos.x + game.hero.facing * 26, y: game.hero.pos.y + 8 }
    : { x: game.hero.pos.x + game.hero.facing * (game.heroDef.id === 'mike' ? 32 : 18), y: game.hero.pos.y - (game.heroDef.id === 'mike' ? 53 : 20) });
  game.heroMissiles.push({ id: game.nextEntityId(), kind, from: { ...origin }, pos: { ...origin }, goal: { ...goal },
    targetId, age: 0, duration: Math.max(.18, dist(origin, goal) / (kind === 'golf' ? 470 : 325)), damage: damage * game.mods.jeffDamage, splash, bounces, hitIds: [] });
}

function resolveAbility(game: Game, slot: AbilitySlot, point: Vec, targetId?: number): void {
  const h = game.hero, def = game.heroDef;
  const prey = game.enemies.find(e => e.id === targetId && isTargetable(e)) ?? targets(game, 280)[0];
  if (def.id === 'mike') switch (slot) {
    case 0: {
      const pool = targets(game, 280);
      for (let i = 0; i < 3; i++) {
        const e = pool[i % Math.max(1, pool.length)];
        fireHeroMissile(game, 'plunger', e?.pos ?? point, 52, e?.id, 30, 0, { x: h.pos.x + h.facing * (30 + i * 4), y: h.pos.y - 54 - i * 7 });
      }
      break;
    }
    case 1:
      for (const e of targets(game, 130).filter(e => !e.def.flying)) {
        applyDamage(game, e, 48 * game.mods.jeffDamage, 'physical', 'jeff');
        e.stun = Math.max(e.stun, .9 * game.mods.stunDuration);
        e.progress = Math.max(0, e.progress - (e.def.traits.includes('boss') ? 12 : 60));
        e.heldBy = null;
      }
      visual(game, 'horn', h.pos, h.pos, 130, def.color, 1); break;
    case 2: zone(game, 'supply', h.pos, 100, 8); visual(game, 'buff', h.pos, h.pos, 60, '#f5db9e', .8); break;
    case 3: h.overdrive = 8; visual(game, 'buff', h.pos, h.pos, 50, def.color, .7); break;
    case 4: zone(game, 'rain', point, 90, 4.5); break;
  }
  if (def.id === 'bob') switch (slot) {
    case 0: {
      const aim = prey?.pos ?? point, length = dist(h.pos, aim) || 1;
      const dir = { x: (aim.x - h.pos.x) / length, y: (aim.y - h.pos.y) / length };
      const end = { x: h.pos.x + dir.x * 420, y: h.pos.y + dir.y * 420 };
      for (const e of game.enemies) {
        if (!isTargetable(e)) continue;
        const dx = e.pos.x - h.pos.x, dy = e.pos.y - h.pos.y, along = dx * dir.x + dy * dir.y;
        if (along >= -e.def.radius && along <= 420 + e.def.radius && Math.abs(dx * dir.y - dy * dir.x) <= 18 + e.def.radius) {
          applyDamage(game, e, 140 * game.mods.jeffDamage, 'heat', 'jeff');
          e.armorShred = Math.max(e.armorShred, .35); e.shredTimer = Math.max(e.shredTimer, 5);
        }
      }
      visual(game, 'laser', { x: h.pos.x + h.facing * 20, y: h.pos.y - 25 }, end, 22, '#ff826c', .65); break;
    }
    case 1: h.hp = Math.min(h.maxHp, h.hp + 130); h.shield = 8; visual(game, 'buff', h.pos, h.pos, 50, def.color, .9); break;
    case 2:
      for (const e of game.enemies) if (!e.dead && !e.escaped && dist(e.pos, h.pos) <= 145 + e.def.radius) {
        e.phased = false; e.revealTimer = 3; e.stun = Math.max(e.stun, 2.5 * game.mods.stunDuration);
        applyDamage(game, e, 40 * game.mods.jeffDamage, 'heat', 'jeff');
      }
      visual(game, 'emp', h.pos, h.pos, 145, def.color, 1); break;
    case 3: h.overdrive = 8; visual(game, 'buff', h.pos, h.pos, 50, def.color, .7); break;
    case 4: {
      const ids = targets(game, 280).sort((a, b) => b.maxHp - a.maxHp).slice(0, 3).map(e => e.id);
      zone(game, 'review', h.pos, 280, 9, ids); visual(game, 'emp', h.pos, h.pos, 120, '#ffab92', .7); break;
    }
  }
  if (def.id === 'becbec') switch (slot) {
    case 0: {
      const victim = targets(game, 75).find(e => !e.def.flying);
      if (victim) {
        victim.armorShred = Math.max(victim.armorShred, .45); victim.shredTimer = Math.max(victim.shredTimer, 5);
        applyDamage(game, victim, 110 * game.mods.jeffDamage, 'physical', 'jeff');
        victim.stun = Math.max(victim.stun, 1.8 * game.mods.stunDuration);
        visual(game, 'punch', h.pos, victim.pos, 58, def.color, .5);
      }
      break;
    }
    case 1:
      for (const e of targets(game, 105).filter(e => !e.def.flying)) {
        applyDamage(game, e, 65 * game.mods.jeffDamage, 'physical', 'jeff'); e.stun = Math.max(e.stun, 1.2 * game.mods.stunDuration);
      }
      visual(game, 'slam', h.pos, h.pos, 105, def.color, 1); break;
    case 2: h.taunt = 7; h.shield = Math.max(h.shield ?? 0, 7); visual(game, 'buff', h.pos, h.pos, 70, def.color, .8); break;
    case 3: h.hp = Math.min(h.maxHp, h.hp + 160); h.shield = Math.max(h.shield ?? 0, 6); visual(game, 'buff', h.pos, h.pos, 55, def.color, .8); break;
    case 4: break;
  }
  if (def.id === 'chris') switch (slot) {
    case 0: {
      // A second summon replaces the previous one cleanly, including its enemy hold.
      for (const old of game.heroSummons) releaseSummon(game, old.id);
      game.heroSummons = [{ id: game.nextEntityId(), pos: { x: h.pos.x + h.facing * 22, y: h.pos.y + 8 }, hp: 230, maxHp: 230,
        left: 18, duration: 18, facing: h.facing, walkPhase: 0, moving: false, moveBlend: 0, swing: 0, attackTimer: 0 }];
      visual(game, 'summon', h.pos, h.pos, 45, '#d4e599', .8); break;
    }
    case 1: fireHeroMissile(game, 'golf', prey?.pos ?? point, 70, prey?.id, 0, 2);
      visual(game, 'golf', h.pos, point, 45, '#fff4c7', .45); break;
    case 2: break; // Timed three-hit combo is resolved by advanceHeroCast.
    case 3: zone(game, 'gas', h.pos, 110, 7); break;
    case 4: h.hp = Math.min(h.maxHp, h.hp + 100); h.overdrive = 8; h.lifesteal = 8;
      visual(game, 'buff', h.pos, h.pos, 50, def.color, .8); break;
  }
}

export function heroAttackSpeed(game: Game): number {
  if ((game.hero.overdrive ?? 0) <= 0) return 1;
  return game.heroDef.id === 'bob' ? 1.65 : game.heroDef.id === 'mike' ? 1.5 : 1.3;
}

export function strikeNewHero(game: Game, enemy: Enemy): void {
  const h = game.hero, def = game.heroDef;
  if (def.id === 'mike') fireHeroMissile(game, 'plunger', enemy.pos, def.damage, enemy.id);
  else if (def.id === 'bob') {
    applyDamage(game, enemy, def.damage * game.mods.jeffDamage, 'heat', 'jeff');
    visual(game, 'laser', { x: h.pos.x + h.facing * 18, y: h.pos.y - 25 }, { x: enemy.pos.x, y: enemy.pos.y - 10 }, 4, def.color, .22);
  } else if (def.id === 'becbec') {
    h.tapCount++;
    applyDamage(game, enemy, def.damage * game.mods.jeffDamage, 'physical', 'jeff');
    if (h.tapCount % 3 === 0) enemy.stun = Math.max(enemy.stun, .35 * game.mods.stunDuration);
    visual(game, 'punch', h.pos, enemy.pos, 30, def.color, .22);
  } else if (def.id === 'chris') {
    enemy.armorShred = Math.max(enemy.armorShred, .12); enemy.shredTimer = Math.max(enemy.shredTimer, 2);
    const dealt = applyDamage(game, enemy, def.damage * game.mods.jeffDamage, 'physical', 'jeff');
    if ((h.lifesteal ?? 0) > 0) h.hp = Math.min(h.maxHp, h.hp + dealt * .45);
    visual(game, 'saw', h.pos, enemy.pos, 32, '#ffcc84', .2);
  }
}

export function updateHeroZones(game: Game, dt: number): void {
  for (const z of game.heroZones) {
    const elapsed = Math.min(dt, z.left); z.left -= dt;
    if (z.kind === 'supply') {
      const h = game.hero;
      if (h.downed <= 0 && dist(h.pos, z.pos) <= z.radius) h.hp = Math.min(h.maxHp, h.hp + 18 * elapsed);
      for (const f of [...game.friendlies, ...game.crew, ...game.heroSummons]) if (f.hp > 0 && dist(f.pos, z.pos) <= z.radius) f.hp = Math.min(f.maxHp, f.hp + 18 * elapsed);
      for (const t of game.towers) if (t.def.kind === 'barricade' && t.rebuild <= 0 && dist(t.pos, z.pos) <= z.radius) t.hp = Math.min(t.maxHp, t.hp + 30 * elapsed);
    } else if (z.kind === 'gas') {
      for (const e of targets(game, z.radius, z.pos).filter(e => !e.def.flying)) {
        e.slow = Math.max(e.slow, .4); applyDamage(game, e, 12 * game.mods.jeffDamage * elapsed, 'heat', 'jeff');
      }
    } else if (z.kind === 'rain') {
      z.tick -= elapsed;
      while (z.tick <= 0 && z.ticks < 9) {
        const angle = z.ticks * 2.4, radius = z.ticks % 3 === 0 ? 0 : 45;
        const point = { x: z.pos.x + Math.cos(angle) * radius, y: z.pos.y + Math.sin(angle) * radius };
        fireHeroMissile(game, 'plunger', point, 32, undefined, 48, 0, { x: point.x - 40, y: point.y - 220 });
        z.tick += .5; z.ticks++;
      }
    } else {
      for (const e of game.enemies) if (z.targetIds?.includes(e.id) && isTargetable(e)) { e.marked = true; e.markBonus = Math.max(e.markBonus ?? 0, .3); }
    }
  }
  game.heroZones = game.heroZones.filter(z => z.left > 0);
}

export function updateHeroMissiles(game: Game, dt: number): void {
  const keep: HeroMissile[] = [];
  for (const p of game.heroMissiles) {
    p.age += dt;
    const target = game.enemies.find(e => e.id === p.targetId && isTargetable(e));
    if (target) p.goal = { x: target.pos.x, y: target.pos.y - (target.def.flying ? 12 : 0) };
    const phase = Math.min(1, p.age / p.duration);
    p.pos = { x: p.from.x + (p.goal.x - p.from.x) * phase, y: p.from.y + (p.goal.y - p.from.y) * phase };
    if (phase < 1) { keep.push(p); continue; }
    if (p.splash > 0) for (const e of targets(game, p.splash, p.goal)) applyDamage(game, e, p.damage, 'physical', 'jeff');
    else if (target) applyDamage(game, target, p.damage, 'physical', 'jeff');
    game.addEffect({ kind: 'hit', pos: { ...p.goal }, color: p.kind === 'golf' ? '#fffde7' : '#e1a886', ttl: .24, max: .24 });
    if (p.splash > 0) game.addEffect({ kind: 'ring', pos: { ...p.goal }, radius: p.splash, color: '#eab982', ttl: .35, max: .35 });
    if (p.targetId !== undefined) p.hitIds.push(p.targetId);
    const next = p.bounces > 0 ? targets(game, 135, p.goal).find(e => !p.hitIds.includes(e.id)) : undefined;
    if (next) {
      p.bounces--; p.damage *= .7; p.from = { ...p.goal }; p.goal = { ...next.pos }; p.targetId = next.id;
      p.age = 0; p.duration = Math.max(.16, dist(p.from, p.goal) / 470); keep.push(p);
    }
  }
  game.heroMissiles = keep;
}

export function releaseSummon(game: Game, id: number): void {
  for (const e of game.enemies) if (e.heldBy?.kind === 'summon' && e.heldBy.id === id) { e.heldBy = null; e.attackSwing = 0; }
}
export function updateHeroSummons(game: Game, dt: number): void {
  for (const s of game.heroSummons) {
    s.left -= dt; s.attackTimer -= dt; s.moveBlend = Math.max(0, Math.min(1, s.moveBlend + (s.moving ? 1 : -1) * dt * 12)); s.moving = false;
    if (s.hp <= 0 || s.left <= 0) { releaseSummon(game, s.id); continue; }
    if (s.swing > 0) {
      s.swing = Math.max(0, s.swing - dt);
      if (s.pendingTarget !== undefined && s.swing <= .46 * .52) {
        const e = game.enemies.find(e => e.id === s.pendingTarget && isTargetable(e)); s.pendingTarget = undefined;
        if (e && dist(e.pos, s.pos) <= 30 + e.def.radius) {
          applyDamage(game, e, 14 * game.mods.jeffDamage * friendlyDamageBuff(game, s.pos), 'physical', 'jeff');
          game.addEffect({ kind: 'hit', pos: { x: e.pos.x, y: e.pos.y - 8 }, color: '#d2e397', ttl: .16, max: .16 });
        }
      }
      continue;
    }
    const held = game.enemies.find(e => isTargetable(e) && e.heldBy?.kind === 'summon' && e.heldBy.id === s.id);
    const prey = held ?? targets(game, 205).filter(e => !e.def.flying).sort((a, b) => dist(a.pos, s.pos) - dist(b.pos, s.pos))[0];
    s.targetId = prey?.id;
    const goal = prey?.pos ?? { x: game.hero.pos.x - game.hero.facing * 25, y: game.hero.pos.y + 14 };
    if (dist(s.pos, goal) > (prey ? 23 + prey.def.radius : 6)) {
      const step = moveToward(s.pos, goal, 215 * dt);
      s.facing = goal.x >= s.pos.x ? 1 : -1; s.walkPhase += dist(s.pos, step.pos) * .22;
      s.pos = step.pos; s.moving = true;
    } else if (prey) {
      if (!held && !prey.heldBy) prey.heldBy = { kind: 'summon', id: s.id };
      if (s.attackTimer <= 0) { s.swing = .46; s.attackTimer = .49; s.pendingTarget = prey.id; s.facing = prey.pos.x >= s.pos.x ? 1 : -1; }
    }
  }
  game.heroSummons = game.heroSummons.filter(s => s.hp > 0 && s.left > 0);
}
