import { Rng } from '../core/rng';
import { dist, type Vec } from '../core/vec';
import { ENEMIES } from '../data/enemies';
import { JEFF } from '../data/jeff';
import { HEROES, isHeroId, type AbilitySlot, type HeroDef, type HeroId } from '../data/heroes';
import { updateHeroMissiles, updateHeroSummons, useHeroAbility } from './heroPowers';
import type { HeroMissile, HeroSummon, HeroVisual, HeroZone } from './state';
import { TOWERS, TOWER_ORDER } from '../data/towers';
import { specializeDef, specializationInfo, type Specialization } from '../data/specializations';
import { generateEndlessWave, nightMutatorAt, proceduralIndex, type NightMutatorId } from '../data/night';
import type { Difficulty, EnemyId, MapDef, Modifiers, RemasterId, TowerId, WaveDef } from '../data/types';
import { AIM_ORDER, applyDamage, isTargetable } from './combat';
import { updateEnemies } from './enemies';
import { updateHero } from './hero';
import { Path } from './path';
import type { ActiveSpawn, AimPriority, Clamp, Crew, Friendly, Effect, Enemy, GameStatus, Hero, Projectile, RunStats, Tower } from './state';
import { releaseFriendly, syncRecruits, updateFriendlies } from './friendlies';
import { CREW_COOLDOWN, CREW_DURATION, updateCrew } from './crew';
import { applyDescaler, updateAuras, updateTowers } from './towers';

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
export const EARLY_CALL_BONUS_PER_SECOND = 1.5;

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
  waveHpScale = 1;
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
  private clearedWave = 0;
  crewCooldown = 0;

  money: number;
  lives: number;
  time = 0;
  /** Number of waves that have started. */
  waveIdx = 0;
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
    const kit = (opts.loadout ?? []).filter((id) => pool.includes(id));
    this.allowedTowers = kit.length > 0 ? kit : pool;
    this.freezeDurationMult = this.remaster === 'frozenMain' ? 1.75 : 1;
    this.nightMutator = null;
    this.money = map.startMoney + opts.mods.startMoney;
    this.lives =
      this.remaster === 'frozenMain' ? 1 : Math.max(1, Math.round(map.lives * opts.difficulty.livesMult));
    const maxHp = Math.round(this.heroDef.hp * opts.mods.jeffHp);
    this.hero = {
      id: this.heroDef.id,
      pos: { ...map.jeffStart },
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
    };
  }

  nextEntityId(): number {
    return this.idCounter++;
  }

  addEffect(e: Effect): void {
    if (this.effects.length < 400) this.effects.push(e);
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

  nextWaveEnemies(): EnemyId[] {
    const w = this.waveDefAt(this.waveIdx);
    if (!w) return [];
    return [...new Set(w.groups.map((g) => g.enemy))];
  }

  nextWavePreview(): { enemy: EnemyId; count: number; path: number }[] {
    const groups = this.waveDefAt(this.waveIdx)?.groups ?? [];
    const preview: { enemy: EnemyId; count: number; path: number }[] = [];
    for (const group of groups) {
      const old = preview.find(p => p.enemy === group.enemy && p.path === group.path);
      if (old) old.count += group.count;
      else preview.push({ enemy: group.enemy, count: group.count, path: group.path });
    }
    return preview;
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
    return JEFF.clamp.radius;
  }

  clampSlow(): number {
    return JEFF.clamp.slow;
  }

  // ---------------------------------------------------------------- commands

  /** Call two temporary helpers onto a visible section of the route. */
  reinforce(pos: Vec): boolean {
    if (this.status !== 'playing' || this.crewCooldown > 0 || !Number.isFinite(pos.x) || !Number.isFinite(pos.y)) return false;
    if (pos.x < 16 || pos.x > 944 || pos.y < 24 || pos.y > 576) return false;
    const rally = this.nearestPathPoint(pos);
    if (dist(pos, rally) > 55 || rally.x < 16 || rally.x > 944 || rally.y < 24 || rally.y > 576) return false;
    this.crewCooldown = CREW_COOLDOWN;
    for (let i = 0; i < 2; i++) this.crew.push({
      id: this.nextEntityId(), pos: { x: rally.x + (i === 0 ? -12 : 12), y: rally.y + (i === 0 ? -7 : 7) },
      hp: 110, maxHp: 110, timeLeft: CREW_DURATION, attackTimer: 0, swing: 0, facing: 1,
    });
    this.addEffect({ kind: 'ring', pos: rally, radius: 44, color: '#a8df89', ttl: 0.65, max: 0.65 });
    this.addEffect({ kind: 'text', pos: { x: rally.x, y: rally.y - 48 }, text: 'CREW ON SITE!', color: '#e5ffbb', ttl: 1.1, max: 1.1 });
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
    });
    syncRecruits(this, this.towers[this.towers.length - 1]!);
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
    const i = AIM_ORDER.indexOf(t.aim);
    t.aim = AIM_ORDER[(i + 1) % AIM_ORDER.length]!;
    return t.aim;
  }

  sellTower(towerId: number): boolean {
    if (this.status !== 'playing') return false;
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
    if (!this.heroEnabled || this.status !== 'playing' || this.hero.downed > 0) return false;
    if (!Number.isFinite(pos.x) || !Number.isFinite(pos.y) || this.hero.cast) return false;
    const x = Math.max(10, Math.min(950, pos.x));
    const y = Math.max(10, Math.min(590, pos.y));
    this.hero.dest = { x, y };
    this.hero.pendingStrike = undefined; this.hero.swing = 0;
    this.hero.anchor = { x, y };
    this.hero.orderTargetId = null;
    this.hero.engaged = false;
    this.hero.targetId = null;
    for (const e of this.enemies) if (e.heldBy?.kind === 'hero') e.heldBy = null;
    this.addEffect({ kind: 'ring', pos: { x, y }, radius: 16, color: '#a5d6a7', ttl: 0.35, max: 0.35 });
    return true;
  }

  /** First wrench click starts a hunt. Jeff stays on leaks until a move order. */
  commandHeroAttack(enemyId: number): boolean {
    if (!this.heroEnabled || this.status !== 'playing' || this.hero.downed > 0) return false;
    if (this.hero.cast) return false;
    const enemy = this.enemies.find((e) => e.id === enemyId);
    if (!enemy || enemy.dead || enemy.escaped) return false;
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

  useAbility(slot: AbilitySlot): boolean {
    if (![0, 1, 2, 3, 4].includes(slot)) return false;
    return [() => this.useClamp(), () => this.useShutoff(), () => this.usePulse(), () => this.useSleeve(), () => this.useCoffee()][slot]!();
  }

  useClamp(): boolean {
    if (this.heroDef.id !== 'jeff') return useHeroAbility(this, 0);
    if (!this.heroEnabled || this.status !== 'playing') return false;
    const h = this.hero;
    if (h.downed > 0 || h.clampCooldown > 0) return false;
    h.clampCooldown = JEFF.clamp.cooldown * this.mods.cooldown / this.jeffCdAura;
    this.clamp = { pos: { ...h.pos }, timeLeft: JEFF.clamp.duration };
    h.castTimer = 0.72;
    this.addEffect({ kind: 'skill', pos: { ...h.pos }, skill: 'clamp', ttl: 1.15, max: 1.15 });
    return true;
  }

  useShutoff(): boolean {
    if (this.heroDef.id !== 'jeff') return useHeroAbility(this, 1);
    if (!this.heroEnabled || this.status !== 'playing') return false;
    const h = this.hero;
    if (h.downed > 0 || h.shutoffCooldown > 0) return false;
    h.shutoffCooldown = JEFF.shutoff.cooldown * this.mods.cooldown / this.jeffCdAura;
    this.globalSlow = JEFF.shutoff.slow;
    this.globalSlowTimer = JEFF.shutoff.duration;
    this.spawnPause = JEFF.shutoff.duration;
    h.castTimer = 0.72;
    this.addEffect({ kind: 'skill', pos: { x: 480, y: 300 }, skill: 'shutoff', ttl: 1.8, max: 1.8 });
    return true;
  }

  usePulse(): boolean {
    if (this.heroDef.id !== 'jeff') return useHeroAbility(this, 2);
    if (!this.heroEnabled || this.status !== 'playing') return false;
    const h = this.hero;
    if (h.downed > 0 || h.pulseCooldown > 0) return false;
    h.pulseCooldown = JEFF.pulse.cooldown * this.mods.cooldown / this.jeffCdAura;
    h.castTimer = 0.72;
    this.addEffect({ kind: 'skill', pos: { ...h.pos }, skill: 'pulse', ttl: 1.05, max: 1.05 });
    for (const e of this.enemies) {
      if (!isTargetable(e) || dist(e.pos, h.pos) > JEFF.pulse.radius + e.def.radius) continue;
      e.armorShred = Math.max(e.armorShred, JEFF.pulse.shred);
      e.shredTimer = Math.max(e.shredTimer, 3);
      e.stun = Math.max(e.stun, JEFF.pulse.stun * this.mods.stunDuration);
      applyDamage(this, e, JEFF.pulse.damage * this.mods.jeffDamage, 'physical', 'jeff');
      this.addEffect({ kind: 'hit', pos: { ...e.pos }, color: '#ffb74d', ttl: 0.38, max: 0.38 });
    }
    return true;
  }

  useSleeve(): boolean {
    if (this.heroDef.id !== 'jeff') return useHeroAbility(this, 3);
    if (!this.heroEnabled || this.status !== 'playing') return false;
    const h = this.hero;
    if (h.downed > 0 || h.sleeveCooldown > 0) return false;
    h.sleeveCooldown = JEFF.sleeve.cooldown * this.mods.cooldown / this.jeffCdAura;
    h.sleeveTimer = JEFF.sleeve.duration;
    h.castTimer = 0.72;
    this.addEffect({ kind: 'skill', pos: { ...h.pos }, skill: 'sleeve', ttl: 1.1, max: 1.1 });
    return true;
  }

  useCoffee(): boolean {
    if (this.heroDef.id !== 'jeff') return useHeroAbility(this, 4);
    if (!this.heroEnabled || this.status !== 'playing') return false;
    const h = this.hero;
    if (h.downed > 0 || h.coffeeCooldown > 0) return false;
    h.coffeeCooldown = JEFF.coffee.cooldown * this.mods.cooldown / this.jeffCdAura;
    h.coffeeTimer = JEFF.coffee.duration;
    h.hp = Math.min(h.maxHp, h.hp + JEFF.coffee.heal);
    h.castTimer = 0.72;
    this.addEffect({ kind: 'skill', pos: { ...h.pos }, skill: 'coffee', ttl: 1.15, max: 1.15 });
    return true;
  }

  /** Soft-exit The Neverending Service Call — keep the record, lose nothing from the shop. */
  retire(): boolean {
    if (!this.endless || this.status !== 'playing' || this.waveIdx <= 0) return false;
    this.status = 'retired';
    return true;
  }

  /** Start the pending wave immediately. Returns the early-call bonus paid. */
  callNextWave(): number {
    if (this.status !== 'playing' || this.allWavesStarted || this.waveCountdown < 0 || (this.endless && this.waveActive)) return 0;
    this.recordClearedWave();
    const bonus = Math.floor(Math.max(0, this.waveCountdown) * EARLY_CALL_BONUS_PER_SECOND);
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
    if (h.downed > 0) return;
    h.hp -= amount * (1 - this.heroDef.armor) * ((h.shield ?? 0) > 0 ? .65 : 1);
    if (h.hp <= 0) {
      h.hp = 0;
      h.downed = JEFF.respawn * this.mods.jeffRespawn;
      h.dest = null;
      h.orderTargetId = null;
      h.targetId = null;
      h.cast = undefined; h.castTimer = 0; h.pendingStrike = undefined; h.swing = 0;
      h.overdrive = 0; h.shield = 0; h.lifesteal = 0; h.taunt = 0;
      for (const e of this.enemies) if (e.heldBy?.kind === 'hero') e.heldBy = null;
      this.addEffect({ kind: 'text', pos: { x: h.pos.x, y: h.pos.y - 40 }, text: `${this.heroDef.name} needs a minute`, color: '#ff8a80', ttl: 1.4, max: 1.4 });
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

  spawnEnemy(id: EnemyId, pathIdx: number, progress = 0): Enemy {
    const def = ENEMIES[id];
    const hp = Math.round(def.hp * this.difficulty.hpMult * this.waveHpScale);
    const path = this.paths[pathIdx] ?? this.paths[0]!;
    const e: Enemy = {
      id: this.nextEntityId(),
      def,
      hp,
      maxHp: hp,
      pathIdx: this.paths[pathIdx] ? pathIdx : 0,
      progress,
      pos: path.pointAt(progress),
      lane: this.rng.range(-10, 10),
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
      attackTimer: 0.5,
      wobble: this.rng.range(0, 6),
      dotDps: 0,
      dotTime: 0,
      dotSource: null,
      marked: false,
      haste: 0,
      laneTimer: 7,
      hitFlash: 0,
    };
    this.enemies.push(e);
    this.seen.add(id);
    return e;
  }

  // ---------------------------------------------------------------- simulation

  update(dt: number): void {
    if (this.status !== 'playing') return;
    this.time += dt;

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
    updateHeroMissiles(this, dt);
    for (const fx of this.heroVisuals) fx.left -= dt;
    this.heroVisuals = this.heroVisuals.filter(fx => fx.left > 0);
    if (this.heroNotice) { this.heroNotice.left -= dt; if (this.heroNotice.left <= 0) this.heroNotice = null; }

    this.enemies = this.enemies.filter((e) => !e.dead && !e.escaped);
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

  private holdWithClamp(): void {
    const c = this.clamp;
    if (!c) return;
    let held = 0;
    for (const e of this.enemies) if (e.heldBy?.kind === 'clamp') held++;
    for (const e of this.enemies) {
      if (held >= JEFF.clamp.holds) break;
      if (!isTargetable(e) || e.def.flying || e.heldBy !== null) continue;
      if (dist(e.pos, c.pos) > JEFF.clamp.radius + e.def.radius) continue;
      e.heldBy = { kind: 'clamp' };
      held++;
    }
  }

  private recordClearedWave(): void {
    if (this.lives > 0 && this.waveIdx > this.clearedWave && !this.waveActive) {
      this.completedWaves = this.waveIdx; this.clearedWave = this.waveIdx;
      if (this.endless) {
        const payout = 70 + this.waveIdx * 9;
        this.money += payout; this.stats.moneyEarned += payout; this.waveCountdown = 10;
        if (this.waveIdx % 5 === 0) this.lives = Math.min(Math.round(this.map.lives * this.difficulty.livesMult), this.lives + 2);
        this.addEffect({ kind: 'text', pos: { x: 480, y: 300 }, text: `CALL ${this.waveIdx} CLEARED · +$${payout}`, color: '#f4d58e', ttl: 2, max: 2 });
      }
    }
  }

  private updateWaves(dt: number): void {
    this.recordClearedWave();
    if (!this.allWavesStarted && this.waveCountdown >= 0 && !(this.manualStart && this.waveIdx === 0) && !(this.endless && this.waveActive)) {
      this.waveCountdown -= dt;
      if (this.waveCountdown <= 0) this.startWave();
    }
    if (this.spawnPause > 0) return;
    for (const s of this.spawns) {
      s.timer -= dt;
      while (s.timer <= 0 && s.remaining > 0) {
        this.spawnEnemy(s.enemy, s.path);
        s.remaining--;
        s.timer += s.interval;
      }
    }
    this.spawns = this.spawns.filter((s) => s.remaining > 0);
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
    this.waveHpScale = this.endless
      ? 1 + index * 0.03 + Math.pow(Math.max(0, index - 24), 1.4) * 0.006
      : 1 + Math.max(0, index - 4) * 0.012;
    let duration = 0;
    for (const g of w.groups) {
      this.spawns.push({ enemy: g.enemy, remaining: g.count, interval: g.interval, timer: g.delay, path: g.path });
      duration = Math.max(duration, g.delay + (g.count - 1) * g.interval);
    }
    this.waveIdx++;
    if (this.endless) {
      const scripted = index < this.map.waves.length;
      this.nightMutator = scripted ? null : nightMutatorAt(proceduralIndex(index, this.map.waves.length));
    }
    this.waveCountdown = this.allWavesStarted ? -1 : duration + BETWEEN_WAVE_GRACE;
  }

  private updateProjectiles(dt: number): void {
    const remaining: Projectile[] = [];
    for (const p of this.projectiles) {
      const target = this.enemies.find((e) => e.id === p.targetId && !e.dead && !e.escaped);
      const goal = target ? target.pos : p.lastTargetPos;
      if (target) p.lastTargetPos = { ...target.pos };
      const step = p.speed * this.projSpeedMult * dt;
      const d = dist(p.pos, goal);
      if (d > step + 4) {
        p.pos = { x: p.pos.x + ((goal.x - p.pos.x) / d) * step, y: p.pos.y + ((goal.y - p.pos.y) / d) * step };
        remaining.push(p);
        continue;
      }
      p.pos = { ...goal };
      if (p.splash > 0) {
        this.addEffect({ kind: 'splash', pos: { ...goal }, radius: p.splash, color: p.color, ttl: 0.3, max: 0.3 });
        for (const e of this.enemies) {
          if (!isTargetable(e) || e.def.flying) continue;
          if (dist(e.pos, goal) <= p.splash + e.def.radius) {
            applyDamage(this, e, p.damage, p.damageType, p.source);
            if (p.shred || p.dot) applyDescaler(e, p.shred ?? 0, p.dot ?? 0, p.dotTime ?? 3);
          }
        }
      } else if (target) {
        applyDamage(this, target, p.damage, p.damageType, p.source, { groundMult: p.groundMult });
        this.addEffect({ kind: 'hit', pos: { ...goal }, color: p.color, ttl: 0.15, max: 0.15 });
        if (p.shred || p.dot) applyDescaler(target, p.shred ?? 0, p.dot ?? 0, p.dotTime ?? 3);
      }
    }
    this.projectiles = remaining;
  }
}
