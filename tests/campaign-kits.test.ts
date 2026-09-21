import { describe, expect, it } from 'vitest';
import { MAPS } from '../src/data/maps';
import type { TowerId } from '../src/data/types';
import { runHeadless } from './harness';

/** Actual five-tool player kits; no gear, no perks, no extra cash, no unlimited catalogue. */
const KITS: Record<string, TowerId[]> = {
  crawlspace: ['barricade', 'washer', 'torch', 'apprentices', 'jayjay'],
  boilerRoom: ['barricade', 'washer', 'torch', 'descaler', 'expansion'],
  radiantFloor: ['barricade', 'washer', 'torch', 'radiant', 'pipeSnake'],
  municipalMain: ['barricade', 'washer', 'torch', 'vent', 'radiant'],
  snowmelt: ['barricade', 'washer', 'torch', 'radiant', 'glycol'],
  attic: ['barricade', 'washer', 'torch', 'vent', 'camera'],
  liftStation: ['barricade', 'washer', 'torch', 'hammerDrill', 'descaler'],
  mechanicalRoom: ['barricade', 'washer', 'torch', 'radiant', 'descaler'],
  heatPlant: ['barricade', 'washer', 'torch', 'vent', 'heatExchanger'],
};

describe('Campaign with the player’s five-tool limit', () => {
  for (const map of MAPS) {
    it(`${map.name} finishes with a legal five-tool kit and coherent result`, () => {
      const kit = KITS[map.id]!;
      expect(kit.every(id => map.allowedTowers.includes(id))).toBe(true);
      const result = runHeadless(map, { difficulty: 'journeyman', heroEnabled: true, microJeff: true, loadout: kit });
      expect(result.game.allowedTowers).toHaveLength(5);
      // Current Cursor waves intentionally defeat this greedy builder on some jobs.
      // This is a compatibility/termination check, not a campaign-clearability claim.
      expect(['won', 'lost']).toContain(result.game.status);
      expect(result.game.stats.kills).toBeGreaterThan(0);
      expect(result.game.towers.length).toBeGreaterThan(0);
      expect(Number.isFinite(result.game.money)).toBe(true);
      expect(result.game.money).toBeGreaterThanOrEqual(0);
      if (result.won) expect(result.game.stats.escapedByType.rogueBoiler ?? 0).toBe(0);
      else expect(result.livesLeft).toBe(0);
      expect(result.game.towers.every(t => kit.includes(t.def.id))).toBe(true);
    });
  }
});
