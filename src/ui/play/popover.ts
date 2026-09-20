import { TOWERS, TOWER_ORDER, TIER_NAMES } from '../../data/towers';
import type { TowerId } from '../../data/types';
import { specializationInfo, type Specialization } from '../../data/specializations';
import { towerAbility } from '../../data/towerAbilities';
import { isNoSell, remasterTitle } from '../../data/remasters';
import { AIM_HINT, AIM_LABEL } from '../../sim/combat';
import { towerAbilityReady } from '../../sim/towerAbilities';
import type { Game } from '../../sim/game';
import type { Tower } from '../../sim/state';
import { clear, h } from '../dom';
import { towerPortrait } from '../portraits';

export interface PopoverHandlers {
  onBuild(slot: number, id: TowerId): void;
  onUpgrade(towerId: number): void;
  onMastery(towerId: number): void;
  onSell(towerId: number): void;
  onPreview(id: TowerId | null): void;
  onClose(): void;
  onCycleAim(towerId: number): void;
  onSpecialize(towerId: number, choice: Specialization): void;
  onRally(towerId: number): void;
  onAbility(towerId: number): void;
}

/** Kingdom Rush–style radial command wheel anchored to a pad or tower. */
export class Popover {
  readonly el = h('div', { class: 'kr-wheel hidden' });
  private mode: { kind: 'build'; slot: number } | { kind: 'tower'; towerId: number } | null = null;
  private lastKey = '';

  constructor(private readonly game: Game, private readonly handlers: PopoverHandlers) {
    this.el.addEventListener('mousedown', (e) => e.stopPropagation());
    this.el.addEventListener('pointerdown', (e) => e.stopPropagation());
    this.el.addEventListener('contextmenu', (e) => e.preventDefault());
  }

  get isOpen(): boolean {
    return this.mode !== null;
  }

  showBuild(slot: number): void {
    this.mode = { kind: 'build', slot };
    this.lastKey = '';
    this.rebuild();
    const first = TOWER_ORDER.find((id) => this.game.allowedTowers.includes(id));
    if (first) this.handlers.onPreview(first);
  }

  showTower(towerId: number): void {
    this.mode = { kind: 'tower', towerId };
    this.lastKey = '';
    this.rebuild();
  }

  hide(): void {
    this.mode = null;
    this.lastKey = '';
    this.el.classList.add('hidden');
    this.handlers.onPreview(null);
  }

  update(stage: HTMLElement, canvas: HTMLCanvasElement): void {
    if (!this.mode) return;
    if (this.mode.kind === 'tower' && !this.game.towerById(this.mode.towerId)) {
      this.hide();
      return;
    }
    const key = this.modeKey();
    if (key !== this.lastKey) this.rebuild();
    const anchor = this.mode.kind === 'build' ? this.game.map.slots[this.mode.slot]! : this.game.towerById(this.mode.towerId)!.pos;
    const rect = canvas.getBoundingClientRect();
    const stageRect = stage.getBoundingClientRect();
    const sx = rect.width / 960;
    const sy = rect.height / 600;
    const x = rect.left - stageRect.left + anchor.x * sx;
    const y = rect.top - stageRect.top + (anchor.y - 18) * sy;
    const w = this.el.offsetWidth || 240;
    const hgt = this.el.offsetHeight || 240;
    const left = Math.max(4, Math.min(stageRect.width - w - 4, x - w / 2));
    const top = Math.max(4, Math.min(stageRect.height - hgt - 4, y - hgt / 2));
    this.el.style.left = `${left}px`;
    this.el.style.top = `${top}px`;
  }

  private modeKey(): string {
    if (!this.mode) return '';
    if (this.mode.kind === 'build') return `b${this.mode.slot}|${this.game.money}`;
    const t = this.game.towerById(this.mode.towerId);
    return `t${this.mode.towerId}|${this.game.money}|${this.game.parts}|${t?.level}|${t?.aim}|${t?.specialization ?? ''}|${t?.mastery ?? 0}|${Math.ceil(t?.abilityCd ?? 0)}`;
  }

  private rebuild(): void {
    if (!this.mode) return;
    this.lastKey = this.modeKey();
    clear(this.el);
    this.el.classList.remove('hidden');
    this.el.classList.toggle('kr-build', this.mode.kind === 'build');
    if (this.mode.kind === 'build') this.renderBuild(this.mode.slot);
    else {
      const t = this.game.towerById(this.mode.towerId);
      if (t) this.renderTower(t);
      else this.hide();
    }
  }

  private spoke(angle: number, cls: string, children: (HTMLElement | string | null)[], opts: {
    disabled?: boolean;
    title?: string;
    onClick: () => void;
    onEnter?: () => void;
    onLeave?: () => void;
  }): HTMLElement {
    return h(
      'button',
      {
        class: `kr-spoke ${cls}${opts.disabled ? ' poor' : ''}`,
        attrs: { style: `--a:${angle}deg` },
        title: opts.title,
        disabled: opts.disabled,
        onClick: opts.onClick,
        onMouseEnter: opts.onEnter,
        onMouseLeave: opts.onLeave,
      },
      ...children,
    );
  }

  private renderBuild(slot: number): void {
    const g = this.game;
    const kit = TOWER_ORDER.filter((id) => g.allowedTowers.includes(id));
    const n = kit.length || 1;
    this.el.append(
      h(
        'div',
        { class: 'kr-hub' },
        h('span', { class: 'kr-hub-name', text: 'Plant' }),
        h('button', { class: 'kr-x', text: '×', attrs: { 'aria-label': 'Close tower menu' }, onClick: () => this.handlers.onClose() }),
      ),
      ...kit.map((id, i) => {
        const def = TOWERS[id];
        const cost = g.towerCost(id);
        const ok = g.money >= cost;
        const angle = -90 + (i * 360) / n;
        const key = i < 9 ? String(i + 1) : '';
        return this.spoke(angle, `kr-build-tool${ok ? '' : ' poor'}`, [
          towerPortrait(id, 48),
          key ? h('span', { class: 'kr-key', text: key }) : null,
          h('b', { text: def.name }),
          h('span', { class: `kr-cost${ok ? '' : ' poor'}`, text: `$${cost}` }),
        ], {
          disabled: !ok,
          title: `${def.blurb} · ${def.role}`,
          onClick: () => this.handlers.onBuild(slot, id),
          onEnter: () => this.handlers.onPreview(id),
          onLeave: () => this.handlers.onPreview(null),
        });
      }),
    );
  }

  private renderTower(t: Tower): void {
    const g = this.game;
    const up = g.upgradeCost(t);
    const next = t.level < t.def.levels.length - 1 ? t.def.levels[t.level + 1] : undefined;
    const canSpec = t.level >= 2 && !t.specialization;
    this.el.append(
      h(
        'div',
        { class: 'kr-hub' },
        h('span', { class: 'swatch', style: { background: t.def.color } }),
        h('span', { class: 'kr-hub-name', text: t.def.name }),
        h('span', { class: 'kr-hub-tier', text: `${TIER_NAMES[t.level]} · ${t.level + 1}/6` }),
        h('button', { class: 'kr-x', text: '×', attrs: { 'aria-label': 'Close' }, onClick: () => this.handlers.onClose() }),
      ),
    );

    if (up !== null) {
      const ok = g.money >= up;
      this.el.append(this.spoke(-90, `kr-up${ok ? '' : ' poor'}`, [
        h('span', { class: 'kr-spoke-label', text: 'Upgrade' }),
        h('span', { class: 'kr-cost', text: `$${up}` }),
        next ? h('span', { class: 'kr-spoke-sub', text: TIER_NAMES[t.level + 1] ?? '' }) : null,
      ], {
        disabled: !ok,
        title: next ? `Next: ${statLine(t.def.id, next.damage * g.mods.towerDamage, next.range * g.mods.towerRange, next.fireRate, next)}` : 'Upgrade',
        onClick: () => this.handlers.onUpgrade(t.id),
      }));
    } else {
      const cost = g.masteryCost(t);
      const ok = g.money >= cost;
      this.el.append(this.spoke(-90, `kr-up${ok ? '' : ' poor'}`, [
        h('span', { class: 'kr-spoke-label', text: `Mastery ${1 + (t.mastery ?? 0)}` }),
        h('span', { class: 'kr-cost', text: `$${cost}` }),
      ], {
        disabled: !ok,
        title: 'Repeatable: +14% damage and health; faster attacks.',
        onClick: () => this.handlers.onMastery(t.id),
      }));
    }

    if (isNoSell(g.remaster)) {
      this.el.append(this.spoke(90, 'kr-sell poor', [
        h('span', { class: 'kr-spoke-label', text: 'No sell' }),
        h('span', { class: 'kr-spoke-sub', text: remasterTitle(g.remaster) }),
      ], {
        disabled: true,
        title: `${remasterTitle(g.remaster)} — fittings stay. No refunds.`,
        onClick: () => undefined,
      }));
    } else {
      this.el.append(this.spoke(90, 'kr-sell', [
        h('span', { class: 'kr-spoke-label', text: 'Sell' }),
        h('span', { class: 'kr-cost', text: `$${g.sellValue(t)}` }),
      ], {
        title: `Refund ${Math.round(g.mods.sellRate * 100)}% of what you invested.`,
        onClick: () => this.handlers.onSell(t.id),
      }));
    }

    const ability = towerAbility(t.def.id);
    if (ability) {
      const gate = towerAbilityReady(g, t);
      const cd = Math.ceil(t.abilityCd);
      this.el.append(this.spoke(-145, `kr-ability${gate.ok ? '' : ' poor'}`, [
        h('span', { class: 'kr-spoke-label', text: ability.name }),
        h('span', { class: 'kr-cost', text: gate.ok ? `${ability.parts} pts` : cd > 0 ? `${cd}s` : t.level < ability.minLevel ? 'Upgrade' : `${ability.parts} pts` }),
        h('span', { class: 'kr-spoke-sub', text: 'V' }),
      ], {
        disabled: !gate.ok,
        title: gate.ok ? `${ability.blurb} · ${ability.parts} spare parts · ${ability.cooldown}s` : `${ability.blurb} · ${gate.reason}`,
        onClick: () => this.handlers.onAbility(t.id),
      }));
    }

    if (t.def.kind === 'shooter') {
      this.el.append(this.spoke(-200, 'kr-aim', [
        h('span', { class: 'kr-spoke-label', text: 'Aim' }),
        h('span', { class: 'kr-spoke-sub', text: AIM_LABEL[t.aim] }),
      ], {
        title: `Shoots ${AIM_HINT[t.aim]}. Click or press A to cycle.`,
        onClick: () => this.handlers.onCycleAim(t.id),
      }));
    }
    if (t.def.kind === 'barricade') {
      this.el.append(this.spoke(20, 'kr-rally', [
        h('span', { class: 'kr-spoke-label', text: 'Rally' }),
        h('span', { class: 'kr-spoke-sub', text: 'G' }),
      ], {
        title: t.def.recruits
          ? 'Place the crew on a route within 150 pixels of this tower.'
          : 'Move this valve’s hold point onto a nearby route.',
        onClick: () => this.handlers.onRally(t.id),
      }));
    }
    if (t.def.kind === 'barricade' && !t.def.recruits) {
      this.el.append(h('div', { class: 'kr-hp', text: t.rebuild > 0 ? 'Rebuilding' : `${Math.round(t.hp)} / ${t.maxHp}` }));
    }
    if (canSpec) {
      (['power', 'control'] as const).forEach((choice, i) => {
        const info = specializationInfo(t.def, choice);
        const cost = Math.round(info.cost * g.mods.towerCost);
        this.el.append(this.spoke(i === 0 ? -40 : 40, `kr-spec ${choice}`, [
          h('span', { class: 'kr-spoke-label', text: info.name }),
          h('span', { class: 'kr-spoke-sub', text: info.description }),
          h('span', { class: 'kr-cost', text: `$${cost}` }),
        ], {
          disabled: g.money < cost,
          title: info.description,
          onClick: () => this.handlers.onSpecialize(t.id, choice),
        }));
      });
    }
  }
}

function statLine(id: TowerId, damage: number, range: number, rate: number, lvl: (typeof TOWERS)[TowerId]['levels'][number]): string {
  const parts: string[] = [];
  switch (id) {
    case 'torch':
    case 'vent':
      parts.push(`${Math.round(damage)} dmg`, `${rate}/s`, `range ${Math.round(range)}`);
      break;
    case 'washer':
      parts.push(`${Math.round(damage)} splash`, `radius ${lvl.splash}`, `${rate}/s`, `range ${Math.round(range)}`);
      break;
    case 'apprentices': case 'jayjay': case 'cbjDoni':
      parts.push(`${lvl.recruits} field recruits`, `${Math.round(lvl.hp ?? 0)} base hp each`, `${Math.round(damage)} dmg`, `${Math.round((lvl.armor ?? 0) * 100)}% armor`);
      break;
    case 'barricade':
      parts.push(`holds ${lvl.holds}`, `${lvl.hp} hp`, `${Math.round(damage)} dmg`);
      break;
    case 'radiant':
      parts.push(`slow ${Math.round((lvl.slow ?? 0) * 100)}%`, `${Math.round(damage)} heat/s`, `range ${Math.round(range)}`, 'anti-freeze');
      break;
    case 'expansion':
      parts.push(`+${Math.round((lvl.dmgBuff ?? 0) * 100)}% dmg`, `+${Math.round((lvl.rangeBuff ?? 0) * 100)}% range`, `shield / ${lvl.shieldCooldown}s`, `range ${Math.round(range)}`);
      break;
    case 'pipeSnake':
      parts.push(`${Math.round(damage)} pierce`, `line ${lvl.pierce}`, `${rate}/s`);
      break;
    case 'backflow':
      parts.push(`shove ${lvl.push}px`, `${rate}/s`, `range ${Math.round(range)}`);
      break;
    case 'descaler':
      parts.push(`${Math.round(damage)} hit`, `DoT ${lvl.dot}/s`, `shred ${Math.round((lvl.shred ?? 0) * 100)}%`, `range ${Math.round(range)}`);
      break;
    case 'circulator':
      parts.push(`proj ×${lvl.projSpeed}`, `Jeff ×${lvl.jeffHaste}`, `range ${Math.round(range)}`);
      break;
    case 'prv':
      parts.push(`${Math.round(damage)} burst`, `charge ${lvl.chargeNeed}s`, `radius ${lvl.burstRadius}`);
      break;
    case 'boiler':
      parts.push(`${Math.round(damage)} heat/s`, `slow ${Math.round((lvl.slow ?? 0) * 100)}%`, `range ${Math.round(range)}`, 'anti-freeze');
      break;
    case 'hammerDrill':
      parts.push(`${Math.round(damage)} dmg`, 'bonus vs armor', `${rate}/s`, `range ${Math.round(range)}`);
      break;
    case 'glycol':
      parts.push(`${Math.round(damage)} heat/s`, `slow ${Math.round((lvl.slow ?? 0) * 100)}%`, `range ${Math.round(range)}`, 'thaw + melts ice');
      break;
    case 'sump':
      parts.push(`pull ${lvl.pull}px`, `${rate}/s`, `range ${Math.round(range)}`);
      break;
    case 'camera':
      parts.push('marks + reveals', `range ${Math.round(range)}`);
      break;
    case 'manifold':
      parts.push(`${Math.round(damage)} heat`, 'hits 3', `${rate}/s`, `range ${Math.round(range)}`);
      break;
    case 'mixingValve':
      parts.push(`slow ${Math.round((lvl.slow ?? 0) * 100)}%`, `shred ${Math.round((lvl.shred ?? 0) * 100)}%`, `range ${Math.round(range)}`, 'thaw');
      break;
    case 'airSeparator':
      parts.push(`${Math.round(damage)} vs air`, 'marks fliers', `range ${Math.round(range)}`);
      break;
    case 'thermostat':
      parts.push(`+${Math.round((lvl.rateBuff ?? 0) * 100)}% fire rate`, `range ${Math.round(range)}`);
      break;
    case 'heatExchanger':
      parts.push(`${Math.round(damage)} heat`, 'jumps once', `${rate}/s`, 'anti-freeze');
      break;
    case 'dirtSep':
      parts.push(`${Math.round(damage)} splash`, `radius ${lvl.splash}`, 'mineral bonus');
      break;
    case 'steamTrap':
      parts.push(`${Math.round(damage)} vs vapor`, `${rate}/s`, `range ${Math.round(range)}`);
      break;
    case 'zoneValve':
      parts.push('pulse stun', `${rate}/s`, `range ${Math.round(range)}`);
      break;
    default: {
      const _exhaustive: never = id;
      return _exhaustive;
    }
  }
  return parts.join(' · ');
}
