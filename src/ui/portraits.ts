import { ENEMIES } from '../data/enemies';
import { JEFF } from '../data/jeff';
import { TOWERS } from '../data/towers';
import type { EnemyId, TowerId } from '../data/types';
import { drawEnemy, drawJeff, drawTower } from '../render/sprites';
import type { Enemy, Hero, Tower } from '../sim/state';

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
    pos: { x: size / 2, y: size / 2 + 12 },
    anchor: { x: 0, y: 0 },
    dest: null,
    hp: JEFF.hp,
    maxHp: JEFF.hp,
    attackTimer: 0,
    tapCount: 0,
    clampCooldown: 0,
    shutoffCooldown: 0,
    pulseCooldown: 0,
    sleeveCooldown: 0,
    coffeeCooldown: 0,
    sleeveTimer: 0,
    coffeeTimer: 0,
    downed: 0,
    facing: 1,
    swing: 0,
    orderTargetId: null,
    engaged: false,
    targetId: null,
  };
  ctx.save();
  ctx.translate(size / 2, size / 2 + 12);
  ctx.scale(size / 72, size / 72);
  ctx.translate(-size / 2, -(size / 2 + 12));
  drawJeff(ctx, hero, 0, false, 1.12);
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
    dotDps: 0,
    dotTime: 0,
    dotSource: null,
    marked: false,
    haste: 0,
    laneTimer: 0,
    hitFlash: 0,
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

/** Static tool portrait for the loadout screen. */
export function towerPortrait(id: TowerId, size = 72): HTMLCanvasElement {
  const { canvas, ctx } = makeCanvas(size, size);
  const def = TOWERS[id];
  const t: Tower = {
    id: 0,
    def,
    slot: 0,
    pos: { x: size / 2, y: size / 2 + 10 },
    rally: { x: size / 2, y: size / 2 + 10 },
    level: 0,
    cooldown: 0,
    hp: def.levels[0].hp ?? 0,
    maxHp: def.levels[0].hp ?? 0,
    rebuild: 0,
    frozen: 0,
    shieldCooldown: 0,
    facing: -0.6,
    recoil: 0,
    invested: 0,
    charge: 0,
    aim: 'first',
  };
  ctx.save();
  ctx.translate(size / 2, size / 2 + 8);
  ctx.scale(size / 64, size / 64);
  ctx.translate(-size / 2, -(size / 2 + 8));
  drawTower(ctx, t, 1.4);
  ctx.restore();
  return canvas;
}
