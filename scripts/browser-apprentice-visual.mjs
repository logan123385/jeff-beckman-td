/** Funded renderer fixtures for all towers and the apprentice squad.
 * Use the Vite development server in an isolated agent-browser profile.
 * node scripts/browser-apprentice-visual.mjs <CDP port> <output directory>
 */
import assert from 'node:assert/strict';
import { mkdirSync, writeFileSync } from 'node:fs';
const port = Number(process.argv[2]), output = process.argv[3] ?? '/tmp/jeff-visual';
assert(port > 0); mkdirSync(output, { recursive: true });
const tabs = await (await fetch(`http://127.0.0.1:${port}/json/list`)).json();
const tab = tabs.find(t => t.type === 'page' && t.url.startsWith('http://127.0.0.1:5176'));
assert(tab, 'Use an isolated browser on the Vite dev server, port 5176.');
const ws = new WebSocket(tab.webSocketDebuggerUrl), pending = new Map(), errors = [];
let id = 0;
await new Promise(r => ws.addEventListener('open', r, { once: true }));
ws.addEventListener('message', e => {
  const m = JSON.parse(e.data);
  if (m.method === 'Runtime.exceptionThrown') errors.push(m.params.exceptionDetails.text);
  if (!m.id) return;
  const p = pending.get(m.id); pending.delete(m.id);
  if (m.error) p.reject(new Error(m.error.message)); else p.resolve(m.result);
});
const send = (method, params = {}) => new Promise((resolve, reject) => { pending.set(++id, { resolve, reject }); ws.send(JSON.stringify({ id, method, params })); });
const read = async expression => {
  const r = await send('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true });
  if (r.exceptionDetails) throw new Error(r.exceptionDetails.exception?.description ?? r.exceptionDetails.text);
  return r.result.value;
};
const screenshot = async name => { const { data } = await send('Page.captureScreenshot', { format: 'png' }); writeFileSync(`${output}/${name}.png`, Buffer.from(data, 'base64')); };
try {
  await send('Runtime.enable'); await send('Page.enable'); await send('Network.enable'); await send('Network.setCacheDisabled',{cacheDisabled:true});
  await send('Page.reload');
  for(let i=0;i<120;i++){if(await read(`!!document.querySelector('.adventure-title')`))break;await new Promise(r=>setTimeout(r,200));}
  await send('Emulation.setDeviceMetricsOverride',{width:1440,height:1000,deviceScaleFactor:1,mobile:false});
  const setup=await read(`(async()=>{
    const [{Game},{Renderer},{CRAWLSPACE},{TOWERS,TOWER_ORDER},{DIFFICULTIES},{neutralModifiers},art,paint,{damageFriendly}] = await Promise.all([
      import('/src/sim/game.ts'),import('/src/render/renderer.ts'),import('/src/data/maps/crawlspace.ts'),import('/src/data/towers.ts'),import('/src/data/difficulty.ts'),import('/src/data/skills.ts'),import('/src/render/art.ts'),import('/src/render/paintedActors.ts'),import('/src/sim/friendlies.ts')]);
    await art.preloadArt();const canvas=document.createElement('canvas');canvas.width=1440;canvas.height=960;canvas.style.cssText='width:100%;max-width:1440px;display:block;margin:auto';
    const caption=document.createElement('p');caption.style.cssText='text-align:center;color:#dbc89a;font:14px system-ui';
    const host=document.createElement('main');host.append(caption,canvas);document.body.replaceChildren(host);
    const ctx=canvas.getContext('2d');
    const map={...CRAWLSPACE,allowedTowers:TOWER_ORDER,startMoney:100000,slots:TOWER_ORDER.map((_,i)=>({x:120+i%6*240,y:155+Math.floor(i/6)*225}))};
    const g=new Game(map,{difficulty:DIFFICULTIES.apprentice,mods:neutralModifiers(),manualStart:true});
    TOWER_ORDER.forEach((id,i)=>{g.placeTower(i,id);const t=g.towers.at(-1);t.build=0;});
    const board=time=>{ctx.fillStyle='#132b34';ctx.fillRect(0,0,canvas.width,canvas.height);g.towers.forEach(t=>{t.drawFacing=Math.sin(time*1.4)*.6;t.recoil=Math.max(0,.28-(time+t.id*.13)%1.8);paint.paintedTower(ctx,t,time);ctx.fillStyle='#e9d5a6';ctx.textAlign='center';ctx.font='16px Georgia';ctx.fillText(t.def.name,t.pos.x,t.pos.y+48);ctx.font='12px system-ui';ctx.fillStyle='#9fb7b4';ctx.fillText(t.def.role,t.pos.x,t.pos.y+68);});};
    const changes=[];
    for(const t of g.towers){const c=document.createElement('canvas');c.width=c.height=200;const q=c.getContext('2d');const old=t.pos;t.pos={x:100,y:140};paint.paintedTower(q,t,0);const a=c.toDataURL();q.clearRect(0,0,200,200);paint.paintedTower(q,t,.8);changes.push({id:t.def.id,animated:a!==c.toDataURL()});t.pos=old;}
    window.apprenticeArt={canvas,caption,ctx,board,art,paint,Game,Renderer,CRAWLSPACE,DIFFICULTIES,neutralModifiers,damageFriendly,g};
    caption.textContent='24 TOWERS / WORKING MECHANISMS / TIER I';board(.3);return changes;
  })()`);
  assert(setup.every(t=>t.animated),'Every tower has a working animated mechanism.');await screenshot('all-24-towers');
  await read(`(()=>{const s=window.apprenticeArt,c=s.ctx;c.fillStyle='#132b34';c.fillRect(0,0,1440,960);s.caption.textContent='FOUR APPRENTICES / IDLE · STRIDE · ANTICIPATION · CONTACT · FOLLOW-THROUGH · RECOVERY';
    for(let row=0;row<4;row++)for(let col=0;col<8;col++){c.save();c.translate(90+col*180,180+row*220);s.art.apprenticeSprite(c,row,154,col*.9,[0,.1,.25,.42,.48,.62,.8,.99][col],col>=3,col>0&&col<3);c.restore();}
  })()`);await screenshot('four-apprentice-motion-sheet');
  await read(`(()=>{const s=window.apprenticeArt;const map={...s.CRAWLSPACE,startMoney:10000,lives:1000};const g=new s.Game(map,{heroId:'jeff',heroBuild:{nodes:['venom:1','venom:2','venom:3','venom:4'],technique:'venom'},difficulty:s.DIFFICULTIES.apprentice,mods:s.neutralModifiers(),manualStart:true});
    g.placeTower(0,'barricade');g.placeTower(1,'washer');g.placeTower(2,'torch');g.towers.forEach(t=>t.build=0);g.deployHero({x:170,y:275});s.game=g;s.renderer=new s.Renderer(s.canvas);s.renderer.resize();s.view={hoverSlot:null,selectedSlot:null,selectedTowerId:null,heroSelected:false,previewTower:null,mouse:null,hoverEnemyId:null,interp:1};
    const rally=g.towers[0].rally;g.setRally(g.towers[0].id,{x:rally.x+60,y:rally.y});
    for(let i=0;i<10;i++){const e=g.spawnEnemy(i%3===0?'sludge':'drip',0,40+i*19);e.hp=e.maxHp=150;e.pos=g.paths[0].pointAt(e.progress);e.prev={...e.pos};}
    s.caption.textContent='APPRENTICE SQUAD / REAL SIMULATION / CONTROLLED VISUAL FIXTURE';s.frames=0;s.costs=[];
    const chunks=[];s.recorder=new MediaRecorder(s.canvas.captureStream(30),{mimeType:'video/webm',videoBitsPerSecond:6000000});s.recorder.ondataavailable=e=>chunks.push(e.data);s.video=new Promise(resolve=>s.recorder.onstop=()=>{const r=new FileReader();r.onload=()=>resolve(r.result);r.readAsDataURL(new Blob(chunks,{type:'video/webm'}));});s.recorder.start();s.running=true;let last=performance.now(),acc=0;
    const tick=now=>{if(!s.running)return;acc+=Math.min(.1,(now-last)/1000);last=now;while(acc>=1/60){g.update(1/60);acc-=1/60;s.frames++;if(s.frames===180){const e=g.enemies.find(e=>!e.dead);g.useAbility(4,{pos:e.pos,enemyId:e.id});}if(s.frames===240)s.damageFriendly(g,g.friendlies[0],9999);}const at=performance.now();s.renderer.draw(g,s.view);s.costs.push(performance.now()-at);requestAnimationFrame(tick);};requestAnimationFrame(tick);
  })()`);
  await new Promise(r=>setTimeout(r,3500));await screenshot('apprentice-combat');
  await new Promise(r=>setTimeout(r,11000));
  const report=await read(`(async()=>{const s=window.apprenticeArt;s.running=false;s.recorder.stop();s.renderer.draw(s.game,s.view);const a=s.canvas.toDataURL();s.renderer.draw(s.game,s.view);const pixelsStable=a===s.canvas.toDataURL();const sorted=s.costs.slice(20).sort((a,b)=>a-b);return {frames:s.frames,pixelsStable,friendlies:s.game.friendlies.map(f=>({slot:f.slot,hp:f.hp,respawn:f.respawn})),p95:sorted[Math.floor(sorted.length*.95)],video:await s.video};})()`);
  writeFileSync(`${output}/apprentice-motion.webm`,Buffer.from(report.video.split(',')[1],'base64'));delete report.video;
  assert(report.pixelsStable);assert.deepEqual(errors,[]);await screenshot('apprentice-recovery');
  writeFileSync(`${output}/visual-report.json`,JSON.stringify({allTowers:setup,...report,errors},null,2));console.log(JSON.stringify({all24Animated:setup.every(t=>t.animated),...report,errors}));
} finally {ws.close();}
