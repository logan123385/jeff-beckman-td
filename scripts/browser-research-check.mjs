/** Production-browser acceptance using real mouse/key events, with no simulation hooks or added resources.
 * Start an isolated agent-browser session on the preview URL, then pass its CDP HTTP port:
 * node scripts/browser-gameplay-check.mjs 52260 /tmp/jeff-playtest
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
  await send('Runtime.enable'); await send('Page.enable'); await send('Network.enable'); await send('Network.setCacheDisabled', {cacheDisabled:true}); await send('Page.reload'); await waitFor('.adventure-title');
  await send('Emulation.setDeviceMetricsOverride', {width:1440,height:960,deviceScaleFactor:1,mobile:false});
  const enter = async () => {
    await textButton(await read(`document.querySelector('.adventure-copy .btn.primary').textContent`));
    await textButton('Apprentice'); await click('[aria-label^="1. Crawlspace"]'); await click('.campaign-briefing .map-foot .btn.primary');
  };
  await enter(); await click('[aria-label="Play as Doni"]'); await click('[aria-label="Save crew 1"]');
  await click('[aria-label="Play as CBJ"]'); await click('[aria-label="Load crew 1"]');
  assert(await read(`document.querySelector('[aria-label="Play as Doni"]').getAttribute('aria-pressed')==='true'`));
  await shot('01-saved-crews');
  await send('Page.reload'); await waitFor('.adventure-title'); await enter();
  assert(await read(`document.querySelector('.saved-crews').textContent.includes('Crew 1 · Doni')`));
  await click('[aria-label="Play as CBJ"]'); await textButton('Take the call');
  if(await read(`!!document.querySelector('.coach-skip')`)) await textButton('Skip tutorial');
  await press('b'); assert(await read(`document.querySelector('.plan-button').getAttribute('aria-pressed')==='true'`));
  const cash = (await stats()).cash;
  await click('[data-tower="washer"]'); await world(225,250);
  await click('[data-tower="torch"]'); await world(100,250);
  assert((await stats()).cash<cash,'Construction spends real money during planning');
  await press('j'); await world(170,275); await press('d'); await world(160,330);
  const frozen=await read(`document.querySelector('.ab-crew .cooldown-number').textContent`);
  await delay(1200); assert.equal(await read(`document.querySelector('.ab-crew .cooldown-number').textContent`),frozen,'Planning freezes cooldowns');
  await press(' '); assert.equal((await stats()).wave,'0 / 10','Planning cannot call waves');
  await press('i'); assert.equal(await read(`document.querySelectorAll('.intel-forecast button').length`),3);
  await click('.intel-forecast button:nth-child(3)');
  assert(await read(`document.querySelector('.intel-header h2').textContent==='Wave 3'`));
  assert(await read(`document.querySelector('.intel-footer .primary').disabled`));
  assert(await read(`document.querySelector('.intel-coverage').textContent.includes('Ground')`));
  await shot('02-forecast'); await textButton('Back to defenses');
  assert(await read(`document.querySelector('.play').classList.contains('planning')`),'Scout returns to planning');
  await delay(500); assert.equal(await read(`document.querySelector('.ab-crew .cooldown-number').textContent`),frozen);
  await press('p'); assert(!await read(`document.querySelector('.play').classList.contains('planning')`));
  await delay(1300); assert(Number(await read(`document.querySelector('.ab-crew .cooldown-number').textContent`))<Number(frozen),'Resume advances cooldown');
  await press('p'); await press('i'); await textButton('Back to defenses');
  assert(await read(`!!document.querySelector('.pause-overlay:not(.hidden)')`),'Scout preserves manual pause'); await press('p');
  await press('f'); await press('f'); await press('f');
  assert(await read(`[...document.querySelectorAll('button')].some(b=>b.textContent.includes('½×'))`));
  await press('b');
  await send('Emulation.setDeviceMetricsOverride',{width:390,height:844,deviceScaleFactor:1,mobile:true}); await delay(400);
  assert(await read(`document.documentElement.scrollWidth<=innerWidth`));
  assert(await read(`document.querySelector('.plan-button').getBoundingClientRect().right<=innerWidth`));
  await shot('03-mobile-planning'); await press('i'); await shot('04-mobile-scout');
  assert(await read(`document.querySelector('.battle-intel').getBoundingClientRect().right<=innerWidth`));
  assert(await read(`document.querySelector('.battle-intel').getBoundingClientRect().height>innerHeight*.8`),'Mobile scouting uses the viewport');
  assert.deepEqual(errors,[]);
  const report={pass:true,ordinaryResources:true,crewSavedAndReloaded:true,planningConstruction:true,planningCooldownFrozen:true,planningCallBlocked:true,scoutThreeWaves:true,futureCallBlocked:true,scoutPreservesPlanning:true,manualPausePreserved:true,halfSpeed:true,mobileWidth:390,errors};
  writeFileSync(`${output}/report.json`,JSON.stringify(report,null,2)); console.log(report);
} catch(error) { await shot('failure'); console.error(error); process.exitCode=1; }
finally {ws.close();}
