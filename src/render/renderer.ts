import type { Vec } from '../core/vec';
import { JEFF } from '../data/jeff';
import { WORLD_H, WORLD_W } from '../data/maps';
import { TOWERS } from '../data/towers';
import type { TowerId } from '../data/types';
import type { Game } from '../sim/game';
import type { Effect } from '../sim/state';
import { drawEnemy, drawJeff, drawTower, drawTowerBase, drawValveGate } from './sprites';

export interface RenderView {
  hoverSlot: number | null;
  selectedSlot: number | null;
  selectedTowerId: number | null;
  heroSelected: boolean;
  /** Tower being previewed on the selected slot (from the build popover hover). */
  previewTower: TowerId | null;
  mouse: Vec | null;
}

export class Renderer {
  private readonly ctx: CanvasRenderingContext2D;
  private bgCache: HTMLCanvasElement | null = null;
  private bgMapId = '';

  constructor(private readonly canvas: HTMLCanvasElement) {
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('2D canvas not supported');
    this.ctx = ctx;
  }

  resize(): void {
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    this.canvas.width = WORLD_W * dpr;
    this.canvas.height = WORLD_H * dpr;
    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  draw(game: Game, view: RenderView): void {
    const ctx = this.ctx;
    ctx.save();
    this.drawBackground(game);
    this.drawSlots(game, view);
    this.drawRangePreview(game, view);
    if (game.clamp) this.drawClamp(game);

    for (const t of game.towers) if (t.def.kind === 'barricade') drawValveGate(ctx, t);
    for (const t of game.towers) drawTower(ctx, t, game.time);

    const ground = game.enemies.filter((e) => !e.def.flying);
    const air = game.enemies.filter((e) => e.def.flying);
    for (const e of ground) drawEnemy(ctx, e, game.time);

    if (game.heroEnabled) this.drawHero(game, view);
    for (const e of air) drawEnemy(ctx, e, game.time);

    this.drawProjectiles(game);
    for (const fx of game.effects) this.drawEffect(fx);

    if (game.globalSlowTimer > 0) {
      ctx.fillStyle = `rgba(79,195,247,${0.12 * Math.min(1, game.globalSlowTimer)})`;
      ctx.fillRect(0, 0, WORLD_W, WORLD_H);
    }
    ctx.restore();
  }

  // ------------------------------------------------------------ background

  private drawBackground(game: Game): void {
    if (!this.bgCache || this.bgMapId !== game.map.id) {
      this.bgCache = this.buildBackground(game);
      this.bgMapId = game.map.id;
    }
    this.ctx.drawImage(this.bgCache, 0, 0, WORLD_W, WORLD_H);
  }

  private buildBackground(game: Game): HTMLCanvasElement {
    const c = document.createElement('canvas');
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    c.width = WORLD_W * dpr;
    c.height = WORLD_H * dpr;
    const ctx = c.getContext('2d')!;
    ctx.scale(dpr, dpr);
    const p = game.map.palette;

    ctx.fillStyle = p.bg;
    ctx.fillRect(0, 0, WORLD_W, WORLD_H);
    // floor tiles
    ctx.strokeStyle = 'rgba(255,255,255,0.035)';
    ctx.lineWidth = 1;
    for (let x = 0; x <= WORLD_W; x += 40) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, WORLD_H);
      ctx.stroke();
    }
    for (let y = 0; y <= WORLD_H; y += 40) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(WORLD_W, y);
      ctx.stroke();
    }
    // vignette
    const grad = ctx.createRadialGradient(WORLD_W / 2, WORLD_H / 2, 200, WORLD_W / 2, WORLD_H / 2, 620);
    grad.addColorStop(0, 'rgba(0,0,0,0)');
    grad.addColorStop(1, 'rgba(0,0,0,0.45)');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, WORLD_W, WORLD_H);

    // pipes
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    for (const path of game.map.paths) {
      ctx.strokeStyle = 'rgba(0,0,0,0.4)';
      ctx.lineWidth = 34;
      strokePath(ctx, path, 0, 4);
      ctx.strokeStyle = p.pipeDark;
      ctx.lineWidth = 30;
      strokePath(ctx, path, 0, 0);
      ctx.strokeStyle = p.pipe;
      ctx.lineWidth = 22;
      strokePath(ctx, path, 0, 0);
      ctx.strokeStyle = 'rgba(255,255,255,0.18)';
      ctx.lineWidth = 5;
      strokePath(ctx, path, 0, -7);
    }
    // flanges at joints
    for (const path of game.map.paths) {
      for (let i = 1; i < path.length - 1; i++) {
        const pt = path[i]!;
        ctx.fillStyle = p.pipeDark;
        ctx.beginPath();
        ctx.arc(pt.x, pt.y, 18, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = p.accent;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(pt.x, pt.y, 13, 0, Math.PI * 2);
        ctx.stroke();
        ctx.fillStyle = p.accent;
        for (let k = 0; k < 6; k++) {
          const a = (k / 6) * Math.PI * 2;
          ctx.beginPath();
          ctx.arc(pt.x + Math.cos(a) * 15, pt.y + Math.sin(a) * 15, 1.6, 0, Math.PI * 2);
          ctx.fill();
        }
      }
      // entry / exit markers
      const start = path[0]!;
      const end = path[path.length - 1]!;
      drawMarker(ctx, start, '#ef5350', 'IN');
      drawMarker(ctx, end, '#66bb6a', 'OUT');
    }
    return c;
  }

  // ------------------------------------------------------------ slots / previews

  private drawSlots(game: Game, view: RenderView): void {
    const ctx = this.ctx;
    game.map.slots.forEach((s, i) => {
      if (game.towerAt(i)) return;
      const hot = view.hoverSlot === i || view.selectedSlot === i;
      ctx.save();
      ctx.fillStyle = hot ? 'rgba(255,224,130,0.25)' : 'rgba(255,255,255,0.06)';
      ctx.strokeStyle = hot ? '#ffe082' : 'rgba(255,255,255,0.25)';
      ctx.lineWidth = hot ? 2 : 1.5;
      ctx.setLineDash(hot ? [] : [4, 4]);
      ctx.beginPath();
      ctx.ellipse(s.x, s.y + 4, 18, 11, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      ctx.setLineDash([]);
      // pipe stub
      ctx.fillStyle = hot ? '#ffe082' : 'rgba(255,255,255,0.3)';
      ctx.fillRect(s.x - 3, s.y - 6, 6, 8);
      ctx.restore();
    });
  }

  private drawRangePreview(game: Game, view: RenderView): void {
    const ctx = this.ctx;
    const drawRange = (pos: Vec, r: number, color: string) => {
      ctx.save();
      ctx.fillStyle = color.replace('ALPHA', '0.08');
      ctx.strokeStyle = color.replace('ALPHA', '0.5');
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.arc(pos.x, pos.y, r, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      ctx.restore();
    };
    if (view.selectedTowerId !== null) {
      const t = game.towerById(view.selectedTowerId);
      if (t) {
        const center = t.def.kind === 'barricade' ? t.rally : t.pos;
        drawRange(center, t.def.kind === 'barricade' ? t.def.levels[t.level].range : game.effectiveRange(t), 'rgba(255,255,255,ALPHA)');
      }
    }
    if (view.selectedSlot !== null && view.previewTower) {
      const def = TOWERS[view.previewTower];
      const pos = game.map.slots[view.selectedSlot]!;
      const center = def.kind === 'barricade' ? game.nearestPathPoint(pos) : pos;
      drawRange(center, def.levels[0].range * game.mods.towerRange, 'rgba(255,224,130,ALPHA)');
      ctx.save();
      ctx.globalAlpha = 0.5;
      drawTowerBase(ctx, pos.x, pos.y, def.color);
      ctx.restore();
    }
    if (view.heroSelected && game.heroEnabled && game.hero.downed <= 0) {
      drawRange(game.hero.anchor, JEFF.aggro, 'rgba(165,214,167,ALPHA)');
    }
  }

  private drawClamp(game: Game): void {
    const c = game.clamp!;
    const ctx = this.ctx;
    ctx.save();
    ctx.globalAlpha = Math.min(1, c.timeLeft);
    ctx.fillStyle = 'rgba(231,76,60,0.18)';
    ctx.strokeStyle = '#e74c3c';
    ctx.lineWidth = 3;
    ctx.setLineDash([6, 4]);
    ctx.beginPath();
    ctx.arc(c.pos.x, c.pos.y, JEFF.clamp.radius, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.setLineDash([]);
    // clamp jaws
    ctx.lineWidth = 5;
    ctx.beginPath();
    ctx.arc(c.pos.x, c.pos.y, JEFF.clamp.radius - 8, -0.5, 0.5);
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(c.pos.x, c.pos.y, JEFF.clamp.radius - 8, Math.PI - 0.5, Math.PI + 0.5);
    ctx.stroke();
    ctx.restore();
  }

  private drawHero(game: Game, view: RenderView): void {
    const ctx = this.ctx;
    const h = game.hero;
    if (h.dest) {
      ctx.save();
      ctx.strokeStyle = 'rgba(165,214,167,0.8)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(h.dest.x, h.dest.y, 8 + Math.sin(game.time * 8) * 2, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    }
    if (view.heroSelected) {
      ctx.save();
      ctx.strokeStyle = '#a5d6a7';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.ellipse(h.pos.x, h.pos.y + 20, 16, 7, 0, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    }
    drawJeff(ctx, h, game.time);
  }

  private drawProjectiles(game: Game): void {
    const ctx = this.ctx;
    for (const p of game.projectiles) {
      ctx.fillStyle = p.color;
      ctx.beginPath();
      ctx.arc(p.pos.x, p.pos.y, p.splash > 0 ? 5 : 3, 0, Math.PI * 2);
      ctx.fill();
      if (p.splash > 0) {
        ctx.fillStyle = 'rgba(255,255,255,0.6)';
        ctx.beginPath();
        ctx.arc(p.pos.x - 1.5, p.pos.y - 1.5, 1.8, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  }

  private drawEffect(fx: Effect): void {
    const ctx = this.ctx;
    const k = fx.ttl / fx.max;
    ctx.save();
    switch (fx.kind) {
      case 'beam':
        ctx.globalAlpha = k;
        ctx.strokeStyle = fx.color;
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.moveTo(fx.from.x, fx.from.y - 14);
        ctx.lineTo(fx.to.x, fx.to.y);
        ctx.stroke();
        ctx.strokeStyle = '#fff';
        ctx.lineWidth = 1;
        ctx.stroke();
        break;
      case 'hit':
        ctx.globalAlpha = k;
        ctx.fillStyle = fx.color;
        ctx.beginPath();
        ctx.arc(fx.pos.x, fx.pos.y, 4 + (1 - k) * 6, 0, Math.PI * 2);
        ctx.fill();
        break;
      case 'splash':
        ctx.globalAlpha = k * 0.7;
        ctx.strokeStyle = fx.color;
        ctx.fillStyle = fx.color;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(fx.pos.x, fx.pos.y, fx.radius * (1 - k * 0.5), 0, Math.PI * 2);
        ctx.stroke();
        ctx.globalAlpha = k * 0.25;
        ctx.fill();
        break;
      case 'ring':
        ctx.globalAlpha = k;
        ctx.strokeStyle = fx.color;
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.arc(fx.pos.x, fx.pos.y, fx.radius * (1 - k * 0.6), 0, Math.PI * 2);
        ctx.stroke();
        break;
      case 'text':
        ctx.globalAlpha = Math.min(1, k * 2);
        ctx.fillStyle = fx.color;
        ctx.font = 'bold 12px system-ui, sans-serif';
        ctx.textAlign = 'center';
        ctx.lineWidth = 3;
        ctx.strokeStyle = 'rgba(0,0,0,0.7)';
        ctx.strokeText(fx.text, fx.pos.x, fx.pos.y - (1 - k) * 18);
        ctx.fillText(fx.text, fx.pos.x, fx.pos.y - (1 - k) * 18);
        break;
      default: {
        const _exhaustive: never = fx;
        return _exhaustive;
      }
    }
    ctx.restore();
  }
}

function strokePath(ctx: CanvasRenderingContext2D, pts: readonly Vec[], dx: number, dy: number): void {
  ctx.beginPath();
  pts.forEach((p, i) => (i === 0 ? ctx.moveTo(p.x + dx, p.y + dy) : ctx.lineTo(p.x + dx, p.y + dy)));
  ctx.stroke();
}

function drawMarker(ctx: CanvasRenderingContext2D, p: Vec, color: string, label: string): void {
  const x = Math.max(24, Math.min(WORLD_W - 24, p.x));
  const y = Math.max(24, Math.min(WORLD_H - 24, p.y));
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.arc(x, y, 9, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#fff';
  ctx.font = 'bold 8px system-ui, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(label, x, y + 0.5);
  ctx.textBaseline = 'alphabetic';
}
