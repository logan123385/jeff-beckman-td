import { MAPS } from '../src/data/maps';
import { runHeadless } from '../tests/harness';

for (const map of MAPS) {
  for (const cfg of [
    { label: 'hero-off apprentice', heroEnabled: false, difficulty: 'apprentice' as const },
    { label: 'hero-off journeyman', heroEnabled: false, difficulty: 'journeyman' as const },
    { label: 'hero-off master', heroEnabled: false, difficulty: 'master' as const },
    { label: 'hero-on journeyman', heroEnabled: true, difficulty: 'journeyman' as const, microJeff: true },
    { label: 'hero-on master', heroEnabled: true, difficulty: 'master' as const, microJeff: true },
  ]) {
    const r = runHeadless(map, cfg);
    const td = r.game.stats.towerDamage;
    const top = Object.entries(td).sort((a, b) => b[1] - a[1]).slice(0, 3).map(([k, v]) => `${k}:${Math.round(v)}`).join(' ');
    console.log(
      `${map.name.padEnd(22)} ${cfg.label.padEnd(20)} won=${r.won ? 'Y' : 'N'} lives=${String(r.livesLeft).padStart(2)} waves=${r.game.waveIdx}/${r.game.totalWaves} t=${Math.round(r.seconds)}s towers=${r.towersBuilt} jeff=${(r.jeffShare * 100).toFixed(0)}% money=${r.game.money} ${top}`,
    );
  }
}
