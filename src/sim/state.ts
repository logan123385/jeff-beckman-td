import type { Vec } from '../core/vec';
import type { DamageType, EnemyDef, EnemyId, LeakProperty, TowerDef, TowerId } from '../data/types';
import type { Specialization } from '../data/specializations';
import type { AbilitySlot, HeroId } from '../data/heroes';
import type { SpecialistAbilityId } from '../data/specialistAbilities';

export type DamageSource = 'jeff' | 'crew' | TowerId;

export interface Enemy {
  id: number;
  def: EnemyDef;
  hp: number;
  maxHp: number;
  pathIdx: number;
  progress: number;
  pos: Vec;
  /** Last sim-tick position for render interpolation. */
  prev: Vec;
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
  revealTimer?: number;
  armorShred: number;
  /** Hero aura only; reset every simulation step independently of timed debuffs. */
  auraArmorShred?: number;
  shredTimer: number;
  freezeTimer: number;
  bossPhase: number;
  ventTimer: number;
  dead: boolean;
  escaped: boolean;
  /** Seconds the corpse stays on the yard after death. */
  deathAge: number;
  /** Attack cooldown while held. */
  attackTimer: number;
  wobble: number;
  dotDps: number;
  dotTime: number;
  dotSource: DamageSource | null;
  marked: boolean;
  markBonus?: number;
  /** Snapshot / camera paint that survives the per-frame aura reset. */
  markHold: number;
  haste: number;
  laneTimer: number;
  /** White flash + squash after a real hit. */
  hitFlash: number;
  attackSwing?: number;
  attackLanded?: boolean;
  /** Unresolved projectile damage so other towers do not pile onto a doomed leak. */
  incoming: number;
  /** Stacked Bloons-style flags (mineral / cast / regen / pressurized). Never camo. */
  properties: LeakProperty[];
  /** Cast-iron jacket HP sitting on top of `hp`. */
  shellHp: number;
  maxShell: number;
  /** Regen pauses while this is > 0 (set by fire / heat). */
  burnTimer: number;
  burn?: { dps: number; left: number; source: TowerId };
  exposed?: { left: number; strength: number };
  ventCast?: { pos: Vec; left: number; duration: number };
}

export type HoldRef = { kind: 'tower'; id: number } | { kind: 'crew'; id: number } | { kind: 'friendly'; id: number } | { kind: 'summon'; id: number } | { kind: 'hero' } | { kind: 'clamp' };

export interface Crew {
  pendingTarget?: number;
  id: number;
  pos: Vec;
  prev: Vec;
  home: Vec;
  hp: number;
  maxHp: number;
  timeLeft: number;
  attackTimer: number;
  swing: number;
  facing: number;
}

export type FriendlyRole = 'apprentice' | 'jayjay' | 'cbj' | 'doni';
export interface Friendly {
  id: number; towerId: number; role: FriendlyRole; slot: number;
  pos: Vec; prev: Vec; home: Vec; hp: number; maxHp: number; armor: number;
  damage: number; range: number; rate: number; holds: number;
  respawn: number; targetId: number | null; attackTimer: number;
  moveBlend?: number; fall?: number;
  swing: number; hitLanded: boolean; facing: number; moving: boolean;
  walkPhase: number; tier: number;
}

export interface Tower {
  id: number;
  def: TowerDef;
  slot: number;
  pos: Vec;
  /** Where the tower engages the path (barricades deploy onto the nearest pipe). */
  rally: Vec;
  level: number;
  mastery?: number;
  cooldown: number;
  hp: number;
  maxHp: number;
  /** Barricade rebuild timer after being broken. */
  rebuild: number;
  frozen: number;
  shieldCooldown: number;
  /** Visual: last target position for beams / turret facing. */
  facing: number;
  /** Presentation facing — lerped in the renderer. */
  drawFacing?: number;
  recoil: number;
  invested: number;
  /** PRV charge (enemy-seconds in range). */
  charge: number;
  /** Who a shooter prefers. Auras and barricades ignore this. */
  aim: AimPriority;
  specialization?: Specialization;
  eliteCooldown?: number;
  windup?: number;
  /** Seconds left of Kingdom Rush–style construction. Can't fire while > 0. */
  build?: number;
  /** Last aimed enemy, for the selected-tower aim line. */
  lastTargetId?: number;
  /** Seconds until the activated tool can fire again. */
  abilityCd: number;
  /** Temporary fire-rate surge from Circulator / Thermostat actives. */
  surge?: number;
  abilities?: Partial<Record<SpecialistAbilityId, { rank: number; cooldown: number }>>;
  overclock?: { left: number; strength: number };
  overheated?: number;
}

/** Kingdom Rush–style target priority for shooters. */
export type AimPriority = 'first' | 'strong' | 'close' | 'last' | 'weak';

export interface Projectile {
  id: number;
  pos: Vec;
  prev: Vec;
  from: Vec;
  targetId: number;
  lastTargetPos: Vec;
  speed: number;
  damage: number;
  /** Mitigated amount already counted on `Enemy.incoming`. */
  reserved: number;
  damageType: DamageType;
  splash: number;
  source: DamageSource;
  groundMult: number;
  color: string;
  life: number;
  ttl: number;
  home: boolean;
  /** Descaler (and similar) carry their own tower stats so two pads do not share one roll. */
  shred?: number;
  dot?: number;
  dotTime?: number;
}

export interface Hero {
  id?: HeroId;
  cast?: { slot: AbilitySlot; left: number; duration: number; fired: boolean; target: Vec; targetId?: number; hits: number };
  swingDuration?: number;
  overdrive?: number;
  shield?: number;
  lifesteal?: number;
  taunt?: number;
  pos: Vec;
  prev: Vec;
  /** Last move / hunt focus for ground markers and repair. */
  anchor: Vec;
  dest: Vec | null;
  hp: number;
  maxHp: number;
  attackTimer: number;
  /** Swings since the last Wrench Tap. */
  tapCount: number;
  clampCooldown: number;
  shutoffCooldown: number;
  pulseCooldown: number;
  sleeveCooldown: number;
  coffeeCooldown: number;
  sleeveTimer: number;
  coffeeTimer: number;
  downed: number;
  /** False while waiting in the truck or after a down — click the yard to drop them. */
  deployed: boolean;
  facing: number;
  /** Soft −1…1 facing used only for drawing (lerps toward `facing`). */
  faceVisual?: number;
  swing: number;
  /** Sticky Diablo-style attack order — Jeff only swings this enemy until it dies. */
  orderTargetId: number | null;
  /** Set by the first wrench click. Stays on until a move order, so the next leak is picked up automatically. */
  engaged: boolean;
  /** Currently engaging (derived each frame from the order). */
  targetId: number | null;
  moveBlend?: number;
  pendingStrike?: number;
  moving?: boolean;
  walkPhase?: number;
  castTimer?: number;
}

export interface HeroMissile {
  id: number; kind: 'plunger' | 'golf' | 'tater' | 'hook'; from: Vec; pos: Vec; prev: Vec; goal: Vec; targetId?: number;
  age: number; duration: number; damage: number; splash: number; bounces: number; hitIds: number[];
  pull?: number; stun?: number;
}
export interface HeroZone {
  id: number; kind: 'supply' | 'gas' | 'rain' | 'review' | 'sand' | 'net' | 'taterRain'; pos: Vec; radius: number;
  left: number; duration: number; tick: number; ticks: number; targetIds?: number[];
}
export interface HeroVisual {
  kind: 'laser' | 'emp' | 'horn' | 'saw' | 'summon' | 'buff' | 'golf' | 'punch' | 'slam' | 'current' | 'hook';
  from: Vec; to: Vec; radius: number; color: string; left: number; duration: number;
}
export interface HeroSummon {
  anchor: Vec;
  id: number; pos: Vec; prev: Vec; hp: number; maxHp: number; left: number; duration: number;
  facing: number; walkPhase: number; moving: boolean; moveBlend: number;
  swing: number; attackTimer: number; targetId?: number; pendingTarget?: number;
}

export interface Clamp {
  pos: Vec;
  timeLeft: number;
}

export interface StrikeDrop {
  pos: Vec;
  delay: number;
  radius: number;
  damage: number;
  fired: boolean;
}

export type JeffSkillId = 'clamp' | 'shutoff' | 'pulse' | 'sleeve' | 'coffee';

export type Effect =
  | { kind: 'death'; pos: Vec; enemy: EnemyId; radius: number; ttl: number; max: number }
  | { kind: 'beam'; from: Vec; to: Vec; color: string; ttl: number; max: number }
  | { kind: 'hit'; pos: Vec; color: string; ttl: number; max: number }
  | { kind: 'splash'; pos: Vec; radius: number; color: string; ttl: number; max: number }
  | { kind: 'ring'; pos: Vec; radius: number; color: string; ttl: number; max: number }
  | { kind: 'text'; pos: Vec; text: string; color: string; ttl: number; max: number }
  | { kind: 'skill'; pos: Vec; skill: JeffSkillId; ttl: number; max: number };

export interface ActiveSpawn {
  enemy: EnemyId;
  remaining: number;
  interval: number;
  timer: number;
  path: number;
  properties: LeakProperty[];
}

export interface RunStats {
  jeffDamage: number;
  crewDamage: number;
  towerDamage: Record<TowerId, number>;
  kills: number;
  jeffKills: number;
  escaped: number;
  moneyEarned: number;
  moneySpent: number;
  wavesCalledEarly: number;
  partsEarned: number;
  partsSpent: number;
  escapedByType: Partial<Record<EnemyId, number>>;
}

export type GameStatus = 'playing' | 'won' | 'lost' | 'retired';
