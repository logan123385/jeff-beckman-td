import { HEROES } from '../data/heroes';
import type { Game } from '../sim/game';
import type { Hero, HeroSummon } from '../sim/state';
import { heroFrame } from './art';
import { attackPose, humanoid } from './animation';
import { pointLight } from './spectacle';
import { shockwave, starBurst } from './fx';
import { castShadow, disc, glow, noGlow, radial, rgba, stampText } from './ink';

type Ctx = CanvasRenderingContext2D;
const TAU = Math.PI * 2;
function bar(ctx: Ctx, x: number, y: number, width: number, ratio: number, color: string): void {
  ctx.fillStyle = '#192d27'; ctx.beginPath(); ctx.roundRect(x - width / 2 - 1, y - 1, width + 2, 6, 2); ctx.fill();
  ctx.fillStyle = color; ctx.fillRect(x - width / 2, y, width * Math.max(0, Math.min(1, ratio)), 3);
}

export function drawNewHero(ctx: Ctx, h: Hero, time: number, showBar = true): boolean {
  const id = h.id; if (!id || id === 'jeff') return false;
  const def = HEROES[id], size = id === 'jayjay' ? 90 : id === 'mike' ? 88 : id === 'becbec' ? 82 : id === 'doni' ? 78 : 74;
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
    if (id === 'jayjay' && h.cast.slot === 4) phase = Math.min(.999, phase * 3 % 1);
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
  if (h.cast || h.swing > 0) {
    const weight = attackPose(phase);
    ctx.translate(weight * (id === 'mike' ? 4 : 2.5), Math.abs(weight) * 1.4);
    ctx.rotate(weight * (id === 'mike' ? -.025 : -.045));
  }
  const crewHero = id === 'cbj' || id === 'doni' || id === 'jayjay';
  const painted = crewHero
    ? humanoid(ctx, 'recruits', id === 'jayjay' ? 4 : id === 'cbj' ? 5 : 6, size, {
      time, walk: h.walkPhase ?? 0, moving: h.downed <= 0 && !!h.moving, walkWeight: h.moveBlend ?? 0,
      attacking: h.downed <= 0 && (!!h.cast || h.swing > 0), phase,
    })
    : heroFrame(ctx, id, row, phase, size, loop);
  if (!painted) { ctx.fillStyle = def.color; ctx.beginPath(); ctx.roundRect(-15, -45, 30, 40, 6); ctx.fill(); disc(ctx, 0, -50, 11, '#d6a27c'); }
  if (id === 'doni') {
    // The rod loads in anticipation, releases at contact, then settles with the full pose.
    const load = h.cast || h.swing > 0 ? attackPose(phase) : Math.sin(time * 2) * .025;
    ctx.save(); ctx.translate(13, -size * .44); ctx.rotate(-.5 + load * .95);
    ctx.strokeStyle = '#563e2e'; ctx.lineWidth = 3.4; ctx.beginPath(); ctx.moveTo(0, 9); ctx.quadraticCurveTo(4 - load * 6, -22, 1 - load * 12, -51); ctx.stroke();
    ctx.strokeStyle = '#e9d59a'; ctx.lineWidth = 1.1; ctx.stroke();
    ctx.strokeStyle = '#d3efea88'; ctx.lineWidth = .65; ctx.beginPath(); ctx.moveTo(1 - load * 12, -51); ctx.quadraticCurveTo(22, -20, 13, 0); ctx.stroke();
    disc(ctx, 0, 5, 3.5, '#aabfc0'); ctx.restore();
  }
  if (id === 'cbj' && (h.cast || h.swing > 0) && phase < .48) {
    ctx.save(); ctx.translate(18 - attackPose(phase) * 8, -size * .43); ctx.rotate(phase * 3);
    tater(ctx, 6); ctx.restore();
  }
  // Motion trails are attached to the real cast/attack phase, never a looping idle flash.
  if (h.cast && ['bob', 'becbec'].includes(id)) {
    const phase = 1 - h.cast.left / h.cast.duration;
    if (phase < .48) {
      radial(ctx, 18, -size * .45, 1, 10 + phase * 28, def.color, phase * .95);
      radial(ctx, 18, -size * .45, 1, 6 + phase * 12, '#fffde7', phase * .7);
    }
  }
  if (h.swing > 0) {
    const swingPhase = 1 - h.swing / (h.swingDuration ?? def.swingTime);
    if (swingPhase > .15 && swingPhase < .7) {
      ctx.globalCompositeOperation = 'lighter';
      radial(ctx, 14, -size * .35, 1, 18 + swingPhase * 16, def.color, .45);
    }
  }
  ctx.restore();
  if (h.moving && id === 'mike') for (let i = 0; i < 5; i++) {
    const age = (time * 3.4 + i / 5) % 1;
    ctx.save(); ctx.globalAlpha = (1 - age) * .28; disc(ctx, h.pos.x - h.facing * (22 + age * 30), h.pos.y + 9 - age * 12, 3.5 + age * 6, '#c1b495'); ctx.restore();
  }
  if (showBar) {
    bar(ctx, h.pos.x, h.pos.y - size + 14, 38, h.hp / h.maxHp, def.color);
    stampText(ctx, h.downed > 0 ? `${Math.ceil(h.downed)}s` : def.name.toUpperCase(), h.pos.x, h.pos.y + 29, { size: 8, color: '#fff2d3' });
  }
  return true;
}

export function drawLogan(ctx: Ctx, s: HeroSummon, time: number): void {
  if (s.buildHelper) {
    castShadow(ctx, s.pos.x, s.pos.y + 7, 12, 4, .25);
    ctx.save(); ctx.globalAlpha = Math.min(1, s.left * 2, (s.duration - s.left) * 4 + .1); ctx.translate(s.pos.x, s.pos.y + 10); ctx.scale(s.facing, 1);
    humanoid(ctx, 'recruits', s.id % 4, 44, { time, walk: s.walkPhase, moving: s.moving, phase: 1 - s.swing / .46, attacking: s.swing > 0 }); ctx.restore();
    bar(ctx, s.pos.x, s.pos.y - 35, 23, s.hp / s.maxHp, '#9dc4ed');
    ctx.fillStyle = '#eed38f'; ctx.fillRect(s.pos.x - 11, s.pos.y - 29, 22 * s.left / s.duration, 2);
    return;
  }
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
  if (!game.heroEnabled || !game.hero.deployed || game.hero.downed > 0) return;
  const h = game.hero, def = game.heroDef, r = def.aura.radius, time = game.time;
  ctx.save(); ctx.translate(h.pos.x, h.pos.y);
  ctx.globalCompositeOperation = 'lighter';
  const glowGrad = ctx.createRadialGradient(0, 0, r * .08, 0, 0, r);
  glowGrad.addColorStop(0, rgba(def.color, .08));
  glowGrad.addColorStop(.55, rgba(def.color, .04));
  glowGrad.addColorStop(1, rgba(def.color, 0));
  ctx.fillStyle = glowGrad; ctx.beginPath(); ctx.arc(0, 0, r, 0, TAU); ctx.fill();
  ctx.globalCompositeOperation = 'source-over';
  ctx.strokeStyle = rgba(def.color, selected ? .55 : .22); ctx.lineWidth = 1.6;
  ctx.setLineDash([4, 7]); ctx.lineDashOffset = -time * 10; ctx.beginPath(); ctx.arc(0, 0, r, 0, TAU); ctx.stroke(); ctx.setLineDash([]);
  ctx.strokeStyle = rgba(def.color, .75); ctx.lineWidth = 2;
  const inner = def.id === 'mike' ? 42 : 29;
  ctx.beginPath(); ctx.ellipse(0, 12, inner, inner * .36, 0, 0, TAU); ctx.stroke();
  for (let i = 0; i < 5; i++) {
    const a = time * .65 + i * TAU / 5;
    const twinkle = 0.55 + Math.sin(time * 5 + i) * 0.45;
    disc(ctx, Math.cos(a) * inner, 12 + Math.sin(a) * inner * .36, 2.2 * twinkle, def.color);
    if (i % 2 === 0) disc(ctx, Math.cos(a) * inner, 12 + Math.sin(a) * inner * .36, 1, '#fffde7');
  }
  if (def.id === 'chris') {
    for (let i = 0; i < 7; i++) {
      const p = (time * .5 + i * .14) % 1;
      ctx.globalAlpha = Math.sin(p * Math.PI) * .18;
      disc(ctx, Math.sin(i * 2.3 + p) * 38, 8 - p * 28, 7 + p * 10, '#b1c16b');
    }
    ctx.globalAlpha = 1;
  }
  if ((h.shield ?? 0) > 0) {
    ctx.globalCompositeOperation = 'lighter';
    radial(ctx, 0, -8, 4, 40, def.color, .28);
    ctx.globalCompositeOperation = 'source-over';
    ctx.fillStyle = rgba(def.color, .14); ctx.strokeStyle = rgba(def.color, .75); ctx.lineWidth = 2.4;
    ctx.beginPath(); for (let i = 0; i <= 6; i++) { const a = i * TAU / 6 - Math.PI / 2; const x = Math.cos(a) * 31, y = Math.sin(a) * 37 - 16; if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y); } ctx.fill(); ctx.stroke();
  }
  if (selected) stampText(ctx, def.aura.name, 0, r + 13, { size: 9, color: def.color });
  ctx.restore();
}

export function drawHeroZones(ctx: Ctx, game: Game): void {
  for (const z of game.heroZones) {
    const color = z.kind === 'gas' ? '#a5bb64' : z.kind === 'net' ? '#71d5ce' : z.kind === 'rain' || z.kind === 'taterRain' ? '#e0bd8a' : z.kind === 'review' ? '#f39882' : z.kind === 'sand' ? '#d2b48c' : '#e9d69f';
    ctx.save(); ctx.globalAlpha = Math.min(1, z.left * 2); ctx.strokeStyle = rgba(color, .55); ctx.lineWidth = 2;
    if (z.kind === 'review') {
      for (const e of game.enemies) if (z.targetIds?.includes(e.id)) {
        ctx.save(); ctx.translate(e.pos.x, e.pos.y - 22); ctx.rotate(game.time * 1.1); ctx.setLineDash([5, 5]);
        glow(ctx, color, 8);
        ctx.beginPath(); ctx.arc(0, 0, e.def.radius + 10, 0, TAU); ctx.stroke();
        noGlow(ctx);
        ctx.restore();
      }
    } else {
      const born = Math.min(1, (z.duration - z.left) * 3);
      ctx.globalCompositeOperation = 'lighter';
      radial(ctx, z.pos.x, z.pos.y, z.radius * .15, z.radius, color, z.kind === 'gas' || z.kind === 'sand' ? .18 : .1);
      ctx.globalCompositeOperation = 'source-over';
      ctx.fillStyle = rgba(color, z.kind === 'gas' || z.kind === 'sand' ? .1 : .05); ctx.setLineDash([6, 8]); ctx.lineDashOffset = -game.time * 14;
      ctx.beginPath(); ctx.arc(z.pos.x, z.pos.y, z.radius * (.85 + born * .15), 0, TAU); ctx.fill(); ctx.stroke(); ctx.setLineDash([]);
      if (z.kind === 'gas') for (let i = 0; i < 16; i++) {
        const phase = (game.time * .55 + i * .062) % 1, a = i * 2.4;
        ctx.globalAlpha = Math.sin(phase * Math.PI) * .16 * Math.min(1, z.left);
        disc(ctx, z.pos.x + Math.cos(a) * z.radius * .65, z.pos.y + Math.sin(a) * z.radius * .5 - phase * 24, 16 + phase * 16, color);
      }
      if (z.kind === 'sand') for (let i = 0; i < 14; i++) {
        const phase = (game.time * .35 + i * .07) % 1, a = i * 2.2;
        ctx.globalAlpha = Math.sin(phase * Math.PI) * .22 * Math.min(1, z.left);
        disc(ctx, z.pos.x + Math.cos(a) * z.radius * (.4 + phase * .4), z.pos.y + Math.sin(a) * z.radius * .35, 3 + phase * 4, '#c4a574');
      }
      if (z.kind === 'supply') {
        ctx.fillStyle = '#937b4e'; ctx.strokeStyle = '#eed99d'; ctx.lineWidth = 2;
        const y = z.pos.y + 12 - Math.sin(born * Math.PI) * 24;
        ctx.beginPath(); ctx.roundRect(z.pos.x - 13, y - 22, 26, 22, 3); ctx.fill(); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(z.pos.x, y - 17); ctx.lineTo(z.pos.x, y - 5); ctx.moveTo(z.pos.x - 6, y - 11); ctx.lineTo(z.pos.x + 6, y - 11); ctx.stroke();
        radial(ctx, z.pos.x, y - 10, 2, 28, '#ffe082', .25 * born);
      }
      if (z.kind === 'net') {
        ctx.save(); ctx.beginPath(); ctx.arc(z.pos.x, z.pos.y, z.radius * (.85 + born * .15), 0, TAU); ctx.clip();
        ctx.translate(z.pos.x, z.pos.y); ctx.rotate(Math.PI / 4);
        ctx.strokeStyle = '#9be0cb66'; ctx.lineWidth = 1;
        for (let i = -z.radius; i <= z.radius; i += 17) {
          const ripple = Math.sin(game.time * 2.2 + i * .045) * 2;
          ctx.beginPath(); ctx.moveTo(i, -z.radius); ctx.quadraticCurveTo(i + ripple, 0, i, z.radius); ctx.stroke();
          ctx.beginPath(); ctx.moveTo(-z.radius, i); ctx.quadraticCurveTo(0, i + ripple, z.radius, i); ctx.stroke();
        }
        ctx.restore();
        stampText(ctx, 'CAST A WIDE NET', z.pos.x, z.pos.y - z.radius - 6, { size: 10, color });
      }
      if (z.kind === 'rain' || z.kind === 'taterRain') {
        stampText(ctx, z.kind === 'rain' ? 'PLUNGER RAIN' : 'FULLY LOADED', z.pos.x, z.pos.y - z.radius - 6, { size: 10, color });
        for (let i = 0; i < 10; i++) {
          const p = (game.time * 1.2 + i * .1) % 1;
          ctx.globalAlpha = Math.sin(p * Math.PI) * .35;
          ctx.strokeStyle = color; ctx.lineWidth = 1.6;
          const x = z.pos.x + Math.sin(i * 2.1) * z.radius * .7;
          ctx.beginPath(); ctx.moveTo(x, z.pos.y - z.radius * .6 + p * z.radius); ctx.lineTo(x + 2, z.pos.y - z.radius * .4 + p * z.radius + 10); ctx.stroke();
        }
      }
      if (z.kind === 'sand') stampText(ctx, 'SAND TRAP', z.pos.x, z.pos.y - z.radius - 6, { size: 10, color });
    }
    ctx.restore();
  }
}

export function drawHeroMissiles(ctx: Ctx, game: Game, alpha = 1): void {
  for (const p of game.heroMissiles) {
    const color = p.kind === 'hook' ? '#8be6dd'
      : p.kind === 'tater' ? '#efbb68'
      : p.kind === 'golf' || p.kind === 'bell' ? '#ffedba'
      : p.kind === 'hose' ? '#8ddfe9'
      : p.kind === 'rebar' ? '#b87333'
      : '#edab82';
    const drawer = p.kind === 'golf' || p.kind === 'bell' ? 'golf'
      : p.kind === 'tater' ? 'tater'
      : p.kind === 'hook' || p.kind === 'rebar' ? 'hook'
      : 'plunger';
    const age = Math.max(0, p.age - (1 - alpha) / 60), phase = Math.min(1, age / p.duration), arc = Math.sin(phase * Math.PI) * (drawer === 'golf' ? 17 : 26);
    const x = p.prev.x + (p.pos.x - p.prev.x) * alpha, groundY = p.prev.y + (p.pos.y - p.prev.y) * alpha, y = groundY - arc;
    const angle = Math.atan2(p.goal.y - p.from.y - Math.cos(phase * Math.PI) * 70, p.goal.x - p.from.x);
    ctx.save();
    castShadow(ctx, x, groundY + 6, p.kind === 'golf' ? 5 : 9, 2.5, .23);
    pointLight(ctx, x, y, 25, color, .6);
    if (p.kind === 'hook') {
      ctx.strokeStyle = '#c4eee18a'; ctx.lineWidth = .8;
      ctx.beginPath(); ctx.moveTo(p.from.x, p.from.y);
      ctx.quadraticCurveTo((p.from.x + x) / 2, (p.from.y + y) / 2 + 18 * (1 - phase), x, y); ctx.stroke();
    }
    ctx.strokeStyle = color; ctx.lineWidth = 1.2; ctx.globalAlpha = .55;
    ctx.beginPath();
    for (let i = 0; i <= 10; i++) {
      const t = Math.max(0, phase - .22 + i * .022);
      const tx = p.from.x + (p.goal.x - p.from.x) * t, ty = p.from.y + (p.goal.y - p.from.y) * t - Math.sin(t * Math.PI) * (drawer === 'golf' ? 17 : 26);
      if (!i) ctx.moveTo(tx, ty); else ctx.lineTo(tx, ty);
    }
    ctx.stroke(); ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = 'lighter';
    for (let i = 1; i <= 6; i++) {
      ctx.globalAlpha = .28 - i * .035;
      disc(ctx, x - Math.cos(angle) * i * 7, y - Math.sin(angle) * i * 7, (p.kind === 'golf' ? 4 : 3) * (1 - i * .1), color);
    }
    ctx.globalCompositeOperation = 'source-over';
    ctx.globalAlpha = 1;
    ctx.strokeStyle = rgba(color, .6); ctx.lineWidth = p.kind === 'golf' ? 2.6 : 1.6;
    ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x - Math.cos(angle) * 28, y - Math.sin(angle) * 28); ctx.stroke();
    ctx.translate(x, y); ctx.rotate(angle + (drawer === 'plunger' ? Math.sin(phase * TAU) * .35 : 0));
    if (drawer === 'golf') {
      glow(ctx, p.kind === 'bell' ? '#ffd54f' : '#fff9e8', 12);
      disc(ctx, 0, 0, 4.4, p.kind === 'bell' ? '#ffd54f' : '#fff9e8'); disc(ctx, -1, 1, .9, '#a7b7b7');
      noGlow(ctx);
    } else if (drawer === 'tater') {
      ctx.rotate(age * 7); tater(ctx, p.splash > 0 ? 9 : 6);
    } else if (drawer === 'hook') {
      ctx.strokeStyle = '#173d45'; ctx.lineWidth = 5; ctx.beginPath(); ctx.moveTo(-10, 0); ctx.lineTo(5, 0); ctx.bezierCurveTo(13, 0, 13, 11, 4, 11); ctx.lineTo(3, 6); ctx.stroke();
      ctx.strokeStyle = '#edf9f1'; ctx.lineWidth = 2; ctx.stroke();
      disc(ctx, -9, 0, 2.5, '#e38365');
    } else {
      ctx.strokeStyle = '#493929'; ctx.lineWidth = 5; ctx.beginPath(); ctx.moveTo(-16, 0); ctx.lineTo(6, 0); ctx.stroke();
      ctx.strokeStyle = '#d1aa69'; ctx.lineWidth = 2.5; ctx.stroke();
      ctx.fillStyle = '#b54b42'; ctx.strokeStyle = '#512e28'; ctx.lineWidth = 1.3;
      ctx.beginPath(); ctx.moveTo(5, -3); ctx.quadraticCurveTo(12, -5, 14, -8); ctx.lineTo(14, 8); ctx.quadraticCurveTo(12, 5, 5, 3); ctx.closePath(); ctx.fill(); ctx.stroke();
      ctx.strokeStyle = '#edaa86'; ctx.beginPath(); ctx.moveTo(13, -6); ctx.lineTo(13, 5); ctx.stroke();
      radial(ctx, 10, 0, 1, 16, '#ff8a65', .35);
    }
    ctx.restore();
  }
}

function tater(ctx: Ctx, size: number): void {
  ctx.fillStyle = '#ca8747'; ctx.strokeStyle = '#6b462b'; ctx.lineWidth = 1.2;
  ctx.beginPath(); ctx.ellipse(0, 0, size, size * .68, -.2, 0, TAU); ctx.fill(); ctx.stroke();
  ctx.fillStyle = '#ffe0a0'; ctx.beginPath(); ctx.ellipse(-size * .16, -size * .24, size * .63, size * .2, -.2, 0, TAU); ctx.fill();
  for (let i = 0; i < 3; i++) disc(ctx, (i - 1) * size * .5, Math.sin(i * 2.4) * size * .3, .8, '#7f552f');
}

export function drawHeroVisuals(ctx: Ctx, game: Game): void {
  for (const fx of game.heroVisuals) {
    const k = Math.max(0, fx.left / fx.duration), phase = 1 - k;
    ctx.save(); ctx.globalAlpha = Math.min(1, k * 2); ctx.strokeStyle = fx.color; ctx.lineCap = 'round';
    if (fx.kind === 'laser') {
      ctx.globalCompositeOperation = 'lighter';
      for (const [width, alpha] of [[fx.radius * 3.2, .2], [fx.radius * 1.6, .45], [fx.radius, .85], [Math.max(1.4, fx.radius * .2), 1]]) {
        ctx.globalAlpha = k * alpha!; ctx.lineWidth = width! * (.75 + k * .35); ctx.strokeStyle = width! < fx.radius ? '#fff6e3' : fx.color;
        ctx.beginPath(); ctx.moveTo(fx.from.x, fx.from.y); ctx.lineTo(fx.to.x, fx.to.y); ctx.stroke();
      }
      radial(ctx, fx.to.x, fx.to.y, 2, fx.radius + 18, fx.color, k * .75);
      starBurst(ctx, fx.to.x, fx.to.y, fx.color, k, 8, 14 + fx.radius);
    } else if (fx.kind === 'current') {
      const radius = fx.radius * (1 - k * k);
      for (let i = 0; i < 3; i++) {
        ctx.globalAlpha = k * (.5 - i * .12); ctx.lineWidth = 8 - i * 2; ctx.strokeStyle = i === 0 ? '#a7efe2' : '#419eae';
        ctx.beginPath(); ctx.ellipse(fx.from.x, fx.from.y + 8, Math.max(1, radius - i * 11), Math.max(1, (radius - i * 11) * .56), 0, 0, TAU); ctx.stroke();
      }
      for (let i = 0; i < 22; i++) {
        const angle = i * 2.4, r = radius * (.78 + (i % 3) * .1);
        ctx.globalAlpha = k * .8;
        disc(ctx, fx.from.x + Math.cos(angle) * r, fx.from.y + Math.sin(angle) * r * .56 - Math.sin(phase * Math.PI) * (8 + i % 4 * 5), 1.1 + k * 1.6, i % 2 ? '#ccfff1' : fx.color);
      }
    } else if (fx.kind === 'hook') {
      ctx.globalAlpha = k * .7; ctx.strokeStyle = '#c4eee1'; ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(fx.from.x, fx.from.y); ctx.quadraticCurveTo((fx.from.x + fx.to.x) / 2, (fx.from.y + fx.to.y) / 2 + phase * 18, fx.to.x, fx.to.y); ctx.stroke();
      for (let i = 0; i < 5; i++) { const a = i * TAU / 5; disc(ctx, fx.to.x + Math.cos(a) * phase * 20, fx.to.y + Math.sin(a) * phase * 12, k * 2, fx.color); }
    } else if (fx.kind === 'saw' || fx.kind === 'golf' || fx.kind === 'punch') {
      const side = fx.to.x >= fx.from.x ? 1 : -1;
      ctx.globalCompositeOperation = 'lighter';
      radial(ctx, fx.from.x + side * 12, fx.from.y - 16, 2, fx.radius * .9, fx.color, k * .45);
      ctx.globalCompositeOperation = 'source-over';
      ctx.translate(fx.from.x + side * 12, fx.from.y - 16); ctx.scale(side, 1);
      glow(ctx, fx.color, 12);
      ctx.lineWidth = fx.kind === 'punch' ? 6.5 * k : 3.8 * k;
      ctx.beginPath(); ctx.arc(0, 0, fx.radius * (.65 + phase * .25), -1.2 + phase * .6, .8 + phase * .6); ctx.stroke();
      for (let i = 0; i < 6; i++) {
        const a = -.7 + i * .4;
        ctx.lineWidth = 1.6; ctx.globalAlpha = k * (.7 - i * .08);
        ctx.beginPath(); ctx.moveTo(Math.cos(a) * 22, Math.sin(a) * 22); ctx.lineTo(Math.cos(a) * (26 + phase * 22), Math.sin(a) * (26 + phase * 22)); ctx.stroke();
      }
      noGlow(ctx);
    } else {
      shockwave(ctx, fx.from.x, fx.from.y + 4, fx.radius, fx.color, k, fx.kind === 'slam' ? 6 : 3.5);
      for (let i = 0; i < 4; i++) {
        const r = Math.max(1, fx.radius * Math.min(1, phase * 1.55 + i * .12));
        ctx.lineWidth = (fx.kind === 'slam' ? 6 : 3.2) * k; ctx.globalAlpha = k * (.7 - i * .14);
        ctx.beginPath(); ctx.ellipse(fx.from.x, fx.from.y + 4, r, r * (fx.kind === 'buff' || fx.kind === 'summon' ? .42 : .7), 0, 0, TAU); ctx.stroke();
      }
      if (fx.kind === 'slam') {
        starBurst(ctx, fx.from.x, fx.from.y, '#fffde7', k, 10, fx.radius * .55);
        for (let i = 0; i < 12; i++) {
          const a = i * 2.1, r = fx.radius * phase;
          ctx.fillStyle = '#a1937a'; ctx.globalAlpha = k;
          ctx.fillRect(fx.from.x + Math.cos(a) * r, fx.from.y + Math.sin(a) * r * .6 - Math.sin(phase * Math.PI) * 24, 5, 3.5);
        }
      }
      if (fx.kind === 'summon' || fx.kind === 'buff') {
        for (let i = 0; i < 8; i++) {
          const a = game.time * 3 + i * .8;
          ctx.globalAlpha = k * .5;
          disc(ctx, fx.from.x + Math.cos(a) * fx.radius * .5, fx.from.y - 10 - phase * 20 + Math.sin(a) * 8, 2.5, fx.color);
        }
      }
    }
    ctx.restore();
  }
}

export function drawHeroNotice(ctx: Ctx, game: Game): void {
  const notice = game.heroNotice; if (!notice) return;
  ctx.save(); ctx.globalAlpha = Math.min(1, notice.left * 3);
  glow(ctx, notice.color, 14);
  ctx.fillStyle = '#173528f0'; ctx.strokeStyle = notice.color; ctx.lineWidth = 1.6;
  ctx.beginPath(); ctx.roundRect(300, 548, 360, 34, 8); ctx.fill(); ctx.stroke();
  noGlow(ctx);
  stampText(ctx, notice.name.toUpperCase(), 480, 562, { size: 12, color: notice.color });
  stampText(ctx, notice.detail, 480, 575, { size: 8, color: '#e6ead3' });
  ctx.restore();
}
