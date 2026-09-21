import type { EnemyId, TowerId } from '../data/types';
import { extractHeroFrames } from './heroAtlas';

/** Original painted atlases. All simulation coordinates remain independent of art. */
const urls = {
  landscapes: new URL('../../assets/cinematic/environments.jpg', import.meta.url).href,
  heroMike: new URL('../../assets/remaster/hero-mike.webp', import.meta.url).href,
  heroBob: new URL('../../assets/remaster/hero-bob.webp', import.meta.url).href,
  heroChris: new URL('../../assets/remaster/hero-chris.webp', import.meta.url).href,
  heroBecbec: new URL('../../assets/remaster/hero-becbec.webp', import.meta.url).href,
  heroLogan: new URL('../../assets/remaster/hero-logan.webp', import.meta.url).href,
  apprenticeAttacks: new URL('../../assets/remaster/apprentice-attacks.webp', import.meta.url).href,
  crewWalk: new URL('../../assets/remaster/crew-walk.webp', import.meta.url).href,
  crewAttacks: new URL('../../assets/remaster/crew-attacks.webp', import.meta.url).href,
  recruits: new URL('../../assets/remaster/recruits.webp', import.meta.url).href,
  units: new URL('../../assets/remaster/units.webp', import.meta.url).href,
  towers: new URL('../../assets/remaster/towers.webp', import.meta.url).href,
  unitsAdvanced: new URL('../../assets/remaster/units-advanced.webp', import.meta.url).href,
  towersAdvanced: new URL('../../assets/remaster/towers-advanced.webp', import.meta.url).href,
  waterworks: new URL('../../assets/remaster/waterworks.webp', import.meta.url).href,
  biomes: new URL('../../assets/remaster/biomes.webp', import.meta.url).href,
};
type Sheet = keyof typeof urls;
const images = new Map<Sheet, HTMLImageElement>();
const heroFrames = new Map<Sheet, HTMLCanvasElement[]>();
const crops = new Map<string, [number, number, number, number]>();

export const WATERWORKS_ART = urls.waterworks;
export const LANDSCAPE_ART = urls.landscapes;
export const TITLE_ART = new URL('../../assets/cinematic/waterworks-keyart.jpg', import.meta.url).href;

const poseSurfaces = new Map<string, HTMLCanvasElement>();
let poseDepth = 0;
/** Premultiplied pose mixing. Overlapping pixels retain their opacity between frames. */
export function blendPoses(ctx: CanvasRenderingContext2D, height: number, blend: number, paint: (c: CanvasRenderingContext2D, next: boolean) => void): void {
  const b = Math.max(0, Math.min(1, blend));
  if (b < .002 || b > .998) { paint(ctx, b > .5); return; }
  const density = Math.min(2, window.devicePixelRatio || 1);
  const size = Math.max(128, 2 ** Math.ceil(Math.log2(height * 2 * density)));
  const depth = poseDepth++;
  const key = `${depth}:${size}`;
  let poseSurface = poseSurfaces.get(key);
  if (!poseSurface) {
    poseSurface = document.createElement('canvas'); poseSurface.width = poseSurface.height = size;
    poseSurfaces.set(key, poseSurface);
  }
  const c = poseSurface.getContext('2d')!, side = poseSurface.width;
  c.setTransform(1, 0, 0, 1, 0, 0); c.clearRect(0, 0, side, side);
  c.save();
  try {
    c.translate(side / 2, side * .75); c.scale(density, density);
    c.globalCompositeOperation = 'source-over'; c.globalAlpha = 1 - b; paint(c, false);
    c.globalCompositeOperation = 'lighter'; c.globalAlpha = b; paint(c, true);
    ctx.drawImage(poseSurface, -side / (2 * density), -side * .75 / density, side / density, side / density);
  } finally { c.restore(); poseDepth--; }
}

export async function preloadArt(): Promise<void> {
  await Promise.all(Object.entries(urls).map(([name, url]) => new Promise<void>((resolve) => {
    const img = new Image();
    let settled = false;
    const done = () => {
      if (settled) return;
      settled = true;
      clearTimeout(timeout);
      resolve();
    };
    const timeout = window.setTimeout(done, 5000);
    img.onload = () => {
      try {
        images.set(name as Sheet, img);
        if (name.startsWith('hero')) heroFrames.set(name as Sheet, extractHeroFrames(img));
      } catch {
        // Keep the procedural fallback.
      } finally {
        done();
      }
    };
    img.onerror = done;
    img.src = url;
  })));
}

export function artReady(sheet: Sheet): boolean { return images.has(sheet); }

export type HeroAtlasId = 'mike' | 'bob' | 'chris' | 'becbec' | 'logan';
const heroSheets: Record<HeroAtlasId, Sheet> = { mike: 'heroMike', bob: 'heroBob', chris: 'heroChris', becbec: 'heroBecbec', logan: 'heroLogan' };
/** Complete painted poses share a fixed cell anchor; easing preserves the full wind-up and recovery. */
export function heroFrame(ctx: CanvasRenderingContext2D, id: HeroAtlasId, row: number, phase: number, height: number, loop = false): boolean {
  const img = images.get(heroSheets[id]); if (!img) return false;
  const h = img.height / 3, scale = height / h;
  const frames = heroFrames.get(heroSheets[id]); if (!frames) return false;
  const at = loop ? ((phase % 1 + 1) % 1) * 8 : Math.max(0, Math.min(1, phase));
  const times = [0, .1, .24, .36, .48, .63, .80, 1];
  let frame = loop ? Math.floor(at) : 0;
  if (!loop) while (frame < 6 && at > times[frame + 1]!) frame++;
  const fraction = loop ? at - frame : (at - times[frame]!) / (times[frame + 1]! - times[frame]!);
  // Crossfade across most of the cell so painted poses don't hard-hold then pop.
  const ease = Math.max(0, Math.min(1, fraction));
  const blend = ease * ease * (3 - 2 * ease);
  blendPoses(ctx, height, blend, (c, next) => {
    const n = next ? loop ? (frame + 1) % 8 : frame + 1 : frame;
    const frameImage = frames[row * 8 + n]!;
    c.drawImage(frameImage, -frameImage.width * scale / 2, -frameImage.height * scale, frameImage.width * scale, frameImage.height * scale);
  });
  return true;
}

export function backgroundArt(ctx: CanvasRenderingContext2D, biome?: number): boolean {
  const modern = images.get('landscapes');
  if (modern) {
    const tile = biome === undefined ? 0 : biome <= 1 ? 1 : biome;
    ctx.drawImage(modern, tile % 2 * modern.width / 2, Math.floor(tile / 2) * modern.height / 2, modern.width / 2, modern.height / 2, 0, 0, 960, 600);
    return true;
  }
  const img = images.get(biome === undefined ? 'waterworks' : 'biomes');
  if (!img) return false;
  if (biome === undefined) ctx.drawImage(img, 0, 0, 960, 600);
  else ctx.drawImage(img, (biome % 2) * img.width / 2, Math.floor(biome / 2) * img.height / 2, img.width / 2, img.height / 2, 0, 0, 960, 600);
  return true;
}

function crop(sheet: Sheet, index: number): [number, number, number, number] | null {
  const key = `${sheet}:${index}`;
  const old = crops.get(key);
  if (old) return old;
  const img = images.get(sheet);
  if (!img) return null;
  // Rows follow the actual delivered illustrations, not the requested pixel size.
  const rows = sheet === 'recruits' ? [0, 0.485, 1] : sheet === 'units' ? [0, 0.268, 0.504, 0.772, 1] : sheet === 'towersAdvanced' ? [0, 0.34, 0.675, 1] : sheet === 'unitsAdvanced' ? [0, 0.34, 0.659, 1] : [0, 0.337, 0.659, 1];
  const col = index % 4, row = Math.floor(index / 4);
  const cols = sheet === 'recruits' ? [0, .27, .5, .75, 1] : [0, .25, .5, .75, 1];
  const x = Math.round(cols[col]! * img.width), y = Math.round(rows[row]! * img.height);
  const w = Math.round(cols[col + 1]! * img.width) - x;
  const h = Math.round(rows[row + 1]! * img.height) - y;
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  const ctx = c.getContext('2d')!;
  ctx.drawImage(img, x, y, w, h, 0, 0, w, h);
  const pixels = ctx.getImageData(0, 0, w, h).data;
  let l = w, r = 0, t = h, b = 0;
  for (let py = 0; py < h; py++) for (let px = 0; px < w; px++) {
    if (pixels[(py * w + px) * 4 + 3]! < 80) continue;
    l = Math.min(l, px); r = Math.max(r, px); t = Math.min(t, py); b = Math.max(b, py);
  }
  const result: [number, number, number, number] = [x + l, y + t, Math.max(1, r - l + 1), Math.max(1, b - t + 1)];
  crops.set(key, result);
  return result;
}

/** Draw with a bottom-center anchor and a fixed height; preserve the painted proportions. */
export function paintedSprite(ctx: CanvasRenderingContext2D, sheet: Exclude<Sheet, 'waterworks' | 'biomes' | 'landscapes'>, index: number, x: number, y: number, height: number, widthLimit = height * 1.3): boolean {
  if (sheet === 'units' && index >= 16) { sheet = 'unitsAdvanced'; index -= 16; }
  if (sheet === 'towers' && index >= 12) { sheet = 'towersAdvanced'; index -= 12; }
  const img = images.get(sheet), c = crop(sheet, index);
  if (!img || !c) return false;
  const scale = Math.min(height / c[3], widthLimit / c[2]);
  const w = c[2] * scale, h = c[3] * scale;
  ctx.drawImage(img, ...c, x - w / 2, y - h, w, h);
  return true;
}

export const ENEMY_ART: Partial<Record<EnemyId, number>> = {
  drip: 4, sludge: 5, scaleCrab: 6, steamWisp: 7, pressureSpike: 8, airlock: 9,
  frozenMain: 10, rogueBoiler: 11, hardWaterGnat: 12, sedimentBoulder: 13,
  codeViolation: 14, condensateMoth: 15,
  glycolGolem: 16, zincWhisker: 17, biofilm: 18, waterHammer: 19,
  limeScale: 20, vacuumBreak: 21, pexKink: 22, flangeGremlin: 23,
};
export const TOWER_ART: Partial<Record<TowerId, number>> = {
  torch: 0, washer: 1, barricade: 2, vent: 3, radiant: 4, expansion: 5,
  pipeSnake: 6, descaler: 7, boiler: 8, hammerDrill: 9, glycol: 10, sump: 11,
  backflow: 12, circulator: 13, prv: 14, camera: 15, manifold: 16, mixingValve: 17,
  airSeparator: 18, thermostat: 19, heatExchanger: 20, dirtSep: 21, steamTrap: 22, zoneValve: 23,
};

export type ActorSheet = 'units' | 'unitsAdvanced' | 'recruits';
/** A reusable cutout in normalized coordinates; pivots are resolved by the animation rig. */
export function actorArt(sheet: ActorSheet, index: number, height: number): { width: number; part(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number): void } | null {
  if (sheet === 'units' && index >= 16) { sheet = 'unitsAdvanced'; index -= 16; }
  const img = images.get(sheet), c = crop(sheet, index);
  if (!img || !c) return null;
  const width = height * c[2] / c[3];
  return { width, part(ctx, x, y, w, h) {
    ctx.drawImage(img, c[0] + x * c[2], c[1] + y * c[3], w * c[2], h * c[3], (x - 0.5) * width, (y - 1) * height, w * width, h * height);
  } };
}

/** Deform a painted sprite as a continuous triangular mesh, retaining every painted pixel. */
export function meshActor(ctx: CanvasRenderingContext2D, sheet: ActorSheet, index: number, height: number, warp: (x: number, y: number) => [number, number]): boolean {
  if (sheet === 'units' && index >= 16) { sheet = 'unitsAdvanced'; index -= 16; }
  const img = images.get(sheet), rect = crop(sheet, index); if (!img || !rect) return false;
  const w=height*rect[2]/rect[3], h=height, cols=6, rows=10;
  const vertices: {sx:number;sy:number;x:number;y:number}[][]=[];
  for(let j=0;j<=rows;j++) { const row=[];for(let i=0;i<=cols;i++){const x=i/cols,y=j/rows,p=warp(x,y);row.push({sx:x*w,sy:y*h,x:(p[0]-.5)*w,y:(p[1]-1)*h});}vertices.push(row); }
  type V=typeof vertices[number][number];
  const tri=(a:V,b:V,c:V)=>{
    const d=(b.sx-a.sx)*(c.sy-a.sy)-(c.sx-a.sx)*(b.sy-a.sy);if(Math.abs(d)<.0001)return;
    const aa=((b.x-a.x)*(c.sy-a.sy)-(c.x-a.x)*(b.sy-a.sy))/d;
    const bb=((b.y-a.y)*(c.sy-a.sy)-(c.y-a.y)*(b.sy-a.sy))/d;
    const cc=((c.x-a.x)*(b.sx-a.sx)-(b.x-a.x)*(c.sx-a.sx))/d;
    const dd=((c.y-a.y)*(b.sx-a.sx)-(b.y-a.y)*(c.sx-a.sx))/d;
    ctx.save();ctx.beginPath();
    const cx=(a.x+b.x+c.x)/3,cy=(a.y+b.y+c.y)/3;
    for(const [i,v]of[a,b,c].entries()){const dx=v.x-cx,dy=v.y-cy,len=Math.hypot(dx,dy)||1;const x=v.x+dx/len*.35,y=v.y+dy/len*.35;if(i===0)ctx.moveTo(x,y);else ctx.lineTo(x,y);}ctx.closePath();ctx.clip();
    ctx.transform(aa,bb,cc,dd,a.x-aa*a.sx-cc*a.sy,a.y-bb*a.sx-dd*a.sy);
    ctx.drawImage(img,...rect,0,0,w,h);ctx.restore();
  };
  for(let j=0;j<rows;j++)for(let i=0;i<cols;i++){const a=vertices[j]![i]!,b=vertices[j]![i+1]!,c=vertices[j+1]![i]!,d=vertices[j+1]![i+1]!;tri(a,b,c);tri(b,d,c);}
  return true;
}


/** Eight fully illustrated attack poses, eased between wind-up, contact, and recovery. */
export function attackSprite(ctx: CanvasRenderingContext2D, row: number, phase: number, height: number, apprenticeVariant = 0): boolean {
  const img=images.get(apprenticeVariant > 0 ? 'apprenticeAttacks' : 'crewAttacks');if(!img)return false;
  if(apprenticeVariant>0)row=apprenticeVariant-1;
  const rows=apprenticeVariant>0?[0,1/3,2/3,1]:[0,.213,.406,.608,.794,1];const y=rows[row]!*img.height,h=(rows[row+1]!-rows[row]!)*img.height,w=img.width/8;
  const times=[0,.1,.24,.36,.48,.63,.80,1];let frame=0;while(frame<6&&phase>times[frame+1]!)frame++;
  const fraction=Math.max(0,Math.min(1,(phase-times[frame]!)/(times[frame+1]!-times[frame]!)));
  const blend=fraction*fraction*(3-2*fraction),scale=height/h;
  blendPoses(ctx,height,blend,(ctx,next)=>{
    const n=frame+(next?1:0);ctx.save();
    const band=apprenticeVariant>0?[.16,.64]:row===0||row===4?[.43,.76]:[.14,.46];
    if(n===5){ctx.beginPath();ctx.rect(-w/2*scale,-height,w*scale,height);ctx.rect(-w/2*scale,-height+band[0]!*height,55*scale,(band[1]!-band[0]!)*height);ctx.clip('evenodd');}
    ctx.drawImage(img,n*w,y,w,h,-w/2*scale,-height,w*scale,height);ctx.restore();
    if(n===4){ctx.save();ctx.drawImage(img,(n+1)*w,y+band[0]!*h,60,(band[1]!-band[0]!)*h,w/2*scale,-height+band[0]!*height,60*scale,(band[1]!-band[0]!)*height);ctx.restore();}
  });return true;
}

export function walkSprite(ctx: CanvasRenderingContext2D, row: number, phase: number, height: number): boolean {
  const img=images.get('crewWalk');if(!img)return false;
  const w=img.width/8,h=img.height/4,scale=height/h;
  const at=((phase/(Math.PI*2)%1)+1)%1*8,frame=Math.floor(at),t=at-frame,blend=t*t*(3-2*t);
  blendPoses(ctx,height,blend,(c,next)=>{const n=next?(frame+1)%8:frame;c.drawImage(img,n*w,row*h,w,h,-w/2*scale,-height,w*scale,height);});
  return true;
}
