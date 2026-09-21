/** Deterministic gameplay pacing probes, not a rendering benchmark or human difficulty rating. */
import { writeFileSync } from 'node:fs';
import { DIFFICULTIES } from '../src/data/difficulty';
import { MAPS } from '../src/data/maps';
import { CRAWLSPACE } from '../src/data/maps/crawlspace';
import { neutralModifiers } from '../src/data/skills';
import type { TowerId } from '../src/data/types';
import { Game } from '../src/sim/game';
import { applyDamage } from '../src/sim/combat';
import { runHeadless } from '../tests/harness';

const g = new Game(CRAWLSPACE, { difficulty: DIFFICULTIES.journeyman, mods: neutralModifiers(), heroEnabled: false, manualStart: true });
let skipped = 0;
for (let tick = 0; tick < 600; tick++) {
  if (tick % 6 === 0) applyDamage(g, g.spawnEnemy('drip', 0, 200), 10000, 'heat', 'torch');
  const before = g.time; g.update(1 / 60); if (g.time === before) skipped++;
}
const impact = { inputSeconds: 10, simulationSeconds: +g.time.toFixed(3), frozenUpdates: skipped, kills: g.stats.kills };
const kits: Record<string, TowerId[]> = {
  crawlspace: ['barricade','washer','torch'], boilerRoom: ['barricade','washer','torch','descaler','expansion'],
  radiantFloor: ['barricade','washer','torch','radiant','pipeSnake'], municipalMain: ['barricade','washer','torch','vent','radiant'],
  snowmelt: ['barricade','washer','torch','radiant','glycol'], attic: ['barricade','washer','torch','vent','camera'],
  liftStation: ['barricade','washer','torch','hammerDrill','descaler'], mechanicalRoom: ['barricade','washer','torch','radiant','descaler'],
  heatPlant: ['barricade','washer','torch','vent','heatExchanger'],
};
const campaign = [];
for (const map of MAPS) {
  for (const difficulty of ['apprentice','journeyman','master'] as const) {
    const r = runHeadless(map, { difficulty, heroId:'jeff', heroEnabled:true, microJeff:true, loadout:kits[map.id], seed:7 });
    campaign.push({ map:map.id,difficulty,status:r.game.status,lives:r.livesLeft,seconds:Math.round(r.seconds),waves:r.game.waveIdx,kills:r.game.stats.kills,towers:r.towersBuilt });
  }
}
const report = { method:'Greedy builder, legal capped kits, seed 7, no gear/perks/injected money. Measures regressions and pacing, not human balance.', impact, campaign };
writeFileSync(process.argv[2] ?? '/tmp/jeff-gameplay-audit.json', JSON.stringify(report,null,2));
console.log(JSON.stringify({impact,runs:campaign.length,wins:campaign.filter(r=>r.status==='won').length,unfinished:campaign.filter(r=>r.status==='playing').length}));
