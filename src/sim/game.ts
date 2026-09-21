import { Rng } from '../core/rng';
import { clamp, dist, type Vec } from '../core/vec';
import { enemyForMap } from '../data/bosses';
import { JEFF } from '../data/jeff';
import { COOLDOWN_FIELDS, HEROES, isHeroId, type AbilitySlot, type HeroDef, type HeroId } from '../data/heroes';
import { updateHeroMissiles, updateHeroSummons, summonLogan, useHeroAbility, fireJeffAbility } from './heroPowers';
import type { HeroMissile, HeroSummon, HeroVisual, HeroZone } from './state';
import { TOWERS, TOWER_ORDER } from '../data/towers';
import { SPECIALIST_KITS, specialistAbilityCost, type SpecialistAbilityId } from '../data/specialistAbilities';
import { specializeDef, specializationInfo, type Specialization } from '../data/specializations';
import { generateEndlessWave, nightMutatorAt, proceduralIndex, type NightMutatorId } from '../data/night';
import { propertiesFor } from '../data/leakProperties';
import { isNoPowers, isNoSell, isOneLife, isTruckMoney } from '../data/remasters';
import { fieldRbe } from '../data/splits';
import type { Difficulty, EnemyId, LeakProperty, MapDef, Modifiers, RemasterId, TowerId, WaveDef } from '../data/types';
import { AIM_ORDER, applyDamage, canTowerDamage, heroOnYard, isTargetable, matchesTargetMode, missionXpToNext, predictedPos, abilityRangeFactor, abilityRank } from './combat';
import { updateEnemies } from './enemies';
import { updateHero } from './hero';
import { Path } from './path';
import type { ActiveSpawn, AimPriority, Clamp, Crew, Friendly, Effect, Enemy, GameStatus, Hero, Projectile, RunStats, StrikeDrop, Tower, WaveReport } from './state';
import { releaseFriendly, syncRecruits, updateFriendlies } from './friendlies';
import { CREW_COOLDOWN, updateCrew } from './crew';
import { applyDescaler, updateAuras, updateTowers } from './towers';
import { useTowerAbility as fireTowerAbility } from './towerAbilities';

export interface GameOptions {
  difficulty: Difficulty;
  mods: Modifiers;
  seed?: number;
  heroEnabled?: boolean;
  heroId?: HeroId;
  remaster?: RemasterId;
  /** If set, only these tools can be built (already intersected with the job). */
  loadout?: TowerId[];
  /** Player-facing games wait for the first call; headless simulations may keep timed starts. */
  manualStart?: boolean;
}

export const FIRST_WAVE_COUNTDOWN = 16;
export const BETWEEN_WAVE_GRACE = 12;
export const CLEAR_BREATHER = 6;
export const EARLY_CALL_BONUS_PER_SECOND = 1.5;
export const STRIKE_COOLDOWN = 62;
export const STRIKE_RADIUS = 80;
export const STRIKE_DAMAGE = 54;
export const BUILD_TIME = 0.82;
export const HERO_LEVEL_CAP = 10;
export const SPAWN_LEAD = 36;
export const LANE_SPREAD = [-16, 16, -8, 8, 0, -12, 12] as const;

export class Game {
  readonly map: MapDef;
  readonly paths: Path[];
  readonly difficulty: Difficulty;
  readonly mods: Modifiers;
  readonly rng: Rng;
  readonly heroEnabled: boolean;
  readonly heroDef: HeroDef;
  readonly remaster: RemasterId;
  readonly endless: boolean;
  readonly allowedTowers: TowerId[];
  readonly freezeDurationMult: number;
  readonly manualStart: boolean;
  /** Recomputed each frame by circulator auras. */
  projSpeedMult = 1;
  jeffSpeedAura = 1;
  jeffCdAura = 1;
  peakTowerCount = 0;
  readonly builtTypes = new Set<TowerId>();
  nightMutator: NightMutatorId | null = null;

  enemies: Enemy[] = [];
  towers: Tower[] = [];
  projectiles: Projectile[] = [];
  effects: Effect[] = [];
  hero: Hero;
  heroMissiles: HeroMissile[] = [];
  heroSummons: HeroSummon[] = [];
  heroVisuals: HeroVisual[] = [];
  heroZones: HeroZone[] = [];
  heroNotice: { name: string; detail: string; color: string; left: number } | null = null;
  clamp: Clamp | null = null;
  crew: Crew[] = [];
  friendlies: Friendly[] = [];
  completedWaves = 0;
  private activeWaves = new Map<number, { started: number; kills: number; leaks: number; livesLost: number; bounty: number }>();
  readonly waveReports: WaveReport[] = [];
  cleanWaves = 0;
  cleanStreak = 0;
  bestCleanStreak = 0;
  private nextStreakWave = 1;
  private pendingStreaks = new Map<number, boolean>();
  callRecovery = 0;
  lastEarlyCall: { bonus: number; recovery: number; left: number } | null = null;
  crewCooldown = 0;
  strikeCooldown = 0;
  strikes: StrikeDrop[] = [];
  waveLeaks = 0;

  money: number;
  lives: number;
  /** Spare parts spent on activated tools. */
  parts: number;
  /** Recruits swing faster while this is > 0. */
  overtime = 0;
  time = 0;
  /** Number of waves that have started. */
  waveIdx = 0;
  /** Current wave is a packed rush (set on startWave). */
  waveRush = false;
  /** Seconds until the next wave auto-starts; negative when no wave is pending. */
  waveCountdown = FIRST_WAVE_COUNTDOWN;
  spawns: ActiveSpawn[] = [];
  spawnPause = 0;
  globalSlow = 0;
  globalSlowTimer = 0;
  status: GameStatus = 'playing';
  stats: RunStats;
  seen = new Set<EnemyId>();
  /** Per-frame support buffs keyed by tower id. */
  buffs = new Map<number, { dmg: number; range: number; rate: number }>();
  /** In-mission hero rank (1–10). Buffs hero damage and grows max HP. */
  heroLevel = 1;
  heroXp = 0;
  /** Per-ability stars (0–3). One pick per level-up from 2–10. */
  abilityRanks: [number, number, number, number, number] = [0, 0, 0, 0, 0];
  pendingRankUps = 0;
  /** Brief presentation freeze; ticks down in update and skips sim. */
  hitstop = 0;
  private impactRest = 0;
  combo = 0;
  comboTimer = 0;
  /** Set when a wave just cleared so the HUD can auto-pause. */
  waveJustCleared = false;

  private idCounter = 1;

  constructor(map: MapDef, opts: GameOptions) {
    this.map = map;
    this.paths = map.paths.map((p) => new Path(p));
    this.difficulty = opts.difficulty;
    this.mods = opts.mods;
    this.rng = new Rng(opts.seed ?? 1);
    this.heroEnabled = opts.heroEnabled ?? true;
    this.heroDef = HEROES[isHeroId(opts.heroId) ? opts.heroId : 'jeff'];
    this.manualStart = opts.manualStart ?? false;
    this.remaster = opts.remaster ?? 'classic';
    this.endless = map.endless === true;
    const banned = this.remaster === 'codeInspection' ? (map.inspectionBan ?? []) : [];
    const pool = map.allowedTowers.filter((id) => !banned.includes(id));
    const kit = [...new Set((opts.loadout ?? []).filter((id) => pool.includes(id)))];
    this.allowedTowers = kit.length > 0 ? kit : pool;
    this.freezeDurationMult = this.remaster === 'frozenMain' ? 1.75 : 1;
    this.nightMutator = null;
    this.money = isTruckMoney(this.remaster) ? map.startMoney : map.startMoney + opts.mods.startMoney;
    this.lives = isOneLife(this.remaster) ? 1 : Math.max(1, Math.round(map.lives * opts.difficulty.livesMult));
    this.parts = this.remaster === 'cleanHands' ? 0 : this.remaster === 'cashJob' ? 2 : 3;
    const maxHp = Math.round(this.heroDef.hp * opts.mods.jeffHp);
    this.hero = {
      id: this.heroDef.id,
      pos: { ...map.jeffStart },
      prev: { ...map.jeffStart },
      anchor: { ...map.jeffStart },
      dest: null,
      hp: maxHp,
      maxHp,
      attackTimer: 0,
      tapCount: 0,
      clampCooldown: 0,
      shutoffCooldown: 0,
      pulseCooldown: 0,
      sleeveCooldown: 0,
      coffeeCooldown: 0,
      sleeveTimer: 0,
      coffeeTimer: 0,
      downed: 0,
      deployed: false,
      facing: 1,
      swing: 0,
      orderTargetId: null,
      engaged: false,
      targetId: null,
    };
    this.stats = {
      jeffDamage: 0,
      crewDamage: 0,
      towerDamage: Object.fromEntries(TOWER_ORDER.map((id) => [id, 0])) as Record<TowerId, number>,
      kills: 0,
      jeffKills: 0,
      escaped: 0,
      moneyEarned: 0,
      moneySpent: 0,
      wavesCalledEarly: 0,
      partsEarned: 0,
      partsSpent: 0,
      escapedByType: {},
    };
  }

  nextEntityId(): number {
    return this.idCounter++;
  }

  addEffect(e: Effect): void {
    if (this.effects.length < 400) this.effects.push(e);
  }

  requestHitstop(seconds: number): void {
    if (seconds <= 0 || this.impactRest > 0) return;
    this.hitstop = Math.min(0.065, Math.max(this.hitstop, seconds));
    this.impactRest = .45;
  }

  grantHeroXp(amount: number): void {
    if (amount <= 0 || this.heroLevel >= HERO_LEVEL_CAP) return;
    this.heroXp += amount;
    while (this.heroLevel < HERO_LEVEL_CAP) {
      const need = missionXpToNext(this.heroLevel);
      if (this.heroXp < need) break;
      this.heroXp -= need;
      this.heroLevel += 1;
      const bonus = Math.round(this.hero.maxHp * 0.08);
      this.hero.maxHp += bonus;
      this.hero.hp = Math.min(this.hero.maxHp, this.hero.hp + bonus + 18);
      this.pendingRankUps += 1;
      this.addEffect({ kind: 'ring', pos: { ...this.hero.pos }, radius: 52, color: '#ffe082', ttl: 0.7, max: 0.7 });
      this.addEffect({
        kind: 'text',
        pos: { x: this.hero.pos.x, y: this.hero.pos.y - 56 },
        text: `${this.heroDef.name.toUpperCase()} LV ${this.heroLevel}`,
        color: '#fff3c4',
        ttl: 1.6,
        max: 1.6,
      });
    }
  }

  /** Spend one pending level-up pick to rank a hero skill (cap 3). */
  rankAbility(slot: AbilitySlot): boolean {
    if (this.status !== 'playing' || this.pendingRankUps <= 0) return false;
    if (![0, 1, 2, 3, 4].includes(slot)) return false;
    const cur = this.abilityRanks[slot] ?? 0;
    if (cur >= 3) return false;
    this.abilityRanks[slot] = cur + 1;
    this.pendingRankUps -= 1;
    const ability = this.heroDef.abilities[slot];
    const pos = this.hero.deployed ? this.hero.pos : { x: 480, y: 280 };
    this.addEffect({ kind: 'ring', pos: { ...pos }, radius: 44, color: '#ffe082', ttl: 0.55, max: 0.55 });
    this.addEffect({
      kind: 'text',
      pos: { x: pos.x, y: pos.y - 52 },
      text: `${ability.name.toUpperCase()} ★${this.abilityRanks[slot]}`,
      color: '#fff3c4',
      ttl: 1.3,
      max: 1.3,
    });
    return true;
  }

  // ---------------------------------------------------------------- queries

  get totalWaves(): number {
    return this.endless ? Number.POSITIVE_INFINITY : this.map.waves.length;
  }

  get allWavesStarted(): boolean {
    return !this.endless && this.waveIdx >= this.map.waves.length;
  }

  get waveActive(): boolean {
    return this.spawns.length > 0 || this.enemies.some((e) => !e.dead && !e.escaped);
  }

  /** Calling is a deliberate overlap, never a stack of unspawned waves. */
  get canCallWave(): boolean {
    return this.status === 'playing' && !this.allWavesStarted && this.waveCountdown >= 0
      && this.spawns.length === 0 && this.activeWaves.size < 2 && !(this.endless && this.waveActive);
  }

  get callBlockReason(): string {
    return this.allWavesStarted ? 'Final wave — hold the line.'
      : this.spawns.length > 0 ? 'Let the current group finish entering.'
        : 'Clear a wave before calling another.';
  }

  get callBonus(): number {
    if (!this.canCallWave) return 0;
    return Math.floor(Math.min(this.waveIdx === 0 ? FIRST_WAVE_COUNTDOWN : BETWEEN_WAVE_GRACE,
      Math.max(0, this.waveCountdown)) * EARLY_CALL_BONUS_PER_SECOND);
  }

  get callCooldownRecovery(): number {
    return this.canCallWave && this.waveIdx > 0 && !isNoPowers(this.remaster)
      ? Math.min(8, Math.max(0, this.waveCountdown)) : 0;
  }

  recordKill(enemy: Enemy, bounty: number): void {
    const wave = this.activeWaves.get(enemy.waveId ?? this.waveIdx);
    if (wave) { wave.kills++; wave.bounty += bounty; }
  }

  recordLeak(enemy: Enemy, livesLost: number): void {
    this.waveLeaks++;
    const wave = this.activeWaves.get(enemy.waveId ?? this.waveIdx);
    if (wave) { wave.leaks++; wave.livesLost += livesLost; }
  }

  nextWaveEnemies(): EnemyId[] {
    const w = this.waveDefAt(this.waveIdx);
    if (!w) return [];
    return [...new Set(w.groups.map((g) => g.enemy))];
  }

  waveHealthScale(index: number): number {
    index = Math.max(0, index);
    return this.endless ? 1 + index * .03 + Math.pow(Math.max(0, index - 24), 1.4) * .006 : 1 + Math.max(0, index - 4) * .012;
  }

  previewHealth(id: EnemyId, index: number, properties: readonly LeakProperty[]): number {
    const base = Math.round(enemyForMap(id, this.map.id).hp * this.difficulty.hpMult * this.waveHealthScale(index));
    return properties.includes('pressurized') ? Math.round(base * 1.45) : base;
  }

  nextWavePreview(offset = 0): { enemy: EnemyId; count: number; path: number; properties: LeakProperty[] }[] {
    const index = this.waveIdx + Math.max(0, Math.floor(offset));
    const groups = this.waveDefAt(index)?.groups ?? [];
    const mut = this.mutatorFor(index);
    const preview: { enemy: EnemyId; count: number; path: number; properties: LeakProperty[] }[] = [];
    for (const group of groups) {
      const properties = propertiesFor(group.enemy, index, mut, group.properties);
      const old = preview.find(
        (p) => p.enemy === group.enemy && p.path === group.path && p.properties.join() === properties.join(),
      );
      if (old) old.count += group.count;
      else preview.push({ enemy: group.enemy, count: group.count, path: group.path, properties });
    }
    return preview;
  }

  waveEntryDuration(offset = 0): number {
    const groups = this.waveDefAt(this.waveIdx + offset)?.groups ?? [];
    return groups.reduce((last, group) => Math.max(last, group.delay + (group.count - 1) * group.interval), 0);
  }

  nextWaveIsRush(): boolean {
    return this.waveDefAt(this.waveIdx)?.rush === true;
  }

  /** Lives on the line if everyone still queued or walking leaks, including unspawned children. */
  pipeRbe(): number {
    return fieldRbe(
      this.enemies
        .filter((e) => !e.dead && !e.escaped)
        .map((e) => ({ id: e.def.id, pressurized: e.properties.includes('pressurized') })),
      this.spawns,
    );
  }

  nearestPath(p: Vec): { pathIdx: number; progress: number } {
    let best = { pathIdx: 0, progress: 0, dist: Infinity };
    this.paths.forEach((path, i) => {
      const n = path.nearestPoint(p);
      if (n.dist < best.dist) best = { pathIdx: i, progress: n.progress, dist: n.dist };
    });
    return { pathIdx: best.pathIdx, progress: best.progress };
  }

  towerAt(slot: number): Tower | undefined {
    return this.towers.find((t) => t.slot === slot);
  }

  towerById(id: number): Tower | undefined {
    return this.towers.find((t) => t.id === id);
  }

  towerCost(id: TowerId): number {
    return Math.round(TOWERS[id].levels[0].cost * this.mods.towerCost);
  }

  upgradeCost(t: Tower): number | null {
    if (t.level >= t.def.levels.length - 1) return null;
    return Math.round(t.def.levels[t.level + 1]!.cost * this.mods.towerCost);
  }

  sellValue(t: Tower): number {
    return Math.round(t.invested * this.mods.sellRate);
  }

  effectiveRange(t: Tower): number {
    const buff = this.buffs.get(t.id)?.range ?? 0;
    return t.def.levels[t.level]!.range * this.mods.towerRange * (1 + buff);
  }

  effectiveDamage(t: Tower): number {
    const buff = this.buffs.get(t.id)?.dmg ?? 0;
    return t.def.levels[t.level]!.damage * this.mods.towerDamage * (1 + buff);
  }

  nearestPathPoint(p: Vec): Vec {
    let best = { pos: p, dist: Infinity };
    for (const path of this.paths) {
      const n = path.nearestPoint(p);
      if (n.dist < best.dist) best = { pos: n.pos, dist: n.dist };
    }
    return { ...best.pos };
  }

  clampRadius(): number {
    return JEFF.clamp.radius * abilityRangeFactor(this, 0);
  }

  clampSlow(): number {
    return Math.min(0.85, JEFF.clamp.slow * (1 + abilityRank(this, 0) * 0.08));
  }

  clampHolds(): number {
    return JEFF.clamp.holds + abilityRank(this, 0);
  }

  // ---------------------------------------------------------------- commands

  /** Summon Logan onto a visible section of the route (shared D skill for every hero). */
  reinforce(pos: Vec): boolean {
    if (isNoPowers(this.remaster)) return false;
    if (this.status !== 'playing' || this.crewCooldown > 0 || !Number.isFinite(pos.x) || !Number.isFinite(pos.y)) return false;
    if (pos.x < 16 || pos.x > 944 || pos.y < 24 || pos.y > 576) return false;
    const rally = this.nearestPathPoint(pos);
    if (dist(pos, rally) > 55 || rally.x < 16 || rally.x > 944 || rally.y < 24 || rally.y > 576) return false;
    this.crewCooldown = CREW_COOLDOWN;
    summonLogan(this, rally);
    this.addEffect({ kind: 'ring', pos: rally, radius: 44, color: '#d4e599', ttl: 0.65, max: 0.65 });
    this.addEffect({ kind: 'text', pos: { x: rally.x, y: rally.y - 48 }, text: 'LOGAN!', color: '#e5ffbb', ttl: 1.1, max: 1.1 });
    return true;
  }

  setRally(towerId: number, pos: Vec): boolean {
    if (this.status !== 'playing' || !Number.isFinite(pos.x) || !Number.isFinite(pos.y)) return false;
    const t = this.towerById(towerId);
    if (!t || t.def.kind !== 'barricade') return false;
    const rally = this.nearestPathPoint(pos);
    if (dist(pos, rally) > 55 || dist(t.pos, rally) > 150 || rally.x < 16 || rally.x > 944 || rally.y < 24 || rally.y > 576) return false;
    for (const e of this.enemies) if (e.heldBy?.kind === 'tower' && e.heldBy.id === t.id) e.heldBy = null;
    t.rally = rally;
    for (const f of this.friendlies.filter(n => n.towerId === t.id)) { releaseFriendly(this, f.id); f.targetId = null; f.swing = 0; }
    syncRecruits(this, t);
    this.addEffect({ kind: 'ring', pos: rally, radius: 24, color: '#b7df89', ttl: 0.5, max: 0.5 });
    return true;
  }

  specializeTower(towerId: number, choice: Specialization): boolean {
    if (this.status !== 'playing' || (choice !== 'power' && choice !== 'control')) return false;
    const t = this.towerById(towerId);
    if (!t || t.level < 2 || t.specialization) return false;
    const cost = Math.round(specializationInfo(t.def, choice).cost * this.mods.towerCost);
    if (this.money < cost) return false;
    this.money -= cost; this.stats.moneySpent += cost; t.invested += cost;
    t.def = specializeDef(t.def, choice); t.specialization = choice; t.eliteCooldown = 0;
    const hp = t.def.levels[t.level]!.hp;
    if (hp) { const ratio = t.maxHp > 0 ? t.hp / t.maxHp : 1; t.maxHp = hp; t.hp = hp * ratio; }
    syncRecruits(this, t);
    this.addEffect({ kind: 'splash', pos: { ...t.pos }, radius: 48, color: '#f5d68c', ttl: 0.7, max: 0.7 });
    this.addEffect({ kind: 'text', pos: { x: t.pos.x, y: t.pos.y - 90 }, text: t.def.name.toUpperCase(), color: '#fff0b0', ttl: 1.3, max: 1.3 });
    return true;
  }

  buySpecialistAbility(towerId: number, abilityId: SpecialistAbilityId): boolean {
    const t = this.towerById(towerId);
    if (this.status !== 'playing' || !t?.specialization || t.level < 2 || !SPECIALIST_KITS[t.def.id].includes(abilityId)) return false;
    const rank = t.abilities?.[abilityId]?.rank ?? 0;
    if (rank >= 3) return false;
    const cost = specialistAbilityCost(abilityId, rank, this.mods.towerCost);
    if (this.money < cost) return false;
    this.money -= cost; this.stats.moneySpent += cost; t.invested += cost;
    t.abilities ??= {};
    t.abilities[abilityId] = { rank: rank + 1, cooldown: t.abilities[abilityId]?.cooldown ?? 0 };
    this.addEffect({ kind: 'ring', pos: { ...t.pos }, radius: 45, color: '#ffe8a0', ttl: .6, max: .6 });
    return true;
  }

  placeTower(slot: number, id: TowerId): boolean {
    if (this.status !== 'playing') return false;
    if (slot < 0 || slot >= this.map.slots.length || this.towerAt(slot)) return false;
    if (!this.allowedTowers.includes(id)) return false;
    const cost = this.towerCost(id);
    if (this.money < cost) return false;
    const def = TOWERS[id];
    const lvl = def.levels[0];
    this.money -= cost;
    this.stats.moneySpent += cost;
    const pos = { ...this.map.slots[slot]! };
    this.towers.push({
      id: this.nextEntityId(),
      def,
      slot,
      pos,
      rally: def.kind === 'barricade' ? this.nearestPathPoint(pos) : pos,
      level: 0,
      cooldown: 0,
      hp: lvl.hp ?? 0,
      maxHp: lvl.hp ?? 0,
      rebuild: 0,
      frozen: 0,
      shieldCooldown: 0,
      facing: -Math.PI / 2,
      recoil: 0,
      invested: cost,
      charge: 0,
      aim: 'first',
      build: BUILD_TIME,
      lastTargetId: 0,
      abilityCd: 0,
    });
    this.peakTowerCount = Math.max(this.peakTowerCount, this.towers.length);
    this.builtTypes.add(id);
    syncRecruits(this, this.towers[this.towers.length - 1]!);
    this.addEffect({ kind: 'ring', pos: { ...pos }, radius: 34, color: '#ffe082', ttl: 0.42, max: 0.42 });
    this.addEffect({ kind: 'splash', pos: { ...pos }, radius: 20, color: def.color, ttl: 0.28, max: 0.28 });
    this.addEffect({ kind: 'text', pos: { x: pos.x, y: pos.y - 36 }, text: 'INSTALLING', color: '#ffe082', ttl: 0.7, max: 0.7 });
    return true;
  }

  upgradeTower(towerId: number): boolean {
    if (this.status !== 'playing') return false;
    const t = this.towerById(towerId);
    if (!t) return false;
    const cost = this.upgradeCost(t);
    if (cost === null || this.money < cost) return false;
    this.money -= cost;
    this.stats.moneySpent += cost;
    t.invested += cost;
    t.level += 1;
    const lvl = t.def.levels[t.level]!;
    if (lvl.hp !== undefined) {
      const ratio = t.maxHp > 0 ? t.hp / t.maxHp : 1;
      t.maxHp = lvl.hp;
      t.hp = t.rebuild > 0 ? t.hp : Math.max(t.hp, lvl.hp * ratio);
    }
    syncRecruits(this, t);
    this.addEffect({ kind: 'ring', pos: { ...t.pos }, radius: 30, color: '#fff', ttl: 0.4, max: 0.4 });
    return true;
  }

  masteryCost(t: Tower): number { return Math.round(1500 * Math.pow(1.28, t.mastery ?? 0) * this.mods.towerCost); }
  reinforceTower(towerId: number): boolean {
    const t = this.towerById(towerId);
    if (!t || t.level !== t.def.levels.length - 1 || this.status !== 'playing') return false;
    const cost = this.masteryCost(t); if (this.money < cost) return false;
    this.money -= cost; this.stats.moneySpent += cost; t.invested += cost; t.mastery = (t.mastery ?? 0) + 1;
    t.def = { ...t.def, levels: t.def.levels.map(l => ({ ...l })) as typeof t.def.levels };
    const l = t.def.levels[t.level]!; l.damage *= 1.14; l.fireRate *= 1.035;
    if (l.hp) { l.hp *= 1.14; t.hp *= 1.14; t.maxHp = l.hp; }
    if (l.dot) l.dot *= 1.14;
    for (const key of ['dmgBuff','rateBuff','rangeBuff','push','pull'] as const) if (l[key]) l[key]! *= 1.08;
    syncRecruits(this, t);
    this.addEffect({ kind: 'ring', pos: { ...t.pos }, radius: 60, color: '#ffe0a0', ttl: 0.8, max: 0.8 });
    return true;
  }

  /** Cycle a shooter's target priority. Returns the new aim, or null if this tool doesn't aim. */
  cycleAim(towerId: number): AimPriority | null {
    const t = this.towerById(towerId);
    if (!t || t.def.kind !== 'shooter') return null;
    t.focusTargetId = undefined;
    const i = AIM_ORDER.indexOf(t.aim);
    t.aim = AIM_ORDER[(i + 1) % AIM_ORDER.length]!;
    return t.aim;
  }

  focusTower(towerId: number, enemyId: number): boolean {
    const t = this.towerById(towerId), e = this.enemies.find(e => e.id === enemyId);
    if (this.status !== 'playing' || !t || t.def.kind !== 'shooter' || t.def.id === 'pipeSnake'
      || !e || !isTargetable(e) || !matchesTargetMode(t.def.targets, e)
      || dist(t.pos, e.pos) > this.effectiveRange(t) + e.def.radius || !canTowerDamage(this, t, e)) return false;
    t.focusTargetId = e.id;
    this.addEffect({ kind: 'ring', pos: { ...e.pos }, radius: e.def.radius + 10, color: '#edc285', ttl: .6, max: .6 });
    return true;
  }

  useTowerAbility(towerId: number): boolean {
    return fireTowerAbility(this, towerId);
  }

  sellTower(towerId: number): boolean {
    if (this.status !== 'playing') return false;
    if (isNoSell(this.remaster)) return false;
    const t = this.towerById(towerId);
    if (!t) return false;
    const value = this.sellValue(t);
    this.money += value;
    for (const e of this.enemies) if (e.heldBy?.kind === 'tower' && e.heldBy.id === t.id) e.heldBy = null;
    for (const f of this.friendlies.filter(n => n.towerId === towerId)) releaseFriendly(this, f.id);
    this.friendlies = this.friendlies.filter(n => n.towerId !== towerId);
    this.towers = this.towers.filter((x) => x.id !== towerId);
    this.addEffect({ kind: 'text', pos: { x: t.pos.x, y: t.pos.y - 20 }, text: `+$${value}`, color: '#ffe082', ttl: 0.9, max: 0.9 });
    return true;
  }

  /** Move-only order. Clears any attack lock — Diablo right-click / ground click. */
  commandHero(pos: Vec): boolean {
    if (!heroOnYard(this) || this.status !== 'playing') return false;
    if (!Number.isFinite(pos.x) || !Number.isFinite(pos.y)) return false;
    const x = Math.max(10, Math.min(950, pos.x));
    const y = Math.max(10, Math.min(590, pos.y));
    if (this.hero.cast) {
      this.hero.queuedOrder = { kind: 'move', pos: { x, y } };
      this.addEffect({ kind: 'ring', pos: { x, y }, radius: 18, color: '#a5d6a7', ttl: .6, max: .6 });
      return true;
    }
    this.hero.queuedOrder = undefined;
    this.hero.dest = { x, y };
    this.hero.pendingStrike = undefined; this.hero.swing = 0;
    this.hero.anchor = { x, y };
    this.hero.orderTargetId = null;
    this.hero.engaged = false;
    this.hero.targetId = null;
    this.addEffect({ kind: 'ring', pos: { x, y }, radius: 16, color: '#a5d6a7', ttl: 0.35, max: 0.35 });
    return true;
  }

  /** First wrench click starts a hunt. Jeff stays on leaks until a move order. */
  commandHeroAttack(enemyId: number): boolean {
    if (!heroOnYard(this) || this.status !== 'playing') return false;
    const enemy = this.enemies.find((e) => e.id === enemyId);
    if (!enemy || enemy.dead || enemy.escaped || (!this.heroDef.ranged && enemy.def.flying)) return false;
    if (this.hero.cast) { this.hero.queuedOrder = { kind: 'attack', enemyId }; return true; }
    this.hero.queuedOrder = undefined;
    this.hero.dest = null;
    this.hero.engaged = true;
    this.hero.orderTargetId = enemy.id;
    this.hero.targetId = enemy.id;
    this.hero.anchor = { ...enemy.pos };
    this.hero.facing = enemy.pos.x >= this.hero.pos.x ? 1 : -1;
    this.addEffect({ kind: 'ring', pos: { ...enemy.pos }, radius: enemy.def.radius + 18, color: '#ff8a65', ttl: 0.45, max: 0.45 });
    this.addEffect({
      kind: 'text',
      pos: { x: enemy.pos.x, y: enemy.pos.y - enemy.def.radius - 18 },
      text: enemy.def.name.toUpperCase(),
      color: '#ffcc80',
      ttl: 0.7,
      max: 0.7,
    });
    return true;
  }

  /** Kingdom Rush click-to-place. Hero must be off the yard and not still down. */
  deployHero(pos: Vec): boolean {
    if (!this.heroEnabled || this.status !== 'playing') return false;
    const h = this.hero;
    if (h.downed > 0 || h.deployed) return false;
    if (!Number.isFinite(pos.x) || !Number.isFinite(pos.y)) return false;
    const x = clamp(pos.x, 24, 936);
    const y = clamp(pos.y, 28, 572);
    h.pos = { x, y };
    h.prev = { x, y };
    h.anchor = { x, y };
    h.dest = null;
    h.hp = h.maxHp;
    h.deployed = true;
    h.orderTargetId = null;
    h.engaged = false;
    h.targetId = null;
    h.cast = undefined;
    h.queuedOrder = undefined; h.combatIdle = 0; h.recovering = false;
    h.swing = 0;
    this.addEffect({ kind: 'ring', pos: { x, y }, radius: 36, color: this.heroDef.color, ttl: 0.7, max: 0.7 });
    this.addEffect({ kind: 'splash', pos: { x, y }, radius: 28, color: '#ffe082', ttl: 0.4, max: 0.4 });
    this.addEffect({
      kind: 'text',
      pos: { x, y: y - 48 },
      text: `${this.heroDef.name.toUpperCase()} IN`,
      color: '#fff3c4',
      ttl: 1.1,
      max: 1.1,
    });
    return true;
  }

  useAbility(slot: AbilitySlot, aim?: { pos: { x: number; y: number }; enemyId?: number }): boolean {
    if (![0, 1, 2, 3, 4].includes(slot)) return false;
    if (this.heroDef.id === 'jeff') return fireJeffAbility(this, slot);
    return useHeroAbility(this, slot, aim);
  }

  useClamp(): boolean {
    return this.useAbility(0);
  }

  useShutoff(): boolean {
    return this.useAbility(1);
  }

  usePulse(): boolean {
    return this.useAbility(2);
  }

  useSleeve(): boolean {
    return this.useAbility(3);
  }

  useCoffee(): boolean {
    return this.useAbility(4);
  }

  /** Soft-exit The Neverending Service Call — keep the record, lose nothing from the shop. */
  retire(): boolean {
    if (!this.endless || this.status !== 'playing' || this.waveIdx <= 0) return false;
    this.status = 'retired';
    return true;
  }

  /** Kingdom Rush–style targeted bombardment. Three fire dumps on a point you pick. */
  torchStrike(pos: Vec): boolean {
    if (isNoPowers(this.remaster)) return false;
    if (this.status !== 'playing' || this.strikeCooldown > 0) return false;
    if (!Number.isFinite(pos.x) || !Number.isFinite(pos.y)) return false;
    if (pos.x < 12 || pos.x > 948 || pos.y < 18 || pos.y > 582) return false;
    this.strikeCooldown = STRIKE_COOLDOWN;
    for (let i = 0; i < 3; i++) {
      this.strikes.push({
        pos: { x: pos.x + this.rng.range(-16, 16), y: pos.y + this.rng.range(-12, 12) },
        delay: 0.12 + i * 0.38,
        radius: STRIKE_RADIUS - i * 5,
        damage: STRIKE_DAMAGE * (1 + i * 0.18),
        fired: false,
      });
    }
    this.addEffect({ kind: 'ring', pos: { ...pos }, radius: STRIKE_RADIUS, color: '#ff8a50', ttl: 0.7, max: 0.7 });
    this.addEffect({ kind: 'text', pos: { x: pos.x, y: pos.y - 46 }, text: 'TORCH RAIN', color: '#ffcc80', ttl: 1.1, max: 1.1 });
    return true;
  }
  callNextWave(): number {
    if (!this.canCallWave) return 0;
    this.recordClearedWave();
    const bonus = this.callBonus;
    const recovery = this.callCooldownRecovery;
    if (recovery > 0) {
      for (const key of COOLDOWN_FIELDS) this.hero[key] = Math.max(0, this.hero[key] - recovery);
      this.crewCooldown = Math.max(0, this.crewCooldown - recovery);
      this.strikeCooldown = Math.max(0, this.strikeCooldown - recovery);
      this.callRecovery += recovery;
    }
    this.lastEarlyCall = { bonus, recovery, left: 2.4 };
    if (bonus > 0) {
      this.money += bonus;
      this.stats.moneyEarned += bonus;
      this.stats.wavesCalledEarly++;
    }
    this.startWave();
    return bonus;
  }

  damageHero(amount: number): void {
    const h = this.hero;
    if (!h.deployed || h.downed > 0) return;
    h.combatIdle = 0; h.recovering = false;
    h.hp -= amount * (1 - this.heroDef.armor) * ((h.shield ?? 0) > 0 ? .65 : 1);
    if (h.hp <= 0) {
      h.hp = 0;
      h.downed = this.heroDef.respawn * this.mods.jeffRespawn;
      h.deployed = false;
      h.dest = null;
      h.orderTargetId = null;
      h.targetId = null;
      h.cast = undefined; h.castTimer = 0; h.pendingStrike = undefined; h.swing = 0;
      h.queuedOrder = undefined;
      h.overdrive = 0; h.shield = 0; h.lifesteal = 0; h.taunt = 0;
      for (const e of this.enemies) if (e.heldBy?.kind === 'hero') e.heldBy = null;
      this.addEffect({ kind: 'text', pos: { x: h.pos.x, y: h.pos.y - 40 }, text: `${this.heroDef.name} is down`, color: '#ff8a80', ttl: 1.4, max: 1.4 });
    }
  }

  /** Try to consume an Expansion Tank shield covering this tower. */
  consumeShield(t: Tower): boolean {
    for (const tank of this.towers) {
      if (tank.def.id !== 'expansion' || tank.shieldCooldown > 0) continue;
      if (dist(tank.pos, t.pos) > this.effectiveRange(tank)) continue;
      tank.shieldCooldown = tank.def.levels[tank.level]!.shieldCooldown ?? 15;
      this.addEffect({ kind: 'ring', pos: { ...t.pos }, radius: 26, color: '#ffd54f', ttl: 0.5, max: 0.5 });
      this.addEffect({ kind: 'text', pos: { x: t.pos.x, y: t.pos.y - 26 }, text: 'absorbed', color: '#ffd54f', ttl: 0.9, max: 0.9 });
      return true;
    }
    return false;
  }

  spawnEnemy(id: EnemyId, pathIdx: number, progress = -SPAWN_LEAD, properties: readonly LeakProperty[] = [], waveId = this.waveIdx): Enemy {
    const def = enemyForMap(id, this.map.id);
    const hp = this.previewHealth(id, Math.max(0, waveId - 1), properties);
    const shell = properties.includes('cast') ? Math.round(hp * 0.85) : 0;
    const path = this.paths[pathIdx] ?? this.paths[0]!;
    const at = path.pointAt(progress);
    const e: Enemy = {
      id: this.nextEntityId(),
      waveId,
      def,
      hp,
      maxHp: hp,
      pathIdx: this.paths[pathIdx] ? pathIdx : 0,
      progress,
      pos: { ...at },
      prev: { ...at },
      lane: this.rng.range(-16, 16),
      speedMult: this.difficulty.speedMult,
      slow: 0,
      stun: 0,
      heldBy: null,
      phaseTimer: 3,
      phased: false,
      armorShred: 0,
      shredTimer: 0,
      freezeTimer: 3,
      bossPhase: 0,
      ventTimer: 5,
      dead: false,
      escaped: false,
      deathAge: 0,
      attackTimer: 0.5,
      wobble: this.rng.range(0, 6),
      dotDps: 0,
      dotTime: 0,
      dotSource: null,
      marked: false,
      haste: 0,
      laneTimer: 7,
      hitFlash: 0,
      incoming: 0,
      properties: [...properties],
      shellHp: shell,
      maxShell: shell,
      burnTimer: 0,
      markHold: 0,
    };
    e.lane = LANE_SPREAD[(e.id + pathIdx * 3) % LANE_SPREAD.length]! + this.rng.range(-2.2, 2.2);
    this.enemies.push(e);
    this.seen.add(id);
    return e;
  }

  // ---------------------------------------------------------------- simulation

  update(dt: number): void {
    if (this.status !== 'playing') return;
    this.impactRest = Math.max(0, this.impactRest - dt);
    if (this.hitstop > 0) {
      this.snapshotMotion();
      this.hitstop = Math.max(0, this.hitstop - dt);
      this.tickPresentation(dt);
      return;
    }
    if (this.comboTimer > 0) {
      this.comboTimer -= dt;
      if (this.comboTimer <= 0) this.combo = 0;
    }
    this.snapshotMotion();
    this.time += dt;
    if (this.lastEarlyCall) { this.lastEarlyCall.left -= dt; if (this.lastEarlyCall.left <= 0) this.lastEarlyCall = null; }
    if (this.overtime > 0) this.overtime = Math.max(0, this.overtime - dt);

    if (this.globalSlowTimer > 0) this.globalSlowTimer -= dt;
    if (this.spawnPause > 0) this.spawnPause -= dt;
    if (this.clamp) {
      this.clamp.timeLeft -= dt;
      if (this.clamp.timeLeft <= 0) {
        this.clamp = null;
        for (const e of this.enemies) if (e.heldBy?.kind === 'clamp') e.heldBy = null;
      } else {
        this.holdWithClamp();
      }
    }

    this.updateWaves(dt);
    updateAuras(this, dt);
    updateTowers(this, dt);
    updateHero(this, dt);
    updateCrew(this, dt);
    updateFriendlies(this, dt);
    updateHeroSummons(this, dt);
    updateEnemies(this, dt);
    this.updateProjectiles(dt);
    this.updateStrikes(dt);
    updateHeroMissiles(this, dt);
    for (const fx of this.heroVisuals) fx.left -= dt;
    this.heroVisuals = this.heroVisuals.filter(fx => fx.left > 0);
    if (this.heroNotice) { this.heroNotice.left -= dt; if (this.heroNotice.left <= 0) this.heroNotice = null; }

    this.enemies = this.enemies.filter((e) => !e.escaped && !(e.dead && e.deathAge <= 0));
    this.recordClearedWave();
    for (const fx of this.effects) fx.ttl -= dt;
    this.effects = this.effects.filter((fx) => fx.ttl > 0);

    if (this.lives <= 0) {
      this.lives = 0;
      this.status = 'lost';
    } else if (!this.endless && this.allWavesStarted && !this.waveActive) {
      this.status = 'won';
    }
  }

  /** Visual-only clocks that keep running through hitstop so impacts still read. */
  private tickPresentation(dt: number): void {
    for (const fx of this.effects) fx.ttl -= dt;
    this.effects = this.effects.filter((fx) => fx.ttl > 0);
    for (const e of this.enemies) {
      if (e.hitFlash > 0) e.hitFlash = Math.max(0, e.hitFlash - dt);
      if (e.dead && e.deathAge > 0) e.deathAge = Math.max(0, e.deathAge - dt);
    }
    for (const t of this.towers) if (t.recoil > 0) t.recoil -= dt;
  }

  private snapshotMotion(): void {
    const cap = (pos: { x: number; y: number }, prev: { x: number; y: number } | undefined) => {
      if (!prev) return;
      prev.x = pos.x;
      prev.y = pos.y;
    };
    cap(this.hero.pos, this.hero.prev);
    for (const e of this.enemies) cap(e.pos, e.prev);
    for (const p of this.projectiles) cap(p.pos, p.prev);
    for (const f of this.friendlies) cap(f.pos, f.prev);
    for (const c of this.crew) cap(c.pos, c.prev);
    for (const s of this.heroSummons) cap(s.pos, s.prev);
    for (const m of this.heroMissiles) cap(m.pos, m.prev);
  }

  private holdWithClamp(): void {
    const c = this.clamp;
    if (!c) return;
    let held = 0;
    for (const e of this.enemies) if (e.heldBy?.kind === 'clamp') held++;
    for (const e of this.enemies) {
      if (held >= this.clampHolds()) break;
      if (!isTargetable(e) || e.def.flying || e.heldBy !== null) continue;
      if (dist(e.pos, c.pos) > this.clampRadius() + e.def.radius) continue;
      e.heldBy = { kind: 'clamp' };
      held++;
    }
  }

  private recordClearedWave(): void {
    if (this.lives <= 0) return;
    for (const [index, wave] of this.activeWaves) {
      if (this.spawns.some(s => (s.waveId ?? this.waveIdx) === index && s.remaining > 0)
        || this.enemies.some(e => (e.waveId ?? this.waveIdx) === index && !e.dead && !e.escaped)) continue;
      this.activeWaves.delete(index);
      this.completedWaves++;
      const clean = wave.leaks === 0;
      const bonus = clean ? 16 + index * 2 : 0;
      this.money += bonus; this.stats.moneyEarned += bonus;
      if (clean) this.cleanWaves++;
      this.pendingStreaks.set(index, clean);
      // Rewards arrive immediately, but consecutive streaks follow campaign order.
      while (this.pendingStreaks.has(this.nextStreakWave)) {
        this.cleanStreak = this.pendingStreaks.get(this.nextStreakWave) ? this.cleanStreak + 1 : 0;
        this.bestCleanStreak = Math.max(this.bestCleanStreak, this.cleanStreak);
        this.pendingStreaks.delete(this.nextStreakWave++);
      }
      const payout = this.endless ? 70 + index * 9 : 0;
      this.money += payout; this.stats.moneyEarned += payout;
      this.waveReports.push({ wave: index, kills: wave.kills, leaks: wave.leaks, livesLost: wave.livesLost,
        bounty: wave.bounty, bonus: bonus + payout, seconds: this.time - wave.started, clean });
      // A long endless session keeps bounded recent reports; aggregate counts remain exact.
      if (this.waveReports.length > 30) this.waveReports.shift();
      if (this.endless && this.completedWaves % 5 === 0) this.lives = Math.min(Math.round(this.map.lives * this.difficulty.livesMult), this.lives + 2);
    }
    if (this.waveIdx > 0 && this.activeWaves.size === 0 && !this.waveActive && !this.waveJustCleared) {
      // Only the transition into a clear may start the breather. completedWaves is
      // checked against the last report acknowledgement, not a timer that can pay twice.
      if (this.announcedClear === this.completedWaves) return;
      this.announcedClear = this.completedWaves;
      this.waveJustCleared = true;
      this.waveLeaks = 0;
      if (!this.allWavesStarted) this.waveCountdown = this.endless ? 10 : CLEAR_BREATHER;
    }
  }
  private announcedClear = 0;

  private updateWaves(dt: number): void {
    this.recordClearedWave();
    if (!this.allWavesStarted && this.waveCountdown >= 0 && !(this.manualStart && this.waveIdx === 0) && !(this.endless && this.waveActive)) {
      this.waveCountdown = Math.max(0, this.waveCountdown - dt);
      // Keep a steady cadence, but never bury a slow survivor under an unlimited
      // backlog. At most two entered waves may overlap; endless remains one at a time.
      if (this.waveCountdown <= 0 && this.spawns.length === 0 && this.activeWaves.size < 2
        && !(this.endless && this.waveActive)) this.startWave();
    }
    if (this.spawnPause > 0) return;
    for (const s of this.spawns) {
      s.timer -= dt;
      while (s.timer <= 0 && s.remaining > 0) {
        this.spawnEnemy(s.enemy, s.path, -SPAWN_LEAD, s.properties, s.waveId);
        s.remaining--;
        s.timer += Math.max(s.interval, 1 / 60);
      }
    }
    this.spawns = this.spawns.filter((s) => s.remaining > 0);
  }

  private mutatorFor(index: number): NightMutatorId | null {
    if (!this.endless) return null;
    if (index < this.map.waves.length) return null;
    return nightMutatorAt(proceduralIndex(index, this.map.waves.length));
  }

  private waveDefAt(index: number): WaveDef | undefined {
    const scripted = this.map.waves[index];
    if (scripted) return scripted;
    if (this.endless) return generateEndlessWave(proceduralIndex(index, this.map.waves.length), this.paths.length);
    return undefined;
  }

  private startWave(): void {
    const index = this.waveIdx;
    const w = this.waveDefAt(index);
    if (!w) return;
    this.activeWaves.set(index + 1, { started: this.time, kills: 0, leaks: 0, livesLost: 0, bounty: 0 });
    this.waveJustCleared = false;
    let duration = 0;
    for (const g of w.groups) {
      const properties = propertiesFor(g.enemy, index, this.mutatorFor(index), g.properties);
      this.spawns.push({ waveId: index + 1, enemy: g.enemy, remaining: g.count, interval: g.interval, timer: g.delay, path: g.path, properties });
      duration = Math.max(duration, g.delay + (g.count - 1) * g.interval);
    }
    this.waveIdx++;
    this.waveRush = !!w.rush;
    const leftover = this.enemies.some((e) => !e.dead && !e.escaped);
    if (!leftover) this.waveLeaks = 0;
    if (this.endless) {
      const scripted = index < this.map.waves.length;
      this.nightMutator = scripted ? null : nightMutatorAt(proceduralIndex(index, this.map.waves.length));
    }
    this.waveCountdown = this.allWavesStarted ? -1 : duration + BETWEEN_WAVE_GRACE;
  }

  private updateStrikes(dt: number): void {
    this.strikeCooldown = Math.max(0, this.strikeCooldown - dt);
    for (const s of this.strikes) {
      s.delay -= dt;
      if (s.delay > 0 || s.fired) continue;
      s.fired = true;
      this.addEffect({ kind: 'splash', pos: { ...s.pos }, radius: s.radius, color: '#ff7043', ttl: 0.48, max: 0.48 });
      this.addEffect({ kind: 'ring', pos: { ...s.pos }, radius: s.radius, color: '#ffcc80', ttl: 0.4, max: 0.4 });
      this.addEffect({ kind: 'hit', pos: { ...s.pos }, color: '#fff3e0', ttl: 0.22, max: 0.22 });
      for (const e of this.enemies) {
        if (!isTargetable(e) || dist(e.pos, s.pos) > s.radius + e.def.radius) continue;
        e.stun = Math.max(e.stun, e.def.traits.includes('boss') ? 0.12 : 0.28);
        applyDamage(this, e, s.damage, 'fire', 'torch');
      }
    }
    this.strikes = this.strikes.filter((s) => !s.fired || s.delay > -0.35);
  }

  private updateProjectiles(dt: number): void {
    const remaining: Projectile[] = [];
    for (const p of this.projectiles) {
      p.life += dt;
      const target = this.enemies.find((e) => e.id === p.targetId && !e.dead && !e.escaped);
      if (p.home && target) p.lastTargetPos = predictedPos(this, target, 0.08);
      const goal = p.lastTargetPos;
      const step = p.speed * this.projSpeedMult * dt;
      const d = dist(p.pos, goal);
      const timedOut = p.life > p.ttl;
      if (d > step + 4 && !timedOut) {
        p.pos = { x: p.pos.x + ((goal.x - p.pos.x) / d) * step, y: p.pos.y + ((goal.y - p.pos.y) / d) * step };
        remaining.push(p);
        continue;
      }
      p.pos = { ...goal };
      const release = (e: Enemy | undefined) => {
        if (e) e.incoming = Math.max(0, e.incoming - p.reserved);
      };
      if (p.splash > 0) {
        this.addEffect({ kind: 'splash', pos: { ...goal }, radius: p.splash, color: p.color, ttl: 0.3, max: 0.3 });
        for (const e of this.enemies) {
          if (!isTargetable(e) || e.def.flying) continue;
          if (dist(e.pos, goal) <= p.splash + e.def.radius) {
            applyDamage(this, e, p.damage, p.damageType, p.source);
            if (p.shred || p.dot) applyDescaler(e, p.shred ?? 0, p.dot ?? 0, p.dotTime ?? 3);
          }
        }
        release(target);
      } else if (target) {
        applyDamage(this, target, p.damage, p.damageType, p.source, { groundMult: p.groundMult });
        this.addEffect({ kind: 'hit', pos: { ...goal }, color: p.color, ttl: 0.15, max: 0.15 });
        if (p.shred || p.dot) applyDescaler(target, p.shred ?? 0, p.dot ?? 0, p.dotTime ?? 3);
        release(target);
      } else {
        const next = this.enemies.find((e) => isTargetable(e) && dist(e.pos, p.pos) < 36);
        if (next) {
          applyDamage(this, next, p.damage, p.damageType, p.source, { groundMult: p.groundMult });
          this.addEffect({ kind: 'hit', pos: { ...next.pos }, color: p.color, ttl: 0.12, max: 0.12 });
        } else {
          this.addEffect({ kind: 'hit', pos: { ...p.pos }, color: p.color, ttl: 0.12, max: 0.12 });
        }
        release(target);
      }
    }
    this.projectiles = remaining;
  }
}
