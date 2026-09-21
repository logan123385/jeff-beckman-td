import { dist, type Vec } from '../core/vec';
import { buildRank, type BuildStyle } from '../data/heroBuilds';
import { applyDamage, abilityPower, scaledCastRange, heroOnYard, isTargetable } from './combat';
import type { Game } from './game';
import type { Enemy } from './state';

function ring(game: Game, pos: Vec, radius: number, color: string) {
  game.addEffect({ kind: 'ring', pos: { ...pos }, radius, color, ttl: .55, max: .55 });
}
export function spawnBuildHelpers(game: Game, count: number, duration?: number, replaceOldest = false): void {
  const rank = buildRank(game.heroBuild, 'summoner');
  for (let i = 0; i < count; i++) {
    const helpers = game.heroSummons.filter(s => s.buildHelper);
    if (helpers.length >= 3) {
      if (!replaceOldest) break;
      const oldest = helpers.reduce((a, b) => a.left <= b.left ? a : b);
      for (const e of game.enemies) if (e.heldBy?.kind === 'summon' && e.heldBy.id === oldest.id) { e.heldBy = null; e.attackSwing = 0; }
      game.heroSummons = game.heroSummons.filter(s => s.id !== oldest.id);
    }
    const pos = { x: game.hero.pos.x + (i ? 22 : -22), y: game.hero.pos.y + 10 };
    const hp = rank >= 2 ? 105 : 70, left = duration ?? (rank >= 3 ? 15 : 10);
    game.heroSummons.push({ id: game.nextEntityId(), buildHelper: true, damage: rank >= 2 ? 12 : 8, anchor: { ...pos }, pos, prev: { ...pos },
      hp, maxHp: hp, left, duration: left, facing: game.hero.facing, walkPhase: 0, moving: false, moveBlend: 0, swing: 0, attackTimer: 0 });
    ring(game, pos, 30, '#a8d8ed');
  }
}

/** Basic-hit procs only: damage-over-time and splash never recursively trigger them. */
export function onBuildAttack(game: Game, target: Enemy, baseDamage: number): void {
  const build = game.heroBuild, venom = buildRank(build, 'venom'), blast = buildRank(build, 'blast'), hunter = buildRank(build, 'hunter');
  if (venom && !target.dead) {
    target.buildPoison = { left: venom >= 3 ? 6 : 4, dps: (venom >= 2 ? 10 : 6) * game.mods.jeffDamage, slow: venom >= 3 ? .15 : 0 };
  }
  if (hunter) {
    const state = game.buildState;
    state.focusHits = state.focusId === target.id ? Math.min(4, state.focusHits + 1) : 0;
    state.focusId = target.id;
    const bonus = state.focusHits * (hunter >= 2 ? .12 : .08) + (hunter >= 3 && target.def.traits.includes('boss') ? .25 : 0);
    if (bonus > 0) applyDamage(game, target, baseDamage * bonus, game.heroDef.id === 'bob' ? 'heat' : 'physical', 'jeff');
  }
  if (blast) {
    const radius = blast >= 2 ? 68 : 48;
    for (const e of game.enemies) if (e.id !== target.id && isTargetable(e) && dist(e.pos, target.pos) <= radius) {
      applyDamage(game, e, baseDamage * (blast >= 3 ? .45 : .25), 'heat', 'jeff');
    }
    ring(game, target.pos, radius, '#ffc68e');
  }
}

/** Called after aura reset, so leaving range or losing the hero removes support immediately. */
export function updateBuildEffects(game: Game, dt: number): void {
  const state = game.buildState, build = game.heroBuild;
  state.overtime = Math.max(0, state.overtime - dt);
  for (const e of game.enemies) if (e.buildPoison && !e.dead && !e.escaped) {
    const elapsed = Math.min(dt, e.buildPoison.left);
    e.slow = Math.max(e.slow, e.buildPoison.slow);
    applyDamage(game, e, e.buildPoison.dps * elapsed, 'heat', 'jeff');
    e.buildPoison.left -= elapsed;
    if (e.buildPoison.left <= 0) e.buildPoison = undefined;
  }
  for (const zone of game.buildZones) {
    const elapsed = Math.min(dt, zone.left); zone.left -= elapsed;
    for (const e of game.enemies) if (isTargetable(e) && !e.def.flying && dist(e.pos, zone.pos) <= zone.radius) {
      applyDamage(game, e, zone.dps * elapsed, 'heat', 'jeff'); e.slow = Math.max(e.slow, .25);
    }
  }
  game.buildZones = game.buildZones.filter(z => z.left > 0);
  if (!heroOnYard(game)) return;
  const engineer = buildRank(build, 'engineer');
  for (const tower of game.towers) {
    const distance = dist(tower.pos, game.hero.pos);
    const passive = engineer > 0 && distance <= 175, active = state.overtime > 0 && distance <= 200;
    if (!passive && !active) continue;
    const old = game.buffs.get(tower.id) ?? { dmg: 0, rate: 0, range: 0 };
    game.buffs.set(tower.id, { dmg: old.dmg + (passive ? .12 : 0), range: old.range + (passive && engineer >= 2 ? .1 : 0), rate: old.rate + (passive && engineer >= 3 ? .12 : 0) + (active ? .35 : 0) });
  }
  const summon = buildRank(build, 'summoner');
  if (summon && game.waveActive) {
    state.helperTimer -= dt;
    if (state.helperTimer <= 0) { spawnBuildHelpers(game, 1); state.helperTimer = summon >= 3 ? 18 : 24; }
  }
}

export function resolveBuildTechnique(game: Game, point: Vec, targetId?: number): void {
  const style = game.heroBuild.technique as BuildStyle, power = abilityPower(game, 4), damage = game.mods.jeffDamage;
  if (style === 'engineer') { game.buildState.overtime = 9 * power; ring(game, game.hero.pos, 200, '#f0c779'); }
  if (style === 'summoner') spawnBuildHelpers(game, 2, 16 * power, true);
  if (style === 'venom') {
    game.buildZones.push({ pos: { ...point }, radius: 130, left: 7 * power, duration: 7 * power, dps: 18 * damage });
    ring(game, point, 130, '#aede72');
  }
  if (style === 'blast') {
    for (const e of game.enemies) if (isTargetable(e) && dist(e.pos, point) <= 120) {
      applyDamage(game, e, 140 * power * damage, 'heat', 'jeff'); e.stun = Math.max(e.stun, e.def.traits.includes('boss') ? .2 : 1);
    }
    ring(game, point, 120, '#ffa36e');
    game.heroVisuals.push({ kind: 'slam', from: { ...point }, to: { ...point }, radius: 120, color: '#ffa36e', left: .7, duration: .7 });
  }
  if (style === 'hunter') {
    const target = game.enemies.find(e => e.id === targetId && isTargetable(e) && dist(e.pos, game.hero.pos) <= scaledCastRange(game, 4) + e.def.radius);
    if (!target) { game.hero.coffeeCooldown = 0; return; }
    applyDamage(game, target, 260 * power * damage, 'heat', 'jeff'); target.exposed = { left: 6 * power, strength: .25 };
    game.heroVisuals.push({ kind: 'laser', from: { ...game.hero.pos }, to: { ...target.pos }, radius: 8, color: '#ee9aac', left: .45, duration: .45 });
  }
}
