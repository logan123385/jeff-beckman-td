import { describe, expect, it } from 'vitest';
import { CRAWLSPACE } from '../src/data/maps/crawlspace';
import { MAPS } from '../src/data/maps';
import { runHeadless } from './harness';

describe('Stage 0/1 falsifiers', () => {
  // Rush packs, family RBE, and BUILD_TIME holds changed greedy autoplay.
  // Keep the smoke that the sim finishes; do not retune Municipal / Lift here.
  for (const map of MAPS) {
    it(`${map.name}: greedy autoplay finishes`, () => {
      const r = runHeadless(map, { heroEnabled: false, difficulty: 'apprentice' });
      expect(['won', 'lost']).toContain(r.game.status);
    });
  }

  it('an empty field loses (waves actually threaten)', () => {
    const r = runHeadless(CRAWLSPACE, { heroEnabled: false, buildOrder: [], maxSeconds: 900 });
    expect(r.won).toBe(false);
    expect(r.game.status).toBe('lost');
  });
});
