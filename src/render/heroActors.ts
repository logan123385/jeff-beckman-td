import { HEROES } from '../data/heroes';
import type { Game } from '../sim/game';
import type { Hero, HeroSummon } from '../sim/state';
import { heroFrame } from './art';
import { castShadow, disc, radial, rgba, stampText } from './ink';

type Ctx = CanvasRenderingContext2D;
const TAU = Math.PI * 2;
function bar(ctx: Ctx, x: number, y: number, width: number, ratio: number, color: string): void {
  ctx.fillStyle = '#192d27'; ctx.beginPath(); ctx.roundRect(x - width / 2 - 1, y - 1, width + 2, 6, 2); ctx.fill();
  ctx.fillStyle = color; ctx.fillRect(x - width / 2, y, width * Math.max(0, Math.min(1, ratio)), 3);
}

export function drawNewHero(ctx: Ctx, h: Hero, time: number, showBar = true): boolean {
  const id = h.id; if (!id || id === 'jeff') return false;
  const def = HEROES[id], size = id === 'mike' ? 88 : id === 'becbec' ? 82 : 74;
  castShadow(ctx, h.pos.x, h.pos.y + 13, id === 'mike' ? 38 : id === 'becbec' ? 26 : 18, 6, .32);
  ctx.save(); ctx.translate(h.pos.x, h.pos.y + 18); ctx.scale(h.facing, 1);
  if (h.downed > 0) { ctx.globalAlpha = .4; ctx.rotate(-1.1); }
  const walk = (h.walkPhase ?? 0) / TAU;
  let row = 0, phase = 0, loop = false;
  if (h.cast) {
    phase = 1 - h.cast.left / h.cast.duration;
    row = id === 'mike' ? (h.cast.slot === 0 || h.cast.slot === 4 ? 1 : 2) : id === 'chris' ? (h.cast.slot === 1 ? 2 : 1) : id === 'becbec' ? (h.cast.slot === 1 ? 2 : 1) : 2;
    if (id === 'chris' && h.cast.slot === 2) phase = Math.min(.999, phase * 3 % 1);
    if (id === 'becbec' && h.cast.slot === 4) phase = Math.min(.999, phase * 5 % 1);
  } else if (h.swing > 0) {
    row = 1; phase = 1 - h.swing / (h.swingDuration ?? def.swingTime);
  } else if (h.moving || (h.moveBlend ?? 0) > .05) {
    row = 0; phase = walk; loop = true;
    const bounce = Math.sin(walk * TAU * 2) * (id === 'mike' ? .8 : .5);
    ctx.translate(0, bounce * (h.moveBlend ?? 1));
    if (id === 'mike') ctx.rotate(Math.sin(walk * TAU) * .015);
  } else {
    row = id === 'mike' ? 0 : 1;
    const breath = Math.sin(time * 2.5) * .009;
    ctx.scale(1 - breath * .2, 1 + breath);
  }
  const painted = heroFrame(ctx, id, row, phase, size, loop);
  if (!painted) { ctx.fillStyle = def.color; ctx.beginPath(); ctx.roundRect(-15, -45, 30, 40, 6); ctx.fill(); disc(ctx, 0, -50, 11, '#d6a27c'); }
  // Motion trails are attached to the real cast/attack phase, never a looping idle flash.
  if (h.cast && ['bob', 'becbec'].includes(id)) {
    const phase = 1 - h.cast.left / h.cast.duration;
    if (phase < .48) radial(ctx, 18, -size * .45, 1, 7 + phase * 20, def.color, phase * .8);
  }
  ctx.restore();
  if (h.moving && id === 'mike') for (let i = 0; i < 3; i++) {
    const age = (time * 3 + i / 3) % 1;
    ctx.save(); ctx.globalAlpha = (1 - age) * .18; disc(ctx, h.pos.x - h.facing * (25 + age * 25), h.pos.y + 9 - age * 10, 3 + age * 5, '#c1b495'); ctx.restore();
  }
  if (showBar) {
    bar(ctx, h.pos.x, h.pos.y - size + 14, 38, h.hp / h.maxHp, def.color);
    stampText(ctx, h.downed > 0 ? `${Math.ceil(h.downed)}s` : def.name.toUpperCase(), h.pos.x, h.pos.y + 29, { size: 8, color: '#fff2d3' });
  }
  return true;
}

export function drawLogan(ctx: Ctx, s: HeroSummon, time: number): void {
  const fade = Math.min(1, s.left * 2, (s.duration - s.left) * 4 + .1);
  castShadow(ctx, s.pos.x, s.pos.y + 8, 12, 4, fade * .25);
  ctx.save(); ctx.globalAlpha = fade; ctx.translate(s.pos.x, s.pos.y + 11); ctx.scale(s.facing, 1);
  const arriving = s.duration - s.left < .5;
  let painted = false;
  if (arriving) painted = heroFrame(ctx, 'logan', 2, (s.duration - s.left) / .5, 42);
  else if (s.swing > 0) painted = heroFrame(ctx, 'logan', 1, 1 - s.swing / .46, 42);
  else if (s.moving) { ctx.translate(0, -Math.abs(Math.sin(s.walkPhase)) * 1.5); painted = heroFrame(ctx, 'logan', 0, s.walkPhase / TAU, 42, true); }
  else { ctx.scale(1, 1 + Math.sin(time * 5) * .014); painted = heroFrame(ctx, 'logan', 1, 0, 42); }
  if (!painted) { ctx.fillStyle = '#b8df87'; ctx.beginPath(); ctx.roundRect(-8, -26, 16, 22, 4); ctx.fill(); disc(ctx, 0, -30, 6, '#d6a27c'); }
  ctx.restore();
  bar(ctx, s.pos.x, s.pos.y - 34, 24, s.hp / s.maxHp, '#b8df87');
  ctx.fillStyle = '#e9cf90'; ctx.fillRect(s.pos.x - 12, s.pos.y - 27, 24 * s.left / s.duration, 2);
  stampText(ctx, 'LOGAN', s.pos.x, s.pos.y + 17, { size: 7, color: '#e8edbb' });
}

export function drawHeroAura(ctx: Ctx, game: Game, selected: boolean): void {
  if (!game.heroEnabled || game.hero.downed > 0) return;
  const h = game.hero, def = game.heroDef, r = def.aura.radius, time = game.time;
  ctx.save(); ctx.translate(h.pos.x, h.pos.y);
  const glow = ctx.createRadialGradient(0, 0, r * .1, 0, 0, r);
  glow.addColorStop(0, rgba(def.color, .035)); glow.addColorStop(.8, rgba(def.color, .015)); glow.addColorStop(1, rgba(def.color, 0));
  ctx.fillStyle = glow; ctx.beginPath(); ctx.arc(0, 0, r, 0, TAU); ctx.fill();
  ctx.strokeStyle = rgba(def.color, selected ? .44 : .16); ctx.lineWidth = 1;
  ctx.setLineDash([3, 8]); ctx.lineDashOffset = -time * 7; ctx.beginPath(); ctx.arc(0, 0, r, 0, TAU); ctx.stroke(); ctx.setLineDash([]);
  ctx.strokeStyle = rgba(def.color, .6); ctx.lineWidth = 1.5;
  const inner = def.id === 'mike' ? 42 : 29;
  ctx.beginPath(); ctx.ellipse(0, 12, inner, inner * .36, 0, 0, TAU); ctx.stroke();
  for (let i = 0; i < 3; i++) {
    const a = time * .5 + i * TAU / 3;
    disc(ctx, Math.cos(a) * inner, 12 + Math.sin(a) * inner * .36, 1.8, def.color);
  }
  if (def.id === 'chris') {
    for (let i = 0; i < 5; i++) {
      const p = (time * .45 + i * .2) % 1;
      ctx.globalAlpha = Math.sin(p * Math.PI) * .12;
      disc(ctx, Math.sin(i * 2.3 + p) * 35, 8 - p * 23, 6 + p * 8, '#b1c16b');
    }
    ctx.globalAlpha = 1;
  }
  if ((h.shield ?? 0) > 0) {
    ctx.fillStyle = rgba(def.color, .1); ctx.strokeStyle = rgba(def.color, .6); ctx.lineWidth = 2;
    ctx.beginPath(); for (let i = 0; i <= 6; i++) { const a = i * TAU / 6 - Math.PI / 2; const x = Math.cos(a) * 31, y = Math.sin(a) * 37 - 16; if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y); } ctx.fill(); ctx.stroke();
  }
  if (selected) stampText(ctx, def.aura.name, 0, r + 13, { size: 9, color: def.color });
  ctx.restore();
}

export function drawHeroZones(ctx: Ctx, game: Game): void {
  for (const z of game.heroZones) {
    const color = z.kind === 'gas' ? '#a5bb64' : z.kind === 'rain' ? '#e0bd8a' : z.kind === 'review' ? '#f39882' : '#e9d69f';
    ctx.save(); ctx.globalAlpha = Math.min(1, z.left * 2); ctx.strokeStyle = rgba(color, .5); ctx.lineWidth = 1.5;
    if (z.kind === 'review') {
      for (const e of game.enemies) if (z.targetIds?.includes(e.id)) {
        ctx.save(); ctx.translate(e.pos.x, e.pos.y - 22); ctx.rotate(game.time * .8); ctx.setLineDash([5, 5]);
        ctx.beginPath(); ctx.arc(0, 0, e.def.radius + 8, 0, TAU); ctx.stroke(); ctx.restore();
      }
    } else {
      const born = Math.min(1, (z.duration - z.left) * 3);
      ctx.fillStyle = rgba(color, z.kind === 'gas' ? .08 : .04); ctx.setLineDash([6, 8]); ctx.lineDashOffset = -game.time * 12;
      ctx.beginPath(); ctx.arc(z.pos.x, z.pos.y, z.radius * (.85 + born * .15), 0, TAU); ctx.fill(); ctx.stroke(); ctx.setLineDash([]);
      if (z.kind === 'gas') for (let i = 0; i < 12; i++) {
        const phase = (game.time * .5 + i * .083) % 1, a = i * 2.4;
        ctx.globalAlpha = Math.sin(phase * Math.PI) * .11 * Math.min(1, z.left);
        disc(ctx, z.pos.x + Math.cos(a) * z.radius * .65, z.pos.y + Math.sin(a) * z.radius * .5 - phase * 20, 15 + phase * 15, color);
      }
      if (z.kind === 'supply') {
        ctx.fillStyle = '#937b4e'; ctx.strokeStyle = '#eed99d'; ctx.lineWidth = 2;
        const y = z.pos.y + 12 - Math.sin(born * Math.PI) * 24;
        ctx.beginPath(); ctx.roundRect(z.pos.x - 13, y - 22, 26, 22, 3); ctx.fill(); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(z.pos.x, y - 17); ctx.lineTo(z.pos.x, y - 5); ctx.moveTo(z.pos.x - 6, y - 11); ctx.lineTo(z.pos.x + 6, y - 11); ctx.stroke();
      }
      if (z.kind === 'rain') stampText(ctx, 'ROYAL RAIN', z.pos.x, z.pos.y - z.radius - 6, { size: 10, color });
    }
    ctx.restore();
  }
}

export function drawHeroMissiles(ctx: Ctx, game: Game): void {
  for (const p of game.heroMissiles) {
    const phase = Math.min(1, p.age / p.duration), arc = Math.sin(phase * Math.PI) * (p.kind === 'golf' ? 17 : 26);
    const x = p.pos.x, y = p.pos.y - arc;
    const angle = Math.atan2(p.goal.y - p.from.y - Math.cos(phase * Math.PI) * 70, p.goal.x - p.from.x);
    ctx.save();
    ctx.strokeStyle = p.kind === 'golf' ? '#fff9db80' : '#e0b67a66'; ctx.lineWidth = p.kind === 'golf' ? 2 : 1.3;
    ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x - Math.cos(angle) * 23, y - Math.sin(angle) * 23); ctx.stroke();
    ctx.translate(x, y); ctx.rotate(angle);
    if (p.kind === 'golf') { disc(ctx, 0, 0, 3.8, '#fff9e8'); disc(ctx, -1, 1, .8, '#a7b7b7'); }
    else {
      ctx.strokeStyle = '#493929'; ctx.lineWidth = 5; ctx.beginPath(); ctx.moveTo(-16, 0); ctx.lineTo(6, 0); ctx.stroke();
      ctx.strokeStyle = '#d1aa69'; ctx.lineWidth = 2.5; ctx.stroke();
      ctx.fillStyle = '#b54b42'; ctx.strokeStyle = '#512e28'; ctx.lineWidth = 1.3;
      ctx.beginPath(); ctx.moveTo(5, -3); ctx.quadraticCurveTo(12, -5, 14, -8); ctx.lineTo(14, 8); ctx.quadraticCurveTo(12, 5, 5, 3); ctx.closePath(); ctx.fill(); ctx.stroke();
      ctx.strokeStyle = '#edaa86'; ctx.beginPath(); ctx.moveTo(13, -6); ctx.lineTo(13, 5); ctx.stroke();
    }
    ctx.restore();
  }
}

export function drawHeroVisuals(ctx: Ctx, game: Game): void {
  for (const fx of game.heroVisuals) {
    const k = Math.max(0, fx.left / fx.duration), phase = 1 - k;
    ctx.save(); ctx.globalAlpha = Math.min(1, k * 2); ctx.strokeStyle = fx.color; ctx.lineCap = 'round';
    if (fx.kind === 'laser') {
      ctx.globalCompositeOperation = 'lighter';
      for (const [width, alpha] of [[fx.radius * 2.2, .15], [fx.radius, .7], [Math.max(1.2, fx.radius * .23), 1]]) {
        ctx.globalAlpha = k * alpha!; ctx.lineWidth = width! * (.7 + k * .3); ctx.strokeStyle = width! < fx.radius ? '#fff6e3' : fx.color;
        ctx.beginPath(); ctx.moveTo(fx.from.x, fx.from.y); ctx.lineTo(fx.to.x, fx.to.y); ctx.stroke();
      }
      radial(ctx, fx.to.x, fx.to.y, 2, fx.radius + 10, fx.color, k * .6);
    } else if (fx.kind === 'saw' || fx.kind === 'golf' || fx.kind === 'punch') {
      const side = fx.to.x >= fx.from.x ? 1 : -1;
      ctx.translate(fx.from.x + side * 12, fx.from.y - 16); ctx.scale(side, 1);
      ctx.lineWidth = fx.kind === 'punch' ? 5 * k : 3 * k;
      ctx.beginPath(); ctx.arc(0, 0, fx.radius * (.65 + phase * .2), -1.2 + phase * .6, .8 + phase * .6); ctx.stroke();
      for (let i = 0; i < 4; i++) { const a = -.7 + i * .45; ctx.lineWidth = 1.4; ctx.beginPath(); ctx.moveTo(Math.cos(a) * 22, Math.sin(a) * 22); ctx.lineTo(Math.cos(a) * (24 + phase * 18), Math.sin(a) * (24 + phase * 18)); ctx.stroke(); }
    } else {
      for (let i = 0; i < 3; i++) {
        const r = Math.max(1, fx.radius * Math.min(1, phase * 1.5 + i * .13));
        ctx.lineWidth = (fx.kind === 'slam' ? 5 : 3) * k; ctx.globalAlpha = k * (.65 - i * .15);
        ctx.beginPath(); ctx.ellipse(fx.from.x, fx.from.y + 4, r, r * (fx.kind === 'buff' || fx.kind === 'summon' ? .42 : .7), 0, 0, TAU); ctx.stroke();
      }
      if (fx.kind === 'slam') for (let i = 0; i < 9; i++) {
        const a = i * 2.4, r = fx.radius * phase;
        ctx.fillStyle = '#a1937a'; ctx.globalAlpha = k;
        ctx.fillRect(fx.from.x + Math.cos(a) * r, fx.from.y + Math.sin(a) * r * .6 - Math.sin(phase * Math.PI) * 20, 4, 3);
      }
    }
    ctx.restore();
  }
}

export function drawHeroNotice(ctx: Ctx, game: Game): void {
  const notice = game.heroNotice; if (!notice) return;
  ctx.save(); ctx.globalAlpha = Math.min(1, notice.left * 3);
  ctx.fillStyle = '#173528ec'; ctx.strokeStyle = notice.color; ctx.lineWidth = 1;
  ctx.beginPath(); ctx.roundRect(310, 552, 340, 30, 7); ctx.fill(); ctx.stroke();
  stampText(ctx, notice.name.toUpperCase(), 480, 565, { size: 11, color: notice.color });
  stampText(ctx, notice.detail, 480, 577, { size: 8, color: '#e6ead3' });
  ctx.restore();
}
