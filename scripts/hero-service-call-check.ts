import { HERO_ORDER } from '../src/data/heroes';
import { SERVICE_CALL } from '../src/data/maps/serviceCall';
import { runHeadless } from '../tests/harness';
for (const heroId of HERO_ORDER) {
  const r = runHeadless(SERVICE_CALL, { heroId, difficulty: 'journeyman', heroEnabled: true, microJeff: true, callEarly: true, maxSeconds: 1800, buildOrder: ['jayjay', 'torch', 'vent', 'washer', 'expansion'] });
  console.log(JSON.stringify({ heroId, difficulty: 'journeyman', status: r.game.status, completed: r.game.completedWaves, called: r.game.waveIdx, seconds: Math.round(r.seconds), lives: r.livesLeft, heroDamage: Math.round(r.game.stats.jeffDamage), pendingMissiles: r.game.heroMissiles.length, zones: r.game.heroZones.length, summons: r.game.heroSummons.length }));
}
