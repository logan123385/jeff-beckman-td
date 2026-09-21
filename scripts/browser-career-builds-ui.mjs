/** Menu acceptance with a deliberate 5000-XP fixture in an isolated profile.
 * Unlocks/selects all 24 techniques through real mouse controls. Not progression-rate evidence.
 * node scripts/browser-career-builds-ui.mjs <CDP port> <output directory>
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
  await send('Runtime.enable');await send('Page.enable');await send('Network.enable');await send('Network.setCacheDisabled',{cacheDisabled:true});
  // Deliberate career-level fixture in an isolated profile. Real earning is tested separately.
  await read(`(()=>{const s=JSON.parse(localStorage.getItem('jbtd-save-v1'));s.jeffXp=5000;s.heroBuilds={};localStorage.setItem('jbtd-save-v1',JSON.stringify(s));})()`);
  await send('Page.reload');await waitFor('.adventure-title');await textButton(await read(`document.querySelector('.adventure-copy .btn.primary').textContent`));
  await send('Emulation.setDeviceMetricsOverride',{width:1440,height:960,deviceScaleFactor:1,mobile:false});
  await textButton('Hero builds8 heroes');
  const heroes=await read(`[...document.querySelectorAll('[data-build-hero]')].map(b=>({id:b.dataset.buildHero,name:b.innerText}))`), checks=[];
  for(const hero of heroes) {
    await click(`[data-build-hero="${hero.id}"]`);
    const paths=await read(`[...new Set([...document.querySelectorAll('[data-build-node]')].map(b=>b.dataset.buildNode.split(':')[0]))]`);
    for(const style of paths) {
      if(await read(`!![...document.querySelectorAll('button')].find(b=>b.textContent==='Respec hero · free'&&!b.disabled)`))await textButton('Respec hero · free');
      for(let tier=1;tier<=4;tier++)await click(`[data-build-node="${style}:${tier}"]`);
      await click(`[data-technique="${style}"]`);
      assert(await read(`document.querySelector('[data-technique="${style}"]').getAttribute('aria-pressed')==='true'`));
    }
    const technique=await read(`document.querySelector('[data-technique][aria-pressed="true"]').textContent`);
    await read(`window.scrollTo(0,0)`);await shot(`build-${hero.id}`);
    await textButton(`Take ${hero.name}`);await click('[aria-label^="1. Crawlspace"]');await click('.campaign-briefing .map-foot .btn.primary');
    assert(await read(`document.querySelector('.hero-kit-skill:last-child').textContent.includes(${JSON.stringify(technique)})`));
    checks.push({hero:hero.id,paths:paths.length,technique});
    await textButton('← Van');await textButton('Hero builds8 heroes');
  }
  await send('Emulation.setDeviceMetricsOverride',{width:390,height:844,deviceScaleFactor:1,mobile:true});
  for(const hero of heroes) {
    await click(`[data-build-hero="${hero.id}"]`);
    const metrics=await read(`({page:document.documentElement.scrollWidth,viewport:innerWidth,body:document.body.scrollWidth})`);
    assert(metrics.page<=metrics.viewport+1,`${hero.id} mobile overflow: ${JSON.stringify(metrics)}`);
  }
  await read(`window.scrollTo(0,0)`);await shot('mobile-hero-builds');
  await textButton('← Van');await click('.supply-link');
  assert(await read(`document.documentElement.scrollWidth<=innerWidth+1`));
  await read(`window.scrollTo(0,0)`);await shot('mobile-store');
  await textButton('Affordable');await textButton('Owned');await textButton('All towers');
  assert.equal(await read(`document.querySelectorAll('[data-store-tower]').length`),24);
  assert.deepEqual(errors,[]);
  writeFileSync(`${output}/build-ui-report.json`,JSON.stringify({fixture:'5000 career XP, isolated profile; all unlocks and selections through real controls',checks,mobileWidth:390,errors},null,2));
  console.log(JSON.stringify({all8Heroes:checks,all24Techniques:true,mobileWidth:390,errors}));
} finally {ws.close();}
