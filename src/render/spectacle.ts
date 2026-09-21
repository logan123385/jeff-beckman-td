import type { Vec } from '../core/vec';
import type { Game } from '../sim/game';
import type { Effect, Projectile } from '../sim/state';
import { disc, rgba } from './ink';

type Ctx = CanvasRenderingContext2D;
type Material = 'water' | 'fire' | 'heat' | 'metal' | 'frost' | 'acid';
const TAU = Math.PI * 2;
const COLORS: Record<Material, [string, string, string]> = {
  water: ['#4ebbd4', '#dcffff', '#25658b'], fire: ['#ff8f43', '#fff3b5', '#b84839'],
  heat: ['#edc07c', '#fff1d1', '#a76754'], metal: ['#d7bb83', '#fff2c7', '#59666e'],
  frost: ['#83d8ee', '#efffff', '#536bac'], acid: ['#a6cf72', '#f2ffd1', '#4d8275'],
};
const rnd = (n: number) => { const x = Math.sin(n * 127.1 + 311.7) * 43758.5453; return x - Math.floor(x); };
const lights = new Map<string, HTMLCanvasElement>();

/** Cached soft light: no per-particle shadow blur or full-stage offscreen passes. */
export function pointLight(ctx: Ctx, x: number, y: number, r: number, color: string, opacity: number): void {
  if (r <= 0 || opacity <= 0) return;
  let tile = lights.get(color);
  if (!tile) {
    tile = document.createElement('canvas'); tile.width = tile.height = 96;
    const c = tile.getContext('2d')!, g = c.createRadialGradient(48, 48, 0, 48, 48, 48);
    g.addColorStop(0, rgba(color, .85)); g.addColorStop(.2, rgba(color, .4)); g.addColorStop(.55, rgba(color, .1)); g.addColorStop(1, rgba(color, 0));
    c.fillStyle = g; c.fillRect(0, 0, 96, 96); lights.set(color, tile);
    if (lights.size > 48) lights.delete(lights.keys().next().value!);
  }
  ctx.save(); ctx.globalCompositeOperation = 'screen'; ctx.globalAlpha *= opacity;
  ctx.drawImage(tile, x - r, y - r, r * 2, r * 2); ctx.restore();
}

export function projectileMaterial(p: Pick<Projectile, 'source' | 'damageType'>): Material {
  if (p.source === 'glycol') return 'frost';
  if (p.source === 'descaler') return 'acid';
  return p.damageType === 'physical' ? 'metal' : p.damageType;
}

function colorMaterial(color: string): Material {
  const hex = color.replace('#', '');
  const r = parseInt(hex.slice(0, 2), 16), g = parseInt(hex.slice(2, 4), 16), b = parseInt(hex.slice(4, 6), 16);
  if (b > r * 1.12) return 'water';
  if (g > r * 1.13 && g > b * 1.1) return 'acid';
  return r > g * 1.35 ? 'fire' : 'metal';
}

interface TrailPoint extends Vec { time: number }
interface Mark extends Vec { time: number; radius: number; material: Material; seed: number }

/** Presentation only. Every trail, mark, and light has a bounded lifetime and budget. */
export class Spectacle {
  private trails = new Map<number, TrailPoint[]>();
  private marks: Mark[] = [];
  private seen = new WeakSet<Effect>();

  ground(ctx: Ctx, game: Game, time: number): void {
    for (const fx of game.effects) {
      if (this.seen.has(fx)) continue;
      this.seen.add(fx);
      if (fx.kind !== 'splash' && fx.kind !== 'death') continue;
      const material = fx.kind === 'splash' ? colorMaterial(fx.color) : ['drip', 'sludge', 'biofilm', 'airlock'].includes(fx.enemy) ? 'water' : 'metal';
      this.marks.push({ ...fx.pos, time, radius: Math.min(45, fx.radius * .65), material, seed: this.marks.length + time * 19 });
    }
    this.marks = this.marks.filter(m => time - m.time < 1.8).slice(-48);
    ctx.save();
    for (const m of this.marks) {
      const age = time - m.time, k = (1 - age / 1.8) * Math.min(1, age * 12);
      ctx.globalAlpha = k * .3;
      ctx.fillStyle = m.material === 'fire' ? '#392d35' : COLORS[m.material][2];
      ctx.beginPath(); ctx.ellipse(m.x, m.y + 4, m.radius, m.radius * .42, rnd(m.seed), 0, TAU); ctx.fill();
      if (m.material === 'water') {
        ctx.strokeStyle = '#b6f2e9'; ctx.lineWidth = .9;
        ctx.beginPath(); ctx.ellipse(m.x, m.y + 2, m.radius * .8, m.radius * .28, 0, .2, 2.8); ctx.stroke();
      }
    }
    ctx.restore();
  }

  projectiles(ctx: Ctx, game: Game, time: number, alpha: number): void {
    const alive = new Set<number>();
    for (const p of game.projectiles) {
      alive.add(p.id);
      const px = p.prev.x + (p.pos.x - p.prev.x) * alpha, py = p.prev.y + (p.pos.y - p.prev.y) * alpha;
      const dx = p.lastTargetPos.x - px, dy = p.lastTargetPos.y - py;
      const span = Math.hypot(p.lastTargetPos.x - p.from.x, p.lastTargetPos.y - p.from.y) || 1;
      const flight = Math.max(0, Math.min(1, 1 - Math.hypot(dx, dy) / span));
      const material = projectileMaterial(p), [color, core, shade] = COLORS[material];
      const big = p.splash > 0, arc = Math.sin(flight * Math.PI) * (big ? 37 : 10);
      const pos = { x: px, y: py - arc, time };
      let trail = this.trails.get(p.id);
      if (!trail) { trail = [{ x: p.from.x, y: p.from.y, time: time - 1 / 60 }]; this.trails.set(p.id, trail); }
      const last = trail[trail.length - 1]!;
      if (time > last.time + .004) trail.push(pos);
      while (trail.length > 14 || trail.length > 2 && time - trail[0]!.time > .18) trail.shift();
      const points = trail[trail.length - 1] === pos ? trail : [...trail, pos];
      let heading = points.length - 2;
      while (heading >= 0 && Math.hypot(pos.x - points[heading]!.x, pos.y - points[heading]!.y) < .01) heading--;
      const previous = points[heading];
      const angle = previous ? Math.atan2(pos.y - previous.y, pos.x - previous.x) : Math.atan2(dy, dx);
      ctx.save();
      ctx.globalAlpha = .19; ctx.fillStyle = '#102535'; ctx.beginPath(); ctx.ellipse(px, py + 5, big ? 8 : 4, big ? 3 : 1.6, 0, 0, TAU); ctx.fill(); ctx.globalAlpha = 1;
      pointLight(ctx, pos.x, pos.y, big ? 32 : 21, color, .7);
      this.ribbon(ctx, points, big ? 6 : 3.4, color, core);
      // Sparks and droplets peel off the real curved flight, rather than a straight fake tail.
      for (let i = 1; i < points.length - 1; i += 3) {
        const q = points[i]!, age = Math.max(0, time - q.time), side = i % 2 ? -1 : 1;
        ctx.globalAlpha = Math.max(0, .6 - age * 3);
        const ox = Math.sin(p.id + i) * age * 24, oy = material === 'fire' ? -age * 40 : age * 50;
        if (material === 'frost') { ctx.strokeStyle = core; ctx.lineWidth = 1; ctx.strokeRect(q.x + ox - 1, q.y + oy - 1, 3, 3); }
        else disc(ctx, q.x + ox + side * 2, q.y + oy, material === 'water' ? 1.8 : 1.1, i % 3 ? color : core);
      }
      ctx.globalAlpha = 1; ctx.translate(pos.x, pos.y); ctx.rotate(angle);
      if (material === 'water' || material === 'acid') {
        const size = big ? 1.35 : 1;
        ctx.scale(size, size);
        const g = ctx.createLinearGradient(0, -6, 0, 6); g.addColorStop(0, core); g.addColorStop(.32, color); g.addColorStop(1, shade);
        ctx.fillStyle = g; ctx.strokeStyle = color; ctx.lineWidth = 1;
        ctx.beginPath(); ctx.moveTo(9, 0); ctx.bezierCurveTo(9, -8, -6, -6, -15, 0); ctx.bezierCurveTo(-6, 6, 9, 8, 9, 0); ctx.fill(); ctx.stroke();
        ctx.strokeStyle = core; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.moveTo(-6, -2); ctx.quadraticCurveTo(2, -5, 6, -1); ctx.stroke();
      } else if (material === 'fire' || material === 'heat') {
        ctx.fillStyle = shade; ctx.beginPath(); ctx.moveTo(-19, -4); ctx.quadraticCurveTo(-7, -3, -3, -9); ctx.quadraticCurveTo(14, -6, 9, 3); ctx.quadraticCurveTo(0, 11, -20, 4); ctx.lineTo(-8, 0); ctx.fill();
        ctx.fillStyle = color; ctx.beginPath(); ctx.ellipse(0, 0, big ? 10 : 7, big ? 6 : 4, 0, 0, TAU); ctx.fill();
        ctx.fillStyle = core; ctx.beginPath(); ctx.ellipse(3, -1, 5, 2.5, -.1, 0, TAU); ctx.fill();
      } else if (material === 'frost') {
        ctx.rotate(time * 5); ctx.fillStyle = color; ctx.strokeStyle = core; ctx.lineWidth = 1.3;
        ctx.beginPath(); ctx.moveTo(10, 0); ctx.lineTo(0, -6); ctx.lineTo(-10, 0); ctx.lineTo(0, 6); ctx.closePath(); ctx.fill(); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(-10, 0); ctx.lineTo(10, 0); ctx.moveTo(0, -6); ctx.lineTo(0, 6); ctx.stroke();
      } else {
        ctx.rotate(time * (big ? 12 : 2)); ctx.fillStyle = shade; ctx.strokeStyle = color; ctx.lineWidth = 2;
        ctx.beginPath(); for (let i = 0; i < 6; i++) { const a = i * TAU / 6; const x = Math.cos(a) * (big ? 8 : 5), y = Math.sin(a) * (big ? 8 : 5); if (!i) ctx.moveTo(x, y); else ctx.lineTo(x, y); } ctx.closePath(); ctx.fill(); ctx.stroke();
        disc(ctx, 0, 0, big ? 3.3 : 2, core);
      }
      ctx.restore();
    }
    for (const id of this.trails.keys()) if (!alive.has(id)) this.trails.delete(id);
  }

  private ribbon(ctx: Ctx, points: Vec[], width: number, color: string, core: string): void {
    if (points.length < 2) return;
    ctx.save(); ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    for (let i = 1; i < points.length; i++) {
      const a = points[i - 1]!, b = points[i]!, k = i / (points.length - 1);
      ctx.globalAlpha = k * .7; ctx.strokeStyle = color; ctx.lineWidth = width * k;
      ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke();
      ctx.globalAlpha = k * .8; ctx.strokeStyle = core; ctx.lineWidth = Math.max(.5, width * .27 * k); ctx.stroke();
    }
    ctx.restore();
  }
}

/** Material-specific contact, debris and recovery. Returns false for text / hero skills. */
export function impact(ctx: Ctx, fx: Effect, time: number): boolean {
  if (fx.kind === 'text' || fx.kind === 'skill') return false;
  const k = Math.max(0, Math.min(1, fx.ttl / fx.max)), age = 1 - k, rise = 1 - Math.pow(k, 3);
  const material = fx.kind === 'death' ? ['drip', 'sludge', 'biofilm', 'airlock', 'steamWisp'].includes(fx.enemy) ? 'water' : fx.enemy === 'rogueBoiler' ? 'fire' : 'metal' : colorMaterial(fx.color);
  const [color, core, shade] = COLORS[material];
  ctx.save(); ctx.lineCap = 'round';
  if (fx.kind === 'beam') {
    const dx = fx.to.x - fx.from.x, dy = fx.to.y - fx.from.y + 14, len = Math.hypot(dx, dy) || 1;
    const path = new Path2D();
    for (let i = 0; i <= 16; i++) {
      const t = i / 16, wave = Math.sin(i * 2.4 + Math.floor(time * 24)) * Math.sin(t * Math.PI) * (material === 'water' ? 3 : 6) * k;
      const x = fx.from.x + dx * t - dy / len * wave, y = fx.from.y - 14 + dy * t + dx / len * wave;
      if (!i) path.moveTo(x, y); else path.lineTo(x, y);
    }
    for (const [w, a, c] of [[9, .16, color], [3.5, .8, color], [1.2, .95, core]] as const) {
      ctx.globalAlpha = k * a; ctx.strokeStyle = c; ctx.lineWidth = w * (.6 + k * .4); ctx.stroke(path);
    }
    pointLight(ctx, fx.to.x, fx.to.y, 26, color, k);
    ctx.restore(); return true;
  }
  const { x, y } = fx.pos;
  const radius = fx.kind === 'hit' ? 17 : fx.kind === 'death' ? Math.min(45, fx.radius * 1.6) : fx.radius;
  const large = fx.kind === 'splash' || fx.kind === 'ring';
  pointLight(ctx, x, y - 4, radius * (large ? 1.15 : 1.8), color, k * k * (large ? .8 : .5));
  if (large || fx.kind === 'death') {
    // Ground contact carries scale; the inner field stays transparent for readable combat.
    ctx.strokeStyle = color; ctx.lineWidth = 1 + k * 2; ctx.globalAlpha = k * .8;
    ctx.beginPath(); ctx.ellipse(x, y + 6, Math.max(.1, radius * rise), Math.max(.1, radius * rise * .46), 0, 0, TAU); ctx.stroke();
    ctx.strokeStyle = core; ctx.lineWidth = .8; ctx.globalAlpha = k * .55;
    ctx.beginPath(); ctx.ellipse(x, y + 6, Math.max(.1, radius * rise * .76), Math.max(.1, radius * rise * .32), 0, .2, Math.PI * 1.5); ctx.stroke();
  }
  if (fx.kind !== 'ring') {
    const count = large ? 14 : fx.kind === 'death' ? 10 : 6;
    for (let i = 0; i < count; i++) {
      const angle = i / count * TAU + rnd(x + y + i) * .5;
      const reach = radius * (.5 + rnd(i + x) * .7) * rise;
      const px = x + Math.cos(angle) * reach, py = y + Math.sin(angle) * reach * .65 - Math.sin(age * Math.PI) * (large ? 18 : 9);
      ctx.globalAlpha = k * (.55 + rnd(i) * .4);
      if (material === 'water' || material === 'acid') {
        ctx.fillStyle = color; ctx.beginPath(); ctx.ellipse(px, py, Math.max(.3, 2.3 * k), Math.max(.3, (3 + age * 3) * k), -Math.cos(angle) * .7, 0, TAU); ctx.fill(); disc(ctx, px - .4, py - 1, .8 * k, core);
      } else if (material === 'metal' && fx.kind === 'death') {
        ctx.save(); ctx.translate(px, py); ctx.rotate(angle + age * 7); ctx.fillStyle = shade; ctx.strokeStyle = color; ctx.lineWidth = .8;
        ctx.fillRect(-2, -2, 4, 3); ctx.strokeRect(-2, -2, 4, 3); ctx.restore();
      } else {
        ctx.strokeStyle = i % 3 ? color : core; ctx.lineWidth = Math.max(.5, k * 1.8);
        ctx.beginPath(); ctx.moveTo(px, py); ctx.lineTo(px - Math.cos(angle) * (4 + k * 7), py - Math.sin(angle) * (3 + k * 5)); ctx.stroke();
      }
    }
  }
  if (age < .35) {
    ctx.globalAlpha = (1 - age / .35) * .9; ctx.fillStyle = core;
    ctx.beginPath(); ctx.ellipse(x, y - 4, (large ? 11 : 5) * k, (large ? 6 : 3) * k, -.4, 0, TAU); ctx.fill();
  }
  ctx.restore(); return true;
}

/** Map-specific weather and light use the game clock, so pausing freezes the diorama. */
export function cinematicWeather(ctx: Ctx, game: Game, time: number, reducedMotion: boolean): void {
  const id = game.map.id, snow = id === 'snowmelt', marsh = id === 'liftStation' || id === 'serviceCall';
  const hot = ['heatPlant', 'boilerRoom', 'mechanicalRoom', 'attic', 'radiantFloor'].includes(id);
  const t = reducedMotion ? 0 : time;
  ctx.save();
  if (!hot) {
    ctx.globalCompositeOperation = 'screen';
    for (let i = 0; i < 4; i++) {
      const x = 100 + i * 250 + Math.sin(t * .11 + i) * 18;
      const g = ctx.createLinearGradient(x, 0, x + 180, 600); g.addColorStop(0, snow ? '#fff4dd16' : '#ffedbb0d'); g.addColorStop(1, '#fff4dd00');
      ctx.fillStyle = g; ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x + 48, 0); ctx.lineTo(x + 370, 600); ctx.lineTo(x + 150, 600); ctx.closePath(); ctx.fill();
    }
  }
  ctx.globalCompositeOperation = 'source-over';
  for (let i = 0; i < (snow ? 55 : 27); i++) {
    const seed = rnd(i + 90), x = (seed * 1040 + Math.sin(t * .3 + i * 2) * (snow ? 25 : 9) + 1040) % 1040 - 40;
    const speed = snow ? 12 + seed * 14 : hot ? -10 - seed * 12 : -3 - seed * 4;
    const y = (rnd(i + 150) * 650 + t * speed % 650 + 650) % 650 - 25;
    const pulse = .5 + Math.sin(t * (marsh ? 1.8 : .6) + i) * .4;
    ctx.globalAlpha = (snow ? .5 : hot ? .65 : .5) * pulse;
    if (snow) { disc(ctx, x, y, .8 + seed * 1.5, '#f1fbff'); }
    else if (hot) { ctx.fillStyle = '#ffc47a'; ctx.fillRect(x, y, 1.2, 2 + seed * 2); }
    else { pointLight(ctx, x, y, marsh ? 10 : 7, marsh ? '#8adfd0' : '#f4d692', .7); disc(ctx, x, y, 1.1, marsh ? '#c0ffe0' : '#ffedb3'); }
  }
  ctx.restore();
}
