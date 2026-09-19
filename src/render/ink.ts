/** Canvas paint kit — Kingdom Rush cel ink with brass / wood jobsite depth. */

export const CANVAS_DISPLAY = 'Fraunces, Georgia, serif';
export const CANVAS_UI = 'Source Sans 3, Trebuchet MS, sans-serif';
export const CEL_INK = '#1a1008';
export const BRASS = '#d4af62';
export const COPPER = '#c4843a';

export function mix(a: string, b: string, t: number): string {
  const A = rgb(a);
  const B = rgb(b);
  const k = Math.max(0, Math.min(1, t));
  return `rgb(${Math.round(A[0] + (B[0] - A[0]) * k)},${Math.round(A[1] + (B[1] - A[1]) * k)},${Math.round(A[2] + (B[2] - A[2]) * k)})`;
}

export function rgb(color: string): [number, number, number] {
  if (color.startsWith('#')) {
    const h = color.length === 4
      ? color.slice(1).split('').map((c) => c + c).join('')
      : color.slice(1);
    return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)];
  }
  const m = color.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/);
  if (m) return [Number(m[1]), Number(m[2]), Number(m[3])];
  return [128, 128, 128];
}

export function glow(ctx: CanvasRenderingContext2D, color: string, blur = 10): void {
  ctx.shadowColor = color;
  ctx.shadowBlur = blur;
}

export function noGlow(ctx: CanvasRenderingContext2D): void {
  ctx.shadowBlur = 0;
  ctx.shadowColor = 'transparent';
}

export function ellipse(ctx: CanvasRenderingContext2D, x: number, y: number, rx: number, ry: number): void {
  ctx.beginPath();
  ctx.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2);
}

export function disc(ctx: CanvasRenderingContext2D, x: number, y: number, r: number, fill: string): void {
  ctx.fillStyle = fill;
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.fill();
}

export function rgba(color: string, a: number): string {
  const [r, g, b] = rgb(color);
  return `rgba(${r},${g},${b},${Math.max(0, Math.min(1, a))})`;
}

export function radial(ctx: CanvasRenderingContext2D, x: number, y: number, inner: number, outer: number, color: string, peak = 0.45): void {
  const g = ctx.createRadialGradient(x, y, inner, x, y, outer);
  g.addColorStop(0, rgba(color, peak));
  g.addColorStop(1, rgba(color, 0));
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.arc(x, y, outer, 0, Math.PI * 2);
  ctx.fill();
}

export function blotch(ctx: CanvasRenderingContext2D, x: number, y: number, rx: number, ry: number, rot: number, fill: string): void {
  ctx.fillStyle = fill;
  ctx.beginPath();
  ctx.ellipse(x, y, rx, ry, rot, 0, Math.PI * 2);
  ctx.fill();
}

export function ring(ctx: CanvasRenderingContext2D, x: number, y: number, r: number, color: string, width: number): void {
  ctx.strokeStyle = color;
  ctx.lineWidth = width;
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.stroke();
}

/** Soft ground contact blob under actors / towers. */
export function castShadow(ctx: CanvasRenderingContext2D, x: number, y: number, rx: number, ry = rx * 0.38, a = 0.42): void {
  ctx.fillStyle = rgba('#000000', a);
  ctx.beginPath();
  ctx.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2);
  ctx.fill();
}

/** Fill the current path then lay a fat Kingdom-Rush ink outline. */
export function celFill(ctx: CanvasRenderingContext2D, fill: string, lw = 2.2, ink = CEL_INK): void {
  ctx.fillStyle = fill;
  ctx.fill();
  ctx.strokeStyle = ink;
  ctx.lineWidth = lw;
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';
  ctx.stroke();
}

/** Soft rim highlight on the upper-left of a filled mass. */
export function celShine(ctx: CanvasRenderingContext2D, x: number, y: number, rx: number, ry: number, a = 0.32): void {
  ctx.fillStyle = rgba('#ffffff', a);
  ctx.beginPath();
  ctx.ellipse(x, y, rx, ry, -0.45, 0, Math.PI * 2);
  ctx.fill();
}

/** Vertical metal sheen for pipes, wrenches, tanks. */
export function metalFill(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, base: string): CanvasGradient {
  const g = ctx.createLinearGradient(x, y, x + w, y + h * 0.15);
  g.addColorStop(0, mix(base, '#000000', 0.35));
  g.addColorStop(0.22, mix(base, '#ffffff', 0.22));
  g.addColorStop(0.5, base);
  g.addColorStop(0.78, mix(base, '#ffffff', 0.12));
  g.addColorStop(1, mix(base, '#000000', 0.4));
  return g;
}

/** Warm brass plaque fill. */
export function brassFill(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number): CanvasGradient {
  const g = ctx.createLinearGradient(x, y, x + w * 0.08, y + h);
  g.addColorStop(0, '#f0d78a');
  g.addColorStop(0.35, BRASS);
  g.addColorStop(0.7, '#a67c2d');
  g.addColorStop(1, '#6b4a18');
  return g;
}

/** Rivet / bolt head used on flanges and plaques. */
export function rivet(ctx: CanvasRenderingContext2D, x: number, y: number, r = 2.4): void {
  disc(ctx, x, y, r, '#5d4037');
  disc(ctx, x - r * 0.2, y - r * 0.25, r * 0.55, '#e8c56a');
  disc(ctx, x + r * 0.15, y + r * 0.2, r * 0.28, '#8a6230');
}

/** Pipe flange collar with corner bolts. */
export function pipeFlange(ctx: CanvasRenderingContext2D, x: number, y: number, r: number, color: string): void {
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  celFill(ctx, mix(color, '#000000', 0.18), 2.4);
  ctx.beginPath();
  ctx.arc(x, y, r * 0.55, 0, Math.PI * 2);
  celFill(ctx, mix(color, '#ffffff', 0.12), 1.8);
  for (let i = 0; i < 4; i++) {
    const a = (i / 4) * Math.PI * 2 + Math.PI / 4;
    rivet(ctx, x + Math.cos(a) * r * 0.78, y + Math.sin(a) * r * 0.78, Math.max(1.6, r * 0.14));
  }
}

/** Expanding dashed pulse ring (skill / hit cues). */
export function pulseRing(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  r: number,
  color: string,
  life: number,
  width = 3.5,
): void {
  const a = Math.max(0, Math.min(1, life));
  ctx.save();
  ctx.globalAlpha = a;
  glow(ctx, color, 10 + (1 - a) * 8);
  ctx.strokeStyle = color;
  ctx.lineWidth = width * (0.6 + a * 0.6);
  ctx.setLineDash([8, 6]);
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.stroke();
  ctx.setLineDash([]);
  noGlow(ctx);
  ctx.restore();
}

/** Soft film grain / dust over a rect. */
export function filmGrain(ctx: CanvasRenderingContext2D, w: number, h: number, seed: number, a = 0.045): void {
  ctx.save();
  ctx.globalAlpha = a;
  for (let i = 0; i < 90; i++) {
    const x = ((i * 97 + seed * 13) % w + w) % w;
    const y = ((i * 53 + seed * 29) % h + h) % h;
    ctx.fillStyle = i % 2 === 0 ? '#ffffff' : '#000000';
    ctx.fillRect(x, y, 1.2, 1.2);
  }
  ctx.restore();
}

/** Edge vignette — darkens corners so the stage reads like a lit diorama. */
export function vignette(ctx: CanvasRenderingContext2D, w: number, h: number, strength = 0.55): void {
  const g = ctx.createRadialGradient(w / 2, h / 2, Math.min(w, h) * 0.28, w / 2, h / 2, Math.max(w, h) * 0.72);
  g.addColorStop(0, 'rgba(0,0,0,0)');
  g.addColorStop(0.65, 'rgba(0,0,0,0)');
  g.addColorStop(1, rgba('#0a0908', strength));
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, w, h);
}

/** Warm work-lamp cone. */
export function lampCone(ctx: CanvasRenderingContext2D, x: number, y: number, reach: number, a = 0.14): void {
  const g = ctx.createRadialGradient(x, y, 4, x, y + reach * 0.35, reach);
  g.addColorStop(0, rgba('#ffe082', a * 1.4));
  g.addColorStop(0.45, rgba('#ffcc80', a * 0.55));
  g.addColorStop(1, rgba('#ffcc80', 0));
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.moveTo(x - 8, y);
  ctx.lineTo(x + 8, y);
  ctx.lineTo(x + reach * 0.55, y + reach);
  ctx.lineTo(x - reach * 0.55, y + reach);
  ctx.closePath();
  ctx.fill();
}

export function stampText(
  ctx: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  opts: { size?: number; color?: string; display?: boolean; align?: CanvasTextAlign } = {},
): void {
  const size = opts.size ?? 13;
  const color = opts.color ?? '#fff8e1';
  ctx.font = `700 ${size}px ${opts.display ? CANVAS_DISPLAY : CANVAS_UI}`;
  ctx.textAlign = opts.align ?? 'center';
  ctx.lineWidth = Math.max(3, size * 0.28);
  ctx.strokeStyle = 'rgba(0,0,0,0.78)';
  ctx.strokeText(text, x, y);
  ctx.fillStyle = color;
  ctx.fillText(text, x, y);
}
