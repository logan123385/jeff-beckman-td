/** Real touch input in an isolated agent-browser session; never uses an owner's save.
 * node scripts/browser-mobile-check.mjs <CDP port> <output dir> [game URL]
 */
import assert from 'node:assert/strict';
import { mkdirSync, writeFileSync } from 'node:fs';

const port = Number(process.argv[2]);
const output = process.argv[3] ?? '/tmp/jeff-mobile-check';
const url = process.argv[4] ?? 'http://127.0.0.1:5185/';
assert(port > 0, 'Pass the CDP port of an isolated browser.');
mkdirSync(output, { recursive: true });
const tabs = await (await fetch(`http://127.0.0.1:${port}/json/list`)).json();
const tab = tabs.find(t => t.type === 'page' && t.url.startsWith(url));
assert(tab, `Open ${url} in the isolated browser first.`);
const ws = new WebSocket(tab.webSocketDebuggerUrl);
await new Promise(resolve => ws.addEventListener('open', resolve, { once: true }));
let seq = 0;
const pending = new Map(), errors = [], layouts = [];
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
  for (let i = 0; i < 120; i++) {
    if (await read(`!!document.querySelector(${JSON.stringify(selector)})`)) return;
    await delay(100);
  }
  throw new Error(`Timed out waiting for ${selector}`);
};
const touch = async (x, y) => {
  await send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x, y }] });
  await send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  await delay(120);
};
const click = async selector => {
  const box = await read(`(() => { const el=document.querySelector(${JSON.stringify(selector)}); if(!el || el.disabled)return null;
    el.scrollIntoView({block:'nearest'}); const r=el.getBoundingClientRect(); return {x:r.x+r.width/2,y:r.y+r.height/2}; })()`);
  assert(box, `Missing/disabled ${selector}`); await touch(box.x, box.y);
};
const textButton = async name => {
  const found = await read(`(() => {const b=[...document.querySelectorAll('button')].find(b=>b.textContent.trim()===${JSON.stringify(name)}&&!b.disabled);b?.setAttribute('data-mobile-check','true');return !!b;})()`);
  assert(found, `Missing button ${name}`); await click('[data-mobile-check]');
  await read(`document.querySelector('[data-mobile-check]')?.removeAttribute('data-mobile-check')`);
};
const world = async (x, y) => {
  const r = await read(`(() => {const r=document.querySelector('.stage-canvas').getBoundingClientRect();return {x:r.x,y:r.y,w:r.width,h:r.height};})()`);
  await touch(r.x + x / 960 * r.w, r.y + y / 600 * r.h);
};
const shot = async name => {
  const { data } = await send('Page.captureScreenshot', { format: 'png' });
  writeFileSync(`${output}/${name}.png`, Buffer.from(data, 'base64'));
};
const viewport = async (width, height, mobile = true) => {
  await send('Emulation.setDeviceMetricsOverride', { width, height, deviceScaleFactor: 1, mobile });
  await send('Emulation.setTouchEmulationEnabled', { enabled: mobile });
  await delay(250);
};
const layout = async label => {
  const result = await read(`(() => {
    const rect=el=>{const r=el.getBoundingClientRect();return {x:r.x,y:r.y,w:r.width,h:r.height,right:r.right,bottom:r.bottom};};
    const visible=el=>!!el.getClientRects().length&&getComputedStyle(el).visibility!=='hidden';
    const controls=[...document.querySelectorAll('.hud-top button,.job-strip button,.hud-bottom button')].filter(visible);
    const elements=[...controls,...document.querySelectorAll('.hint,.boss-panel')].filter(visible);
    const outside=elements.filter(el=>{const r=rect(el);return r.x < -1||r.y < -1||r.right > innerWidth+1||r.bottom > innerHeight+1;}).map(el=>el.textContent.trim());
    const board=rect(document.querySelector('.stage')), dock=rect(document.querySelector('.hud-bottom'));
    return {width:innerWidth,height:innerHeight,pageHeight:document.documentElement.scrollHeight,pageWidth:document.documentElement.scrollWidth,
      board,dock,outside,shortTargets:controls.filter(el=>rect(el).h<43||rect(el).w<43).map(el=>el.textContent.trim()),
      overlap:board.x<dock.right&&board.right>dock.x&&board.y<dock.bottom&&board.bottom>dock.y};
  })()`);
  layouts.push({ label, ...result });
  assert(result.pageHeight <= result.height + 1, `${label}: vertical page overflow ${result.pageHeight}/${result.height}`);
  assert(result.pageWidth <= result.width, `${label}: horizontal page overflow`);
  assert.deepEqual(result.outside, [], `${label}: unreachable controls`);
  assert.equal(result.overlap, false, `${label}: dock covers battlefield`);
  assert(result.board.w > 200 && result.board.h > 120, `${label}: battlefield collapsed`);
  assert(Math.abs(result.board.w/result.board.h-1.6)<.015, `${label}: battlefield distorted`);
  if(result.width<=900||result.height<=600) assert.deepEqual(result.shortTargets,[],`${label}: undersized touch targets`);
};
const assertInViewport = async selector => {
  assert(await read(`(() => {const el=document.querySelector(${JSON.stringify(selector)});if(!el)return false;const r=el.getBoundingClientRect();return r.width>0&&r.height>0&&r.left>=0&&r.top>=0&&r.right<=innerWidth+1&&r.bottom<=innerHeight+1;})()`), `Panel outside viewport: ${selector}`);
};
try {
  await send('Runtime.enable'); await send('Page.enable');
  await viewport(390,664);
  await waitFor('.adventure-title');
  await click('.adventure-copy .btn.primary');
  await click('.campaign-briefing .map-foot .btn.primary');
  await textButton('Take the call');
  await waitFor('.stage-canvas');
  await shot('01-tutorial');
  if (await read(`!!document.querySelector('.coach-skip')`)) await click('.coach-skip');
  for (const [w,h] of [[390,664],[375,667],[320,568],[360,640],[430,740],[768,1024],[844,390],[740,360],[667,375],[568,320],[844,300],[667,280]]) {
    await viewport(w,h); await layout(`${w}x${h}`); await shot(`layout-${w}x${h}`);
  }
  // Presentation-only stress fixture: five tools and boss health.
  // No simulation state, resources or saved progression are changed.
  await read(`(() => {
    const tray=document.querySelector('.tool-tray');
    for(let i=tray.children.length;i<5;i++){const clone=tray.firstElementChild.cloneNode(true);clone.dataset.layoutFixture='true';tray.append(clone);}
    const boss=document.querySelector('.boss-panel').cloneNode(true);
    boss.classList.remove('hidden');boss.dataset.layoutFixture='true';
    boss.firstElementChild.textContent='Boss layout fixture';
    document.querySelector('.hud-bottom').append(boss);
  })()`);
  for (const [w,h] of [[320,568],[390,664],[568,320],[844,390],[768,1024],[820,1180],[844,300],[667,280]]) {
    await viewport(w,h); await layout(`boss-five-tools-${w}x${h}`);
  }
  await read(`(() => {
    document.querySelectorAll('[data-layout-fixture]').forEach(el=>el.remove());
  })()`);
  await viewport(390,664);
  await click('.scout-button'); await assertInViewport('.battle-intel');
  await assertInViewport('.intel-close'); await shot('02-scout');
  await textButton('Back to defenses');
  await click('.plan-button');
  assert(await read(`document.querySelector('.plan-button').getAttribute('aria-pressed')==='true'`));
  await click('.plan-button');
  await click('.jeff-card'); await world(320,285);
  assert(await read(`!document.querySelector('.jeff-card').classList.contains('ready-deploy')`), 'Touch deploys hero');
  await click('[data-tower="torch"]');
  await assertInViewport('.cancel-target:not(.hidden)');
  await click('.cancel-target');
  assert(await read(`!document.querySelector('.tray-tool.armed')`), 'Touch cancels armed build');
  await click('[data-tower="torch"]'); await world(233,222);
  assert(Number(await read(`document.querySelector('.medal.coin b').textContent`))<230,'Touch builds using normal cash');
  await click('.cancel-target'); await world(233,222);
  await waitFor('.kr-investment'); await assertInViewport('.kr-wheel'); await shot('03-tower-commands');
  await click('.kr-x');
  await click('.pause-button'); await assertInViewport('.pause-card');
  await shot('04-pause'); await textButton('Resume');
  await click('.call');
  assert.equal(await read(`document.querySelector('.medal.wave b').textContent`),'1 / 10','Touch starts wave');
  await click('.ab-crew'); await world(160,300);
  assert(await read(`document.querySelector('.ab-crew').classList.contains('cooling')`),'Touch casts Logan');
  await shot('05-touch-combat');
  await viewport(844,390); await layout('rotate-during-combat');
  await shot('06-landscape-combat');
  await click('.scout-button'); await assertInViewport('.battle-intel');
  await textButton('Back to defenses');
  await click('.pause-button'); await assertInViewport('.pause-card');
  await assertInViewport('.pause-actions .btn:last-child');
  await viewport(1440,900,false); await textButton('Resume'); await layout('desktop');
  await shot('07-desktop');
  assert.deepEqual(errors,[]);
  writeFileSync(`${output}/report.json`,JSON.stringify({pass:true,touchInput:true,ordinaryResources:true,layouts,errors},null,2));
  console.log(JSON.stringify({pass:true,viewports:layouts.length,touchInput:true,errors}));
} catch(error) {
  await shot('failure');
  writeFileSync(`${output}/failure.json`,JSON.stringify({message:error.message,layouts,errors},null,2));
  console.error(error); process.exitCode=1;
} finally { ws.close(); }
