import { actorArt, meshActor, attackSprite, walkSprite, artReady, blendPoses, type ActorSheet } from './art';
import { ENEMIES } from '../data/enemies';
import { ENEMY_ART } from './art';
type Ctx = CanvasRenderingContext2D;
const ease = (x: number) => x * x * (3 - 2 * x);
/** Continuous anticipation, contact, follow-through and recovery, sampled at render time. */
export function attackPose(phase: number): number {
  const keys = [[0, 0], [.28, -.55], [.48, 1], [.62, .76], [1, 0]];
  for (let i = 1; i < keys.length; i++) {
    const [t, v] = keys[i]!, [pt, pv] = keys[i - 1]!;
    if (phase <= t!) return pv! + (v! - pv!) * ease(Math.max(0, (phase - pt!) / (t! - pt!)));
  }
  return 0;
}
export interface Motion { time: number; walk: number; moving: boolean; phase: number; attacking: boolean; cast?: number; tier?: number; punch?: boolean; walkWeight?: number }
const motionCache = new Map<string, HTMLCanvasElement>();
const smooth = (x:number) => {const t=Math.max(0,Math.min(1,x));return t*t*(3-2*t);};
/** Smoothly skinned painted mesh, cached at 48 poses per cycle; no detached cutout edges. */
export function humanoid(ctx: Ctx, sheet: ActorSheet, index: number, height: number, m: Motion): boolean {
  const art=actorArt(sheet,index,height);if(!art)return false;
  if((m.cast??0)>.02&&sheet==='units'&&artReady('crewAttacks')){
    const amount=m.cast!;
    blendPoses(ctx,height,amount,(c,next)=>{if(next)attackSprite(c,0,amount*.26,height);else humanoid(c,sheet,index,height,{...m,cast:0,attacking:false,moving:false});});return true;
  }
  if(m.attacking&&artReady('crewAttacks')){
    const opacity=Math.min(1,m.phase/.2,(1-m.phase)/.22);
    ctx.save(); const strike=attackPose(m.phase); ctx.translate(strike*1.7,Math.abs(strike)*.8); ctx.rotate(-strike*.025);
    blendPoses(ctx,height,opacity,(c,next)=>{
      if(next)attackSprite(c,sheet==='units'?0:index===4?1:index===5?2:index===6?3:4,m.phase,height,sheet==='recruits'&&index<4?index:0);
      else humanoid(c,sheet,index,height,{...m,attacking:false,moving:false,tier:0});
    });
    ctx.restore();if((m.tier??0)>0)equipment(ctx,art.width,height,m.tier!,strike);return true;
  }

  if(m.moving&&artReady('crewWalk')&&(sheet==='units'||index>=4&&index<=6)){
    const weight=m.walkWeight??1;
    blendPoses(ctx,height,weight,(c,next)=>{if(next)walkSprite(c,sheet==='units'?0:index-3,m.walk,height);else humanoid(c,sheet,index,height,{...m,moving:false,tier:0});});
    if((m.tier??0)>0)equipment(ctx,art.width,height,m.tier!,0);return true;
  }
  const frame=m.attacking?Math.round(m.phase*48):m.moving?Math.round(((m.walk%(Math.PI*2)+Math.PI*2)%(Math.PI*2))/(Math.PI*2)*48):0;
  const cast=Math.round((m.cast??0)*12),key=`${sheet}:${index}:${height}:${m.attacking?'a':m.moving?'w':'i'}:${frame}:${cast}`;
  let cached=motionCache.get(key);
  if(!cached){
    cached=document.createElement('canvas');cached.width=Math.ceil(height*3.2);cached.height=Math.ceil(height*3.2);
    const c=cached.getContext('2d')!;c.scale(2,2);c.translate(height*.8,height*1.35);
    const hit=m.attacking?attackPose(frame/48):0,step=m.moving?Math.sin(frame/48*Math.PI*2):0;
    meshActor(c,sheet,index,height,(x,y)=>{
      let xx=x,yy=y;
      const lower=smooth((y-.56)/.35),side=x<.5?1:-1;
      xx+=step*side*.11*lower;
      yy-=Math.max(0,step*side)*.045*lower;
      const armBand=smooth((y-.24)/.12)*(1-smooth((y-.70)/.08));
      const left=smooth((.37-x)/.19)*armBand,right=smooth((x-.68)/.18)*armBand;
      const rotate=(px:number,py:number,angle:number,weight:number)=>{
        const dx=(x-px)*art.width/height,dy=y-py;
        xx+=(dx*Math.cos(angle)-dy*Math.sin(angle)-dx)*height/art.width*weight;
        yy+=(dx*Math.sin(angle)+dy*Math.cos(angle)-dy)*weight;
      };
      rotate(.29,.32,-hit*1.15+step*.15-cast/12*.6,left);
      rotate(.74,.32,-hit*.65-step*.13,right);
      // Compression through the knees and torso carries the weight into the strike.
      xx+=hit*.045*smooth((.85-y)/.6);yy+=Math.abs(hit)*.014*smooth((y-.24)/.4);
      if(sheet==='units'&&x<.3&&y<.26) rotate(.37,.34,-hit*.9,smooth((.32-x)/.15));
      return [xx,yy];
    });
    motionCache.set(key,cached);
    if(motionCache.size>1800)motionCache.delete(motionCache.keys().next().value!);
  }
  ctx.save();ctx.translate(0,m.moving?0:Math.sin(m.time*2.5)*.4);
  ctx.drawImage(cached,-height*.8,-height*1.35,height*1.6,height*1.6);
  if((m.tier??0)>0)equipment(ctx,art.width,height,m.tier!,m.attacking?attackPose(m.phase):0);
  ctx.restore();return true;
}
function equipment(ctx: Ctx, w: number, h: number, tier: number, hit: number): void {
  ctx.strokeStyle = '#252e32'; ctx.lineWidth = 1;
  ctx.fillStyle = tier >= 4 ? '#c8a052' : '#849398';
  for (const x of [-.2, .24]) {
    ctx.beginPath(); ctx.ellipse(w * x, -h * .67, w * .13, h * (.038 + tier * .003), x > 0 ? .25 : -.25, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
    ctx.fillStyle = '#f8ddb0'; ctx.fillRect(w * x - 1, -h * .69, 2, 2); ctx.fillStyle = tier >= 4 ? '#c8a052' : '#849398';
  }
  if (tier >= 2) {
    ctx.fillStyle = tier >= 4 ? '#494f52' : '#60737c'; ctx.beginPath();
    ctx.moveTo(-w * .16, -h * .61); ctx.lineTo(w * .17, -h * .61); ctx.lineTo(w * .12, -h * .44); ctx.lineTo(-w * .11, -h * .44); ctx.closePath(); ctx.fill(); ctx.stroke();
    ctx.strokeStyle = '#c6ab6c'; ctx.beginPath(); ctx.moveTo(-w * .1, -h * .58);ctx.lineTo(w * .1,-h * .58);ctx.stroke();
  }
  if (tier >= 3) { ctx.fillStyle = '#afbbb6'; for (const x of [-.13,.22]) { ctx.beginPath(); ctx.ellipse(w*x, -h*.23, w*.065,h*.035,0,0,Math.PI*2);ctx.fill(); } }
  if (tier >= 5) { ctx.fillStyle = '#ffd36d'; ctx.beginPath();ctx.arc(0,-h*.55,2.4,0,Math.PI*2);ctx.fill();ctx.shadowBlur=0; }
  void hit;
}
const creatureCache = new Map<string, HTMLCanvasElement>();
/** Connected, skinned silhouettes: gaits never split into independently sliding strips. */
export function monster(ctx: Ctx, index: number, height: number, walk: number, moving: boolean, time: number, phase: number, attacking: boolean, flying: boolean, fluid: boolean): void {
  const art = actorArt('units', index, height); if (!art) return;
  const density = Math.min(2, window.devicePixelRatio || 1);
  const strike = attacking ? attackPose(phase) : 0;
  const cycle = fluid ? time * 3.7 : flying ? time * 14 : moving ? walk : time * 2;
  const at = ((cycle / (Math.PI * 2) % 1) + 1) % 1 * 40, frame = Math.floor(at);
  const pose = (n: number) => {
    const key = `${index}:${height}:${density}:${moving && !fluid && !flying ? 'walk' : 'idle'}:${n}`;
    let image = creatureCache.get(key);
    if (image) return image;
    image = document.createElement('canvas'); image.width = Math.ceil(Math.max(height * 1.6, art.width * 1.4) * density); image.height = Math.ceil(height * 1.6 * density);
    const c = image.getContext('2d')!; c.scale(density, density); c.translate(image.width / (2 * density), height * 1.35);
    const step = n / 40 * Math.PI * 2;
    meshActor(c, 'units', index, height, (x, y) => {
      const edge = Math.abs(x - .5) * 2, feet = smooth((y - .55) / .4);
      let xx = x, yy = y;
      if (fluid) {
        const wave = Math.sin(step + y * 5.5);
        xx += wave * .055 * Math.sin(y * Math.PI);
        yy += Math.cos(step + x * 3) * .022 * (1 - y);
      } else if (flying) {
        // Wing tips hinge from the thorax while the head and body remain stable.
        const wing = smooth((edge - .22) / .65) * (1 - smooth((y - .72) / .2));
        xx += (x - .5) * Math.sin(step) * .16 * wing;
        yy += Math.sin(step) * .14 * wing;
      } else {
        const side = x < .5 ? 1 : -1, gait = moving ? Math.sin(step) : 0;
        xx += gait * side * .10 * feet;
        yy -= Math.max(0, gait * side) * .055 * feet;
        // Opposing shoulder and claw motion transmits each footfall through the body.
        xx -= gait * .022 * (1 - feet);
        yy += Math.sin(step * 2) * (moving ? .012 : .006) * (1 - y);
        yy += Math.sin(step + side) * .025 * edge * (1 - feet);
      }
      return [xx, yy];
    });
    creatureCache.set(key, image);
    if (creatureCache.size > 720) creatureCache.delete(creatureCache.keys().next().value!);
    return image;
  };
  const a = pose(frame), b = pose((frame + 1) % 40);
  ctx.save();
  ctx.transform(1, 0, -strike * .12, 1 - Math.abs(strike) * .025, strike * height * .03, 0);
  blendPoses(ctx, height, at - frame, (c, next) => { const image=next?b:a; c.drawImage(image, -image.width / (2 * density), -height * 1.35, image.width / density, image.height / density); });
  ctx.restore();
}

/** Warm visible actors before play; retired workshop animations no longer delay startup. */
export async function warmMotion(): Promise<void> {
  const canvas = document.createElement('canvas'); canvas.width = 200; canvas.height = 200;
  const ctx = canvas.getContext('2d')!; ctx.translate(100, 120);
  for (const [index, height] of [[0, 43], [4, 90], [5, 74], [6, 78]] as const) {
    humanoid(ctx, 'recruits', index, height, { time: 0, walk: 0, moving: false, phase: 0, attacking: false });
  }
  // Prepare the opening roster before play, avoiding a mesh build on each first footfall.
  for (const id of ['drip', 'sludge', 'scaleCrab', 'pressureSpike', 'airlock', 'steamWisp'] as const) {
    const def = ENEMIES[id], fluid = ['drip', 'sludge', 'airlock', 'steamWisp'].includes(id);
    for (let frame = 0; frame < 40; frame++) {
      const phase = frame / 40 * Math.PI * 2;
      monster(ctx, ENEMY_ART[id]!, Math.max(37, def.radius * 2.8), phase, true, phase / (fluid ? 3.7 : def.flying ? 14 : 2), 0, false, def.flying, fluid);
      if (frame % 8 === 7) await new Promise<void>(resolve => setTimeout(resolve, 0));
    }
  }
}
