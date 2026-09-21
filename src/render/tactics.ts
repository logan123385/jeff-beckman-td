import { bossAttack } from '../data/bosses';
import type { Game } from '../sim/game';
import { stampText } from './ink';

export function drawBossTelegraphs(ctx: CanvasRenderingContext2D, game: Game): void {
  const attack = bossAttack(game.map.id);
  ctx.save();
  for (const e of game.enemies) {
    if (!e.ventCast || e.dead || e.escaped) continue;
    const { pos, left, duration } = e.ventCast;
    const progress = 1 - left / duration;
    ctx.fillStyle = `rgba(200, 46, 27, ${.12 + progress * .22})`;
    ctx.strokeStyle = '#ffe4a1'; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.arc(pos.x, pos.y, attack.radius, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
    ctx.strokeStyle = '#ff623f'; ctx.lineWidth = 6;
    ctx.beginPath(); ctx.arc(pos.x, pos.y, attack.radius - 6, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * progress); ctx.stroke();
    ctx.setLineDash([6, 7]); ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(pos.x - 12, pos.y); ctx.lineTo(pos.x + 12, pos.y); ctx.moveTo(pos.x, pos.y - 12); ctx.lineTo(pos.x, pos.y + 12); ctx.stroke(); ctx.setLineDash([]);
    stampText(ctx, `${attack.name} · ${left.toFixed(1)}s`, pos.x, pos.y - attack.radius - 13, { size: 12, color: '#fff0c3' });
  }
  for (const t of game.towers) if ((t.overheated ?? 0) > 0) {
    ctx.strokeStyle = '#ffb45b'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.arc(t.pos.x, t.pos.y - 18, 26, 0, Math.PI * 2); ctx.stroke();
    stampText(ctx, `OVERHEATED ${t.overheated!.toFixed(1)}s`, t.pos.x, t.pos.y - 66, { size: 10, color: '#ffd69b' });
  }
  ctx.restore();
}

export function drawScoutedRoute(ctx: CanvasRenderingContext2D, game: Game, route: number | null): void {
  if (route === null) return;
  const path = game.paths[route];
  if (!path) return;
  ctx.save(); ctx.strokeStyle = '#fff0ab'; ctx.lineWidth = 4; ctx.lineCap = 'round';
  ctx.setLineDash([10, 15]); ctx.lineDashOffset = -game.time * 24;
  ctx.beginPath(); game.map.paths[route]!.forEach((p, i) => i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y)); ctx.stroke(); ctx.setLineDash([]);
  for (let d = 80; d < path.length; d += 150) {
    const p = path.pointAt(d), dir = path.directionAt(d);
    ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(Math.atan2(dir.y, dir.x));
    ctx.beginPath(); ctx.moveTo(-7, -7); ctx.lineTo(2, 0); ctx.lineTo(-7, 7); ctx.stroke(); ctx.restore();
  }
  ctx.restore();
}
