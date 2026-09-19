import { ENEMIES } from '../../data/enemies';
import { ABILITY_KEYS, COOLDOWN_FIELDS } from '../../data/heroes';
import { NIGHT_MUTATORS, proceduralMutator } from '../../data/night';
import type { Game } from '../../sim/game';
import { EARLY_CALL_BONUS_PER_SECOND } from '../../sim/game';
import { CREW_COOLDOWN } from '../../sim/crew';
import { clear, h } from '../dom';
import { enemyPortrait, heroPortrait } from '../portraits';
import { skillGlyph } from './icons';

export interface HudHandlers {
  onCallWave(): void;
  onToggleSpeed(): void;
  onTogglePause(): void;
  onQuit(): void;
  onClockOut(): void;
  onMute(): void;
  muteLabel(): string;
  onClamp(): void;
  onShutoff(): void;
  onPulse(): void;
  onSleeve(): void;
  onCoffee(): void;
  onSelectJeff(): void;
  onCrew(): void;
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
  private readonly clampBtn = h('button', { class: 'ability ab-clamp' });
  private readonly shutoffBtn = h('button', { class: 'ability ab-shutoff' });
  private readonly pulseBtn = h('button', { class: 'ability ab-pulse' });
  private readonly sleeveBtn = h('button', { class: 'ability ab-sleeve' });
  private readonly coffeeBtn = h('button', { class: 'ability ab-coffee' });
  private readonly clampCd = h('div', { class: 'cd' });
  private readonly shutoffCd = h('div', { class: 'cd' });
  private readonly pulseCd = h('div', { class: 'cd' });
  private readonly sleeveCd = h('div', { class: 'cd' });
  private readonly coffeeCd = h('div', { class: 'cd' });
  private readonly crewBtn = h('button', { class: 'ability ab-crew' });
  private readonly crewCd = h('div', { class: 'cd' });
  private readonly bossPanel = h('div', { class: 'boss-panel hidden' });
  private readonly bossName = h('span');
  private readonly bossHp = h('span', { class: 'boss-hp' });
  private readonly status = h('span', { class: 'jeff-status' });
  private readonly hint = h('div', { class: 'hint' });
  private readonly clockBtn = h('button', { class: 'btn small-btn' });
  private readonly muteBtn = h('button', { class: 'btn small-btn' });
  private readonly mutator = h('span', { class: 'pill night-mut hidden' });
  private readonly jeffCard: HTMLElement;
  private readonly abilityRail: HTMLElement;
  private nextKey = '';
  private readonly muteLabelFn: () => string;

  constructor(
    private readonly game: Game,
    handlers: HudHandlers,
    private readonly speedLabel: () => string,
    private readonly pausedLabel: () => string,
  ) {
    this.muteLabelFn = handlers.muteLabel;
    this.callBtn.addEventListener('click', handlers.onCallWave);
    this.speedBtn.addEventListener('click', () => {
      handlers.onToggleSpeed();
      this.syncTransport();
    });
    this.pauseBtn.addEventListener('click', () => {
      handlers.onTogglePause();
      this.syncTransport();
    });
    this.syncTransport();
    this.muteBtn.textContent = handlers.muteLabel();
    this.muteBtn.title = 'Cycle sound: Off → Soft → Full (soft AV only)';
    this.clockBtn.textContent = 'Clock out';
    this.clockBtn.title = 'Soft-exit The Neverending Service Call. Keep the record, bank XP and crates.';
    this.clockBtn.classList.toggle('hidden', !game.endless);
    this.clockBtn.addEventListener('click', handlers.onClockOut);
    this.muteBtn.addEventListener('click', () => {
      handlers.onMute();
      this.muteBtn.textContent = handlers.muteLabel();
    });

    this.top = h(
      'div',
      { class: 'hud-top plate' },
      h('div', { class: 'medal heart' }, h('span', { class: 'ico', text: '♥' }), this.lives),
      h('div', { class: 'medal coin' }, h('span', { class: 'ico', text: '$' }), this.money),
      h('div', { class: 'medal wave' }, h('span', { class: 'label', text: 'Wave' }), this.wave),
      h('div', { class: 'hud-group grow' }, this.next, this.mutator),
      this.callBtn,
      this.clockBtn,
      this.speedBtn,
      this.pauseBtn,
      this.muteBtn,
      h('button', { class: 'btn small-btn link', text: 'Quit job', onClick: handlers.onQuit }),
    );

    const ability = (
      btn: HTMLElement,
      cd: HTMLElement,
      key: string,
      name: string,
      desc: string,
      onClick: () => void,
    ) => {
      btn.append(
        cd,
        h('span', { class: 'key', text: key }),
        h('span', { class: 'ab-glyph', html: skillGlyph(key === 'D' ? key : game.heroDef.abilities[ABILITY_KEYS.indexOf(key as typeof ABILITY_KEYS[number])]?.glyph ?? key), attrs: { 'aria-hidden': 'true' } }),
        h('span', { class: 'ab-name', text: name }),
        h('span', { class: 'ab-desc', text: desc }),
      );
      btn.addEventListener('click', onClick);
      btn.title = `${name} (${key}) · ${desc}`;
      btn.setAttribute('aria-label', `${name} (${key})`);
      return btn;
    };

    const buttons = [this.clampBtn, this.shutoffBtn, this.pulseBtn, this.sleeveBtn, this.coffeeBtn];
    const cooldowns = [this.clampCd, this.shutoffCd, this.pulseCd, this.sleeveCd, this.coffeeCd];
    const handlersBySlot = [handlers.onClamp, handlers.onShutoff, handlers.onPulse, handlers.onSleeve, handlers.onCoffee];
    game.heroDef.abilities.forEach((a, i) => {
      ability(buttons[i]!, cooldowns[i]!, ABILITY_KEYS[i]!, a.name, a.short, handlersBySlot[i]!);
      buttons[i]!.title = `${a.name} (${ABILITY_KEYS[i]}) · ${a.cooldown}s cooldown. ${a.description}`;
    });

    ability(this.crewBtn, this.crewCd, 'D', 'Support crew', '2 helpers · 18 seconds', handlers.onCrew);

    this.jeffCard = h(
      'button',
      {
        class: 'jeff-card ornate',
        onClick: handlers.onSelectJeff,
        title: `Select ${game.heroDef.name} (J). ${game.heroDef.aura.name}: ${game.heroDef.aura.description}`,
      },
      h('div', { class: 'jeff-frame' }, heroPortrait(game.heroDef.id, 72)),
      h(
        'div',
        { class: 'jeff-info' },
        h('div', { class: 'jeff-name-row' }, h('b', { text: game.heroDef.name }), h('span', { class: 'jeff-title', text: game.heroDef.style })),
        h('div', { class: 'bar hp' }, this.hpFill),
        h('div', { class: 'jeff-meta' }, this.hpText, this.status),
        h('span', { class: 'hud-hero-aura', text: game.heroDef.aura.name, title: game.heroDef.aura.description }),
      ),
    );

    this.abilityRail = h(
      'div',
      { class: 'ability-rail' },
      this.clampBtn,
      this.shutoffBtn,
      this.pulseBtn,
      this.sleeveBtn,
      this.coffeeBtn,
      this.crewBtn,
    );
    this.bossPanel.append(this.bossName, h('div', { class: 'boss-track' }, this.bossHp));

    this.bottom = h(
      'div',
      { class: 'hud-bottom plate' },
      this.jeffCard,
      this.abilityRail,
      this.hint,
      this.bossPanel,
    );
  }

  setHint(text: string): void {
    if (this.hint.textContent === text) return;
    this.hint.textContent = text;
    this.replay(this.hint, 'flash');
  }

  syncMute(): void {
    this.muteBtn.textContent = this.muteLabelFn();
  }

  setHeroSelected(on: boolean): void {
    this.jeffCard.classList.toggle('selected', on);
  }

  syncTransport(): void {
    this.speedBtn.textContent = this.speedLabel();
    this.pauseBtn.textContent = this.pausedLabel();
  }

  private set(el: HTMLElement, text: string): boolean {
    if (el.textContent === text) return false;
    el.textContent = text;
    return true;
  }

  /** Restart a CSS animation class. */
  private replay(el: HTMLElement, cls: string): void {
    el.classList.remove(cls);
    void el.offsetWidth;
    el.classList.add(cls);
  }

  private prevLives = -1;
  private prevMoney = -1;
  private prevHp = -1;
  private readyState = new Map<HTMLElement, boolean>();

  private cooldownButton(btn: HTMLElement, cd: HTMLElement, remaining: number, max: number, downed: boolean): void {
    cd.style.height = `${(Math.max(0, remaining) / max) * 100}%`;
    const ready = remaining <= 0 && !downed;
    const was = this.readyState.get(btn);
    btn.classList.toggle('ready', ready);
    btn.classList.toggle('cooling', remaining > 0);
    if (ready && was === false) this.replay(btn, 'just-ready');
    this.readyState.set(btn, ready);
    let timer = btn.querySelector<HTMLElement>('.cooldown-number');
    if (!timer) { timer = h('span', { class: 'cooldown-number' }); btn.append(timer); }
    this.set(timer, downed ? '—' : remaining > 0 ? `${Math.ceil(remaining)}` : '');
    (btn as HTMLButtonElement).disabled = !ready;
  }

  update(): void {
    const g = this.game;
    if (this.set(this.lives, String(g.lives)) && this.prevLives !== -1) {
      this.replay(this.lives.parentElement ?? this.lives, g.lives < this.prevLives ? 'hurt' : 'bump');
    }
    this.lives.parentElement?.classList.toggle('critical', g.lives > 0 && g.lives <= 2 && g.map.lives > 3 && g.remaster !== 'frozenMain');
    this.prevLives = g.lives;
    if (this.set(this.money, String(g.money)) && this.prevMoney !== -1) {
      this.replay(this.money.parentElement ?? this.money, 'bump');
    }
    this.prevMoney = g.money;
    if (this.set(this.wave, g.endless ? String(Math.max(g.waveIdx, 0)) : `${Math.min(g.waveIdx, g.map.waves.length)} / ${g.map.waves.length}`)) {
      this.replay(this.wave.parentElement ?? this.wave, 'bump');
    }

    if (g.allWavesStarted) {
      this.set(this.next, g.waveActive ? 'Last wave — hold the line!' : '');
      this.nextKey = '';
      this.callBtn.classList.add('hidden');
    } else {
      const ids = g.nextWaveEnemies();
      const secs = Math.max(0, Math.ceil(g.waveCountdown));
      const key = `${secs}|${g.waveActive}|${ids.join(',')}`;
      if (key !== this.nextKey) {
        this.nextKey = key;
        clear(this.next);
        this.next.append(h('span', { class: 'next-label', text: g.manualStart && g.waveIdx === 0 ? 'Prepare your defense' : g.endless && g.waveActive ? 'Next after this call' : `Next in ${secs}s` }));
        this.next.title = g.nextWavePreview().map(p => `${p.count} × ${ENEMIES[p.enemy].name} · route ${p.path + 1}\n${ENEMIES[p.enemy].counters}`).join('\n\n');
        for (const id of ids) {
          this.next.append(
            h('span', {
              class: 'wave-pip',
              title: ENEMIES[id].name,
              attrs: { 'aria-label': ENEMIES[id].name },
            }, enemyPortrait(id, 28)),
          );
        }
        this.next.append(h('span', { class: 'next-names', text: ids.map((id) => ENEMIES[id].name).join(' · ') }));
      }
      const bonus = Math.floor(Math.max(0, g.waveCountdown) * EARLY_CALL_BONUS_PER_SECOND);
      this.set(this.callBtn, g.waveIdx === 0 ? `Start job  (+$${bonus})` : `Call wave  (+$${bonus})`);
      this.callBtn.classList.remove('hidden');
    }

    const hero = g.hero;
    this.hpFill.style.width = `${(hero.hp / hero.maxHp) * 100}%`;
    if (this.prevHp !== -1 && hero.hp < this.prevHp - 0.5) this.replay(this.jeffCard, 'hurt');
    this.prevHp = hero.hp;
    this.jeffCard.classList.toggle('downed', hero.downed > 0);
    this.set(this.hpText, `${Math.ceil(hero.hp)} / ${hero.maxHp}`);
    let status = '· guarding';
    if (hero.downed > 0) status = `· van in ${Math.ceil(hero.downed)}s`;
    else if (hero.dest) status = '· moving';
    else if (hero.orderTargetId !== null) {
      const prey = g.enemies.find((e) => e.id === hero.orderTargetId);
      status = prey ? `· attacking ${prey.def.name}` : '· hunting';
    } else if (hero.engaged) status = '· hunting';
    else if (hero.targetId !== null) status = '· holding the line';
    this.set(this.status, status);

    const cdMult = g.mods.cooldown / g.jeffCdAura;
    const downed = hero.downed > 0;
    const buttons = [this.clampBtn, this.shutoffBtn, this.pulseBtn, this.sleeveBtn, this.coffeeBtn];
    const fills = [this.clampCd, this.shutoffCd, this.pulseCd, this.sleeveCd, this.coffeeCd];
    g.heroDef.abilities.forEach((a, i) => this.cooldownButton(buttons[i]!, fills[i]!, hero[COOLDOWN_FIELDS[i]!], a.cooldown * cdMult, downed || !!hero.cast));
    this.cooldownButton(this.crewBtn, this.crewCd, g.crewCooldown, CREW_COOLDOWN, false);
    this.sleeveBtn.classList.toggle('active', hero.sleeveTimer > 0 || (hero.overdrive ?? 0) > 0);
    this.coffeeBtn.classList.toggle('active', hero.coffeeTimer > 0);
    this.clampBtn.classList.toggle('active', g.clamp !== null);
    this.shutoffBtn.classList.toggle('active', g.globalSlowTimer > 0);
    const boss = g.enemies.find(e => e.def.traits.includes('boss') && !e.dead && !e.escaped);
    this.bossPanel.classList.toggle('hidden', !boss);
    if (boss) { this.set(this.bossName, `${boss.def.name} · Phase ${boss.bossPhase + 1}`); this.bossHp.style.width = `${Math.max(0, boss.hp / boss.maxHp) * 100}%`; }

    const mutId = g.endless
      ? (g.nightMutator ?? (g.waveIdx >= g.map.waves.length ? proceduralMutator(g.waveIdx, g.map.waves.length) : null))
      : null;
    if (mutId) {
      const info = NIGHT_MUTATORS[mutId];
      this.mutator.classList.remove('hidden');
      this.set(this.mutator, g.nightMutator ? info.name : `Next: ${info.name}`);
      this.mutator.title = info.blurb;
    } else {
      this.mutator.classList.add('hidden');
    }
  }
}
