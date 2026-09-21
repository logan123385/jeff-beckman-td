import { routeCoverage } from '../../sim/coverage';
import { ENEMIES } from '../../data/enemies';
import { PROPERTY_LABEL, PROPERTY_HINT } from '../../data/leakProperties';
import { previewRbe, splitPreview } from '../../data/splits';
import { enemyForMap } from '../../data/bosses';
import { enemyTraits } from '../../data/intel';
import { type Game } from '../../sim/game';
import { clear, h } from '../dom';
import { enemyPortrait } from '../portraits';

export class BattleIntel {
  readonly el = h('aside', { class: 'battle-intel hidden', attrs: { role: 'dialog', 'aria-modal': 'true', 'aria-label': 'Wave scouting' } });
  readonly entries = h('div', { class: 'route-entries' });
  readonly inspection = h('div', { class: 'enemy-inspection hidden' });
  isOpen = false;
  private route = 0;
  private forecast = 0;
  private wave = -1;
  private focusedBefore: HTMLElement | null = null;
  private inspectKey = '';

  constructor(private readonly game: Game, private readonly handlers: {
    onOpen(): void; onClose(): void; onCall(): void; canCall(): boolean; onRoute(route: number | null): void;
  }) {
    this.el.addEventListener('keydown', event => {
      if (event.key !== 'Tab') return;
      const buttons = [...this.el.querySelectorAll<HTMLButtonElement>('button:not(:disabled)')];
      const first = buttons[0], last = buttons.at(-1);
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
    });
  }

  open(route = 0): void {
    if (this.game.allWavesStarted || this.game.status !== 'playing') return;
    this.route = route;
    this.forecast = 0;
    if (!this.isOpen) {
      this.focusedBefore = document.activeElement instanceof HTMLElement ? document.activeElement : null;
      this.isOpen = true; this.handlers.onOpen();
    }
    this.render();
    this.el.querySelector<HTMLButtonElement>('.intel-close')?.focus({ preventScroll: true });
  }

  close(): void {
    if (!this.isOpen) return;
    this.isOpen = false; this.el.classList.add('hidden'); this.handlers.onRoute(null); this.handlers.onClose();
    this.focusedBefore?.focus({ preventScroll: true });
  }

  update(hoverEnemy: number | null): void {
    const game = this.game;
    if (game.waveIdx !== this.wave) {
      this.wave = game.waveIdx; this.forecast = 0; clear(this.entries);
      const previews = game.nextWavePreview();
      game.paths.forEach((path, i) => {
        const count = previews.filter(p => p.path === i).reduce((n, p) => n + p.count, 0);
        if (!count || game.allWavesStarted) return;
        const p = path.pointAt(65);
        const entry = h('button', { class: 'route-scout', attrs: { 'aria-label': `Scout route ${i + 1}, ${count} enemies` },
          style: { left: `${Math.max(4, Math.min(94, p.x / 9.6))}%`, top: `${Math.max(7, Math.min(91, p.y / 6))}%` },
          title: `Route ${i + 1} · click to scout the next wave`,
          onClick: () => this.open(i), onMouseEnter: () => this.handlers.onRoute(i), onMouseLeave: () => this.handlers.onRoute(this.isOpen ? this.route : null) },
          h('span', { text: '⚑' }), h('b', { text: String(count) }));
        entry.addEventListener('focus', () => this.handlers.onRoute(i));
        entry.addEventListener('blur', () => this.handlers.onRoute(this.isOpen ? this.route : null));
        this.entries.append(entry);
      });
      if (this.isOpen) this.render();
    }
    const enemy = game.enemies.find(e => e.id === hoverEnemy && !e.dead && !e.escaped);
    this.inspection.classList.toggle('hidden', !enemy || this.isOpen);
    if (!enemy || this.isOpen) return;
    const key = `${enemy.id}:${Math.ceil(enemy.hp)}:${Math.ceil(enemy.shellHp)}:${enemy.phased}:${enemy.armorShred}`;
    if (key === this.inspectKey) return;
    this.inspectKey = key; clear(this.inspection);
    this.inspection.append(enemyPortrait(enemy.def.id, 40), h('div', {}, h('b', { text: enemy.def.name }),
      h('span', { text: `${Math.ceil(enemy.hp)} / ${enemy.maxHp} HP${enemy.shellHp > 0 ? ` + ${Math.ceil(enemy.shellHp)} shell` : ''} · ${[...enemyTraits(enemy.def), ...enemy.properties.map(p => PROPERTY_LABEL[p])].join(' · ')}` }),
      h('small', { text: enemy.def.counters })));
  }

  private render(): void {
    const game = this.game, preview = game.nextWavePreview(this.forecast);
    const routes = [...new Set(preview.map(p => p.path))];
    if (!routes.includes(this.route)) this.route = routes[0] ?? 0;
    this.handlers.onRoute(this.route);
    clear(this.el); this.el.classList.remove('hidden');
    const total = preview.reduce((sum, p) => sum + p.count, 0);
    const bonus = game.callBonus;
    const coverage = routeCoverage(game, this.route);
    this.el.append(h('header', { class: 'intel-header' },
      h('div', {}, h('span', { class: 'eyebrow', text: 'Field intelligence · time paused' }), h('h2', { text: `Wave ${game.waveIdx + this.forecast + 1}` })),
      h('button', { class: 'btn intel-close', text: '×', attrs: { 'aria-label': 'Close scouting' }, onClick: () => this.close() })),
      h('nav', { class: 'intel-forecast btn-row', attrs: { 'aria-label': 'Wave forecast' } }, ...[0, 1, 2].filter(offset => game.nextWavePreview(offset).length).map(offset => h('button', { class: 'chip', text: `Wave ${game.waveIdx + offset + 1}`, attrs: { 'aria-pressed': String(this.forecast === offset) }, onClick: () => { this.forecast = offset; this.render(); this.el.querySelector<HTMLButtonElement>('.intel-forecast [aria-pressed="true"]')?.focus(); } }))),
      h('p', { class: 'small muted', text: `${total} enemies · ${previewRbe(preview)} lives if they escape${preview.some(p => ENEMIES[p.enemy].traits.includes('boss')) ? ' (boss breach ends the job)' : ''} · ${routes.length} incoming ${routes.length === 1 ? 'route' : 'routes'}. Follow the gold arrows to plan your defense.` }),
      h('nav', { class: 'intel-routes', attrs: { 'aria-label': 'Incoming routes' } }, ...routes.map(i => h('button', {
        class: `chip ${i === this.route ? 'on' : ''}`, text: `Route ${i + 1}`,
        attrs: { 'aria-pressed': String(i === this.route) }, onClick: () => { this.route = i; this.render(); this.el.querySelector<HTMLButtonElement>('.intel-routes [aria-pressed="true"]')?.focus(); },
      }))),
      h('aside', { class: 'intel-coverage' }, h('b', { text: `Route ${this.route + 1} · shooter reach` }), h('p', { text: `Ground ${coverage.ground}% · Air ${coverage.air}%` }), h('small', { text: 'Approximate path covered by installed shooters. Includes construction; excludes heroes, recruits, damage and immunities.' }), h('p', { text: `Wave’s final enemy enters ${game.waveEntryDuration(this.forecast).toFixed(1)}s after the wave is called.` })),
      h('div', { class: 'intel-enemies' }, ...preview.filter(p => p.path === this.route).map(group => {
        const def = enemyForMap(group.enemy, game.map.id);
        const children = splitPreview(group.enemy, group.count, group.properties.includes('pressurized'));
        const hp = game.previewHealth(group.enemy, game.waveIdx + this.forecast, group.properties);
        return h('article', { class: 'intel-enemy' }, h('div', { class: 'intel-enemy-heading' }, enemyPortrait(def.id, 58),
          h('div', {}, h('h3', { text: def.name }), h('span', { class: 'small', text: `×${group.count} · ${hp} HP${group.properties.includes('cast') ? ` + ${Math.round(hp * .85)} shell` : ''}` }))),
          h('div', { class: 'intel-traits' }, ...enemyTraits(def).map(text => h('span', { class: 'pill', text })), ...group.properties.map(p => h('span', { class: 'pill', text: PROPERTY_LABEL[p], title: PROPERTY_HINT[p] }))),
          h('p', { text: def.counters }),
          children ? h('p', { class: 'small', text: `When popped: ${children.count} ${ENEMIES[children.child].name}. Children keep moving down this route.` }) : null);
      })),
      h('footer', { class: 'intel-footer' }, h('button', { class: 'btn', text: 'Back to defenses', onClick: () => this.close() }),
        h('button', { class: 'btn primary', text: this.forecast > 0 ? 'Preview only' : `${game.waveIdx === 0 ? 'Start job' : 'Call wave'} +$${bonus}${game.callCooldownRecovery > 0 ? ` · −${Math.floor(game.callCooldownRecovery)}s skills` : ''}`, disabled: this.forecast !== 0 || !game.canCallWave || !this.handlers.canCall(), title: !this.handlers.canCall() ? 'Resume time before calling a wave' : game.canCallWave ? 'Call now for the displayed reward' : game.callBlockReason, onClick: () => { this.close(); this.handlers.onCall(); } })));
  }
}
