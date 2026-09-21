import { familyStance, type WeaponFamilyId } from '../data/weapons';
import type { HeroMissile } from '../sim/state';
import { disc, glow, noGlow, radial, rgba } from './ink';

type Ctx = CanvasRenderingContext2D;
const TAU = Math.PI * 2;

/** Held melee prop (hero local space, facing already applied). */
export function drawMeleeProp(ctx: Ctx, family: WeaponFamilyId, phase: number, swinging: boolean): void {
  const stance = familyStance(family);
  if (stance !== 'melee') return;
  const load = swinging ? Math.sin(Math.min(1, phase) * Math.PI) : 0;
  ctx.save();
  switch (family) {
    case 'jeff_melee':
      drawPipeWrench(ctx, swinging ? phase : 0);
      break;
    case 'mike_melee':
      ctx.translate(14, -28); ctx.rotate(-0.55 + load * 0.9);
      drawTireIron(ctx);
      break;
    case 'bob_melee':
      ctx.translate(15, -30); ctx.rotate(-0.4 + load * 0.7);
      drawShockProd(ctx, swinging);
      break;
    case 'chris_melee':
      ctx.translate(16, -26); ctx.rotate(-0.35 + load * 1.1);
      drawRecipSaw(ctx, swinging ? phase : 0);
      break;
    case 'becbec_melee':
      ctx.translate(12, -22);
      drawWorkGloves(ctx, swinging);
      break;
    case 'cbj_melee':
      ctx.translate(16 - load * 6, -30); ctx.rotate(phase * 2.4);
      drawSpudMasher(ctx);
      break;
    case 'doni_melee':
      ctx.translate(13, -32); ctx.rotate(-0.5 + load * 0.95);
      drawGaff(ctx, load);
      break;
    case 'jayjay_melee':
      ctx.translate(11, -20);
      drawRingFists(ctx, swinging);
      break;
    case 'jeff_ranged':
    case 'mike_ranged':
    case 'bob_ranged':
    case 'chris_ranged':
    case 'becbec_ranged':
    case 'cbj_ranged':
    case 'doni_ranged':
    case 'jayjay_ranged':
      break;
    default: {
      const _exhaustive: never = family;
      void _exhaustive;
      break;
    }
  }
  ctx.restore();
}

/** Held ranged prop when idle/deployed (no missile in flight required). */
export function drawRangedProp(ctx: Ctx, family: WeaponFamilyId, time: number): void {
  if (familyStance(family) !== 'ranged') return;
  ctx.save();
  switch (family) {
    case 'jeff_ranged':
      ctx.translate(14, -28); ctx.rotate(-0.35);
      drawPressureWand(ctx, time);
      break;
    case 'mike_ranged':
      ctx.translate(16, -26); ctx.rotate(-0.55);
      drawPlungerHeld(ctx);
      break;
    case 'bob_ranged':
      ctx.translate(15, -24); ctx.rotate(-0.2);
      drawHandCannon(ctx, time);
      break;
    case 'chris_ranged':
      ctx.translate(15, -28); ctx.rotate(-0.85);
      drawGolfIron(ctx);
      break;
    case 'becbec_ranged':
      ctx.translate(14, -26); ctx.rotate(-0.45);
      drawRebarBundle(ctx);
      break;
    case 'cbj_ranged':
      ctx.translate(14, -24); ctx.rotate(-0.25);
      drawTaterCannon(ctx);
      break;
    case 'doni_ranged':
      ctx.translate(13, -30); ctx.rotate(-0.55);
      drawCastingRig(ctx);
      break;
    case 'jayjay_ranged':
      ctx.translate(12, -24); ctx.rotate(-0.15);
      drawBellPlateHeld(ctx, time);
      break;
    case 'jeff_melee':
    case 'mike_melee':
    case 'bob_melee':
    case 'chris_melee':
    case 'becbec_melee':
    case 'cbj_melee':
    case 'doni_melee':
    case 'jayjay_melee':
      break;
    default: {
      const _exhaustive: never = family;
      void _exhaustive;
      break;
    }
  }
  ctx.restore();
}

export function missileDrawer(kind: HeroMissile['kind']): 'plunger' | 'hose' | 'golf' | 'bell' | 'tater' | 'hook' | 'rebar' {
  switch (kind) {
    case 'plunger': return 'plunger';
    case 'hose': return 'hose';
    case 'golf': return 'golf';
    case 'bell': return 'bell';
    case 'tater': return 'tater';
    case 'hook': return 'hook';
    case 'rebar': return 'rebar';
    default: {
      const _exhaustive: never = kind;
      return _exhaustive;
    }
  }
}

export function drawMissileBody(ctx: Ctx, kind: HeroMissile['kind'], age: number, splash: number): void {
  const drawer = missileDrawer(kind);
  switch (drawer) {
    case 'golf':
      glow(ctx, '#fff9e8', 12);
      disc(ctx, 0, 0, 4.4, '#fff9e8'); disc(ctx, -1, 1, 0.9, '#a7b7b7');
      noGlow(ctx);
      break;
    case 'bell':
      glow(ctx, '#ffd54f', 14);
      disc(ctx, 0, 0, 5.2, '#ffd54f');
      ctx.strokeStyle = '#b8860b'; ctx.lineWidth = 1.2;
      ctx.beginPath(); ctx.arc(0, 0, 3.2, 0, TAU); ctx.stroke();
      disc(ctx, 0, 1.5, 1.4, '#8d6e22');
      noGlow(ctx);
      break;
    case 'tater':
      ctx.rotate(age * 7);
      drawTater(ctx, splash > 0 ? 9 : 6);
      break;
    case 'hook':
      ctx.strokeStyle = '#173d45'; ctx.lineWidth = 5; ctx.beginPath(); ctx.moveTo(-10, 0); ctx.lineTo(5, 0); ctx.bezierCurveTo(13, 0, 13, 11, 4, 11); ctx.lineTo(3, 6); ctx.stroke();
      ctx.strokeStyle = '#edf9f1'; ctx.lineWidth = 2; ctx.stroke();
      disc(ctx, -9, 0, 2.5, '#e38365');
      break;
    case 'rebar':
      ctx.strokeStyle = '#5c3317'; ctx.lineWidth = 4.2; ctx.beginPath(); ctx.moveTo(-14, 0); ctx.lineTo(12, 0); ctx.stroke();
      ctx.strokeStyle = '#c4783a'; ctx.lineWidth = 2; ctx.stroke();
      for (let i = 0; i < 4; i++) {
        ctx.strokeStyle = '#8b4513'; ctx.lineWidth = 1.1;
        ctx.beginPath(); ctx.moveTo(-10 + i * 6, -2.2); ctx.lineTo(-8 + i * 6, 2.2); ctx.stroke();
      }
      disc(ctx, 12, 0, 2.2, '#a0522d');
      break;
    case 'hose':
      ctx.strokeStyle = '#2a6f7a'; ctx.lineWidth = 5; ctx.beginPath(); ctx.moveTo(-18, 0); ctx.lineTo(4, 0); ctx.stroke();
      ctx.strokeStyle = '#8ddfe9'; ctx.lineWidth = 2.6; ctx.stroke();
      ctx.fillStyle = '#4fc3f7'; ctx.strokeStyle = '#1565a0'; ctx.lineWidth = 1.2;
      ctx.beginPath(); ctx.moveTo(3, -4); ctx.lineTo(14, -2); ctx.lineTo(14, 2); ctx.lineTo(3, 4); ctx.closePath(); ctx.fill(); ctx.stroke();
      radial(ctx, 12, 0, 1, 14, '#b3e5fc', 0.45);
      break;
    case 'plunger':
      ctx.strokeStyle = '#493929'; ctx.lineWidth = 5; ctx.beginPath(); ctx.moveTo(-16, 0); ctx.lineTo(6, 0); ctx.stroke();
      ctx.strokeStyle = '#d1aa69'; ctx.lineWidth = 2.5; ctx.stroke();
      ctx.fillStyle = '#b54b42'; ctx.strokeStyle = '#512e28'; ctx.lineWidth = 1.3;
      ctx.beginPath(); ctx.moveTo(5, -3); ctx.quadraticCurveTo(12, -5, 14, -8); ctx.lineTo(14, 8); ctx.quadraticCurveTo(12, 5, 5, 3); ctx.closePath(); ctx.fill(); ctx.stroke();
      ctx.strokeStyle = '#edaa86'; ctx.beginPath(); ctx.moveTo(13, -6); ctx.lineTo(13, 5); ctx.stroke();
      radial(ctx, 10, 0, 1, 16, '#ff8a65', 0.35);
      break;
    default: {
      const _exhaustive: never = drawer;
      void _exhaustive;
      break;
    }
  }
}

export function missileTrailColor(kind: HeroMissile['kind']): string {
  switch (kind) {
    case 'hook': return '#8be6dd';
    case 'tater': return '#efbb68';
    case 'golf': return '#ffedba';
    case 'bell': return '#ffd54f';
    case 'hose': return '#8ddfe9';
    case 'rebar': return '#b87333';
    case 'plunger': return '#edab82';
    default: {
      const _exhaustive: never = kind;
      return _exhaustive;
    }
  }
}

function drawTater(ctx: Ctx, size: number): void {
  ctx.fillStyle = '#ca8747'; ctx.strokeStyle = '#6b462b'; ctx.lineWidth = 1.2;
  ctx.beginPath(); ctx.ellipse(0, 0, size, size * 0.68, -0.2, 0, TAU); ctx.fill(); ctx.stroke();
  ctx.fillStyle = '#ffe0a0'; ctx.beginPath(); ctx.ellipse(-size * 0.16, -size * 0.24, size * 0.63, size * 0.2, -0.2, 0, TAU); ctx.fill();
  for (let i = 0; i < 3; i++) disc(ctx, (i - 1) * size * 0.5, Math.sin(i * 2.4) * size * 0.3, 0.8, '#7f552f');
}

function drawPipeWrench(ctx: Ctx, swing: number): void {
  ctx.translate(10, -8);
  ctx.fillStyle = '#90a4ae'; ctx.fillRect(-2, 0, 4, 18);
  ctx.fillStyle = '#cfd8dc'; ctx.fillRect(-6, 16, 14, 7);
  ctx.beginPath(); ctx.moveTo(7, 16); ctx.lineTo(13, 14); ctx.lineTo(13, 24); ctx.lineTo(6, 23); ctx.closePath();
  ctx.fillStyle = '#b0bec5'; ctx.fill();
  if (swing > 0) {
    glow(ctx, '#fff59d', 16);
    disc(ctx, 4, 20, 10, rgba('#fff59d', 0.35));
    noGlow(ctx);
  }
}

function drawTireIron(ctx: Ctx): void {
  ctx.strokeStyle = '#3e2723'; ctx.lineWidth = 5; ctx.lineCap = 'round';
  ctx.beginPath(); ctx.moveTo(0, 8); ctx.lineTo(0, -22); ctx.lineTo(14, -22); ctx.stroke();
  ctx.strokeStyle = '#8d6e63'; ctx.lineWidth = 2.4; ctx.stroke();
  disc(ctx, 0, 8, 3, '#5d4037');
}

function drawShockProd(ctx: Ctx, live: boolean): void {
  ctx.fillStyle = '#37474f'; ctx.fillRect(-2, -24, 4, 28);
  ctx.fillStyle = '#ff7043'; ctx.fillRect(-3, -28, 6, 6);
  if (live) radial(ctx, 0, -28, 1, 12, '#ffab91', 0.7);
  disc(ctx, 0, 6, 3.2, '#263238');
}

function drawRecipSaw(ctx: Ctx, phase: number): void {
  const kick = Math.sin(phase * TAU * 4) * 2;
  ctx.fillStyle = '#546e7a'; ctx.fillRect(-3, -6, 6, 16);
  ctx.fillStyle = '#90a4ae'; ctx.fillRect(-2 + kick, -28, 4, 24);
  ctx.strokeStyle = '#cfd8dc'; ctx.lineWidth = 1;
  for (let i = 0; i < 6; i++) {
    ctx.beginPath(); ctx.moveTo(2 + kick, -26 + i * 4); ctx.lineTo(6 + kick, -24 + i * 4); ctx.stroke();
  }
}

function drawWorkGloves(ctx: Ctx, swinging: boolean): void {
  ctx.fillStyle = '#d7ccc8'; ctx.strokeStyle = '#5d4037'; ctx.lineWidth = 1.2;
  ctx.beginPath(); ctx.ellipse(6, 0, 7, 9, 0.2, 0, TAU); ctx.fill(); ctx.stroke();
  ctx.beginPath(); ctx.ellipse(-4, 2, 6, 8, -0.2, 0, TAU); ctx.fill(); ctx.stroke();
  if (swinging) radial(ctx, 2, -2, 1, 14, '#ffe0b2', 0.35);
}

function drawSpudMasher(ctx: Ctx): void {
  ctx.fillStyle = '#6d4c41'; ctx.fillRect(-2, -8, 4, 18);
  ctx.fillStyle = '#8d6e63'; ctx.beginPath(); ctx.ellipse(0, -14, 9, 7, 0, 0, TAU); ctx.fill();
  ctx.strokeStyle = '#3e2723'; ctx.lineWidth = 1.2; ctx.stroke();
}

function drawGaff(ctx: Ctx, load: number): void {
  ctx.strokeStyle = '#563e2e'; ctx.lineWidth = 3.4;
  ctx.beginPath(); ctx.moveTo(0, 9); ctx.quadraticCurveTo(4 - load * 6, -22, 1 - load * 12, -51); ctx.stroke();
  ctx.strokeStyle = '#e9d59a'; ctx.lineWidth = 1.1; ctx.stroke();
  ctx.strokeStyle = '#71d5ce'; ctx.lineWidth = 2;
  ctx.beginPath(); ctx.moveTo(1 - load * 12, -51); ctx.quadraticCurveTo(18, -40, 10, -28); ctx.stroke();
  disc(ctx, 0, 5, 3.5, '#aabfc0');
}

function drawRingFists(ctx: Ctx, swinging: boolean): void {
  for (const [ox, oy] of [[6, 0], [-5, 2]] as const) {
    disc(ctx, ox, oy, 6.5, '#d7ccc8');
    ctx.strokeStyle = '#c9a227'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.arc(ox, oy, 4.2, 0, TAU); ctx.stroke();
  }
  if (swinging) radial(ctx, 2, 0, 1, 16, '#ffe082', 0.4);
}

function drawPressureWand(ctx: Ctx, time: number): void {
  ctx.fillStyle = '#455a64'; ctx.fillRect(-2, -4, 4, 22);
  ctx.fillStyle = '#4fc3f7'; ctx.fillRect(-3, -10, 6, 8);
  radial(ctx, 0, -10, 1, 8 + Math.sin(time * 8) * 2, '#b3e5fc', 0.55);
}

function drawPlungerHeld(ctx: Ctx): void {
  ctx.strokeStyle = '#493929'; ctx.lineWidth = 4; ctx.beginPath(); ctx.moveTo(0, 8); ctx.lineTo(0, -10); ctx.stroke();
  ctx.fillStyle = '#b54b42';
  ctx.beginPath(); ctx.moveTo(-2, -10); ctx.quadraticCurveTo(-10, -14, -12, -18); ctx.lineTo(12, -18); ctx.quadraticCurveTo(10, -14, 2, -10); ctx.closePath(); ctx.fill();
}

function drawHandCannon(ctx: Ctx, time: number): void {
  ctx.fillStyle = '#37474f'; ctx.fillRect(-4, -6, 18, 8);
  ctx.fillStyle = '#263238'; ctx.fillRect(12, -4, 8, 4);
  if (Math.sin(time * 6) > 0.7) radial(ctx, 20, -2, 1, 10, '#ff8a65', 0.5);
}

function drawGolfIron(ctx: Ctx): void {
  ctx.strokeStyle = '#90a4ae'; ctx.lineWidth = 2.4; ctx.beginPath(); ctx.moveTo(0, 10); ctx.lineTo(0, -20); ctx.stroke();
  ctx.fillStyle = '#cfd8dc'; ctx.beginPath(); ctx.ellipse(4, -22, 7, 3.5, 0.4, 0, TAU); ctx.fill();
}

function drawRebarBundle(ctx: Ctx): void {
  for (let i = 0; i < 3; i++) {
    ctx.strokeStyle = i === 1 ? '#b87333' : '#8b4513'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(-2 + i * 2, 8); ctx.lineTo(6 + i * 2, -22); ctx.stroke();
  }
}

function drawTaterCannon(ctx: Ctx): void {
  ctx.fillStyle = '#5d4037'; ctx.fillRect(-4, -8, 20, 10);
  ctx.fillStyle = '#795548'; ctx.beginPath(); ctx.ellipse(16, -3, 5, 4, 0, 0, TAU); ctx.fill();
  drawTater(ctx, 3);
}

function drawCastingRig(ctx: Ctx): void {
  ctx.strokeStyle = '#455a64'; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(0, 6); ctx.lineTo(0, -18); ctx.stroke();
  ctx.strokeStyle = '#71d5ce'; ctx.lineWidth = 1.2;
  ctx.beginPath(); ctx.moveTo(0, -18); ctx.quadraticCurveTo(16, -8, 10, 4); ctx.stroke();
  disc(ctx, 0, -18, 3, '#90a4ae');
}

function drawBellPlateHeld(ctx: Ctx, time: number): void {
  const wobble = Math.sin(time * 5) * 0.08;
  ctx.rotate(wobble);
  glow(ctx, '#ffd54f', 10);
  disc(ctx, 0, -8, 9, '#ffd54f');
  ctx.strokeStyle = '#b8860b'; ctx.lineWidth = 1.4; ctx.beginPath(); ctx.arc(0, -8, 5.5, 0, TAU); ctx.stroke();
  disc(ctx, 0, -6, 2, '#8d6e22');
  noGlow(ctx);
}
