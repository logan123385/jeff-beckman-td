import { TOWERS, TOWER_ORDER } from '../../data/towers';
import type { TowerId } from '../../data/types';
import type { Game } from '../../sim/game';
import type { Tower } from '../../sim/state';
import { clear, h } from '../dom';

export interface PopoverHandlers {
  onBuild(slot: number, id: TowerId): void;
  onUpgrade(towerId: number): void;
  onSell(towerId: number): void;
  onPreview(id: TowerId | null): void;
  onClose(): void;
}

/** Build / upgrade card anchored to a slot on the canvas. */
export class Popover {
  readonly el = h('div', { class: 'popover hidden' });
  private mode: { kind: 'build'; slot: number } | { kind: 'tower'; towerId: number } | null = null;
  private lastMoney = -1;

  constructor(private readonly game: Game, private readonly handlers: PopoverHandlers) {
    this.el.addEventListener('mousedown', (e) => e.stopPropagation());
    this.el.addEventListener('contextmenu', (e) => e.preventDefault());
  }

  get isOpen(): boolean {
    return this.mode !== null;
  }

  showBuild(slot: number): void {
    this.mode = { kind: 'build', slot };
    this.rebuild();
  }

  showTower(towerId: number): void {
    this.mode = { kind: 'tower', towerId };
    this.rebuild();
  }

  hide(): void {
    this.mode = null;
    this.el.classList.add('hidden');
    this.handlers.onPreview(null);
  }

  /** Re-render when affordability may have changed; position against the current canvas size. */
  update(stage: HTMLElement, canvas: HTMLCanvasElement): void {
    if (!this.mode) return;
    if (this.mode.kind === 'tower' && !this.game.towerById(this.mode.towerId)) {
      this.hide();
      return;
    }
    if (this.game.money !== this.lastMoney) this.rebuild();
    const anchor = this.mode.kind === 'build' ? this.game.map.slots[this.mode.slot]! : this.game.towerById(this.mode.towerId)!.pos;
    const rect = canvas.getBoundingClientRect();
    const stageRect = stage.getBoundingClientRect();
    const sx = rect.width / 960;
    const sy = rect.height / 600;
    const x = rect.left - stageRect.left + anchor.x * sx;
    const y = rect.top - stageRect.top + anchor.y * sy;
    const w = this.el.offsetWidth;
    const hgt = this.el.offsetHeight;
    let left = x - w / 2;
    let top = y + 28;
    if (top + hgt > stageRect.height - 8) top = y - hgt - 34;
    left = Math.max(8, Math.min(stageRect.width - w - 8, left));
    this.el.style.left = `${left}px`;
    this.el.style.top = `${Math.max(8, top)}px`;
  }

  private rebuild(): void {
    if (!this.mode) return;
    this.lastMoney = this.game.money;
    clear(this.el);
    this.el.classList.remove('hidden');
    if (this.mode.kind === 'build') this.renderBuild(this.mode.slot);
    else {
      const t = this.game.towerById(this.mode.towerId);
      if (t) this.renderTower(t);
      else this.hide();
    }
  }

  private renderBuild(slot: number): void {
    const g = this.game;
    this.el.append(
      h('div', { class: 'pop-title' }, h('span', { text: 'Pipe node' }), h('button', { class: 'x', text: '×', onClick: () => this.handlers.onClose() })),
      h(
        'div',
        { class: 'build-list' },
        ...TOWER_ORDER.filter((id) => g.map.allowedTowers.includes(id)).map((id) => {
          const def = TOWERS[id];
          const cost = g.towerCost(id);
          const ok = g.money >= cost;
          const lvl = def.levels[0];
          return h(
            'button',
            {
              class: `build-btn ${ok ? '' : 'poor'}`,
              disabled: !ok,
              title: def.blurb,
              onMouseEnter: () => this.handlers.onPreview(id),
              onMouseLeave: () => this.handlers.onPreview(null),
              onClick: () => this.handlers.onBuild(slot, id),
            },
            h('span', { class: 'swatch', style: { background: def.color } }),
            h('span', { class: 'build-name' }, h('b', { text: def.name }), h('span', { class: 'small muted', text: ` · ${def.role}` })),
            h('span', { class: 'small muted stats', text: statLine(def.id, lvl.damage * g.mods.towerDamage, lvl.range * g.mods.towerRange, lvl.fireRate, lvl) }),
            h('span', { class: `cost ${ok ? '' : 'poor'}`, text: `$${cost}` }),
          );
        }),
      ),
    );
  }

  private renderTower(t: Tower): void {
    const g = this.game;
    const lvl = t.def.levels[t.level];
    const up = g.upgradeCost(t);
    const next = t.level < 2 ? t.def.levels[t.level + 1] : undefined;
    const parts: (HTMLElement | null)[] = [
      h(
        'div',
        { class: 'pop-title' },
        h('span', {}, h('span', { class: 'swatch', style: { background: t.def.color } }), ` ${t.def.name} `, h('span', { class: 'pill', text: `Lv ${t.level + 1}` })),
        h('button', { class: 'x', text: '×', onClick: () => this.handlers.onClose() }),
      ),
      h('div', { class: 'small muted', text: t.def.blurb }),
      h('div', { class: 'small stats', text: statLine(t.def.id, g.effectiveDamage(t), g.effectiveRange(t), lvl.fireRate, lvl) }),
      t.def.kind === 'barricade' ? h('div', { class: 'small', text: `Durability ${Math.round(t.hp)} / ${t.maxHp}${t.rebuild > 0 ? ' — rebuilding' : ''}` }) : null,
      t.frozen > 0 ? h('div', { class: 'small cold', text: `Frozen ${t.frozen.toFixed(1)}s` }) : null,
      next && up !== null
        ? h('div', { class: 'small muted', text: `Next: ${statLine(t.def.id, next.damage * g.mods.towerDamage, next.range * g.mods.towerRange, next.fireRate, next)}` })
        : null,
      h(
        'div',
        { class: 'btn-row' },
        up !== null
          ? h('button', { class: 'btn primary', text: `Upgrade $${up}`, disabled: g.money < up, onClick: () => this.handlers.onUpgrade(t.id) })
          : h('button', { class: 'btn', text: 'Max level', disabled: true }),
        h('button', { class: 'btn danger', text: `Sell $${g.sellValue(t)}`, onClick: () => this.handlers.onSell(t.id) }),
      ),
    ];
    for (const p of parts) if (p) this.el.append(p);
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
    case 'barricade':
      parts.push(`holds ${lvl.holds}`, `${lvl.hp} hp`, `${Math.round(damage)} dmg`);
      break;
    case 'radiant':
      parts.push(`slow ${Math.round((lvl.slow ?? 0) * 100)}%`, `${Math.round(damage)} heat/s`, `range ${Math.round(range)}`, 'anti-freeze');
      break;
    case 'expansion':
      parts.push(`+${Math.round((lvl.dmgBuff ?? 0) * 100)}% dmg`, `+${Math.round((lvl.rangeBuff ?? 0) * 100)}% range`, `shield / ${lvl.shieldCooldown}s`, `range ${Math.round(range)}`);
      break;
    default: {
      const _exhaustive: never = id;
      return _exhaustive;
    }
  }
  return parts.join(' · ');
}
