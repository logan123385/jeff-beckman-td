/** Isolated renderer acceptance, deliberately using funded combat fixtures, not campaign balance evidence.
 * Open the Vite dev server in a separate agent-browser session, then:
 * node scripts/browser-visual-check.mjs <CDP port> /tmp/jeff-visual
 * The normal production playthrough is scripts/browser-playtest.mjs.
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
  await send('Runtime.enable'); await send('Page.enable');
  await send('Page.reload');
  let ready=false;
  for(let i=0;i<150;i++){
    if(await read(`!!document.querySelector('.adventure-title')`)){ready=true;break;}
    await new Promise(r=>setTimeout(r,200));
  }
  assert(ready,'Wait for asset preparation and application startup before replacing the fixture host.');
  await send('Emulation.setDeviceMetricsOverride', { width: 1280, height: 850, deviceScaleFactor: 1, mobile: false });
  const setup = await read(`(async () => {
    const [{ Game }, { Renderer }, { MAPS, SERVICE_CALL }, { DIFFICULTIES }, { neutralModifiers }, art, { HEROES }, { drawNewHero }, { paintedJeff }, { monster }, { ENEMY_ART }, { ENEMIES }] = await Promise.all([
      import('/src/sim/game.ts'), import('/src/render/renderer.ts'), import('/src/data/maps/index.ts'), import('/src/data/difficulty.ts'), import('/src/data/modifiers.ts'), import('/src/render/art.ts'), import('/src/data/heroes.ts'), import('/src/render/heroActors.ts'), import('/src/render/paintedActors.ts'), import('/src/render/animation.ts'), import('/src/render/art.ts'), import('/src/data/enemies.ts')]);
    await art.preloadArt();
    const canvas = document.createElement('canvas'); canvas.style.cssText='width:1120px;height:700px;max-width:100%;border:1px solid #d1b987;border-radius:6px';
    const caption=document.createElement('p'); caption.style.cssText='font:13px system-ui;letter-spacing:2px;color:#dfc496;margin:20px 0';
    const host=document.createElement('main'); host.style.cssText='padding:20px;text-align:center';host.append(caption,canvas);document.body.replaceChildren(host);
    const view={hoverSlot:null,selectedSlot:null,selectedTowerId:null,heroSelected:false,previewTower:null,mouse:null,hoverEnemyId:null,interp:1};
    const state = { canvas, caption, host, view, art, HEROES, drawNewHero, paintedJeff, monster, ENEMY_ART, ENEMIES, game:null, renderer:null, costs:[], running:false, frames:0 };
    state.create = (mapId,heroId='becbec') => {
      const source=[...MAPS,SERVICE_CALL].find(m=>m.id===mapId);
      const map={...source,startMoney:100000,lives:1000,allowedTowers:['torch','washer','hammerDrill','glycol','descaler','boiler']};
      const game=new Game(map,{difficulty:DIFFICULTIES.apprentice,mods:neutralModifiers(),seed:731,manualStart:true,heroId});
      const kinds=['torch','washer','hammerDrill','glycol','descaler','boiler'];
      map.slots.forEach((_,i)=>{ if(i%2===1){game.placeTower(i,kinds[Math.floor(i/2)%kinds.length]);const t=game.towers.at(-1);game.upgradeTower(t.id);t.build=0;} });
      game.deployHero(map.jeffStart);game.hero.hp=game.hero.maxHp=9999;
      game.time=2;state.game=game;state.renderer=new Renderer(canvas);state.renderer.resize();state.costs=[];state.frames=0;
      caption.textContent=source.name.toUpperCase()+' / '+HEROES[heroId].name.toUpperCase()+' / CONTROLLED VISUAL FIXTURE';
      state.populate();state.renderer.draw(game,view);
    };
    state.populate = () => {
      const game=state.game, kinds=['sludge','scaleCrab','pressureSpike','condensateMoth','glycolGolem','waterHammer','drip','biofilm'];
      for(let i=0;i<14;i++) {const e=game.spawnEnemy(kinds[i%kinds.length],i%game.paths.length,80+i*37);e.hp=e.maxHp=Math.max(e.hp,220);e.pos=game.paths[e.pathIdx].pointAt(e.progress);e.prev={...e.pos};}
    };
    state.step = dt => {
      const g=state.game;
      if(state.frames%150===0&&g.enemies.filter(e=>!e.dead&&!e.escaped).length<40)state.populate();
      if(state.frames%90===0)for(let s=0;s<5;s++)g.useAbility(s,{pos:g.enemies.find(e=>!e.dead)?.pos??g.hero.pos,enemyId:g.enemies.find(e=>!e.dead)?.id});
      g.update(dt);state.frames++;
      const start=performance.now();state.renderer.draw(g,view);state.costs.push(performance.now()-start);
    };
    window.visualFixture=state;
    const pixel=document.createElement('canvas');pixel.width=pixel.height=8;const c=pixel.getContext('2d');c.translate(4,4);
    art.blendPoses(c,4,.5,(q,next)=>{q.fillStyle=next?'#0000ff':'#ff0000';q.fillRect(-2,-2,4,4);});
    const mixed=[...c.getImageData(4,3,1,1).data];
    return {mixed,landscapes:art.artReady('landscapes')};
  })()`);
  assert.equal(setup.mixed[3], 255, 'Crossfading opaque poses must retain full opacity.');
  assert(Math.abs(setup.mixed[0] - setup.mixed[2]) <= 1); assert(setup.landscapes);
  const mapChecks = [];
  for (const [map, hero] of [['crawlspace','jeff'],['heatPlant','bob'],['snowmelt','mike'],['liftStation','chris'],['serviceCall','becbec'],['crawlspace','cbj'],['liftStation','doni'],['heatPlant','jayjay']]) {
    const stats = await read(`(() => {
      const s=window.visualFixture;s.create('${map}','${hero}');
      for(let i=0;i<130;i++)s.step(1/60);
      const before=JSON.stringify({hero:s.game.hero,enemies:s.game.enemies,towers:s.game.towers,projectiles:s.game.projectiles,money:s.game.money});
      s.renderer.draw(s.game,s.view);s.renderer.draw(s.game,s.view);
      const frozen=s.canvas.toDataURL();for(let i=0;i<5;i++)s.renderer.draw(s.game,s.view);
      const stable=frozen===s.canvas.toDataURL();
      const after=JSON.stringify({hero:s.game.hero,enemies:s.game.enemies,towers:s.game.towers,projectiles:s.game.projectiles,money:s.game.money});
      const sorted=s.costs.slice(10).sort((a,b)=>a-b);
      return {map:'${map}',hero:'${hero}',pausedPixelsStable:stable,simulationUnchanged:before===after,enemies:s.game.enemies.length,projectiles:s.game.projectiles.length,renderMedianMs:sorted[Math.floor(sorted.length*.5)],renderP95Ms:sorted[Math.floor(sorted.length*.95)]};
    })()`);
    assert(stats.pausedPixelsStable, `${map}: pausing must freeze particles, projectiles and camera.`);
    assert(stats.simulationUnchanged, `${map}: drawing must not mutate game state.`);
    mapChecks.push(stats); await screenshot(`${map}-${hero}`); console.log(JSON.stringify(stats));
  }
  const materials = await read(`(async()=>{
    const {Spectacle,impact}=await import('/src/render/spectacle.ts');
    const s=window.visualFixture,c=s.canvas.getContext('2d');s.canvas.width=960;s.canvas.height=600;
    const definitions=[['PRESSURE / WATER','washer','water','#4ebbd4'],['COMBUSTION / FIRE','torch','fire','#ff8f43'],['KINETIC / METAL','hammerDrill','physical','#d7bb83'],['CRYSTAL / FROST','glycol','water','#83d8ee'],['CORROSION / ACID','descaler','water','#a6cf72'],['RADIANT / HEAT','boiler','heat','#edc07c']];
    const systems=definitions.map(()=>new Spectacle());
    for(let frame=0;frame<24;frame++){
      c.fillStyle='#112632';c.fillRect(0,0,960,600);
      definitions.forEach(([label,source,damageType,color],i)=>{
        c.save();c.translate(i%3*320,Math.floor(i/3)*280+15);
        const g=c.createRadialGradient(165,145,10,165,145,170);g.addColorStop(0,'#2a414b');g.addColorStop(1,'#112632');c.fillStyle=g;c.fillRect(8,8,304,265);
        c.strokeStyle='#bfa67340';c.strokeRect(8,8,304,265);c.fillStyle='#dec99f';c.font='11px system-ui';c.textAlign='center';c.fillText(label,160,45);
        const pos={x:50+frame*5.2,y:170-frame*1.5};
        const p={id:i,pos,prev:{...pos},from:{x:50,y:170},lastTargetPos:{x:275,y:105},source,damageType,splash:35,color};
        systems[i].projectiles(c,{projectiles:[p]},frame/60,1);
        impact(c,{kind:'splash',pos:{x:250,y:200},radius:32,color,ttl:.3,max:.5},frame/60);
        c.fillStyle='#90aaa9';c.font='10px system-ui';c.fillText('CURVED FLIGHT  ·  MATERIAL IMPACT',160,254);c.restore();
      });
    }
    s.caption.textContent='PROJECTILE MATERIALS / RENDERER ART BOARD';
    return definitions.map(d=>d[0]);
  })()`);
  assert.equal(materials.length, 6); await screenshot('projectile-materials');
  // Actual real-time movement, rather than just favorable still frames.
  await read(`(() => {
    const s=window.visualFixture;s.create('heatPlant','becbec');s.running=true;let last=performance.now(),acc=0;
    const chunks=[];s.recording=new MediaRecorder(s.canvas.captureStream(30),{mimeType:'video/webm',videoBitsPerSecond:5000000});
    s.recording.ondataavailable=e=>chunks.push(e.data);s.video=new Promise(resolve=>s.recording.onstop=()=>{const r=new FileReader();r.onload=()=>resolve(r.result);r.readAsDataURL(new Blob(chunks,{type:'video/webm'}));});s.recording.start();
    const tick=now=>{if(!s.running)return;acc+=Math.min(.1,(now-last)/1000);last=now;while(acc>=1/60){s.step(1/60);acc-=1/60;}requestAnimationFrame(tick);};requestAnimationFrame(tick);
  })()`);
  await new Promise(r => setTimeout(r, 10000));
  const video = await read(`(async()=>{const s=window.visualFixture;s.running=false;s.recording.stop();return await s.video;})()`);
  writeFileSync(`${output}/combat-motion.webm`, Buffer.from(video.split(',')[1], 'base64'));
  assert.deepEqual(errors, []);
  const motion = await read(`(()=>{const s=window.visualFixture,a=s.costs.slice(60).sort((a,b)=>a-b);return {frames:s.frames,renderMedianMs:a[Math.floor(a.length*.5)],renderP95Ms:a[Math.floor(a.length*.95)],enemies:s.game.enemies.length};})()`);
  // A second clip shows the promoted crew heroes in continuous, real-time motion.
  await read(`(() => {
    const s=window.visualFixture, roster=[['crawlspace','cbj',4],['liftStation','doni',1],['heatPlant','jayjay',4]];
    s.create(roster[0][0],roster[0][1]); s.running=true;let last=performance.now(),acc=0,segment=-1;
    const started=last,chunks=[];
    s.recording=new MediaRecorder(s.canvas.captureStream(30),{mimeType:'video/webm',videoBitsPerSecond:4200000});
    s.recording.ondataavailable=e=>chunks.push(e.data);
    s.video=new Promise(resolve=>s.recording.onstop=async()=>{const blob=new Blob(chunks,{type:'video/webm'});const data=await new Promise(r=>{const reader=new FileReader();reader.onload=()=>r(reader.result);reader.readAsDataURL(blob);});resolve(data);});
    s.recording.start();
    function frame(now){
      const next=Math.min(2,Math.floor((now-started)/5000));
      if(next!==segment){segment=next;s.create(roster[next][0],roster[next][1]);s.game.useAbility(roster[next][2],{pos:{...s.game.hero.pos}});}
      acc+=Math.min(.1,(now-last)/1000);last=now;
      while(acc>=1/60){s.step(1/60);acc-=1/60;}
      if(s.running)requestAnimationFrame(frame);
    }
    requestAnimationFrame(frame);
  })()`);
  await new Promise(r=>setTimeout(r,15000));
  const heroVideo=await read(`(async()=>{const s=window.visualFixture;s.running=false;s.recording.stop();return await s.video;})()`);
  writeFileSync(`${output}/crew-heroes-motion.webm`,Buffer.from(heroVideo.split(',')[1],'base64'));
  assert.deepEqual(errors,[]);
  const report = { pass: true, purpose: 'Funded renderer fixtures; not campaign balance evidence', opaquePoseBlend: setup.mixed, projectileMaterials:materials, maps: mapChecks, realTimeCombat:motion, crewMotion:['CBJ','Doni','Jayjay'], errors };
  writeFileSync(`${output}/report.json`, JSON.stringify(report, null, 2)); console.log(JSON.stringify(report));
} finally { ws.close(); }
