import { expect, test } from 'vitest';
import { DIFFICULTIES } from '../src/data/difficulty';
import { CRAWLSPACE } from '../src/data/maps/crawlspace';
import { bankTerminalRun, clockOutHint, pauseBlocksSettle, shouldBankOnLeave } from '../src/data/progress';
import { persistWarning } from '../src/ui/persist';
import { SAVE_BAK_KEY, SAVE_KEY, SaveStore, normalizeSave, type SaveData } from '../src/save/save';
import { Game } from '../src/sim/game';
import { neutralModifiers } from '../src/data/modifiers';

class MemoryStorage implements Storage {
  private readonly data = new Map<string, string>();
  get length(): number {
    return this.data.size;
  }
  clear(): void {
    this.data.clear();
  }
  getItem(key: string): string | null {
    return this.data.has(key) ? this.data.get(key)! : null;
  }
  key(index: number): string | null {
    return [...this.data.keys()][index] ?? null;
  }
  removeItem(key: string): void {
    this.data.delete(key);
  }
  setItem(key: string, value: string): void {
    this.data.set(key, String(value));
  }
}

class QuotaStorage extends MemoryStorage {
  override setItem(): void {
    throw new Error('quota');
  }
}

test('missing version still loads a schema-shaped save', () => {
  const storage = new MemoryStorage();
  storage.setItem(SAVE_KEY, JSON.stringify({ jeffXp: 500, selectedHero: 'jeff', stars: { crawlspace: { apprentice: 3 } } }));
  const save = new SaveStore(storage);
  expect(save.data.version).toBe(2);
  expect(save.data.jeffXp).toBe(500);
  expect(save.starsOn('crawlspace', 'apprentice')).toBe(3);
  expect(save.recoveredFromBackup).toBe(false);
});

test('unknown version keeps a v1-shaped blob instead of wiping', () => {
  const storage = new MemoryStorage();
  storage.setItem(SAVE_KEY, JSON.stringify({ version: 99, jeffXp: 40, selectedHero: 'mike' }));
  const save = new SaveStore(storage);
  expect(save.data.version).toBe(2);
  expect(save.data.jeffXp).toBe(40);
  expect(save.data.selectedHero).toBe('mike');
});

test('string version "1" and string XP coerce without concatenating', () => {
  const storage = new MemoryStorage();
  storage.setItem(
    SAVE_KEY,
    JSON.stringify({ version: '1', difficulty: 'godmode', skills: { a: 1 }, jeffXp: '5000', inventory: [{ id: 'x' }] }),
  );
  const save = new SaveStore(storage);
  expect(save.data.difficulty).toBe('journeyman');
  expect(save.data.jeffXp).toBe(5000);
  expect(save.data.inventory.length).toBe(0);
  save.addXp(36);
  expect(save.data.jeffXp).toBe(5036);
});

test('corrupt JSON does not overwrite disk with a blank save', () => {
  const storage = new MemoryStorage();
  storage.setItem(SAVE_KEY, '{not-json');
  const save = new SaveStore(storage);
  expect(save.data.jeffXp).toBe(0);
  expect(storage.getItem(SAVE_KEY)).toBe('{not-json');
});

test('corrupt primary recovers from bak and restores the key', () => {
  const storage = new MemoryStorage();
  storage.setItem(SAVE_BAK_KEY, JSON.stringify({ version: 1, jeffXp: 1200, selectedHero: 'jeff' }));
  storage.setItem(SAVE_KEY, '!!!');
  const save = new SaveStore(storage);
  expect(save.recoveredFromBackup).toBe(true);
  expect(save.data.jeffXp).toBe(1200);
  expect(storage.getItem(SAVE_KEY)).toContain('1200');
  expect(persistWarning(save)).toMatch(/backup/);
});

class FailKeyStorage extends MemoryStorage {
  constructor(private readonly blocked: string) {
    super();
  }
  override setItem(key: string, value: string): void {
    if (key === this.blocked) throw new Error('quota');
    super.setItem(key, value);
  }
}

test('reset writes bak first and save() reports quota failure', () => {
  const storage = new MemoryStorage();
  const save = new SaveStore(storage);
  save.data.jeffXp = 88;
  expect(save.save()).toBe(true);
  expect(save.reset()).toBe(true);
  expect(storage.getItem(SAVE_BAK_KEY)).toBeTruthy();
  expect(JSON.parse(storage.getItem(SAVE_BAK_KEY)!).jeffXp).toBe(88);
  expect(save.data.jeffXp).toBe(0);

  const quota = new QuotaStorage();
  const doomed = new SaveStore(quota);
  doomed.data.jeffXp = 99;
  expect(doomed.save()).toBe(false);
  expect(doomed.lastWriteOk).toBe(false);
  expect(persistWarning(doomed)).toMatch(/Couldn't save/);
});

test('reset keeps progress when the backup write fails', () => {
  const storage = new FailKeyStorage(SAVE_BAK_KEY);
  storage.setItem(SAVE_KEY, JSON.stringify({ version: 1, jeffXp: 640, selectedHero: 'jeff' }));
  const save = new SaveStore(storage);
  expect(save.data.jeffXp).toBe(640);
  expect(save.reset()).toBe(false);
  expect(save.data.jeffXp).toBe(640);
  expect(save.lastWriteOk).toBe(false);
  expect(JSON.parse(storage.getItem(SAVE_KEY)!).jeffXp).toBe(640);
  expect(storage.getItem(SAVE_BAK_KEY)).toBeNull();
  expect(persistWarning(save)).toMatch(/Couldn't save/);
});

test('normalizeSave never throws on garbage fields', () => {
  const data = normalizeSave({
    version: 1,
    difficulty: 'godmode',
    skills: { nope: true },
    talents: 'x',
    jeffXp: Number.NaN,
    seen: ['drip', 'not-an-enemy', 12],
    lastLoadout: ['torch', 'laser-shark'],
    equipped: { wrench: 'missing' },
    inventory: [{ id: 'ok', slot: 'wrench', rarity: 'common', affixes: [{ key: 'jeffDamage', amount: 2 }] }],
  } as unknown as Partial<SaveData> & Record<string, unknown>);
  expect(data.difficulty).toBe('journeyman');
  expect(data.jeffXp).toBe(8);
  expect(data.seen).toEqual(['drip']);
  expect(data.lastLoadout).toEqual(['torch']);
  expect(data.inventory.length).toBe(0);
  expect(data.chestId).toBeNull();
  expect(data.bootsId).toBeNull();
});

test('gearSeq advances past existing gN inventory ids (SR-003)', () => {
  const data = normalizeSave({
    version: 2,
    gearSeq: 1,
    inventory: [{
      kind: 'armor',
      id: 'g7',
      name: 'Old vest',
      slot: 'chest',
      rarity: 'common',
      affixes: [{ key: 'jeffDamage', amount: 0.05 }],
    }],
  } as unknown as Partial<SaveData> & Record<string, unknown>);
  expect(data.gearSeq).toBe(8);
});

test('salvage removes one matching inventory row (SR-003)', () => {
  const save = new SaveStore(null);
  const row = {
    kind: 'armor' as const,
    id: 'g1',
    name: 'Dup vest',
    slot: 'chest' as const,
    rarity: 'common' as const,
    affixes: [{ key: 'jeffDamage' as const, amount: 0.05 }],
  };
  save.data.inventory.push({ ...row }, { ...row });
  save.salvage('g1');
  expect(save.data.inventory.filter((item) => item.id === 'g1')).toHaveLength(1);
});

test('markSeen is not progress and does not write (SR-005)', () => {
  const storage = new MemoryStorage();
  const save = new SaveStore(storage);
  save.markSeen(['drip']);
  expect(save.hasSeen('drip')).toBe(true);
  expect(save.hasAnyProgress()).toBe(false);
  expect(storage.getItem(SAVE_KEY)).toBeNull();
});

test('stale tab cannot wipe a newer finished run (SR-002)', () => {
  const storage = new MemoryStorage();
  const fresh = new SaveStore(storage);
  const stale = new SaveStore(storage);
  fresh.recordClear('crawlspace', 'journeyman', 3);
  fresh.addXp(200);
  expect(fresh.data.jeffXp).toBe(200);
  stale.setMuted(true);
  expect(stale.staleWriteSkipped).toBe(true);
  expect(persistWarning(stale)).toMatch(/Another tab/);
  const disk = JSON.parse(storage.getItem(SAVE_KEY)!) as { jeffXp: number; stars: { crawlspace: { journeyman: number } }; muted: boolean };
  expect(disk.stars.crawlspace.journeyman).toBe(3);
  expect(disk.jeffXp).toBe(200);
  expect(disk.muted).toBe(false);
});

test('quit after a terminal win still banks stars and the first chest (SR-001 / SR-004)', () => {
  const storage = new MemoryStorage();
  const save = new SaveStore(storage);
  const game = new Game(CRAWLSPACE, { difficulty: DIFFICULTIES.apprentice, mods: neutralModifiers(), manualStart: true });
  game.status = 'won';
  game.lives = Math.max(1, Math.round(CRAWLSPACE.lives * DIFFICULTIES.apprentice.livesMult));
  expect(shouldBankOnLeave(game.status, false)).toBe(true);
  expect(pauseBlocksSettle(game.status)).toBe(false);
  expect(clockOutHint(false)).not.toMatch(/saved/i);
  expect(clockOutHint(true)).toMatch(/Record saved/);
  let writes = 0;
  const setItem = storage.setItem.bind(storage);
  storage.setItem = (key: string, value: string) => {
    if (key === SAVE_KEY) writes += 1;
    setItem(key, value);
  };
  const first = bankTerminalRun(save, game);
  expect(first.earned).toBe(3);
  expect(first.firstClear).toBe(true);
  expect(first.reward.chests.length).toBeGreaterThan(0);
  expect(save.starsFor('crawlspace')).toBe(3);
  expect(save.data.jeffXp).toBeGreaterThan(0);
  expect(save.data.heroJobs.jeff).toBe(1);
  expect(writes).toBe(1);
  const replay = bankTerminalRun(save, game);
  expect(replay.reward.xp).toBe(0);
  expect(save.data.heroJobs.jeff).toBe(1);
});
