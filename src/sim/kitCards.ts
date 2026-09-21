import { dist, type Vec } from '../core/vec';
import { cardById, type KitCard } from '../data/kitCards';
import type { AttackProfile } from '../data/weapons';
import { applyDamage, heroOnYard, isTargetable } from './combat';
import type { Game } from './game';
import type { Enemy } from './state';

function ringHelper(game: Game, pos: Vec, radius: number, color: string): void {
  game.addEffect({ kind: 'ring', pos: { ...pos }, radius, color, ttl: 0.55, max: 0.55 });
}

/** Kit crew cards spawn short-lived helpers that hold ground leaks. */
export function spawnBuildHelpers(game: Game, count: number, duration?: number, replaceOldest = false): void {
  for (let i = 0; i < count; i++) {
    const helpers = game.heroSummons.filter((s) => s.buildHelper);
    if (helpers.length >= 3) {
      if (!replaceOldest) break;
      const oldest = helpers.reduce((a, b) => (a.left <= b.left ? a : b));
      for (const e of game.enemies) {
        if (e.heldBy?.kind === 'summon' && e.heldBy.id === oldest.id) {
          e.heldBy = null;
          e.attackSwing = 0;
        }
      }
      game.heroSummons = game.heroSummons.filter((s) => s.id !== oldest.id);
    }
    const pos = { x: game.hero.pos.x + (i ? 22 : -22), y: game.hero.pos.y + 10 };
    const hp = 70;
    const left = duration ?? 10;
    game.heroSummons.push({
      id: game.nextEntityId(),
      buildHelper: true,
      damage: 8,
      anchor: { ...pos },
      pos,
      prev: { ...pos },
      hp,
      maxHp: hp,
      left,
      duration: left,
      facing: game.hero.facing,
      walkPhase: 0,
      moving: false,
      moveBlend: 0,
      swing: 0,
      attackTimer: 0,
    });
    ringHelper(game, pos, 30, '#a8d8ed');
  }
}

export interface KitStrikePrep {
  damageMult: number;
  stun: number;
}

function slottedCards(game: Game): KitCard[] {
  const hero = game.heroDef.id;
  const stance = game.attackProfile.stance;
  const out: KitCard[] = [];
  for (const id of game.kitCards) {
    if (!id) continue;
    const card = cardById(id);
    if (card && card.hero === hero && card.stance === stance) out.push(card);
  }
  return out;
}

function activeCards(game: Game): KitCard[] {
  if (!heroOnYard(game)) return [];
  return slottedCards(game);
}

function bumpHit(game: Game, key: string): number {
  const next = (game.kitState.hitCounts[key] ?? 0) + 1;
  game.kitState.hitCounts[key] = next;
  return next;
}

function resetProfileFromBase(game: Game): void {
  const base = game.baseAttackProfile;
  const profile = game.attackProfile;
  profile.holds = base.holds;
  profile.pierce = base.pierce;
  profile.bounce = base.bounce;
  profile.reach = base.reach;
  profile.splashRadius = base.splashRadius;
  profile.tapStunEvery = base.tapStunEvery;
}

function applyProfileMod(card: KitCard, profile: AttackProfile): void {
  switch (card.job) {
    case 'anchor':
      profile.holds += 1;
      break;
    case 'lane':
      switch (card.hero) {
        case 'jeff':
        case 'becbec':
          profile.pierce += 1;
          break;
        case 'mike':
        case 'chris':
        case 'jayjay':
          profile.bounce += 1;
          break;
        case 'bob':
          profile.pierce += 1;
          break;
        case 'cbj':
          profile.splashRadius += 18;
          break;
        case 'doni':
          profile.reach += 25;
          break;
        default: {
          const _exhaustive: never = card.hero;
          return _exhaustive;
        }
      }
      break;
    case 'breaker':
      if (card.hero === 'becbec' || card.hero === 'jayjay') profile.tapStunEvery = 2;
      break;
    case 'crew':
    case 'sweep':
    case 'pin':
    case 'control':
    case 'spot':
      break;
    default: {
      const _exhaustive: never = card.job;
      return _exhaustive;
    }
  }
}

/** Static stance-card mods copied onto the live attack profile at run start. */
export function syncKitProfile(game: Game): void {
  resetProfileFromBase(game);
  for (const card of slottedCards(game)) applyProfileMod(card, game.attackProfile);
}

export function splashNear(
  game: Game,
  enemy: Enemy,
  fraction: number,
  radius: number,
  baseDamage: number,
  damageType: AttackProfile['damageType'],
): void {
  for (const e of game.enemies) {
    if (e.id === enemy.id || !isTargetable(e)) continue;
    if (dist(e.pos, enemy.pos) <= radius + e.def.radius) {
      applyDamage(game, e, baseDamage * fraction, damageType, 'jeff');
    }
  }
  game.addEffect({ kind: 'ring', pos: { ...enemy.pos }, radius, color: '#ffe082', ttl: 0.35, max: 0.35 });
}

export function applyFocus(game: Game, enemy: Enemy, perHit: number, cap: number, baseDamage: number, damageType: AttackProfile['damageType']): void {
  const state = game.kitState;
  if (state.focusId !== enemy.id) {
    state.focusId = enemy.id;
    state.focusHits = 0;
  }
  state.focusHits = Math.min(Math.round(cap / perHit), state.focusHits + 1);
  const bonus = state.focusHits * perHit;
  if (bonus > 0) applyDamage(game, enemy, baseDamage * bonus, damageType, 'jeff');
}

export function expose(enemy: Enemy, amount: number, duration: number): void {
  enemy.exposed = { left: duration, strength: Math.max(enemy.exposed?.strength ?? 0, amount) };
}

function towerAura(game: Game, radius: number, buff: Partial<{ dmg: number; range: number; rate: number }>): void {
  for (const tower of game.towers) {
    if (dist(tower.pos, game.hero.pos) > radius) continue;
    const old = game.buffs.get(tower.id) ?? { dmg: 0, range: 0, rate: 0 };
    game.buffs.set(tower.id, {
      dmg: old.dmg + (buff.dmg ?? 0),
      range: old.range + (buff.range ?? 0),
      rate: old.rate + (buff.rate ?? 0),
    });
  }
}

function maybeHelper(game: Game, dt: number, count: number, duration: number, interval: number): void {
  if (!game.waveActive) return;
  game.kitState.helperTimer -= dt;
  if (game.kitState.helperTimer > 0) return;
  spawnBuildHelpers(game, count, duration, true);
  game.kitState.helperTimer = interval;
}

function shred(enemy: Enemy, amount: number, duration: number): void {
  enemy.armorShred = Math.max(enemy.armorShred, amount);
  enemy.shredTimer = Math.max(enemy.shredTimer, duration);
}

/** Cadence bonuses applied before damage on a connecting basic. */
export function prepareKitStrike(game: Game, _enemy: Enemy): KitStrikePrep {
  let damageMult = 1;
  let stun = 0;
  for (const card of activeCards(game)) {
    if (card.job !== 'pin') continue;
    switch (card.hero) {
      case 'jeff': {
        const hits = bumpHit(game, card.id);
        if (hits % 4 === 0) damageMult *= 1.6;
        break;
      }
      case 'chris': {
        const hits = bumpHit(game, card.id);
        if (hits % 4 === 0) damageMult *= 1.55;
        break;
      }
      case 'cbj': {
        const hits = bumpHit(game, card.id);
        if (hits % 4 === 0) {
          damageMult *= 1.5;
          stun = Math.max(stun, 0.4);
        }
        break;
      }
      case 'mike':
      case 'bob':
      case 'becbec':
      case 'doni':
      case 'jayjay':
        break;
      default: {
        const _exhaustive: never = card.hero;
        return _exhaustive;
      }
    }
  }
  return { damageMult, stun };
}

function onBreakerHit(game: Game, enemy: Enemy, card: KitCard): void {
  switch (card.hero) {
    case 'jeff': {
      const hits = bumpHit(game, card.id);
      if (hits % 3 === 0) shred(enemy, 0.2, 4);
      break;
    }
    case 'mike':
      shred(enemy, 0.15, 3);
      break;
    case 'bob':
      if (game.rng.next() < 0.15) enemy.stun = Math.max(enemy.stun, 0.5 * game.mods.stunDuration);
      break;
    case 'chris':
      shred(enemy, 0.18, 3);
      break;
    case 'becbec':
    case 'jayjay':
      break;
    case 'cbj':
      shred(enemy, 0.14, 3);
      break;
    case 'doni':
      shred(enemy, 0.16, 3);
      break;
    default: {
      const _exhaustive: never = card.hero;
      return _exhaustive;
    }
  }
}

function onSweepHit(game: Game, enemy: Enemy, card: KitCard, baseDamage: number, damageType: AttackProfile['damageType']): void {
  switch (card.hero) {
    case 'jeff':
      splashNear(game, enemy, 0.3, 44, baseDamage, damageType);
      break;
    case 'mike':
      splashNear(game, enemy, 0.35, 50, baseDamage, damageType);
      break;
    case 'bob':
      splashNear(game, enemy, 0.25, 40, baseDamage, damageType);
      break;
    case 'chris':
      splashNear(game, enemy, 0.3, 48, baseDamage, damageType);
      break;
    case 'becbec':
      splashNear(game, enemy, 0.4, 52, baseDamage, damageType);
      break;
    case 'cbj':
      splashNear(game, enemy, 0.35, 50, baseDamage, damageType);
      break;
    case 'doni':
      splashNear(game, enemy, 0.28, 46, baseDamage, damageType);
      break;
    case 'jayjay':
      splashNear(game, enemy, 0.35, 54, baseDamage, damageType);
      break;
    default: {
      const _exhaustive: never = card.hero;
      return _exhaustive;
    }
  }
}

function applyKitSlow(enemy: Enemy, amount: number, duration: number): void {
  enemy.kitSlow = {
    amount: Math.max(enemy.kitSlow?.amount ?? 0, amount),
    left: Math.max(enemy.kitSlow?.left ?? 0, duration),
  };
  enemy.slow = Math.max(enemy.slow, amount);
}

function onControlHit(_game: Game, enemy: Enemy, card: KitCard): void {
  switch (card.hero) {
    case 'jeff':
      applyKitSlow(enemy, 0.2, 2);
      break;
    case 'mike':
      applyKitSlow(enemy, 0.18, 1.8);
      break;
    case 'bob':
      applyKitSlow(enemy, 0.15, 2);
      break;
    case 'chris':
      applyKitSlow(enemy, 0.2, 2);
      break;
    case 'becbec':
      applyKitSlow(enemy, 0.16, 2);
      break;
    case 'cbj':
      applyKitSlow(enemy, 0.18, 2);
      break;
    case 'doni':
      applyKitSlow(enemy, 0.2, 2.2);
      break;
    case 'jayjay':
      applyKitSlow(enemy, 0.18, 2);
      break;
    default: {
      const _exhaustive: never = card.hero;
      return _exhaustive;
    }
  }
}

function onPinHit(game: Game, enemy: Enemy, card: KitCard, baseDamage: number, damageType: AttackProfile['damageType']): void {
  switch (card.hero) {
    case 'mike':
      applyFocus(game, enemy, 0.1, 0.4, baseDamage, damageType);
      break;
    case 'bob':
      applyFocus(game, enemy, 0.12, 0.48, baseDamage, damageType);
      break;
    case 'doni':
      applyFocus(game, enemy, 0.1, 0.4, baseDamage, damageType);
      break;
    case 'becbec': {
      const hits = bumpHit(game, card.id);
      if (hits % 5 === 0) expose(enemy, 0.2, 4);
      break;
    }
    case 'jayjay': {
      const hits = bumpHit(game, card.id);
      if (hits % 5 === 0) expose(enemy, 0.25, 5);
      break;
    }
    case 'jeff':
    case 'chris':
    case 'cbj':
      break;
    default: {
      const _exhaustive: never = card.hero;
      return _exhaustive;
    }
  }
}

/** Basic-hit procs after damage is applied. */
export function onKitHit(game: Game, enemy: Enemy, baseDamage: number): void {
  if (!heroOnYard(game) || enemy.dead) return;
  const damageType = game.attackProfile.damageType;
  for (const card of activeCards(game)) {
    switch (card.job) {
      case 'breaker':
        onBreakerHit(game, enemy, card);
        break;
      case 'sweep':
        onSweepHit(game, enemy, card, baseDamage, damageType);
        break;
      case 'control':
        onControlHit(game, enemy, card);
        break;
      case 'pin':
        onPinHit(game, enemy, card, baseDamage, damageType);
        break;
      case 'anchor':
      case 'lane':
      case 'crew':
      case 'spot':
        break;
      default: {
        const _exhaustive: never = card.job;
        return _exhaustive;
      }
    }
  }
}

function applyCrewAura(game: Game, card: KitCard): void {
  switch (card.hero) {
    case 'jeff':
      towerAura(game, 160, { dmg: 0.12 });
      break;
    case 'mike':
      towerAura(game, 160, { rate: 0.12 });
      break;
    case 'bob':
      game.kitTowerMark = 0.15;
      break;
    case 'becbec':
      towerAura(game, 150, { dmg: 0.12 });
      break;
    case 'chris':
    case 'cbj':
    case 'doni':
    case 'jayjay':
      break;
    default: {
      const _exhaustive: never = card.hero;
      return _exhaustive;
    }
  }
}

function applySpotAura(game: Game, card: KitCard): void {
  switch (card.hero) {
    case 'jeff':
      towerAura(game, 200, { range: 0.08 });
      break;
    case 'mike':
      break;
    case 'bob':
      towerAura(game, 180, { range: 0.1 });
      break;
    case 'chris':
      towerAura(game, 170, { rate: 0.1 });
      break;
    case 'becbec':
      towerAura(game, 170, { dmg: 0.08 });
      break;
    case 'cbj':
      towerAura(game, 180, { rate: 0.1 });
      break;
    case 'doni':
      towerAura(game, 180, { range: 0.08 });
      break;
    case 'jayjay':
      towerAura(game, 190, { dmg: 0.1 });
      break;
    default: {
      const _exhaustive: never = card.hero;
      return _exhaustive;
    }
  }
}

/** Per-tick auras and helper timers while the hero is deployed. */
export function updateKitCards(game: Game, dt: number): void {
  game.kitTowerMark = 0;
  if (!heroOnYard(game)) return;
  for (const card of activeCards(game)) {
    switch (card.job) {
      case 'crew':
        applyCrewAura(game, card);
        break;
      case 'spot':
        applySpotAura(game, card);
        break;
      case 'anchor':
      case 'breaker':
      case 'lane':
      case 'pin':
      case 'control':
      case 'sweep':
        break;
      default: {
        const _exhaustive: never = card.job;
        return _exhaustive;
      }
    }
  }
  for (const card of activeCards(game)) {
    if (card.job !== 'crew') continue;
    switch (card.hero) {
      case 'chris':
        maybeHelper(game, dt, 1, 8, 22);
        break;
      case 'cbj':
        maybeHelper(game, dt, 2, 10, 28);
        break;
      case 'doni':
        maybeHelper(game, dt, 1, 10, 20);
        break;
      case 'jayjay':
        maybeHelper(game, dt, 1, 12, 20);
        break;
      default:
        break;
    }
  }
}

/** Mike Tailgate Call: +20% Logan and helper summon damage while deployed. */
export function kitSummonDamageMult(game: Game): number {
  if (!heroOnYard(game) || game.heroDef.id !== 'mike') return 1;
  return activeCards(game).some(c => c.job === 'spot') ? 1.2 : 1;
}
