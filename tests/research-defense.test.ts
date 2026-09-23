import { describe, expect, it } from 'vitest';
import { Game } from '../src/sim/game';
import { CRAWLSPACE } from '../src/data/maps/crawlspace';
import { DIFFICULTIES } from '../src/data/difficulty';
import { neutralModifiers } from '../src/data/modifiers';
import { routeCoverage } from '../src/sim/coverage';
import { earnedCommendations, commendationKey } from '../src/data/commendations';
import { normalizeSave, SaveStore } from '../src/save/save';
import { resolveLoadout } from '../src/data/loadout';

function game() {
  return new Game({ ...CRAWLSPACE, startMoney: 10000,
    paths: [[{ x: 0, y: 250 }, { x: 960, y: 250 }]],
    slots: Array.from({ length: 6 }, (_, i) => ({ x: 200 + i * 90, y: 220 })),
    allowedTowers: ['torch', 'washer', 'pipeSnake'],
  }, { difficulty: DIFFICULTIES.journeyman, mods: neutralModifiers(), manualStart: true });
}

describe('Honest scouting and route coverage', () => {
  it('forecasts three distinct waves without advancing the simulation', () => {
    const g = game(); const before = [g.waveIdx, g.time, g.money, g.enemies.length];
    expect(g.nextWavePreview(2).reduce((sum, group) => sum + group.count, 0)).toBe(CRAWLSPACE.waves[2]!.groups.reduce((sum, group) => sum + group.count, 0));
    expect(g.nextWavePreview(100)).toEqual([]);
    expect([g.waveIdx, g.time, g.money, g.enemies.length]).toEqual(before);
    expect(g.waveEntryDuration()).toBeGreaterThan(0);
  });
  it('keeps delayed spawns and split children on their original wave health scale', () => {
    const g = game(); g.waveIdx = 10;
    const child = g.spawnEnemy('drip', 0, 0, ['pressurized', 'cast'], 2);
    expect(child.maxHp).toBe(g.previewHealth('drip', 1, ['pressurized', 'cast']));
    expect(child.shellHp).toBe(Math.round(child.maxHp * .85));
    expect(g.spawnEnemy('drip', 0, 0, [], 10).maxHp).toBe(g.previewHealth('drip', 9, []));
  });
  it('distinguishes air from ground coverage and counts overlapping reach only once', () => {
    const g = game(); expect(routeCoverage(g, 0)).toEqual({ ground: 0, air: 0 });
    g.placeTower(0, 'washer'); const first = routeCoverage(g, 0);
    expect(first.ground).toBeGreaterThan(0); expect(first.air).toBe(0);
    g.placeTower(1, 'washer'); g.towers[1]!.pos = { ...g.towers[0]!.pos };
    expect(routeCoverage(g, 0)).toEqual(first);
    g.placeTower(2, 'torch'); expect(routeCoverage(g, 0).air).toBeGreaterThan(0);
    expect(routeCoverage(g, 99)).toEqual({ ground: 0, air: 0 });
  });
  it('uses the snake route segment rather than an imaginary radial attack', () => {
    const g = game(); g.placeTower(0, 'pipeSnake');
    const coverage = routeCoverage(g, 0);
    expect(coverage.ground).toBe(coverage.air);
    const segment = (g.towers[0]!.def.levels[0]!.pierce ?? 160) + 12;
    expect(coverage.ground).toBeCloseTo(Math.round(segment / 960 * 100), 0);
  });
});

describe('Crew slots and optional commendations', () => {
  it('migrates old saves and bounds malformed crew data', () => {
    expect(normalizeSave({ version: 1 } as never).crews).toEqual([null, null, null]);
    const dirty = JSON.parse('{"crews":[{"hero":"retired","towers":["torch","torch","cbj","washer"]},null,{"hero":"doni","towers":[]},{"hero":"cbj","towers":["torch"]}],"commendations":{"unknown":["clean"]}}');
    const save = normalizeSave(dirty);
    expect(save.crews).toEqual([{ hero: 'jeff', towers: ['torch', 'washer'] }, null, null]);
    expect(save.commendations).toEqual({});
  });
  it('saves independent hero/tool snapshots and revalidates a crew for another job', () => {
    const save = new SaveStore(null); save.setHero('doni');
    const kit = ['torch', 'washer'] as const; save.saveCrew(1, kit); save.setHero('jayjay');
    expect(save.data.crews[1]).toEqual({ hero: 'doni', towers: ['torch', 'washer'] });
    expect(resolveLoadout(save.data.crews[1]!.towers, ['washer', 'pipeSnake'])).toEqual(['washer', 'pipeSnake']);
    save.saveCrew(3, kit); expect(save.data.crews).toHaveLength(3);
    expect(normalizeSave(JSON.parse(JSON.stringify(save.data))).crews).toEqual(save.data.crews);
  });
  it('awards only wins and remembers peak construction after selling', () => {
    const g = game(); expect(earnedCommendations(g)).toEqual([]);
    for (let i = 0; i < 5; i++) g.placeTower(i, 'torch');
    g.sellTower(g.towers[0]!.id); g.status = 'won';
    expect(g.peakTowerCount).toBe(5); expect(earnedCommendations(g)).toEqual(['clean']);
  });
  it('requires every packed type to have actually been built and stores awards per context', () => {
    const g = game(); g.placeTower(0, 'torch'); g.placeTower(1, 'washer'); g.placeTower(2, 'pipeSnake');
    g.sellTower(g.towers[0]!.id); g.stats.escaped = 1; g.status = 'won';
    expect(earnedCommendations(g)).toEqual(['compact', 'toolbox']);
    const save = new SaveStore(null);
    save.recordCommendations(g.map.id, 'journeyman', 'classic', earnedCommendations(g));
    save.recordCommendations(g.map.id, 'journeyman', 'classic', earnedCommendations(g));
    expect(save.data.commendations[commendationKey(g.map.id, 'journeyman', 'classic')]).toEqual(['compact', 'toolbox']);
    expect(save.data.commendations[commendationKey(g.map.id, 'master', 'classic')]).toBeUndefined();
    expect(normalizeSave(JSON.parse(JSON.stringify(save.data))).commendations).toEqual(save.data.commendations);
  });
});
