import { ENEMIES } from '../../data/enemies';
import { PROPERTY_LABEL } from '../../data/leakProperties';
import { previewRbe, splitPreview } from '../../data/splits';
import { isOneLife, isNoPowers } from '../../data/remasters';
import { ABILITY_KEYS, COOLDOWN_FIELDS, type AbilitySlot } from '../../data/heroes';
import { enemyForMap } from '../../data/bosses';
import { NIGHT_MUTATORS, proceduralMutator } from '../../data/night';
import type { TowerId } from '../../data/types';
import { TOWERS } from '../../data/towers';
import type { Game } from '../../sim/game';
import { HERO_LEVEL_CAP, STRIKE_COOLDOWN } from '../../sim/game';
import { leakMax, leakRemaining, missionXpToNext, scaledAbilityCooldown } from '../../sim/combat';
import { CREW_COOLDOWN } from '../../sim/crew';
import { clear, h } from '../dom';
import { enemyPortrait, heroPortrait, towerPortrait } from '../portraits';
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
  onStrike(): void;
  onArm(id: TowerId): void;
  onScout(): void;
}

/** Top and bottom bars. `update()` runs every frame and only touches text that changed. */
export class Hud {
  readonly top: HTMLElement;
  readonly bottom: HTMLElement;
  private readonly lives = h('b');
  private readonly money = h('b');
  private readonly parts = h('b');
  private readonly wave = h('b');
  private readonly pipeLoad = h('b');
  private readonly pipeMedal: HTMLElement;
  private readonly next = h('span', { class: 'next-wave' });
  private readonly callBtn = h('button', { class: 'btn primary call' });
  private readonly speedBtn = h('button', { class: 'btn small-btn' });
  private readonly pauseBtn = h('button', { class: 'btn small-btn' });
  private readonly hpFill = h('div', { class: 'fill' });
  private readonly hpText = h('span', { class: 'small' });
  private readonly xpFill = h('div', { class: 'fill xp' });
  private readonly xpText = h('span', { class: 'xp-label' });
  private readonly comboChip = h('span', { class: 'combo-chip hidden' });
  private readonly stickyChip = h('span', { class: 'sticky-chip hidden' });
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
  private readonly strikeBtn = h('button', { class: 'ability ab-strike' });
  private readonly strikeCd = h('div', { class: 'cd' });
  private readonly bossPanel = h('div', { class: 'boss-panel hidden' });
  private readonly bossName = h('span');
  private readonly bossHp = h('span', {
    class: 'boss-hp',
    attrs: {
      role: 'progressbar',
      'aria-valuemin': '0',
      'aria-valuemax': '100',
      'aria-valuenow': '100',
      'aria-label': 'Boss health',
    },
  });
  private readonly status = h('span', { class: 'jeff-status' });
  private readonly hint = h('div', { class: 'hint' });
  private readonly clockBtn = h('button', { class: 'btn small-btn' });
  private readonly muteBtn = h('button', { class: 'btn small-btn' });
  private readonly mutator = h('span', { class: 'pill night-mut hidden' });
  private readonly jeffCard: HTMLElement;
  private readonly abilityRail: HTMLElement;
  private readonly toolTray: HTMLElement;
  private readonly trayBtns = new Map<TowerId, HTMLButtonElement>();
  private readonly trayCosts = new Map<TowerId, HTMLElement>();
  private readonly rankPips: HTMLElement[][] = [];
  private nextKey = '';
  private readonly muteLabelFn: () => string;
  private armed: TowerId | null = null;

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
    this.stickyChip.addEventListener('click', () => {
      if (this.armed) handlers.onArm(this.armed);
    });
    this.stickyChip.setAttribute('role', 'button');
    this.stickyChip.tabIndex = 0;

    this.pipeMedal = h(
      'div',
      {
        class: 'medal pipe',
        title: 'Lives on the line if they walk — including children still inside parents.',
      },
      h('span', { class: 'ico', text: '≡' }),
      this.pipeLoad,
    );
    this.top = h(
      'div',
      { class: 'hud-top plate' },
      h('div', { class: 'medal heart' }, h('span', { class: 'ico', text: '♥' }), this.lives),
      this.pipeMedal,
      h('div', { class: 'medal coin' }, h('span', { class: 'ico', text: '$' }), this.money),
      h('div', { class: 'medal parts', title: game.remaster === 'cleanHands' ? 'Clean Hands — no spare-parts actives.' : 'Spare parts. Earned on pops, spent on tool actives (V).' }, h('span', { class: 'ico', text: '⚙' }), this.parts),
      this.comboChip,
      this.stickyChip,
      h('div', { class: 'medal wave' }, h('span', { class: 'label', text: 'Wave' }), this.wave),
      h('div', { class: 'hud-group grow' }, this.next, this.mutator),
      h('button', { class: 'btn small-btn scout-button', text: 'Scout (I)', title: 'Pause and inspect incoming routes, enemies and counters', onClick: handlers.onScout }),
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
      const pips = h('span', { class: 'rank-pips', attrs: { 'aria-hidden': 'true' } });
      const dots = [0, 1, 2].map(() => h('span', { class: 'rank-pip' }));
      pips.append(...dots);
      buttons[i]!.append(pips);
      this.rankPips[i] = dots;
    });

ability(this.crewBtn, this.crewCd, 'D', 'Summon Logan', 'Tiny gremlin · 18s', handlers.onCrew);
    ability(this.strikeBtn, this.strikeCd, 'X', 'Torch rain', '3 fire dumps on a point', handlers.onStrike);
    if (isNoPowers(game.remaster)) {
      this.crewBtn.title = 'Clean Hands — no Summon Logan.';
      this.strikeBtn.title = 'Clean Hands — no torch rain.';
    }

    this.jeffCard = h(
      'button',
      {
        class: 'jeff-card ornate',
        onClick: handlers.onSelectJeff,
        title: `Deploy or select ${game.heroDef.name} (J). ${game.heroDef.aura.name}: ${game.heroDef.aura.description}`,
      },
      h('div', { class: 'jeff-frame' }, heroPortrait(game.heroDef.id, 72)),
      h(
        'div',
        { class: 'jeff-info' },
        h('div', { class: 'jeff-name-row' }, h('b', { text: game.heroDef.name }), h('span', { class: 'jeff-title', text: game.heroDef.style })),
        h('div', { class: 'bar hp' }, this.hpFill),
        h('div', { class: 'bar xp', title: 'Hero XP this job — level-ups let you rank a skill' }, this.xpFill),
        h('div', { class: 'jeff-meta' }, this.hpText, this.status, this.xpText),
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
      this.strikeBtn,
    );
    this.toolTray = h('div', { class: 'tool-tray', attrs: { role: 'toolbar', 'aria-label': 'Build tray' } });
    const kit = game.allowedTowers;
    kit.forEach((id, i) => {
      const def = TOWERS[id];
      const cost = h('span', { class: 'tray-cost', text: `$${game.towerCost(id)}` });
      const btn = h(
        'button',
        {
          class: 'tray-tool',
          title: `${def.name} ($${game.towerCost(id)}) · ${def.role}. Click to arm, then tap a pad.`,
          attrs: { 'aria-label': `Arm ${def.name}`, 'data-tower': id },
          onClick: () => handlers.onArm(id),
        },
        h('span', { class: 'tray-key', text: String(i + 1) }),
        towerPortrait(id, 52),
        h('span', { class: 'tray-name', text: def.name }),
        cost,
      ) as HTMLButtonElement;
      this.trayBtns.set(id, btn);
      this.trayCosts.set(id, cost);
      this.toolTray.append(btn);
    });
    this.bossPanel.append(this.bossName, h('div', { class: 'boss-track' }, this.bossHp));

    this.bottom = h(
      'div',
      { class: 'hud-bottom plate' },
      this.jeffCard,
      this.toolTray,
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

  setSticky(id: TowerId | null): void {
    this.setArmed(id);
  }

  setArmed(id: TowerId | null): void {
    this.armed = id;
    for (const [tid, btn] of this.trayBtns) btn.classList.toggle('armed', tid === id);
    if (!id) {
      this.stickyChip.classList.add('hidden');
      this.stickyChip.textContent = '';
      return;
    }
    const def = TOWERS[id];
    this.stickyChip.classList.remove('hidden');
    this.set(this.stickyChip, `${def.name} ×`);
    this.stickyChip.title = `${def.name} armed. Tap a pad to plant. Esc cancels.`;
  }

  setAbilityArmed(slot: number | null): void {
    const buttons = [this.clampBtn, this.shutoffBtn, this.pulseBtn, this.sleeveBtn, this.coffeeBtn];
    buttons.forEach((btn, i) => btn.classList.toggle('aiming', slot === i));
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
  private prevParts = -1;
  private shownMoney = -1;
  private prevHp = -1;
  private prevLevel = 1;
  private readyState = new Map<HTMLElement, boolean>();

  private cooldownButton(btn: HTMLElement, cd: HTMLElement, remaining: number, max: number, downed: boolean, casting = false): void {
    cd.style.height = `${(Math.max(0, remaining) / max) * 100}%`;
    const ready = remaining <= 0 && !downed && !casting;
    const was = this.readyState.get(btn);
    btn.classList.toggle('ready', ready);
    btn.classList.toggle('cooling', remaining > 0);
    if (ready && was === false) this.replay(btn, 'just-ready');
    this.readyState.set(btn, ready);
    let timer = btn.querySelector<HTMLElement>('.cooldown-number');
    if (!timer) { timer = h('span', { class: 'cooldown-number' }); btn.append(timer); }
    this.set(timer, downed ? '—' : remaining > 0 ? `${Math.ceil(remaining)}` : casting ? '…' : '');
    (btn as HTMLButtonElement).disabled = downed || casting;
  }

  update(): void {
    const g = this.game;
    const scoutButton = this.top.querySelector<HTMLButtonElement>('.scout-button');
    if (scoutButton) scoutButton.disabled = g.allWavesStarted;
    if (this.set(this.lives, String(g.lives)) && this.prevLives !== -1) {
      this.replay(this.lives.parentElement ?? this.lives, g.lives < this.prevLives ? 'hurt' : 'bump');
    }
    this.lives.parentElement?.classList.toggle('critical', g.lives > 0 && g.lives <= 2 && g.map.lives > 3 && !isOneLife(g.remaster));
    this.prevLives = g.lives;
    if (this.shownMoney < 0) this.shownMoney = g.money;
    const gap = g.money - this.shownMoney;
    if (Math.abs(gap) < 0.6) this.shownMoney = g.money;
    else this.shownMoney += gap * 0.28;
    if (this.set(this.money, String(Math.round(this.shownMoney))) && this.prevMoney !== -1 && g.money !== this.prevMoney) {
      this.replay(this.money.parentElement ?? this.money, 'bump');
    }
    this.prevMoney = g.money;
    if (this.set(this.parts, String(g.parts)) && this.prevParts !== -1 && g.parts !== this.prevParts) {
      this.replay(this.parts.parentElement ?? this.parts, 'bump');
    }
    this.prevParts = g.parts;
    if (this.set(this.wave, g.endless ? String(Math.max(g.waveIdx, 0)) : `${Math.min(g.waveIdx, g.map.waves.length)} / ${g.map.waves.length}`)) {
      this.replay(this.wave.parentElement ?? this.wave, 'bump');
    }
    this.wave.parentElement?.classList.toggle('rushing', g.waveRush && g.waveActive);
    if (g.waveRush && g.waveActive) this.wave.parentElement?.setAttribute('title', 'RUSH — packed parents. Splash the children.');
    else this.wave.parentElement?.removeAttribute('title');

    const upcoming = g.allWavesStarted ? 0 : previewRbe(g.nextWavePreview());
    const load = g.waveActive ? g.pipeRbe() : upcoming;
    this.pipeMedal.classList.toggle('hidden', load <= 0);
    this.pipeMedal.classList.toggle('hot', load > g.lives);
    this.pipeMedal.title = g.waveActive
      ? `On the pipe: ${load} ${load === 1 ? 'life' : 'lives'} if they walk — including children still inside parents.`
      : `If they walk: ${load} ${load === 1 ? 'life' : 'lives'} — including children still inside parents.`;
    this.set(this.pipeLoad, String(load));

    if (g.allWavesStarted) {
      this.set(this.next, g.waveActive ? (g.waveRush ? 'RUSH — splash the children!' : 'Last wave — hold the line!') : '');
      this.next.classList.toggle('is-rush', g.waveRush && g.waveActive);
      this.nextKey = '';
      this.callBtn.classList.add('hidden');
    } else {
      const preview = g.nextWavePreview();
      const rushing = g.nextWaveIsRush();
      const secs = Math.max(0, Math.ceil(g.waveCountdown));
      const key = `${secs}|${g.waveActive}|${g.spawns.length > 0}|${rushing ? 'R' : ''}|${preview.map((p) => `${p.enemy}:${p.count}:${p.properties.join('.')}`).join(',')}`;
      if (key !== this.nextKey) {
        this.nextKey = key;
        clear(this.next);
        this.next.classList.toggle('is-rush', rushing);
        this.next.append(h('span', { class: 'next-label', text: g.manualStart && g.waveIdx === 0 ? 'Prepare your defense' : g.spawns.length > 0 ? 'Wave entering' : g.waveActive && secs === 0 ? 'Hold the line · next wave waiting' : g.endless && g.waveActive ? 'Next after this call' : `Next in ${secs}s` }));
        if (rushing) this.next.append(h('span', { class: 'rush-pill', text: 'RUSH', title: 'Tight pack — splash the children or they flood.' }));
        this.next.title = [
          rushing ? 'RUSH — packed parents. Splash the children.' : '',
          `If they walk: ${previewRbe(preview)} ${previewRbe(preview) === 1 ? 'life' : 'lives'}`,
          ...preview.map((p) => {
            const tags = p.properties.length ? ` · ${p.properties.map((x) => PROPERTY_LABEL[x]).join(', ')}` : '';
            const kids = splitPreview(p.enemy, p.count, p.properties.includes('pressurized'));
            const split = kids ? ` → ${kids.count} ${ENEMIES[kids.child].name}` : '';
            return `${p.count} × ${enemyForMap(p.enemy, g.map.id).name}${split}${tags} · route ${p.path + 1}\n${enemyForMap(p.enemy, g.map.id).counters}`;
          }),
        ].filter(Boolean).join('\n\n');
        for (const p of preview) {
          const def = enemyForMap(p.enemy, g.map.id);
          const tags = p.properties.map((x) => PROPERTY_LABEL[x]).join(', ');
          const kids = splitPreview(p.enemy, p.count, p.properties.includes('pressurized'));
          const split = kids ? ` → ${kids.count} ${ENEMIES[kids.child].name}` : '';
          this.next.append(
            h('span', {
              class: `wave-pip${def.flying ? ' air' : ''}${def.armor >= 0.4 ? ' arm' : ''}${p.properties.length ? ' stacked' : ''}${kids ? ' splits' : ''}${rushing ? ' rush' : ''}`,
              title: `${p.count} × ${def.name}${split}${tags ? ` · ${tags}` : ''}${def.flying ? ' · flying' : ''}${def.armor >= 0.4 ? ` · armor ${Math.round(def.armor * 100)}%` : ''} · route ${p.path + 1}`,
              attrs: { 'aria-label': `${p.count} ${def.name}${split}${tags ? ` ${tags}` : ''}` },
            }, enemyPortrait(p.enemy, 28), h('span', { class: 'pip-count', text: `${p.count}` }), p.properties.length ? h('span', { class: 'pip-props', text: p.properties.map((x) => x[0]!.toUpperCase()).join('') }) : null, kids ? h('span', { class: 'pip-split', text: `→${kids.count}` }) : null),
          );
        }
        this.next.append(h('span', { class: 'next-names', text: preview.map((p) => {
          const kids = splitPreview(p.enemy, p.count, p.properties.includes('pressurized'));
          return kids ? `${p.count} ${enemyForMap(p.enemy, g.map.id).name} → ${kids.count} ${ENEMIES[kids.child].name}` : `${p.count} ${enemyForMap(p.enemy, g.map.id).name}`;
        }).join(' · ') }));
      }
      const bonus = g.callBonus;
      this.set(this.callBtn, g.waveIdx === 0 ? `Start job  (+$${bonus})` : rushing ? `Call rush  (+$${bonus})` : `Call wave  (+$${bonus})`);
      this.callBtn.disabled = !g.canCallWave;
      this.callBtn.title = g.canCallWave ? `+$${bonus}${g.callCooldownRecovery > 0 ? ` and ${g.callCooldownRecovery.toFixed(1)}s off hero, Logan, and torch rain cooldowns` : ''}` : g.callBlockReason;
      this.callBtn.classList.toggle('hidden', g.endless && g.waveActive);
    }

    const hero = g.hero;
    this.hpFill.style.width = `${(hero.hp / hero.maxHp) * 100}%`;
    const need = missionXpToNext(g.heroLevel);
    const xpPct = g.heroLevel >= HERO_LEVEL_CAP ? 100 : (g.heroXp / need) * 100;
    this.xpFill.style.width = `${Math.max(2, Math.min(100, xpPct))}%`;
    this.set(this.xpText, g.pendingRankUps > 0 ? `Lv ${g.heroLevel} · pick` : g.heroLevel >= HERO_LEVEL_CAP ? 'MAX' : `Lv ${g.heroLevel}`);
    if (g.heroLevel !== this.prevLevel) {
      this.replay(this.jeffCard, 'level-up');
      this.prevLevel = g.heroLevel;
    }
    if (g.combo >= 3) {
      this.comboChip.classList.remove('hidden');
      this.set(this.comboChip, `COMBO ×${g.combo}`);
      this.comboChip.classList.toggle('hot', g.combo >= 8);
    } else {
      this.comboChip.classList.add('hidden');
    }
    if (this.prevHp !== -1 && hero.hp < this.prevHp - 0.5) this.replay(this.jeffCard, 'hurt');
    this.prevHp = hero.hp;
    this.jeffCard.classList.toggle('downed', hero.downed > 0);
    this.jeffCard.classList.toggle('recovering', !!hero.recovering);
    this.jeffCard.classList.toggle('ready-deploy', g.heroEnabled && !hero.deployed && hero.downed <= 0);
    this.jeffCard.classList.toggle('rank-pending', g.pendingRankUps > 0);
    this.set(this.hpText, `${Math.ceil(hero.hp)} / ${hero.maxHp}`);
    let status = '· guarding';
    if (hero.downed > 0) status = `· down ${Math.ceil(hero.downed)}s`;
    else if (!hero.deployed) status = '· tap to deploy';
    else if (hero.queuedOrder) status = '· order queued';
    else if (hero.recovering) status = '· recovering';
    else if (hero.dest) status = '· moving';
    else if (hero.orderTargetId !== null) {
      const prey = g.enemies.find((e) => e.id === hero.orderTargetId);
      status = prey ? `· attacking ${prey.def.name}` : '· hunting';
    } else if (hero.engaged) status = '· hunting';
    else if (hero.targetId !== null) status = '· holding the line';
    this.set(this.status, status);

    const downed = hero.downed > 0 || !hero.deployed;
    const buttons = [this.clampBtn, this.shutoffBtn, this.pulseBtn, this.sleeveBtn, this.coffeeBtn];
    const fills = [this.clampCd, this.shutoffCd, this.pulseCd, this.sleeveCd, this.coffeeCd];
    g.heroDef.abilities.forEach((_a, i) => {
      const slot = i as AbilitySlot;
      this.cooldownButton(buttons[i]!, fills[i]!, hero[COOLDOWN_FIELDS[i]!], scaledAbilityCooldown(g, slot), downed, !!hero.cast);
      const rank = g.abilityRanks[slot] ?? 0;
      this.rankPips[i]?.forEach((dot, n) => dot.classList.toggle('on', n < rank));
      buttons[i]!.classList.toggle('rank-pending', g.pendingRankUps > 0 && rank < 3);
    });
    this.cooldownButton(this.crewBtn, this.crewCd, g.crewCooldown, CREW_COOLDOWN, isNoPowers(g.remaster));
    this.cooldownButton(this.strikeBtn, this.strikeCd, g.strikeCooldown, STRIKE_COOLDOWN, isNoPowers(g.remaster));
    this.strikeBtn.classList.toggle('active', g.strikes.some((s) => !s.fired));
    this.sleeveBtn.classList.toggle('active', hero.sleeveTimer > 0 || (hero.overdrive ?? 0) > 0);
    this.coffeeBtn.classList.toggle('active', hero.coffeeTimer > 0);
    this.clampBtn.classList.toggle('active', g.clamp !== null);
    this.shutoffBtn.classList.toggle('active', g.globalSlowTimer > 0);
    const boss = g.enemies.find(e => e.def.traits.includes('boss') && !e.dead && !e.escaped);
    this.bossPanel.classList.toggle('hidden', !boss);
    if (boss) {
      const pct = Math.max(0, leakRemaining(boss) / leakMax(boss)) * 100;
      this.set(this.bossName, `${boss.def.name} · Phase ${boss.bossPhase + 1}`);
      this.bossHp.style.width = `${pct}%`;
      this.bossHp.setAttribute('aria-valuenow', String(Math.round(pct)));
      this.bossHp.setAttribute('aria-label', `${boss.def.name} health`);
    }

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

    for (const [id, btn] of this.trayBtns) {
      const price = g.towerCost(id);
      const el = this.trayCosts.get(id);
      if (el) this.set(el, `$${price}`);
      btn.classList.toggle('poor', g.money < price);
    }
  }
}
