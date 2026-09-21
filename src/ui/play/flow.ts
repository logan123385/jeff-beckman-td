import type { Game } from '../../sim/game';
import { h } from '../dom';
import { WaveReceiptFeed } from './receipts';

/** Readable battle rhythm and warnings, outside the player's targeting surface. */
export class BattleFlow {
  readonly el = h('div', { class: 'battle-flow' });
  private readonly phase = h('b', { class: 'flow-phase' });
  private readonly detail = h('span', { class: 'flow-detail' });
  private readonly reward = h('div', { class: 'flow-reward hidden', attrs: { role: 'status' } });
  private readonly warning = h('div', { class: 'flow-warning hidden', attrs: { role: 'status' } });
  private readonly track = h('div', { class: 'wave-track', attrs: { 'aria-label': 'Campaign wave progress' } });
  private readonly pips: HTMLElement[] = [];
  private receipts = new WaveReceiptFeed();
  private warningKey = '';
  private lastUpdate = -1;
  private lastWave = -1;
  private lastCompleted = -1;

  constructor(private readonly game: Game) {
    if (!game.endless) {
      for (let i = 0; i < game.map.waves.length; i++) {
        const pip = h('span', { class: 'wave-step', title: `Wave ${i + 1}` });
        this.pips.push(pip); this.track.append(pip);
      }
    }
    this.el.append(h('div', { class: 'flow-state' }, this.phase, this.detail, this.track), this.reward, this.warning);
  }

  update(): void {
    const g = this.game;
    if (this.lastWave === g.waveIdx && this.lastCompleted === g.completedWaves && g.time - this.lastUpdate < .12) return;
    this.lastWave = g.waveIdx; this.lastCompleted = g.completedWaves; this.lastUpdate = g.time;
    const alive = g.enemies.filter(e => !e.dead && !e.escaped);
    const queued = g.spawns.reduce((n, s) => n + s.remaining, 0);
    const phase = g.waveIdx === 0 ? 'BUILD YOUR DEFENSE'
      : g.allWavesStarted ? 'FINAL STAND' : !g.waveActive ? 'BREATHER' : queued > 0 ? 'WAVE INBOUND' : 'HOLD THE LINE';
    this.set(this.phase, phase);
    this.set(this.detail, g.waveIdx === 0 ? 'Deploy your hero · call when ready'
      : g.waveActive ? `${alive.length} on the yard${queued ? ` · ${queued} incoming` : g.canCallWave && !g.allWavesStarted ? ' · next call ready' : ''}`
        : g.allWavesStarted ? 'Job complete' : `${Math.ceil(g.waveCountdown)}s to regroup · call now +$${g.callBonus}`);
    this.pips.forEach((pip, i) => {
      const report = g.waveReports.find(r => r.wave === i + 1);
      const cls = report ? report.clean ? 'wave-step clean' : 'wave-step cleared' : i < g.waveIdx ? 'wave-step active' : 'wave-step';
      if (pip.className !== cls) pip.className = cls;
      const title = `Wave ${i + 1}${report ? report.clean ? ' · clean' : ` · ${report.leaks} escaped` : i < g.waveIdx ? ' · active' : ''}`;
      if (pip.title !== title) pip.title = title;
    });
    const early = g.lastEarlyCall && g.lastEarlyCall.recovery > 0 ? g.lastEarlyCall : null;
    const receipts = this.receipts.update(g.waveReports, g.completedWaves, g.time, !!early);
    if (early) {
      this.reward.classList.remove('hidden');
      this.set(this.reward, `EARLY CALL  +$${early.bonus}  ·  −${early.recovery.toFixed(1)}s SKILLS`);
    } else if (receipts.length) {
      this.reward.classList.remove('hidden');
      this.set(this.reward, receipts.map(report => `WAVE ${report.wave} ${report.clean ? 'CLEAN' : 'CLEARED'}  ·  ${report.kills} pops  ·  +$${report.bonus}`).join('\n'));
    } else this.reward.classList.add('hidden');

    const threat = alive.filter(e => !e.heldBy && e.stun <= 0)
      .map(e => ({ e, seconds: (g.paths[e.pathIdx]!.length - e.progress) / Math.max(1, e.def.speed * e.speedMult * (1 - e.slow) * (1 + e.haste)) }))
      .filter(t => t.seconds < 6).sort((a, b) => a.seconds - b.seconds)[0];
    const key = threat ? `${threat.e.id}:${Math.max(1, Math.ceil(threat.seconds))}` : '';
    if (key !== this.warningKey) {
      this.warningKey = key;
      this.warning.classList.toggle('hidden', !threat);
      if (threat) this.set(this.warning, `BREACH ${Math.max(1, Math.ceil(threat.seconds))}s · ROUTE ${threat.e.pathIdx + 1} · ${threat.e.def.name}`);
    }
  }

  private set(el: HTMLElement, value: string): void { if (el.textContent !== value) el.textContent = value; }
}
