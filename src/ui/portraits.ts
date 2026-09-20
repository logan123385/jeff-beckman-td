import { artReady, ENEMY_ART, heroFrame, paintedSprite, TOWER_ART } from '../render/art';
import { HEROES, type HeroId } from '../data/heroes';
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
export function heroPortrait(id: HeroId, size = 72): HTMLCanvasElement {
  if (id === 'jeff') return jeffPortrait(size, size > 90);
  const { canvas, ctx } = makeCanvas(size, size);
  ctx.translate(size / 2, size - 3);
  if (!heroFrame(ctx, id, 0, 0, size - 6)) {
    ctx.fillStyle = HEROES[id].color; ctx.font = `bold ${size * .5}px serif`; ctx.textAlign = 'center'; ctx.fillText(HEROES[id].name[0]!, 0, -size * .2);
  }
  return canvas;
}

export function jeffPortrait(size = 72, fullBody = false): HTMLCanvasElement {
  const { canvas, ctx } = makeCanvas(size, size);
  if (!fullBody && artReady('unitsAdvanced')) {
    paintedSprite(ctx, 'unitsAdvanced', 10, size / 2, size, size - 2, size);
    return canvas;
  }
  if (artReady('units')) {
    paintedSprite(ctx, 'units', 0, size / 2, fullBody ? size - 4 : size * 1.65, fullBody ? size - 8 : size * 1.63, fullBody ? size : size * 1.5);
    return canvas;
  }
  const hero: Hero = {
    pos: { x: size / 2, y: size / 2 + 12 },
    prev: { x: size / 2, y: size / 2 + 12 },
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
    deployed: true,
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
  if (ENEMY_ART[id] !== undefined && artReady(ENEMY_ART[id]! >= 16 ? 'unitsAdvanced' : 'units')) {
    if (silhouette) ctx.filter = 'brightness(0.15)';
    paintedSprite(ctx, 'units', ENEMY_ART[id]!, size / 2, size - 4, size - 8, size - 8);
    return canvas;
  }
  const def = ENEMIES[id];
  const e: Enemy = {
    id: 0,
    def,
    hp: def.hp,
    maxHp: def.hp,
    pathIdx: 0,
    progress: 0,
    pos: { x: size / 2, y: size / 2 + (def.flying ? 8 : 0) },
    prev: { x: size / 2, y: size / 2 + (def.flying ? 8 : 0) },
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
    deathAge: 0,
    attackTimer: 0,
    wobble: 0,
    dotDps: 0,
    dotTime: 0,
    dotSource: null,
    marked: false,
    haste: 0,
    laneTimer: 0,
    hitFlash: 0,
    incoming: 0,
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
  if (TOWER_ART[id] !== undefined && artReady(TOWER_ART[id]! >= 12 ? 'towersAdvanced' : 'towers')) {
    paintedSprite(ctx, 'towers', TOWER_ART[id]!, size / 2, size - 3, size - 6, size - 4);
    return canvas;
  }
  if (['apprentices','jayjay','cbjDoni'].includes(id) && artReady('recruitTowers')) {
    paintedSprite(ctx, 'recruitTowers', (id === 'apprentices' ? 0 : id === 'jayjay' ? 4 : 8), size / 2, size - 3, size - 6, size - 4); return canvas;
  }
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
