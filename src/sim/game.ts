import { Rng } from '../core/rng';
import { dist, type Vec } from '../core/vec';
import { ENEMIES } from '../data/enemies';
import { JEFF } from '../data/jeff';
import { TOWERS, TOWER_ORDER } from '../data/towers';
import type { Difficulty, EnemyId, MapDef, Modifiers, TowerId } from '../data/types';
import { applyDamage, isTargetable } from './combat';
import { updateEnemies } from './enemies';
import { updateHero } from './hero';
import { Path } from './path';
import type { ActiveSpawn, Clamp, Effect, Enemy, GameStatus, Hero, Projectile, RunStats, Tower } from './state';
import { updateAuras, updateTowers } from './towers';

export interface GameOptions {
  difficulty: Difficulty;
  mods: Modifiers;
  seed?: number;
  heroEnabled?: boolean;
}

export const FIRST_WAVE_COUNTDOWN = 20;
export const BETWEEN_WAVE_GRACE = 14;
export const EARLY_CALL_BONUS_PER_SECOND = 1.5;

export class Game {
  readonly map: MapDef;
  readonly paths: Path[];
  readonly difficulty: Difficulty;
  readonly mods: Modifiers;
  readonly rng: Rng;
  readonly heroEnabled: boolean;

  enemies: Enemy[] = [];
  towers: Tower[] = [];
  projectiles: Projectile[] = [];
  effects: Effect[] = [];
  hero: Hero;
  clamp: Clamp | null = null;

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
  /** Per-frame Expansion Tank buffs keyed by tower id. */
  buffs = new Map<number, { dmg: number; range: number }>();

  private idCounter = 1;

  constructor(map: MapDef, opts: GameOptions) {
    this.map = map;
    this.paths = map.paths.map((p) => new Path(p));
    this.difficulty = opts.difficulty;
    this.mods = opts.mods;
    this.rng = new Rng(opts.seed ?? 1);
    this.heroEnabled = opts.heroEnabled ?? true;
    this.money = map.startMoney + opts.mods.startMoney;
    this.lives = Math.max(1, Math.round(map.lives * opts.difficulty.livesMult));
    const maxHp = Math.round(JEFF.hp * opts.mods.jeffHp);
    this.hero = {
      pos: { ...map.jeffStart },
      anchor: { ...map.jeffStart },
      dest: null,
      hp: maxHp,
      maxHp,
      attackTimer: 0,
      tapTimer: 0,
      clampCooldown: 0,
      shutoffCooldown: 0,
      downed: 0,
      facing: 1,
      swing: 0,
      targetId: null,
    };
    this.stats = {
      jeffDamage: 0,
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
    return this.map.waves.length;
  }

  get allWavesStarted(): boolean {
    return this.waveIdx >= this.totalWaves;
  }

  get waveActive(): boolean {
    return this.spawns.length > 0 || this.enemies.some((e) => !e.dead && !e.escaped);
  }

  nextWaveEnemies(): EnemyId[] {
    const w = this.map.waves[this.waveIdx];
    if (!w) return [];
    return [...new Set(w.groups.map((g) => g.enemy))];
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
    if (t.level >= 2) return null;
    return Math.round(t.def.levels[t.level + 1]!.cost * this.mods.towerCost);
  }

  sellValue(t: Tower): number {
    return Math.round(t.invested * this.mods.sellRate);
  }

  effectiveRange(t: Tower): number {
    const buff = this.buffs.get(t.id)?.range ?? 0;
    return t.def.levels[t.level].range * this.mods.towerRange * (1 + buff);
  }

  effectiveDamage(t: Tower): number {
    const buff = this.buffs.get(t.id)?.dmg ?? 0;
    return t.def.levels[t.level].damage * this.mods.towerDamage * (1 + buff);
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

  placeTower(slot: number, id: TowerId): boolean {
    if (this.status !== 'playing') return false;
    if (slot < 0 || slot >= this.map.slots.length || this.towerAt(slot)) return false;
    if (!this.map.allowedTowers.includes(id)) return false;
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
    });
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
    t.level = (t.level + 1) as 1 | 2;
    const lvl = t.def.levels[t.level];
    if (lvl.hp !== undefined) {
      const ratio = t.maxHp > 0 ? t.hp / t.maxHp : 1;
      t.maxHp = lvl.hp;
      t.hp = t.rebuild > 0 ? t.hp : Math.max(t.hp, lvl.hp * ratio);
    }
    this.addEffect({ kind: 'ring', pos: { ...t.pos }, radius: 30, color: '#fff', ttl: 0.4, max: 0.4 });
    return true;
  }

  sellTower(towerId: number): boolean {
    if (this.status !== 'playing') return false;
    const t = this.towerById(towerId);
    if (!t) return false;
    const value = this.sellValue(t);
    this.money += value;
    for (const e of this.enemies) if (e.heldBy?.kind === 'tower' && e.heldBy.id === t.id) e.heldBy = null;
    this.towers = this.towers.filter((x) => x.id !== towerId);
    this.addEffect({ kind: 'text', pos: { x: t.pos.x, y: t.pos.y - 20 }, text: `+$${value}`, color: '#ffe082', ttl: 0.9, max: 0.9 });
    return true;
  }

  commandHero(pos: Vec): boolean {
    if (!this.heroEnabled || this.status !== 'playing' || this.hero.downed > 0) return false;
    const x = Math.max(10, Math.min(950, pos.x));
    const y = Math.max(10, Math.min(590, pos.y));
    this.hero.dest = { x, y };
    this.hero.anchor = { x, y };
    for (const e of this.enemies) if (e.heldBy?.kind === 'hero') e.heldBy = null;
    return true;
  }

  useClamp(): boolean {
    if (!this.heroEnabled || this.status !== 'playing') return false;
    const h = this.hero;
    if (h.downed > 0 || h.clampCooldown > 0) return false;
    h.clampCooldown = JEFF.clamp.cooldown * this.mods.cooldown;
    this.clamp = { pos: { ...h.pos }, timeLeft: JEFF.clamp.duration };
    this.addEffect({ kind: 'ring', pos: { ...h.pos }, radius: JEFF.clamp.radius, color: '#e74c3c', ttl: 0.5, max: 0.5 });
    return true;
  }

  useShutoff(): boolean {
    if (!this.heroEnabled || this.status !== 'playing') return false;
    const h = this.hero;
    if (h.downed > 0 || h.shutoffCooldown > 0) return false;
    h.shutoffCooldown = JEFF.shutoff.cooldown * this.mods.cooldown;
    this.globalSlow = JEFF.shutoff.slow;
    this.globalSlowTimer = JEFF.shutoff.duration;
    this.spawnPause = JEFF.shutoff.duration;
    this.addEffect({ kind: 'text', pos: { x: 480, y: 80 }, text: 'EMERGENCY SHUTOFF', color: '#4fc3f7', ttl: 1.5, max: 1.5 });
    return true;
  }

  /** Start the pending wave immediately. Returns the early-call bonus paid. */
  callNextWave(): number {
    if (this.status !== 'playing' || this.allWavesStarted || this.waveCountdown < 0) return 0;
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
    h.hp -= amount;
    if (h.hp <= 0) {
      h.hp = 0;
      h.downed = JEFF.respawn;
      h.dest = null;
      for (const e of this.enemies) if (e.heldBy?.kind === 'hero') e.heldBy = null;
      this.addEffect({ kind: 'text', pos: { x: h.pos.x, y: h.pos.y - 40 }, text: 'Jeff needs a minute', color: '#ff8a80', ttl: 1.4, max: 1.4 });
    }
  }

  /** Try to consume an Expansion Tank shield covering this tower. */
  consumeShield(t: Tower): boolean {
    for (const tank of this.towers) {
      if (tank.def.id !== 'expansion' || tank.shieldCooldown > 0) continue;
      if (dist(tank.pos, t.pos) > this.effectiveRange(tank)) continue;
      tank.shieldCooldown = tank.def.levels[tank.level].shieldCooldown ?? 15;
      this.addEffect({ kind: 'ring', pos: { ...t.pos }, radius: 26, color: '#ffd54f', ttl: 0.5, max: 0.5 });
      this.addEffect({ kind: 'text', pos: { x: t.pos.x, y: t.pos.y - 26 }, text: 'absorbed', color: '#ffd54f', ttl: 0.9, max: 0.9 });
      return true;
    }
    return false;
  }

  spawnEnemy(id: EnemyId, pathIdx: number, progress = 0): Enemy {
    const def = ENEMIES[id];
    const hp = Math.round(def.hp * this.difficulty.hpMult);
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
      speedMult: 1,
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
    updateEnemies(this, dt);
    this.updateProjectiles(dt);

    this.enemies = this.enemies.filter((e) => !e.dead && !e.escaped);
    for (const fx of this.effects) fx.ttl -= dt;
    this.effects = this.effects.filter((fx) => fx.ttl > 0);

    if (this.lives <= 0) {
      this.lives = 0;
      this.status = 'lost';
    } else if (this.allWavesStarted && !this.waveActive) {
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

  private updateWaves(dt: number): void {
    if (!this.allWavesStarted && this.waveCountdown >= 0) {
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

  private startWave(): void {
    const w = this.map.waves[this.waveIdx];
    if (!w) return;
    let duration = 0;
    for (const g of w.groups) {
      this.spawns.push({ enemy: g.enemy, remaining: g.count, interval: g.interval, timer: g.delay, path: g.path });
      duration = Math.max(duration, g.delay + (g.count - 1) * g.interval);
    }
    this.waveIdx++;
    this.waveCountdown = this.allWavesStarted ? -1 : duration + BETWEEN_WAVE_GRACE;
  }

  private updateProjectiles(dt: number): void {
    const remaining: Projectile[] = [];
    for (const p of this.projectiles) {
      const target = this.enemies.find((e) => e.id === p.targetId && !e.dead && !e.escaped);
      const goal = target ? target.pos : p.lastTargetPos;
      if (target) p.lastTargetPos = { ...target.pos };
      const step = p.speed * dt;
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
          if (dist(e.pos, goal) <= p.splash + e.def.radius) applyDamage(this, e, p.damage, p.damageType, p.source);
        }
      } else if (target) {
        applyDamage(this, target, p.damage, p.damageType, p.source, { groundMult: p.groundMult });
        this.addEffect({ kind: 'hit', pos: { ...goal }, color: p.color, ttl: 0.15, max: 0.15 });
      }
    }
    this.projectiles = remaining;
  }
}
