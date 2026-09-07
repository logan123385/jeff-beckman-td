import { dist, lerp, type Vec } from '../core/vec';

/** A waypoint polyline with cumulative lengths so enemies can be positioned by scalar progress. */
export class Path {
  readonly points: readonly Vec[];
  readonly cumulative: number[];
  readonly length: number;

  constructor(points: readonly Vec[]) {
    if (points.length < 2) throw new Error('Path needs at least two points');
    this.points = points;
    this.cumulative = [0];
    let total = 0;
    for (let i = 1; i < points.length; i++) {
      total += dist(points[i - 1]!, points[i]!);
      this.cumulative.push(total);
    }
    this.length = total;
  }

  pointAt(progress: number): Vec {
    if (progress <= 0) return { ...this.points[0]! };
    if (progress >= this.length) return { ...this.points[this.points.length - 1]! };
    let i = 1;
    while (i < this.cumulative.length && this.cumulative[i]! < progress) i++;
    const segStart = this.cumulative[i - 1]!;
    const segLen = this.cumulative[i]! - segStart;
    const t = segLen === 0 ? 0 : (progress - segStart) / segLen;
    return lerp(this.points[i - 1]!, this.points[i]!, t);
  }

  /** Closest point on the polyline to `p`. */
  nearestPoint(p: Vec): { pos: Vec; progress: number; dist: number } {
    let best = { pos: { ...this.points[0]! }, progress: 0, dist: Infinity };
    for (let i = 1; i < this.points.length; i++) {
      const a = this.points[i - 1]!;
      const b = this.points[i]!;
      const abx = b.x - a.x;
      const aby = b.y - a.y;
      const segLen2 = abx * abx + aby * aby || 1;
      const t = Math.max(0, Math.min(1, ((p.x - a.x) * abx + (p.y - a.y) * aby) / segLen2));
      const q = { x: a.x + abx * t, y: a.y + aby * t };
      const d = dist(p, q);
      if (d < best.dist) best = { pos: q, progress: this.cumulative[i - 1]! + Math.sqrt(segLen2) * t, dist: d };
    }
    return best;
  }

  /** Unit direction of travel at a given progress. */
  directionAt(progress: number): Vec {
    let i = 1;
    while (i < this.cumulative.length - 1 && this.cumulative[i]! < progress) i++;
    const a = this.points[i - 1]!;
    const b = this.points[i]!;
    const d = dist(a, b) || 1;
    return { x: (b.x - a.x) / d, y: (b.y - a.y) / d };
  }
}
