import type { Vec } from '../core/vec';
import { WORLD_H, WORLD_W } from '../data/maps';
import type { MapDef, MapPalette } from '../data/types';
import { paintLandscape, paintRoutes, usesPaintedYard } from './battlefield';
import { blotch, celFill, disc, filmGrain, mix, radial, rgba, ring, rivet, stampText, vignette } from './ink';

/** Static jobsite art cached under the live actors. */
export function paintYard(ctx: CanvasRenderingContext2D, map: MapDef): void {
  const p = map.palette;
  if (paintLandscape(ctx, map)) {
    paintRoutes(ctx, map);
    return;
  }
  paintFloor(ctx, map.id, p);
  paintScenery(ctx, map.id, p);
  scatterProps(ctx, map.id, p);
  paintPipes(ctx, map.paths, p);
  // The raised pipework becomes the service route, with its old fixtures retained around it.
  paintRoutes(ctx, map);
  paintVignette(ctx, map.id);
  filmGrain(ctx, WORLD_W, WORLD_H, map.id.length * 17, 0.035);
}

function paintFloor(ctx: CanvasRenderingContext2D, id: string, p: MapPalette): void {
  const g = ctx.createLinearGradient(0, 0, 0, WORLD_H);
  g.addColorStop(0, mix(p.bg, p.wall, 0.42));
  g.addColorStop(0.45, p.bg);
  g.addColorStop(1, mix(p.bg, '#000000', 0.32));
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, WORLD_W, WORLD_H);
  paintBlotches(ctx, p, 90);

  switch (id) {
    case 'radiantFloor':
      woodPlanks(ctx, p);
      break;
    case 'attic':
      woodPlanks(ctx, p, 0.62);
      break;
    case 'crawlspace':
      dirtFloor(ctx, p);
      break;
    case 'snowmelt':
      snowFloor(ctx, p);
      break;
    case 'serviceCall':
      asphalt(ctx, p);
      break;
    case 'mechanicalRoom':
      stainedGround(ctx, p);
      rustWash(ctx, p);
      break;
    case 'heatPlant':
      stainedGround(ctx, p);
      plantHeat(ctx, p);
      break;
    default:
      stainedGround(ctx, p);
      break;
  }
}

function paintBlotches(ctx: CanvasRenderingContext2D, p: MapPalette, n: number): void {
  for (let i = 0; i < n; i++) {
    const x = (i * 157 + 19) % WORLD_W;
    const y = (i * 97 + 43) % WORLD_H;
    const rx = 38 + (i % 8) * 11;
    const ry = 16 + (i % 6) * 7;
    ctx.globalAlpha = 0.1 + (i % 5) * 0.035;
    const tint = i % 3 === 0 ? p.accent : i % 3 === 1 ? p.wall : '#000000';
    blotch(ctx, x, y, rx, ry, (i * 0.73) % 2.8, mix(p.bg, tint, 0.16 + (i % 4) * 0.05));
  }
  ctx.globalAlpha = 1;
}

function stainedGround(ctx: CanvasRenderingContext2D, p: MapPalette): void {
  ctx.globalAlpha = 0.16;
  for (let i = 0; i < 28; i++) {
    blotch(ctx, (i * 211) % WORLD_W, (i * 67) % WORLD_H, 50 + (i % 6) * 8, 18, i * 0.4, mix(p.wall, '#2a2018', 0.3));
  }
  ctx.globalAlpha = 1;
  ctx.fillStyle = mix(p.wall, '#1a140f', 0.45);
  for (let i = 0; i < 50; i++) {
    ctx.globalAlpha = 0.18;
    disc(ctx, (i * 149) % WORLD_W, (i * 83) % WORLD_H, 1.4 + (i % 3), ctx.fillStyle);
  }
  ctx.globalAlpha = 1;
}

function rustWash(ctx: CanvasRenderingContext2D, p: MapPalette): void {
  ctx.globalAlpha = 0.14;
  for (let i = 0; i < 16; i++) {
    blotch(ctx, (i * 181 + 40) % WORLD_W, (i * 73 + 90) % WORLD_H, 42 + (i % 5) * 8, 16, i * 0.5, mix(p.accent, '#5d4037', 0.4));
  }
  ctx.globalAlpha = 1;
}

function plantHeat(ctx: CanvasRenderingContext2D, p: MapPalette): void {
  ctx.globalAlpha = 0.2;
  blotch(ctx, 180, WORLD_H - 30, 160, 40, 0.2, mix(p.accent, '#bf360c', 0.5));
  blotch(ctx, 780, 36, 140, 36, 1.1, mix(p.accent, '#ff7043', 0.45));
  ctx.globalAlpha = 1;
}

function woodPlanks(ctx: CanvasRenderingContext2D, p: MapPalette, dark = 0.82): void {
  let y = 0;
  let row = 0;
  while (y < WORLD_H) {
    const h = 18 + (row % 4);
    ctx.globalAlpha = dark;
    ctx.fillStyle = mix(p.wall, row % 2 ? '#000000' : '#fff3d6', row % 2 ? 0.22 : 0.08);
    ctx.fillRect(0, y, WORLD_W, h - 1);
    ctx.globalAlpha = 1;
    ctx.strokeStyle = mix(p.bg, '#000000', 0.45);
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(0, y + h - 0.5);
    ctx.lineTo(WORLD_W, y + h - 0.5);
    ctx.stroke();
    const offset = (row * 97) % 160;
    ctx.strokeStyle = mix(p.bg, '#000000', 0.28);
    for (let x = offset - 160; x < WORLD_W; x += 118 + (row % 3) * 16) {
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(x + (row % 2 ? 3 : -2), y + h);
      ctx.stroke();
    }
    if (row % 5 === 2) {
      ctx.globalAlpha = 0.22;
      blotch(ctx, 80 + (row * 73) % 800, y + h / 2, 28, 5, 0.1, '#3e2723');
      ctx.globalAlpha = 1;
    }
    y += h;
    row++;
  }
}

function dirtFloor(ctx: CanvasRenderingContext2D, p: MapPalette): void {
  ctx.fillStyle = 'rgba(98, 74, 46, 0.22)';
  ctx.fillRect(0, 0, WORLD_W, WORLD_H);
  stainedGround(ctx, p);
  for (let i = 0; i < 22; i++) {
    ctx.globalAlpha = 0.18;
    blotch(ctx, (i * 173) % WORLD_W, (i * 79) % WORLD_H, 70, 24, i * 0.3, mix(p.bg, '#5d4037', 0.35));
  }
  ctx.globalAlpha = 1;
  ctx.fillStyle = mix(p.wall, '#3e2f1c', 0.5);
  for (let i = 0; i < 70; i++) {
    ctx.globalAlpha = 0.22;
    disc(ctx, (i * 137) % WORLD_W, (i * 89) % WORLD_H, 1.6 + (i % 4), ctx.fillStyle);
  }
  ctx.globalAlpha = 1;
  for (let i = 0; i < 22; i++) {
    grassTuft(ctx, 18 + (i * 61) % (WORLD_W - 30), 16 + (i * 47) % (WORLD_H - 20), mix(p.accent, '#2e4a22', 0.4));
  }
}

function snowFloor(ctx: CanvasRenderingContext2D, p: MapPalette): void {
  stainedGround(ctx, p);
  ctx.fillStyle = 'rgba(236, 247, 250, 0.16)';
  for (let i = 0; i < 18; i++) {
    blotch(ctx, (i * 83) % WORLD_W, 30 + (i * 47) % (WORLD_H - 60), 110, 22, 0, ctx.fillStyle);
  }
  ctx.fillStyle = 'rgba(255,255,255,0.22)';
  for (let i = 0; i < 40; i++) {
    disc(ctx, (i * 73) % WORLD_W, (i * 101) % WORLD_H, 1.2 + (i % 2), ctx.fillStyle);
  }
}

function asphalt(ctx: CanvasRenderingContext2D, p: MapPalette): void {
  stainedGround(ctx, p);
  ctx.strokeStyle = 'rgba(255,224,130,0.16)';
  ctx.setLineDash([22, 18]);
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.moveTo(70, WORLD_H / 2);
  ctx.lineTo(WORLD_W - 70, WORLD_H / 2);
  ctx.stroke();
  ctx.setLineDash([]);
  ctx.globalAlpha = 0.12;
  for (let i = 0; i < 10; i++) {
    blotch(ctx, 80 + i * 90, WORLD_H / 2 + ((i % 2) * 16 - 8), 36, 10, 0, '#90a4ae');
  }
  ctx.globalAlpha = 1;
}

function paintScenery(ctx: CanvasRenderingContext2D, id: string, p: MapPalette): void {
  switch (id) {
    case 'crawlspace':
      joists(ctx, p);
      hangingBulbs(ctx, [180, 520, 780]);
      break;
    case 'boilerRoom':
      brickBand(ctx, p, 0, 78);
      brickBand(ctx, p, WORLD_H - 70, 70);
      heatGlow(ctx, WORLD_W * 0.2, WORLD_H - 20);
      heatGlow(ctx, WORLD_W * 0.75, WORLD_H - 30);
      break;
    case 'radiantFloor':
      baseboard(ctx, p);
      break;
    case 'municipalMain':
      brickBand(ctx, p, 0, 52);
      manhole(ctx, 820, 520, p);
      break;
    case 'snowmelt':
      snowbank(ctx, 80, WORLD_H - 30, 240);
      snowbank(ctx, 700, 80, 200);
      snowbank(ctx, 420, WORLD_H - 18, 160);
      break;
    case 'attic':
      rafters(ctx, p);
      insulation(ctx, p);
      break;
    case 'liftStation':
      wetWell(ctx, p);
      break;
    case 'serviceCall':
      moon(ctx);
      yardLamps(ctx, [120, 460, 820]);
      break;
    case 'mechanicalRoom':
      brickBand(ctx, p, 0, 56);
      brickBand(ctx, p, WORLD_H - 52, 52);
      heatGlow(ctx, WORLD_W * 0.3, WORLD_H - 16);
      break;
    case 'heatPlant':
      brickBand(ctx, p, 0, 44);
      heatGlow(ctx, 180, WORLD_H - 20);
      heatGlow(ctx, 780, 40);
      break;
    default:
      brickBand(ctx, p, 0, 40);
      break;
  }
}

function scatterProps(ctx: CanvasRenderingContext2D, id: string, p: MapPalette): void {
  crate(ctx, 34, 96, p);
  crate(ctx, WORLD_W - 58, 118, p);
  bucket(ctx, 78, 168, p.accent);
  bucket(ctx, WORLD_W - 96, 210, '#78909c');
  rock(ctx, 50, 320, p);
  rock(ctx, WORLD_W - 40, 280, p);
  grassTuft(ctx, 24, 240, mix(p.accent, '#33691e', 0.3));
  grassTuft(ctx, WORLD_W - 22, 360, mix(p.accent, '#33691e', 0.3));
  grassTuft(ctx, 140, 44, mix(p.accent, '#33691e', 0.3));
  if (id === 'crawlspace' || id === 'attic') {
    wrenchOnGround(ctx, 110, 430);
    crate(ctx, 200, 70, p);
  }
  if (id === 'boilerRoom') {
    bucket(ctx, 240, 540, '#e53935');
  }
  if (id === 'snowmelt') {
    rock(ctx, 260, 90, p);
  }
  if (id === 'mechanicalRoom') {
    crate(ctx, 500, 70, p);
    crate(ctx, 620, 520, p);
    bucket(ctx, 460, 540, '#ff8a65');
    wrenchOnGround(ctx, 200, 260);
  }
  if (id === 'heatPlant') {
    bucket(ctx, 200, 40, '#bf360c');
    crate(ctx, 880, 80, p);
    crate(ctx, 40, 500, p);
    rock(ctx, 480, 40, p);
  }
}

function crate(ctx: CanvasRenderingContext2D, x: number, y: number, p: MapPalette): void {
  ctx.fillStyle = 'rgba(0,0,0,0.35)';
  blotch(ctx, x + 12, y + 16, 16, 5, 0, ctx.fillStyle);
  ctx.fillStyle = mix(p.wall, '#6d4c41', 0.35);
  ctx.fillRect(x, y, 24, 18);
  ctx.strokeStyle = mix(p.wall, '#000000', 0.4);
  ctx.lineWidth = 1.4;
  ctx.strokeRect(x + 0.5, y + 0.5, 23, 17);
  ctx.beginPath();
  ctx.moveTo(x, y);
  ctx.lineTo(x + 24, y + 18);
  ctx.moveTo(x + 24, y);
  ctx.lineTo(x, y + 18);
  ctx.stroke();
  ctx.fillStyle = rgba('#fff8e1', 0.12);
  ctx.fillRect(x + 2, y + 2, 8, 4);
}

function bucket(ctx: CanvasRenderingContext2D, x: number, y: number, color: string): void {
  ctx.fillStyle = 'rgba(0,0,0,0.3)';
  blotch(ctx, x, y + 8, 9, 3, 0, ctx.fillStyle);
  ctx.fillStyle = mix(color, '#37474f', 0.35);
  ctx.beginPath();
  ctx.moveTo(x - 7, y - 8);
  ctx.lineTo(x + 7, y - 8);
  ctx.lineTo(x + 5, y + 8);
  ctx.lineTo(x - 5, y + 8);
  ctx.closePath();
  ctx.fill();
  ring(ctx, x, y - 8, 7, mix(color, '#ffffff', 0.2), 2);
}

function rock(ctx: CanvasRenderingContext2D, x: number, y: number, p: MapPalette): void {
  ctx.fillStyle = 'rgba(0,0,0,0.3)';
  blotch(ctx, x, y + 4, 12, 4, 0, ctx.fillStyle);
  ctx.fillStyle = mix(p.wall, '#90a4ae', 0.35);
  ctx.beginPath();
  ctx.moveTo(x - 10, y + 2);
  ctx.lineTo(x - 4, y - 8);
  ctx.lineTo(x + 8, y - 5);
  ctx.lineTo(x + 10, y + 3);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = rgba('#ffffff', 0.12);
  ctx.beginPath();
  ctx.arc(x - 2, y - 4, 2, 0, Math.PI * 2);
  ctx.fill();
}

function grassTuft(ctx: CanvasRenderingContext2D, x: number, y: number, color: string): void {
  ctx.strokeStyle = color;
  ctx.lineWidth = 1.6;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(x, y);
  ctx.quadraticCurveTo(x - 4, y - 8, x - 6, y - 14);
  ctx.moveTo(x, y);
  ctx.quadraticCurveTo(x + 1, y - 10, x, y - 16);
  ctx.moveTo(x, y);
  ctx.quadraticCurveTo(x + 5, y - 7, x + 7, y - 13);
  ctx.stroke();
}

function wrenchOnGround(ctx: CanvasRenderingContext2D, x: number, y: number): void {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(-0.6);
  ctx.fillStyle = '#90a4ae';
  ctx.fillRect(-10, -2, 20, 4);
  ctx.beginPath();
  ctx.arc(10, 0, 5, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

function joists(ctx: CanvasRenderingContext2D, p: MapPalette): void {
  ctx.fillStyle = mix(p.wall, '#1a120c', 0.25);
  ctx.fillRect(0, 0, WORLD_W, 36);
  for (let x = 16; x < WORLD_W; x += 92) {
    ctx.fillStyle = mix(p.wall, '#2a2018', 0.15);
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x + 26, 0);
    ctx.lineTo(x + 12, 78);
    ctx.lineTo(x - 8, 78);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = mix(p.wall, '#fff3d6', 0.08);
    ctx.fillRect(x + 4, 0, 5, 70);
  }
}

function hangingBulbs(ctx: CanvasRenderingContext2D, xs: number[]): void {
  for (const x of xs) {
    ctx.strokeStyle = 'rgba(0,0,0,0.45)';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, 46);
    ctx.stroke();
    const lamp = ctx.createRadialGradient(x, 52, 2, x, 58, 70);
    lamp.addColorStop(0, 'rgba(255,224,130,0.42)');
    lamp.addColorStop(1, 'rgba(255,224,130,0)');
    ctx.fillStyle = lamp;
    ctx.beginPath();
    ctx.arc(x, 58, 70, 0, Math.PI * 2);
    ctx.fill();
    disc(ctx, x, 50, 7, '#ffe082');
    disc(ctx, x - 2, 48, 2.2, rgba('#ffffff', 0.55));
  }
}

function brickBand(ctx: CanvasRenderingContext2D, p: MapPalette, y: number, h: number): void {
  ctx.fillStyle = p.wall;
  ctx.fillRect(0, y, WORLD_W, h);
  ctx.fillStyle = mix(p.wall, '#000000', 0.18);
  ctx.fillRect(0, y + h - 6, WORLD_W, 6);
  ctx.strokeStyle = mix(p.wall, '#000000', 0.28);
  ctx.lineWidth = 1;
  const bh = 16;
  const bw = 32;
  for (let row = 0; row * bh < h; row++) {
    const off = row % 2 ? 16 : 0;
    for (let x = -off; x < WORLD_W; x += bw) {
      ctx.strokeRect(x + 0.5, y + row * bh + 0.5, bw - 1, bh - 1);
    }
  }
}

function heatGlow(ctx: CanvasRenderingContext2D, x: number, y: number): void {
  const g = ctx.createRadialGradient(x, y, 8, x, y, 130);
  g.addColorStop(0, 'rgba(255,112,67,0.32)');
  g.addColorStop(1, 'rgba(255,112,67,0)');
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.arc(x, y, 130, 0, Math.PI * 2);
  ctx.fill();
}

function baseboard(ctx: CanvasRenderingContext2D, p: MapPalette): void {
  ctx.fillStyle = mix(p.wall, '#000000', 0.2);
  ctx.fillRect(0, 0, WORLD_W, 20);
  ctx.fillRect(0, WORLD_H - 20, WORLD_W, 20);
  ctx.fillStyle = p.accent;
  ctx.globalAlpha = 0.4;
  ctx.fillRect(0, 18, WORLD_W, 3);
  ctx.fillRect(0, WORLD_H - 21, WORLD_W, 3);
  ctx.globalAlpha = 1;
}

function manhole(ctx: CanvasRenderingContext2D, x: number, y: number, p: MapPalette): void {
  disc(ctx, x, y, 36, mix(p.pipeDark, '#000000', 0.2));
  ring(ctx, x, y, 30, p.accent, 3.5);
  ctx.lineWidth = 1.5;
  ctx.strokeStyle = p.accent;
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2;
    ctx.beginPath();
    ctx.moveTo(x + Math.cos(a) * 8, y + Math.sin(a) * 8);
    ctx.lineTo(x + Math.cos(a) * 24, y + Math.sin(a) * 24);
    ctx.stroke();
  }
}

function snowbank(ctx: CanvasRenderingContext2D, x: number, y: number, w: number): void {
  ctx.fillStyle = 'rgba(236,239,241,0.28)';
  ctx.beginPath();
  ctx.moveTo(x - w / 2, y);
  ctx.quadraticCurveTo(x, y - 42, x + w / 2, y);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = 'rgba(255,255,255,0.18)';
  ctx.beginPath();
  ctx.ellipse(x - w * 0.12, y - 18, w * 0.18, 8, 0, 0, Math.PI * 2);
  ctx.fill();
}

function rafters(ctx: CanvasRenderingContext2D, p: MapPalette): void {
  ctx.strokeStyle = mix(p.wall, '#000000', 0.28);
  ctx.lineWidth = 14;
  ctx.globalAlpha = 0.35;
  for (let i = -1; i < 8; i++) {
    ctx.beginPath();
    ctx.moveTo(i * 140, 0);
    ctx.lineTo(i * 140 + 160, 90);
    ctx.stroke();
  }
  ctx.globalAlpha = 1;
  ctx.fillStyle = mix(p.wall, '#1a120c', 0.2);
  ctx.fillRect(0, 0, WORLD_W, 28);
}

function insulation(ctx: CanvasRenderingContext2D, p: MapPalette): void {
  ctx.fillStyle = mix(p.accent, '#f8bbd0', 0.4);
  ctx.globalAlpha = 0.14;
  for (let i = 0; i < 8; i++) {
    blotch(ctx, 80 + i * 110, 30 + (i % 2) * 20, 50, 14, 0, ctx.fillStyle);
  }
  ctx.globalAlpha = 1;
}

function wetWell(ctx: CanvasRenderingContext2D, p: MapPalette): void {
  ctx.fillStyle = mix(p.bg, '#0d47a1', 0.22);
  ctx.globalAlpha = 0.24;
  ctx.fillRect(0, 280, WORLD_W, 86);
  ctx.fillRect(0, 140, WORLD_W, 44);
  ctx.globalAlpha = 1;
  ctx.fillStyle = 'rgba(255,255,255,0.05)';
  for (let y = 140; y < 380; y += 18) ctx.fillRect(0, y, WORLD_W, 1);
}

function moon(ctx: CanvasRenderingContext2D): void {
  const g = ctx.createRadialGradient(860, 70, 10, 860, 70, 100);
  g.addColorStop(0, 'rgba(227,242,253,0.75)');
  g.addColorStop(1, 'rgba(227,242,253,0)');
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.arc(860, 70, 100, 0, Math.PI * 2);
  ctx.fill();
  disc(ctx, 860, 70, 18, '#e3f2fd');
}

function yardLamps(ctx: CanvasRenderingContext2D, xs: number[]): void {
  for (const x of xs) {
    ctx.fillStyle = '#37474f';
    ctx.fillRect(x - 3, 40, 6, 80);
    const g = ctx.createRadialGradient(x, 40, 4, x, 90, 110);
    g.addColorStop(0, 'rgba(255,236,179,0.4)');
    g.addColorStop(1, 'rgba(255,236,179,0)');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(x, 90, 110, 0, Math.PI * 2);
    ctx.fill();
    disc(ctx, x, 38, 8, '#ffe082');
  }
}

function paintPipes(ctx: CanvasRenderingContext2D, paths: readonly (readonly Vec[])[], p: MapPalette): void {
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  for (const path of paths) {
    stroke(ctx, path, 'rgba(0,0,0,0.72)', 54, 0, 12);
    stroke(ctx, path, mix(p.pipeDark, '#000000', 0.35), 44, 0, 5);
    stroke(ctx, path, p.pipeDark, 38, 0, 1);
    stroke(ctx, path, mix(p.pipe, '#5d4037', 0.18), 32, 0, 0);
    stroke(ctx, path, p.pipe, 28, 0, -1);
    stroke(ctx, path, mix(p.pipe, '#c47a3a', 0.4), 20, 0, -3);
    stroke(ctx, path, mix(p.pipe, '#ffffff', 0.38), 10, 0, -8);
    stroke(ctx, path, 'rgba(255,236,200,0.38)', 3.2, 0, -12);
    wrapInsulation(ctx, path, p);
    weldSeams(ctx, path, p);
  }
  for (const path of paths) {
    for (let i = 1; i < path.length - 1; i++) flange(ctx, path[i]!, p);
    drawMarker(ctx, path[0]!, '#ef5350', 'IN');
    drawMarker(ctx, path[path.length - 1]!, '#66bb6a', 'OUT');
  }
}

function weldSeams(ctx: CanvasRenderingContext2D, path: readonly Vec[], p: MapPalette): void {
  for (let i = 1; i < path.length; i++) {
    const a = path[i - 1]!;
    const b = path[i]!;
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    const len = Math.hypot(dx, dy) || 1;
    const ux = dx / len;
    const uy = dy / len;
    for (let d = 48; d < len - 40; d += 72) {
      const x = a.x + ux * d;
      const y = a.y + uy * d;
      ctx.strokeStyle = mix(p.pipeDark, '#000000', 0.35);
      ctx.lineWidth = 2.2;
      ctx.beginPath();
      ctx.ellipse(x, y, 15, 9, Math.atan2(uy, ux), 0, Math.PI * 2);
      ctx.stroke();
      ctx.strokeStyle = rgba('#ffe0b2', 0.22);
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      ctx.ellipse(x - uy * 2, y + ux * 2, 12, 6.5, Math.atan2(uy, ux), 0, Math.PI * 2);
      ctx.stroke();
    }
  }
}

function wrapInsulation(ctx: CanvasRenderingContext2D, path: readonly Vec[], p: MapPalette): void {
  ctx.strokeStyle = mix(p.wall, p.accent, 0.25);
  ctx.lineWidth = 12;
  ctx.lineCap = 'butt';
  for (let i = 1; i < path.length; i++) {
    const a = path[i - 1]!;
    const b = path[i]!;
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    const len = Math.hypot(dx, dy) || 1;
    const ux = dx / len;
    const uy = dy / len;
    for (let d = 36; d < len - 24; d += 56) {
      const x = a.x + ux * d;
      const y = a.y + uy * d;
      ctx.beginPath();
      ctx.moveTo(x - ux * 5, y - uy * 5);
      ctx.lineTo(x + ux * 5, y + uy * 5);
      ctx.stroke();
    }
  }
  ctx.lineCap = 'round';
}

function stroke(ctx: CanvasRenderingContext2D, pts: readonly Vec[], color: string, width: number, dx: number, dy: number): void {
  ctx.strokeStyle = color;
  ctx.lineWidth = width;
  ctx.beginPath();
  pts.forEach((pt, i) => (i === 0 ? ctx.moveTo(pt.x + dx, pt.y + dy) : ctx.lineTo(pt.x + dx, pt.y + dy)));
  ctx.stroke();
}

function flange(ctx: CanvasRenderingContext2D, pt: Vec, p: MapPalette): void {
  disc(ctx, pt.x, pt.y + 4, 24, 'rgba(0,0,0,0.42)');
  ctx.beginPath();
  ctx.arc(pt.x, pt.y, 22, 0, Math.PI * 2);
  celFill(ctx, mix(p.pipeDark, '#3e2723', 0.25), 2.8);
  ctx.beginPath();
  ctx.arc(pt.x, pt.y, 16, 0, Math.PI * 2);
  celFill(ctx, mix(p.pipe, '#5d4037', 0.2), 2.2);
  ring(ctx, pt.x, pt.y, 12, mix(p.accent, '#ffffff', 0.28), 3.2);
  disc(ctx, pt.x - 4, pt.y - 5, 5.5, rgba('#ffffff', 0.16));
  for (let k = 0; k < 8; k++) {
    const a = (k / 8) * Math.PI * 2;
    rivet(ctx, pt.x + Math.cos(a) * 18.5, pt.y + Math.sin(a) * 18.5, 2.4);
  }
}

function drawMarker(ctx: CanvasRenderingContext2D, p: Vec, color: string, label: string): void {
  const x = Math.max(34, Math.min(WORLD_W - 34, p.x));
  const y = Math.max(34, Math.min(WORLD_H - 34, p.y));
  radial(ctx, x, y, 4, 48, color, 0.55);
  blotch(ctx, x, y + 5, 20, 8, 0, 'rgba(0,0,0,0.55)');
  ctx.beginPath();
  ctx.roundRect(x - 22, y - 16, 44, 32, 8);
  celFill(ctx, mix('#3e2a18', color, 0.18), 3);
  ctx.beginPath();
  ctx.arc(x, y, 14, 0, Math.PI * 2);
  celFill(ctx, color, 2.4);
  disc(ctx, x - 3.5, y - 4.5, 4.5, rgba('#ffffff', 0.42));
  ring(ctx, x, y, 20, '#c9a15b', 2.4);
  for (let k = 0; k < 6; k++) {
    const a = (k / 6) * Math.PI * 2;
    rivet(ctx, x + Math.cos(a) * 20, y + Math.sin(a) * 20, 2.1);
  }
  stampText(ctx, label, x, y + 1, { size: 12, color: '#fff8e1', display: true });
}

function paintVignette(ctx: CanvasRenderingContext2D, id: string): void {
  vignette(ctx, WORLD_W, WORLD_H, id === 'serviceCall' ? 0.72 : 0.52);
}

/** Live water/steam shimmer on top of the cached yard. */
export function paintPipeFlow(ctx: CanvasRenderingContext2D, paths: readonly (readonly Vec[])[], time: number, accent: string): void {
  ctx.save();
  ctx.lineCap = 'round';
  for (const path of paths) {
    ctx.strokeStyle = mix(accent, '#ffffff', 0.55);
    ctx.globalAlpha = 0.48;
    ctx.lineWidth = 7;
    ctx.setLineDash([18, 22]);
    ctx.lineDashOffset = -time * 52;
    ctx.beginPath();
    path.forEach((pt, i) => (i === 0 ? ctx.moveTo(pt.x, pt.y) : ctx.lineTo(pt.x, pt.y)));
    ctx.stroke();
    // specular glint dashes
    ctx.strokeStyle = rgba('#fff8e1', 0.7);
    ctx.globalAlpha = 0.85;
    ctx.lineWidth = 2.6;
    ctx.setLineDash([6, 26]);
    ctx.lineDashOffset = -time * 78;
    ctx.beginPath();
    path.forEach((pt, i) => (i === 0 ? ctx.moveTo(pt.x, pt.y - 3.5) : ctx.lineTo(pt.x, pt.y - 3.5)));
    ctx.stroke();
    // marching bubble discs along segments
    for (let i = 0; i < path.length - 1; i++) {
      const a = path[i]!;
      const b = path[i + 1]!;
      const dx = b.x - a.x;
      const dy = b.y - a.y;
      const len = Math.hypot(dx, dy) || 1;
      const ux = dx / len;
      const uy = dy / len;
      for (let k = 0; k < 2; k++) {
        const t = ((time * 0.55 + i * 0.31 + k * 0.48) % 1);
        const bx = a.x + dx * t - uy * 3;
        const by = a.y + dy * t + ux * 2;
        ctx.globalAlpha = 0.35 + Math.sin(time * 6 + i + k) * 0.12;
        disc(ctx, bx, by, 2.2 + (k % 2), rgba('#e1f5fe', 0.85));
        disc(ctx, bx - 0.6, by - 0.6, 0.9, rgba('#ffffff', 0.7));
      }
    }
  }
  ctx.setLineDash([]);
  ctx.restore();
}

/** Drips, steam, and flange sparks — the yard is alive. */
export function paintAtmosphere(ctx: CanvasRenderingContext2D, map: MapDef, time: number): void {
  if (usesPaintedYard(map)) return;
  ctx.save();
  let n = 0;
  for (const path of map.paths) {
    for (let i = 1; i < path.length - 1; i++) {
      const pt = path[i]!;
      const drop = (time * 55 + n * 23) % 64;
      const fade = 1 - drop / 64;
      ctx.fillStyle = rgba(map.palette.accent, 0.28 + fade * 0.4);
      ctx.beginPath();
      ctx.ellipse(pt.x + Math.sin(time + n) * 2, pt.y + 10 + drop, 2.8, 4.2, 0, 0, Math.PI * 2);
      ctx.fill();
      // splash ring when drip nears ground
      if (drop > 52) {
        const splash = (drop - 52) / 12;
        ctx.strokeStyle = rgba(map.palette.accent, 0.35 * (1 - splash));
        ctx.lineWidth = 1.6;
        ctx.beginPath();
        ctx.ellipse(pt.x, pt.y + 72, 4 + splash * 10, 2 + splash * 3, 0, 0, Math.PI * 2);
        ctx.stroke();
      }
      // flange weld glint
      if (n % 2 === 0) {
        radial(ctx, pt.x, pt.y, 2, 18 + Math.sin(time * 5 + n) * 4, '#ffe082', 0.22);
      }
      n++;
    }
    for (let i = 0; i < path.length - 1; i++) {
      const a = path[i]!;
      const b = path[i + 1]!;
      const t = (Math.sin(time * 0.7 + n) + 1) / 2;
      const x = a.x + (b.x - a.x) * t;
      const y = a.y + (b.y - a.y) * t;
      // chunky steam blotches
      blotch(ctx, x, y - 10, 10 + Math.sin(time * 2 + n) * 3, 7, 0.2, rgba('#eceff1', 0.16 + Math.sin(time * 3 + n) * 0.06));
      blotch(ctx, x + 6, y - 18, 7, 5, -0.3, rgba('#fff8e1', 0.12));
      const t2 = (t + 0.35) % 1;
      blotch(
        ctx,
        a.x + (b.x - a.x) * t2,
        a.y + (b.y - a.y) * t2 - 16,
        8,
        6,
        0.4,
        rgba(map.id === 'snowmelt' ? '#e1f5fe' : '#fff8e1', 0.14),
      );
      n++;
    }
  }
  // denser hanging dust motes
  for (let i = 0; i < 36; i++) {
    const x = (i * 83 + time * (8 + (i % 3))) % WORLD_W;
    const y = 40 + ((i * 57 + time * (4 + (i % 2))) % (WORLD_H - 80));
    ctx.fillStyle = rgba('#fff8e1', 0.1 + (i % 3) * 0.04);
    ctx.beginPath();
    ctx.arc(x, y, 1.4 + (i % 2), 0, Math.PI * 2);
    ctx.fill();
  }
  for (let i = 0; i < 10; i++) {
    const x = 60 + ((i * 151 + time * 12) % (WORLD_W - 120));
    const y = 30 + ((time * 40 + i * 90) % (WORLD_H - 60));
    ctx.fillStyle = rgba(map.palette.accent, 0.22);
    ctx.beginPath();
    ctx.ellipse(x, y, 2, 3.8, 0, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

/** Silhouettes and weeds drawn over actors so the map has a foreground. */
export function paintForeground(ctx: CanvasRenderingContext2D, map: MapDef): void {
  if (usesPaintedYard(map)) return;
  const p = map.palette;
  const g = ctx.createLinearGradient(0, WORLD_H - 120, 0, WORLD_H);
  g.addColorStop(0, 'rgba(0,0,0,0)');
  g.addColorStop(1, 'rgba(0,0,0,0.55)');
  ctx.fillStyle = g;
  ctx.fillRect(0, WORLD_H - 120, WORLD_W, 120);

  switch (map.id) {
    case 'attic':
    case 'crawlspace':
      // joist stubs
      ctx.fillStyle = mix(p.wall, '#1a1008', 0.55);
      for (let i = 0; i < 10; i++) {
        const x = 40 + i * 95;
        ctx.fillRect(x, WORLD_H - 38, 10, 38);
        ctx.fillRect(x - 4, WORLD_H - 42, 18, 6);
      }
      break;
    case 'snowmelt':
      // snow berms
      for (let i = 0; i < 8; i++) {
        blotch(ctx, 60 + i * 120, WORLD_H - 4, 48, 16, 0, mix('#e1f5fe', p.wall, 0.25));
      }
      break;
    case 'serviceCall':
      // lamp poles
      for (const x of [90, WORLD_W / 2, WORLD_W - 100]) {
        ctx.fillStyle = mix(p.wall, '#000000', 0.7);
        ctx.fillRect(x - 3, WORLD_H - 70, 6, 70);
        ctx.beginPath();
        ctx.arc(x, WORLD_H - 74, 8, 0, Math.PI * 2);
        ctx.fillStyle = rgba('#ffe082', 0.35);
        ctx.fill();
      }
      break;
    case 'heatPlant':
    case 'mechanicalRoom':
      // valve stems / pipe stubs
      ctx.strokeStyle = mix(p.pipeDark, '#000000', 0.4);
      ctx.lineWidth = 5;
      for (let i = 0; i < 6; i++) {
        const x = 80 + i * 150;
        ctx.beginPath();
        ctx.moveTo(x, WORLD_H);
        ctx.lineTo(x, WORLD_H - 28);
        ctx.lineTo(x + 14, WORLD_H - 36);
        ctx.stroke();
      }
      break;
    default:
      break;
  }

  ctx.fillStyle = mix(p.wall, '#000000', 0.62);
  for (let i = 0; i < 16; i++) {
    const x = 10 + i * 62 + (i % 3) * 6;
    const y = WORLD_H - 2 - (i % 4);
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.quadraticCurveTo(x - 5, y - 16, x - 8, y - 26);
    ctx.moveTo(x, y);
    ctx.quadraticCurveTo(x + 2, y - 18, x + 1, y - 28);
    ctx.moveTo(x, y);
    ctx.quadraticCurveTo(x + 6, y - 14, x + 9, y - 24);
    ctx.strokeStyle = mix(p.wall, '#000000', 0.55);
    ctx.lineWidth = 2.2;
    ctx.stroke();
  }

  ctx.fillStyle = mix(p.wall, '#000000', 0.7);
  ctx.beginPath();
  ctx.ellipse(42, WORLD_H + 8, 46, 22, 0, 0, Math.PI * 2);
  ctx.ellipse(WORLD_W - 50, WORLD_H + 10, 54, 24, 0, 0, Math.PI * 2);
  ctx.fill();

  ctx.strokeStyle = mix(p.pipeDark, '#000000', 0.45);
  ctx.lineWidth = 5;
  ctx.beginPath();
  ctx.arc(120, WORLD_H - 8, 16, Math.PI, Math.PI * 2);
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(WORLD_W - 130, WORLD_H - 6, 14, Math.PI, Math.PI * 2);
  ctx.stroke();
}
