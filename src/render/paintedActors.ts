import { drawNewHero } from './heroActors';
import { JEFF } from '../data/jeff';
import type { Enemy, Hero, Tower, Friendly } from '../sim/state';
import { humanoid, monster } from './animation';
import { FRIENDLY_SWING } from '../sim/friendlies';
import { artReady, ENEMY_ART, paintedSprite, TOWER_ART } from './art';
import { castShadow, disc, pulseRing, radial, rgba, stampText } from './ink';

type Ctx = CanvasRenderingContext2D;
export function paintedCrew(ctx: Ctx, pos: { x: number; y: number }, time: number, swing: number, facing: number, hp: number, lifetime = 1): void {
  castShadow(ctx, pos.x, pos.y + 8, 10, 4, 0.3);
  ctx.save(); ctx.translate(pos.x, pos.y + 9); ctx.scale(facing, 1);
  const painted = humanoid(ctx, 'recruits', 0, 43, { time, walk: 0, moving: false, attacking: swing > 0, phase: 1 - swing / .68 });
  if (!painted) {
    ctx.fillStyle = '#507d49'; ctx.fillRect(-8, -26, 16, 21);
    disc(ctx, 0, -31, 7, '#d9aa7e'); ctx.fillStyle = '#dfb94f'; ctx.fillRect(-9, -38, 18, 5);
    ctx.fillStyle = '#3d4143'; ctx.fillRect(-8, -6, 6, 6); ctx.fillRect(2, -6, 6, 6);
  }
  ctx.restore();
  health(ctx, pos.x, pos.y - 36, 20, hp, '#a8d478');
  if (lifetime < 1) { ctx.fillStyle = '#f5d08b'; ctx.fillRect(pos.x - 10, pos.y - 29, 20 * Math.max(0, lifetime), 2); }
}
function fallbackFriendly(ctx: Ctx, height: number): void {
  ctx.fillStyle = '#507d49';
  ctx.fillRect(-8, -height * 0.62, 16, height * 0.48);
  disc(ctx, 0, -height * 0.72, 7, '#d9aa7e');
  ctx.fillStyle = '#dfb94f';
  ctx.fillRect(-9, -height * 0.88, 18, 5);
}

function health(ctx: Ctx, x: number, y: number, w: number, ratio: number, color: string): void {
  ctx.fillStyle = '#202c24'; ctx.beginPath(); ctx.roundRect(x - w / 2 - 1, y - 1, w + 2, 6, 2); ctx.fill();
  ctx.fillStyle = color; ctx.fillRect(x - w / 2, y, w * Math.max(0, Math.min(1, ratio)), 3);
  ctx.fillStyle = '#ffffff55'; ctx.fillRect(x - w / 2, y, w * Math.max(0, Math.min(1, ratio)), 1);
}

export function paintedJeff(ctx: Ctx, hero: Hero, time: number, showBar: boolean, scale: number): boolean {
  if (hero.id && hero.id !== 'jeff') return drawNewHero(ctx, hero, time, showBar);
  if (!artReady('units')) return false;
  const { x, y } = hero.pos;
  const size = 68 * scale / 1.72;
  const moving = !!hero.moving || (hero.moveBlend ?? 0) > 0;
  const phase = hero.swing > 0 ? 1 - hero.swing / JEFF.swingTime : 0;
  castShadow(ctx, x, y + 14, size * 0.26, size * 0.08, 0.32);
  ctx.save(); ctx.translate(x, y + 18);
  if (hero.downed > 0) { ctx.globalAlpha = 0.48; ctx.rotate(-1.15); }
  ctx.scale(hero.facing, 1);
  humanoid(ctx, 'units', 0, size, { time, walk: hero.walkPhase ?? 0, walkWeight: hero.moveBlend ?? 0, moving, phase, attacking: hero.swing > 0, cast: Math.sin(Math.PI * (hero.castTimer ?? 0) / .72) });
  ctx.restore();
  if (hero.swing > 0) {
    ctx.save(); ctx.translate(x + hero.facing * 8, y - 22); ctx.scale(hero.facing, 1);
    ctx.globalAlpha = Math.max(0, Math.sin((phase - .28) / .4 * Math.PI)) * (phase < .68 ? 1 : 0); ctx.strokeStyle = '#fff3bc'; ctx.lineWidth = 7;
    ctx.beginPath(); ctx.arc(0, 0, 42, -1.5 + phase, 0.4 + phase); ctx.stroke();
    ctx.lineWidth = 2; ctx.strokeStyle = '#efaa57'; ctx.beginPath(); ctx.arc(0, 0, 48, -1.6 + phase, 0.2 + phase); ctx.stroke(); ctx.restore();
  }
  if (showBar) {
    health(ctx, x, y - size + 10, 38, hero.hp / hero.maxHp, '#81db61');
    if (hero.downed > 0) stampText(ctx, `${Math.ceil(hero.downed)}s`, x, y - 36, { size: 13, color: '#fff5ce' });
  }
  return true;
}

export function paintedEnemy(ctx: Ctx, e: Enemy, time: number, dir?: { x: number; y: number }): boolean {
  const index = ENEMY_ART[e.def.id];
  if (index === undefined || !artReady(index >= 16 ? 'unitsAdvanced' : 'units')) return false;
  const { x, y } = e.pos;
  const boss = e.def.traits.includes('boss');
  const height = Math.max(37, e.def.radius * (boss ? 3 : 2.8));
  const moving = e.heldBy === null && e.stun <= 0;
  const stride = Math.sin(e.wobble * 1.7);
  const lift = e.def.flying ? 12 + Math.sin(time * 5 + e.id) * 3 : moving ? Math.abs(stride) * 2.2 : 0;
  castShadow(ctx, x, y + 7, height * 0.31, height * 0.1, 0.28);
  if (e.slow > 0.05) pulseRing(ctx, x, y + 5, height * 0.4, '#b5f3ff', 0.65, 1.5);
  ctx.save(); ctx.translate(x, y + 11 - lift);
  if (e.phased) ctx.globalAlpha = 0.32;
  if (e.hitFlash > 0.08) ctx.filter = 'brightness(1.65)';
  const squash = moving && !e.def.flying ? stride * 0.045 : Math.sin(time * 3 + e.id) * 0.018;
  ctx.scale((dir && dir.x < -0.2 ? -1 : 1) * (1 + squash), 1 - squash);
  const phase = 1 - (e.attackSwing ?? 0) / .64;
  monster(ctx, index, height, e.wobble * 1.7, moving, time + e.id, phase, (e.attackSwing ?? 0) > 0, e.def.flying, ['drip','sludge','steamWisp','airlock','biofilm','vacuumBreak'].includes(e.def.id));
  ctx.restore();
  if (e.hp < e.maxHp || e.heldBy || boss) health(ctx, x, y - height - lift + 5, boss ? 65 : 23, e.hp / e.maxHp, boss ? '#f27e55' : '#83ce5b');
  if (e.stun > 0) for (let i = 0; i < 3; i++) {
    const a = time * 6 + i * Math.PI * 2 / 3;
    stampText(ctx, '✦', x + Math.cos(a) * 13, y - height - lift + Math.sin(a) * 4, { size: 11, color: '#ffe79e' });
  }
  if (e.armorShred > 0) { ctx.fillStyle = '#ffb55e'; ctx.fillRect(x - 4, y - height - lift - 7, 8, 3); }
  if (e.dotTime > 0) {
    for (let i = 0; i < 3; i++) {
      const fall = ((time * 30 + i * 11) % 18);
      disc(ctx, x - 5 + i * 5 + Math.sin(time * 3 + i) * 2, y - height - lift + fall, 1.6, rgba('#4fc3f7', 0.7 - fall / 30));
    }
  }
  if (e.marked) {
    ctx.strokeStyle = '#ffcc80';
    ctx.lineWidth = 2.4;
    ctx.setLineDash([4, 4]);
    ctx.beginPath();
    ctx.arc(x, y + 5, height * 0.42, 0, Math.PI * 2);
    ctx.stroke();
    ctx.setLineDash([]);
  }
  return true;
}

export function paintedTower(ctx: Ctx, t: Tower, time: number): boolean {
  const recruitRow = t.def.id === 'apprentices' ? 0 : t.def.id === 'jayjay' ? 1 : t.def.id === 'cbjDoni' ? 2 : -1;
  const index = recruitRow >= 0 ? recruitRow * 4 + [0, 0, 1, 2, 2, 3][t.level]! : TOWER_ART[t.def.id];
  if (index === undefined || !artReady(recruitRow >= 0 ? 'recruitTowers' : index >= 12 ? 'towersAdvanced' : 'towers')) return false;
  const { x, y } = t.pos;
  const elite = !!t.specialization;
  const height = 65 + t.level * 8 + (elite ? 10 : 0);
  castShadow(ctx, x + 6, y + 6, 29 + t.level * 2, 9, 0.32);
  if (t.def.kind === 'aura' || elite) radial(ctx, x, y, 6, 39, t.def.color, 0.09 + Math.sin(time * 3) * 0.025);
  ctx.save(); ctx.translate(x, y + 13);
  if (t.frozen > 0) ctx.filter = 'saturate(0.25) brightness(1.35)';
  if (t.rebuild > 0) ctx.globalAlpha = 0.55;
  const recoil = Math.sin(Math.PI * Math.min(1, Math.max(0, t.recoil) / .28));
  ctx.scale(1 + recoil * 0.025, 1 - recoil * 0.05);
  ctx.rotate(-Math.cos(t.facing) * recoil * 0.025);
  const windup = (t.windup ?? 0) / .16;
  ctx.translate(0, -Math.sin(windup * Math.PI) * 1.5);
  towerArmor(ctx, t, height, false);
  paintedSprite(ctx, recruitRow >= 0 ? 'recruitTowers' : 'towers', index, 0, 0, height, height * 1.2);
  towerArmor(ctx, t, height, true);
  ctx.restore();
  // Physical brass level plates keep upgrades legible at game scale.
  ctx.fillStyle = '#2e3527'; ctx.beginPath(); ctx.roundRect(x - 24, y + 10, 48, 10, 3); ctx.fill();
  for (let i = 0; i <= t.level; i++) {
    disc(ctx, x + (i - t.level / 2) * 7, y + 15, 2.1, elite ? '#9ff3d8' : '#f6d080');
  }
  if ((t.mastery ?? 0) > 0) stampText(ctx, `M${t.mastery}`, x, y + 29, { size: 9, color: '#ffe09a' });
  if (elite) {
    ctx.strokeStyle = '#e9cc7c'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(x + 24, y - 28); ctx.lineTo(x + 24, y - 59); ctx.stroke();
    ctx.fillStyle = t.specialization === 'power' ? '#d45c31' : '#339d95'; ctx.beginPath(); ctx.moveTo(x + 24, y - 58); ctx.lineTo(x + 43, y - 54 + Math.sin(time * 5) * 2); ctx.lineTo(x + 24, y - 46); ctx.fill();
    stampText(ctx, '★', x + 31, y - 49, { size: 8, color: '#fff3c4' });
  }
  if (t.frozen > 0) pulseRing(ctx, x, y, 30, rgba('#b8eaff', 0.8), 0.75, 2);
  return true;
}

export function paintedFriendly(ctx: Ctx, f: Friendly, time: number): void {
  if (f.respawn > 0 && (f.fall ?? 0) <= 0) return;
  const height = f.role === 'jayjay' ? 62 : f.role === 'doni' ? 56 : f.role === 'cbj' ? 53 : 43;
  const index = f.role === 'jayjay' ? 4 : f.role === 'cbj' ? 5 : f.role === 'doni' ? 6 : f.slot % 4;
  castShadow(ctx, f.pos.x, f.pos.y + 8, height * .23, 4, .3);
  ctx.save(); ctx.translate(f.pos.x, f.pos.y + 10); ctx.scale(f.facing,1);
  if (f.respawn > 0) { const k=(f.fall??0)/.55; ctx.globalAlpha=k;ctx.rotate((1-k)*1.15);ctx.scale(1,.55+.45*k); if (!humanoid(ctx,'recruits',index,height,{time,walk:0,moving:false,attacking:false,phase:0,tier:f.tier})) fallbackFriendly(ctx, height); ctx.restore();return; }
  if (!humanoid(ctx, 'recruits', index, height, { time: time + f.id, moving: f.moving || (f.moveBlend ?? 0) > 0, walkWeight: f.moveBlend ?? 0, walk: f.walkPhase, phase: 1 - f.swing / FRIENDLY_SWING, attacking: f.swing > 0, tier: f.tier, punch: f.role !== 'apprentice' })) {
    fallbackFriendly(ctx, height);
  }
  if (f.swing > 0) {
    const phase = 1 - f.swing / FRIENDLY_SWING;
    const alpha = phase > .3 && phase < .65 ? Math.sin((phase-.3)/.35*Math.PI) : 0;
    ctx.globalAlpha = alpha * .75; ctx.strokeStyle = '#fff0c4';ctx.lineWidth=2;
    ctx.beginPath();ctx.arc(5,-height*.46,height*.32,-1.5+phase*2,.1+phase*2);ctx.stroke();
  }
  ctx.restore();
  if (f.hp < f.maxHp || f.targetId !== null) health(ctx,f.pos.x,f.pos.y-height+4,26,f.hp/f.maxHp,'#a6df86');
  if (f.role !== 'apprentice') stampText(ctx, f.role === 'jayjay' ? 'JAYJAY' : f.role === 'cbj' ? 'CBJ' : 'DONI', f.pos.x,f.pos.y+18,{size:8,color:'#fff0cd'});
}
function towerArmor(ctx: Ctx, t: Tower, height: number, front: boolean): void {
  if (t.level < 1) return;
  const level = t.level;
  if (!front) {
    if (level >= 2) {
      ctx.fillStyle = '#404e50';ctx.strokeStyle='#b8aa7e';ctx.lineWidth=1.5;
      for (const side of [-1,1]) { ctx.beginPath();ctx.moveTo(side*22,0);ctx.lineTo(side*37,-5);ctx.lineTo(side*31,-height*.55);ctx.lineTo(side*21,-height*.62);ctx.closePath();ctx.fill();ctx.stroke(); }
    }
    if (level >= 4) { ctx.fillStyle='#858d82';ctx.beginPath();ctx.ellipse(0,0,42,13,0,0,Math.PI*2);ctx.fill();ctx.strokeStyle='#c4a252';ctx.lineWidth=3;ctx.stroke(); }
  } else {
    ctx.fillStyle = level >= 4 ? '#b69b52' : '#778b91'; ctx.strokeStyle = '#26393c';ctx.lineWidth=1;
    for (const side of [-1,1]) { ctx.beginPath();ctx.roundRect(side*24-5,-height*.27,10,15+level*2,2);ctx.fill();ctx.stroke();ctx.fillStyle='#e4d9ad';disc(ctx,side*24,-height*.27+4,1.3,'#e4d9ad');ctx.fillStyle=level>=4?'#b69b52':'#778b91'; }
    if (level >= 3) { ctx.strokeStyle = '#d3b77b';ctx.lineWidth=3;ctx.beginPath();ctx.moveTo(-20,-10);ctx.lineTo(20,-10);ctx.stroke(); }
    if (level >= 5) { ctx.fillStyle='#ffe7a1';ctx.shadowColor='#ffca63';ctx.shadowBlur=8;disc(ctx,0,-height*.5,3,'#ffe7a1');ctx.shadowBlur=0; }
  }
}
