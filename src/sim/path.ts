import { dist, lerp, type Vec } from '../core/vec';

function catmullRom(p0: Vec, p1: Vec, p2: Vec, p3: Vec, t: number): Vec {
  const t2 = t * t;
  const t3 = t2 * t;
  return {
    x: 0.5 * (2 * p1.x + (-p0.x + p2.x) * t + (2 * p0.x - 5 * p1.x + 4 * p2.x - p3.x) * t2 + (-p0.x + 3 * p1.x - 3 * p2.x + p3.x) * t3),
    y: 0.5 * (2 * p1.y + (-p0.y + p2.y) * t + (2 * p0.y - 5 * p1.y + 4 * p2.y - p3.y) * t2 + (-p0.y + 3 * p1.y - 3 * p2.y + p3.y) * t3),
  };
}

/** Dense Catmull-Rom resampling so creeps glide through corners instead of snapping. */
function resample(points: readonly Vec[], perSeg = 10): Vec[] {
  if (points.length < 2) return points.map((p) => ({ ...p }));
  if (points.length === 2) return [{ ...points[0]! }, { ...points[1]! }];
  const raw: Vec[] = [];
  for (let i = 0; i < points.length - 1; i++) {
    const p0 = points[Math.max(0, i - 1)]!;
    const p1 = points[i]!;
    const p2 = points[i + 1]!;
    const p3 = points[Math.min(points.length - 1, i + 2)]!;
    for (let s = 0; s < perSeg; s++) raw.push(catmullRom(p0, p1, p2, p3, s / perSeg));
  }
  raw.push({ ...points[points.length - 1]! });
  const out: Vec[] = [raw[0]!];
  for (let i = 1; i < raw.length; i++) {
    const a = out[out.length - 1]!;
    const b = raw[i]!;
    if ((b.x - a.x) * (b.x - a.x) + (b.y - a.y) * (b.y - a.y) > 1.15) out.push(b);
  }
  return out;
}

/** A waypoint polyline with cumulative lengths so enemies can be positioned by scalar progress. */
export class Path {
  readonly points: readonly Vec[];
  readonly cumulative: number[];
  readonly length: number;

  constructor(points: readonly Vec[]) {
    if (points.length < 2) throw new Error('Path needs at least two points');
    this.points = resample(points);
    this.cumulative = [0];
    let total = 0;
    for (let i = 1; i < this.points.length; i++) {
      total += dist(this.points[i - 1]!, this.points[i]!);
      this.cumulative.push(total);
    }
    this.length = total;
  }

  /** Position at `progress`. Negative progress walks in from off-map along the first segment. */
  pointAt(progress: number): Vec {
    if (progress < 0) {
      const a = this.points[0]!;
      const b = this.points[1] ?? a;
      const d = dist(a, b) || 1;
      const ux = (a.x - b.x) / d;
      const uy = (a.y - b.y) / d;
      return { x: a.x + ux * -progress, y: a.y + uy * -progress };
    }
    if (progress >= this.length) return { ...this.points[this.points.length - 1]! };
    let lo = 1;
    let hi = this.cumulative.length - 1;
    while (lo < hi) {
      const mid = (lo + hi) >> 1;
      if (this.cumulative[mid]! < progress) lo = mid + 1;
      else hi = mid;
    }
    const i = lo;
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

  /** Unit direction of travel at a given progress — blended across nearby samples so lane offset does not pop. */
  directionAt(progress: number): Vec {
    const span = 22;
    const a = this.pointAt(progress - span);
    const b = this.pointAt(progress + span);
    const d = dist(a, b) || 1;
    return { x: (b.x - a.x) / d, y: (b.y - a.y) / d };
  }
}
