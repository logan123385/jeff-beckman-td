import { drawHeroAura, drawHeroMissiles, drawHeroNotice, drawHeroVisuals, drawHeroZones, drawLogan } from './heroActors';
import { dist, type Vec } from '../core/vec';
import { JEFF } from '../data/jeff';
import { WORLD_H, WORLD_W } from '../data/maps';
import { TOWERS } from '../data/towers';
import type { TowerId } from '../data/types';
import { AIM_LABEL, scaledCastRange } from '../sim/combat';
import type { AbilitySlot } from '../data/heroes';
import type { Game } from '../sim/game';
import type { Effect, JeffSkillId } from '../sim/state';
import { blotch, CANVAS_UI, disc, filmGrain, glow, lampCone, noGlow, pulseRing, radial, rgba, stampText, vignette } from './ink';
import { drawBuildPad, drawEnemy, drawJeff, drawTower, drawTowerBase, drawValveGate } from './sprites';
import { paintAtmosphere, paintForeground, paintPipeFlow, paintYard } from './yard';
import { paintedCrew, paintedFriendly } from './paintedActors';
import { ENEMY_ART, paintedSprite } from './art';

interface Spark {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  max: number;
  r: number;
  color: string;
  g: number;
  /** 0 disc, 1 streak, 2 bead, 3 gold coin homing to the HUD */
  shape: 0 | 1 | 2 | 3;
  hx?: number;
  hy?: number;
}

export interface RenderView {
  hoverSlot: number | null;
  selectedSlot: number | null;
  selectedTowerId: number | null;
  heroSelected: boolean;
  /** Tower being previewed on the selected slot (from the build popover hover). */
  previewTower: TowerId | null;
  mouse: Vec | null;
  /** Enemy under the cursor for Diablo-style attack aim. */
  hoverEnemyId: number | null;
  targeting?: 'crew' | 'rally' | 'strike' | 'ability' | 'deploy' | null;
  /** Slot of a click-to-cast hero skill while `targeting === 'ability'`. */
  abilitySlot?: number | null;
  /** Tower currently armed in the persistent tray (sticky place). */
  armed?: TowerId | null;
  /** 0..1 leftover toward the next sim tick. */
  interp?: number;
}

export class Renderer {
  private readonly ctx: CanvasRenderingContext2D;
  private bgCache: HTMLCanvasElement | null = null;
  private fgCache: HTMLCanvasElement | null = null;
  private bgMapId = '';
  private sparks: Spark[] = [];
  private seededFx = new WeakSet<object>();
  private lastSparkTime = 0;
  private fxTime = 0;
  private trauma = 0;
  private shakeSeed = 0;
  private lastLives = -1;
  private hurt = 0;
  private lastDrawTime = 0;
  private interp = 1;
  private readonly reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  constructor(private readonly canvas: HTMLCanvasElement) {
    const ctx = canvas.getContext('2d', { alpha: false });
    if (!ctx) throw new Error('2D canvas not supported');
    this.ctx = ctx;
  }

  resize(): void {
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const width = Math.round(WORLD_W * dpr);
    const height = Math.round(WORLD_H * dpr);
    if (this.canvas.width === width && this.canvas.height === height) return;
    this.canvas.width = width;
    this.canvas.height = height;
    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    this.bgCache = null;
    this.fgCache = null;
  }

  draw(game: Game, view: RenderView): void {
    const ctx = this.ctx;
    this.fxTime = game.time;
    this.interp = view.interp ?? 1;
    ctx.save();
    const shake = this.trauma * this.trauma;
    if (shake > 0.004) {
      this.shakeSeed += 1;
      const dx = Math.sin(this.shakeSeed * 12.9898 + this.fxTime * 18) * shake * 11;
      const dy = Math.cos(this.shakeSeed * 78.233 + this.fxTime * 14) * shake * 9;
      ctx.translate(dx, dy);
      ctx.rotate(shake * 0.012 * Math.sin(this.shakeSeed));
    }
    this.drawBackground(game);
    paintPipeFlow(ctx, game.map.paths, game.time, game.map.palette.pipe);
    this.drawEntrances(game);
    this.drawWaveWarning(game);
    paintAtmosphere(ctx, game.map, game.time);
    this.drawAmbient(game);
    this.drawLights(game);
    this.drawSlots(game, view);
    this.drawRangePreview(game, view);
    this.drawTargeting(game, view);
    if (game.clamp) this.drawClamp(game);
    drawHeroZones(ctx, game);
    drawHeroAura(ctx, game, view.heroSelected);
    this.drawHeroGround(game, view);
    this.drawHeroCombat(game, view);
    this.drawHeroAuras(game);
    this.drawActors(game);
    this.drawProjectiles(game);
    drawHeroMissiles(ctx, game);
    drawHeroVisuals(ctx, game);
    for (const fx of game.effects) {
      this.seedSparks(fx);
      if (fx.kind !== 'skill') this.drawEffect(fx);
    }
    this.tickSparks(game.time);
    this.drawSparks();
    this.drawMuzzleFlashes(game);
    this.drawStrikes(game, view);
    this.drawForeground(game);
    if (game.globalSlowTimer > 0) this.drawShutoffHud(game);
    for (const fx of game.effects) {
      if (fx.kind === 'skill') this.drawEffect(fx);
    }
    // living film + edge vignette so the stage reads like a lit diorama
    filmGrain(ctx, WORLD_W, WORLD_H, Math.floor(game.time * 8), 0.012);
    vignette(ctx, WORLD_W, WORLD_H, game.map.id === 'serviceCall' ? 0.2 : 0.08);
    this.drawHurtFlash(game);
    this.drawLowLives(game);
    this.drawSkillNotice(game);
    drawHeroNotice(ctx, game);
    ctx.restore();
    if (this.trauma * this.trauma > 0.004) {
      ctx.save();
      ctx.strokeStyle = '#0a0908';
      ctx.lineWidth = this.trauma * 8 + 2;
      ctx.strokeRect(0, 0, WORLD_W, WORLD_H);
      ctx.restore();
    }
  }

  /** Nudge the camera; decays each frame. */
  private kick(amount: number): void {
    if (this.reducedMotion) return;
    this.trauma = Math.min(1, this.trauma + amount / 14);
  }

  /** Brass pulse along the pipes that the next wave will actually use. */
  private drawWaveWarning(game: Game): void {
    if (game.allWavesStarted) return;
    const preview = game.nextWavePreview();
    const hot = new Set(preview.map((p) => p.path));
    if (hot.size === 0) return;
    const imminent = game.waveCountdown > 0 && game.waveCountdown <= 4.5 && !(game.endless && game.waveActive);
    const briefing = !game.waveActive && game.waveCountdown > 0;
    if (!imminent && !briefing) return;
    const ctx = this.ctx;
    const urgency = imminent ? 1 - game.waveCountdown / 4.5 : 0.16;
    const pulse = 0.35 + Math.sin(game.time * (imminent ? 6 + urgency * 8 : 2.2)) * 0.5 + 0.5;
    ctx.save();
    ctx.globalAlpha = (briefing ? 0.12 : 0.08) + urgency * 0.5 * pulse;
    ctx.strokeStyle = urgency > 0.65 ? '#ff8a65' : '#ffd27a';
    ctx.lineWidth = (briefing ? 5 : 6) + urgency * 7;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    glow(ctx, urgency > 0.65 ? '#ff7043' : '#ffd27a', 14);
    game.map.paths.forEach((path, i) => {
      if (!hot.has(i) || path.length === 0) return;
      ctx.beginPath();
      path.forEach((pt, n) => (n === 0 ? ctx.moveTo(pt.x, pt.y) : ctx.lineTo(pt.x, pt.y)));
      ctx.stroke();
    });
    noGlow(ctx);
    ctx.restore();
  }

  /** Lane chevrons so dual-path maps read like Kingdom Rush. */
  private drawEntrances(game: Game): void {
    if (game.allWavesStarted && !game.waveActive) return;
    const ctx = this.ctx;
    const preview = game.nextWavePreview();
    const hot = new Set(preview.map((p) => p.path));
    const urgent = !game.allWavesStarted && game.waveCountdown >= 0 && game.waveCountdown < 5.5;
    ctx.save();
    game.map.paths.forEach((path, i) => {
      if (path.length < 2) return;
      const a = path[0]!;
      const b = path[1]!;
      const dx = b.x - a.x;
      const dy = b.y - a.y;
      const len = Math.hypot(dx, dy) || 1;
      const ux = dx / len;
      const uy = dy / len;
      const pulse = 0.55 + Math.sin(game.time * (urgent && hot.has(i) ? 8 : 3) + i) * 0.25;
      ctx.globalAlpha = (hot.has(i) ? 0.85 : 0.35) * pulse;
      ctx.fillStyle = urgent && hot.has(i) ? '#ff8a65' : '#ffe082';
      ctx.strokeStyle = '#1a1208';
      ctx.lineWidth = 2;
      const x = a.x + ux * 18;
      const y = a.y + uy * 18;
      ctx.beginPath();
      ctx.moveTo(x + ux * 14, y + uy * 14);
      ctx.lineTo(x - uy * 10 - ux * 4, y + ux * 10 - uy * 4);
      ctx.lineTo(x + uy * 10 - ux * 4, y - ux * 10 - uy * 4);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      if (hot.has(i)) stampText(ctx, `IN ${i + 1}`, x - uy * 18, y + ux * 18, { size: 10, color: '#ffe082' });
    });
    ctx.restore();
  }

  private drawHurtFlash(game: Game): void {
    const dt = this.lastDrawTime === 0 ? 0 : Math.min(0.05, Math.max(0, game.time - this.lastDrawTime));
    this.lastDrawTime = game.time;
    if (this.lastLives >= 0 && game.lives < this.lastLives) {
      this.kick(11);
      this.hurt = 0.72;
    }
    this.lastLives = game.lives;
    if (this.hurt <= 0) return;
    this.hurt = Math.max(0, this.hurt - dt * 1.6);
    const ctx = this.ctx;
    ctx.save();
    ctx.globalAlpha = this.hurt * 0.55;
    const g = ctx.createRadialGradient(WORLD_W / 2, WORLD_H / 2, WORLD_W * 0.2, WORLD_W / 2, WORLD_H / 2, WORLD_W * 0.72);
    g.addColorStop(0, 'rgba(180, 20, 12, 0)');
    g.addColorStop(1, 'rgba(160, 16, 10, 1)');
    ctx.fillStyle = g;
    ctx.fillRect(-20, -20, WORLD_W + 40, WORLD_H + 40);
    ctx.restore();
  }

  /** Soft red edge when the job is one or two leaks from a callback. */
  private drawLowLives(game: Game): void {
    if (game.remaster === 'frozenMain') return;
    if (game.lives <= 0 || game.lives > 2 || game.map.lives <= 3) return;
    const ctx = this.ctx;
    const pulse = 0.22 + Math.sin(game.time * (game.lives === 1 ? 6 : 3.2)) * 0.08;
    ctx.save();
    ctx.globalAlpha = pulse;
    const g = ctx.createRadialGradient(WORLD_W / 2, WORLD_H / 2, WORLD_W * 0.28, WORLD_W / 2, WORLD_H / 2, WORLD_W * 0.72);
    g.addColorStop(0, 'rgba(120, 16, 10, 0)');
    g.addColorStop(1, 'rgba(140, 24, 16, 0.85)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, WORLD_W, WORLD_H);
    ctx.restore();
  }

  // ------------------------------------------------------------ background

  private drawBackground(game: Game): void {
    if (!this.bgCache || this.bgMapId !== game.map.id) {
      this.bgCache = this.buildLayer((c) => paintYard(c, game.map));
      this.fgCache = this.buildLayer((c) => paintForeground(c, game.map));
      this.bgMapId = game.map.id;
    }
    this.ctx.drawImage(this.bgCache, 0, 0, WORLD_W, WORLD_H);
  }

  private drawForeground(game: Game): void {
    if (!this.fgCache || this.bgMapId !== game.map.id) {
      this.fgCache = this.buildLayer((c) => paintForeground(c, game.map));
    }
    this.ctx.drawImage(this.fgCache, 0, 0, WORLD_W, WORLD_H);
  }

  private buildLayer(paint: (ctx: CanvasRenderingContext2D) => void): HTMLCanvasElement {
    const c = document.createElement('canvas');
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    c.width = WORLD_W * dpr;
    c.height = WORLD_H * dpr;
    const ctx = c.getContext('2d')!;
    ctx.scale(dpr, dpr);
    paint(ctx);
    return c;
  }


  private drawAmbient(game: Game): void {
    const ctx = this.ctx;
    ctx.save();
    const snow = game.map.id === 'snowmelt';
    const embers = game.map.id === 'heatPlant' || game.map.id === 'mechanicalRoom';
    const night = game.map.id === 'serviceCall';
    const n = night ? 42 : snow ? 36 : embers ? 32 : 24;
    for (let i = 0; i < n; i++) {
      const speed = snow ? 18 + (i % 5) * 4 : 12 + (i % 6);
      const drift = (game.time * speed + i * 40) % (WORLD_W + 40);
      const sway = Math.sin(game.time * 1.4 + i) * (snow ? 10 : 5);
      const baseY = 24 + ((i * 73) % (WORLD_H - 50));
      const y = embers ? (baseY - game.time * 16 * (1 + (i % 3) * 0.3)) % WORLD_H + (baseY < 0 ? WORLD_H : 0) : baseY + sway;
      const a = 0.16 + Math.sin(game.time * 2 + i) * 0.08;
      ctx.fillStyle = snow
        ? `rgba(224,247,250,${a + 0.16})`
        : embers
          ? `rgba(255,${138 + (i % 3) * 30},64,${a + 0.12})`
          : `rgba(255,236,179,${a})`;
      const py = ((y % WORLD_H) + WORLD_H) % WORLD_H;
      ctx.beginPath();
      ctx.arc(drift - 20, py, snow ? 3 : embers ? 1.8 + (i % 2) : 2, 0, Math.PI * 2);
      ctx.fill();
      if (snow && i % 3 === 0) {
        ctx.fillStyle = `rgba(255,255,255,${a * 0.5})`;
        ctx.beginPath();
        ctx.arc(drift - 18, py - 1, 1.2, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    // work-lamp cones for crawlspace / attic feel
    if (game.map.id === 'crawlspace' || game.map.id === 'attic') {
      for (const x of [180, 520, 780]) {
        lampCone(ctx, x, 8, 160, 0.1 + Math.sin(game.time * 0.8 + x) * 0.02);
      }
    }
    // slow light sweep across the yard
    const sweepX = WORLD_W / 2 + Math.sin(game.time * 0.35) * WORLD_W * 0.42;
    const g = ctx.createLinearGradient(sweepX - 180, 0, sweepX + 180, 0);
    g.addColorStop(0, 'rgba(255,224,130,0)');
    g.addColorStop(0.5, 'rgba(255,224,130,0.11)');
    g.addColorStop(1, 'rgba(255,224,130,0)');
    ctx.fillStyle = g;
    ctx.fillRect(sweepX - 180, 0, 360, WORLD_H);
    // live bulb flicker for maps with hanging lights
    if (game.map.id === 'crawlspace' || game.map.id === 'attic' || game.map.id === 'serviceCall') {
      const flicker = 0.85 + Math.sin(game.time * 11) * 0.08 + Math.sin(game.time * 27) * 0.04;
      for (const x of [160, 480, 800]) {
        radial(ctx, x, 28, 4, 90 * flicker, '#ffe082', 0.1 * flicker);
      }
    }
    ctx.restore();
  }

  private drawLights(game: Game): void {
    const ctx = this.ctx;
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    for (const t of game.towers) {
      const hot = t.recoil > 0 || t.frozen > 0 || t.def.kind === 'aura';
      if (!hot) continue;
      const peak = t.recoil > 0 ? 0.38 : t.frozen > 0 ? 0.16 : 0.14;
      radial(ctx, t.pos.x, t.pos.y - 10, 6, t.recoil > 0 ? 70 : 48, t.frozen > 0 ? '#81d4fa' : t.def.color, peak);
    }
    if (game.heroEnabled && game.hero.deployed && game.hero.downed <= 0) {
      const h = game.hero;
      const swing = h.swing;
      radial(ctx, h.pos.x, h.pos.y - 8, 4, swing > 0 ? 56 : 28, swing > 0 ? '#ffe082' : '#a5d6a7', swing > 0 ? 0.32 : 0.1);
      if (h.sleeveTimer > 0) radial(ctx, h.pos.x, h.pos.y - 6, 6, 54, '#a1887f', 0.28);
      if (h.coffeeTimer > 0) radial(ctx, h.pos.x, h.pos.y - 10, 6, 60, '#ffe082', 0.3);
    }
    ctx.restore();
  }

  private drawMuzzleFlashes(game: Game): void {
    const ctx = this.ctx;
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    for (const t of game.towers) {
      if (t.recoil <= 0 || t.def.kind !== 'shooter') continue;
      const x = t.pos.x + Math.cos(t.facing) * 22;
      const y = t.pos.y - 12 + Math.sin(t.facing) * 22;
      radial(ctx, x, y, 1, 26, '#fff8e1', 0.72 * t.recoil * 8);
      radial(ctx, x, y, 1, 42, t.def.color, 0.5 * t.recoil * 8);
      radial(ctx, x, y, 1, 16, '#c9a15b', 0.35 * t.recoil * 8);
      ctx.strokeStyle = rgba('#fffde7', Math.min(0.8, t.recoil * 6));
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(x + Math.cos(t.facing) * 18, y + Math.sin(t.facing) * 18);
      ctx.stroke();
    }
    ctx.restore();
  }

  // ------------------------------------------------------------ slots / previews

  private drawSlots(game: Game, view: RenderView): void {
    const ctx = this.ctx;
    game.map.slots.forEach((s, i) => {
      if (game.towerAt(i)) return;
      const hot = view.hoverSlot === i || view.selectedSlot === i;
      drawBuildPad(ctx, s.x, s.y, hot, game.map.palette.pipe, game.time);
      if (view.armed && !hot) {
        pulseRing(ctx, s.x, s.y + 2, 22 + Math.sin(game.time * 3) * 1.5, '#9ccc8a', 0.28, 1.3);
      }
    });
  }

  private drawRangePreview(game: Game, view: RenderView): void {
    const ctx = this.ctx;
    const drawRange = (pos: Vec, r: number, color: string) => {
      ctx.save();
      const g = ctx.createRadialGradient(pos.x, pos.y, r * 0.15, pos.x, pos.y, r);
      g.addColorStop(0, color.replace('ALPHA', '0.16'));
      g.addColorStop(1, color.replace('ALPHA', '0.03'));
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(pos.x, pos.y, r, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = color.replace('ALPHA', '0.7');
      ctx.lineWidth = 2;
      ctx.setLineDash([7, 6]);
      ctx.lineDashOffset = -game.time * 28;
      ctx.stroke();
      ctx.restore();
    };
    if (view.selectedTowerId !== null) {
      const t = game.towerById(view.selectedTowerId);
      if (t) {
        const center = t.def.kind === 'barricade' ? t.rally : t.pos;
        drawRange(center, t.def.kind === 'barricade' ? t.def.levels[t.level]!.range : game.effectiveRange(t), 'rgba(255,255,255,ALPHA)');
        if (t.def.kind === 'shooter') {
          stampText(ctx, AIM_LABEL[t.aim], center.x, center.y - 28, { size: 13, color: '#ffe082' });
          const prey = t.lastTargetId ? game.enemies.find((e) => e.id === t.lastTargetId && !e.dead && !e.escaped) : null;
          if (prey) {
            ctx.save();
            ctx.strokeStyle = 'rgba(255, 224, 130, 0.55)';
            ctx.lineWidth = 1.8;
            ctx.setLineDash([5, 6]);
            ctx.lineDashOffset = -game.time * 40;
            ctx.beginPath();
            ctx.moveTo(t.pos.x, t.pos.y - 16);
            ctx.lineTo(prey.pos.x, prey.pos.y);
            ctx.stroke();
            ctx.setLineDash([]);
            ctx.strokeStyle = 'rgba(255, 224, 130, 0.85)';
            ctx.beginPath();
            ctx.arc(prey.pos.x, prey.pos.y, prey.def.radius + 8 + Math.sin(game.time * 8) * 2, 0, Math.PI * 2);
            ctx.stroke();
            ctx.restore();
          }
        }
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
    const ghostSlot = view.armed && view.hoverSlot !== null && !game.towerAt(view.hoverSlot) ? view.hoverSlot : null;
    if (ghostSlot !== null && !(view.selectedSlot === ghostSlot && view.previewTower)) {
      const def = TOWERS[view.armed!];
      const pos = game.map.slots[ghostSlot]!;
      const center = def.kind === 'barricade' ? game.nearestPathPoint(pos) : pos;
      drawRange(center, def.levels[0].range * game.mods.towerRange, 'rgba(156,204,138,ALPHA)');
      ctx.save();
      ctx.globalAlpha = 0.45;
      drawTowerBase(ctx, pos.x, pos.y, def.color);
      ctx.restore();
    }
    if (view.heroSelected && game.heroEnabled && game.hero.deployed && game.hero.downed <= 0 && view.targeting !== 'ability' && view.targeting !== 'deploy') {
      drawRange(game.hero.pos, game.heroDef.reach * game.mods.jeffReach, 'rgba(255,236,179,ALPHA)');
    }
    if (view.selectedTowerId === null && view.selectedSlot === null && view.mouse) {
      let hover: (typeof game.towers)[number] | null = null;
      let best = 36;
      for (const t of game.towers) {
        const d = dist(view.mouse, t.def.kind === 'barricade' ? t.rally : t.pos);
        if (d < best) {
          best = d;
          hover = t;
        }
      }
      if (hover) {
        const center = hover.def.kind === 'barricade' ? hover.rally : hover.pos;
        const range = hover.def.kind === 'barricade' ? hover.def.levels[hover.level]!.range : game.effectiveRange(hover);
        drawRange(center, range, 'rgba(255,236,200,ALPHA)');
      }
    }
  }

  private drawClamp(game: Game): void {
    const c = game.clamp!;
    const ctx = this.ctx;
    const pulse = 0.82 + Math.sin(game.time * 8) * 0.18;
    const r = game.clampRadius();
    ctx.save();
    ctx.globalAlpha = Math.min(1, c.timeLeft) * pulse;
    glow(ctx, '#e74c3c', 22);
    ctx.fillStyle = 'rgba(231,76,60,0.28)';
    ctx.beginPath();
    ctx.arc(c.pos.x, c.pos.y, r, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#ff8a80';
    ctx.lineWidth = 5;
    ctx.stroke();
    noGlow(ctx);
    ctx.setLineDash([8, 7]);
    ctx.lineDashOffset = -game.time * 36;
    ctx.strokeStyle = '#fff59d';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(c.pos.x, c.pos.y, r - 7, 0, Math.PI * 2);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.lineWidth = 9;
    ctx.lineCap = 'round';
    ctx.strokeStyle = '#b71c1c';
    ctx.beginPath();
    ctx.arc(c.pos.x, c.pos.y, r - 4, -0.7, 0.7);
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(c.pos.x, c.pos.y, r - 4, Math.PI - 0.7, Math.PI + 0.7);
    ctx.stroke();
    ctx.strokeStyle = '#ffcdd2';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(c.pos.x, c.pos.y, r - 4, -0.55, 0.55);
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(c.pos.x, c.pos.y, r - 4, Math.PI - 0.55, Math.PI + 0.55);
    ctx.stroke();
    for (let i = 0; i < 6; i++) {
      const a = game.time * 1.6 + (i / 6) * Math.PI * 2;
      disc(ctx, c.pos.x + Math.cos(a) * (r - 16), c.pos.y + Math.sin(a) * (r - 16), 3.2, '#ffcdd2');
    }
    ctx.restore();
  }

  private drawHeroAuras(game: Game): void {
    if (!game.heroEnabled || !game.hero.deployed || game.hero.downed > 0) return;
    const ctx = this.ctx;
    const h = game.hero;
    if (h.sleeveTimer > 0) {
      ctx.save();
      const k = Math.min(1, h.sleeveTimer);
      ctx.globalAlpha = 0.55 + 0.35 * k;
      glow(ctx, '#8d6e63', 16);
      for (let i = 0; i < 3; i++) {
        const a = game.time * (1.8 + i * 0.4) + i;
        ctx.strokeStyle = i % 2 === 0 ? '#6d4c41' : '#d7ccc8';
        ctx.lineWidth = 4 - i;
        ctx.setLineDash([7, 5]);
        ctx.lineDashOffset = -game.time * (24 + i * 10);
        ctx.beginPath();
        ctx.ellipse(h.pos.x, h.pos.y + 4, 22 + i * 7, 12 + i * 4, a * 0.15, 0, Math.PI * 2);
        ctx.stroke();
      }
      noGlow(ctx);
      ctx.setLineDash([]);
      ctx.restore();
    }
    if (h.coffeeTimer > 0) {
      ctx.save();
      const k = Math.min(1, h.coffeeTimer);
      ctx.globalAlpha = 0.7 * k + 0.3;
      glow(ctx, '#ffe082', 14);
      ctx.strokeStyle = '#ffe082';
      ctx.lineWidth = 3;
      for (let i = 0; i < 5; i++) {
        const y = h.pos.y - 8 + ((game.time * 90 + i * 18) % 40) - 20;
        const x = h.pos.x - h.facing * (16 + i * 5);
        ctx.globalAlpha = 0.35 + (i % 2) * 0.2;
        ctx.beginPath();
        ctx.moveTo(x, y);
        ctx.lineTo(x - h.facing * 16, y + 3);
        ctx.stroke();
      }
      noGlow(ctx);
      ctx.globalAlpha = 0.85;
      for (let i = 0; i < 4; i++) {
        const a = game.time * 2.4 + i * 1.1;
        blotch(ctx, h.pos.x - 6 + i * 5, h.pos.y - 52 - Math.sin(a) * 6, 4, 6.5, 0.15, rgba('#ffe0b2', 0.4));
      }
      ctx.restore();
    }
  }

  private drawShutoffHud(game: Game): void {
    const ctx = this.ctx;
    const k = Math.min(1, game.globalSlowTimer);
    ctx.save();
    ctx.fillStyle = `rgba(3, 32, 52, ${0.10 * k})`;
    ctx.fillRect(0, 0, WORLD_W, WORLD_H);
    ctx.fillStyle = `rgba(79,195,247,${0.035 * k})`;
    ctx.fillRect(0, 0, WORLD_W, WORLD_H);
    ctx.strokeStyle = `rgba(179,229,252,${0.55 * k})`;
    ctx.lineWidth = 3;
    ctx.setLineDash([12, 9]);
    ctx.lineDashOffset = -game.time * 50;
    ctx.strokeRect(8, 8, WORLD_W - 16, WORLD_H - 16);
    ctx.setLineDash([4, 10]);
    ctx.lineWidth = 2.4;
    ctx.strokeStyle = `rgba(255,255,255,${0.35 * k})`;
    ctx.strokeRect(18, 18, WORLD_W - 36, WORLD_H - 36);
    ctx.setLineDash([]);
    const corners: Vec[] = [
      { x: 46, y: 46 },
      { x: WORLD_W - 46, y: 46 },
      { x: 46, y: WORLD_H - 46 },
      { x: WORLD_W - 46, y: WORLD_H - 46 },
    ];
    for (const p of corners) this.drawValveGlyph(p.x, p.y, 14, k * 0.7, game.time);
    ctx.restore();
  }

  private drawValveGlyph(x: number, y: number, r: number, k: number, time: number): void {
    const ctx = this.ctx;
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(time * 1.4);
    ctx.globalAlpha = 0.55 + 0.45 * k;
    ctx.strokeStyle = '#e1f5fe';
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.arc(0, 0, r, 0, Math.PI * 2);
    ctx.stroke();
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(-r, 0);
    ctx.lineTo(r, 0);
    ctx.moveTo(0, -r);
    ctx.lineTo(0, r);
    ctx.stroke();
    disc(ctx, 0, 0, 4, '#4fc3f7');
    ctx.restore();
  }

  private drawActors(game: Game): void {
    const ctx = this.ctx;
    const a = this.interp;
    const items: { y: number; z: number; draw: () => void }[] = [];
    const slide = (pos: Vec, prev: Vec | undefined): Vec => {
      if (!prev || a >= 0.995) return pos;
      return { x: prev.x + (pos.x - prev.x) * a, y: prev.y + (pos.y - prev.y) * a };
    };
    for (const t of game.towers) {
      if (t.drawFacing === undefined) t.drawFacing = t.facing;
      let d = t.facing - t.drawFacing;
      while (d > Math.PI) d -= Math.PI * 2;
      while (d < -Math.PI) d += Math.PI * 2;
      t.drawFacing += d * 0.18;
      if (t.def.kind === 'barricade' && !t.def.recruits) {
        items.push({ y: t.rally.y, z: 0, draw: () => {
          if (t.rebuild > 0) { drawValveGate(ctx, t); return; }
          for (let i = 0; i < Math.min(3, t.level + 2); i++) paintedCrew(ctx, { x: t.rally.x + (i - (Math.min(3, t.level + 2) - 1) / 2) * 20, y: t.rally.y + (i % 2) * 7 }, game.time, t.recoil, 1, t.hp / t.maxHp);
        } });
      }
      items.push({ y: t.pos.y, z: 1, draw: () => drawTower(ctx, t, game.time) });
    }
    for (const e of game.enemies) {
      const vis = slide(e.pos, e.prev);
      let dir = game.paths[e.pathIdx]?.directionAt(e.progress);
      const hold=e.heldBy;
      const opponent=hold?.kind==='friendly'?game.friendlies.find(f=>f.id===hold.id)?.pos:hold?.kind==='crew'?game.crew.find(f=>f.id===hold.id)?.pos:hold?.kind==='summon'?game.heroSummons.find(s=>s.id===hold.id)?.pos:hold?.kind==='hero'?game.hero.pos:hold?.kind==='tower'?game.towerById(hold.id)?.rally:null;
      if(opponent)dir={x:opponent.x-vis.x,y:opponent.y-vis.y};
      items.push({ y: vis.y, z: e.def.flying ? 4 : 2, draw: () => {
        const keep = e.pos;
        e.pos = vis;
        drawEnemy(ctx, e, game.time, dir);
        e.pos = keep;
      } });
    }
    for (const f of game.friendlies) {
      const vis = slide(f.pos, f.prev);
      items.push({ y: vis.y, z: 2, draw: () => {
        const keep = f.pos; f.pos = vis; paintedFriendly(ctx, f, game.time); f.pos = keep;
      } });
    }
    for (const summon of game.heroSummons) {
      const vis = slide(summon.pos, summon.prev);
      items.push({ y: vis.y, z: 2, draw: () => {
        const keep = summon.pos; summon.pos = vis; drawLogan(ctx, summon, game.time); summon.pos = keep;
      } });
    }
    for (const crew of game.crew) {
      const vis = slide(crew.pos, crew.prev);
      items.push({ y: vis.y, z: 2, draw: () => paintedCrew(ctx, vis, game.time, crew.swing, crew.facing, crew.hp / crew.maxHp, crew.timeLeft / 18) });
    }
    if (game.heroEnabled && (game.hero.deployed || game.hero.downed > 0)) {
      const vis = slide(game.hero.pos, game.hero.prev);
      items.push({ y: vis.y, z: 3, draw: () => {
        const keep = game.hero.pos; game.hero.pos = vis; drawJeff(ctx, game.hero, game.time); game.hero.pos = keep;
      } });
    }
    items.sort((a, b) => a.y - b.y || a.z - b.z);
    for (const item of items) item.draw();
  }

  private drawTargeting(game: Game, view: RenderView): void {
    if (!view.targeting) return;
    if (view.targeting === 'ability') {
      this.drawAbilityAim(game, view);
      return;
    }
    if (!view.mouse) return;
    const ctx = this.ctx;
    if (view.targeting === 'deploy') {
      this.drawDeployGhost(game, view.mouse);
      return;
    }
    if (view.targeting === 'strike') {
      const p = view.mouse;
      const valid = p.x >= 12 && p.x <= 948 && p.y >= 18 && p.y <= 582;
      const color = valid ? '#ff8a50' : '#ff8c76';
      const pulse = 0.7 + Math.sin(game.time * 7) * 0.3;
      ctx.save();
      ctx.strokeStyle = color;
      ctx.fillStyle = rgba(color, 0.14 * pulse);
      ctx.lineWidth = 2.6;
      ctx.setLineDash([8, 5]);
      ctx.lineDashOffset = -game.time * 28;
      ctx.beginPath();
      ctx.arc(p.x, p.y, 80, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      ctx.setLineDash([]);
      stampText(ctx, valid ? 'TORCH RAIN' : 'AIM ON THE YARD', p.x, p.y - 92, { size: 13, color });
      ctx.restore();
      return;
    }
    const p = game.nearestPathPoint(view.mouse);
    const tower = view.selectedTowerId === null ? null : game.towerById(view.selectedTowerId);
    const valid = dist(view.mouse, p) <= 55 && p.x >= 16 && p.x <= 944 && p.y >= 24 && p.y <= 576 && (view.targeting !== 'rally' || !!tower && dist(tower.pos, p) <= 150);
    const color = valid ? '#b8ef9a' : '#ff8c76';
    ctx.save(); ctx.strokeStyle = color; ctx.fillStyle = rgba(color, 0.13); ctx.lineWidth = 2.5;
    ctx.setLineDash([6, 4]); ctx.lineDashOffset = -game.time * 20;
    ctx.beginPath(); ctx.ellipse(p.x, p.y, 38, 24, 0, 0, Math.PI * 2); ctx.fill(); ctx.stroke(); ctx.setLineDash([]);
    stampText(ctx, valid ? view.targeting === 'crew' ? 'DEPLOY CREW' : 'SET RALLY' : 'CHOOSE A NEARBY ROUTE', p.x, p.y - 36, { size: 12, color });
    if (tower && view.targeting === 'rally') { ctx.strokeStyle = rgba(color, 0.4); ctx.beginPath(); ctx.arc(tower.pos.x, tower.pos.y, 150, 0, Math.PI * 2); ctx.stroke(); }
    ctx.restore();
  }

  private drawDeployGhost(game: Game, p: Vec): void {
    const ctx = this.ctx;
    const valid = p.x >= 12 && p.x <= 948 && p.y >= 18 && p.y <= 582;
    const color = valid ? game.heroDef.color : '#ff8c76';
    const pulse = 0.7 + Math.sin(game.time * 7) * 0.3;
    ctx.save();
    ctx.strokeStyle = color;
    ctx.fillStyle = rgba(color, 0.12 * pulse);
    ctx.lineWidth = 2.4;
    ctx.setLineDash([8, 5]);
    ctx.lineDashOffset = -game.time * 26;
    ctx.beginPath();
    ctx.ellipse(p.x, p.y + 10, 28, 12, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.globalAlpha = 0.5;
    const keep = game.hero.pos;
    const keepPrev = game.hero.prev;
    game.hero.pos = p;
    game.hero.prev = p;
    drawJeff(ctx, game.hero, game.time);
    game.hero.pos = keep;
    game.hero.prev = keepPrev;
    ctx.globalAlpha = 1;
    stampText(ctx, valid ? `DEPLOY ${game.heroDef.name.toUpperCase()}` : 'AIM ON THE YARD', p.x, p.y - 56, { size: 13, color });
    ctx.restore();
  }

  private drawAbilityAim(game: Game, view: RenderView): void {
    const ability = game.heroDef.abilities[view.abilitySlot ?? 0];
    if (!ability) return;
    const ctx = this.ctx;
    const origin = game.hero.pos;
    const range = scaledCastRange(game, (view.abilitySlot ?? 0) as AbilitySlot);
    const color = game.heroDef.color;
    ctx.save();
    ctx.strokeStyle = rgba(color, 0.75);
    ctx.fillStyle = rgba(color, 0.08);
    ctx.lineWidth = 2;
    ctx.setLineDash([8, 6]);
    ctx.lineDashOffset = -game.time * 24;
    ctx.beginPath();
    ctx.arc(origin.x, origin.y, range, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.setLineDash([]);

    const mouse = view.mouse;
    if (ability.aim === 'ground' && mouse) {
      const inRange = dist(origin, mouse) <= range;
      const tint = inRange ? color : '#ff8c76';
      ctx.strokeStyle = tint;
      ctx.fillStyle = rgba(tint, 0.14);
      ctx.lineWidth = 2.4;
      ctx.setLineDash([7, 5]);
      ctx.beginPath();
      ctx.arc(mouse.x, mouse.y, 90, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      ctx.setLineDash([]);
      stampText(ctx, inRange ? ability.name.toUpperCase() : 'OUT OF RANGE', mouse.x, mouse.y - 102, { size: 13, color: tint });
    } else {
      for (const e of game.enemies) {
        if (e.dead || e.escaped) continue;
        if (game.heroDef.id === 'becbec' && e.def.flying) continue;
        const reach = range + e.def.radius;
        if (dist(origin, e.pos) > reach) continue;
        const hover = view.hoverEnemyId === e.id;
        ctx.strokeStyle = rgba(color, hover ? 0.95 : 0.45);
        ctx.lineWidth = hover ? 2.6 : 1.4;
        ctx.beginPath();
        ctx.arc(e.pos.x, e.pos.y, e.def.radius + 10 + (hover ? Math.sin(game.time * 8) * 2 : 0), 0, Math.PI * 2);
        ctx.stroke();
      }
      if (mouse) {
        const hover = view.hoverEnemyId !== null ? game.enemies.find((e) => e.id === view.hoverEnemyId && !e.dead && !e.escaped) : null;
        const inRange = hover ? dist(origin, hover.pos) <= range + hover.def.radius : false;
        const tint = hover ? (inRange ? color : '#ff8c76') : rgba(color, 0.7);
        ctx.strokeStyle = tint;
        ctx.lineWidth = 1.8;
        ctx.beginPath();
        ctx.moveTo(mouse.x - 10, mouse.y);
        ctx.lineTo(mouse.x + 10, mouse.y);
        ctx.moveTo(mouse.x, mouse.y - 10);
        ctx.lineTo(mouse.x, mouse.y + 10);
        ctx.stroke();
        stampText(ctx, hover ? (inRange ? ability.name.toUpperCase() : 'OUT OF RANGE') : 'CLICK A LEAK', mouse.x, mouse.y - 28, { size: 12, color: tint });
      }
    }
    ctx.restore();
  }

  private drawStrikes(game: Game, _view: RenderView): void {
    if (game.strikes.length === 0) return;
    const ctx = this.ctx;
    ctx.save();
    for (const s of game.strikes) {
      if (s.fired) continue;
      const k = Math.max(0.2, 1 - s.delay / 1.2);
      ctx.globalAlpha = 0.55 * k;
      ctx.strokeStyle = '#ff8a50';
      ctx.fillStyle = rgba('#ff7043', 0.12 * k);
      ctx.lineWidth = 2.4;
      ctx.setLineDash([7, 5]);
      ctx.lineDashOffset = -game.time * 40;
      ctx.beginPath();
      ctx.arc(s.pos.x, s.pos.y, s.radius * (0.7 + 0.3 * k), 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      ctx.setLineDash([]);
      stampText(ctx, `${Math.max(0, s.delay).toFixed(1)}s`, s.pos.x, s.pos.y - 8, { size: 12, color: '#ffcc80' });
    }
    ctx.restore();
  }

  private drawHeroGround(game: Game, view: RenderView): void {
    if (!game.heroEnabled || !game.hero.deployed) return;
    const ctx = this.ctx;
    const h = game.hero;
    if (h.dest) {
      ctx.save();
      ctx.strokeStyle = 'rgba(165,214,167,0.7)';
      ctx.lineWidth = 2.6;
      ctx.setLineDash([7, 7]);
      ctx.lineDashOffset = -game.time * 34;
      ctx.beginPath();
      ctx.moveTo(h.pos.x, h.pos.y);
      ctx.lineTo(h.dest.x, h.dest.y);
      ctx.stroke();
      ctx.setLineDash([]);
      glow(ctx, '#a5d6a7', 10);
      ctx.strokeStyle = '#c8e6c9';
      ctx.lineWidth = 2.4;
      ctx.beginPath();
      ctx.arc(h.dest.x, h.dest.y, 10 + Math.sin(game.time * 9) * 2.5, 0, Math.PI * 2);
      ctx.stroke();
      noGlow(ctx);
      ctx.restore();
    }
    if (view.heroSelected) {
      ctx.save();
      const pulse = 0.75 + Math.sin(game.time * 6) * 0.25;
      ctx.globalAlpha = pulse;
      glow(ctx, '#ffe082', 12);
      ctx.strokeStyle = '#ffe082';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.ellipse(h.pos.x, h.pos.y + 26, 24, 9, 0, 0, Math.PI * 2);
      ctx.stroke();
      noGlow(ctx);
      ctx.restore();
    }
  }

  private drawHeroCombat(game: Game, view: RenderView): void {
    if (!game.heroEnabled || !game.hero.deployed || game.hero.downed > 0) return;
    const ctx = this.ctx;
    const h = game.hero;
    const ordered = h.orderTargetId !== null ? game.enemies.find((e) => e.id === h.orderTargetId) : null;
    if (ordered && !ordered.dead && !ordered.escaped) {
      ctx.save();
      glow(ctx, '#ff8a65', 14);
      ctx.strokeStyle = '#ff8a65';
      ctx.lineWidth = 2.4;
      ctx.setLineDash([5, 6]);
      ctx.lineDashOffset = -game.time * 40;
      ctx.beginPath();
      ctx.moveTo(h.pos.x, h.pos.y - 8);
      ctx.lineTo(ordered.pos.x, ordered.pos.y);
      ctx.stroke();
      ctx.setLineDash([]);
      const pulse = 14 + ordered.def.radius + Math.sin(game.time * 10) * 3;
      ctx.lineWidth = 3.2;
      ctx.beginPath();
      ctx.arc(ordered.pos.x, ordered.pos.y, pulse, 0, Math.PI * 2);
      ctx.stroke();
      ctx.strokeStyle = '#fff3e0';
      ctx.lineWidth = 1.6;
      for (let i = 0; i < 4; i++) {
        const a = game.time * 3 + (i * Math.PI) / 2;
        ctx.beginPath();
        ctx.arc(ordered.pos.x, ordered.pos.y, pulse + 4, a, a + 0.45);
        ctx.stroke();
      }
      noGlow(ctx);
      ctx.restore();
    }
    if (h.swing > 0 && game.heroDef.id === 'jeff') {
      const k = Math.min(1, h.swing / JEFF.swingTime);
      const slam = 1 - k;
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      glow(ctx, '#ffe082', 16);
      ctx.strokeStyle = rgba('#fff8e1', 0.55 + slam * 0.4);
      ctx.lineWidth = 3.2;
      ctx.beginPath();
      ctx.ellipse(h.pos.x + h.facing * 16, h.pos.y + 14, 16 + slam * 18, 6 + slam * 4, 0, 0, Math.PI * 2);
      ctx.stroke();
      ctx.strokeStyle = rgba('#ffcc80', 0.45 * slam);
      ctx.lineWidth = 2;
      for (let i = 0; i < 6; i++) {
        const a = (i / 6) * Math.PI * 2 + slam;
        ctx.beginPath();
        ctx.moveTo(h.pos.x + h.facing * 16 + Math.cos(a) * 8, h.pos.y + 14 + Math.sin(a) * 3);
        ctx.lineTo(h.pos.x + h.facing * 16 + Math.cos(a) * (18 + slam * 16), h.pos.y + 14 + Math.sin(a) * (6 + slam * 5));
        ctx.stroke();
      }
      noGlow(ctx);
      ctx.restore();
    }
    if (view.hoverEnemyId !== null && view.hoverEnemyId !== h.orderTargetId) {
      const hover = game.enemies.find((e) => e.id === view.hoverEnemyId);
      if (hover && !hover.dead && !hover.escaped) {
        ctx.save();
        glow(ctx, '#ffe082', 12);
        ctx.strokeStyle = '#ffe082';
        ctx.lineWidth = 2.6;
        ctx.beginPath();
        ctx.arc(hover.pos.x, hover.pos.y, hover.def.radius + 10 + Math.sin(game.time * 8) * 2, 0, Math.PI * 2);
        ctx.stroke();
        noGlow(ctx);
        ctx.fillStyle = 'rgba(20,12,8,0.82)';
        ctx.beginPath();
        ctx.roundRect(hover.pos.x - 58, hover.pos.y - hover.def.radius - 52, 116, 40, 5);
        ctx.fill();
        ctx.fillStyle = '#ffe082';
        ctx.font = '700 11px Source Sans 3, Trebuchet MS, sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText(hover.def.name.toUpperCase(), hover.pos.x, hover.pos.y - hover.def.radius - 38);
        ctx.fillStyle = '#f3e6c8';
        ctx.font = '600 10px Source Sans 3, Trebuchet MS, sans-serif';
        const arm = Math.round(hover.def.armor * 100);
        const tags = [hover.def.flying ? 'AIR' : 'GND', arm > 0 ? `ARM ${arm}%` : null].filter(Boolean).join(' · ');
        ctx.fillText(`${Math.ceil(hover.hp)} / ${hover.maxHp}  ${tags}`, hover.pos.x, hover.pos.y - hover.def.radius - 24);
        ctx.fillStyle = '#c8e6c9';
        ctx.fillText('CLICK TO ATTACK', hover.pos.x, hover.pos.y - hover.def.radius - 12);
        ctx.restore();
      }
    }
  }

  private seedSparks(fx: Effect): void {
    if (this.seededFx.has(fx)) return;
    this.seededFx.add(fx);
    switch (fx.kind) {
      case 'death':
        break;
      case 'hit':
        this.burst(fx.pos.x, fx.pos.y, fx.color, 3, 65);
        this.burst(fx.pos.x, fx.pos.y, '#fffde7', 2, 35);
        if (fx.max >= 0.25) this.kick(1.6);
        break;
      case 'splash':
        this.burst(fx.pos.x, fx.pos.y, fx.color, 18, 220);
        if (fx.radius >= 60) this.kick(6);
        break;
      case 'ring':
        this.burst(fx.pos.x, fx.pos.y, fx.color, 12, 80);
        break;
      case 'text':
        if (fx.text.startsWith('+$')) {
          this.burst(fx.pos.x, fx.pos.y, '#ffe082', 8, 90);
          this.flyGold(fx.pos.x, fx.pos.y, 3);
        }
        break;
      case 'beam':
        break;
      case 'skill':
        this.seedSkillSparks(fx.skill, fx.pos.x, fx.pos.y);
        break;
      default: {
        const _exhaustive: never = fx;
        return _exhaustive;
      }
    }
  }

  private flyGold(x: number, y: number, n: number): void {
    for (let i = 0; i < n; i++) {
      const life = 0.55 + Math.random() * 0.25;
      this.sparks.push({
        x: x + (Math.random() - 0.5) * 10,
        y: y + (Math.random() - 0.5) * 8,
        vx: (Math.random() - 0.5) * 40,
        vy: -40 - Math.random() * 30,
        life,
        max: life,
        r: 3.2 + Math.random() * 1.4,
        color: '#ffe082',
        g: 0,
        shape: 3,
        hx: 78,
        hy: 22,
      });
    }
  }

  private burst(x: number, y: number, color: string, n: number, gravity: number): void {
    const warm = color.includes('ff') || color.includes('e8') || color.includes('f9') || color.includes('c9');
    const icy = color.includes('4f') || color.includes('81') || color.includes('e1') || color.includes('29');
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2;
      const sp = 30 + Math.random() * 90;
      const life = 0.28 + Math.random() * 0.45;
      const shape: 0 | 1 | 2 = warm ? (Math.random() > 0.45 ? 1 : 0) : icy ? (Math.random() > 0.4 ? 2 : 0) : Math.random() > 0.55 ? 1 : 0;
      this.sparks.push({
        x,
        y,
        vx: Math.cos(a) * sp,
        vy: Math.sin(a) * sp - 40,
        life,
        max: life,
        r: 1.4 + Math.random() * 2.6,
        color,
        g: gravity,
        shape,
      });
    }
  }

  private tickSparks(time: number): void {
    const dt = this.lastSparkTime === 0 ? 0 : Math.min(0.05, Math.max(0, time - this.lastSparkTime));
    this.lastSparkTime = time;
    this.trauma = dt > 0 ? Math.max(0, this.trauma - dt * 1.85) : this.trauma;
    for (const s of this.sparks) {
      s.life -= dt;
      if (s.shape === 3 && s.hx !== undefined && s.hy !== undefined) {
        const k = 1 - Math.max(0, s.life / s.max);
        const ease = k * k * (3 - 2 * k);
        s.x += (s.hx - s.x) * Math.min(1, 0.12 + ease * 0.35);
        s.y += (s.hy - s.y) * Math.min(1, 0.12 + ease * 0.35);
      } else {
        s.x += s.vx * dt;
        s.y += s.vy * dt;
        s.vy += s.g * dt;
      }
    }
    if (this.sparks.length > 360) this.sparks.splice(0, this.sparks.length - 360);
    this.sparks = this.sparks.filter((s) => s.life > 0);
  }

  private drawSparks(): void {
    const ctx = this.ctx;
    ctx.save();
    for (const s of this.sparks) {
      const a = Math.max(0, s.life / s.max);
      ctx.globalAlpha = a;
      if (s.shape === 1) {
        // brass chip / ember streak
        const len = s.r * 3.2;
        const ang = Math.atan2(s.vy, s.vx);
        ctx.strokeStyle = s.color;
        ctx.lineWidth = Math.max(1.2, s.r * 0.7);
        ctx.lineCap = 'round';
        ctx.beginPath();
        ctx.moveTo(s.x, s.y);
        ctx.lineTo(s.x - Math.cos(ang) * len, s.y - Math.sin(ang) * len);
        ctx.stroke();
        disc(ctx, s.x, s.y, s.r * 0.55, '#fffde7');
      } else if (s.shape === 2) {
        // water bead
        ctx.beginPath();
        ctx.ellipse(s.x, s.y, s.r * 0.7, s.r * 1.15, 0, 0, Math.PI * 2);
        ctx.fillStyle = s.color;
        ctx.fill();
        disc(ctx, s.x - s.r * 0.25, s.y - s.r * 0.35, s.r * 0.35, rgba('#ffffff', 0.7));
      } else if (s.shape === 3) {
        ctx.fillStyle = s.color;
        ctx.beginPath();
        ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#fffde7';
        ctx.beginPath();
        ctx.arc(s.x - s.r * 0.25, s.y - s.r * 0.25, s.r * 0.35, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = '#c9a15b';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2);
        ctx.stroke();
      } else {
        disc(ctx, s.x, s.y, s.r, s.color);
      }
    }
    ctx.restore();
  }

  private drawProjectiles(game: Game): void {
    const ctx = this.ctx;
    const a = this.interp;
    for (const p of game.projectiles) {
      const px = p.prev && a < 0.995 ? p.prev.x + (p.pos.x - p.prev.x) * a : p.pos.x;
      const py = p.prev && a < 0.995 ? p.prev.y + (p.pos.y - p.prev.y) * a : p.pos.y;
      const dx = p.lastTargetPos.x - px;
      const dy = p.lastTargetPos.y - py;
      const len = Math.hypot(dx, dy) || 1;
      const ux = dx / len;
      const uy = dy / len;
      const span = Math.hypot(p.lastTargetPos.x - p.from.x, p.lastTargetPos.y - p.from.y) || 1;
      const flight = Math.max(0, Math.min(1, 1 - len / span));
      const arc = Math.sin(flight * Math.PI) * (p.splash > 0 ? 34 : 11);
      const x = px;
      const y = py - arc;
      const big = p.splash > 0;
      const ang = Math.atan2(uy, ux);
      ctx.save();
      ctx.globalAlpha = 0.28;
      ctx.fillStyle = '#1a1208';
      ctx.beginPath();
      ctx.ellipse(px, py + 6, big ? 7 : 4, big ? 3 : 1.8, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = 1;
      ctx.globalCompositeOperation = 'lighter';
      for (let i = 1; i <= 7; i++) {
        const back = i * (big ? 6 : 4.5);
        ctx.globalAlpha = 0.4 - i * 0.05;
        disc(ctx, x - ux * back, y - uy * back, (big ? 6 : 3.6) * (1 - i * 0.1), p.color);
      }
      glow(ctx, p.color, big ? 18 : 14);
      ctx.translate(x, y);
      ctx.rotate(ang + (big ? game.time * 6 : 0));
      ctx.globalAlpha = 1;
      if (big) {
        ctx.beginPath();
        ctx.ellipse(0, 0, 8, 5, 0, 0, Math.PI * 2);
        ctx.fillStyle = p.color;
        ctx.fill();
        ctx.fillStyle = '#fffde7';
        ctx.beginPath();
        ctx.ellipse(-2, -1.5, 3, 2, 0, 0, Math.PI * 2);
        ctx.fill();
      } else if (p.color.includes('ff') && (p.color.includes('6') || p.color.includes('a') || p.color.includes('e'))) {
        ctx.beginPath();
        ctx.moveTo(10, 0);
        ctx.lineTo(-4, -5);
        ctx.lineTo(-2, 0);
        ctx.lineTo(-4, 5);
        ctx.closePath();
        ctx.fillStyle = p.color;
        ctx.fill();
        ctx.fillStyle = '#fffde7';
        ctx.beginPath();
        ctx.moveTo(6, 0);
        ctx.lineTo(-1, -2);
        ctx.lineTo(-1, 2);
        ctx.closePath();
        ctx.fill();
      } else {
        ctx.beginPath();
        ctx.moveTo(9, 0);
        ctx.lineTo(-5, -3.2);
        ctx.lineTo(-2, 0);
        ctx.lineTo(-5, 3.2);
        ctx.closePath();
        ctx.fillStyle = p.color;
        ctx.fill();
        ctx.fillStyle = '#fffde7';
        ctx.beginPath();
        ctx.arc(-1, 0, 1.6, 0, Math.PI * 2);
        ctx.fill();
      }
      noGlow(ctx);
      ctx.restore();
    }
  }

  private drawEffect(fx: Effect): void {
    const ctx = this.ctx;
    const k = fx.ttl / fx.max;
    ctx.save();
    switch (fx.kind) {
      case 'death': {
        const index = ENEMY_ART[fx.enemy];
        if (index !== undefined) {
          ctx.globalAlpha = k * 0.8;
          ctx.translate(fx.pos.x, fx.pos.y + 10);
          ctx.rotate((1 - k) * 1.1);
          ctx.scale(0.8 + k * 0.2, 0.5 + k * 0.5);
          paintedSprite(ctx, 'units', index, 0, 0, Math.max(37, fx.radius * 2.8));
        }
        break;
      }
      case 'beam':
        ctx.globalAlpha = k;
        ctx.globalCompositeOperation = 'lighter';
        glow(ctx, fx.color, 22);
        ctx.strokeStyle = fx.color;
        ctx.lineWidth = 9;
        ctx.lineCap = 'round';
        ctx.beginPath();
        ctx.moveTo(fx.from.x, fx.from.y - 14);
        ctx.lineTo(fx.to.x, fx.to.y);
        ctx.stroke();
        noGlow(ctx);
        ctx.strokeStyle = '#fffde7';
        ctx.lineWidth = 2.2;
        ctx.globalAlpha = k * 0.9;
        ctx.stroke();
        // impact bloom
        glow(ctx, fx.color, 16);
        disc(ctx, fx.to.x, fx.to.y, 5 + (1 - k) * 8, fx.color);
        noGlow(ctx);
        break;
      case 'hit':
        ctx.globalAlpha = k;
        ctx.globalCompositeOperation = 'lighter';
        glow(ctx, fx.color, 8);
        ctx.fillStyle = fx.color;
        ctx.beginPath();
        ctx.arc(fx.pos.x, fx.pos.y, 3 + (1 - k) * 5, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#fffde7';
        ctx.globalAlpha = k * 0.9;
        ctx.beginPath();
        ctx.arc(fx.pos.x, fx.pos.y, 2 + (1 - k) * 3, 0, Math.PI * 2);
        ctx.fill();
        noGlow(ctx);
        ctx.strokeStyle = '#fffde7';
        ctx.globalAlpha = k * 0.95;
        ctx.lineWidth = 1.5;
        ctx.lineCap = 'round';
        for (let i = 0; i < 6; i++) {
          const a = (i / 6) * Math.PI * 2 + (1 - k) * 1.6;
          const r0 = 5;
          const r1 = 8 + (1 - k) * 10;
          ctx.beginPath();
          ctx.moveTo(fx.pos.x + Math.cos(a) * r0, fx.pos.y + Math.sin(a) * r0);
          ctx.lineTo(fx.pos.x + Math.cos(a) * r1, fx.pos.y + Math.sin(a) * r1);
          ctx.stroke();
        }
        break;
      case 'splash':
        ctx.globalCompositeOperation = 'lighter';
        glow(ctx, fx.color, 20);
        ctx.globalAlpha = k * 0.8;
        ctx.strokeStyle = fx.color;
        ctx.fillStyle = rgba(fx.color, 0.4);
        ctx.lineWidth = 4;
        ctx.beginPath();
        ctx.arc(fx.pos.x, fx.pos.y, fx.radius * (1 - k * 0.4), 0, Math.PI * 2);
        ctx.stroke();
        ctx.globalAlpha = k * 0.28;
        ctx.fill();
        pulseRing(ctx, fx.pos.x, fx.pos.y, fx.radius * (1 - k * 0.55), fx.color, k, 3);
        noGlow(ctx);
        break;
      case 'ring':
        pulseRing(ctx, fx.pos.x, fx.pos.y, fx.radius * (1 - k * 0.5), fx.color, k, 4.5);
        break;
      case 'text': {
        const t = 1 - k;
        const rise = (1 - Math.pow(1 - Math.min(1, t * 1.15), 3)) * 36;
        const pop = 1 + 0.4 * Math.sin(Math.min(1, t * 5) * Math.PI);
        const bounty = fx.text.startsWith('+$');
        ctx.globalAlpha = Math.min(1, k * 2.2);
        stampText(ctx, fx.text, fx.pos.x, fx.pos.y - rise, {
          size: (bounty ? 16 : fx.text.length > 14 ? 12 : 14) * pop,
          color: fx.color,
          display: fx.text === fx.text.toUpperCase() && fx.text.length > 3,
        });
        break;
      }
      case 'skill':
        this.drawSkillEffect(fx.skill, fx.pos, k);
        break;
      default: {
        const _exhaustive: never = fx;
        return _exhaustive;
      }
    }
    ctx.restore();
  }

  private seedSkillSparks(skill: JeffSkillId, x: number, y: number): void {
    switch (skill) {
      case 'clamp':
        this.burst(x, y, '#e74c3c', 28, 140);
        this.burst(x, y, '#ffcdd2', 10, 80);
        this.kick(5);
        break;
      case 'shutoff':
        this.burst(x, y, '#4fc3f7', 36, 30);
        this.burst(WORLD_W / 2, 80, '#e1f5fe', 16, 20);
        this.kick(9);
        break;
      case 'pulse':
        this.burst(x, y, '#ffb74d', 34, 70);
        this.burst(x, y, '#fff8e1', 12, 40);
        this.kick(8);
        break;
      case 'sleeve':
        this.burst(x, y, '#8d6e63', 22, 50);
        this.burst(x, y, '#d7ccc8', 10, 30);
        this.kick(2.5);
        break;
      case 'coffee':
        this.burst(x, y, '#ffe082', 26, 40);
        this.burst(x, y, '#6d4c41', 12, 70);
        this.kick(2.5);
        break;
      default: {
        const _exhaustive: never = skill;
        return _exhaustive;
      }
    }
  }

  private drawSkillEffect(skill: JeffSkillId, pos: Vec, k: number): void {
    switch (skill) {
      case 'clamp':
        this.drawClampCast(pos, k);
        break;
      case 'shutoff':
        this.drawShutoffCast(pos, k);
        break;
      case 'pulse':
        this.drawPulseCast(pos, k);
        break;
      case 'sleeve':
        this.drawSleeveCast(pos, k);
        break;
      case 'coffee':
        this.drawCoffeeCast(pos, k);
        break;
      default: {
        const _exhaustive: never = skill;
        return _exhaustive;
      }
    }
  }

  /** A single cast notice keeps simultaneous skills from hiding the hero. */
  private drawSkillNotice(game: Game): void {
    let latest: Extract<Effect, { kind: 'skill' }> | undefined;
    for (const fx of game.effects) if (fx.kind === 'skill') latest = fx;
    if (!latest && game.globalSlowTimer <= 0) return;
    const labels: Record<JeffSkillId, [string, string, string]> = {
      clamp: ['PIPE CLAMP', 'Hold + slow', '#edb199'],
      shutoff: ['EMERGENCY SHUTOFF', 'Spawns paused', '#9fe0ef'],
      pulse: ['MANOMETER PULSE', 'Shred + stun', '#edc87c'],
      sleeve: ['ISOLATION SLEEVE', 'Extra holds', '#c7d8c7'],
      coffee: ['COFFEE', 'Heal + hustle', '#efda91'],
    };
    const [title, subtitle, color] = labels[latest?.skill ?? 'shutoff'];
    const ctx = this.ctx;
    const alpha = latest ? Math.min(1, latest.ttl * 4) : Math.min(1, game.globalSlowTimer);
    const x = WORLD_W / 2, y = WORLD_H - 34;
    ctx.save(); ctx.globalAlpha = alpha;
    ctx.fillStyle = '#173528e8'; ctx.strokeStyle = color; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.roundRect(x - 136, y - 13, 272, 27, 6); ctx.fill(); ctx.stroke();
    disc(ctx, x - 123, y, 3, color);
    ctx.font = `700 10px ${CANVAS_UI}`; ctx.textAlign = 'left'; ctx.fillStyle = color;
    ctx.fillText(title, x - 112, y + 4);
    ctx.font = `500 9px ${CANVAS_UI}`; ctx.textAlign = 'right'; ctx.fillStyle = '#e3ebd2';
    ctx.fillText(subtitle, x + 124, y + 4);
    ctx.restore();
  }

  private drawClampCast(pos: Vec, k: number): void {
    const ctx = this.ctx;
    const slam = k > 0.72 ? 1 + (k - 0.72) * 1.5 : 1;
    const r = JEFF.clamp.radius * slam;
    ctx.save();
    ctx.globalAlpha = Math.min(1, k * 1.3);
    glow(ctx, '#e74c3c', 28);
    ctx.fillStyle = rgba('#e74c3c', 0.28);
    ctx.beginPath();
    ctx.arc(pos.x, pos.y, r, 0, Math.PI * 2);
    ctx.fill();
    ctx.lineCap = 'round';
    ctx.strokeStyle = '#b71c1c';
    ctx.lineWidth = 14;
    ctx.beginPath();
    ctx.arc(pos.x, pos.y, r - 2, -0.85, 0.85);
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(pos.x, pos.y, r - 2, Math.PI - 0.85, Math.PI + 0.85);
    ctx.stroke();
    ctx.strokeStyle = '#ff8a80';
    ctx.lineWidth = 5;
    ctx.beginPath();
    ctx.arc(pos.x, pos.y, r - 2, -0.7, 0.7);
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(pos.x, pos.y, r - 2, Math.PI - 0.7, Math.PI + 0.7);
    ctx.stroke();
    noGlow(ctx);
    ctx.fillStyle = '#ffcdd2';
    for (const side of [-1, 1]) {
      ctx.beginPath();
      ctx.arc(pos.x + side * (r - 6), pos.y, 7, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }

  private drawShutoffCast(pos: Vec, k: number): void {
    const ctx = this.ctx;
    ctx.save();
    ctx.globalAlpha = k;
    glow(ctx, '#4fc3f7', 24);
    for (let i = 0; i < 3; i++) {
      const t = (1 - k + i * 0.18) % 1;
      ctx.strokeStyle = rgba('#e1f5fe', 0.95 - i * 0.15);
      ctx.lineWidth = 14 - i * 3;
      ctx.beginPath();
      ctx.arc(pos.x, pos.y, 50 + t * 320, 0, Math.PI * 2);
      ctx.stroke();
      ctx.strokeStyle = rgba('#4fc3f7', 0.7);
      ctx.lineWidth = 5;
      ctx.stroke();
    }
    noGlow(ctx);
    this.drawValveGlyph(pos.x, pos.y, 34, k, this.fxTime * 2);
    ctx.fillStyle = rgba('#e1f5fe', 0.55 * k);
    ctx.beginPath();
    ctx.arc(pos.x, pos.y, 18, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  private drawPulseCast(pos: Vec, k: number): void {
    const ctx = this.ctx;
    const r = JEFF.pulse.radius;
    ctx.save();
    ctx.globalAlpha = Math.min(1, k * 1.4);
    glow(ctx, '#ffb74d', 26);
    ctx.fillStyle = rgba('#ff9800', 0.22);
    ctx.beginPath();
    ctx.arc(pos.x, pos.y, r * (1.05 - k * 0.2), 0, Math.PI * 2);
    ctx.fill();
    for (let i = 0; i < 3; i++) {
      ctx.strokeStyle = i === 0 ? '#fff8e1' : '#ffb74d';
      ctx.lineWidth = 7 - i * 2;
      ctx.beginPath();
      ctx.arc(pos.x, pos.y, (r - 8) * (1 - k * 0.55) + i * 14, 0, Math.PI * 2);
      ctx.stroke();
    }
    noGlow(ctx);
    ctx.save();
    ctx.translate(pos.x, pos.y - 8);
    ctx.strokeStyle = '#fff8e1';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(0, 0, 16, 0, Math.PI * 2);
    ctx.stroke();
    ctx.rotate(0.8 + (1 - k) * 2.4);
    ctx.strokeStyle = '#e65100';
    ctx.lineWidth = 3.4;
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(14, -2);
    ctx.stroke();
    ctx.restore();
    ctx.strokeStyle = '#fff59d';
    ctx.lineWidth = 2.4;
    for (let i = 0; i < 10; i++) {
      const a = (i / 10) * Math.PI * 2 + (1 - k);
      ctx.beginPath();
      ctx.moveTo(pos.x + Math.cos(a) * 18, pos.y + Math.sin(a) * 18);
      ctx.lineTo(pos.x + Math.cos(a) * (r * (1.05 - k * 0.4)), pos.y + Math.sin(a) * (r * (1.05 - k * 0.4)));
      ctx.stroke();
    }
    ctx.restore();
  }

  private drawSleeveCast(pos: Vec, k: number): void {
    const ctx = this.ctx;
    ctx.save();
    ctx.globalAlpha = Math.min(1, k * 1.3);
    glow(ctx, '#8d6e63', 20);
    for (let i = 0; i < 5; i++) {
      const spin = this.fxTime * 3 + i * 0.7;
        ctx.strokeStyle = i % 2 === 0 ? '#4e342e' : '#efebe9';
      ctx.lineWidth = 8 - i * 0.7;
      ctx.beginPath();
      ctx.ellipse(pos.x, pos.y - 4, 18 + (1 - k) * 28 + i * 6, 26 + (1 - k) * 10 + i * 3, spin * 0.2, 0, Math.PI * 2);
      ctx.stroke();
    }
    noGlow(ctx);
    ctx.fillStyle = rgba('#6d4c41', 0.35);
    ctx.beginPath();
    ctx.ellipse(pos.x, pos.y - 2, 20, 28, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  private drawCoffeeCast(pos: Vec, k: number): void {
    const ctx = this.ctx;
    ctx.save();
    ctx.globalAlpha = Math.min(1, k * 1.3);
    glow(ctx, '#ffe082', 24);
    ctx.fillStyle = rgba('#ffe082', 0.22);
    ctx.beginPath();
    ctx.arc(pos.x, pos.y, 52 + (1 - k) * 30, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#ffe082';
    ctx.lineWidth = 6;
    ctx.beginPath();
    ctx.arc(pos.x, pos.y, 40 * (1.15 - k * 0.4), 0, Math.PI * 2);
    ctx.stroke();
    noGlow(ctx);
    ctx.fillStyle = '#5d4037';
    ctx.beginPath();
    ctx.roundRect(pos.x - 11, pos.y - 28, 22, 30, 5);
    ctx.fill();
    ctx.strokeStyle = '#1a1008';
    ctx.lineWidth = 2.4;
    ctx.stroke();
    ctx.fillStyle = '#8d6e63';
    ctx.beginPath();
    ctx.roundRect(pos.x - 13, pos.y - 32, 26, 7, 3);
    ctx.fill();
    ctx.strokeStyle = '#ffe082';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(pos.x + 14, pos.y - 16, 7, -0.8, 0.8);
    ctx.stroke();
    ctx.fillStyle = '#6d4c41';
    ctx.beginPath();
    ctx.ellipse(pos.x, pos.y - 26, 7, 3, 0, 0, Math.PI * 2);
    ctx.fill();
    for (let i = 0; i < 4; i++) {
      blotch(ctx, pos.x - 10 + i * 7, pos.y - 48 - (1 - k) * 14 - Math.sin(this.fxTime * 4 + i) * 3, 4.5, 7, 0.2, rgba('#ffe0b2', 0.55));
    }
    ctx.restore();
  }
}
