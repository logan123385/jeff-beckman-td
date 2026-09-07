import { ENEMIES } from '../../data/enemies';
import { JEFF } from '../../data/jeff';
import type { Game } from '../../sim/game';
import { EARLY_CALL_BONUS_PER_SECOND } from '../../sim/game';
import { h } from '../dom';
import { jeffPortrait } from '../portraits';

export interface HudHandlers {
  onCallWave(): void;
  onToggleSpeed(): void;
  onTogglePause(): void;
  onQuit(): void;
  onClamp(): void;
  onShutoff(): void;
  onSelectJeff(): void;
}

/** Top and bottom bars. `update()` runs every frame and only touches text that changed. */
export class Hud {
  readonly top: HTMLElement;
  readonly bottom: HTMLElement;
  private readonly lives = h('b');
  private readonly money = h('b');
  private readonly wave = h('b');
  private readonly next = h('span', { class: 'next-wave' });
  private readonly callBtn = h('button', { class: 'btn primary call' });
  private readonly speedBtn = h('button', { class: 'btn small-btn' });
  private readonly pauseBtn = h('button', { class: 'btn small-btn' });
  private readonly hpFill = h('div', { class: 'fill' });
  private readonly hpText = h('span', { class: 'small' });
  private readonly clampBtn = h('button', { class: 'ability' });
  private readonly shutoffBtn = h('button', { class: 'ability' });
  private readonly clampCd = h('div', { class: 'cd' });
  private readonly shutoffCd = h('div', { class: 'cd' });
  private readonly status = h('span', { class: 'small muted jeff-status' });
  private readonly hint = h('div', { class: 'hint small muted' });

  constructor(private readonly game: Game, handlers: HudHandlers, speedLabel: () => string, pausedLabel: () => string) {
    this.callBtn.addEventListener('click', handlers.onCallWave);
    this.speedBtn.addEventListener('click', () => {
      handlers.onToggleSpeed();
      this.speedBtn.textContent = speedLabel();
    });
    this.pauseBtn.addEventListener('click', () => {
      handlers.onTogglePause();
      this.pauseBtn.textContent = pausedLabel();
    });
    this.speedBtn.textContent = speedLabel();
    this.pauseBtn.textContent = pausedLabel();

    this.top = h(
      'div',
      { class: 'hud-top' },
      h('div', { class: 'hud-group' }, h('span', { class: 'ico', text: '♥' }), this.lives),
      h('div', { class: 'hud-group' }, h('span', { class: 'ico', text: '$' }), this.money),
      h('div', { class: 'hud-group' }, h('span', { class: 'label', text: 'Wave' }), this.wave),
      h('div', { class: 'hud-group grow' }, this.next),
      this.callBtn,
      this.speedBtn,
      this.pauseBtn,
      h('button', { class: 'btn small-btn link', text: 'Quit job', onClick: handlers.onQuit }),
    );

    this.clampBtn.append(this.clampCd, h('span', { class: 'key', text: 'Q' }), h('span', { class: 'ab-name', text: 'Pipe Clamp' }), h('span', { class: 'small muted', text: `${JEFF.clamp.duration}s hold + slow at Jeff` }));
    this.shutoffBtn.append(this.shutoffCd, h('span', { class: 'key', text: 'E' }), h('span', { class: 'ab-name', text: 'Emergency Shutoff' }), h('span', { class: 'small muted', text: `${JEFF.shutoff.duration}s map-wide slow, pauses spawns` }));
    this.clampBtn.addEventListener('click', handlers.onClamp);
    this.shutoffBtn.addEventListener('click', handlers.onShutoff);

    this.bottom = h(
      'div',
      { class: 'hud-bottom' },
      h(
        'button',
        { class: 'jeff-card', onClick: handlers.onSelectJeff, title: 'Select Jeff (J). Right-click the map to move him.' },
        jeffPortrait(56),
        h(
          'div',
          { class: 'jeff-info' },
          h('b', { text: JEFF.name }),
          h('div', { class: 'bar hp' }, this.hpFill),
          h('div', {}, this.hpText, ' ', this.status),
        ),
      ),
      this.clampBtn,
      this.shutoffBtn,
      this.hint,
    );
  }

  setHint(text: string): void {
    this.set(this.hint, text);
  }

  private set(el: HTMLElement, text: string): void {
    if (el.textContent !== text) el.textContent = text;
  }

  update(): void {
    const g = this.game;
    this.set(this.lives, String(g.lives));
    this.set(this.money, String(g.money));
    this.set(this.wave, `${Math.min(g.waveIdx, g.totalWaves)} / ${g.totalWaves}`);

    if (g.allWavesStarted) {
      this.set(this.next, g.waveActive ? 'Last wave — hold the line!' : '');
      this.callBtn.classList.add('hidden');
    } else {
      const upcoming = g.nextWaveEnemies().map((id) => ENEMIES[id].name);
      const secs = Math.max(0, Math.ceil(g.waveCountdown));
      this.set(this.next, `Next in ${secs}s: ${upcoming.join(', ')}`);
      const bonus = Math.floor(Math.max(0, g.waveCountdown) * EARLY_CALL_BONUS_PER_SECOND);
      this.set(this.callBtn, g.waveIdx === 0 ? `Start job  (+$${bonus})` : `Call wave  (+$${bonus})`);
      this.callBtn.classList.remove('hidden');
    }

    const hero = g.hero;
    this.hpFill.style.width = `${(hero.hp / hero.maxHp) * 100}%`;
    this.set(this.hpText, `${Math.ceil(hero.hp)} / ${hero.maxHp}`);
    this.set(this.status, hero.downed > 0 ? `· back in ${Math.ceil(hero.downed)}s` : hero.dest ? '· moving' : hero.targetId !== null ? '· wrenching' : '· on site');

    const clampMax = JEFF.clamp.cooldown * g.mods.cooldown;
    const shutMax = JEFF.shutoff.cooldown * g.mods.cooldown;
    this.clampCd.style.height = `${(Math.max(0, hero.clampCooldown) / clampMax) * 100}%`;
    this.shutoffCd.style.height = `${(Math.max(0, hero.shutoffCooldown) / shutMax) * 100}%`;
    this.clampBtn.classList.toggle('ready', hero.clampCooldown <= 0 && hero.downed <= 0);
    this.shutoffBtn.classList.toggle('ready', hero.shutoffCooldown <= 0 && hero.downed <= 0);
  }
}
