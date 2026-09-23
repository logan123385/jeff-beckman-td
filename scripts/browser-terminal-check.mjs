/** UI release checks. Only target a disposable browser session with a fresh save.
 * node scripts/browser-terminal-check.mjs <CDP port> <output dir> <game URL>
 */
import assert from 'node:assert/strict';
import { mkdirSync, writeFileSync } from 'node:fs';
const [port, output = '/tmp/jeff-release-check', url = 'http://127.0.0.1:5187/'] = process.argv.slice(2);
assert(Number(port) > 0, 'Pass an isolated browser CDP port.');
mkdirSync(output, { recursive: true });
const tabs = await (await fetch(`http://127.0.0.1:${port}/json/list`)).json();
const tab = tabs.find(t => t.type === 'page' && t.url.startsWith(url));
assert(tab, `Open ${url} in an isolated browser first.`);
const ws = new WebSocket(tab.webSocketDebuggerUrl);
await new Promise(resolve => ws.addEventListener('open', resolve, { once: true }));
let seq = 0;
const pending = new Map(), errors = [], checks = [];
ws.addEventListener('message', e => {
  const m = JSON.parse(e.data);
  if (m.method === 'Runtime.exceptionThrown') errors.push(m.params.exceptionDetails.exception?.description ?? m.params.exceptionDetails.text);
  if (!m.id) return;
  const p = pending.get(m.id); pending.delete(m.id);
  m.error ? p.reject(new Error(m.error.message)) : p.resolve(m.result);
});
const send = (method, params = {}) => new Promise((resolve, reject) => {
  const id = ++seq; pending.set(id, { resolve, reject }); ws.send(JSON.stringify({ id, method, params }));
});
const read = async expression => {
  const r = await send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true });
  if (r.exceptionDetails) throw new Error(r.exceptionDetails.exception?.description ?? r.exceptionDetails.text);
  return r.result.value;
};
const delay = ms => new Promise(resolve => setTimeout(resolve, ms));
const visible = selector => read(`(() => {const e=document.querySelector(${JSON.stringify(selector)});return !!e&&!!e.getClientRects().length;})()`);
const wait = async selector => { for (let i = 0; i < 150; i++) { if (await visible(selector)) return; await delay(100); } throw new Error(`Missing ${selector}`); };
const click = async selector => {
  const p = await read(`(() => {const e=document.querySelector(${JSON.stringify(selector)});if(!e||e.disabled)return null;e.scrollIntoView({block:'center'});const r=e.getBoundingClientRect();return {x:r.x+r.width/2,y:r.y+r.height/2};})()`);
  assert(p, `Missing/disabled ${selector}`);
  await send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [p] });
  await send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  await delay(100);
};
const button = async text => {
  const id = `release-${++seq}`;
  assert(await read(`(() => {const e=[...(document.querySelector('.confirmation-overlay')??document).querySelectorAll('button')].find(e=>e.textContent.trim()===${JSON.stringify(text)}&&e.getClientRects().length&&!e.disabled);if(!e)return false;e.setAttribute('data-check',${JSON.stringify(id)});return true;})()`), `No button ${text}`);
  await click(`[data-check="${id}"]`);
};
const key = async key => { await send('Input.dispatchKeyEvent', { type: 'keyDown', key }); await send('Input.dispatchKeyEvent', { type: 'keyUp', key }); await delay(80); };
const viewport = async (width, height) => { await send('Emulation.setDeviceMetricsOverride', { width, height, deviceScaleFactor: 1, mobile: true }); await send('Emulation.setTouchEmulationEnabled', { enabled: true }); await delay(150); };
const screen = async label => {
  const geometry = await read(`({width:innerWidth,scrollWidth:document.documentElement.scrollWidth,headings:[...document.querySelectorAll('h1,h2')].map(e=>e.textContent)})`);
  assert(geometry.scrollWidth <= geometry.width + 1, `${label}: horizontal overflow`);
  checks.push({ label, ...geometry });
};
const shot = async name => { await delay(500); const { data } = await send('Page.captureScreenshot', { format: 'png' }); writeFileSync(`${output}/${name}.png`, Buffer.from(data, 'base64')); };
const save = () => read(`JSON.parse(localStorage.getItem('jbtd-save-v1')||'null')`);
const chooseFile = async (path, raw) => {
  writeFileSync(path, raw);
  const { root } = await send('DOM.getDocument');
  const { nodeId } = await send('DOM.querySelector', { nodeId: root.nodeId, selector: 'input[type=file]' });
  await send('DOM.setFileInputFiles', { nodeId, files: [path] });
  await wait('.confirmation-overlay'); await button('Restore save');
};
try {
  await send('Runtime.enable'); await send('Page.enable');
  await viewport(390,664);
  await send('Page.reload'); await wait('.adventure-title');
  await read(`(async()=>{
    const {App}=await import('/src/ui/app.ts');
    const urls=new Set(['/src/sim/game.ts',...performance.getEntriesByType('resource').map(r=>r.name).filter(name=>name.includes('/src/sim/game.ts'))]);
    for(const url of urls){const {Game}=await import(url);const update=Game.prototype.update;Game.prototype.update=function(dt){window.__game=this;return update.call(this,dt);};}
    const root=document.createElement('div');document.querySelector('#app').replaceWith(root);
    window.__app=new App(root);window.__app.save.reset();window.__app.go({kind:'play',mapId:'crawlspace'});
  })()`);
  await wait('.stage-canvas');
  if(await visible('.coach-skip'))await click('.coach-skip');
  for(let i=0;i<100&&!await read('!!window.__game');i++)await delay(100);
  assert(await read('!!window.__game'),'Simulation started');
  await read(`(()=>{__game.status='won';__game.lives=20;__game.waveIdx=10;__game.completedWaves=10;__game.stats.kills=100;window.dispatchEvent(new PageTransitionEvent('pagehide',{persisted:true}));window.dispatchEvent(new PageTransitionEvent('pagehide',{persisted:true}));})()`);
  const first=await save(); assert(first.jeffXp>0); assert.equal(first.heroJobs.jeff,1);
  await wait('.results'); assert((await read(`document.querySelector('.results').textContent`)).includes('Clean sheet'));
  assert.equal((await save()).jeffXp,first.jeffXp); assert.equal((await save()).inventory.length,1);
  checks.push({label:'pagehide before results banks once and still presents the receipt on return'});
  for (const [w,h] of [[390,664],[320,568],[667,280]]) {
    await viewport(w,h);
    assert(await read(`(() => {const r=document.querySelector('.result-actions').getBoundingClientRect();return r.top>=0&&r.bottom<=innerHeight;})()`),'Result actions stay on screen');
  }
  await viewport(390,664);
  await shot('01-win-receipt');
  await read(`__app.go({kind:'play',mapId:'crawlspace'})`); await delay(100);
  await read(`(()=>{__game.status='won';document.querySelector('.quit-button').click();})()`);
  await wait('.adventure-title');
  assert.equal((await save()).heroJobs.jeff,2); assert.equal((await save()).inventory.length,1);
  checks.push({label:'immediate exit after victory banks XP and does not duplicate the first-clear chest'});
  await read(`__app.go({kind:'play',mapId:'crawlspace'})`); await delay(100);
  await read(`(()=>{__game.status='lost';__game.waveIdx=2;__game.completedWaves=1;__game.stats.kills=10;__game.lives=0;})()`);
  await wait('.results'); const lostSave=await save();assert(lostSave.servicePoints>first.servicePoints);
  const retry=await read(`(() => {const b=[...document.querySelectorAll('.results button')].find(b=>/Retry|callback/i.test(b.textContent));b?.click();return !!b;})()`);
  assert(retry); await wait('.loadout'); await button('Take the call'); await wait('.stage-canvas'); await delay(150); assert.equal(await visible('.results'),false);
  assert.equal(await read(`__game.status`),'playing');
  checks.push({label:'loss rewards bank, retry starts a clean match'});
  await read(`(()=>{Object.defineProperty(document,'hidden',{configurable:true,value:true});document.dispatchEvent(new Event('visibilitychange'));delete document.hidden;})()`);
  assert(await visible('.pause-overlay:not(.hidden)'));
  checks.push({label:'switching away pauses an active battle'});
  await read(`(()=>{for(const map of ['crawlspace','boilerRoom','radiantFloor','municipalMain'])__app.save.recordClear(map,'apprentice',3);__app.go({kind:'play',mapId:'serviceCall'});})()`);
  await wait('.stage-canvas'); await delay(100); await click('.call'); await click('.pause-button');
  const beforeEndless=await save(); await click('.pause-clock'); await wait('.results');
  assert.equal((await save()).heroJobs.jeff,beforeEndless.heroJobs.jeff);
  assert.equal((await save()).jeffXp,beforeEndless.jeffXp);
  checks.push({label:'clock-out from pause opens results and idle exits grant no XP or hero unlocks'});
  await shot('02-clock-out');
  await read(`__app.dispose()`); await delay(100);
  assert.equal(await visible('.stage-canvas'),false);
  assert.deepEqual(errors,[]);
  writeFileSync(`${output}/report.json`,JSON.stringify({pass:true,checks,errors,limitations:'Explicit terminal-state fixtures test lifecycle only; campaign balance is checked separately with ordinary resources.'},null,2));
  console.log(JSON.stringify({pass:true,checks:checks.length,errors}));
} catch(error) {
  await shot('failure');writeFileSync(`${output}/failure.json`,JSON.stringify({message:error.message,checks,errors},null,2));console.error(error);process.exitCode=1;
} finally {ws.close();}
