import type { Enemy, Hero, Tower } from '../sim/state';

type Ctx = CanvasRenderingContext2D;

function roundRect(ctx: Ctx, x: number, y: number, w: number, h: number, r: number): void {
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, r);
}

function hpBar(ctx: Ctx, x: number, y: number, w: number, frac: number, color: string): void {
  ctx.fillStyle = 'rgba(0,0,0,0.55)';
  ctx.fillRect(x - w / 2, y, w, 4);
  ctx.fillStyle = color;
  ctx.fillRect(x - w / 2, y, w * Math.max(0, Math.min(1, frac)), 4);
}

// ------------------------------------------------------------------ Jeff

export function drawJeff(ctx: Ctx, hero: Hero, time: number, showBar = true): void {
  const { x, y } = hero.pos;
  ctx.save();
  ctx.translate(x, y);

  if (hero.downed > 0) {
    ctx.globalAlpha = 0.55;
    ctx.rotate(Math.PI / 2);
    drawJeffBody(ctx, 1, 0, 0);
    ctx.restore();
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 12px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(`${Math.ceil(hero.downed)}s`, x, y - 30);
    return;
  }

  const bob = hero.dest ? Math.sin(time * 14) * 1.5 : Math.sin(time * 2) * 0.6;
  drawJeffBody(ctx, hero.facing, bob, hero.swing);
  ctx.restore();

  if (showBar) hpBar(ctx, x, y - 44, 34, hero.hp / hero.maxHp, '#66bb6a');
}

function drawJeffBody(ctx: Ctx, facing: number, bob: number, swing: number): void {
  ctx.save();
  ctx.scale(facing, 1);
  ctx.translate(0, bob);

  // shadow
  ctx.fillStyle = 'rgba(0,0,0,0.35)';
  ctx.beginPath();
  ctx.ellipse(0, 20, 12, 5, 0, 0, Math.PI * 2);
  ctx.fill();

  // legs (jeans)
  ctx.fillStyle = '#3b5170';
  ctx.fillRect(-7, 4, 6, 16);
  ctx.fillRect(1, 4, 6, 16);
  // boots
  ctx.fillStyle = '#4e342e';
  ctx.fillRect(-8, 17, 7, 4);
  ctx.fillRect(1, 17, 7, 4);

  // torso (work shirt)
  ctx.fillStyle = '#5c6bc0';
  roundRect(ctx, -9, -16, 18, 22, 3);
  ctx.fill();
  // suspenders
  ctx.strokeStyle = '#8d6e63';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(-5, -16);
  ctx.lineTo(-4, 6);
  ctx.moveTo(5, -16);
  ctx.lineTo(4, 6);
  ctx.stroke();
  // tool belt
  ctx.fillStyle = '#795548';
  ctx.fillRect(-10, 3, 20, 4);
  ctx.fillStyle = '#c0ca33';
  ctx.fillRect(-2, 2, 4, 6);
  ctx.fillStyle = '#9e9e9e';
  ctx.fillRect(5, 2, 3, 7);

  // arm + wrench
  const swingAngle = swing > 0 ? -1.4 + (0.2 - swing) * 7 : 0.3;
  ctx.save();
  ctx.translate(8, -12);
  ctx.rotate(swingAngle);
  ctx.fillStyle = '#5c6bc0';
  ctx.fillRect(-2, 0, 4, 12);
  ctx.fillStyle = '#e0c9a6';
  ctx.fillRect(-2, 11, 4, 3);
  // wrench
  ctx.fillStyle = '#b0bec5';
  ctx.fillRect(-1.5, 13, 3, 12);
  ctx.beginPath();
  ctx.arc(0, 26, 4, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#5c6bc0';
  ctx.fillRect(-1, 24, 2, 3);
  ctx.restore();

  // head
  ctx.fillStyle = '#e0c9a6';
  ctx.beginPath();
  ctx.arc(0, -24, 8, 0, Math.PI * 2);
  ctx.fill();
  // hair
  ctx.fillStyle = '#4e342e';
  ctx.beginPath();
  ctx.arc(0, -26, 8, Math.PI, Math.PI * 2);
  ctx.fill();
  // full beard
  ctx.fillStyle = '#5d4037';
  ctx.beginPath();
  ctx.moveTo(-8, -24);
  ctx.quadraticCurveTo(-8, -10, 0, -9);
  ctx.quadraticCurveTo(8, -10, 8, -24);
  ctx.quadraticCurveTo(4, -20, 0, -20);
  ctx.quadraticCurveTo(-4, -20, -8, -24);
  ctx.fill();
  // ear gauges
  ctx.fillStyle = '#212121';
  ctx.beginPath();
  ctx.arc(-8, -23, 2.6, 0, Math.PI * 2);
  ctx.arc(8, -23, 2.6, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#26c6da';
  ctx.beginPath();
  ctx.arc(-8, -23, 1.3, 0, Math.PI * 2);
  ctx.arc(8, -23, 1.3, 0, Math.PI * 2);
  ctx.fill();
  // eyes
  ctx.fillStyle = '#212121';
  ctx.fillRect(2, -26, 2, 2);
  ctx.fillRect(-4, -26, 2, 2);

  ctx.restore();
}

// ------------------------------------------------------------------ towers

export function drawTowerBase(ctx: Ctx, x: number, y: number, color: string): void {
  ctx.fillStyle = 'rgba(0,0,0,0.35)';
  ctx.beginPath();
  ctx.ellipse(x, y + 12, 18, 7, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#37474f';
  roundRect(ctx, x - 17, y - 6, 34, 20, 5);
  ctx.fill();
  ctx.strokeStyle = color;
  ctx.lineWidth = 2;
  ctx.stroke();
}

export function drawTower(ctx: Ctx, t: Tower, time: number): void {
  const { x, y } = t.pos;
  const kick = t.recoil > 0 ? t.recoil * 20 : 0;
  ctx.save();
  if (t.frozen > 0) ctx.filter = 'saturate(0.2) brightness(1.3)';
  drawTowerBase(ctx, x, y, t.def.color);

  switch (t.def.id) {
    case 'torch': {
      // gas cylinder + angled nozzle
      ctx.fillStyle = '#546e7a';
      roundRect(ctx, x - 7, y - 22, 14, 22, 4);
      ctx.fill();
      ctx.save();
      ctx.translate(x, y - 14);
      ctx.rotate(t.facing);
      ctx.fillStyle = '#b0bec5';
      ctx.fillRect(4 - kick, -3, 18, 6);
      ctx.fillStyle = t.def.color;
      ctx.beginPath();
      ctx.moveTo(22 - kick, -2);
      ctx.lineTo(30 - kick + Math.sin(time * 40) * 2, 0);
      ctx.lineTo(22 - kick, 2);
      ctx.fill();
      ctx.restore();
      break;
    }
    case 'washer': {
      ctx.fillStyle = '#ffca28';
      roundRect(ctx, x - 12, y - 18, 24, 18, 4);
      ctx.fill();
      ctx.fillStyle = '#212121';
      ctx.fillRect(x - 9, y - 14, 18, 4);
      ctx.save();
      ctx.translate(x, y - 10);
      ctx.rotate(t.facing);
      ctx.strokeStyle = '#263238';
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.moveTo(6, 0);
      ctx.lineTo(24 - kick, 0);
      ctx.stroke();
      ctx.fillStyle = t.def.color;
      ctx.fillRect(22 - kick, -3, 5, 6);
      ctx.restore();
      break;
    }
    case 'barricade': {
      // valve body on the base; the gate itself is drawn at the rally point
      ctx.fillStyle = '#78909c';
      roundRect(ctx, x - 10, y - 14, 20, 14, 3);
      ctx.fill();
      ctx.strokeStyle = t.def.color;
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(x, y - 18, 8, 0, Math.PI * 2);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(x - 8, y - 18);
      ctx.lineTo(x + 8, y - 18);
      ctx.moveTo(x, y - 26);
      ctx.lineTo(x, y - 10);
      ctx.stroke();
      break;
    }
    case 'vent': {
      // tall stack with spinning vent cap
      ctx.fillStyle = '#90a4ae';
      ctx.fillRect(x - 6, y - 34, 12, 34);
      ctx.fillStyle = '#607d8b';
      ctx.fillRect(x - 9, y - 36, 18, 5);
      ctx.save();
      ctx.translate(x, y - 40);
      ctx.rotate(time * 6);
      ctx.strokeStyle = '#cfd8dc';
      ctx.lineWidth = 2;
      for (let i = 0; i < 4; i++) {
        ctx.rotate(Math.PI / 2);
        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.lineTo(8, 0);
        ctx.stroke();
      }
      ctx.restore();
      break;
    }
    case 'radiant': {
      ctx.strokeStyle = t.def.color;
      ctx.lineWidth = 3;
      ctx.beginPath();
      for (let i = 0; i < 4; i++) {
        const yy = y - 4 - i * 5;
        ctx.moveTo(x - 12, yy);
        ctx.lineTo(x + 12, yy);
      }
      ctx.stroke();
      ctx.strokeStyle = '#ffab91';
      ctx.lineWidth = 1.5;
      ctx.globalAlpha = 0.6 + Math.sin(time * 4) * 0.3;
      ctx.beginPath();
      ctx.moveTo(x + 12, y - 4);
      ctx.lineTo(x + 12, y - 19);
      ctx.moveTo(x - 12, y - 9);
      ctx.lineTo(x - 12, y - 14);
      ctx.stroke();
      ctx.globalAlpha = 1;
      break;
    }
    case 'expansion': {
      ctx.fillStyle = '#607d8b';
      ctx.fillRect(x - 3, y - 10, 6, 10);
      ctx.fillStyle = '#e53935';
      ctx.beginPath();
      ctx.ellipse(x, y - 22, 12, 13, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#ef9a9a';
      ctx.beginPath();
      ctx.ellipse(x - 4, y - 27, 4, 5, -0.5, 0, Math.PI * 2);
      ctx.fill();
      if (t.shieldCooldown <= 0) {
        ctx.strokeStyle = t.def.color;
        ctx.lineWidth = 1.5;
        ctx.globalAlpha = 0.6 + Math.sin(time * 3) * 0.3;
        ctx.beginPath();
        ctx.arc(x, y - 22, 17, 0, Math.PI * 2);
        ctx.stroke();
        ctx.globalAlpha = 1;
      }
      break;
    }
    default: {
      const _exhaustive: never = t.def.id;
      return _exhaustive;
    }
  }

  // level pips
  for (let i = 0; i <= t.level; i++) {
    ctx.fillStyle = '#ffe082';
    ctx.beginPath();
    ctx.arc(x - 6 + i * 6, y + 10, 2, 0, Math.PI * 2);
    ctx.fill();
  }

  if (t.frozen > 0) {
    ctx.filter = 'none';
    ctx.fillStyle = 'rgba(129,212,250,0.45)';
    roundRect(ctx, x - 18, y - 40, 36, 56, 6);
    ctx.fill();
  }
  ctx.restore();
}

/** Barricade gate at the rally point, with its durability bar. */
export function drawValveGate(ctx: Ctx, t: Tower): void {
  const { x, y } = t.rally;
  ctx.save();
  ctx.setLineDash([3, 4]);
  ctx.strokeStyle = 'rgba(231,76,60,0.5)';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(t.pos.x, t.pos.y);
  ctx.lineTo(x, y);
  ctx.stroke();
  ctx.setLineDash([]);

  const broken = t.rebuild > 0;
  ctx.globalAlpha = broken ? 0.35 : 1;
  ctx.fillStyle = '#b71c1c';
  ctx.beginPath();
  ctx.arc(x, y, 12, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = '#ef9a9a';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.arc(x, y, 8, 0, Math.PI * 2);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(x - 10, y);
  ctx.lineTo(x + 10, y);
  ctx.moveTo(x, y - 10);
  ctx.lineTo(x, y + 10);
  ctx.stroke();
  ctx.globalAlpha = 1;
  hpBar(ctx, x, y - 20, 28, t.hp / t.maxHp, broken ? '#9e9e9e' : '#ef5350');
  ctx.restore();
}

// ------------------------------------------------------------------ enemies

export function drawEnemy(ctx: Ctx, e: Enemy, time: number): void {
  const { x, y } = e.pos;
  const r = e.def.radius;
  ctx.save();
  if (e.phased) ctx.globalAlpha = 0.3;
  const lift = e.def.flying ? 14 + Math.sin(time * 4 + e.wobble) * 3 : 0;

  // shadow
  ctx.fillStyle = 'rgba(0,0,0,0.35)';
  ctx.beginPath();
  ctx.ellipse(x, y + r * 0.6, r * 0.9, r * 0.4, 0, 0, Math.PI * 2);
  ctx.fill();

  ctx.translate(x, y - lift);
  switch (e.def.id) {
    case 'drip': {
      ctx.fillStyle = e.def.color;
      ctx.beginPath();
      ctx.moveTo(0, -r * 1.4);
      ctx.quadraticCurveTo(r, -r * 0.2, 0, r);
      ctx.quadraticCurveTo(-r, -r * 0.2, 0, -r * 1.4);
      ctx.fill();
      ctx.fillStyle = '#fff';
      ctx.beginPath();
      ctx.arc(-2, -1, 1.5, 0, Math.PI * 2);
      ctx.arc(2, -1, 1.5, 0, Math.PI * 2);
      ctx.fill();
      break;
    }
    case 'sludge': {
      const squish = Math.sin(e.wobble) * 0.1;
      ctx.fillStyle = e.def.color;
      ctx.beginPath();
      ctx.ellipse(0, 2, r * (1 + squish), r * (0.75 - squish), 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#5a4b28';
      ctx.beginPath();
      ctx.arc(-4, -2, 3, 0, Math.PI * 2);
      ctx.arc(5, 1, 2, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#fff';
      ctx.beginPath();
      ctx.arc(-3, -6, 2, 0, Math.PI * 2);
      ctx.arc(3, -6, 2, 0, Math.PI * 2);
      ctx.fill();
      break;
    }
    case 'scaleCrab': {
      ctx.strokeStyle = '#8d7b57';
      ctx.lineWidth = 2;
      for (let i = -1; i <= 1; i++) {
        const leg = Math.sin(e.wobble + i) * 3;
        ctx.beginPath();
        ctx.moveTo(-r, i * 4);
        ctx.lineTo(-r - 6, i * 4 + leg);
        ctx.moveTo(r, i * 4);
        ctx.lineTo(r + 6, i * 4 - leg);
        ctx.stroke();
      }
      ctx.fillStyle = e.def.color;
      ctx.beginPath();
      ctx.moveTo(0, -r);
      for (let i = 1; i <= 6; i++) {
        const a = (i / 6) * Math.PI * 2 - Math.PI / 2;
        ctx.lineTo(Math.cos(a) * r, Math.sin(a) * r);
      }
      ctx.fill();
      ctx.strokeStyle = '#7a6a45';
      ctx.lineWidth = 1.5;
      ctx.stroke();
      ctx.fillStyle = '#212121';
      ctx.fillRect(-4, -3, 2, 2);
      ctx.fillRect(2, -3, 2, 2);
      break;
    }
    case 'steamWisp': {
      ctx.fillStyle = 'rgba(224,247,250,0.85)';
      for (let i = 0; i < 3; i++) {
        const a = time * 3 + i * 2.1;
        ctx.beginPath();
        ctx.arc(Math.cos(a) * 4, Math.sin(a) * 3, r * 0.75, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.fillStyle = '#546e7a';
      ctx.fillRect(-4, -2, 2, 2);
      ctx.fillRect(2, -2, 2, 2);
      break;
    }
    case 'pressureSpike': {
      ctx.fillStyle = e.def.color;
      ctx.beginPath();
      ctx.moveTo(r * 1.5, 0);
      ctx.lineTo(-r * 0.6, -r);
      ctx.lineTo(-r * 1.1, 0);
      ctx.lineTo(-r * 0.6, r);
      ctx.closePath();
      ctx.fill();
      ctx.strokeStyle = '#fce4ec';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(-r * 1.6, -3);
      ctx.lineTo(-r * 2.4, -3);
      ctx.moveTo(-r * 1.6, 3);
      ctx.lineTo(-r * 2.4, 3);
      ctx.stroke();
      break;
    }
    case 'airlock': {
      ctx.strokeStyle = e.def.color;
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.arc(0, 0, r, 0, Math.PI * 2);
      ctx.stroke();
      ctx.fillStyle = 'rgba(206,147,216,0.35)';
      ctx.fill();
      ctx.fillStyle = '#fff';
      ctx.beginPath();
      ctx.arc(-3, -3, 2.5, 0, Math.PI * 2);
      ctx.fill();
      break;
    }
    case 'frozenMain': {
      ctx.fillStyle = e.def.color;
      ctx.beginPath();
      ctx.moveTo(-r, -r * 0.5);
      ctx.lineTo(-r * 0.3, -r);
      ctx.lineTo(r * 0.7, -r * 0.8);
      ctx.lineTo(r, r * 0.2);
      ctx.lineTo(r * 0.4, r);
      ctx.lineTo(-r * 0.7, r * 0.7);
      ctx.closePath();
      ctx.fill();
      ctx.strokeStyle = '#e1f5fe';
      ctx.lineWidth = 1.5;
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(-r * 0.5, -r * 0.3);
      ctx.lineTo(r * 0.2, r * 0.4);
      ctx.stroke();
      ctx.fillStyle = '#01579b';
      ctx.fillRect(-4, -2, 2, 2);
      ctx.fillRect(2, -2, 2, 2);
      break;
    }
    case 'rogueBoiler': {
      ctx.fillStyle = e.def.color;
      roundRect(ctx, -r, -r * 1.2, r * 2, r * 2.2, 8);
      ctx.fill();
      ctx.fillStyle = '#5d4037';
      ctx.fillRect(-r * 0.6, -r * 1.7, r * 0.5, r * 0.6);
      ctx.fillStyle = '#ff7043';
      ctx.beginPath();
      ctx.arc(0, 0, r * 0.45, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#ffe082';
      ctx.beginPath();
      ctx.arc(0, 0, r * 0.2 + Math.sin(time * 10) * 1.5, 0, Math.PI * 2);
      ctx.fill();
      // gauge
      ctx.fillStyle = '#eceff1';
      ctx.beginPath();
      ctx.arc(r * 0.55, -r * 0.7, 5, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#e53935';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(r * 0.55, -r * 0.7);
      ctx.lineTo(r * 0.55 + Math.cos(-1 + e.bossPhase) * 4, -r * 0.7 + Math.sin(-1 + e.bossPhase) * 4);
      ctx.stroke();
      // angry eyes
      ctx.fillStyle = '#212121';
      ctx.fillRect(-8, -10, 4, 3);
      ctx.fillRect(4, -10, 4, 3);
      break;
    }
    default: {
      const _exhaustive: never = e.def.id;
      return _exhaustive;
    }
  }
  ctx.restore();

  if (e.stun > 0) {
    ctx.fillStyle = '#fff59d';
    ctx.font = '11px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('✶ ✶', x, y - lift - r - 10);
  }
  if (e.hp < e.maxHp) {
    hpBar(ctx, x, y - lift - r - 8, Math.max(16, r * 2.2), e.hp / e.maxHp, e.def.traits.includes('boss') ? '#ff7043' : '#ef5350');
  }
}

export const JEFF_SELECT_RADIUS = 26;
