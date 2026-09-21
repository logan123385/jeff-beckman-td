import type { Vec } from '../core/vec';
import type { MapDef } from '../data/types';
import { artReady, backgroundArt } from './art';
import { blotch, disc, mix, stampText } from './ink';

export function usesPaintedYard(map: MapDef): boolean {
  return artReady('landscapes') || artReady(biomeFor(map) === undefined ? 'waterworks' : 'biomes');
}

function biomeFor(map: MapDef): number | undefined {
  if (['boilerRoom', 'mechanicalRoom', 'heatPlant'].includes(map.id)) return 0;
  if (['attic', 'radiantFloor'].includes(map.id)) return 1;
  if (map.id === 'snowmelt') return 2;
  if (map.id === 'liftStation') return 3;
  return undefined;
}

export function paintLandscape(ctx: CanvasRenderingContext2D, map: MapDef): boolean {
  if (!usesPaintedYard(map)) return false;
  ctx.save();
  if (map.id === 'serviceCall') ctx.filter = 'brightness(.8) saturate(.88)';
  else if (map.id === 'heatPlant') ctx.filter = 'saturate(1.08)';
  else if (map.id === 'mechanicalRoom') ctx.filter = 'saturate(.68) brightness(.94)';
  else if (map.id === 'attic') ctx.filter = 'sepia(.16) brightness(1.12)';
  else if (map.id === 'radiantFloor') ctx.filter = 'sepia(.2) saturate(.8) brightness(1.18)';
  else if (map.id === 'municipalMain') ctx.filter = 'saturate(.85) hue-rotate(8deg)';
  backgroundArt(ctx, map.id === 'serviceCall' ? 3 : biomeFor(map));
  ctx.restore();
  return true;
}

/** Wide readable routes share the exact centerline used by the simulation. */
export function paintRoutes(ctx: CanvasRenderingContext2D, map: MapDef): void {
  const snow = map.id === 'snowmelt', night = map.id === 'serviceCall';
  const interior = [0, 1].includes(biomeFor(map) ?? -1);
  const road = snow ? '#b7ccdc' : night || map.id === 'liftStation' ? '#566f70' : interior ? '#716756' : '#b2a180';
  ctx.save(); ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  for (const points of map.paths) {
    const path = new Path2D();
    points.forEach((p, i) => i ? path.lineTo(p.x, p.y) : path.moveTo(p.x, p.y));
    for (const [width, color] of [[62, '#14252e40'], [55, interior ? '#252e32' : '#435145'], [51, snow ? '#edf7fa' : '#b2a381'], [47, '#3e4542'], [44, road]] as const) {
      ctx.lineWidth = width; ctx.strokeStyle = color; ctx.stroke(path);
    }
    for (let i = 1; i < points.length; i++) {
      const a = points[i - 1]!, b = points[i]!;
      const length = Math.hypot(b.x - a.x, b.y - a.y), ux = (b.x - a.x) / length, uy = (b.y - a.y) / length;
      for (let j = 8; j < length - 8; j += 12) {
        const random = Math.sin(i * 12.3 + j * 6.72) * 0.5 + 0.5;
        const lateral = (random - 0.5) * 38;
        const x = a.x + ux * j - uy * lateral, y = a.y + uy * j + ux * lateral;
        blotch(ctx, x, y, 1.4 + random * 2, 0.8 + random, 0.3, '#69573838');
        if (j % 24 === 8) {
          // Individually laid slabs follow the route's true tangent.
          ctx.save(); ctx.translate(a.x + ux * j, a.y + uy * j); ctx.rotate(Math.atan2(uy, ux));
          for (const lane of [-1, 0]) {
            const offset = lane === -1 ? 0 : 9;
            ctx.fillStyle = mix(road, random > .5 ? '#e9debc' : '#364a4c', .05 + random * .07);
            ctx.strokeStyle = '#273e4338'; ctx.lineWidth = .7;
            ctx.beginPath(); ctx.roundRect(offset - 10, lane * 20, 23, 19, 2); ctx.fill(); ctx.stroke();
            ctx.strokeStyle = '#fff2d323'; ctx.beginPath(); ctx.moveTo(offset - 7, lane * 20 + 1); ctx.lineTo(offset + 10, lane * 20 + 1); ctx.stroke();
          }
          if (interior) { ctx.fillStyle = '#ceb38688'; ctx.fillRect(-1, -20, 2, 2); ctx.fillRect(-1, 18, 2, 2); }
          ctx.restore();
        }
        if (j % 36 === 8) for (const side of [-1, 1]) {
          const px = a.x + ux * j - uy * (26 + random * 2) * side;
          const py = a.y + uy * j + ux * (26 + random * 2) * side;
          blotch(ctx, px, py + 1.5, 4, 3, i, '#38462c77');
          blotch(ctx, px, py, 3.5, 2.5, i, snow ? '#e3eaf1' : '#a0a36c');
        }
      }
    }
    const first = points[0]!, next = points[1]!;
    const entry = { x: Math.max(25, Math.min(935, first.x + (next.x - first.x) * 0.22)), y: Math.max(32, Math.min(568, first.y + (next.y - first.y) * 0.22)) };
    routeFlag(ctx, entry, '#b64e3a', '⚔');
    const last = points[points.length - 1]!;
    routeFlag(ctx, { x: Math.max(26, Math.min(932, last.x)), y: Math.max(28, Math.min(570, last.y)) }, '#307c86', '♥');
  }
  ctx.restore();
}

function routeFlag(ctx: CanvasRenderingContext2D, p: Vec, color: string, label: string): void {
  ctx.strokeStyle = '#4c3b23'; ctx.lineWidth = 4; ctx.beginPath(); ctx.moveTo(p.x, p.y + 10); ctx.lineTo(p.x, p.y - 36); ctx.stroke();
  ctx.fillStyle = color; ctx.strokeStyle = '#f6d697'; ctx.lineWidth = 1.5;
  ctx.beginPath(); ctx.moveTo(p.x - 1, p.y - 36); ctx.lineTo(p.x + 28, p.y - 32); ctx.lineTo(p.x + 23, p.y - 18); ctx.lineTo(p.x, p.y - 20); ctx.closePath(); ctx.fill(); ctx.stroke();
  disc(ctx, p.x, p.y - 39, 3, '#f4d391'); stampText(ctx, label, p.x + 13, p.y - 23, { size: 12, color: '#ffedc2' });
}
