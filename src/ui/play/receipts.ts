import type { WaveReport } from '../../sim/state';

/** Completion-count cursor survives out-of-order waves and the bounded endless log. */
export class WaveReceiptFeed {
  private observed = 0;
  private lastTime = 0;
  private active: { report: WaveReport; until: number }[] = [];

  update(reports: readonly WaveReport[], completed: number, time: number, covered: boolean): WaveReport[] {
    if (covered) for (const item of this.active) item.until += Math.max(0, time - this.lastTime);
    this.lastTime = time;
    this.active = this.active.filter(item => time < item.until);
    const unseen = Math.max(0, completed - this.observed);
    if (unseen) this.active.push(...reports.slice(-unseen).map(report => ({ report, until: time + 4 })));
    this.observed = completed;
    return covered ? [] : this.active.map(item => item.report);
  }
}
