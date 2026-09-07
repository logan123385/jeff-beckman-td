import type { Vec } from '../core/vec';
import type { DamageType, EnemyDef, EnemyId, TowerDef, TowerId } from '../data/types';

export type DamageSource = 'jeff' | TowerId;

export interface Enemy {
  id: number;
  def: EnemyDef;
  hp: number;
  maxHp: number;
  pathIdx: number;
  progress: number;
  pos: Vec;
  /** Visual lateral offset so groups don't stack perfectly. */
  lane: number;
  speedMult: number;
  /** Strongest slow this frame (0..1). Recomputed every step. */
  slow: number;
  stun: number;
  /** Id of barricade / hero / clamp holding this enemy, or null. */
  heldBy: HoldRef | null;
  phaseTimer: number;
  phased: boolean;
  armorShred: number;
  shredTimer: number;
  freezeTimer: number;
  bossPhase: number;
  ventTimer: number;
  dead: boolean;
  escaped: boolean;
  /** Attack cooldown while held. */
  attackTimer: number;
  wobble: number;
}

export type HoldRef = { kind: 'tower'; id: number } | { kind: 'hero' } | { kind: 'clamp' };

export interface Tower {
  id: number;
  def: TowerDef;
  slot: number;
  pos: Vec;
  /** Where the tower engages the path (barricades deploy onto the nearest pipe). */
  rally: Vec;
  level: 0 | 1 | 2;
  cooldown: number;
  hp: number;
  maxHp: number;
  /** Barricade rebuild timer after being broken. */
  rebuild: number;
  frozen: number;
  shieldCooldown: number;
  /** Visual: last target position for beams / turret facing. */
  facing: number;
  recoil: number;
  invested: number;
}

export interface Projectile {
  id: number;
  pos: Vec;
  targetId: number;
  lastTargetPos: Vec;
  speed: number;
  damage: number;
  damageType: DamageType;
  splash: number;
  source: DamageSource;
  groundMult: number;
  color: string;
}

export interface Hero {
  pos: Vec;
  /** Last commanded position; Jeff only engages enemies near here. */
  anchor: Vec;
  dest: Vec | null;
  hp: number;
  maxHp: number;
  attackTimer: number;
  tapTimer: number;
  clampCooldown: number;
  shutoffCooldown: number;
  downed: number;
  facing: number;
  swing: number;
  targetId: number | null;
}

export interface Clamp {
  pos: Vec;
  timeLeft: number;
}

export type Effect =
  | { kind: 'beam'; from: Vec; to: Vec; color: string; ttl: number; max: number }
  | { kind: 'hit'; pos: Vec; color: string; ttl: number; max: number }
  | { kind: 'splash'; pos: Vec; radius: number; color: string; ttl: number; max: number }
  | { kind: 'ring'; pos: Vec; radius: number; color: string; ttl: number; max: number }
  | { kind: 'text'; pos: Vec; text: string; color: string; ttl: number; max: number };

export interface ActiveSpawn {
  enemy: EnemyId;
  remaining: number;
  interval: number;
  timer: number;
  path: number;
}

export interface RunStats {
  jeffDamage: number;
  towerDamage: Record<TowerId, number>;
  kills: number;
  jeffKills: number;
  escaped: number;
  moneyEarned: number;
  moneySpent: number;
  wavesCalledEarly: number;
}

export type GameStatus = 'playing' | 'won' | 'lost';
