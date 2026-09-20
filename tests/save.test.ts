import { expect, test } from 'vitest';
import { persistWarning } from '../src/ui/persist';
import { SAVE_BAK_KEY, SAVE_KEY, SaveStore, normalizeSave, type SaveData } from '../src/save/save';

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
  expect(save.data.version).toBe(1);
  expect(save.data.jeffXp).toBe(500);
  expect(save.starsOn('crawlspace', 'apprentice')).toBe(3);
  expect(save.recoveredFromBackup).toBe(false);
});

test('unknown version keeps a v1-shaped blob instead of wiping', () => {
  const storage = new MemoryStorage();
  storage.setItem(SAVE_KEY, JSON.stringify({ version: 2, jeffXp: 40, selectedHero: 'mike' }));
  const save = new SaveStore(storage);
  expect(save.data.version).toBe(1);
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
  expect(save.data.skills).toEqual([]);
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
  expect(data.skills).toEqual([]);
  expect(data.talents).toEqual([]);
  expect(data.jeffXp).toBe(0);
  expect(data.seen).toEqual(['drip']);
  expect(data.lastLoadout).toEqual(['torch']);
  expect(data.inventory.length).toBe(1);
  expect(data.equipped.wrench).toBeUndefined();
});
