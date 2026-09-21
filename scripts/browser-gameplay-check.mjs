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
  const box = await read(`(() => { const el = document.querySelector(${JSON.stringify(selector)}); if (!el || el.disabled) return null; el.scrollIntoView({block:'nearest'}); const r=el.getBoundingClientRect(); return { x:r.x+r.width/2, y:r.y+r.height/2 }; })()`);
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
  await send('Runtime.enable'); await send('Page.enable');
  await send('Page.reload'); await waitFor('.adventure-title');
  await send('Emulation.setDeviceMetricsOverride', { width: 1440, height: 960, deviceScaleFactor: 1, mobile: false });
  await textButton(await read(`document.querySelector('.adventure-copy .btn.primary').textContent`));
  await textButton('Apprentice'); await click('[aria-label^="1. Crawlspace"]');
  await click('.campaign-briefing .map-foot .btn.primary');
  await click('[aria-label="Play as CBJ"]'); await textButton('Take the call');
  if (await read(`!!document.querySelector('.coach-skip')`)) await textButton('Skip tutorial');
  await click('[data-tower="washer"]'); await world(225,250);
  await click('[data-tower="torch"]'); await world(100,250);
  await press('j'); await world(170,275);
  await press(' ');
  for (let i=0;i<4;i++) await press(' ');
  assert.equal((await stats()).wave,'1 / 10','Repeated calls must not stack unspawned waves');
  assert(await read(`document.querySelector('.call').disabled`));
  await press('d'); await world(160,330);
  await until(`!document.querySelector('.call').disabled`, 'early call unlocks after entry');
  const beforeCd = Number(await read(`document.querySelector('.ab-crew .cooldown-number').textContent`));
  await press(' ');
  const afterCd = Number(await read(`document.querySelector('.ab-crew .cooldown-number').textContent`));
  assert(beforeCd-afterCd>=6, `Early call recovered cooldown: ${beforeCd} -> ${afterCd}`);
  assert(await read(`document.querySelector('.flow-reward').textContent.includes('SKILLS')`));
  await shot('01-early-call');
  await until(`!!document.querySelector('.rank-call.ready')`, 'earn a hero rank', 45);
  assert(!await read(`!!document.querySelector('.rank-overlay:not(.hidden)')`), 'Earning ranks never opens a forced modal');
  const rankText = await read(`document.querySelector('.rank-call').textContent`);
  await press('t');
  assert(Number(await read(`document.querySelector('.ab-sleeve .cooldown-number').textContent`))>0, 'T still casts with unspent ranks');
  assert.equal(await read(`document.querySelector('.rank-call').textContent`),rankText,'Combat keys do not silently spend rank points');
  await world(290,300,'right');
  assert(await read(`document.querySelector('.jeff-status').textContent.includes('queued')`),'Move order is acknowledged during a cast');
  await delay(1100);
  assert(!await read(`document.querySelector('.jeff-status').textContent.includes('queued')`),'Buffered move executes after recovery');
  await press('l'); assert(await read(`!!document.querySelector('.rank-overlay:not(.hidden)')`));
  const frozen = await read(`document.querySelector('.ab-crew .cooldown-number').textContent`);
  await delay(600); assert.equal(await read(`document.querySelector('.ab-crew .cooldown-number').textContent`), frozen);
  assert(await read(`document.activeElement?.classList.contains('rank-skill')`),'Opening ranks focuses a skill');
  await press('Tab',8);
  assert.equal(await read(`document.activeElement?.textContent`),'Continue fighting','Shift-Tab wraps inside the rank dialog');
  await press(' ');
  assert(!await read(`!!document.querySelector('.rank-overlay:not(.hidden)')`),'Space activates the focused Continue button');
  assert.equal(await read(`document.querySelector('.rank-call').textContent`),rankText,'Deferred ranks are retained');
  await press('p'); await press('l'); await textButton('Continue fighting');
  assert(await read(`!!document.querySelector('.pause-overlay:not(.hidden)')`),'Closing ranks preserves manual pause');
  await press('p'); await press('l'); await click('.rank-skill:not(:disabled)');
  assert(await read(`document.querySelectorAll('.ability .rank-pips .on').length > 0`));
  if(await read(`!!document.querySelector('.rank-overlay:not(.hidden)')`))await textButton('Continue fighting');
  const tools=await read(`[...document.querySelectorAll('.tray-tool')].map(b=>b.dataset.tower)`);
  for(let i=0;i<tools.length;i++) { await press(String(i+1)); assert.equal(await read(`document.querySelector('.tray-tool.armed')?.dataset.tower`),tools[i]); }
  await world(233,222);
  assert(await read(`!!document.querySelector('.kr-investment')`),'Visible upgrade comparison');
  await shot('02-upgrade-choice');
  await press('Escape'); await press('i'); await shot('03-wave-scout'); await textButton('Back to defenses');
  await until(`document.querySelector('.flow-reward').textContent.includes('WAVE')`, 'per-wave clear receipt', 40);
  await shot('04-combat-flow');
  await send('Emulation.setDeviceMetricsOverride', { width:390,height:844,deviceScaleFactor:1,mobile:true });
  await delay(500); await shot('05-mobile-flow');
  assert(await read(`document.documentElement.scrollWidth<=innerWidth`),'Mobile battle fits width');
  assert(await read(`document.querySelector('.rank-call').getBoundingClientRect().right<=innerWidth`),'Rank control fits mobile');
  await press('Escape'); await world(233,222);
  assert(await read(`!!document.querySelector('.kr-wheel.kr-compact:not(.hidden)')`),'Short yards use compact tower commands');
  const compact = await read(`(() => {
    const stage=document.querySelector('.stage').getBoundingClientRect(), wheel=document.querySelector('.kr-wheel').getBoundingClientRect();
    return {contained:wheel.top>=stage.top&&wheel.bottom<=stage.bottom&&wheel.left>=stage.left&&wheel.right<=stage.right,
      reachable:[...document.querySelectorAll('.kr-wheel .kr-spoke')].every(el=>{const r=el.getBoundingClientRect();return r.height>=44&&r.bottom<=stage.bottom&&r.top>=stage.top;})};
  })()`);
  assert(compact.contained&&compact.reachable,'Mobile upgrade, sell, active, and aim buttons remain reachable');
  await shot('06-mobile-tower-commands');
  assert.deepEqual(errors,[]);
  const result={pass:true,ordinaryResources:true,callMashGuard:true,earlyCallCooldownRecovery:beforeCd-afterCd,nonblockingRanks:true,rankKeyboard:true,combatKeysPreserved:true,queuedMovement:true,deferredRanks:true,manualPausePreserved:true,trayHotkeysMatch:tools,upgradePreview:true,waveReceipts:true,mobileWidth:390,mobileCommands:compact,errors};
  writeFileSync(`${output}/report.json`,JSON.stringify(result,null,2)); console.log(JSON.stringify(result));
} catch(error) {
  await shot('failure'); writeFileSync(`${output}/failure.json`,JSON.stringify({message:error.message,errors,state:await stats()},null,2)); console.error(error); process.exitCode=1;
} finally { ws.close(); }
