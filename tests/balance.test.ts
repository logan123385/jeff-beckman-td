import { describe, expect, it } from 'vitest';
import { MAPS } from '../src/data/maps';
import { runHeadless } from './harness';

describe('Stage 0/1 falsifiers', () => {
  for (const map of MAPS) {
    it(`${map.name}: clearable on Apprentice with Jeff off (hero-off falsifier)`, () => {
      const r = runHeadless(map, { heroEnabled: false, difficulty: 'apprentice' });
      expect(r.won, `lives left ${r.livesLeft}, waves ${r.game.waveIdx}/${r.game.totalWaves}`).toBe(true);
    });

    it(`${map.name}: towers still matter with Jeff on (tower-matter test)`, () => {
      const r = runHeadless(map, { heroEnabled: true, difficulty: 'journeyman', microJeff: true });
      expect(r.won, `lives left ${r.livesLeft}, waves ${r.game.waveIdx}/${r.game.totalWaves}`).toBe(true);
      expect(r.jeffShare, `Jeff damage share ${(r.jeffShare * 100).toFixed(1)}%`).toBeLessThan(0.45);
    });
  }

  it('an empty field loses (waves actually threaten)', () => {
    const map = MAPS[0]!;
    const r = runHeadless(map, { heroEnabled: false, buildOrder: [], maxSeconds: 900 });
    expect(r.won).toBe(false);
    expect(r.game.status).toBe('lost');
  });
});
