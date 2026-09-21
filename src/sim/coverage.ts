import type { Game } from './game';

/** Sample direct shooter reach along the route centerline. Deliberately excludes
 * hero movement, splash beyond aim range, recruit pursuit, immunity and DPS. */
export function routeCoverage(game: Game, route: number): { ground: number; air: number } {
  const path = game.paths[route];
  if (!path || path.length <= 0) return { ground: 0, air: 0 };
  const shooters = game.towers.filter(t => t.def.kind === 'shooter' && game.effectiveDamage(t) > 0);
  const count = Math.max(1, Math.ceil(path.length / 8));
  let ground = 0, air = 0;
  for (let i = 0; i < count; i++) {
    const progress = (i + .5) * path.length / count;
    const point = path.pointAt(progress);
    let g = false, a = false;
    for (const tower of shooters) {
      if (tower.def.id === 'pipeSnake') {
        const nearest = game.nearestPath(tower.pos);
        if (nearest.pathIdx === route && progress >= nearest.progress - 12 && progress <= nearest.progress + (tower.def.levels[tower.level]!.pierce ?? 160)) {
          // Pipe Snake attacks the route, including airborne enemies on it.
          g = true; a = true;
        }
      } else if (Math.hypot(point.x - tower.pos.x, point.y - tower.pos.y) <= game.effectiveRange(tower)) {
        g ||= tower.def.targets !== 'air'; a ||= tower.def.targets !== 'ground';
      }
    }
    if (g) ground++;
    if (a) air++;
  }
  return { ground: Math.round(ground / count * 100), air: Math.round(air / count * 100) };
}
