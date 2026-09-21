/** Production-browser acceptance using real mouse/key events, with no simulation hooks or added resources.
 * Start an isolated agent-browser session on the preview URL, then pass its CDP HTTP port:
 * node scripts/browser-hero-check.mjs 52260 /tmp/jeff-playtest
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
  await send('Emulation.setDeviceMetricsOverride', {width:1440,height:960,deviceScaleFactor:1,mobile:false});
  const checks=[];
  for (const [name,casts] of [
    ['CBJ', [['r','Lunch Break'],['c','Fully Loaded',true]]],
    ['Doni', [['e','Cast a Wide Net',true],['r','Shore Lunch']]],
    ['Jayjay', [['e','Canvas Slam'],['c','Unanimous Decision']]],
  ]) {
    await send('Page.reload'); await waitFor('.adventure-title');
    await textButton(await read(`document.querySelector('.adventure-copy .btn.primary').textContent`));
    await textButton('Apprentice'); await click('[aria-label^="1. Crawlspace"]');
    await click('.campaign-briefing .map-foot .btn.primary'); await click(`[aria-label="Play as ${name}"]`);
    assert.equal(await read(`document.querySelectorAll('.hero-roster-card').length`),8);
    await read(`document.querySelector('.hero-roster').scrollIntoView({block:'start'})`);
    await shot(`${name.toLowerCase()}-roster`); await textButton('Take the call');
    if(await read(`!!document.querySelector('.coach-skip')`))await textButton('Skip tutorial');
    assert.deepEqual(await read(`[...document.querySelectorAll('.tray-tool')].map(x=>x.dataset.tower)`),['torch','washer','barricade']);
    await press('j'); await world(170,275);
    assert(await read(`!document.querySelector('.jeff-card').classList.contains('ready-deploy')`));
    const used=[];
    for (const [key,ability,targeted] of casts) {
      await press(key); if(targeted)await world(180,300);
      await delay(650); await shot(`${name.toLowerCase()}-${key}`);
      await delay(1500);
      const cooldown=Number(await read(`document.querySelector('[aria-label="${ability} (${key.toUpperCase()})"] .cooldown-number')?.textContent`));
      assert(cooldown>0,`${name} must cast ${ability} through real controls`); used.push({ability,cooldown});
      await delay(1400);
    }
    await press(' '); await delay(8000);
    const before=await stats(); await delay(8000); const after=await stats();
    assert(after.cash>230 || before.cash>230,`${name} must earn bounty against the live first wave`);
    await shot(`${name.toLowerCase()}-combat`);
    checks.push({hero:name,retiredTowersAbsent:true,casts:used,combatCash:after.cash,lives:after.lives});
  }
  assert.deepEqual(errors,[]);
  writeFileSync(`${output}/report.json`,JSON.stringify({pass:true,purpose:'Three new heroes via production mouse and keyboard controls',checks,errors},null,2));
  console.log(JSON.stringify(checks));
} finally { ws.close(); }
