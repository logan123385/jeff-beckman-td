import { defaultCards } from '../data/kitCards';
import { STARTER_TOWERS, TOWER_PRICES, WELCOME_POINTS } from '../data/store';
import { COMMENDATIONS, commendationKey, type CommendationId } from '../data/commendations';
import { HERO_ORDER, isHeroId, type HeroId } from '../data/heroes';
import { CORE_MAPS, MAPS } from '../data/maps';
import { ENEMY_ORDER } from '../data/enemies';
import { gearScore } from '../data/loot';
import { salvageXp, levelFromXp } from '../data/xp';
import { TOWER_ORDER } from '../data/towers';
import { cardById, cardUnlocked } from '../data/kitCards';
import { defaultFamily, familyHero, familyStance, isWeaponFamilyId, type WeaponFamilyId } from '../data/weapons';
import type { ArmorItem, ArmorSlot, DifficultyId, EnemyId, GearSlot, KitItem, Rarity, RemasterId, TowerId } from '../data/types';

export const INVENTORY_CAP = 24;
export const SAVE_KEY = 'jbtd-save-v1';
export const SAVE_BAK_KEY = 'jbtd-save-v1.bak';
export const MAX_SAVE_BYTES = 1_000_000;

function browserStorage(): Storage | null {
  try { return typeof window === 'undefined' ? null : window.localStorage; }
  catch { return null; }
}

export interface CrewPreset { hero: HeroId; towers: TowerId[] }

export interface HeroKit {
  family: WeaponFamilyId;
  weaponId: string | null;
  cards: [string | null, string | null];
}

export interface SaveData {
  version: 2;
  /** Monotonic write generation. Missing on pre-fix blobs (treated as 0). */
  rev: number;
  selectedHero: HeroId;
  servicePoints: number;
  ownedTowers: TowerId[];
  /** mapId -> difficulty -> best stars (0–3). */
  stars: Record<string, Partial<Record<DifficultyId, number>>>;
  /** First-clear remaster badges (1 star each). Never required. */
  remasters: Record<string, Partial<Record<Exclude<RemasterId, 'classic'>, number>>>;
  serviceCallBest: number;
  muted: boolean;
  sfxVolume: number;
  ambientVolume: number;
  seen: EnemyId[];
  difficulty: DifficultyId;
  jeffXp: number;
  inventory: KitItem[];
  chestId: string | null;
  bootsId: string | null;
  kits: Partial<Record<HeroId, HeroKit>>;
  heroJobs: Partial<Record<HeroId, number>>;
  gearSeq: number;
  lastLoadout: TowerId[];
  crews: (CrewPreset | null)[];
  commendations: Record<string, CommendationId[]>;
  /** First-job coach completed or skipped. */
  tutorialDone: boolean;
}

const DIFFICULTIES: readonly DifficultyId[] = ['apprentice', 'journeyman', 'master'];
const REMASTERS: readonly Exclude<RemasterId, 'classic'>[] = ['codeInspection', 'frozenMain', 'cashJob', 'cleanHands'];
const V1_ARMOR_SLOTS: readonly GearSlot[] = ['shirt', 'belt', 'gauges', 'boots'];
const RARITIES: readonly Rarity[] = ['common', 'uncommon', 'rare', 'relic'];
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
  'heroRate',
  'onHitHeat',
  'bounty',
  'sellRate',
] as const;

function defaultHeroKit(hero: HeroId): HeroKit {
  return { family: defaultFamily(hero), weaponId: null, cards: defaultCards(hero) };
}

function blank(): SaveData {
  const kits: Partial<Record<HeroId, HeroKit>> = {};
  for (const hero of HERO_ORDER) kits[hero] = defaultHeroKit(hero);
  return {
    version: 2,
    rev: 0,
    selectedHero: 'jeff',
    servicePoints: WELCOME_POINTS,
    ownedTowers: [...STARTER_TOWERS],
    stars: {},
    remasters: {},
    serviceCallBest: 0,
    muted: false,
    sfxVolume: 0.85,
    ambientVolume: 0.55,
    seen: [],
    difficulty: 'journeyman',
    jeffXp: 0,
    inventory: [],
    chestId: null,
    bootsId: null,
    kits,
    heroJobs: {},
    gearSeq: 1,
    lastLoadout: [],
    crews: [null, null, null],
    commendations: {},
    tutorialDone: false,
  };
}

function finiteNumber(value: unknown, fallback: number, min = 0, max = Number.MAX_SAFE_INTEGER): number {
  const n = typeof value === 'number' ? value : typeof value === 'string' ? Number(value) : NaN;
  if (!Number.isFinite(n)) return fallback;
  return Math.min(max, Math.max(min, n));
}

function nextGearSeq(raw: unknown, inventory: KitItem[]): number {
  let next = Math.max(1, Math.round(finiteNumber(raw, 1, 1, 1_000_000)));
  for (const item of inventory) {
    const match = /^g(\d+)$/.exec(item.id);
    if (!match) continue;
    next = Math.max(next, Number(match[1]) + 1);
  }
  return next;
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

function sanitizeAffixes(raw: unknown): KitItem['affixes'] {
  if (!Array.isArray(raw)) return [];
  return raw
    .filter((a): a is KitItem['affixes'][number] => {
      if (!a || typeof a !== 'object') return false;
      return (AFFIX_KEYS as readonly string[]).includes((a as { key?: string }).key ?? '') && Number.isFinite(Number((a as { amount?: unknown }).amount));
    })
    .map((a) => ({ key: a.key, amount: Number(a.amount) }));
}

function sanitizeKitItem(raw: unknown, wrenchSalvage: { xp: number }): KitItem | null {
  if (!raw || typeof raw !== 'object') return null;
  const row = raw as Record<string, unknown>;
  if (typeof row.id !== 'string' || !row.id) return null;
  if (!RARITIES.includes(row.rarity as Rarity)) return null;

  if (row.kind === 'weapon') {
    const family = typeof row.family === 'string' ? row.family : '';
    if (!isWeaponFamilyId(family)) return null;
    return {
      kind: 'weapon',
      id: row.id,
      family,
      name: typeof row.name === 'string' ? row.name : 'Unknown weapon',
      rarity: row.rarity as Rarity,
      affixes: sanitizeAffixes(row.affixes),
    };
  }

  if (row.kind === 'armor') {
    const slot = row.slot;
    if (slot !== 'chest' && slot !== 'boots') return null;
    return {
      kind: 'armor',
      id: row.id,
      slot,
      name: typeof row.name === 'string' ? row.name : 'Unknown armor',
      rarity: row.rarity as Rarity,
      affixes: sanitizeAffixes(row.affixes),
    };
  }

  const slot = row.slot as GearSlot;
  if (slot === 'wrench') {
    wrenchSalvage.xp += salvageXp(row.rarity as Rarity);
    return null;
  }
  if (!V1_ARMOR_SLOTS.includes(slot)) return null;
  const armorSlot: ArmorSlot = slot === 'boots' ? 'boots' : 'chest';
  return {
    kind: 'armor',
    id: row.id,
    slot: armorSlot,
    name: typeof row.name === 'string' ? row.name : 'Unknown fitting',
    rarity: row.rarity as Rarity,
    affixes: sanitizeAffixes(row.affixes),
  };
}

function sanitizeInventory(raw: unknown): { inventory: KitItem[]; wrenchSalvage: number } {
  if (!Array.isArray(raw)) return { inventory: [], wrenchSalvage: 0 };
  const wrenchSalvage = { xp: 0 };
  const out: KitItem[] = [];
  for (const item of raw) {
    const kept = sanitizeKitItem(item, wrenchSalvage);
    if (kept) {
      out.push(kept);
      if (out.length >= INVENTORY_CAP) break;
    }
  }
  return { inventory: out, wrenchSalvage: wrenchSalvage.xp };
}

function migrateHeroJobs(parsed: Record<string, unknown>): Partial<Record<HeroId, number>> {
  const heroJobs: Partial<Record<HeroId, number>> = {};
  const rawBuilds = parsed.heroBuilds;
  if (!rawBuilds || typeof rawBuilds !== 'object') return heroJobs;
  for (const hero of HERO_ORDER) {
    const build = (rawBuilds as Record<string, unknown>)[hero];
    if (!build || typeof build !== 'object') continue;
    const nodes = Array.isArray((build as { nodes?: unknown }).nodes)
      ? (build as { nodes: unknown[] }).nodes.filter((n): n is string => typeof n === 'string')
      : [];
    if (nodes.length === 0) continue;
    heroJobs[hero] = Math.max(heroJobs[hero] ?? 0, 1);
    if (nodes.some((n) => n.endsWith(':4'))) heroJobs[hero] = Math.max(heroJobs[hero] ?? 0, 3);
  }
  return heroJobs;
}

function sanitizeHeroJobs(
  parsed: Record<string, unknown>,
  migrated: Partial<Record<HeroId, number>>,
): Partial<Record<HeroId, number>> {
  const heroJobs: Partial<Record<HeroId, number>> = { ...migrated };
  const raw = parsed.heroJobs;
  if (!raw || typeof raw !== 'object') return heroJobs;
  for (const hero of HERO_ORDER) {
    const n = finiteNumber((raw as Record<string, unknown>)[hero], -1, 0, 1_000_000);
    if (n >= 0) heroJobs[hero] = Math.max(heroJobs[hero] ?? 0, Math.round(n));
  }
  return heroJobs;
}

function sanitizeKits(
  parsed: Record<string, unknown>,
  inventory: KitItem[],
  heroJobs: Partial<Record<HeroId, number>>,
): Partial<Record<HeroId, HeroKit>> {
  const kits = initKits();
  const raw = parsed.kits;
  if (!raw || typeof raw !== 'object') return kits;
  const invById = new Map(inventory.map((item) => [item.id, item]));

  for (const hero of HERO_ORDER) {
    const row = (raw as Record<string, unknown>)[hero];
    if (!row || typeof row !== 'object') continue;
    const kitRow = row as Record<string, unknown>;
    const family =
      typeof kitRow.family === 'string' && isWeaponFamilyId(kitRow.family) && familyHero(kitRow.family) === hero
        ? kitRow.family
        : defaultFamily(hero);
    const stance = familyStance(family);
    const jobs = heroJobs[hero] ?? 0;

    let weaponId: string | null = null;
    if (typeof kitRow.weaponId === 'string') {
      const weapon = invById.get(kitRow.weaponId);
      if (
        weapon?.kind === 'weapon' &&
        isWeaponFamilyId(weapon.family) &&
        familyHero(weapon.family) === hero &&
        weapon.family === family
      ) {
        weaponId = kitRow.weaponId;
      }
    }

    const cards: [string | null, string | null] =
      stance === 'melee'
        ? [`${hero}_anchor`, `${hero}_breaker`]
        : [`${hero}_lane`, `${hero}_pin`];
    if (Array.isArray(kitRow.cards)) {
      for (let i = 0; i < 2; i++) {
        const id = kitRow.cards[i];
        if (typeof id !== 'string' || !id) {
          cards[i] = null;
          continue;
        }
        const card = cardById(id);
        cards[i] = card && card.hero === hero && card.stance === stance && cardUnlocked(card, jobs) ? id : null;
      }
    }

    kits[hero] = { family, weaponId, cards };
  }
  return kits;
}

function initKits(): Partial<Record<HeroId, HeroKit>> {
  const kits: Partial<Record<HeroId, HeroKit>> = {};
  for (const hero of HERO_ORDER) kits[hero] = defaultHeroKit(hero);
  return kits;
}

function veteranArmor(): { chest: ArmorItem; boots: ArmorItem } {
  return {
    chest: {
      kind: 'armor',
      id: 'g-veteran-chest',
      slot: 'chest',
      name: 'Veteran Vest',
      rarity: 'rare',
      affixes: [
        { key: 'startMoney', amount: 50 },
        { key: 'cooldown', amount: 0.08 },
        { key: 'jeffHp', amount: 0.12 },
      ],
    },
    boots: {
      kind: 'armor',
      id: 'g-veteran-boots',
      slot: 'boots',
      name: 'Veteran Pacs',
      rarity: 'rare',
      affixes: [
        { key: 'jeffSpeed', amount: 0.08 },
        { key: 'jeffRespawn', amount: 0.1 },
        { key: 'startMoney', amount: 20 },
      ],
    },
  };
}

function trimInventoryToCap(inventory: KitItem[], preserveIds: ReadonlySet<string>): void {
  while (inventory.length > INVENTORY_CAP) {
    let junkIdx = -1;
    let junkScore = Infinity;
    for (let i = 0; i < inventory.length; i++) {
      const item = inventory[i]!;
      if (preserveIds.has(item.id)) continue;
      const score = gearScore(item);
      if (score < junkScore) {
        junkScore = score;
        junkIdx = i;
      }
    }
    if (junkIdx < 0) break;
    inventory.splice(junkIdx, 1);
  }
}

function migrateEquippedArmor(
  parsed: Record<string, unknown>,
  inventory: KitItem[],
): { chestId: string | null; bootsId: string | null } {
  const invIds = new Set(inventory.map((i) => i.id));
  let chestId: string | null = typeof parsed.chestId === 'string' && invIds.has(parsed.chestId) ? parsed.chestId : null;
  let bootsId: string | null = typeof parsed.bootsId === 'string' && invIds.has(parsed.bootsId) ? parsed.bootsId : null;
  const rawEq = parsed.equipped && typeof parsed.equipped === 'object' ? parsed.equipped : {};
  for (const slot of ['shirt', 'belt', 'gauges'] as const) {
    const id = (rawEq as Record<string, unknown>)[slot];
    if (typeof id === 'string' && invIds.has(id) && !chestId) chestId = id;
  }
  const bootsEquipped = (rawEq as Record<string, unknown>).boots;
  if (typeof bootsEquipped === 'string' && invIds.has(bootsEquipped) && !bootsId) bootsId = bootsEquipped;
  return { chestId, bootsId };
}

function hadSkillTree(parsed: Record<string, unknown>): boolean {
  return (Array.isArray(parsed.skills) && parsed.skills.length > 0) || (Array.isArray(parsed.talents) && parsed.talents.length > 0);
}

/** Coerce a versioned blob into a playable save. Never throws. */
export function normalizeSave(parsed: Partial<SaveData> & Record<string, unknown>): SaveData {
  const base = blank();
  const difficulty = DIFFICULTIES.includes(parsed.difficulty as DifficultyId)
    ? (parsed.difficulty as DifficultyId)
    : 'journeyman';
  const { inventory, wrenchSalvage } = sanitizeInventory(parsed.inventory);
  let jeffXp = Math.round(finiteNumber(parsed.jeffXp, 0, 0, 5_000_000)) + wrenchSalvage;
  const heroJobs = sanitizeHeroJobs(parsed, migrateHeroJobs(parsed));
  const kits = sanitizeKits(parsed, inventory, heroJobs);
  const { chestId: migratedChest, bootsId: migratedBoots } = migrateEquippedArmor(parsed, inventory);
  let chestId = migratedChest;
  let bootsId = migratedBoots;

  if (hadSkillTree(parsed)) {
    const veteran = veteranArmor();
    if (!inventory.some((i) => i.id === veteran.chest.id)) inventory.push(veteran.chest);
    if (!inventory.some((i) => i.id === veteran.boots.id)) inventory.push(veteran.boots);
    const preserve = new Set<string>([veteran.chest.id, veteran.boots.id]);
    if (chestId) preserve.add(chestId);
    if (bootsId) preserve.add(bootsId);
    trimInventoryToCap(inventory, preserve);
    if (!chestId && inventory.some((i) => i.id === veteran.chest.id)) chestId = veteran.chest.id;
    if (!bootsId && inventory.some((i) => i.id === veteran.boots.id)) bootsId = veteran.boots.id;
  } else {
    const preserve = new Set<string>();
    if (chestId) preserve.add(chestId);
    if (bootsId) preserve.add(bootsId);
    trimInventoryToCap(inventory, preserve);
  }

  const invIds = new Set(inventory.map((i) => i.id));
  if (chestId && !invIds.has(chestId)) chestId = null;
  if (bootsId && !invIds.has(bootsId)) bootsId = null;

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
  const crews = Array.from({ length: 3 }, (_, index): CrewPreset | null => {
    const value = Array.isArray(parsed.crews) ? parsed.crews[index] : null;
    if (!value || typeof value !== 'object' || !Array.isArray(value.towers)) return null;
    const towers = [...new Set(value.towers.filter((id: unknown): id is TowerId => typeof id === 'string' && TOWER_ORDER.includes(id as TowerId)))].slice(0, 5) as TowerId[];
    return towers.length ? { hero: isHeroId(value.hero) ? value.hero : 'jeff', towers } : null;
  });
  const commendations: Record<string, CommendationId[]> = {};
  for (const map of MAPS.filter(map => !map.endless)) for (const difficulty of DIFFICULTIES) for (const remaster of ['classic', ...REMASTERS]) {
    const key = commendationKey(map.id, difficulty, remaster);
    const value = parsed.commendations && typeof parsed.commendations === 'object' ? parsed.commendations[key] : null;
    if (Array.isArray(value)) commendations[key] = COMMENDATIONS.filter(goal => value.includes(goal.id)).map(goal => goal.id);
  }
  const legacy = MAPS.filter((_, i) => i === 0 || Object.values(stars[MAPS[i - 1]!.id] ?? {}).some(n => (n ?? 0) > 0)).flatMap(map => map.allowedTowers);
  const purchased = Array.isArray(parsed.ownedTowers) ? parsed.ownedTowers : legacy;
  const ownedTowers = TOWER_ORDER.filter(id => STARTER_TOWERS.includes(id) || purchased.includes(id));

  const data: SaveData = {
    ...base,
    selectedHero: isHeroId(parsed.selectedHero) ? parsed.selectedHero : 'jeff',
    servicePoints: Math.round(finiteNumber(parsed.servicePoints, WELCOME_POINTS, 0, 1_000_000)),
    ownedTowers,
    stars,
    remasters,
    serviceCallBest: Math.round(finiteNumber(parsed.serviceCallBest ?? parsed.nightShiftBest, 0, 0, 10_000)),
    muted: parsed.muted === true,
    sfxVolume: finiteNumber(parsed.sfxVolume, 0.85, 0, 1),
    ambientVolume: finiteNumber(parsed.ambientVolume, 0.55, 0, 1),
    seen,
    difficulty,
    jeffXp,
    inventory,
    chestId,
    bootsId,
    kits,
    heroJobs,
    gearSeq: nextGearSeq(parsed.gearSeq, inventory),
    rev: Math.max(0, Math.round(finiteNumber(parsed.rev, 0, 0, Number.MAX_SAFE_INTEGER))),
    lastLoadout,
    crews,
    commendations,
    tutorialDone: parsed.tutorialDone === true,
  };
  return data;
}

export class SaveStore {
  data: SaveData;
  lastWriteOk = true;
  recoveredFromBackup = false;
  /** Set when save() refuses to overwrite a newer tab's blob (SR-002). */
  staleWriteSkipped = false;
  private holdSaves = 0;
  private pendingSave = false;
  private readonly onStorage?: (ev: StorageEvent) => void;

  constructor(private readonly storage: Storage | null = browserStorage()) {
    this.lastWriteOk = !!storage || typeof window === 'undefined';
    this.data = this.load();
    if (typeof window !== 'undefined' && this.storage && this.storage === browserStorage()) {
      this.onStorage = (ev: StorageEvent) => {
        if (ev.storageArea !== this.storage || ev.key !== SAVE_KEY || !ev.newValue || !this.lastWriteOk) return;
        const incoming = this.parseBlob(ev.newValue);
        if (!incoming) return;
        if ((incoming.rev ?? 0) > (this.data.rev ?? 0)) this.data = incoming;
      };
      window.addEventListener('storage', this.onStorage);
    }
  }

  dispose(): void {
    if (this.onStorage) window.removeEventListener('storage', this.onStorage);
  }

  private refresh(): void {
    // Keep unsaved in-memory rewards available for export after a quota failure.
    if (!this.lastWriteOk) return;
    const raw = this.readKey(SAVE_KEY);
    const disk = raw ? this.parseBlob(raw) : null;
    if (disk && disk.rev > this.data.rev) this.data = disk;
  }

  /** Collapse several mutations into one disk write (SR-004). */
  transact<T>(fn: () => T): T {
    if (this.holdSaves === 0) this.refresh();
    const before = JSON.stringify(this.data);
    this.holdSaves += 1;
    const prevPending = this.pendingSave;
    let result: T;
    try {
      result = fn();
    } catch (err) {
      this.data = JSON.parse(before) as SaveData;
      this.pendingSave = prevPending;
      throw err;
    } finally {
      this.holdSaves -= 1;
    }
    if (this.holdSaves === 0 && this.pendingSave) this.save();
    return result;
  }

  private readKey(key: string): string | null {
    try {
      return this.storage?.getItem(key) ?? null;
    } catch {
      this.lastWriteOk = false;
      return null;
    }
  }

  private writeKey(key: string, value: string): boolean {
    if (!this.storage) return typeof window === 'undefined';
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
      if (version !== 1 && version !== 2) {
        if (!looksLikeV1(parsed)) return null;
        return normalizeSave(parsed);
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
        this.lastWriteOk = this.writeKey(SAVE_KEY, bak);
        return data;
      }
    }
    return blank();
  }

  private occupiedIds(): Set<string> {
    const ids = new Set<string>();
    if (this.data.chestId) ids.add(this.data.chestId);
    if (this.data.bootsId) ids.add(this.data.bootsId);
    for (const kit of Object.values(this.data.kits)) {
      if (kit?.weaponId) ids.add(kit.weaponId);
    }
    return ids;
  }

  backup(): boolean {
    const raw = this.readKey(SAVE_KEY);
    if (!raw) return true;
    return this.writeKey(SAVE_BAK_KEY, raw);
  }

  save(): boolean {
    if (this.holdSaves > 0) {
      this.pendingSave = true;
      return true;
    }
    if (!this.mayWriteOverDisk()) {
      this.staleWriteSkipped = true;
      this.pendingSave = false;
      return false;
    }
    this.staleWriteSkipped = false;
    const nextRev = this.data.rev + 1;
    const payload = JSON.stringify({ ...this.data, rev: nextRev });
    const ok = this.writeKey(SAVE_KEY, payload);
    if (ok) this.data.rev = nextRev;
    this.lastWriteOk = ok;
    this.pendingSave = false;
    return ok;
  }

  /** False when another tab already persisted a newer generation. Adopts that blob. */
  private mayWriteOverDisk(): boolean {
    const raw = this.readKey(SAVE_KEY);
    if (!raw) return true;
    const disk = this.parseBlob(raw);
    if (!disk) return true;
    if ((disk.rev ?? 0) <= (this.data.rev ?? 0)) return true;
    if (this.lastWriteOk) this.data = disk;
    return false;
  }

  reset(): boolean {
    this.refresh();
    if (!this.backup()) {
      this.lastWriteOk = false;
      return false;
    }
    const before = this.data;
    const keepRev = this.data.rev ?? 0;
    this.data = blank();
    this.data.rev = keepRev;
    this.recoveredFromBackup = false;
    if (this.save()) return true;
    this.data = before;
    return false;
  }

  exportJson(): string {
    return JSON.stringify(this.data, null, 2);
  }

  /** Validate a downloaded save before replacing anything on this device. */
  importJson(raw: string): { ok: boolean; message: string } {
    if (raw.length > MAX_SAVE_BYTES) return { ok: false, message: 'That file is too large to be a game save.' };
    let parsed: Record<string, unknown>;
    try { parsed = JSON.parse(raw); }
    catch { return { ok: false, message: 'That file is not valid JSON. Choose a downloaded Jeff Beckman TD save.' }; }
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed) || !looksLikeV1(parsed) ||
        (parsed.version !== undefined && ![1, 2].includes(Number(parsed.version)))) {
      return { ok: false, message: 'That file is not a supported Jeff Beckman TD save.' };
    }
    const incoming = this.parseBlob(raw);
    if (!incoming) return { ok: false, message: 'That save could not be read. Your current progress is unchanged.' };
    this.refresh();
    if (!this.backup()) return { ok: false, message: 'Could not back up your current save. Nothing was replaced.' };
    const before = this.data;
    incoming.rev = before.rev;
    this.data = incoming;
    if (!this.save()) {
      this.data = before;
      return { ok: false, message: 'Could not store that save on this device. Your current progress is unchanged.' };
    }
    this.recoveredFromBackup = false;
    return { ok: true, message: 'Save restored.' };
  }

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

  hasAnyProgress(): boolean {
    return (
      this.totalStars() > 0 ||
      this.data.jeffXp > 0 ||
      this.data.inventory.length > 0 ||
      this.data.serviceCallBest > 0 ||
      this.data.ownedTowers.some(id => !STARTER_TOWERS.includes(id)) ||
      Object.values(this.data.heroJobs).some((j) => (j ?? 0) > 0)
    );
  }

  campaignComplete(): boolean {
    return MAPS.every((m) => this.starsFor(m.id) > 0);
  }

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

  availableStars(): number {
    return this.totalStars();
  }

  jeffLevel(): number {
    return levelFromXp(this.data.jeffXp).level;
  }

  addXp(amount: number): void {
    if (amount <= 0) return;
    this.data.jeffXp += amount;
    this.save();
  }

  nextGearId(): string {
    const id = `g${this.data.gearSeq}`;
    this.data.gearSeq += 1;
    this.save();
    return id;
  }

  equippedArmor(): ArmorItem[] {
    const out: ArmorItem[] = [];
    if (this.data.chestId) {
      const chest = this.itemById(this.data.chestId);
      if (chest?.kind === 'armor' && chest.slot === 'chest') out.push(chest);
    }
    if (this.data.bootsId) {
      const boots = this.itemById(this.data.bootsId);
      if (boots?.kind === 'armor' && boots.slot === 'boots') out.push(boots);
    }
    return out;
  }

  /** @deprecated Use equippedArmor() — kept for transitional call sites. */
  equippedItems(): ArmorItem[] {
    return this.equippedArmor();
  }

  itemById(id: string): KitItem | undefined {
    return this.data.inventory.find((g) => g.id === id);
  }

  heroKit(hero: HeroId): HeroKit {
    return this.data.kits[hero] ?? defaultHeroKit(hero);
  }

  setFamily(hero: HeroId, family: WeaponFamilyId): boolean {
    if (!isWeaponFamilyId(family) || familyHero(family) !== hero) return false;
    const kit = this.heroKit(hero);
    const stance = familyStance(family);
    const cards: [string | null, string | null] = [...kit.cards];
    for (let i = 0; i < 2; i++) {
      const id = cards[i];
      if (!id) continue;
      const card = cardById(id);
      if (card && card.stance !== stance) cards[i] = null;
    }
    this.data.kits[hero] = { ...kit, family, weaponId: null, cards };
    this.save();
    return true;
  }

  equipWeapon(hero: HeroId, id: string | null): boolean {
    const kit = this.heroKit(hero);
    if (id === null) {
      this.data.kits[hero] = { ...kit, weaponId: null };
      this.save();
      return true;
    }
    const item = this.itemById(id);
    if (!item || item.kind !== 'weapon') return false;
    if (!isWeaponFamilyId(item.family) || familyHero(item.family) !== hero) return false;
    if (item.family !== kit.family) return false;
    this.data.kits[hero] = { ...kit, weaponId: id };
    this.save();
    return true;
  }

  equipCard(hero: HeroId, slot: 0 | 1, id: string | null): boolean {
    const kit = this.heroKit(hero);
    if (id === null) {
      const cards = [...kit.cards] as [string | null, string | null];
      cards[slot] = null;
      this.data.kits[hero] = { ...kit, cards };
      this.save();
      return true;
    }
    const card = cardById(id);
    if (!card || card.hero !== hero) return false;
    if (card.stance !== familyStance(kit.family)) return false;
    if (!cardUnlocked(card, this.data.heroJobs[hero] ?? 0)) return false;
    const cards = [...kit.cards] as [string | null, string | null];
    cards[slot] = id;
    this.data.kits[hero] = { ...kit, cards };
    this.save();
    return true;
  }

  equipArmor(id: string): boolean {
    const item = this.itemById(id);
    if (!item || item.kind !== 'armor') return false;
    if (item.slot === 'chest') this.data.chestId = item.id;
    else this.data.bootsId = item.id;
    this.save();
    return true;
  }

  unequipArmor(slot: ArmorSlot): void {
    if (slot === 'chest') this.data.chestId = null;
    else this.data.bootsId = null;
    this.save();
  }

  recordHeroJob(hero: HeroId): void {
    this.data.heroJobs[hero] = (this.data.heroJobs[hero] ?? 0) + 1;
    this.save();
  }

  addGear(item: KitItem): { kept: boolean; salvagedXp: number } {
    if (this.data.inventory.length < INVENTORY_CAP) {
      this.data.inventory.push(item);
      this.save();
      return { kept: true, salvagedXp: 0 };
    }
    const occupied = this.occupiedIds();
    const junk = this.data.inventory
      .filter((g) => !occupied.has(g.id))
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

  /** @deprecated Use equipArmor() — kept for transitional call sites. */
  equip(id: string): boolean {
    return this.equipArmor(id);
  }

  /** @deprecated Use unequipArmor() — kept for transitional call sites. */
  unequip(_slot: GearSlot): void {
    if (_slot === 'boots') this.unequipArmor('boots');
    else this.unequipArmor('chest');
  }

  salvage(id: string): number {
    const item = this.itemById(id);
    if (!item) return 0;
    if (this.data.chestId === id) this.data.chestId = null;
    if (this.data.bootsId === id) this.data.bootsId = null;
    for (const hero of HERO_ORDER) {
      const kit = this.data.kits[hero];
      if (kit?.weaponId === id) this.data.kits[hero] = { ...kit, weaponId: null };
    }
    const idx = this.data.inventory.findIndex((g) => g.id === id);
    if (idx >= 0) this.data.inventory.splice(idx, 1);
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
    if (changed) this.data.seen = [...set];
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

  needsTutorial(): boolean {
    return !this.data.tutorialDone && this.totalStars() === 0 && this.data.jeffXp === 0 &&
      !Object.values(this.data.heroJobs).some(jobs => (jobs ?? 0) > 0);
  }

  setHero(id: HeroId): void {
    if (!isHeroId(id)) return;
    this.data.selectedHero = id;
    this.save();
  }

  buyTower(id: TowerId): boolean {
    if (!TOWER_ORDER.includes(id) || this.data.ownedTowers.includes(id) || this.data.servicePoints < TOWER_PRICES[id]) return false;
    this.data.servicePoints -= TOWER_PRICES[id];
    this.data.ownedTowers.push(id);
    this.save();
    return true;
  }

  addServicePoints(points: number): void {
    if (!Number.isFinite(points) || points <= 0) return;
    this.data.servicePoints = Math.min(1_000_000, this.data.servicePoints + Math.floor(points));
    this.save();
  }

  saveCrew(slot: number, towers: readonly TowerId[]): void {
    if (!Number.isInteger(slot) || slot < 0 || slot >= 3) return;
    const legal = [...new Set(towers.filter(id => TOWER_ORDER.includes(id)))].slice(0, 5);
    if (!legal.length) return;
    this.data.crews[slot] = { hero: this.data.selectedHero, towers: legal };
    this.save();
  }

  recordCommendations(map: string, difficulty: DifficultyId, remaster: RemasterId, earned: readonly CommendationId[]): void {
    if (!MAPS.some(m => m.id === map && !m.endless) || !DIFFICULTIES.includes(difficulty) || (remaster !== 'classic' && !REMASTERS.includes(remaster))) return;
    const key = commendationKey(map, difficulty, remaster);
    const existing = this.data.commendations[key] ?? [];
    this.data.commendations[key] = COMMENDATIONS.filter(goal => existing.includes(goal.id) || earned.includes(goal.id)).map(goal => goal.id);
    this.save();
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
