import { ENEMIES } from '../data/enemies';
import { JEFF } from '../data/jeff';
import type { EnemyId } from '../data/types';
import { drawEnemy, drawJeff } from '../render/sprites';
import type { Enemy, Hero } from '../sim/state';

function makeCanvas(w: number, hgt: number): { canvas: HTMLCanvasElement; ctx: CanvasRenderingContext2D } {
  const canvas = document.createElement('canvas');
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  canvas.width = w * dpr;
  canvas.height = hgt * dpr;
  canvas.style.width = `${w}px`;
  canvas.style.height = `${hgt}px`;
  const ctx = canvas.getContext('2d')!;
  ctx.scale(dpr, dpr);
  return { canvas, ctx };
}

/** Static Jeff portrait for menus and the HUD. */
export function jeffPortrait(size = 72): HTMLCanvasElement {
  const { canvas, ctx } = makeCanvas(size, size);
  const hero: Hero = {
    pos: { x: size / 2, y: size / 2 + 6 },
    anchor: { x: 0, y: 0 },
    dest: null,
    hp: JEFF.hp,
    maxHp: JEFF.hp,
    attackTimer: 0,
    tapTimer: 0,
    clampCooldown: 0,
    shutoffCooldown: 0,
    downed: 0,
    facing: 1,
    swing: 0,
    targetId: null,
  };
  ctx.save();
  ctx.translate(size / 2, size / 2 + 6);
  ctx.scale(size / 72, size / 72);
  ctx.translate(-size / 2, -(size / 2 + 6));
  drawJeff(ctx, hero, 0, false);
  ctx.restore();
  return canvas;
}

/** Enemy portrait; `silhouette` renders a dark unknown shape for the encyclopedia. */
export function enemyPortrait(id: EnemyId, size = 64, silhouette = false): HTMLCanvasElement {
  const { canvas, ctx } = makeCanvas(size, size);
  const def = ENEMIES[id];
  const e: Enemy = {
    id: 0,
    def,
    hp: def.hp,
    maxHp: def.hp,
    pathIdx: 0,
    progress: 0,
    pos: { x: size / 2, y: size / 2 + (def.flying ? 8 : 0) },
    lane: 0,
    speedMult: 1,
    slow: 0,
    stun: 0,
    heldBy: null,
    phaseTimer: 0,
    phased: false,
    armorShred: 0,
    shredTimer: 0,
    freezeTimer: 0,
    bossPhase: 0,
    ventTimer: 0,
    dead: false,
    escaped: false,
    attackTimer: 0,
    wobble: 0,
  };
  const s = Math.min(2.2, (size * 0.36) / def.radius);
  ctx.save();
  if (silhouette) ctx.filter = 'brightness(0.15)';
  ctx.translate(size / 2, size / 2);
  ctx.scale(s, s);
  ctx.translate(-size / 2, -size / 2);
  drawEnemy(ctx, e, 1.2);
  ctx.restore();
  return canvas;
}
