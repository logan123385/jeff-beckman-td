import { kitSummonDamageMult, onKitHit, prepareKitStrike } from './kitCards';
import { dist, moveToward, type Vec } from '../core/vec';
import { COOLDOWN_FIELDS, type AbilitySlot } from '../data/heroes';
import { JEFF } from '../data/jeff';
import { applyDamage, abilityPower, abilityRangeFactor, abilityRank, heroOnYard, isTargetable, scaledAbilityCooldown, scaledCastRange, heroAbilityHitsAir } from './combat';
import type { Game } from './game';
import type { Enemy, HeroMissile, HeroVisual, HeroZone } from './state';

export function friendlyDamageBuff(game: Game, pos: Vec): number {
  return heroOnYard(game) && game.heroDef.id === 'becbec' && dist(game.hero.pos, pos) <= game.heroDef.aura.radius ? 1.2 : 1;
}

export function friendlyMitigation(game: Game, pos: Vec): number {
  if (!heroOnYard(game) || dist(game.hero.pos, pos) > game.heroDef.aura.radius) return 1;
  return game.heroDef.id === 'jeff' ? .85 : game.heroDef.id === 'jayjay' ? .8 : 1;
}

/** Runs after tower aura reset and before any attacks, so buffs never linger after leaving range. */
export function updateHeroAura(game: Game, dt: number): void {
  const h = game.hero, def = game.heroDef;
  if (!heroOnYard(game)) return;
  const nearby = (p: Vec) => dist(h.pos, p) <= def.aura.radius;
  switch (def.id) {
    case 'jeff':
      for (const f of game.friendlies) if (f.hp > 0 && f.respawn <= 0 && nearby(f.pos)) f.hp = Math.min(f.maxHp, f.hp + f.maxHp * .02 * dt);
      for (const c of game.crew) if (c.hp > 0 && nearby(c.pos)) c.hp = Math.min(c.maxHp, c.hp + c.maxHp * .02 * dt);
      for (const s of game.heroSummons) if (s.hp > 0 && nearby(s.pos)) s.hp = Math.min(s.maxHp, s.hp + s.maxHp * .02 * dt);
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
    case 'cbj':
      for (const t of game.towers) if (nearby(t.pos)) {
        const buff = game.buffs.get(t.id) ?? { dmg: 0, range: 0, rate: 0 };
        game.buffs.set(t.id, { ...buff, dmg: buff.dmg + .1 });
      }
      for (const f of [...game.friendlies, ...game.crew, ...game.heroSummons]) if (f.hp > 0 && nearby(f.pos)) f.hp = Math.min(f.maxHp, f.hp + 6 * dt);
      break;
    case 'doni':
      for (const e of game.enemies) if (isTargetable(e) && !e.def.flying && nearby(e.pos)) {
        e.slow = Math.max(e.slow, .12); e.marked = true; e.markBonus = Math.max(e.markBonus ?? 0, .1);
      }
      break;
    case 'jayjay':
      for (const e of game.enemies) if (isTargetable(e) && !e.def.flying && nearby(e.pos)) e.auraArmorShred = .15;
      break;
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

export function useHeroAbility(game: Game, slot: AbilitySlot, aim?: { pos: Vec; enemyId?: number }): boolean {
  const h = game.hero, ability = game.heroDef.abilities[slot];
  if (!heroOnYard(game) || game.status !== 'playing' || h.cast || h[COOLDOWN_FIELDS[slot]] > 0) return false;
  const castRange = scaledCastRange(game, slot);
  let prey: Enemy | undefined;
  let point = { ...h.pos };
  if (ability.target) {
    if (!aim) return false;
    point = { ...aim.pos };
    if (ability.aim === 'enemy') {
      prey = game.enemies.find(e => e.id === aim.enemyId && isTargetable(e));
      if (!prey || (prey.def.flying && !heroAbilityHitsAir(game, slot))) return false;
      point = { ...prey.pos };
    }
    if (dist(h.pos, point) > castRange + (prey?.def.radius ?? 8)) return false;
  } else {
    prey = targets(game, castRange).find(e => !['becbec', 'jayjay'].includes(game.heroDef.id) || !e.def.flying);
    if (prey) point = { ...prey.pos };
  }
  h[COOLDOWN_FIELDS[slot]] = scaledAbilityCooldown(game, slot);
  h.pendingStrike = undefined; h.swing = 0; h.dest = null;
  if (prey) h.facing = prey.pos.x >= h.pos.x ? 1 : -1;
  else if (aim) h.facing = aim.pos.x >= h.pos.x ? 1 : -1;
  h.cast = { slot, left: ability.cast, duration: ability.cast, fired: false, target: { ...point }, targetId: prey?.id, hits: 0 };
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
        applyDamage(game, e, 30 * abilityPower(game, 2) * game.mods.jeffDamage, 'physical', 'jeff');
      }
      visual(game, 'saw', h.pos, cast.target, 82, '#ffcd78', .3);
    }
  } else if (game.heroDef.id === 'becbec' && cast.slot === 4) {
    const contacts = [.096, .296, .496, .696, .896];
    while (cast.hits < contacts.length && phase >= contacts[cast.hits]!) {
      cast.hits++; cast.fired = true;
      for (const e of targets(game, 68).filter(e => !e.def.flying)) {
        applyDamage(game, e, 35 * abilityPower(game, 4) * game.mods.jeffDamage, 'physical', 'jeff');
        if (cast.hits === 5) e.stun = Math.max(e.stun, 1 * abilityPower(game, 4) * game.mods.stunDuration);
      }
      visual(game, 'punch', h.pos, cast.target, 55, game.heroDef.color, .25);
    }
  } else if (game.heroDef.id === 'jayjay' && cast.slot === 4) {
    const contacts = [.16, .493333, .826667];
    while (cast.hits < contacts.length && phase >= contacts[cast.hits]!) {
      cast.hits++; cast.fired = true;
      for (const e of targets(game, 75).filter(e => !e.def.flying)) {
        applyDamage(game, e, 75 * abilityPower(game, 4) * game.mods.jeffDamage, 'physical', 'jeff');
        if (cast.hits === 3) e.stun = Math.max(e.stun, 1.7 * abilityPower(game, 4) * game.mods.stunDuration);
      }
      visual(game, 'punch', h.pos, cast.target, 65, game.heroDef.color, .3);
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
export function fireHeroMissile(game: Game, kind: HeroMissile['kind'], goal: Vec, damage: number, targetId?: number, splash = 0, bounces = 0, from?: Vec, control?: { pull: number; stun: number }): void {
  const origin = from ?? (kind === 'golf'
    ? { x: game.hero.pos.x + game.hero.facing * 26, y: game.hero.pos.y + 8 }
    : { x: game.hero.pos.x + game.hero.facing * (game.heroDef.id === 'mike' ? 32 : 18), y: game.hero.pos.y - (game.heroDef.id === 'mike' ? 53 : 20) });
  game.heroMissiles.push({ id: game.nextEntityId(), kind, from: { ...origin }, pos: { ...origin }, prev: { ...origin }, goal: { ...goal },
    targetId, age: 0, duration: Math.max(.18, dist(origin, goal) / (kind === 'golf' ? 470 : 325)), damage: damage * game.mods.jeffDamage, splash, bounces, hitIds: [], ...control });
}

function resolveAbility(game: Game, slot: AbilitySlot, point: Vec, targetId?: number): void {
  const h = game.hero, def = game.heroDef;
  const pwr = abilityPower(game, slot);
  const rng = abilityRangeFactor(game, slot);
  const prey = game.enemies.find(e => e.id === targetId && isTargetable(e)) ?? targets(game, 280 * rng)[0];
  // Revalidate at contact: the clicked leak may die, phase, escape, or leave reach
  // during the wind-up. Hooks can hit air; a punch still requires a ground target.
  let contact: Enemy | undefined;
  if ((def.id === 'doni' && (slot === 0 || slot === 4)) || (def.id === 'jayjay' && slot === 0)) {
    const pool = targets(game, scaledCastRange(game, slot)).filter(e => def.id !== 'jayjay' || !e.def.flying);
    contact = pool.find(e => e.id === targetId) ?? pool[0];
    if (!contact) {
      h[COOLDOWN_FIELDS[slot]] = 0;
      h.cast = undefined; h.castTimer = 0;
      game.heroNotice = { name: def.abilities[slot].name, detail: 'Target lost · ability ready', color: def.color, left: 1.6 };
      return;
    }
    h.facing = contact.pos.x >= h.pos.x ? 1 : -1;
  }
  if (def.id === 'cbj') switch (slot) {
    case 0: fireHeroMissile(game, 'tater', prey?.pos ?? point, 90 * pwr, prey?.id, 42 * rng); break;
    case 1:
      for (const e of targets(game, 110 * rng).filter(e => !e.def.flying)) {
        applyDamage(game, e, 55 * pwr * game.mods.jeffDamage, 'physical', 'jeff');
        shove(e, 35 * rng); e.stun = Math.max(e.stun, .8 * pwr * game.mods.stunDuration);
      }
      visual(game, 'slam', h.pos, h.pos, 110 * rng, def.color, .8); break;
    case 2: zone(game, 'supply', h.pos, 110 * rng, 9 * pwr); visual(game, 'buff', h.pos, h.pos, 60, def.color, .8); break;
    case 3: h.overdrive = 8 * pwr; visual(game, 'buff', h.pos, h.pos, 50, def.color, .7); break;
    case 4: zone(game, 'taterRain', point, 90 * rng, 4.5 * pwr); break;
  }
  if (def.id === 'doni') switch (slot) {
    case 0: case 4:
      fireHeroMissile(game, 'hook', contact!.pos, (slot === 0 ? 85 : 150) * pwr, contact!.id, 0, slot === 4 ? 2 : 0, undefined, { pull: 60, stun: 1.2 * pwr * game.mods.stunDuration }); break;
    case 1: zone(game, 'net', point, 100 * rng, 6 * pwr); break;
    case 2:
      h.hp = Math.min(h.maxHp, h.hp + 130 * pwr); h.shield = Math.max(h.shield ?? 0, 5 * pwr);
      for (const f of [...game.friendlies, ...game.crew, ...game.heroSummons]) if (f.hp > 0 && dist(f.pos, h.pos) <= 120 * rng) f.hp = Math.min(f.maxHp, f.hp + 60 * pwr);
      visual(game, 'buff', h.pos, h.pos, 120 * rng, def.color, .8); break;
    case 3:
      for (const e of targets(game, 130 * rng).filter(e => !e.def.flying)) {
        applyDamage(game, e, 50 * pwr * game.mods.jeffDamage, 'water', 'jeff'); shove(e, 45 * rng);
      }
      visual(game, 'current', h.pos, h.pos, 130 * rng, def.color, 1); break;
  }
  if (def.id === 'jayjay') switch (slot) {
    case 0: {
      const victim = contact;
      if (victim) {
        applyDamage(game, victim, 115 * pwr * game.mods.jeffDamage, 'physical', 'jeff');
        victim.stun = Math.max(victim.stun, 1.4 * pwr * game.mods.stunDuration);
        visual(game, 'punch', h.pos, victim.pos, 65, def.color, .5);
      }
      break;
    }
    case 1:
      for (const e of targets(game, 115 * rng).filter(e => !e.def.flying)) {
        applyDamage(game, e, 70 * pwr * game.mods.jeffDamage, 'physical', 'jeff'); e.stun = Math.max(e.stun, pwr * game.mods.stunDuration);
      }
      visual(game, 'slam', h.pos, h.pos, 115 * rng, def.color, 1); break;
    case 2: h.taunt = 8 * pwr; h.shield = Math.max(h.shield ?? 0, 8 * pwr); visual(game, 'buff', h.pos, h.pos, 70, def.color, .8); break;
    case 3: h.hp = Math.min(h.maxHp, h.hp + 190 * pwr); h.overdrive = 8 * pwr; visual(game, 'buff', h.pos, h.pos, 55, def.color, .8); break;
    case 4: break; // Three separate animation contacts, handled above.
  }
  if (def.id === 'mike') switch (slot) {
    case 0: {
      const pool = targets(game, 280 * rng);
      if (prey) {
        const i = pool.findIndex(e => e.id === prey.id);
        if (i > 0) pool.splice(i, 1);
        if (i !== 0) pool.unshift(prey);
      }
      for (let i = 0; i < 3; i++) {
        const e = pool[i % Math.max(1, pool.length)];
        fireHeroMissile(game, 'plunger', e?.pos ?? point, 52 * pwr, e?.id, 30 * rng, 0, { x: h.pos.x + h.facing * (30 + i * 4), y: h.pos.y - 54 - i * 7 });
      }
      break;
    }
    case 1:
      for (const e of targets(game, 130 * rng).filter(e => !e.def.flying)) {
        applyDamage(game, e, 48 * pwr * game.mods.jeffDamage, 'physical', 'jeff');
        e.stun = Math.max(e.stun, .9 * pwr * game.mods.stunDuration);
        e.progress = Math.max(0, e.progress - (e.def.traits.includes('boss') ? 12 : 60) * (1 + abilityRank(game, 1) * 0.12));
        e.heldBy = null;
      }
      visual(game, 'horn', h.pos, h.pos, 130 * rng, def.color, 1); break;
    case 2: zone(game, 'supply', h.pos, 100 * rng, 8 * pwr); visual(game, 'buff', h.pos, h.pos, 60, '#f5db9e', .8); break;
    case 3: h.overdrive = 8 * pwr; visual(game, 'buff', h.pos, h.pos, 50, def.color, .7); break;
    case 4: zone(game, 'rain', point, 90 * rng, 4.5 * pwr); break;
  }
  if (def.id === 'bob') switch (slot) {
    case 0: {
      const aim = prey?.pos ?? point, length = dist(h.pos, aim) || 1;
      const beam = 420 * rng;
      const dir = { x: (aim.x - h.pos.x) / length, y: (aim.y - h.pos.y) / length };
      const end = { x: h.pos.x + dir.x * beam, y: h.pos.y + dir.y * beam };
      for (const e of game.enemies) {
        if (!isTargetable(e)) continue;
        const dx = e.pos.x - h.pos.x, dy = e.pos.y - h.pos.y, along = dx * dir.x + dy * dir.y;
        if (along >= -e.def.radius && along <= beam + e.def.radius && Math.abs(dx * dir.y - dy * dir.x) <= 18 + e.def.radius) {
          applyDamage(game, e, 140 * pwr * game.mods.jeffDamage, 'heat', 'jeff');
          e.armorShred = Math.max(e.armorShred, .35); e.shredTimer = Math.max(e.shredTimer, 5 * pwr);
        }
      }
      visual(game, 'laser', { x: h.pos.x + h.facing * 20, y: h.pos.y - 25 }, end, 22, '#ff826c', .65); break;
    }
    case 1: h.hp = Math.min(h.maxHp, h.hp + 130 * pwr); h.shield = 8 * pwr; visual(game, 'buff', h.pos, h.pos, 50, def.color, .9); break;
    case 2:
      for (const e of game.enemies) if (!e.dead && !e.escaped && dist(e.pos, h.pos) <= 145 * rng + e.def.radius) {
        e.phased = false; e.revealTimer = 3 * pwr; e.stun = Math.max(e.stun, 2.5 * pwr * game.mods.stunDuration);
        applyDamage(game, e, 40 * pwr * game.mods.jeffDamage, 'heat', 'jeff');
      }
      visual(game, 'emp', h.pos, h.pos, 145 * rng, def.color, 1); break;
    case 3: h.overdrive = 8 * pwr; visual(game, 'buff', h.pos, h.pos, 50, def.color, .7); break;
    case 4: {
      const marks = 3 + (abilityRank(game, 4) >= 3 ? 1 : 0);
      const ids = targets(game, 280 * rng).sort((a, b) => b.maxHp - a.maxHp).slice(0, marks).map(e => e.id);
      zone(game, 'review', h.pos, 280 * rng, 9 * pwr, ids); visual(game, 'emp', h.pos, h.pos, 120, '#ffab92', .7); break;
    }
  }
  if (def.id === 'becbec') switch (slot) {
    case 0: {
      const reach = 75 * rng;
      const victim = game.enemies.find(e => e.id === targetId && isTargetable(e) && !e.def.flying) ?? targets(game, reach).find(e => !e.def.flying);
      if (victim) {
        victim.armorShred = Math.max(victim.armorShred, .45); victim.shredTimer = Math.max(victim.shredTimer, 5 * pwr);
        applyDamage(game, victim, 110 * pwr * game.mods.jeffDamage, 'physical', 'jeff');
        victim.stun = Math.max(victim.stun, 1.8 * pwr * game.mods.stunDuration);
        visual(game, 'punch', h.pos, victim.pos, 58, def.color, .5);
      }
      break;
    }
    case 1:
      for (const e of targets(game, 105 * rng).filter(e => !e.def.flying)) {
        applyDamage(game, e, 65 * pwr * game.mods.jeffDamage, 'physical', 'jeff'); e.stun = Math.max(e.stun, 1.2 * pwr * game.mods.stunDuration);
      }
      visual(game, 'slam', h.pos, h.pos, 105 * rng, def.color, 1); break;
    case 2: h.taunt = 7 * pwr; h.shield = Math.max(h.shield ?? 0, 7 * pwr); visual(game, 'buff', h.pos, h.pos, 70, def.color, .8); break;
    case 3: h.hp = Math.min(h.maxHp, h.hp + 160 * pwr); h.shield = Math.max(h.shield ?? 0, 6 * pwr); visual(game, 'buff', h.pos, h.pos, 55, def.color, .8); break;
    case 4: break;
  }
  if (def.id === 'chris') switch (slot) {
    case 0:
      zone(game, 'sand', h.pos, 100 * rng, 6.5 * pwr);
      visual(game, 'buff', h.pos, h.pos, 55, '#d2b48c', .7);
      break;
    case 1: fireHeroMissile(game, 'golf', prey?.pos ?? point, 70 * pwr, prey?.id, 0, 2);
      visual(game, 'golf', h.pos, point, 45, '#fff4c7', .45); break;
    case 2: break; // Timed three-hit combo is resolved by advanceHeroCast.
    case 3: zone(game, 'gas', h.pos, 110 * rng, 7 * pwr); break;
    case 4: h.hp = Math.min(h.maxHp, h.hp + 100 * pwr); h.overdrive = 8 * pwr; h.lifesteal = 8 * pwr;
      visual(game, 'buff', h.pos, h.pos, 50, def.color, .8); break;
  }
}

export function heroAttackSpeed(game: Game): number {
  if ((game.hero.overdrive ?? 0) <= 0) return 1;
  return game.heroDef.id === 'bob' ? 1.65 : ['mike', 'cbj'].includes(game.heroDef.id) ? 1.5 : 1.3;
}

function laserTargets(game: Game, first: Enemy, pierce: number): Enemy[] {
  const hits = [first];
  let from = first.pos;
  for (let i = 0; i < pierce; i++) {
    const next = game.enemies
      .filter(e => isTargetable(e) && !hits.some(h => h.id === e.id) && e.pos.x >= Math.min(from.x, game.hero.pos.x) - 8)
      .sort((a, b) => a.pos.x - b.pos.x)
      .find(e => Math.abs(e.pos.y - from.y) < 40);
    if (!next) break;
    hits.push(next);
    from = next.pos;
  }
  return hits;
}

function applyBasicHeat(game: Game, enemy: Enemy): void {
  if (game.mods.onHitHeat <= 0) return;
  enemy.dotDps = Math.max(enemy.dotDps, game.mods.onHitHeat);
  enemy.dotTime = Math.max(enemy.dotTime, 2);
  enemy.dotSource = 'jeff';
  enemy.dotType = 'heat';
}

export function strikeFromProfile(game: Game, enemy: Enemy): void {
  const h = game.hero;
  const profile = game.attackProfile;
  h.facing = enemy.pos.x >= h.pos.x ? 1 : -1;
  switch (profile.basic) {
    case 'laser': {
      const prep = prepareKitStrike(game, enemy);
      const base = profile.damage * game.mods.jeffDamage * prep.damageMult;
      for (const target of laserTargets(game, enemy, profile.pierce)) {
        applyDamage(game, target, base, profile.damageType, 'jeff');
        onKitHit(game, target, base);
        applyBasicHeat(game, target);
      }
      visual(game, 'laser', { x: h.pos.x + h.facing * 18, y: h.pos.y - 25 }, { x: enemy.pos.x, y: enemy.pos.y - 10 }, 4, game.heroDef.color, .22);
      break;
    }
    case 'missile': {
      const prep = prepareKitStrike(game, enemy);
      fireHeroMissile(game, profile.missile!, enemy.pos, profile.damage, enemy.id, profile.splashRadius || profile.splash, profile.bounce, undefined, { pull: profile.pull, stun: profile.stun });
      const missile = game.heroMissiles.at(-1);
      if (missile) {
        missile.basic = true;
        missile.pierce = profile.pierce;
        missile.damageType = profile.damageType;
        missile.damage *= prep.damageMult;
        if (prep.stun > 0) missile.stun = Math.max(missile.stun ?? 0, prep.stun);
      }
      break;
    }
    case 'contact': {
      const prep = prepareKitStrike(game, enemy);
      const dmg = profile.damage * game.mods.jeffDamage * prep.damageMult;
      if (profile.tapStunEvery !== null) {
        h.tapCount += 1;
        if (h.tapCount >= profile.tapStunEvery) {
          h.tapCount = 0;
          enemy.stun = Math.max(enemy.stun, profile.stun * game.mods.stunDuration);
        }
      }
      if (profile.shred > 0) {
        enemy.armorShred = Math.max(enemy.armorShred, profile.shred);
        enemy.shredTimer = Math.max(enemy.shredTimer, 3);
      }
      if (profile.stunChance > 0 && game.rng.next() < profile.stunChance) {
        enemy.stun = Math.max(enemy.stun, profile.stun * game.mods.stunDuration);
      }
      if (profile.stun > 0 && profile.stunChance === 0 && profile.tapStunEvery === null) {
        enemy.stun = Math.max(enemy.stun, profile.stun * game.mods.stunDuration);
      }
      if (prep.stun > 0) enemy.stun = Math.max(enemy.stun, prep.stun * game.mods.stunDuration);
      const dealt = applyDamage(game, enemy, dmg, profile.damageType, 'jeff');
      onKitHit(game, enemy, dmg);
      applyBasicHeat(game, enemy);
      if (profile.splash > 0) {
        for (const e of targets(game, profile.splashRadius, enemy.pos)) {
          if (e.id === enemy.id) continue;
          applyDamage(game, e, dmg * profile.splash, profile.damageType, 'jeff');
        }
      }
      if (game.heroDef.id === 'chris') {
        if ((h.lifesteal ?? 0) > 0) h.hp = Math.min(h.maxHp, h.hp + dealt * .45);
        visual(game, 'saw', h.pos, enemy.pos, 32, '#ffcc84', .2);
      } else if (game.heroDef.id === 'becbec' || game.heroDef.id === 'jayjay') {
        visual(game, 'punch', h.pos, enemy.pos, 30, game.heroDef.color, .22);
      } else if (game.heroDef.id === 'jeff') {
        const from = { x: h.pos.x + h.facing * 22, y: h.pos.y - 18 };
        game.addEffect({ kind: 'beam', from, to: { ...enemy.pos }, color: '#ffe082', ttl: 0.24, max: 0.24 });
        game.addEffect({ kind: 'hit', pos: { ...enemy.pos }, color: '#ffecb3', ttl: 0.42, max: 0.42 });
        game.addEffect({ kind: 'splash', pos: { ...enemy.pos }, radius: 30, color: '#ffe082', ttl: 0.32, max: 0.32 });
        game.addEffect({ kind: 'ring', pos: { x: h.pos.x + h.facing * 10, y: h.pos.y + 12 }, radius: 20, color: '#ffe082', ttl: 0.26, max: 0.26 });
        game.addEffect({ kind: 'ring', pos: { ...enemy.pos }, radius: 22, color: '#fff8e1', ttl: 0.18, max: 0.18 });
      }
      break;
    }
    default: {
      const _exhaustive: never = profile.basic;
      return _exhaustive;
    }
  }
}

export function updateHeroZones(game: Game, dt: number): void {
  for (const z of game.heroZones) {
    const elapsed = Math.min(dt, z.left); z.left -= dt;
    if (z.kind === 'supply') {
      const h = game.hero;
      const heal = 18 * abilityPower(game, 2);
      if (heroOnYard(game) && dist(h.pos, z.pos) <= z.radius) h.hp = Math.min(h.maxHp, h.hp + heal * elapsed);
      for (const f of [...game.friendlies, ...game.crew, ...game.heroSummons]) if (f.hp > 0 && dist(f.pos, z.pos) <= z.radius) f.hp = Math.min(f.maxHp, f.hp + heal * elapsed);
      for (const t of game.towers) if (t.def.kind === 'barricade' && t.rebuild <= 0 && dist(t.pos, z.pos) <= z.radius) t.hp = Math.min(t.maxHp, t.hp + 30 * abilityPower(game, 2) * elapsed);
    } else if (z.kind === 'gas') {
      for (const e of targets(game, z.radius, z.pos).filter(e => !e.def.flying)) {
        e.slow = Math.max(e.slow, .4); applyDamage(game, e, 12 * abilityPower(game, 3) * game.mods.jeffDamage * elapsed, 'heat', 'jeff');
      }
    } else if (z.kind === 'sand') {
      for (const e of targets(game, z.radius, z.pos).filter(e => !e.def.flying)) {
        e.slow = Math.max(e.slow, .55); applyDamage(game, e, 10 * game.mods.jeffDamage * elapsed, 'physical', 'jeff');
      }
    } else if (z.kind === 'net') {
      for (const e of targets(game, z.radius, z.pos).filter(e => !e.def.flying)) {
        e.slow = Math.max(e.slow, .55); applyDamage(game, e, 8 * abilityPower(game, 1) * game.mods.jeffDamage * elapsed, 'physical', 'jeff');
      }
    } else if (z.kind === 'rain' || z.kind === 'taterRain') {
      z.tick -= elapsed;
      const rainPwr = abilityPower(game, 4);
      while (z.tick <= 0 && z.ticks < 9) {
        const angle = z.ticks * 2.4, radius = z.ticks % 3 === 0 ? 0 : z.radius * .5;
        const point = { x: z.pos.x + Math.cos(angle) * radius, y: z.pos.y + Math.sin(angle) * radius };
        fireHeroMissile(game, z.kind === 'rain' ? 'plunger' : 'tater', point, (z.kind === 'rain' ? 32 : 34) * rainPwr, undefined, 48, 0, { x: point.x - 40, y: point.y - 220 });
        z.tick += .5; z.ticks++;
      }
    } else if (z.kind === 'review') {
      const mark = 0.3 * abilityPower(game, 4);
      for (const e of game.enemies) if (z.targetIds?.includes(e.id) && isTargetable(e)) { e.marked = true; e.markBonus = Math.max(e.markBonus ?? 0, mark); }
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
    const speed = Math.max(220, dist(p.from, p.goal) / Math.max(0.08, p.duration));
    const step = moveToward(p.pos, p.goal, speed * dt);
    p.pos = step.pos;
    if (!step.arrived) { keep.push(p); continue; }
    if (p.splash > 0) {
      for (const e of targets(game, p.splash, p.goal)) applyDamage(game, e, p.damage, p.damageType ?? 'physical', 'jeff');
      if (p.basic && target) {
        onKitHit(game, target, p.damage);
        applyBasicHeat(game, target);
      }
    } else if (target) {
      applyDamage(game, target, p.damage, p.damageType ?? 'physical', 'jeff');
      if (p.basic) {
        onKitHit(game, target, p.damage);
        applyBasicHeat(game, target);
      }
    }
    if (target && !target.dead) {
      if ((p.stun ?? 0) > 0 && ((p.pull ?? 0) <= 0 || !target.def.flying)) {
        target.stun = Math.max(target.stun, p.stun ?? 0);
      }
      if ((p.pull ?? 0) > 0 && !target.def.flying) {
        shove(target, p.pull!);
        visual(game, 'hook', p.from, p.goal, 25, '#71d5ce', .3);
      }
    }
    game.addEffect({ kind: 'hit', pos: { ...p.goal }, color: p.kind === 'golf' || p.kind === 'bell' ? '#fffde7' : p.kind === 'hook' ? '#71d5ce' : p.kind === 'tater' ? '#efbb68' : p.kind === 'hose' ? '#8ddfe9' : p.kind === 'rebar' ? '#b87333' : '#e1a886', ttl: .24, max: .24 });
    if (p.splash > 0) game.addEffect({ kind: 'ring', pos: { ...p.goal }, radius: p.splash, color: '#eab982', ttl: .35, max: .35 });
    if (p.targetId !== undefined) p.hitIds.push(p.targetId);
    const next = p.bounces > 0 ? targets(game, 135, p.goal).find(e => !p.hitIds.includes(e.id)) : undefined;
    if (next) {
      p.bounces--; p.damage *= .7; p.from = { ...p.goal }; p.goal = { ...next.pos }; p.targetId = next.id;
      p.age = 0; p.duration = Math.max(.16, dist(p.from, p.goal) / 470); keep.push(p);
    } else if ((p.pierce ?? 0) > 0) {
      const pierced = targets(game, 135, p.goal).find(e => !p.hitIds.includes(e.id));
      if (pierced) {
        p.pierce!--; p.from = { ...p.goal }; p.goal = { ...pierced.pos }; p.targetId = pierced.id;
        p.age = 0; p.duration = Math.max(.16, dist(p.from, p.goal) / 470); keep.push(p);
      }
    }
  }
  game.heroMissiles = keep;
}

function shove(enemy: Enemy, distance: number): void {
  enemy.progress = Math.max(0, enemy.progress - distance * (enemy.def.traits.includes('boss') ? .2 : 1));
  enemy.heldBy = null; enemy.attackSwing = 0;
}

export function releaseSummon(game: Game, id: number): void {
  for (const e of game.enemies) if (e.heldBy?.kind === 'summon' && e.heldBy.id === id) { e.heldBy = null; e.attackSwing = 0; }
}

/** Shared companion — available to every hero via the D reinforcement slot. */
export function summonLogan(game: Game, pos: Vec): void {
  for (const old of game.heroSummons.filter(s => !s.buildHelper)) releaseSummon(game, old.id);
  const facing = game.heroEnabled ? game.hero.facing : 1;
  const start = { x: pos.x, y: pos.y };
  game.heroSummons = [...game.heroSummons.filter(s => s.buildHelper), {
    id: game.nextEntityId(),
    anchor: { ...start },
    pos: { ...start },
    prev: { ...start },
    hp: 230,
    maxHp: 230,
    left: 18,
    duration: 18,
    facing,
    walkPhase: 0,
    moving: false,
    moveBlend: 0,
    swing: 0,
    attackTimer: 0,
  }];
  visual(game, 'summon', pos, pos, 45, '#d4e599', .8);
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
          applyDamage(game, e, (s.damage ?? 14) * game.mods.jeffDamage * friendlyDamageBuff(game, s.pos) * kitSummonDamageMult(game), 'physical', 'crew');
          game.addEffect({ kind: 'hit', pos: { x: e.pos.x, y: e.pos.y - 8 }, color: '#d2e397', ttl: .16, max: .16 });
        }
      }
      continue;
    }
    const held = game.enemies.find(e => isTargetable(e) && e.heldBy?.kind === 'summon' && e.heldBy.id === s.id);
    const prey = held ?? targets(game, 205, s.anchor).filter(e => !e.def.flying).sort((a, b) => dist(a.pos, s.pos) - dist(b.pos, s.pos))[0];
    s.targetId = prey?.id;
    const goal = prey?.pos ?? s.anchor;
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

/** Jeff's five kit skills. Same timing as before — fire on press, not after a wind-up. */
export function fireJeffAbility(game: Game, slot: AbilitySlot): boolean {
  if (game.heroDef.id !== 'jeff') return useHeroAbility(game, slot);
  if (!heroOnYard(game) || game.status !== 'playing' || game.hero.cast) return false;
  const h = game.hero;
  switch (slot) {
    case 0: {
      if (h.clampCooldown > 0) return false;
      const pwr = abilityPower(game, 0);
      h.clampCooldown = scaledAbilityCooldown(game, 0);
      game.clamp = { pos: { ...h.pos }, timeLeft: JEFF.clamp.duration * pwr };
      h.castTimer = 0.72;
      game.addEffect({ kind: 'skill', pos: { ...h.pos }, skill: 'clamp', ttl: 1.15, max: 1.15 });
      return true;
    }
    case 1: {
      if (h.shutoffCooldown > 0) return false;
      const pwr = abilityPower(game, 1);
      h.shutoffCooldown = scaledAbilityCooldown(game, 1);
      game.globalSlow = Math.min(0.9, JEFF.shutoff.slow * (1 + abilityRank(game, 1) * 0.06));
      game.globalSlowTimer = JEFF.shutoff.duration * pwr;
      game.spawnPause = JEFF.shutoff.duration * pwr;
      h.castTimer = 0.72;
      game.addEffect({ kind: 'skill', pos: { x: 480, y: 300 }, skill: 'shutoff', ttl: 1.8, max: 1.8 });
      return true;
    }
    case 2: {
      if (h.pulseCooldown > 0) return false;
      const pwr = abilityPower(game, 2);
      const radius = JEFF.pulse.radius * abilityRangeFactor(game, 2);
      h.pulseCooldown = scaledAbilityCooldown(game, 2);
      h.castTimer = 0.72;
      game.addEffect({ kind: 'skill', pos: { ...h.pos }, skill: 'pulse', ttl: 1.05, max: 1.05 });
      for (const e of game.enemies) {
        if (!isTargetable(e) || dist(e.pos, h.pos) > radius + e.def.radius) continue;
        e.armorShred = Math.max(e.armorShred, Math.min(0.7, JEFF.pulse.shred * (1 + abilityRank(game, 2) * 0.1)));
        e.shredTimer = Math.max(e.shredTimer, 3 * pwr);
        e.stun = Math.max(e.stun, JEFF.pulse.stun * pwr * game.mods.stunDuration);
        applyDamage(game, e, JEFF.pulse.damage * pwr * game.mods.jeffDamage, 'physical', 'jeff');
        game.addEffect({ kind: 'hit', pos: { ...e.pos }, color: '#ffb74d', ttl: 0.38, max: 0.38 });
      }
      return true;
    }
    case 3: {
      if (h.sleeveCooldown > 0) return false;
      h.sleeveCooldown = scaledAbilityCooldown(game, 3);
      h.sleeveTimer = JEFF.sleeve.duration * abilityPower(game, 3);
      h.castTimer = 0.72;
      game.addEffect({ kind: 'skill', pos: { ...h.pos }, skill: 'sleeve', ttl: 1.1, max: 1.1 });
      return true;
    }
    case 4: {
      if (h.coffeeCooldown > 0) return false;
      const pwr = abilityPower(game, 4);
      h.coffeeCooldown = scaledAbilityCooldown(game, 4);
      h.coffeeTimer = JEFF.coffee.duration * pwr;
      h.hp = Math.min(h.maxHp, h.hp + JEFF.coffee.heal * pwr);
      h.castTimer = 0.72;
      game.addEffect({ kind: 'skill', pos: { ...h.pos }, skill: 'coffee', ttl: 1.15, max: 1.15 });
      return true;
    }
    default:
      return false;
  }
}
