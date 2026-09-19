import type { Vec } from '../core/vec';

export type DamageType = 'physical' | 'fire' | 'water' | 'heat';

export type TowerId =
  | 'torch'
  | 'washer'
  | 'barricade'
  | 'vent'
  | 'radiant'
  | 'expansion'
  | 'pipeSnake'
  | 'backflow'
  | 'descaler'
  | 'circulator'
  | 'prv'
  | 'boiler'
  | 'hammerDrill'
  | 'glycol'
  | 'sump'
  | 'camera'
  | 'manifold'
  | 'mixingValve'
  | 'airSeparator'
  | 'thermostat'
  | 'heatExchanger'
  | 'dirtSep'
  | 'steamTrap'
  | 'zoneValve';

export type RemasterId = 'classic' | 'codeInspection' | 'frozenMain';

export type EnemyId =
  | 'drip'
  | 'sludge'
  | 'scaleCrab'
  | 'steamWisp'
  | 'pressureSpike'
  | 'airlock'
  | 'frozenMain'
  | 'rogueBoiler'
  | 'hardWaterGnat'
  | 'sedimentBoulder'
  | 'codeViolation'
  | 'condensateMoth'
  | 'glycolGolem'
  | 'zincWhisker'
  | 'biofilm'
  | 'waterHammer'
  | 'limeScale'
  | 'vacuumBreak'
  | 'pexKink'
  | 'flangeGremlin';

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
  /** Pipe Snake: how far along the pipe (px of path progress) a pierce shot travels. */
  pierce?: number;
  /** Backflow: pixels of path progress to shove ground enemies backward. */
  push?: number;
  /** Descaler: extra armor shred applied on hit. */
  shred?: number;
  /** Descaler: damage-over-time per second and duration. */
  dot?: number;
  dotTime?: number;
  /** Circulator: projectile speed and Jeff haste multipliers (1.2 = +20%). */
  projSpeed?: number;
  jeffHaste?: number;
  /** PRV: enemy-seconds in range before a relief burst. */
  chargeNeed?: number;
  burstRadius?: number;
  /** Sump: path-progress pixels pulled toward the pump per pulse. */
  pull?: number;
  /** Thermostat: extra fire-rate for towers in range. */
  rateBuff?: number;
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
  /** Extra damage multiplier times the target's armor (Hammer Drill). */
  armorBonus?: number;
  levels: [TowerLevel, TowerLevel, TowerLevel];
  color: string;
}

export type EnemyTrait = 'damagesBarricades' | 'phases' | 'freezes' | 'boss' | 'laneSwap' | 'hasteAura' | 'splits';

export type GearSlot = 'wrench' | 'boots' | 'belt' | 'shirt' | 'gauges';
export type Rarity = 'common' | 'uncommon' | 'rare' | 'relic';
export type TalentBranch = 'combat' | 'field' | 'foreman';
export type ChestQuality = 'job' | 'clean' | 'remaster' | 'night' | 'deepNight';
export type AffixKey =
  | 'jeffDamage'
  | 'jeffHp'
  | 'jeffSpeed'
  | 'cooldown'
  | 'stunDuration'
  | 'jeffHolds'
  | 'jeffRepair'
  | 'jeffReach'
  | 'jeffRespawn'
  | 'startMoney'
  | 'towerDamage';

export interface GearAffix {
  key: AffixKey;
  amount: number;
}

export interface GearItem {
  id: string;
  name: string;
  slot: GearSlot;
  rarity: Rarity;
  affixes: GearAffix[];
}

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
  /** Towers locked out on the Code Inspection remaster (the "intended" answers). */
  inspectionBan?: TowerId[];
  /** Endless Night Shift maps never run out of scripted waves — the sim generates more. */
  endless?: boolean;
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
  jeffHolds: number;
  jeffRepair: number;
  jeffReach: number;
  jeffRespawn: number;
  jeffTapEvery: number;
}

export interface SkillNode {
  id: string;
  branch: SkillBranch;
  tier: 1 | 2 | 3;
  name: string;
  desc: string;
  apply: (m: Modifiers) => void;
}

export interface TalentNode {
  id: string;
  branch: TalentBranch;
  tier: 1 | 2 | 3 | 4;
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
