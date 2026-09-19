import { isHeroId, type HeroId } from '../data/heroes';
import { CORE_MAPS, MAPS } from '../data/maps';
import { gearScore } from '../data/loot';
import { canUnlock, SKILLS, skillCost } from '../data/skills';
import { canUnlockTalent } from '../data/talents';
import { salvageXp, levelFromXp, talentPointsAvailable } from '../data/xp';
import type { DifficultyId, EnemyId, GearItem, GearSlot, RemasterId, TowerId } from '../data/types';

export const INVENTORY_CAP = 24;

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

const KEY = 'jbtd-save-v1';

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

export class SaveStore {
  data: SaveData;

  constructor(private readonly storage: Storage | null = typeof localStorage === 'undefined' ? null : localStorage) {
    this.data = this.load();
  }

  private load(): SaveData {
    try {
      const raw = this.storage?.getItem(KEY);
      if (!raw) return blank();
      const parsed = JSON.parse(raw) as Partial<SaveData> & { nightShiftBest?: number };
      if (parsed.version !== 1) return blank();
      return {
        ...blank(),
        ...parsed,
        version: 1,
        selectedHero: isHeroId(parsed.selectedHero) ? parsed.selectedHero : 'jeff',
        serviceCallBest: parsed.serviceCallBest ?? parsed.nightShiftBest ?? 0,
        talents: parsed.talents ?? [],
        inventory: parsed.inventory ?? [],
        equipped: parsed.equipped ?? {},
        jeffXp: parsed.jeffXp ?? 0,
        gearSeq: parsed.gearSeq ?? 1,
        lastLoadout: parsed.lastLoadout ?? [],
        sfxVolume: typeof parsed.sfxVolume === 'number' ? parsed.sfxVolume : 0.85,
        ambientVolume: typeof parsed.ambientVolume === 'number' ? parsed.ambientVolume : 0.55,
        tutorialDone: parsed.tutorialDone === true,
      };
    } catch {
      return blank();
    }
  }

  save(): void {
    try {
      this.storage?.setItem(KEY, JSON.stringify(this.data));
    } catch {
      // Storage unavailable (private mode, quota); the run still works in-memory.
    }
  }

  reset(): void {
    this.data = blank();
    this.save();
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
      return sum + (row.codeInspection ? 1 : 0) + (row.frozenMain ? 1 : 0);
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
