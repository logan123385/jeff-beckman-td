import { isHeroId, type HeroId } from '../data/heroes';
import { CORE_MAPS, MAPS } from '../data/maps';
import { ENEMY_ORDER } from '../data/enemies';
import { gearScore } from '../data/loot';
import { canUnlock, SKILLS, skillCost } from '../data/skills';
import { canUnlockTalent, TALENTS } from '../data/talents';
import { salvageXp, levelFromXp, talentPointsAvailable } from '../data/xp';
import { TOWER_ORDER } from '../data/towers';
import type { DifficultyId, EnemyId, GearItem, GearSlot, RemasterId, TowerId } from '../data/types';

export const INVENTORY_CAP = 24;
export const SAVE_KEY = 'jbtd-save-v1';
export const SAVE_BAK_KEY = 'jbtd-save-v1.bak';

export interface SaveData {
  version: 1;
  selectedHero: HeroId;
  /** mapId -> difficulty -> best stars (0–3). */
  stars: Record<string, Partial<Record<DifficultyId, number>>>;
  /** First-clear remaster badges (1 star each). Never required. */
  remasters: Record<string, Partial<Record<Exclude<RemasterId, 'classic'>, number>>>;
  serviceCallBest: number;
  muted: boolean;
  sfxVolume: number;
  ambientVolume: number;
  skills: string[];
  seen: EnemyId[];
  difficulty: DifficultyId;
  jeffXp: number;
  talents: string[];
  inventory: GearItem[];
  equipped: Partial<Record<GearSlot, string>>;
  gearSeq: number;
  lastLoadout: TowerId[];
  /** First-job coach completed or skipped. */
  tutorialDone: boolean;
}

const DIFFICULTIES: readonly DifficultyId[] = ['apprentice', 'journeyman', 'master'];
const REMASTERS: readonly Exclude<RemasterId, 'classic'>[] = ['codeInspection', 'frozenMain', 'cashJob', 'cleanHands'];
const SLOTS: readonly GearSlot[] = ['wrench', 'boots', 'belt', 'shirt', 'gauges'];
const RARITIES = ['common', 'uncommon', 'rare', 'relic'] as const;
const AFFIX_KEYS = [
  'jeffDamage',
  'jeffHp',
  'jeffSpeed',
  'cooldown',
  'stunDuration',
  'jeffHolds',
  'jeffRepair',
  'jeffReach',
  'jeffRespawn',
  'startMoney',
  'towerDamage',
] as const;

function blank(): SaveData {
  return {
    version: 1,
    selectedHero: 'jeff',
    stars: {},
    remasters: {},
    serviceCallBest: 0,
    muted: false,
    sfxVolume: 0.85,
    ambientVolume: 0.55,
    skills: [],
    seen: [],
    difficulty: 'journeyman',
    jeffXp: 0,
    talents: [],
    inventory: [],
    equipped: {},
    gearSeq: 1,
    lastLoadout: [],
    tutorialDone: false,
  };
}

function finiteNumber(value: unknown, fallback: number, min = 0, max = Number.MAX_SAFE_INTEGER): number {
  const n = typeof value === 'number' ? value : typeof value === 'string' ? Number(value) : NaN;
  if (!Number.isFinite(n)) return fallback;
  return Math.min(max, Math.max(min, n));
}

function looksLikeV1(parsed: Record<string, unknown>): boolean {
  return (
    parsed.stars !== undefined ||
    parsed.jeffXp !== undefined ||
    parsed.selectedHero !== undefined ||
    parsed.skills !== undefined ||
    parsed.difficulty !== undefined
  );
}

function sanitizeSkills(ids: unknown): string[] {
  if (!Array.isArray(ids)) return [];
  const wanted = new Set(ids.filter((id): id is string => typeof id === 'string'));
  const owned = new Set<string>();
  const kept: string[] = [];
  for (const node of [...SKILLS].sort((a, b) => a.tier - b.tier)) {
    if (!wanted.has(node.id)) continue;
    if (canUnlock(node.id, owned)) {
      kept.push(node.id);
      owned.add(node.id);
    }
  }
  return kept;
}

function sanitizeTalents(ids: unknown): string[] {
  if (!Array.isArray(ids)) return [];
  const wanted = new Set(ids.filter((id): id is string => typeof id === 'string'));
  const owned = new Set<string>();
  const kept: string[] = [];
  for (const node of [...TALENTS].sort((a, b) => a.tier - b.tier)) {
    if (!wanted.has(node.id)) continue;
    if (canUnlockTalent(node.id, owned)) {
      kept.push(node.id);
      owned.add(node.id);
    }
  }
  return kept;
}

function sanitizeGear(raw: unknown): GearItem[] {
  if (!Array.isArray(raw)) return [];
  const out: GearItem[] = [];
  for (const item of raw) {
    if (!item || typeof item !== 'object') continue;
    const row = item as Partial<GearItem>;
    if (typeof row.id !== 'string' || !row.id) continue;
    if (!SLOTS.includes(row.slot as GearSlot)) continue;
    if (!RARITIES.includes(row.rarity as (typeof RARITIES)[number])) continue;
    const affixes = Array.isArray(row.affixes)
      ? row.affixes
          .filter((a): a is GearItem['affixes'][number] => {
            if (!a || typeof a !== 'object') return false;
            return (AFFIX_KEYS as readonly string[]).includes((a as { key?: string }).key ?? '') && Number.isFinite(Number((a as { amount?: unknown }).amount));
          })
          .map((a) => ({ key: a.key, amount: Number(a.amount) }))
      : [];
    out.push({ id: row.id, name: typeof row.name === 'string' ? row.name : 'Unknown fitting', slot: row.slot as GearSlot, rarity: row.rarity as GearItem['rarity'], affixes });
    if (out.length >= INVENTORY_CAP) break;
  }
  return out;
}

/** Coerce a versioned blob into a playable save. Never throws. */
export function normalizeSave(parsed: Partial<SaveData> & Record<string, unknown>): SaveData {
  const base = blank();
  const difficulty = DIFFICULTIES.includes(parsed.difficulty as DifficultyId)
    ? (parsed.difficulty as DifficultyId)
    : 'journeyman';
  const inventory = sanitizeGear(parsed.inventory);
  const invIds = new Set(inventory.map((g) => g.id));
  const equipped: Partial<Record<GearSlot, string>> = {};
  const rawEq = parsed.equipped && typeof parsed.equipped === 'object' ? parsed.equipped : {};
  for (const slot of SLOTS) {
    const id = (rawEq as Record<string, unknown>)[slot];
    if (typeof id === 'string' && invIds.has(id)) equipped[slot] = id;
  }
  const stars: SaveData['stars'] = {};
  if (parsed.stars && typeof parsed.stars === 'object') {
    for (const [mapId, row] of Object.entries(parsed.stars as Record<string, unknown>)) {
      if (!row || typeof row !== 'object') continue;
      const entry: Partial<Record<DifficultyId, number>> = {};
      for (const diff of DIFFICULTIES) {
        const n = finiteNumber((row as Record<string, unknown>)[diff], -1, 0, 3);
        if (n >= 0) entry[diff] = Math.round(n);
      }
      stars[mapId] = entry;
    }
  }
  const remasters: SaveData['remasters'] = {};
  if (parsed.remasters && typeof parsed.remasters === 'object') {
    for (const [mapId, row] of Object.entries(parsed.remasters as Record<string, unknown>)) {
      if (!row || typeof row !== 'object') continue;
      const entry: Partial<Record<Exclude<RemasterId, 'classic'>, number>> = {};
      for (const id of REMASTERS) {
        const n = finiteNumber((row as Record<string, unknown>)[id], 0, 0, 1);
        if (n > 0) entry[id] = 1;
      }
      remasters[mapId] = entry;
    }
  }
  const seen = Array.isArray(parsed.seen)
    ? [...new Set(parsed.seen.filter((id): id is EnemyId => typeof id === 'string' && ENEMY_ORDER.includes(id as EnemyId)))]
    : [];
  const lastLoadout = Array.isArray(parsed.lastLoadout)
    ? parsed.lastLoadout.filter((id): id is TowerId => typeof id === 'string' && TOWER_ORDER.includes(id as TowerId))
    : [];
  const data: SaveData = {
    ...base,
    selectedHero: isHeroId(parsed.selectedHero) ? parsed.selectedHero : 'jeff',
    stars,
    remasters,
    serviceCallBest: Math.round(finiteNumber(parsed.serviceCallBest ?? parsed.nightShiftBest, 0, 0, 10_000)),
    muted: parsed.muted === true,
    sfxVolume: finiteNumber(parsed.sfxVolume, 0.85, 0, 1),
    ambientVolume: finiteNumber(parsed.ambientVolume, 0.55, 0, 1),
    skills: sanitizeSkills(parsed.skills),
    seen,
    difficulty,
    jeffXp: Math.round(finiteNumber(parsed.jeffXp, 0, 0, 5_000_000)),
    talents: sanitizeTalents(parsed.talents),
    inventory,
    equipped,
    gearSeq: Math.max(1, Math.round(finiteNumber(parsed.gearSeq, 1, 1, 1_000_000))),
    lastLoadout,
    tutorialDone: parsed.tutorialDone === true,
  };
  return data;
}

export class SaveStore {
  data: SaveData;
  lastWriteOk = true;
  recoveredFromBackup = false;

  constructor(private readonly storage: Storage | null = typeof localStorage === 'undefined' ? null : localStorage) {
    this.data = this.load();
  }

  private readKey(key: string): string | null {
    try {
      return this.storage?.getItem(key) ?? null;
    } catch {
      return null;
    }
  }

  private writeKey(key: string, value: string): boolean {
    if (!this.storage) return true;
    try {
      this.storage.setItem(key, value);
      return true;
    } catch {
      return false;
    }
  }

  private parseBlob(raw: string): SaveData | null {
    try {
      const parsed = JSON.parse(raw) as Partial<SaveData> & Record<string, unknown>;
      if (!parsed || typeof parsed !== 'object') return null;
      const version = parsed.version === undefined || parsed.version === null ? NaN : Number(parsed.version);
      if (!Number.isFinite(version)) {
        if (!looksLikeV1(parsed)) return null;
        return normalizeSave(parsed);
      }
      if (version !== 1) {
        if (!looksLikeV1(parsed)) return null;
        return normalizeSave({ ...parsed, version: 1 });
      }
      return normalizeSave(parsed);
    } catch {
      return null;
    }
  }

  private load(): SaveData {
    this.recoveredFromBackup = false;
    const raw = this.readKey(SAVE_KEY);
    if (raw) {
      const data = this.parseBlob(raw);
      if (data) return data;
    }
    const bak = this.readKey(SAVE_BAK_KEY);
    if (bak) {
      const data = this.parseBlob(bak);
      if (data) {
        this.recoveredFromBackup = true;
        this.writeKey(SAVE_KEY, bak);
        return data;
      }
    }
    return blank();
  }

  backup(): boolean {
    const raw = this.readKey(SAVE_KEY);
    if (!raw) return true;
    return this.writeKey(SAVE_BAK_KEY, raw);
  }

  save(): boolean {
    const payload = JSON.stringify(this.data);
    const ok = this.writeKey(SAVE_KEY, payload);
    this.lastWriteOk = ok;
    return ok;
  }

  reset(): boolean {
    if (!this.backup()) {
      this.lastWriteOk = false;
      return false;
    }
    this.data = blank();
    this.recoveredFromBackup = false;
    return this.save();
  }

  exportJson(): string {
    return JSON.stringify(this.data, null, 2);
  }

  /** Best stars for a map across all difficulties (forward-earn only). */
  starsFor(mapId: string): number {
    const byDiff = this.data.stars[mapId];
    if (!byDiff) return 0;
    return Math.max(0, ...Object.values(byDiff).map((v) => v ?? 0));
  }

  starsOn(mapId: string, difficulty: DifficultyId): number {
    return this.data.stars[mapId]?.[difficulty] ?? 0;
  }

  remasterCleared(mapId: string, remaster: Exclude<RemasterId, 'classic'>): boolean {
    return (this.data.remasters[mapId]?.[remaster] ?? 0) > 0;
  }

  recordClear(mapId: string, difficulty: DifficultyId, stars: number): void {
    const entry = this.data.stars[mapId] ?? {};
    entry[difficulty] = Math.max(entry[difficulty] ?? 0, stars);
    this.data.stars[mapId] = entry;
    this.save();
  }

  /** First remaster clear of a type on a map earns one Journeyman Star. */
  recordRemaster(mapId: string, remaster: Exclude<RemasterId, 'classic'>): boolean {
    if (this.remasterCleared(mapId, remaster)) return false;
    const entry = this.data.remasters[mapId] ?? {};
    entry[remaster] = 1;
    this.data.remasters[mapId] = entry;
    this.save();
    return true;
  }

  recordServiceCall(wave: number): void {
    if (wave <= this.data.serviceCallBest) return;
    this.data.serviceCallBest = wave;
    this.save();
  }

  /** Every campaign map has a star. Used for vanity, not the The Neverending Service Call gate. */
  hasAnyProgress(): boolean {
    return (
      this.totalStars() > 0 ||
      this.data.jeffXp > 0 ||
      this.data.talents.length > 0 ||
      this.data.skills.length > 0 ||
      this.data.inventory.length > 0 ||
      this.data.seen.length > 0 ||
      this.data.serviceCallBest > 0
    );
  }

  campaignComplete(): boolean {
    return MAPS.every((m) => this.starsFor(m.id) > 0);
  }

  /** The Neverending Service Call opens after the original four service calls so old saves stay valid. */
  serviceCallUnlocked(): boolean {
    return CORE_MAPS.every((m) => this.starsFor(m.id) > 0);
  }

  isUnlocked(mapIndex: number): boolean {
    if (mapIndex === 0) return true;
    const prev = MAPS[mapIndex - 1];
    return prev !== undefined && this.starsFor(prev.id) > 0;
  }

  remasterStars(): number {
    return Object.values(this.data.remasters).reduce((sum, row) => {
      return sum + Object.values(row).filter((v) => (v ?? 0) > 0).length;
    }, 0);
  }

  totalStars(): number {
    return MAPS.reduce((sum, m) => sum + this.starsFor(m.id), 0) + this.remasterStars();
  }

  spentStars(): number {
    return [...new Set(this.data.skills)].filter(id => SKILLS.some(s => s.id === id)).reduce((sum, id) => sum + skillCost(id), 0);
  }

  availableStars(): number {
    return this.totalStars() - this.spentStars();
  }

  unlockSkill(id: string): boolean {
    if (this.availableStars() < skillCost(id)) return false;
    if (!canUnlock(id, new Set(this.data.skills))) return false;
    this.data.skills.push(id);
    this.save();
    return true;
  }

  respec(): void {
    this.data.skills = [];
    this.save();
  }

  jeffLevel(): number {
    return levelFromXp(this.data.jeffXp).level;
  }

  talentPoints(): number {
    return talentPointsAvailable(this.data.jeffXp, this.data.talents.length);
  }

  addXp(amount: number): void {
    if (amount <= 0) return;
    this.data.jeffXp += amount;
    this.save();
  }

  unlockTalent(id: string): boolean {
    if (this.talentPoints() <= 0) return false;
    if (!canUnlockTalent(id, new Set(this.data.talents))) return false;
    this.data.talents.push(id);
    this.save();
    return true;
  }

  respecTalents(): void {
    this.data.talents = [];
    this.save();
  }

  nextGearId(): string {
    const id = `g${this.data.gearSeq}`;
    this.data.gearSeq += 1;
    this.save();
    return id;
  }

  equippedItems(): GearItem[] {
    const ids = Object.values(this.data.equipped).filter((id): id is string => Boolean(id));
    return ids
      .map((id) => this.data.inventory.find((g) => g.id === id))
      .filter((g): g is GearItem => Boolean(g));
  }

  itemById(id: string): GearItem | undefined {
    return this.data.inventory.find((g) => g.id === id);
  }

  addGear(item: GearItem): { kept: boolean; salvagedXp: number } {
    if (this.data.inventory.length < INVENTORY_CAP) {
      this.data.inventory.push(item);
      this.save();
      return { kept: true, salvagedXp: 0 };
    }
    const junk = this.data.inventory
      .filter((g) => !Object.values(this.data.equipped).includes(g.id))
      .sort((a, b) => gearScore(a) - gearScore(b))[0];
    if (!junk) {
      this.addXp(salvageXp(item.rarity));
      return { kept: false, salvagedXp: salvageXp(item.rarity) };
    }
    if (gearScore(item) <= gearScore(junk)) {
      this.addXp(salvageXp(item.rarity));
      return { kept: false, salvagedXp: salvageXp(item.rarity) };
    }
    const gained = this.salvage(junk.id);
    this.data.inventory.push(item);
    this.save();
    return { kept: true, salvagedXp: gained };
  }

  equip(id: string): boolean {
    const item = this.itemById(id);
    if (!item) return false;
    this.data.equipped[item.slot] = item.id;
    this.save();
    return true;
  }

  unequip(slot: GearSlot): void {
    delete this.data.equipped[slot];
    this.save();
  }

  salvage(id: string): number {
    const item = this.itemById(id);
    if (!item) return 0;
    if (this.data.equipped[item.slot] === id) delete this.data.equipped[item.slot];
    this.data.inventory = this.data.inventory.filter((g) => g.id !== id);
    const xp = salvageXp(item.rarity);
    this.data.jeffXp += xp;
    this.save();
    return xp;
  }

  markSeen(ids: Iterable<EnemyId>): void {
    const set = new Set(this.data.seen);
    let changed = false;
    for (const id of ids) {
      if (!set.has(id)) {
        set.add(id);
        changed = true;
      }
    }
    if (changed) {
      this.data.seen = [...set];
      this.save();
    }
  }

  hasSeen(id: EnemyId): boolean {
    return this.data.seen.includes(id);
  }

  setDifficulty(d: DifficultyId): void {
    this.data.difficulty = d;
    this.save();
  }

  setMuted(muted: boolean): void {
    this.data.muted = muted;
    this.save();
  }

  setVolumes(sfx: number, ambient: number): void {
    this.data.sfxVolume = Math.max(0, Math.min(1, sfx));
    this.data.ambientVolume = Math.max(0, Math.min(1, ambient));
    this.save();
  }

  markTutorialDone(): void {
    if (this.data.tutorialDone) return;
    this.data.tutorialDone = true;
    this.save();
  }

  /** Coach runs only for brand-new saves on Crawlspace Classic. */
  needsTutorial(): boolean {
    return !this.data.tutorialDone && !this.hasAnyProgress();
  }

  setHero(id: HeroId): void {
    if (!isHeroId(id)) return;
    this.data.selectedHero = id; this.save();
  }

  setLoadout(ids: TowerId[]): void {
    this.data.lastLoadout = [...ids];
    this.save();
  }
}

/** Stars for a clear: 3 for a clean sheet, 2 for keeping most lives, 1 for surviving. */
export function starsForClear(livesLeft: number, livesStart: number): number {
  if (livesLeft <= 0 || livesStart <= 0) return 0;
  if (livesLeft >= livesStart) return 3;
  if (livesLeft >= livesStart * 0.5) return 2;
  return 1;
}
