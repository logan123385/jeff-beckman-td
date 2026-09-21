/** Isolated browser acceptance: fresh store/save flow and an ordinary played loss.
 * Use --fresh only in a disposable agent-browser profile; it clears that profile storage.
 * node scripts/browser-careers-check.mjs <CDP port> <output directory> [--fresh]
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import assert from 'node:assert/strict';

const port = Number(process.argv[2]);
assert(port > 0, 'Pass the CDP port of an isolated agent-browser session.');
const output = process.argv[3] ?? '/tmp/jeff-playtest';
mkdirSync(output, { recursive: true });
const tabs = await (await fetch(`http://127.0.0.1:${port}/json/list`)).json();
const tab = tabs.find(t => t.type === 'page' && t.url.startsWith('http://127.0.0.1:5177'));
assert(tab, 'Open the production preview on port 5177 in the isolated browser first.');
const ws = new WebSocket(tab.webSocketDebuggerUrl);
await new Promise(resolve => ws.addEventListener('open', resolve, { once: true }));
let seq = 0;
const pending = new Map(), errors = [];
ws.addEventListener('message', event => {
  const msg = JSON.parse(event.data);
  if (msg.method === 'Runtime.exceptionThrown') errors.push(msg.params.exceptionDetails.text);
  if (!msg.id) return;
  const task = pending.get(msg.id); pending.delete(msg.id);
  if (msg.error) task.reject(new Error(msg.error.message)); else task.resolve(msg.result);
});
const send = (method, params = {}) => new Promise((resolve, reject) => {
  const id = ++seq; pending.set(id, { resolve, reject }); ws.send(JSON.stringify({ id, method, params }));
});
const read = async expression => {
  const r = await send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true });
  if (r.exceptionDetails) throw new Error(r.exceptionDetails.text);
  return r.result.value;
};
const delay = ms => new Promise(resolve => setTimeout(resolve, ms));
const waitFor = async selector => {
  for (let i = 0; i < 100; i++) {
    if (await read(`!!document.querySelector(${JSON.stringify(selector)})`)) return;
    await delay(200);
  }
  throw new Error(`Timed out waiting for ${selector}`);
};
const pointer = async (x, y, button = 'left') => {
  await send('Input.dispatchMouseEvent', { type: 'mouseMoved', x, y });
  await send('Input.dispatchMouseEvent', { type: 'mousePressed', x, y, button, clickCount: 1 });
  await send('Input.dispatchMouseEvent', { type: 'mouseReleased', x, y, button, clickCount: 1 });
  await delay(90);
};
const click = async selector => {
  const box = await read(`(() => { const el = document.querySelector(${JSON.stringify(selector)}); if (!el || el.disabled) return null; el.scrollIntoView({block:'center'}); const r=el.getBoundingClientRect(); return { x:r.x+r.width/2, y:r.y+r.height/2 }; })()`);
  assert(box, `Missing or disabled: ${selector}`); await pointer(box.x, box.y);
};
const textButton = async name => {
  const selector = await read(`(() => { const buttons=[...document.querySelectorAll('button')]; const i=buttons.findIndex(b => b.textContent.trim()===${JSON.stringify(name)} && !b.disabled); if(i<0)return null; buttons[i].setAttribute('data-playtest-button','yes'); return '[data-playtest-button="yes"]'; })()`);
  assert(selector, `Missing button: ${name}`); await click(selector); await read(`document.querySelector('[data-playtest-button]')?.removeAttribute('data-playtest-button')`);
};
const press = async (key, modifiers = 0) => {
  const code = ['Escape','Tab'].includes(key) ? key : key === ' ' ? 'Space' : /^[0-9]$/.test(key) ? `Digit${key}` : `Key${key.toUpperCase()}`;
  const windowsVirtualKeyCode = key === 'Escape' ? 27 : key === 'Tab' ? 9 : key.toUpperCase().charCodeAt(0);
  await send('Input.dispatchKeyEvent', { type: 'keyDown', key, code, windowsVirtualKeyCode, modifiers });
  await send('Input.dispatchKeyEvent', { type: 'keyUp', key, code, windowsVirtualKeyCode, modifiers });
  await delay(70);
};
const world = async (x, y, button = 'left') => {
  // A tower menu can cover a neighboring pad. Close it through its normal control first.
  if (await read(`!!document.querySelector('.kr-wheel:not(.hidden) .kr-x, .kr-wheel:not(.hidden) [aria-label="Close specialist training"]')`)) await click('.kr-wheel:not(.hidden) .kr-x, .kr-wheel:not(.hidden) [aria-label="Close specialist training"]');
  const r = await read(`(() => {const r=document.querySelector('.stage-canvas').getBoundingClientRect();return {x:r.x,y:r.y,w:r.width,h:r.height};})()`);
  await pointer(r.x + x / 960 * r.w, r.y + y / 600 * r.h, button);
};
const shot = async name => {
  const { data } = await send('Page.captureScreenshot', { format: 'png' });
  writeFileSync(`${output}/${name}.png`, Buffer.from(data, 'base64'));
};
const stats = () => read(`({cash:Number(document.querySelector('.medal.coin b')?.textContent),lives:Number(document.querySelector('.medal.heart b')?.textContent),wave:document.querySelector('.medal.wave b')?.textContent,result:document.querySelector('.results')?.innerText})`);
const until = async (expression, label, seconds = 25) => {
  const deadline = Date.now() + seconds * 1000;
  while (Date.now() < deadline) { if (await read(expression)) return; await delay(100); }
  throw new Error(`Timed out: ${label}`);
};
try {
  await send('Runtime.enable'); await send('Page.enable'); await send('Network.enable'); await send('Network.setCacheDisabled', {cacheDisabled:true});
  if(process.argv.includes('--fresh')) await read(`localStorage.clear()`);
  await send('Page.reload'); await waitFor('.adventure-title');
  await send('Emulation.setDeviceMetricsOverride', {width:1440,height:960,deviceScaleFactor:1,mobile:false});
  await textButton(await read(`document.querySelector('.adventure-copy .btn.primary').textContent`));
  await click('.supply-link'); await waitFor('.store-grid');
  assert.equal(await read(`document.querySelectorAll('[data-store-tower]').length`),24);
  assert.equal(await read(`document.querySelector('.service-points').textContent`),'100 service points');
  await shot('01-new-store');
  await click('[data-buy-tower="vent"]');
  assert.equal(await read(`document.querySelector('.service-points').textContent`),'20 service points');
  assert(await read(`document.querySelector('[data-buy-tower="vent"]').disabled`));
  await textButton('← Van'); await textButton('Hero builds8 heroes');
  await waitFor('.build-roster');
  await click('[data-build-node="engineer:1"]');
  assert(await read(`document.querySelector('[data-build-node="engineer:2"]').disabled`));
  await click('[data-build-hero="doni"]'); await click('[data-build-node="venom:1"]');
  await shot('02-doni-first-build');
  await textButton('Take Doni');
  await send('Page.reload'); await waitFor('.adventure-title');
  await textButton(await read(`document.querySelector('.adventure-copy .btn.primary').textContent`));
  const saved = await read(`JSON.parse(localStorage.getItem('jbtd-save-v1'))`);
  assert.equal(saved.servicePoints,20); assert(saved.ownedTowers.includes('vent'));
  assert.equal(saved.selectedHero,'doni'); assert.deepEqual(saved.heroBuilds.jeff.nodes,['engineer:1']); assert.deepEqual(saved.heroBuilds.doni.nodes,['venom:1']);
  await textButton('Apprentice'); await click('[aria-label^="1. Crawlspace"]'); await click('.campaign-briefing .map-foot .btn.primary');
  assert(await read(`document.querySelector('.loadout').textContent.includes('Vent Stack')`));
  await shot('03-purchased-tool-first-map');
  await textButton('Take the call');
  if(await read(`!!document.querySelector('.coach-skip')`))await textButton('Skip tutorial');
  // An ordinary failed run: use the deployed hero and starter cash, then let leaks through.
  await click('[data-tower="torch"]'); await world(225,250);
  await press('j'); await world(170,275); await press(' ');
  for(let i=0;i<2;i++) await press('f');
  const deadline=Date.now()+180000;
  while(Date.now()<deadline&&!await read(`!!document.querySelector('.results')`)) {
    if(await read(`!!document.querySelector('.rank-overlay:not(.hidden) .rank-skill:not([disabled])')`)) await click('.rank-overlay:not(.hidden) .rank-skill:not([disabled])');
    if(await read(`document.querySelector('.call:not(.hidden)')?.disabled===false`)) await click('.call:not(.hidden)');
    await delay(250);
  }
  assert(await read(`!!document.querySelector('.results')`),'The ordinary failed run must reach results.');
  const result=await read(`document.querySelector('.results').innerText`);
  await shot('04-loss-service-points');
  const after=await read(`JSON.parse(localStorage.getItem('jbtd-save-v1'))`);
  assert(after.servicePoints>20,'Real played loss must award permanent service points.');
  assert(result.includes('service points')); assert.deepEqual(errors,[]);
  writeFileSync(`${output}/acceptance.json`,JSON.stringify({newSave:true,all24Visible:true,firstMapPurchase:true,independentBuildsReload:true,lossPoints:after.servicePoints-20,result,errors},null,2));
  console.log(JSON.stringify({lossPoints:after.servicePoints-20,result,errors}));
} finally { ws.close(); }
