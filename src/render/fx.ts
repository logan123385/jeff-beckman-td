/** Shared spectacle VFX — additive blooms, shockwaves, trails, and grade. */

import { WORLD_H, WORLD_W } from '../data/maps';
import { disc, glow, noGlow, pulseRing, radial, rgba, ring } from './ink';

type Ctx = CanvasRenderingContext2D;

/** Expanding multi-ring shockwave with hot core bloom. */
export function shockwave(
  ctx: Ctx,
  x: number,
  y: number,
  radius: number,
  color: string,
  life: number,
  width = 4,
): void {
  const k = Math.max(0, Math.min(1, life));
  const r = radius * (0.55 + (1 - k) * 0.7);
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  radial(ctx, x, y, 2, r * 0.55, color, k * 0.55);
  radial(ctx, x, y, 1, r * 0.28, '#fffde7', k * 0.7);
  glow(ctx, color, 14 + (1 - k) * 18);
  ctx.globalAlpha = k;
  ring(ctx, x, y, r, color, width * (0.7 + k * 0.5));
  ctx.globalAlpha = k * 0.55;
  ring(ctx, x, y, r * 0.72, '#fff8e1', Math.max(1.2, width * 0.45));
  pulseRing(ctx, x, y, r * 1.08, color, k * 0.85, width * 0.7);
  noGlow(ctx);
  ctx.restore();
}

/** Radial star-burst spikes for hits and crits. */
export function starBurst(
  ctx: Ctx,
  x: number,
  y: number,
  color: string,
  life: number,
  rays = 8,
  reach = 18,
): void {
  const k = Math.max(0, Math.min(1, life));
  const spin = (1 - k) * 1.8;
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  ctx.globalAlpha = k;
  ctx.strokeStyle = color;
  ctx.lineCap = 'round';
  glow(ctx, color, 10);
  for (let i = 0; i < rays; i++) {
    const a = (i / rays) * Math.PI * 2 + spin;
    const inner = 3 + (1 - k) * 4;
    const outer = reach + (1 - k) * reach * 0.9;
    ctx.lineWidth = i % 2 === 0 ? 2.4 : 1.4;
    ctx.beginPath();
    ctx.moveTo(x + Math.cos(a) * inner, y + Math.sin(a) * inner);
    ctx.lineTo(x + Math.cos(a) * outer, y + Math.sin(a) * outer);
    ctx.stroke();
  }
  disc(ctx, x, y, 2.5 + (1 - k) * 4, '#fffde7');
  noGlow(ctx);
  ctx.restore();
}

/** Soft cinematic grade — warm brass midtones, cool shadow edges. */
export function colorGrade(ctx: Ctx, intensity = 0.14): void {
  if (intensity <= 0) return;
  ctx.save();
  ctx.globalCompositeOperation = 'soft-light';
  const warm = ctx.createLinearGradient(0, 0, WORLD_W, WORLD_H);
  warm.addColorStop(0, rgba('#ffcc80', intensity * 0.55));
  warm.addColorStop(0.45, rgba('#ffe082', intensity * 0.25));
  warm.addColorStop(1, rgba('#81d4fa', intensity * 0.35));
  ctx.fillStyle = warm;
  ctx.fillRect(0, 0, WORLD_W, WORLD_H);
  ctx.globalCompositeOperation = 'overlay';
  ctx.globalAlpha = intensity * 0.35;
  const lift = ctx.createRadialGradient(
    WORLD_W * 0.5,
    WORLD_H * 0.35,
    WORLD_W * 0.1,
    WORLD_W * 0.5,
    WORLD_H * 0.5,
    WORLD_W * 0.7,
  );
  lift.addColorStop(0, rgba('#fff8e1', 0.55));
  lift.addColorStop(1, rgba('#0a0908', 0));
  ctx.fillStyle = lift;
  ctx.fillRect(0, 0, WORLD_W, WORLD_H);
  ctx.restore();
}

/** Additive heat shimmer bands (fake refraction via offset soft strips). */
export function heatShimmer(ctx: Ctx, x: number, y: number, w: number, h: number, time: number, a = 0.12): void {
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  for (let i = 0; i < 5; i++) {
    const phase = time * (1.6 + i * 0.35) + i;
    const ox = Math.sin(phase) * 3;
    const oy = ((time * 28 + i * 17) % h) - h * 0.2;
    ctx.globalAlpha = a * (0.35 + Math.sin(phase * 1.7) * 0.25);
    blotchSoft(ctx, x + ox, y + oy, w * (0.35 + (i % 3) * 0.12), 6 + (i % 2) * 3, '#ffcc80');
  }
  ctx.restore();
}

function blotchSoft(ctx: Ctx, x: number, y: number, rx: number, ry: number, color: string): void {
  const g = ctx.createRadialGradient(x, y, 1, x, y, Math.max(rx, ry));
  g.addColorStop(0, rgba(color, 0.55));
  g.addColorStop(1, rgba(color, 0));
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2);
  ctx.fill();
}

/** Glowing projectile ribbon trail. */
export function trailRibbon(
  ctx: Ctx,
  x: number,
  y: number,
  ux: number,
  uy: number,
  color: string,
  big: boolean,
): void {
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  const steps = big ? 12 : 9;
  for (let i = 1; i <= steps; i++) {
    const back = i * (big ? 5.5 : 4.2);
    const fade = 1 - i / (steps + 1);
    ctx.globalAlpha = fade * (big ? 0.55 : 0.42);
    disc(ctx, x - ux * back, y - uy * back, (big ? 7 : 4.2) * fade, color);
    if (i % 2 === 0) disc(ctx, x - ux * back, y - uy * back, (big ? 3 : 1.8) * fade, '#fffde7');
  }
  radial(ctx, x, y, 1, big ? 28 : 18, color, 0.45);
  ctx.restore();
}

/** Floating glitter / dust motes over the battlefield. */
export function sparkleField(ctx: Ctx, time: number, density = 28, color = '#fff8e1'): void {
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  for (let i = 0; i < density; i++) {
    const x = (i * 97 + time * (10 + (i % 4) * 3)) % WORLD_W;
    const y = 20 + ((i * 61 + time * (5 + (i % 3))) % (WORLD_H - 40));
    const twinkle = 0.5 + Math.sin(time * 6 + i * 1.7) * 0.5;
    ctx.globalAlpha = 0.08 + twinkle * 0.18;
    const r = 1 + (i % 3) * 0.6 + twinkle;
    disc(ctx, x, y, r, color);
    if (i % 5 === 0) {
      ctx.strokeStyle = rgba(color, 0.55);
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(x - r * 2.2, y);
      ctx.lineTo(x + r * 2.2, y);
      ctx.moveTo(x, y - r * 2.2);
      ctx.lineTo(x, y + r * 2.2);
      ctx.stroke();
    }
  }
  ctx.restore();
}

/** Status halo under slowed / stunned enemies. */
export function statusHalo(
  ctx: Ctx,
  x: number,
  y: number,
  radius: number,
  kind: 'slow' | 'stun' | 'frozen',
  time: number,
): void {
  const color = kind === 'stun' ? '#ffe082' : kind === 'frozen' ? '#81d4fa' : '#4fc3f7';
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  const pulse = 0.55 + Math.sin(time * (kind === 'stun' ? 10 : 4)) * 0.25;
  radial(ctx, x, y + 4, 2, radius * 1.6, color, 0.22 * pulse);
  ctx.strokeStyle = rgba(color, 0.45 * pulse);
  ctx.lineWidth = kind === 'stun' ? 2.4 : 1.6;
  ctx.setLineDash(kind === 'slow' ? [4, 6] : []);
  ctx.lineDashOffset = -time * (kind === 'stun' ? 40 : 18);
  ctx.beginPath();
  ctx.ellipse(x, y + 6, radius * 1.15, radius * 0.42, 0, 0, Math.PI * 2);
  ctx.stroke();
  ctx.setLineDash([]);
  if (kind === 'stun') {
    for (let i = 0; i < 3; i++) {
      const a = time * 8 + i * 2.1;
      disc(ctx, x + Math.cos(a) * radius * 0.9, y - 18 + Math.sin(a * 1.3) * 4, 1.8, '#fffde7');
    }
  }
  ctx.restore();
}

/** Idle tower idle shimmer — subtle living presence. */
export function towerIdleGlow(ctx: Ctx, x: number, y: number, color: string, time: number, hot: boolean): void {
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  const breath = 0.55 + Math.sin(time * 2.2 + x * 0.01) * 0.45;
  radial(ctx, x, y - 12, 4, hot ? 64 : 36, color, (hot ? 0.32 : 0.1) * breath);
  if (hot) radial(ctx, x, y - 14, 2, 22, '#fffde7', 0.35 * breath);
  ctx.restore();
}
