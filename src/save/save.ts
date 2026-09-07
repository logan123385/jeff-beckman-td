import { MAPS } from '../data/maps';
import { SKILLS } from '../data/skills';
import type { DifficultyId, EnemyId } from '../data/types';

export interface SaveData {
  version: 1;
  /** mapId -> difficulty -> best stars (0–3). */
  stars: Record<string, Partial<Record<DifficultyId, number>>>;
  skills: string[];
  seen: EnemyId[];
  difficulty: DifficultyId;
}

const KEY = 'jbtd-save-v1';

function blank(): SaveData {
  return { version: 1, stars: {}, skills: [], seen: [], difficulty: 'journeyman' };
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
      const parsed = JSON.parse(raw) as Partial<SaveData>;
      if (parsed.version !== 1) return blank();
      return { ...blank(), ...parsed, version: 1 };
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

  recordClear(mapId: string, difficulty: DifficultyId, stars: number): void {
    const entry = this.data.stars[mapId] ?? {};
    entry[difficulty] = Math.max(entry[difficulty] ?? 0, stars);
    this.data.stars[mapId] = entry;
    this.save();
  }

  isUnlocked(mapIndex: number): boolean {
    if (mapIndex === 0) return true;
    const prev = MAPS[mapIndex - 1];
    return prev !== undefined && this.starsFor(prev.id) > 0;
  }

  totalStars(): number {
    return MAPS.reduce((sum, m) => sum + this.starsFor(m.id), 0);
  }

  spentStars(): number {
    return this.data.skills.filter((id) => SKILLS.some((s) => s.id === id)).length;
  }

  availableStars(): number {
    return this.totalStars() - this.spentStars();
  }

  unlockSkill(id: string): boolean {
    if (this.data.skills.includes(id) || this.availableStars() <= 0) return false;
    this.data.skills.push(id);
    this.save();
    return true;
  }

  respec(): void {
    this.data.skills = [];
    this.save();
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
}

/** Stars for a clear: 3 for a clean sheet, 2 for keeping most lives, 1 for surviving. */
export function starsForClear(livesLeft: number, livesStart: number): number {
  if (livesLeft >= livesStart) return 3;
  if (livesLeft >= livesStart * 0.5) return 2;
  return 1;
}
