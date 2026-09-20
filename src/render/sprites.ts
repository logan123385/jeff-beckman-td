import { JEFF } from '../data/jeff';
import { ENEMIES } from '../data/enemies';
import { leakRbe, splitCount, splitOf } from '../data/splits';
import type { Enemy, Hero, Tower } from '../sim/state';
import { leakMax, leakRemaining } from '../sim/combat';
import { paintedEnemy, paintedJeff, paintedTower } from './paintedActors';
import { blotch, brassFill, castShadow, celFill, celShine, CEL_INK, disc, glow, metalFill, mix, noGlow, pulseRing, radial, rgba, ring, rivet, stampText } from './ink';

type Ctx = CanvasRenderingContext2D;

function roundRect(ctx: Ctx, x: number, y: number, w: number, h: number, r: number): void {
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, r);
}

function hpBar(ctx: Ctx, x: number, y: number, w: number, frac: number, color: string): void {
  const h = 7;
  const f = Math.max(0, Math.min(1, frac));
  ctx.fillStyle = 'rgba(20, 12, 8, 0.88)';
  roundRect(ctx, x - w / 2 - 3, y - 3, w + 6, h + 6, 4);
  ctx.fill();
  ctx.strokeStyle = '#c9a15b';
  ctx.lineWidth = 1.4;
  roundRect(ctx, x - w / 2 - 3, y - 3, w + 6, h + 6, 4);
  ctx.stroke();
  ctx.fillStyle = '#1b120c';
  roundRect(ctx, x - w / 2, y, w, h, 2.5);
  ctx.fill();
  const fill = ctx.createLinearGradient(x - w / 2, y, x - w / 2, y + h);
  fill.addColorStop(0, mix(color, '#ffffff', 0.35));
  fill.addColorStop(0.45, color);
  fill.addColorStop(1, mix(color, '#000000', 0.28));
  ctx.fillStyle = fill;
  roundRect(ctx, x - w / 2, y, w * f, h, 2.5);
  ctx.fill();
  ctx.fillStyle = 'rgba(255,255,255,0.35)';
  ctx.fillRect(x - w / 2, y, w * f, 2);
}

// ------------------------------------------------------------------ Jeff
// Kingdom Rush-style hero: chunky silhouette, cel paint, fat ink outlines.

const JEFF_INK = '#1a1008';

function jeffStroke(ctx: Ctx, lw = 2.2): void {
  ctx.strokeStyle = JEFF_INK;
  ctx.lineWidth = lw;
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';
  ctx.stroke();
}

function jeffPaint(ctx: Ctx, fill: string, lw = 2.2): void {
  ctx.fillStyle = fill;
  ctx.fill();
  jeffStroke(ctx, lw);
}

function jeffOval(ctx: Ctx, x: number, y: number, rx: number, ry: number, fill: string, lw = 2.2): void {
  ctx.beginPath();
  ctx.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2);
  jeffPaint(ctx, fill, lw);
}

function jeffBox(ctx: Ctx, x: number, y: number, w: number, h: number, r: number, fill: string, lw = 2.1): void {
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, r);
  jeffPaint(ctx, fill, lw);
}

export function drawJeff(ctx: Ctx, hero: Hero, time: number, showBar = true, scale = 1.72): void {
  if (paintedJeff(ctx, hero, time, showBar, scale)) return;
  const { x, y } = hero.pos;
  ctx.save();
  ctx.translate(x, y);

  if (hero.downed > 0) {
    castShadow(ctx, 0, 8, 18, 6, 0.35);
    ctx.globalAlpha = 0.55;
    ctx.scale(scale, scale);
    ctx.rotate(Math.PI / 2);
    drawJeffBody(ctx, 1, 0, 0, 0, false, false, 0, true);
    ctx.restore();
    stampText(ctx, `${Math.ceil(hero.downed)}s`, x, y - 38, { size: 14, color: '#ffccbc' });
    return;
  }

  const walking = !!hero.dest;
  const hunting = !walking && hero.targetId !== null;
  const walk = walking ? time * 13 : hunting ? time * 11 : 0;
  const bob = walking ? Math.sin(time * 14) * 2.6 : hunting ? Math.sin(time * 12) * 1.5 : Math.sin(time * 2) * 0.9;
  const breath = walking || hunting ? 0 : Math.sin(time * 2.2) * 0.022;
  const lean = walking ? hero.facing * 0.1 : hero.swing > 0 ? hero.facing * (1 - hero.swing / JEFF.swingTime) * 0.28 : 0;
  const blink = (time % 3.9) < 0.11 || ((time + 1.3) % 6.1) < 0.09;
  // selection / combat ground plate under Jeff
  if (hunting || walking) {
    ctx.save();
    glow(ctx, hunting ? '#ff8a65' : '#a5d6a7', 12);
    ctx.strokeStyle = hunting ? '#ffab91' : '#c8e6c9';
    ctx.lineWidth = 2.2;
    ctx.setLineDash([5, 5]);
    ctx.lineDashOffset = -time * 30;
    ctx.beginPath();
    ctx.ellipse(0, 22, 20, 7.5, 0, 0, Math.PI * 2);
    ctx.stroke();
    noGlow(ctx);
    ctx.setLineDash([]);
    ctx.restore();
  }
  if (hero.swing > 0) {
    const k = Math.min(1, hero.swing / JEFF.swingTime);
    for (let i = 2; i >= 1; i--) {
      ctx.save();
      ctx.globalAlpha = 0.18 * k * (i / 2);
      ctx.translate(-hero.facing * (10 + i * 8) * (0.35 + k * 0.4), -i * 2.4);
      ctx.rotate(lean * (1 + i * 0.15));
      ctx.scale(scale * (1 + breath * 0.6), scale * (1 - breath));
      drawJeffBody(ctx, hero.facing, bob, hero.swing + i * 0.05, walk, hero.sleeveTimer > 0, hero.coffeeTimer > 0, time, blink);
      ctx.restore();
    }
  }
  ctx.rotate(lean);
  ctx.scale(scale * (1 + breath * 0.6), scale * (1 - breath));
  drawJeffBody(ctx, hero.facing, bob, hero.swing, walk, hero.sleeveTimer > 0, hero.coffeeTimer > 0, time, blink);
  ctx.restore();

  if (showBar) hpBar(ctx, x, y - 78, 52, hero.hp / hero.maxHp, '#66bb6a');
}

function drawJeffLeg(ctx: Ctx, side: number, phase: number): void {
  ctx.save();
  ctx.translate(side * 5.2, 5.5);
  ctx.rotate(phase * 0.5);
  jeffBox(ctx, -4.2, -1, 8.4, 14, 2.6, '#24344c', 2.3);
  ctx.fillStyle = '#6a87a8';
  ctx.beginPath();
  ctx.roundRect(-2.8, 0, 3.8, 12, 1.4);
  ctx.fill();
  jeffBox(ctx, -5.4, 12.2, 12.2, 6.2, 2, '#3e2723');
  ctx.fillStyle = '#6d4c41';
  ctx.fillRect(-4.2, 12.4, 10, 2.1);
  ctx.fillStyle = '#1a1008';
  ctx.fillRect(-4.6, 16.6, 10.6, 1.6);
  ctx.restore();
}

function easeSlam(k: number): number {
  if (k < 0.22) return k * 0.12;
  const t = (k - 0.22) / 0.78;
  return 0.026 + t * t * t * 0.974;
}

function ventSteam(ctx: Ctx, x: number, y: number, time: number, n: number, color: string): void {
  for (let i = 0; i < n; i++) {
    const life = (time * 0.9 + i * 0.22) % 1;
    blotch(
      ctx,
      x + Math.sin(time * 2.2 + i) * 5,
      y - life * 26,
      3.2 + life * 5,
      4 + life * 6,
      0.18,
      rgba(color, 0.34 * (1 - life)),
    );
  }
}

function gaugeNeedle(ctx: Ctx, x: number, y: number, r: number, ang: number, color: string): void {
  ring(ctx, x, y, r, color, 1.8);
  ctx.strokeStyle = '#fff8e1';
  ctx.lineWidth = 1.8;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(x, y);
  ctx.lineTo(x + Math.cos(ang) * (r - 2), y + Math.sin(ang) * (r - 2));
  ctx.stroke();
  disc(ctx, x, y, 1.6, '#5d4037');
}

function walkLimbs(ctx: Ctx, r: number, stride: number, color: string): void {
  ctx.save();
  ctx.strokeStyle = mix(color, CEL_INK, 0.45);
  ctx.lineWidth = 2.4;
  ctx.lineCap = 'round';
  for (const side of [-1, 1]) {
    const kick = stride * side * 4.2;
    ctx.beginPath();
    ctx.moveTo(side * r * 0.35, r * 0.15);
    ctx.quadraticCurveTo(side * (r * 0.7) + kick * 0.3, r * 0.45, side * r * 0.55 + kick, r * 0.95);
    ctx.stroke();
  }
  ctx.restore();
}

function drawJeffWrench(ctx: Ctx, swing: number): void {
  jeffBox(ctx, -2.3, 14.2, 4.6, 16.2, 1.5, '#90a4ae', 2);
  ctx.fillStyle = '#eceff1';
  ctx.fillRect(-1.2, 15, 1.8, 14);
  ctx.fillStyle = '#546e7a';
  ctx.fillRect(-1.8, 18, 3.6, 1.2);
  ctx.fillRect(-1.8, 23, 3.6, 1.2);
  jeffBox(ctx, -6.2, 28.8, 14.4, 8, 2, '#cfd8dc', 2.2);
  ctx.fillStyle = '#78909c';
  ctx.fillRect(-4.8, 31.4, 11.6, 2.4);
  ctx.beginPath();
  ctx.moveTo(7.2, 29);
  ctx.lineTo(12.4, 27.4);
  ctx.lineTo(12.8, 37.2);
  ctx.lineTo(6.6, 36);
  ctx.closePath();
  jeffPaint(ctx, '#b0bec5', 2);
  ctx.fillStyle = '#eceff1';
  ctx.fillRect(8.2, 30.2, 2.2, 4.4);
  disc(ctx, 0.2, 32.6, 1.8, '#5d4037');
  disc(ctx, 0.2, 32.6, 0.85, '#d7ccc8');
  if (swing > 0) {
    const k = Math.min(1, swing / JEFF.swingTime);
    glow(ctx, '#fff59d', 20);
    ctx.fillStyle = rgba('#fff59d', 0.4 + k * 0.58);
    ctx.beginPath();
    ctx.arc(5, 34, 15 + (1 - k) * 6, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = rgba('#fffde7', 0.55 * k);
    ctx.beginPath();
    ctx.arc(7, 35, 7, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = rgba('#fffde7', 0.7 * k);
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(6, 34, 18 + (1 - k) * 8, -0.6, 1.1);
    ctx.stroke();
    noGlow(ctx);
  }
}

function drawJeffBody(
  ctx: Ctx,
  facing: number,
  bob: number,
  swing: number,
  walk: number,
  sleeve: boolean,
  coffee: boolean,
  time: number,
  blink = false,
): void {
  ctx.save();
  ctx.scale(facing, 1);
  ctx.translate(0, bob);

  blotch(ctx, 0, 23, 16.5, 5.8, 0, 'rgba(0,0,0,0.46)');
  blotch(ctx, 0, 4, 12, 20, 0, 'rgba(16, 8, 4, 0.28)');

  if (coffee) {
    glow(ctx, '#ffcc80', 18);
    radial(ctx, 0, -6, 4, 28, '#ffe082', 0.28);
    noGlow(ctx);
  }
  if (sleeve) {
    glow(ctx, '#8d6e63', 14);
    radial(ctx, 0, -4, 4, 26, '#a1887f', 0.32);
    noGlow(ctx);
  }

  const left = Math.sin(walk);
  const right = Math.sin(walk + Math.PI);

  ctx.save();
  ctx.translate(-8.6, -12);
  ctx.rotate(walk ? right * 0.42 : 0.18);
  jeffBox(ctx, -2.6, 0, 5.2, 13.2, 2.2, '#3d5aa8');
  jeffBox(ctx, -2.8, 12.2, 5.6, 4.2, 1.8, '#e0c9a6', 1.8);
  ctx.restore();

  drawJeffLeg(ctx, -1, left);
  drawJeffLeg(ctx, 1, right);

  jeffBox(ctx, -12.4, -18.5, 24.8, 23.8, 6, '#2f4db0', 2.5);
  ctx.fillStyle = '#1c327c';
  ctx.beginPath();
  ctx.roundRect(1.2, -17.2, 10.6, 21, 4.5);
  ctx.fill();
  ctx.fillStyle = '#7b96ea';
  ctx.beginPath();
  ctx.roundRect(-10.8, -16.8, 10.4, 13.5, 4);
  ctx.fill();
  ctx.fillStyle = rgba('#dbe4ff', 0.55);
  ctx.fillRect(-9.6, -15.6, 3.4, 8.5);
  ctx.fillStyle = '#e8eaf6';
  ctx.beginPath();
  ctx.moveTo(-7.4, -18.5);
  ctx.lineTo(7.4, -18.5);
  ctx.lineTo(4.6, -12.8);
  ctx.lineTo(-4.6, -12.8);
  ctx.closePath();
  ctx.fill();
  jeffStroke(ctx, 2);
  jeffBox(ctx, -9.8, -8.2, 7.6, 6.4, 1.6, '#243c94', 1.8);
  ctx.strokeStyle = '#a1887f';
  ctx.lineWidth = 2.6;
  ctx.beginPath();
  ctx.moveTo(-5.4, -18);
  ctx.lineTo(-4.2, 4.5);
  ctx.moveTo(5.4, -18);
  ctx.lineTo(4.2, 4.5);
  ctx.stroke();

  jeffBox(ctx, -13.2, 2.6, 26.4, 6.2, 2, '#5d4037');
  jeffBox(ctx, -3.2, 1.8, 6.4, 7.4, 1.6, '#c0ca33', 2);
  ctx.fillStyle = '#eeff41';
  ctx.fillRect(-1.6, 3.2, 3.2, 4.4);
  jeffBox(ctx, 7.2, 1.4, 4.2, 8.6, 1.2, '#b0bec5', 1.8);
  ctx.fillStyle = '#eceff1';
  ctx.fillRect(8.2, 2.2, 1.4, 6.6);
  jeffBox(ctx, -11.6, 3.4, 5.6, 4.2, 1, '#8d6e63', 1.6);

  const swingK = swing > 0 ? 1 - swing / JEFF.swingTime : 0;
  const swingAngle = swing > 0 ? -1.62 + easeSlam(swingK) * 2.15 : walk ? 0.22 + left * 0.45 : 0.3;
  if (swing > 0) {
    // motion smear: fan from the raised pose to the current arm angle
    const k = Math.min(1, swingK * 1.35 + (swing > JEFF.swingTime * 0.55 ? 0.35 : 0));
    ctx.save();
    ctx.translate(9.2, -13);
    const g = ctx.createRadialGradient(0, 0, 12, 0, 0, 38);
    g.addColorStop(0, rgba('#fff8e1', 0));
    g.addColorStop(0.7, rgba('#ffe082', 0.42 * k));
    g.addColorStop(1, rgba('#ffe082', 0));
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.arc(0, 0, 38, -1.45 + Math.PI / 2, swingAngle + Math.PI / 2, false);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = rgba('#fffde7', 0.75 * k);
    ctx.lineWidth = 2.6;
    ctx.beginPath();
    ctx.arc(0, 0, 33, -1.45 + Math.PI / 2, swingAngle + Math.PI / 2, false);
    ctx.stroke();
    ctx.restore();
  }
  ctx.save();
  ctx.translate(9.2, -13);
  ctx.rotate(swingAngle);
  jeffBox(ctx, -2.7, 0, 5.4, 13.6, 2.2, '#3d5aa8');
  ctx.fillStyle = '#6d86d4';
  ctx.fillRect(-1.4, 1, 2.2, 10);
  jeffBox(ctx, -2.9, 12.4, 5.8, 4.4, 1.8, '#e0c9a6', 1.8);
  drawJeffWrench(ctx, swing);
  ctx.restore();

  jeffBox(ctx, -3.6, -21, 7.2, 6.4, 2, '#d4b896', 1.8);
  jeffOval(ctx, 0, -28.2, 11.2, 11.6, '#e0c9a6', 2.6);
  jeffOval(ctx, -3.2, -31.2, 5, 4, '#f6e6cf', 0);
  ctx.fillStyle = rgba('#fff6ea', 0.45);
  ctx.beginPath();
  ctx.ellipse(-4.2, -31.8, 2.4, 1.8, -0.4, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.ellipse(0, -32.8, 11.4, 7.4, 0, Math.PI, Math.PI * 2);
  jeffPaint(ctx, '#3e2723', 2.4);
  ctx.fillStyle = '#8d6e63';
  ctx.beginPath();
  ctx.ellipse(-3.6, -34.4, 4.6, 2.8, -0.35, 0, Math.PI * 2);
  ctx.fill();

  jeffOval(ctx, -10.4, -26.4, 2.8, 3.4, '#d4b896', 1.8);
  jeffOval(ctx, 10.4, -26.4, 2.8, 3.4, '#d4b896', 1.8);
  disc(ctx, -10.6, -26.2, 3.15, '#212121');
  disc(ctx, 10.6, -26.2, 3.15, '#212121');
  disc(ctx, -10.6, -26.2, 1.7, '#26c6da');
  disc(ctx, 10.6, -26.2, 1.7, '#26c6da');
  disc(ctx, -11.2, -27, 0.55, '#e0f7fa');
  disc(ctx, 10, -27, 0.55, '#e0f7fa');

  ctx.beginPath();
  ctx.moveTo(-10.2, -24.5);
  ctx.quadraticCurveTo(-11.4, -10.5, 0, -9.2);
  ctx.quadraticCurveTo(11.4, -10.5, 10.2, -24.5);
  ctx.quadraticCurveTo(5.2, -20.6, 0, -20.2);
  ctx.quadraticCurveTo(-5.2, -20.6, -10.2, -24.5);
  jeffPaint(ctx, '#4e342e', 2.4);
  ctx.fillStyle = '#8d6e63';
  ctx.beginPath();
  ctx.ellipse(-4.2, -16.2, 4.4, 5.2, -0.2, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = rgba('#d7ccc8', 0.28);
  ctx.beginPath();
  ctx.ellipse(-5.2, -17.4, 2.2, 2.6, -0.3, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.ellipse(0, -22.4, 8.2, 3.1, 0, 0, Math.PI * 2);
  jeffPaint(ctx, '#3e2723', 1.6);

  ctx.strokeStyle = JEFF_INK;
  ctx.lineWidth = 2.3;
  ctx.beginPath();
  ctx.moveTo(-6.4, -29.6);
  ctx.quadraticCurveTo(-4.2, -31.2, -1.6, -29.8);
  ctx.moveTo(1.8, -29.8);
  ctx.quadraticCurveTo(4.4, -31.2, 6.6, -29.6);
  ctx.stroke();
  ctx.fillStyle = '#fff';
  ctx.beginPath();
  ctx.ellipse(-3.6, -27.4, 2.1, 1.7, 0, 0, Math.PI * 2);
  ctx.ellipse(3.6, -27.4, 2.1, 1.7, 0, 0, Math.PI * 2);
  ctx.fill();
  if (blink) {
    ctx.strokeStyle = JEFF_INK;
    ctx.lineWidth = 1.6;
    ctx.beginPath();
    ctx.moveTo(-5.4, -27.3);
    ctx.lineTo(-1.8, -27.3);
    ctx.moveTo(1.8, -27.3);
    ctx.lineTo(5.4, -27.3);
    ctx.stroke();
  } else {
    const look = walk ? 0.5 : swing > 0 ? 0.8 : Math.sin(time * 0.7) * 0.5;
    ctx.fillStyle = '#1a1008';
    ctx.beginPath();
    ctx.arc(-3.1 + look, -27.3, 1.15, 0, Math.PI * 2);
    ctx.arc(4.1 + look, -27.3, 1.15, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#fff';
    ctx.beginPath();
    ctx.arc(-3.6 + look, -27.9, 0.45, 0, Math.PI * 2);
    ctx.arc(3.6 + look, -27.9, 0.45, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.beginPath();
  ctx.ellipse(0.6, -25.2, 1.7, 1.3, 0, 0, Math.PI * 2);
  jeffPaint(ctx, '#d4b896', 1.4);

  if (sleeve) {
    ctx.save();
    ctx.strokeStyle = rgba('#6d4c41', 0.92);
    ctx.lineWidth = 3.4;
    ctx.setLineDash([6, 4]);
    ctx.lineDashOffset = -time * 28;
    ctx.beginPath();
    ctx.ellipse(0, -5, 15.5, 20, 0.12, 0, Math.PI * 2);
    ctx.stroke();
    ctx.strokeStyle = rgba('#d7ccc8', 0.7);
    ctx.lineWidth = 1.6;
    ctx.beginPath();
    ctx.ellipse(0, -5, 12.5, 16.5, -0.2, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
  }
  if (coffee) {
    ctx.save();
    ctx.globalAlpha = 0.8;
    for (let i = 0; i < 3; i++) {
      const a = time * 3 + i * 1.4;
      blotch(ctx, -4 + i * 4, -44 - Math.sin(a) * 4, 3.2, 5.2, 0.2, rgba('#ffe0b2', 0.45));
    }
    ctx.restore();
  }

  ctx.restore();
}

// ------------------------------------------------------------------ towers

export function drawTowerBase(ctx: Ctx, x: number, y: number, color: string): void {
  castShadow(ctx, x, y + 18, 28, 10, 0.48);
  ctx.beginPath();
  ctx.ellipse(x, y + 10, 26, 15, 0, 0, Math.PI * 2);
  celFill(ctx, '#3a2a1c', 2.8);
  ctx.beginPath();
  ctx.ellipse(x, y + 8, 22, 13, 0, 0, Math.PI * 2);
  celFill(ctx, '#6a4a2e', 2.4);
  ctx.beginPath();
  ctx.ellipse(x, y + 6, 17, 9.5, 0, 0, Math.PI * 2);
  celFill(ctx, '#5d4037', 2.1);
  ctx.fillStyle = brassFill(ctx, x - 22, y - 2, 44, 18);
  ctx.beginPath();
  ctx.ellipse(x, y + 6, 21, 12, 0, 0, Math.PI * 2);
  ctx.strokeStyle = mix(color, '#c9a15b', 0.4);
  ctx.lineWidth = 3.6;
  ctx.stroke();
  ring(ctx, x, y + 6, 16, mix('#fff8e1', color, 0.45), 1.8);
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2;
    rivet(ctx, x + Math.cos(a) * 21, y + 6 + Math.sin(a) * 12, 2.2);
  }
  celShine(ctx, x - 6, y + 1, 9, 4, 0.28);
}

/** Empty Kingdom-Rush-style build pad. */
export function drawBuildPad(ctx: Ctx, x: number, y: number, hot: boolean, accent: string, time: number): void {
  castShadow(ctx, x, y + 12, 26, 9, 0.45);
  if (hot) {
    radial(ctx, x, y, 4, 48, '#ffe082', 0.38);
    pulseRing(ctx, x, y + 2, 26 + Math.sin(time * 5) * 2, '#ffe082', 0.7, 2.4);
  }
  ctx.beginPath();
  ctx.ellipse(x, y + 4, 24, 14, 0, 0, Math.PI * 2);
  celFill(ctx, hot ? '#5d4a28' : '#3e3226', 2.6);
  ctx.beginPath();
  ctx.ellipse(x, y + 2, 17, 10, 0, 0, Math.PI * 2);
  celFill(ctx, hot ? '#8d6e4a' : '#5d4a38', 2.2);
  ring(ctx, x, y + 3, 19, hot ? '#ffe082' : mix(accent, '#cfd8dc', 0.4), hot ? 3 : 2);
  for (let i = 0; i < 4; i++) {
    const a = (i / 4) * Math.PI * 2 + Math.PI / 4;
    rivet(ctx, x + Math.cos(a) * 19, y + 3 + Math.sin(a) * 11, 1.9);
  }
  const pulse = 0.5 + Math.sin(time * 4) * 0.22;
  disc(ctx, x, y, 5.5, rgba(hot ? '#ffe082' : accent, pulse));
  disc(ctx, x - 1.2, y - 1.6, 1.8, rgba('#ffffff', 0.5));
  ctx.strokeStyle = hot ? '#fff8e1' : rgba('#fff8e1', 0.6);
  ctx.lineWidth = 2.4;
  ctx.beginPath();
  ctx.moveTo(x - 7, y);
  ctx.lineTo(x + 7, y);
  ctx.moveTo(x, y - 7);
  ctx.lineTo(x, y + 7);
  ctx.stroke();
}

export function drawTower(ctx: Ctx, t: Tower, time: number): void {
  if (paintedTower(ctx, t, time)) return;
  const { x, y } = t.pos;
  const kick = t.recoil > 0 ? t.recoil * 22 : 0;
  const bob = t.frozen > 0 ? 0 : Math.sin(time * 3.15 + t.id * 2.05) * 1.25;
  const breathe = 1 + Math.sin(time * 2.35 + t.id) * 0.018 + (t.recoil > 0 ? t.recoil * 0.12 : 0);
  ctx.save();
  ctx.translate(x, y + bob);
  ctx.scale(breathe, 1 / Math.max(0.92, breathe));
  ctx.translate(-x, -(y + bob));
  if (t.frozen > 0) ctx.filter = 'saturate(0.2) brightness(1.3)';
  drawTowerBase(ctx, x, y, t.def.color);
  if (t.def.kind === 'aura' && t.frozen <= 0) {
    const pulse = 0.14 + Math.sin(time * 4.4 + t.id) * 0.07;
    radial(ctx, x, y - 8, 6, 36 + t.level * 5, t.def.color, pulse);
    ring(ctx, x, y + 4, 18 + Math.sin(time * 3 + t.id) * 2, rgba(t.def.color, 0.35), 1.6);
  }
  if (t.recoil > 0) {
    radial(ctx, x, y - 12, 2, 30 + t.recoil * 40, t.def.color, Math.min(0.55, t.recoil * 3.2));
    radial(ctx, x, y - 12, 1, 16, '#fff8e1', Math.min(0.45, t.recoil * 2.4));
  }
  ctx.save();
  ctx.translate(x, y + 2);
  ctx.scale(1.16, 1.16);
  ctx.translate(-x, -(y + 2));

  switch (t.def.id) {
    case 'torch': {
      roundRect(ctx, x - 8, y - 24, 16, 24, 5);
      ctx.fillStyle = metalFill(ctx, x - 8, y - 24, 16, 24, '#607d8b');
      ctx.fill();
      ctx.strokeStyle = CEL_INK;
      ctx.lineWidth = 2.2;
      ctx.stroke();
      rivet(ctx, x - 4, y - 6, 1.6);
      rivet(ctx, x + 4, y - 6, 1.6);
      ctx.save();
      ctx.translate(x, y - 14);
      ctx.rotate(t.facing);
      roundRect(ctx, 4 - kick, -3.5, 20, 7, 2);
      ctx.fillStyle = metalFill(ctx, 4 - kick, -3.5, 20, 7, '#cfd8dc');
      ctx.fill();
      ctx.strokeStyle = CEL_INK;
      ctx.lineWidth = 1.8;
      ctx.stroke();
      glow(ctx, t.def.color, 14);
      ctx.beginPath();
      ctx.moveTo(22 - kick, -3.4);
      ctx.lineTo(34 - kick + Math.sin(time * 46) * 3.2, Math.sin(time * 28) * 1.4);
      ctx.lineTo(22 - kick, 3.4);
      ctx.closePath();
      celFill(ctx, t.def.color, 1.6);
      ctx.fillStyle = rgba('#fffde7', 0.55 + Math.sin(time * 30) * 0.2);
      ctx.beginPath();
      ctx.moveTo(24 - kick, -1.4);
      ctx.lineTo(30 - kick, 0);
      ctx.lineTo(24 - kick, 1.4);
      ctx.closePath();
      ctx.fill();
      noGlow(ctx);
      ctx.restore();
      break;
    }
    case 'washer': {
      roundRect(ctx, x - 13, y - 20, 26, 20, 5);
      ctx.fillStyle = brassFill(ctx, x - 13, y - 20, 26, 20);
      ctx.fill();
      ctx.strokeStyle = CEL_INK;
      ctx.lineWidth = 2.2;
      ctx.stroke();
      rivet(ctx, x - 9, y - 16, 1.8);
      rivet(ctx, x + 9, y - 16, 1.8);
      ctx.fillStyle = '#1a1008';
      roundRect(ctx, x - 9, y - 15, 18, 5, 2);
      ctx.fill();
      ctx.fillStyle = '#4fc3f7';
      ctx.globalAlpha = 0.55 + Math.sin(time * 5) * 0.2;
      roundRect(ctx, x - 7, y - 14, 14, 3, 1);
      ctx.fill();
      ctx.globalAlpha = 1;
      ctx.save();
      ctx.translate(x, y - 10);
      ctx.rotate(t.facing);
      ctx.strokeStyle = CEL_INK;
      ctx.lineWidth = 5;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(6, 0);
      ctx.lineTo(24 - kick, 0);
      ctx.stroke();
      ctx.strokeStyle = '#546e7a';
      ctx.lineWidth = 3;
      ctx.stroke();
      roundRect(ctx, 21 - kick, -4, 7, 8, 2);
      celFill(ctx, t.def.color, 1.6);
      ctx.restore();
      break;
    }
    case 'apprentices': case 'jayjay': case 'cbjDoni':
    case 'barricade': {
      roundRect(ctx, x - 11, y - 16, 22, 16, 4);
      ctx.fillStyle = metalFill(ctx, x - 11, y - 16, 22, 16, '#90a4ae');
      ctx.fill();
      ctx.strokeStyle = CEL_INK;
      ctx.lineWidth = 2.2;
      ctx.stroke();
      glow(ctx, t.def.color, 8);
      ctx.strokeStyle = t.def.color;
      ctx.lineWidth = 3.4;
      ctx.beginPath();
      ctx.arc(x, y - 20, 9, 0, Math.PI * 2);
      ctx.stroke();
      noGlow(ctx);
      ctx.strokeStyle = CEL_INK;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(x - 9, y - 20);
      ctx.lineTo(x + 9, y - 20);
      ctx.moveTo(x, y - 29);
      ctx.lineTo(x, y - 11);
      ctx.stroke();
      rivet(ctx, x - 7, y - 8, 1.7);
      rivet(ctx, x + 7, y - 8, 1.7);
      break;
    }
    case 'vent': {
      roundRect(ctx, x - 7, y - 36, 14, 36, 3);
      ctx.fillStyle = metalFill(ctx, x - 7, y - 36, 14, 36, '#90a4ae');
      ctx.fill();
      ctx.strokeStyle = CEL_INK;
      ctx.lineWidth = 2;
      ctx.stroke();
      roundRect(ctx, x - 10, y - 38, 20, 6, 2);
      ctx.fillStyle = metalFill(ctx, x - 10, y - 38, 20, 6, '#607d8b');
      ctx.fill();
      ctx.stroke();
      ctx.save();
      ctx.translate(x, y - 42);
      ctx.rotate(time * 7);
      glow(ctx, '#eceff1', 6);
      for (let i = 0; i < 4; i++) {
        ctx.rotate(Math.PI / 2);
        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.lineTo(10, 1);
        ctx.lineTo(10, -1);
        ctx.closePath();
        celFill(ctx, '#cfd8dc', 1.4);
      }
      noGlow(ctx);
      ctx.restore();
      break;
    }
    case 'radiant': {
      glow(ctx, t.def.color, 10);
      ctx.strokeStyle = t.def.color;
      ctx.lineWidth = 4;
      ctx.lineCap = 'round';
      ctx.beginPath();
      for (let i = 0; i < 5; i++) {
        const yy = y - 2 - i * 5;
        ctx.moveTo(x - 13, yy);
        ctx.lineTo(x + 13, yy);
      }
      ctx.stroke();
      noGlow(ctx);
      ctx.strokeStyle = CEL_INK;
      ctx.lineWidth = 1.6;
      ctx.stroke();
      ctx.strokeStyle = '#ffccbc';
      ctx.lineWidth = 2;
      ctx.globalAlpha = 0.55 + Math.sin(time * 5) * 0.35;
      ctx.beginPath();
      ctx.moveTo(x + 13, y - 2);
      ctx.lineTo(x + 13, y - 22);
      ctx.moveTo(x - 13, y - 7);
      ctx.lineTo(x - 13, y - 17);
      ctx.stroke();
      ctx.globalAlpha = 1;
      break;
    }
    case 'expansion': {
      roundRect(ctx, x - 4, y - 12, 8, 12, 2);
      ctx.fillStyle = metalFill(ctx, x - 4, y - 12, 8, 12, '#78909c');
      ctx.fill();
      ctx.strokeStyle = CEL_INK;
      ctx.lineWidth = 1.8;
      ctx.stroke();
      ctx.beginPath();
      ctx.ellipse(x, y - 24, 13, 14, 0, 0, Math.PI * 2);
      celFill(ctx, '#e53935', 2.4);
      celShine(ctx, x - 5, y - 30, 5, 4, 0.35);
      if (t.shieldCooldown <= 0) {
        pulseRing(ctx, x, y - 24, 17, t.def.color, 0.55 + Math.sin(time * 3) * 0.25, 2.6);
      }
      break;
    }
    case 'pipeSnake': {
      const slither = Math.sin(time * 5 + t.id) * 4;
      glow(ctx, t.def.color, 8);
      ctx.strokeStyle = t.def.color;
      ctx.lineWidth = 5.4;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(x - 11, y + 2);
      ctx.quadraticCurveTo(x - 14 + slither, y - 18, x + slither * 0.4, y - 22);
      ctx.quadraticCurveTo(x + 14 - slither, y - 18, x + 9, y - 4 + slither * 0.2);
      ctx.stroke();
      noGlow(ctx);
      ctx.strokeStyle = CEL_INK;
      ctx.lineWidth = 2;
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(x + 9, y - 4 + slither * 0.2, 5.2, 0, Math.PI * 2);
      celFill(ctx, '#5d4037', 1.8);
      ctx.fillStyle = '#ffe082';
      roundRect(ctx, x + 11, y - 6 + slither * 0.2, 8, 3.2, 1);
      ctx.fill();
      disc(ctx, x + 16, y - 4.4 + slither * 0.2, 1.4, '#fffde7');
      break;
    }
    case 'backflow': {
      ctx.strokeStyle = CEL_INK;
      ctx.lineWidth = 5;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.beginPath();
      ctx.moveTo(x + 13, y - 8);
      ctx.lineTo(x - 9, y - 8);
      ctx.lineTo(x - 2, y - 17);
      ctx.moveTo(x - 9, y - 8);
      ctx.lineTo(x - 2, y + 1);
      ctx.stroke();
      ctx.strokeStyle = t.def.color;
      ctx.lineWidth = 3.2;
      ctx.stroke();
      ctx.strokeStyle = '#80cbc4';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(x + 13, y + 3);
      ctx.lineTo(x - 4, y + 3);
      ctx.stroke();
      break;
    }
    case 'descaler': {
      ctx.beginPath();
      ctx.moveTo(x - 9, y + 4);
      ctx.lineTo(x - 11, y - 20);
      ctx.lineTo(x + 11, y - 20);
      ctx.lineTo(x + 9, y + 4);
      ctx.closePath();
      celFill(ctx, '#7cb342', 2.2);
      celShine(ctx, x - 3, y - 12, 6, 4, 0.28);
      roundRect(ctx, x - 5, y - 26, 10, 7, 2);
      celFill(ctx, '#33691e', 1.6);
      glow(ctx, '#c5e1a5', 8);
      ctx.beginPath();
      ctx.arc(x + 7, y - 30 + Math.sin(time * 3) * 2, 3.5, 0, Math.PI * 2);
      celFill(ctx, 'rgba(197,225,165,0.85)', 1.4);
      noGlow(ctx);
      break;
    }
    case 'circulator': {
      ctx.beginPath();
      ctx.arc(x, y - 12, 12, 0, Math.PI * 2);
      celFill(ctx, '#1565c0', 2.4);
      celShine(ctx, x - 4, y - 16, 5, 4, 0.35);
      ctx.save();
      ctx.translate(x, y - 12);
      ctx.rotate(time * 9);
      glow(ctx, '#bbdefb', 6);
      for (let i = 0; i < 3; i++) {
        ctx.rotate((Math.PI * 2) / 3);
        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.lineTo(9, 2.5);
        ctx.lineTo(9, -2.5);
        ctx.closePath();
        celFill(ctx, '#bbdefb', 1.4);
      }
      noGlow(ctx);
      ctx.restore();
      break;
    }
    case 'prv': {
      roundRect(ctx, x - 7, y - 9, 14, 11, 3);
      ctx.fillStyle = metalFill(ctx, x - 7, y - 9, 14, 11, '#ad1457');
      ctx.fill();
      ctx.strokeStyle = CEL_INK;
      ctx.lineWidth = 2;
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(x - 9, y - 8);
      ctx.lineTo(x, y - 28);
      ctx.lineTo(x + 9, y - 8);
      ctx.closePath();
      celFill(ctx, t.def.color, 2);
      const pip = Math.min(1, t.charge / (t.def.levels[t.level]!.chargeNeed ?? 8));
      ctx.fillStyle = '#1a1008';
      roundRect(ctx, x - 6, y - 7, 12, 4, 1);
      ctx.fill();
      ctx.fillStyle = '#fffde7';
      roundRect(ctx, x - 5, y - 6, 10 * pip, 2.5, 1);
      ctx.fill();
      break;
    }
    case 'boiler': {
      roundRect(ctx, x - 13, y - 24, 26, 26, 5);
      ctx.fillStyle = metalFill(ctx, x - 13, y - 24, 26, 26, '#5d4037');
      ctx.fill();
      ctx.strokeStyle = CEL_INK;
      ctx.lineWidth = 2.4;
      ctx.stroke();
      rivet(ctx, x - 9, y - 20, 1.8);
      rivet(ctx, x + 9, y - 20, 1.8);
      roundRect(ctx, x - 9, y - 15, 8, 11, 2);
      celFill(ctx, t.def.color, 1.6);
      glow(ctx, '#ffab91', 10);
      ctx.beginPath();
      ctx.arc(x - 5, y - 18 - Math.sin(time * 8) * 2.5, 3.5, 0, Math.PI * 2);
      celFill(ctx, '#ffab91', 1.4);
      noGlow(ctx);
      roundRect(ctx, x + 4, y - 30, 7, 9, 2);
      celFill(ctx, '#3e2723', 1.6);
      break;
    }
    case 'hammerDrill': {
      roundRect(ctx, x - 9, y - 18, 18, 18, 4);
      ctx.fillStyle = brassFill(ctx, x - 9, y - 18, 18, 18);
      ctx.fill();
      ctx.strokeStyle = CEL_INK;
      ctx.lineWidth = 2.2;
      ctx.stroke();
      ctx.save();
      ctx.translate(x, y - 10);
      ctx.rotate(t.facing);
      roundRect(ctx, 4 - kick, -3.5, 18, 7, 2);
      ctx.fillStyle = metalFill(ctx, 4 - kick, -3.5, 18, 7, '#90a4ae');
      ctx.fill();
      ctx.stroke();
      roundRect(ctx, 18 - kick, -5, 6, 10, 2);
      celFill(ctx, t.def.color, 1.6);
      ctx.restore();
      break;
    }
    case 'glycol': {
      roundRect(ctx, x - 9, y - 22, 18, 22, 5);
      ctx.fillStyle = metalFill(ctx, x - 9, y - 22, 18, 22, '#00838f');
      ctx.fill();
      ctx.strokeStyle = CEL_INK;
      ctx.lineWidth = 2.2;
      ctx.stroke();
      glow(ctx, t.def.color, 10);
      ctx.globalAlpha = 0.55 + Math.sin(time * 5) * 0.25;
      ctx.beginPath();
      ctx.arc(x, y - 26, 6, 0, Math.PI * 2);
      celFill(ctx, t.def.color, 1.6);
      ctx.globalAlpha = 1;
      noGlow(ctx);
      ctx.strokeStyle = '#e0f7fa';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(x + 9, y - 10);
      ctx.lineTo(x + 15, y - 20);
      ctx.stroke();
      break;
    }
    case 'sump': {
      ctx.beginPath();
      ctx.arc(x, y - 6, 13, 0, Math.PI * 2);
      celFill(ctx, '#283593', 2.4);
      celShine(ctx, x - 4, y - 10, 5, 4, 0.3);
      ctx.save();
      ctx.translate(x, y - 6);
      ctx.rotate(time * 5.5);
      glow(ctx, '#c5cae9', 6);
      ctx.strokeStyle = '#c5cae9';
      ctx.lineWidth = 2.6;
      ctx.beginPath();
      ctx.arc(0, 0, 8, 0, Math.PI * 1.35);
      ctx.stroke();
      noGlow(ctx);
      ctx.restore();
      break;
    }
    case 'camera': {
      roundRect(ctx, x - 10, y - 16, 20, 14, 4);
      ctx.fillStyle = metalFill(ctx, x - 10, y - 16, 20, 14, '#546e7a');
      ctx.fill();
      ctx.strokeStyle = CEL_INK;
      ctx.lineWidth = 2.2;
      ctx.stroke();
      const look = Math.sin(time * 1.6 + t.id) * 2.2;
      ctx.beginPath();
      ctx.arc(x + 2 + look, y - 9, 5.5, 0, Math.PI * 2);
      celFill(ctx, t.def.color, 1.8);
      celShine(ctx, x + 1 + look, y - 11, 2, 1.6, 0.45);
      disc(ctx, x + 3 + look, y - 9, 1.8, '#1a1008');
      disc(ctx, x + 3.6 + look, y - 9.6, 0.7, '#fffde7');
      roundRect(ctx, x - 3, y - 24, 5, 9, 1);
      celFill(ctx, '#c9a15b', 1.4);
      glow(ctx, '#ffe082', 6);
      disc(ctx, x - 1, y - 24, 2, '#fffde7');
      noGlow(ctx);
      break;
    }
    case 'manifold': {
      glow(ctx, t.def.color, 8);
      ctx.strokeStyle = t.def.color;
      ctx.lineWidth = 4.5;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.beginPath();
      ctx.moveTo(x - 13, y + 2);
      ctx.lineTo(x, y - 9);
      ctx.lineTo(x + 13, y + 2);
      ctx.moveTo(x, y - 9);
      ctx.lineTo(x, y - 24);
      ctx.stroke();
      noGlow(ctx);
      ctx.strokeStyle = CEL_INK;
      ctx.lineWidth = 1.8;
      ctx.stroke();
      for (const [px, py] of [
        [x - 13, y + 2],
        [x + 13, y + 2],
        [x, y - 24],
      ] as const) {
        ctx.beginPath();
        ctx.arc(px, py, 4, 0, Math.PI * 2);
        celFill(ctx, '#ffccbc', 1.6);
      }
      break;
    }
    case 'mixingValve': {
      ctx.beginPath();
      ctx.arc(x, y - 10, 11, 0, Math.PI * 2);
      celFill(ctx, '#ef6c00', 2.4);
      celShine(ctx, x - 3, y - 14, 4, 3, 0.3);
      ctx.fillStyle = '#29b6f6';
      ctx.beginPath();
      ctx.arc(x - 4, y - 12, 4.5, 0, Math.PI);
      ctx.fill();
      ctx.fillStyle = '#ff8a65';
      ctx.beginPath();
      ctx.arc(x + 4, y - 12, 4.5, Math.PI, Math.PI * 2);
      ctx.fill();
      rivet(ctx, x, y - 10, 2);
      break;
    }
    case 'airSeparator': {
      roundRect(ctx, x - 8, y - 20, 16, 20, 5);
      ctx.fillStyle = metalFill(ctx, x - 8, y - 20, 16, 20, '#90a4ae');
      ctx.fill();
      ctx.strokeStyle = CEL_INK;
      ctx.lineWidth = 2.2;
      ctx.stroke();
      glow(ctx, t.def.color, 8);
      ctx.strokeStyle = t.def.color;
      ctx.lineWidth = 2.4;
      ctx.beginPath();
      ctx.arc(x, y - 28, 7, 0, Math.PI * 2);
      ctx.stroke();
      noGlow(ctx);
      ctx.fillStyle = 'rgba(227,242,253,0.8)';
      ctx.beginPath();
      ctx.arc(x + 9, y - 30 + Math.sin(time * 4) * 2.5, 3.5, 0, Math.PI * 2);
      ctx.fill();
      break;
    }
    case 'thermostat': {
      roundRect(ctx, x - 10, y - 22, 20, 22, 4);
      ctx.fillStyle = metalFill(ctx, x - 10, y - 22, 20, 22, '#eceff1');
      ctx.fill();
      ctx.strokeStyle = CEL_INK;
      ctx.lineWidth = 2.2;
      ctx.stroke();
      ctx.strokeStyle = t.def.color;
      ctx.lineWidth = 2.4;
      ctx.beginPath();
      ctx.arc(x, y - 12, 7, 0, Math.PI * 2);
      ctx.moveTo(x, y - 12);
      ctx.lineTo(x + Math.cos(time) * 5, y - 12 + Math.sin(time) * 5);
      ctx.stroke();
      rivet(ctx, x - 6, y - 18, 1.5);
      rivet(ctx, x + 6, y - 18, 1.5);
      break;
    }
    case 'heatExchanger': {
      glow(ctx, t.def.color, 8);
      ctx.strokeStyle = t.def.color;
      ctx.lineWidth = 3.4;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.beginPath();
      ctx.moveTo(x - 11, y + 2);
      ctx.lineTo(x - 11, y - 20);
      ctx.lineTo(x + 11, y - 9);
      ctx.lineTo(x + 11, y + 2);
      ctx.stroke();
      noGlow(ctx);
      ctx.strokeStyle = '#ffccbc';
      ctx.lineWidth = 2.4;
      ctx.beginPath();
      ctx.moveTo(x + 11, y + 2);
      ctx.lineTo(x + 11, y - 20);
      ctx.lineTo(x - 11, y - 9);
      ctx.stroke();
      break;
    }
    case 'dirtSep': {
      ctx.beginPath();
      ctx.arc(x, y - 8, 12, 0, Math.PI * 2);
      celFill(ctx, '#6d4c41', 2.4);
      celShine(ctx, x - 3, y - 12, 4, 3, 0.28);
      ctx.beginPath();
      ctx.arc(x - 3, y - 10, 4.5, 0, Math.PI * 2);
      celFill(ctx, t.def.color, 1.6);
      ctx.strokeStyle = '#d7ccc8';
      ctx.lineWidth = 2.4;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(x + 7, y - 4);
      ctx.lineTo(x + 15, y + 3);
      ctx.stroke();
      break;
    }
    case 'steamTrap': {
      roundRect(ctx, x - 9, y - 16, 18, 16, 4);
      ctx.fillStyle = metalFill(ctx, x - 9, y - 16, 18, 16, '#607d8b');
      ctx.fill();
      ctx.strokeStyle = CEL_INK;
      ctx.lineWidth = 2.2;
      ctx.stroke();
      rivet(ctx, x - 5, y - 5, 1.6);
      rivet(ctx, x + 5, y - 5, 1.6);
      ctx.beginPath();
      ctx.moveTo(x - 5, y - 16);
      ctx.lineTo(x, y - 28);
      ctx.lineTo(x + 5, y - 16);
      ctx.closePath();
      celFill(ctx, t.def.color, 1.8);
      glow(ctx, '#e0f7fa', 8);
      ctx.beginPath();
      ctx.arc(x + 2, y - 30 + Math.sin(time * 6) * 2.5, 3, 0, Math.PI * 2);
      celFill(ctx, 'rgba(224,247,250,0.85)', 1.4);
      noGlow(ctx);
      break;
    }
    case 'zoneValve': {
      roundRect(ctx, x - 11, y - 14, 22, 14, 4);
      ctx.fillStyle = brassFill(ctx, x - 11, y - 14, 22, 14);
      ctx.fill();
      ctx.strokeStyle = CEL_INK;
      ctx.lineWidth = 2.2;
      ctx.stroke();
      glow(ctx, t.def.color, 8);
      ctx.strokeStyle = t.def.color;
      ctx.lineWidth = 3.4;
      ctx.beginPath();
      ctx.arc(x, y - 20, 8, 0, Math.PI * 2);
      ctx.stroke();
      noGlow(ctx);
      ctx.strokeStyle = CEL_INK;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(x - 8, y - 20);
      ctx.lineTo(x + 8, y - 20);
      ctx.moveTo(x, y - 28);
      ctx.lineTo(x, y - 12);
      ctx.stroke();
      rivet(ctx, x - 7, y - 7, 1.7);
      rivet(ctx, x + 7, y - 7, 1.7);
      break;
    }
    default: {
      ctx.restore();
      const _exhaustive: never = t.def.id;
      return _exhaustive;
    }
  }
  ctx.restore();

  drawTowerLife(ctx, t, time);

  // idle life: brass level rings turn, upgraded rigs vent steam
  if (t.level > 0 && t.rebuild <= 0) {
    ctx.save();
    ctx.globalAlpha = 0.7;
    ctx.strokeStyle = mix(t.def.color, '#ffe082', 0.55);
    ctx.lineWidth = 2.4;
    ctx.setLineDash([5, 5]);
    ctx.lineDashOffset = -time * (16 + t.level * 10);
    ctx.beginPath();
    ctx.ellipse(x, y + 6, 25 + t.level * 2.5, 13.5 + t.level, 0, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
  }
  if (t.level === 2 && t.def.kind !== 'barricade') {
    for (let i = 0; i < 4; i++) {
      const life = ((time * 0.95 + i * 0.28) % 1);
      blotch(
        ctx,
        x + 8 + Math.sin(time * 2 + i) * 4,
        y - 32 - life * 28,
        4 + life * 5,
        4.5 + life * 6,
        0.2,
        rgba('#fff8e1', 0.38 * (1 - life)),
      );
    }
  }
  if (t.recoil > 0) {
    ctx.save();
    ctx.globalAlpha = Math.min(1, t.recoil * 6);
    ring(ctx, x, y + 6, 24 + (0.2 - Math.min(0.2, t.recoil)) * 40, rgba(t.def.color, 0.7), 2.4);
    // recoil dust kick
    for (let i = 0; i < 3; i++) {
      disc(
        ctx,
        x + (i - 1) * 8 + Math.sin(time * 20 + i) * 2,
        y + 10,
        2 + t.recoil * 8,
        rgba('#c9a15b', 0.35 * t.recoil * 5),
      );
    }
    ctx.restore();
  }

  // level pips
  for (let i = 0; i <= t.level; i++) {
    ctx.fillStyle = '#ffe082';
    ctx.beginPath();
    ctx.arc(x - 6 + i * 6, y + 10, 2.4, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#fff8e1';
    ctx.beginPath();
    ctx.arc(x - 7 + i * 6, y + 9, 1, 0, Math.PI * 2);
    ctx.fill();
  }

  if (t.frozen > 0) {
    ctx.filter = 'none';
    ctx.fillStyle = 'rgba(129,212,250,0.42)';
    ctx.beginPath();
    ctx.ellipse(x, y - 8, 26, 34, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = 'rgba(227,242,253,0.7)';
    ctx.lineWidth = 2;
    ctx.stroke();
  }
  ctx.restore();
}

function drawTowerLife(ctx: Ctx, t: Tower, time: number): void {
  const { x, y } = t.pos;
  switch (t.def.id) {
    case 'boiler':
    case 'steamTrap':
    case 'glycol':
    case 'radiant':
    case 'vent':
    case 'heatExchanger':
    case 'airSeparator':
      ventSteam(ctx, x + 6, y - 28, time + t.id, 3 + t.level, '#fff8e1');
      break;
    case 'prv':
    case 'thermostat':
    case 'camera':
      gaugeNeedle(ctx, x + 10, y - 6, 5.5, time * 1.8 + t.id + t.recoil * 8, t.def.color);
      break;
    case 'zoneValve':
    case 'expansion':
    case 'mixingValve':
    case 'apprentices': case 'jayjay': case 'cbjDoni':
    case 'barricade': {
      ctx.save();
      ctx.translate(x - 12, y - 6);
      ctx.rotate(time * 1.6 + t.id);
      ctx.strokeStyle = mix(t.def.color, '#ffe082', 0.4);
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(-5, 0);
      ctx.lineTo(5, 0);
      ctx.moveTo(0, -5);
      ctx.lineTo(0, 5);
      ctx.stroke();
      ctx.restore();
      break;
    }
    case 'torch':
    case 'washer':
    case 'pipeSnake':
    case 'backflow':
    case 'descaler':
    case 'circulator':
    case 'hammerDrill':
    case 'sump':
    case 'manifold':
    case 'dirtSep':
      if (t.recoil > 0) ventSteam(ctx, x + 4, y - 18, time, 2, t.def.color);
      break;
    default: {
      const _exhaustive: never = t.def.id;
      return _exhaustive;
    }
  }
}

/** Barricade gate at the rally point, with its durability bar. */
export function drawValveGate(ctx: Ctx, t: Tower): void {
  const { x, y } = t.rally;
  ctx.save();
  ctx.setLineDash([3, 4]);
  ctx.strokeStyle = 'rgba(231,76,60,0.5)';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(t.pos.x, t.pos.y);
  ctx.lineTo(x, y);
  ctx.stroke();
  ctx.setLineDash([]);

  const broken = t.rebuild > 0;
  ctx.globalAlpha = broken ? 0.35 : 1;
  castShadow(ctx, x, y + 8, 14, 5, 0.4);
  ctx.beginPath();
  ctx.arc(x, y, 13, 0, Math.PI * 2);
  celFill(ctx, '#b71c1c', 2.6);
  celShine(ctx, x - 4, y - 5, 4, 3, 0.35);
  ctx.strokeStyle = '#ef9a9a';
  ctx.lineWidth = 3.2;
  ctx.beginPath();
  ctx.arc(x, y, 8, 0, Math.PI * 2);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(x - 10, y);
  ctx.lineTo(x + 10, y);
  ctx.moveTo(x, y - 10);
  ctx.lineTo(x, y + 10);
  ctx.stroke();
  rivet(ctx, x - 8, y - 8, 1.8);
  rivet(ctx, x + 8, y - 8, 1.8);
  rivet(ctx, x - 8, y + 8, 1.8);
  rivet(ctx, x + 8, y + 8, 1.8);
  ctx.globalAlpha = 1;
  hpBar(ctx, x, y - 20, 28, t.hp / t.maxHp, broken ? '#9e9e9e' : '#ef5350');
  ctx.restore();
}

// ------------------------------------------------------------------ enemies

/** Child pips under a parent leak so the split reads on the yard, not just the HUD. */
export function drawSplitTell(ctx: Ctx, e: Enemy, hovered: boolean): void {
  if (e.dead || e.escaped) return;
  const def = splitOf(e.def.id);
  if (!def) return;
  const n = splitCount(e.def.id, e.properties.includes('pressurized'));
  if (n <= 0) return;
  const child = ENEMIES[def.child];
  const x = e.pos.x;
  const y = e.pos.y + e.def.radius + 9;
  ctx.save();
  for (let i = 0; i < n; i++) {
    disc(ctx, x - ((n - 1) * 5) + i * 10, y, hovered ? 3.6 : 2.8, child.color);
  }
  if (hovered) {
    stampText(ctx, `→${n} ${child.name}`, x, y + 14, { size: 11, color: '#ffe082' });
    stampText(ctx, `${leakRbe(e.def.id, e.properties.includes('pressurized'))} lives if they walk`, x, y + 26, { size: 10, color: '#ffcc80' });
  }
  ctx.restore();
}

export function drawEnemy(ctx: Ctx, e: Enemy, time: number, dir?: { x: number; y: number }): void {
  if (paintedEnemy(ctx, e, time, dir)) return;
  const { x, y } = e.pos;
  const r = e.def.radius;
  ctx.save();
  if (e.phased) ctx.globalAlpha = 0.3;
  const lift = e.def.flying ? 16 + Math.sin(time * 4 + e.wobble) * 4 : 0;
  const hop = e.def.flying ? 0 : Math.abs(Math.sin(e.wobble * 2.05)) * 3.2;
  const moving = e.heldBy === null && e.stun <= 0;
  const stride = Math.sin(e.wobble * 2.05);
  const hit = Math.max(0, e.hitFlash);
  const squash = moving && !e.def.flying ? stride * 0.12 : e.def.flying ? Math.sin(time * 6.4 + e.wobble) * 0.055 : 0;
  const hitSquash = hit * 0.55;
  const face = dir && dir.x < -0.2 ? -1 : 1;
  const lean = dir && moving ? dir.y * 0.14 + (e.def.flying ? Math.sin(time * 3 + e.wobble) * 0.08 : stride * 0.06) : 0;

  // movement ghost trail — stronger for fast/flying, light smear for all movers
  if (dir && moving) {
    const strong = e.haste > 0 || e.def.flying || e.def.speed > 60;
    const count = strong ? 3 : 2;
    for (let i = 1; i <= count; i++) {
      ctx.globalAlpha = (e.phased ? 0.3 : 1) * (strong ? 0.16 - i * 0.04 : 0.08 - i * 0.03);
      blotch(ctx, x - dir.x * i * (strong ? 7 : 4), y - lift - hop - dir.y * i * (strong ? 7 : 4), r * 1.05, r * 0.85, 0, e.def.color);
    }
    ctx.globalAlpha = e.phased ? 0.3 : 1;
  }

  blotch(ctx, x, y + r * 0.7, r * 1.15 * (1 - hop * 0.03), r * 0.45, 0, 'rgba(0,0,0,0.38)');

  if (e.slow > 0.05) {
    ctx.save();
    ctx.globalAlpha *= 0.55 + Math.sin(time * 6) * 0.15;
    ring(ctx, x, y - lift + 2, r + 4, '#81d4fa', 2.2);
    for (let i = 0; i < 3; i++) {
      const a = time * 2 + (i / 3) * Math.PI * 2;
      disc(ctx, x + Math.cos(a) * (r + 6), y - lift + 2 + Math.sin(a) * (r + 6) * 0.5, 1.6, '#e1f5fe');
    }
    ctx.restore();
  }
  if (e.dotTime > 0) {
    for (let i = 0; i < 3; i++) {
      const fall = ((time * 30 + i * 11) % 18);
      disc(ctx, x - 5 + i * 5 + Math.sin(time * 3 + i) * 2, y - lift - r + fall, 1.6, rgba('#4fc3f7', 0.7 - fall / 30));
    }
  }

  ctx.translate(x, y - lift - hop + hit * 3);
  ctx.rotate(lean + (hit > 0 ? stride * 0.08 : 0));
  ctx.scale(1.32 * face * (1 + squash + hitSquash), 1.32 * (1 - squash - hitSquash * 0.7));
  blotch(ctx, 0, 1.5, r * 1.22, r * 1.1, 0, 'rgba(16, 10, 6, 0.5)');
  if (
    !e.def.flying &&
    moving &&
    (e.def.id === 'drip' ||
      e.def.id === 'sludge' ||
      e.def.id === 'biofilm' ||
      e.def.id === 'codeViolation' ||
      e.def.id === 'glycolGolem' ||
      e.def.id === 'flangeGremlin' ||
      e.def.id === 'frozenMain')
  ) {
    walkLimbs(ctx, r, stride, e.def.color);
  }
  switch (e.def.id) {
    case 'drip': {
      const jiggle = Math.sin(e.wobble * 3.2) * r * 0.08;
      ctx.beginPath();
      ctx.moveTo(0, -r * 1.45);
      ctx.quadraticCurveTo(r + jiggle, -r * 0.15, 0, r);
      ctx.quadraticCurveTo(-r - jiggle, -r * 0.15, 0, -r * 1.45);
      celFill(ctx, e.def.color, 2.4);
      celShine(ctx, -r * 0.2, -r * 0.35, r * 0.28, r * 0.22, 0.4);
      const drop = ((e.wobble * 0.35) % 1);
      disc(ctx, jiggle * 0.4, r + 2 + drop * 8, 1.6 + (1 - drop), rgba(e.def.color, 0.7 * (1 - drop)));
      ctx.fillStyle = '#fff';
      ctx.beginPath();
      ctx.arc(-2.2, -1, 1.8, 0, Math.PI * 2);
      ctx.arc(2.2, -1, 1.8, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = CEL_INK;
      ctx.beginPath();
      ctx.arc(-1.8 + stride * 0.4, -0.7, 0.75, 0, Math.PI * 2);
      ctx.arc(2.6 + stride * 0.4, -0.7, 0.75, 0, Math.PI * 2);
      ctx.fill();
      break;
    }
    case 'sludge': {
      const squish = Math.sin(e.wobble) * 0.12;
      ctx.beginPath();
      ctx.ellipse(0, 2, r * (1.05 + squish), r * (0.78 - squish), 0, 0, Math.PI * 2);
      celFill(ctx, e.def.color, 2.4);
      celShine(ctx, -r * 0.25, -r * 0.15, r * 0.35, r * 0.2, 0.28);
      ctx.beginPath();
      ctx.ellipse(-r * 0.55, 4 + squish * 4, r * 0.42, r * 0.28, 0.3, 0, Math.PI * 2);
      celFill(ctx, mix(e.def.color, '#3e2723', 0.2), 1.6);
      ctx.fillStyle = '#5a4b28';
      ctx.beginPath();
      ctx.arc(-4, -2, 3, 0, Math.PI * 2);
      ctx.arc(5, 1, 2, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#fff';
      ctx.beginPath();
      ctx.arc(-3, -6, 2.3, 0, Math.PI * 2);
      ctx.arc(3, -6, 2.3, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = CEL_INK;
      ctx.beginPath();
      ctx.arc(-2.4 + stride * 0.5, -5.6, 0.9, 0, Math.PI * 2);
      ctx.arc(3.6 + stride * 0.5, -5.6, 0.9, 0, Math.PI * 2);
      ctx.fill();
      break;
    }
    case 'scaleCrab': {
      ctx.strokeStyle = CEL_INK;
      ctx.lineWidth = 2.6;
      for (let i = -1; i <= 1; i++) {
        const leg = Math.sin(e.wobble * 1.4 + i) * 4.2;
        ctx.beginPath();
        ctx.moveTo(-r, i * 4);
        ctx.lineTo(-r - 7, i * 4 + leg);
        ctx.moveTo(r, i * 4);
        ctx.lineTo(r + 7, i * 4 - leg);
        ctx.stroke();
      }
      const snap = 0.4 + Math.sin(e.wobble * 3) * 0.35;
      ctx.strokeStyle = mix(e.def.color, '#fff8e1', 0.2);
      ctx.lineWidth = 2.2;
      ctx.beginPath();
      ctx.moveTo(-r * 0.2, -r * 0.2);
      ctx.lineTo(-r * (1.1 + snap * 0.2), -r * (0.7 + snap));
      ctx.moveTo(r * 0.2, -r * 0.2);
      ctx.lineTo(r * (1.1 + snap * 0.2), -r * (0.7 + snap));
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(0, -r);
      for (let i = 1; i <= 6; i++) {
        const a = (i / 6) * Math.PI * 2 - Math.PI / 2;
        ctx.lineTo(Math.cos(a) * r, Math.sin(a) * r);
      }
      ctx.closePath();
      celFill(ctx, e.def.color, 2.4);
      celShine(ctx, -r * 0.2, -r * 0.35, r * 0.3, r * 0.18, 0.3);
      ctx.fillStyle = CEL_INK;
      ctx.fillRect(-4, -3, 2.4, 2.4);
      ctx.fillRect(2, -3, 2.4, 2.4);
      break;
    }
    case 'steamWisp': {
      for (let i = 0; i < 5; i++) {
        const a = time * 3.4 + i * 1.35;
        ctx.beginPath();
        ctx.arc(Math.cos(a) * (4 + i), Math.sin(a * 1.2) * (3 + i * 0.4), r * (0.82 - i * 0.08), 0, Math.PI * 2);
        celFill(ctx, rgba('#e0f7fa', 0.88 - i * 0.1), 1.6);
      }
      ctx.fillStyle = '#37474f';
      ctx.fillRect(-4, -2, 2.4, 2.4);
      ctx.fillRect(2, -2, 2.4, 2.4);
      break;
    }
    case 'pressureSpike': {
      const buzz = 1 + Math.sin(e.wobble * 8) * 0.08;
      ctx.save();
      ctx.scale(buzz, 1 / buzz);
      ctx.beginPath();
      ctx.moveTo(r * 1.55, 0);
      ctx.lineTo(-r * 0.6, -r);
      ctx.lineTo(-r * 1.15, 0);
      ctx.lineTo(-r * 0.6, r);
      ctx.closePath();
      celFill(ctx, e.def.color, 2.4);
      ctx.restore();
      celShine(ctx, 0, -r * 0.2, r * 0.35, r * 0.2, 0.35);
      ctx.strokeStyle = '#fce4ec';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(-r * 1.6, -3);
      ctx.lineTo(-r * 2.4, -3);
      ctx.moveTo(-r * 1.6, 3);
      ctx.lineTo(-r * 2.4, 3);
      ctx.stroke();
      break;
    }
    case 'airlock': {
      ctx.beginPath();
      ctx.arc(0, 0, r, 0, Math.PI * 2);
      celFill(ctx, 'rgba(129,212,250,0.42)', 2.6);
      ctx.strokeStyle = e.def.color;
      ctx.lineWidth = 3;
      ctx.stroke();
      ctx.fillStyle = '#fff';
      ctx.beginPath();
      ctx.arc(-3, -3, 2.5, 0, Math.PI * 2);
      ctx.fill();
      break;
    }
    case 'frozenMain': {
      ctx.beginPath();
      ctx.moveTo(-r, -r * 0.5);
      ctx.lineTo(-r * 0.3, -r);
      ctx.lineTo(r * 0.7, -r * 0.8);
      ctx.lineTo(r, r * 0.2);
      ctx.lineTo(r * 0.4, r);
      ctx.lineTo(-r * 0.7, r * 0.7);
      ctx.closePath();
      celFill(ctx, e.def.color, 2.4);
      ctx.strokeStyle = '#e1f5fe';
      ctx.lineWidth = 1.8;
      ctx.beginPath();
      ctx.moveTo(-r * 0.5, -r * 0.3);
      ctx.lineTo(r * 0.2, r * 0.4);
      ctx.stroke();
      ctx.fillStyle = '#01579b';
      ctx.fillRect(-4, -2, 2.4, 2.4);
      ctx.fillRect(2, -2, 2.4, 2.4);
      break;
    }
    case 'rogueBoiler': {
      ctx.beginPath();
      ctx.roundRect(-r, -r * 1.2, r * 2, r * 2.2, 8);
      celFill(ctx, e.def.color, 2.6);
      ctx.beginPath();
      ctx.roundRect(-r * 0.6, -r * 1.7, r * 0.5, r * 0.6, 2);
      celFill(ctx, '#5d4037', 2);
      ctx.beginPath();
      ctx.arc(0, 0, r * 0.45, 0, Math.PI * 2);
      celFill(ctx, '#ff7043', 2);
      ctx.fillStyle = '#ffe082';
      ctx.beginPath();
      ctx.arc(0, 0, r * 0.2 + Math.sin(time * 10) * 1.8, 0, Math.PI * 2);
      ctx.fill();
      ventSteam(ctx, r * 0.15, -r * 1.8, time, 3, '#ffccbc');
      ctx.beginPath();
      ctx.arc(r * 0.55, -r * 0.7, 5, 0, Math.PI * 2);
      celFill(ctx, '#eceff1', 1.8);
      ctx.strokeStyle = '#e53935';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(r * 0.55, -r * 0.7);
      ctx.lineTo(r * 0.55 + Math.cos(-1 + e.bossPhase) * 4, -r * 0.7 + Math.sin(-1 + e.bossPhase) * 4);
      ctx.stroke();
      ctx.fillStyle = CEL_INK;
      ctx.fillRect(-8, -10, 4, 3);
      ctx.fillRect(4, -10, 4, 3);
      break;
    }
    case 'hardWaterGnat': {
      ctx.beginPath();
      ctx.ellipse(0, 0, r, r * 0.7, 0, 0, Math.PI * 2);
      celFill(ctx, e.def.color, 2.2);
      ctx.strokeStyle = 'rgba(236,239,241,0.85)';
      ctx.lineWidth = 1.4;
      const flap = Math.sin(time * 22 + e.wobble) * 5.2;
      ctx.beginPath();
      ctx.moveTo(-r, 0);
      ctx.quadraticCurveTo(-r - 6, -flap, -r, -6);
      ctx.moveTo(r, 0);
      ctx.quadraticCurveTo(r + 6, flap, r, -6);
      ctx.stroke();
      ctx.fillStyle = CEL_INK;
      ctx.fillRect(-2, -1, 1.8, 1.8);
      ctx.fillRect(1, -1, 1.8, 1.8);
      break;
    }
    case 'sedimentBoulder': {
      ctx.beginPath();
      ctx.moveTo(-r, r * 0.3);
      ctx.lineTo(-r * 0.6, -r);
      ctx.lineTo(r * 0.2, -r * 0.8);
      ctx.lineTo(r, -r * 0.1);
      ctx.lineTo(r * 0.6, r);
      ctx.lineTo(-r * 0.4, r * 0.9);
      ctx.closePath();
      celFill(ctx, e.def.color, 2.6);
      celShine(ctx, -r * 0.2, -r * 0.3, r * 0.35, r * 0.22, 0.28);
      ctx.fillStyle = '#5d4037';
      ctx.beginPath();
      ctx.arc(-3, -2, 3, 0, Math.PI * 2);
      ctx.arc(5, 3, 2.5, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = CEL_INK;
      ctx.fillRect(-4, -6, 2.4, 2.4);
      ctx.fillRect(2, -6, 2.4, 2.4);
      break;
    }
    case 'codeViolation': {
      ctx.beginPath();
      ctx.roundRect(-r, -r * 1.1, r * 2, r * 2.1, 3);
      celFill(ctx, e.def.color, 2.4);
      ctx.fillStyle = '#fff8e1';
      ctx.fillRect(-r * 0.7, -r * 0.7, r * 1.4, r * 1.4);
      ctx.strokeStyle = '#bf360c';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(-r * 0.5, -r * 0.5);
      ctx.lineTo(r * 0.5, r * 0.5);
      ctx.moveTo(r * 0.5, -r * 0.5);
      ctx.lineTo(-r * 0.5, r * 0.5);
      ctx.stroke();
      break;
    }
    case 'condensateMoth': {
      const flap = 0.5 + Math.sin(time * 14 + e.wobble) * 0.42;
      ctx.beginPath();
      ctx.ellipse(-r * 0.75, -2, r * flap, r * 0.75, -0.45, 0, Math.PI * 2);
      celFill(ctx, e.def.color, 1.8);
      ctx.beginPath();
      ctx.ellipse(r * 0.75, -2, r * flap, r * 0.75, 0.45, 0, Math.PI * 2);
      celFill(ctx, e.def.color, 1.8);
      ctx.beginPath();
      ctx.ellipse(0, 0, r * 0.48, r * 0.75, 0, 0, Math.PI * 2);
      celFill(ctx, '#004d40', 2);
      celShine(ctx, -r * 0.15, -r * 0.25, r * 0.2, r * 0.14, 0.3);
      ctx.fillStyle = CEL_INK;
      ctx.fillRect(-2.2, -4, 1.6, 1.6);
      ctx.fillRect(0.8, -4, 1.6, 1.6);
      break;
    }
    case 'glycolGolem': {
      roundRect(ctx, -r, -r * 1.15, r * 2, r * 2.2, 7);
      celFill(ctx, e.def.color, 2.4);
      celShine(ctx, -r * 0.25, -r * 0.5, r * 0.35, r * 0.22, 0.32);
      ctx.fillStyle = 'rgba(224,247,250,0.5)';
      roundRect(ctx, -r * 0.5, -r * 0.4, r, r * 0.75, 3);
      ctx.fill();
      ctx.strokeStyle = '#e0f7fa';
      ctx.lineWidth = 2;
      ctx.stroke();
      ctx.fillStyle = CEL_INK;
      ctx.fillRect(-5, -8, 3, 3);
      ctx.fillRect(2, -8, 3, 3);
      break;
    }
    case 'zincWhisker': {
      glow(ctx, e.def.color, 8);
      ctx.strokeStyle = e.def.color;
      ctx.lineWidth = 2.2;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(-r, 0);
      ctx.lineTo(r, 0);
      ctx.moveTo(0, -r);
      ctx.lineTo(0, r);
      ctx.moveTo(-r * 0.7, -r * 0.7);
      ctx.lineTo(r * 0.7, r * 0.7);
      ctx.moveTo(r * 0.7, -r * 0.7);
      ctx.lineTo(-r * 0.7, r * 0.7);
      ctx.stroke();
      noGlow(ctx);
      ctx.beginPath();
      ctx.arc(0, 0, r * 0.48, 0, Math.PI * 2);
      celFill(ctx, '#eceff1', 2);
      break;
    }
    case 'biofilm': {
      ctx.beginPath();
      ctx.ellipse(0, 2, r * 1.2, r * 0.75, 0, 0, Math.PI * 2);
      celFill(ctx, e.def.color, 2.2);
      celShine(ctx, -r * 0.3, -r * 0.1, r * 0.35, r * 0.2, 0.25);
      ctx.fillStyle = '#4e342e';
      ctx.beginPath();
      ctx.arc(-4, 0, 3.2, 0, Math.PI * 2);
      ctx.arc(5, 2, 2.6, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#fff';
      ctx.beginPath();
      ctx.arc(-3, -4, 2.2, 0, Math.PI * 2);
      ctx.arc(3, -4, 2.2, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = CEL_INK;
      ctx.beginPath();
      ctx.arc(-2.6, -3.7, 0.85, 0, Math.PI * 2);
      ctx.arc(3.4, -3.7, 0.85, 0, Math.PI * 2);
      ctx.fill();
      break;
    }
    case 'waterHammer': {
      ctx.beginPath();
      ctx.moveTo(r * 1.45, 0);
      ctx.lineTo(-r * 0.4, -r);
      ctx.lineTo(-r * 1.05, 0);
      ctx.lineTo(-r * 0.4, r);
      ctx.closePath();
      celFill(ctx, e.def.color, 2.4);
      celShine(ctx, 0, -r * 0.2, r * 0.3, r * 0.18, 0.35);
      glow(ctx, '#fff', 6);
      ctx.strokeStyle = '#fffde7';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(-r * 1.25, -4);
      ctx.lineTo(-r * 2.1, -4);
      ctx.moveTo(-r * 1.25, 4);
      ctx.lineTo(-r * 2.1, 4);
      ctx.stroke();
      noGlow(ctx);
      break;
    }
    case 'limeScale': {
      ctx.beginPath();
      ctx.moveTo(-r, r * 0.4);
      ctx.lineTo(-r * 0.5, -r);
      ctx.lineTo(r * 0.4, -r * 0.7);
      ctx.lineTo(r, r * 0.1);
      ctx.lineTo(r * 0.3, r);
      ctx.closePath();
      celFill(ctx, e.def.color, 2.4);
      celShine(ctx, -r * 0.15, -r * 0.25, r * 0.3, r * 0.18, 0.28);
      ctx.fillStyle = '#8d6e63';
      ctx.beginPath();
      ctx.arc(-2, 0, 3.2, 0, Math.PI * 2);
      ctx.arc(5, 2, 2.2, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = CEL_INK;
      ctx.fillRect(-4, -6, 2.2, 2.2);
      ctx.fillRect(2, -6, 2.2, 2.2);
      break;
    }
    case 'vacuumBreak': {
      glow(ctx, e.def.color, 10);
      ctx.strokeStyle = e.def.color;
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(0, 0, r, Math.PI * 0.12, Math.PI * 1.88);
      ctx.stroke();
      noGlow(ctx);
      ctx.beginPath();
      ctx.arc(0, 0, r * 0.72, 0, Math.PI * 2);
      celFill(ctx, 'rgba(129,212,250,0.38)', 2);
      ctx.fillStyle = '#fff';
      ctx.beginPath();
      ctx.arc(-2.5, -2.5, 2.4, 0, Math.PI * 2);
      ctx.fill();
      break;
    }
    case 'pexKink': {
      glow(ctx, e.def.color, 6);
      ctx.strokeStyle = e.def.color;
      ctx.lineWidth = 5;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(-r, r * 0.4);
      ctx.quadraticCurveTo(-2, -r, r * 0.2, 0);
      ctx.quadraticCurveTo(r, r, r * 0.85, -r * 0.25);
      ctx.stroke();
      noGlow(ctx);
      ctx.strokeStyle = CEL_INK;
      ctx.lineWidth = 1.8;
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(0, 0, 3.5, 0, Math.PI * 2);
      celFill(ctx, '#bf360c', 1.6);
      break;
    }
    case 'flangeGremlin': {
      ctx.beginPath();
      ctx.arc(0, 0, r, 0, Math.PI * 2);
      celFill(ctx, e.def.color, 2.4);
      celShine(ctx, -r * 0.25, -r * 0.3, r * 0.28, r * 0.18, 0.32);
      ctx.strokeStyle = '#ffe0b2';
      ctx.lineWidth = 2.4;
      ctx.beginPath();
      ctx.arc(0, 0, r * 0.55, 0, Math.PI * 2);
      ctx.stroke();
      for (let i = 0; i < 6; i++) {
        const a = (i / 6) * Math.PI * 2 + time * 1.6 + e.wobble * 0.2;
        rivet(ctx, Math.cos(a) * r * 0.88, Math.sin(a) * r * 0.88, 1.9);
      }
      ctx.fillStyle = CEL_INK;
      ctx.fillRect(-3.2, -3.2, 2.2, 2.2);
      ctx.fillRect(1.2, -3.2, 2.2, 2.2);
      break;
    }
    default: {
      const _exhaustive: never = e.def.id;
      return _exhaustive;
    }
  }
  ctx.fillStyle = 'rgba(255,255,255,0.28)';
  ctx.beginPath();
  ctx.ellipse(-r * 0.25, -r * 0.35, r * 0.28, r * 0.18, -0.4, 0, Math.PI * 2);
  ctx.fill();
  if (hit > 0) {
    ctx.globalCompositeOperation = 'lighter';
    ctx.globalAlpha = Math.min(1, hit * 4);
    blotch(ctx, 0, 0, r * 1.15, r * 1.05, 0, '#fff8e1');
    ctx.globalCompositeOperation = 'source-over';
  }
  ctx.restore();

  if (e.heldBy) {
    glow(ctx, '#ff8a80', 10);
    ctx.strokeStyle = '#ff8a80';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(x, y - lift, r + 6, 0, Math.PI * 2);
    ctx.stroke();
    noGlow(ctx);
  }
  if (e.marked) {
    ctx.strokeStyle = '#ffcc80';
    ctx.lineWidth = 2.4;
    ctx.setLineDash([4, 4]);
    ctx.beginPath();
    ctx.arc(x, y - lift, r + 9, 0, Math.PI * 2);
    ctx.stroke();
    ctx.setLineDash([]);
  }
  if (e.stun > 0) {
    for (let i = 0; i < 3; i++) {
      const a = time * 5 + (i / 3) * Math.PI * 2;
      const sx = x + Math.cos(a) * (r + 4);
      const sy = y - lift - r - 10 + Math.sin(a) * 3;
      stampText(ctx, '✶', sx, sy, { size: 11 + Math.sin(a) * 2, color: '#fff59d' });
    }
  }
  if (leakRemaining(e) < leakMax(e) || e.def.armor > 0.05 || e.def.flying || e.properties.length > 0) {
    hpBar(ctx, x, y - lift - r - 8, Math.max(18, r * 2.3), leakRemaining(e) / leakMax(e), e.def.traits.includes('boss') ? '#ff7043' : '#ef5350');
    if (e.def.armor > 0.15) {
      ctx.fillStyle = '#cfd8dc';
      ctx.font = '700 8px Source Sans 3, Trebuchet MS, sans-serif';
      ctx.textAlign = 'left';
      ctx.fillText('ARM', x + Math.max(10, r * 1.2), y - lift - r - 6);
    }
    if (e.def.flying) {
      ctx.fillStyle = '#b3e5fc';
      ctx.font = '700 8px Source Sans 3, Trebuchet MS, sans-serif';
      ctx.textAlign = 'right';
      ctx.fillText('AIR', x - Math.max(10, r * 1.2), y - lift - r - 6);
    }
  }
}

export const JEFF_SELECT_RADIUS = 42;
