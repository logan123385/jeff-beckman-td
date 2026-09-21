/** Production-browser acceptance using real mouse/key events, with no simulation hooks or added resources.
 * Start an isolated agent-browser session on the preview URL, then pass its CDP HTTP port:
 * node scripts/browser-ui-check.mjs 52260 /tmp/jeff-playtest
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
  const box = await read(`(() => { const el = document.querySelector(${JSON.stringify(selector)}); if (!el || el.disabled) return null; el.scrollIntoView({block:'nearest'}); const r=el.getBoundingClientRect(); return { x:r.x+r.width/2, y:r.y+r.height/2 }; })()`);
  assert(box, `Missing or disabled: ${selector}`); await pointer(box.x, box.y);
};
const textButton = async name => {
  const selector = await read(`(() => { const buttons=[...document.querySelectorAll('button')]; const i=buttons.findIndex(b => b.textContent.trim()===${JSON.stringify(name)} && !b.disabled); if(i<0)return null; buttons[i].setAttribute('data-playtest-button','yes'); return '[data-playtest-button="yes"]'; })()`);
  assert(selector, `Missing button: ${name}`); await click(selector); await read(`document.querySelector('[data-playtest-button]')?.removeAttribute('data-playtest-button')`);
};
const press = async key => {
  const code = key === ' ' ? 'Space' : /^[0-9]$/.test(key) ? `Digit${key}` : `Key${key.toUpperCase()}`;
  await send('Input.dispatchKeyEvent', { type: 'keyDown', key, code, windowsVirtualKeyCode: key.toUpperCase().charCodeAt(0) });
  await send('Input.dispatchKeyEvent', { type: 'keyUp', key, code, windowsVirtualKeyCode: key.toUpperCase().charCodeAt(0) });
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
try {
  await send('Runtime.enable'); await send('Page.enable');
  await send('Page.reload'); await waitFor('.adventure-title');
  await send('Emulation.setDeviceMetricsOverride', {width: 390, height: 844, deviceScaleFactor: 1, mobile: true});
  await textButton(await read(`document.querySelector('.adventure-copy .btn.primary').textContent`)); await shot('01-mobile-campaign');
  assert(await read('document.documentElement.scrollWidth <= innerWidth'), 'Campaign fits mobile width');
  await click('[aria-label^="1. Crawlspace"]');
  await click('.campaign-briefing .map-foot .btn.primary');
  const records=[];
  for (const name of ['Jeff Beckman','Big Mike','Robo Bob','Becbec','CBJ','Doni','Jayjay','Mr. Chris']) {
    await click(`[aria-label="Play as ${name}"]`);
    const abilities=await read(`[...document.querySelectorAll('.hero-kit-skill b')].map(x=>x.textContent)`);
    const aura=await read(`document.querySelector('.hero-aura-card b').textContent`);
    const expected={CBJ:'trucks n taters',Doni:'guided fishing tour',Jayjay:'would beat ronda rousey in a 1v1 easily'};
    if(expected[name])assert.equal(aura,expected[name]);
    assert.equal(abilities.length,5); records.push({hero:name,aura,abilities});
  }
  assert(records.at(-1).abilities.includes('Sand Trap'));
  await shot('02-mobile-hero-roster'); await textButton('Take the call');
  assert(await read(`document.querySelector('.ab-crew').textContent.includes('Summon Logan')`));
  await press('j'); await world(170,275); await press('q');
  await delay(1200);
  assert(Number(await read(`document.querySelector('[aria-label="Sand Trap (Q)"] .cooldown-number')?.textContent`))>0, 'Chris casts Sand Trap from his own Q slot');
  await press('d'); await world(160,330); await delay(600);
  assert(Number(await read(`document.querySelector('.ab-crew .cooldown-number').textContent`))>0, 'Chris can also summon Logan independently');
  await press('i'); await shot('03-mobile-scout');
  assert(await read(`document.documentElement.scrollWidth <= innerWidth`));
  assert(await read(`document.querySelector('.battle-intel').getBoundingClientRect().bottom <= innerHeight`));
  await textButton('Back to defenses');
  // Opening scouting while manually paused must preserve that pause on close.
  await press('p'); await press('i'); await press('i');
  assert(await read(`!!document.querySelector('.pause-overlay:not(.hidden)')`));
  await press('p');
  await shot('04-mobile-battle');
  await send('Emulation.setDeviceMetricsOverride', {width:1440,height:960,deviceScaleFactor:1,mobile:false});
  await read('window.scrollTo(0,0)'); await delay(350);
  const desktop = await read(`(()=>{const top=document.querySelector('.hud-top').getBoundingClientRect(),bottom=document.querySelector('.hud-bottom').getBoundingClientRect(),board=document.querySelector('.stage-canvas').getBoundingClientRect();return {top:top.top,bottom:bottom.bottom,ratio:board.width/board.height,scrollHeight:document.body.scrollHeight};})()`);
  assert(desktop.top>=0 && desktop.bottom<=960, 'Desktop controls fit without vertical clipping');
  assert(Math.abs(desktop.ratio-1.6)<.01,'The battlefield retains its 8:5 geometry');
  await shot('05-desktop-battle');
  await send('Emulation.setEmulatedMedia',{features:[{name:'prefers-reduced-motion',value:'reduce'}]});
  const reducedMotion=await read(`matchMedia('(prefers-reduced-motion:reduce)').matches && getComputedStyle(document.querySelector('.jeff-card')).animationName==='none'`);
  assert(reducedMotion);await send('Emulation.setEmulatedMedia',{features:[]});
  assert.deepEqual(errors,[]);
  writeFileSync(`${output}/report.json`, JSON.stringify({pass:true,viewport:[390,844],heroKits:records,sandTrapCast:true,independentLogan:true,pauseRestored:true,desktop,reducedMotion,errors},null,2));
  console.log('Mobile, all hero kits, Sand Trap, Logan, pause, desktop bounds and reduced motion passed.');
} finally { ws.close(); }
