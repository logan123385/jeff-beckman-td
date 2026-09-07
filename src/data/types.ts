import type { Vec } from '../core/vec';

export type DamageType = 'physical' | 'fire' | 'water' | 'heat';

export type TowerId = 'torch' | 'washer' | 'barricade' | 'vent' | 'radiant' | 'expansion';

export type EnemyId =
  | 'drip'
  | 'sludge'
  | 'scaleCrab'
  | 'steamWisp'
  | 'pressureSpike'
  | 'airlock'
  | 'frozenMain'
  | 'rogueBoiler';

export type TowerKind = 'shooter' | 'barricade' | 'aura';
export type TargetMode = 'ground' | 'air' | 'both';

export interface TowerLevel {
  /** Cost to buy (level 1) or to upgrade into this level. */
  cost: number;
  damage: number;
  range: number;
  /** Shots per second for shooters / barricades; ticks per second for damaging auras. */
  fireRate: number;
  /** Barricade durability. */
  hp?: number;
  /** Barricade: max ground enemies held at once. */
  holds?: number;
  /** Splash radius for AoE shooters. */
  splash?: number;
  /** Slow fraction (0.4 = enemies move at 60%). */
  slow?: number;
  /** Support aura: damage / range multiplier bonus for towers in range. */
  dmgBuff?: number;
  rangeBuff?: number;
  /** Support aura: seconds between surge absorptions. */
  shieldCooldown?: number;
}

export interface TowerDef {
  id: TowerId;
  name: string;
  role: string;
  blurb: string;
  damageType: DamageType;
  targets: TargetMode;
  kind: TowerKind;
  /** Damage multiplier applied against ground enemies (anti-air specialists). */
  groundMult?: number;
  /** Projectile speed; undefined = instant hit (beam). */
  projectileSpeed?: number;
  levels: [TowerLevel, TowerLevel, TowerLevel];
  color: string;
}

export type EnemyTrait = 'damagesBarricades' | 'phases' | 'freezes' | 'boss';

export interface EnemyDef {
  id: EnemyId;
  name: string;
  fantasy: string;
  counters: string;
  hp: number;
  /** Pixels per second. */
  speed: number;
  /** 0–1 fraction of physical damage negated. */
  armor: number;
  flying: boolean;
  bounty: number;
  livesCost: number;
  /** Damage per second dealt to barricades / Jeff while held. */
  dps: number;
  /** Multiplier on dps when attacking barricades. */
  barricadeMult?: number;
  radius: number;
  /** Damage-type multipliers; 0.5 = resists, 2 = weak to. */
  damageMult?: Partial<Record<DamageType, number>>;
  traits: EnemyTrait[];
  color: string;
}

export interface SpawnGroup {
  enemy: EnemyId;
  count: number;
  /** Seconds between spawns within the group. */
  interval: number;
  /** Seconds after wave start before the first spawn. */
  delay: number;
  /** Index into MapDef.paths. */
  path: number;
}

export interface WaveDef {
  groups: SpawnGroup[];
}

export interface MapPalette {
  bg: string;
  wall: string;
  pipe: string;
  pipeDark: string;
  accent: string;
}

export interface MapDef {
  id: string;
  name: string;
  subtitle: string;
  blurb: string;
  paths: Vec[][];
  slots: Vec[];
  jeffStart: Vec;
  startMoney: number;
  lives: number;
  allowedTowers: TowerId[];
  waves: WaveDef[];
  palette: MapPalette;
}

export type SkillBranch = 'tools' | 'jeff' | 'shop';

/** Multiplicative / additive modifiers applied to a run. All default to neutral. */
export interface Modifiers {
  towerDamage: number;
  towerCost: number;
  towerRange: number;
  jeffHp: number;
  jeffSpeed: number;
  jeffDamage: number;
  cooldown: number;
  stunDuration: number;
  startMoney: number;
  sellRate: number;
  bounty: number;
}

export interface SkillNode {
  id: string;
  branch: SkillBranch;
  tier: 1 | 2 | 3;
  name: string;
  desc: string;
  apply: (m: Modifiers) => void;
}

export type DifficultyId = 'apprentice' | 'journeyman' | 'master';

export interface Difficulty {
  id: DifficultyId;
  name: string;
  blurb: string;
  hpMult: number;
  livesMult: number;
}
