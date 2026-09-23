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

test('a stale completed run adds rewards to the latest save without duplicating first-clear loot', () => {
  const storage = new MemoryStorage();
  const fresh = new SaveStore(storage), stale = new SaveStore(storage);
  const makeWin = () => {
    const game = new Game(CRAWLSPACE, { difficulty: DIFFICULTIES.apprentice, mods: neutralModifiers() });
    game.status = 'won';
    game.lives = 20;
    return game;
  };
  bankTerminalRun(fresh, makeWin());
  fresh.addServicePoints(2000);
  fresh.buyTower('descaler');
  const before = new SaveStore(storage).data;
  const second = makeWin();
  const outcome = bankTerminalRun(stale, second);
  const disk = new SaveStore(storage).data;
  expect(outcome.firstClear).toBe(false);
  expect(outcome.reward.chests).toEqual([]);
  expect(disk.jeffXp).toBe(before.jeffXp + outcome.reward.xp);
  expect(disk.servicePoints).toBe(before.servicePoints + outcome.reward.servicePoints);
  expect(disk.ownedTowers).toContain('descaler');
  expect(disk.heroJobs.jeff).toBe(2);
  expect(disk.inventory).toEqual(before.inventory);
  expect(second.rewardsClaimed).toBe(true);
});

test('failed reward write retains the complete receipt in memory for export', () => {
  const save = new SaveStore(new QuotaStorage());
  const game = new Game(CRAWLSPACE, { difficulty: DIFFICULTIES.apprentice, mods: neutralModifiers() });
  game.status = 'won';
  const outcome = bankTerminalRun(save, game);
  expect(save.lastWriteOk).toBe(false);
  const exported = JSON.parse(save.exportJson());
  expect(exported.jeffXp).toBe(outcome.reward.xp);
  expect(exported.inventory).toHaveLength(outcome.reward.items.length);
  expect(exported.stars.crawlspace.apprentice).toBeGreaterThan(0);
  expect(exported.rev).toBe(0);
});

test('transaction exceptions roll back mutations and do not leave saving suspended', () => {
  const storage = new MemoryStorage(), save = new SaveStore(storage);
  expect(() => save.transact(() => { save.addXp(100); throw new Error('stop'); })).toThrow('stop');
  expect(save.data.jeffXp).toBe(0);
  expect(storage.getItem(SAVE_KEY)).toBeNull();
  save.addXp(5);
  expect(new SaveStore(storage).data.jeffXp).toBe(5);
});

test('restore round-trips progress, keeps a backup, and advances the local revision', () => {
  const storage = new MemoryStorage(), save = new SaveStore(storage);
  save.addXp(10);
  const exported = new SaveStore(null);
  exported.addXp(100);
  exported.recordClear('crawlspace', 'master', 3);
  exported.setHero('doni');
  exported.buyTower('descaler');
  const rev = save.data.rev;
  expect(save.importJson(exported.exportJson()).ok).toBe(true);
  const disk = new SaveStore(storage);
  expect(disk.data.jeffXp).toBe(100);
  expect(disk.starsFor('crawlspace')).toBe(3);
  expect(disk.data.selectedHero).toBe('doni');
  expect(disk.data.rev).toBe(rev + 1);
  expect(JSON.parse(storage.getItem(SAVE_BAK_KEY)!).jeffXp).toBe(10);
});

test.each(['bad', 'null', '[]', '{}', '{"version":99,"jeffXp":20}', 'x'.repeat(1_000_001)])('restore rejects invalid or unsupported files without replacing progress (%#)', raw => {
  const storage = new MemoryStorage(), save = new SaveStore(storage);
  save.addXp(40);
  const before = save.exportJson();
  expect(save.importJson(raw).ok).toBe(false);
  expect(save.exportJson()).toBe(before);
  expect(new SaveStore(storage).data.jeffXp).toBe(40);
});

test.each([SAVE_KEY, SAVE_BAK_KEY])('restore preserves the current save when %s cannot be written', key => {
  const storage = new MemoryStorage();
  storage.setItem(SAVE_KEY, JSON.stringify({ version: 2, jeffXp: 40 }));
  const set = storage.setItem.bind(storage);
  storage.setItem = (k, v) => { if (k === key) throw new Error('quota'); set(k, v); };
  const save = new SaveStore(storage);
  expect(save.importJson('{"version":2,"jeffXp":100}').ok).toBe(false);
  expect(save.data.jeffXp).toBe(40);
  expect(new SaveStore(storage).data.jeffXp).toBe(40);
});

test('a first license purchase is exportable and does not skip the first-job coach', () => {
  const save = new SaveStore(null);
  expect(save.buyTower('vent')).toBe(true);
  expect(save.hasAnyProgress()).toBe(true);
  expect(save.needsTutorial()).toBe(true);
});

test('reset retains in-memory progress when the primary write fails after a backup', () => {
  const storage = new MemoryStorage();
  const save = new SaveStore(storage);
  save.addXp(80);
  const set = storage.setItem.bind(storage);
  storage.setItem = (k, v) => { if (k === SAVE_KEY) throw new Error('quota'); set(k, v); };
  expect(save.reset()).toBe(false);
  expect(save.data.jeffXp).toBe(80);
});

test('idle clock-out does not unlock hero cards without doing any work', async () => {
  const { SERVICE_CALL } = await import('../src/data/maps/serviceCall');
  const save = new SaveStore(null);
  const game = new Game(SERVICE_CALL, { difficulty: DIFFICULTIES.apprentice, mods: neutralModifiers(), manualStart: true });
  game.callNextWave();
  expect(game.retire()).toBe(true);
  const outcome = bankTerminalRun(save, game);
  expect(outcome.reward.xp).toBe(0);
  expect(outcome.reward.servicePoints).toBe(0);
  expect(save.data.heroJobs.jeff ?? 0).toBe(0);
});
