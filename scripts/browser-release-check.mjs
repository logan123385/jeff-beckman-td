/** UI release checks. Only target a disposable browser session with a fresh save.
 * node scripts/browser-release-check.mjs <CDP port> <output dir> <game URL>
 */
import assert from 'node:assert/strict';
import { mkdirSync, writeFileSync } from 'node:fs';
const [port, output = '/tmp/jeff-release-check', url = 'http://127.0.0.1:5188/'] = process.argv.slice(2);
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
  await viewport(390,664); await wait('.adventure-title');
  assert.equal(await save(), null, 'Use a NEW browser session; this test purchases a license with the welcome points.');
  await shot('01-title'); await screen('fresh title');
  await button('How it works'); await wait('.how-overlay:not(.hidden)');
  assert(await read(`document.querySelector('.how-essential').textContent.includes('Main menu')`));
  await key('Escape'); assert.equal(await visible('.how-overlay:not(.hidden)'), false);
  checks.push({ label: 'help opens and Escape restores focus' });
  await click('.adventure-copy .btn.primary'); await wait('.hub'); await screen('campaign hub');
  await click('.supply-link'); await wait('.supply-store'); await screen('supply store');
  assert.equal(await read(`document.querySelectorAll('.store-card').length`),24);
  await click('[data-buy-tower="vent"]');
  assert((await save()).ownedTowers.includes('vent')); assert.equal((await save()).servicePoints,20);
  await button('Affordable'); assert(await visible('.empty'));
  await button('All towers'); await button('← Van');
  await read(`document.querySelector('.hub-actions button').click()`); await wait('.kit-screen');
  for (const hero of ['jeff','mike','bob','chris','becbec','cbj','doni','jayjay']) {
    await click(`[data-kit-hero="${hero}"]`);
    const toggles = await read(`document.querySelectorAll('.kit-stance-toggle button').length`);
    assert.equal(toggles,2);
    await click('.kit-stance-toggle button:last-child');
    await click('.kit-stance-toggle button:first-child');
    await screen(`${hero} kit and both stances`);
  }
  await button('← Van'); await button('Encyclopedia'); await screen('encyclopedia');
  await read(`document.querySelector('.screen-header button').click()`); await wait('.hub');
  await click('.campaign-briefing .map-foot .btn.primary'); await wait('.loadout'); await screen('loadout');
  await button('Take the call'); await wait('.stage-canvas');
  assert(await visible('.coach-skip'), 'Shopping before the first run keeps the tutorial.');
  await click('.coach-skip');
  await read(`window.__nativeDialogs=0;window.confirm=()=>{window.__nativeDialogs++;throw new Error('Native webview dialogs unavailable');}`);
  for (const [width,height] of [[390,664],[667,280],[320,568]]) {
    await viewport(width,height); await click('.pause-button'); await wait('.pause-card');
    await click('.pause-exit'); await wait('.confirmation-overlay');
    await key('Tab');
    assert(await read(`document.activeElement.closest('.confirmation-overlay')!==null`));
    await button('Keep playing');
    assert(await visible('.pause-overlay:not(.hidden)'), 'Cancelling exit preserves manual pause.');
    await button('Resume');
    assert.equal(await visible('.pause-overlay:not(.hidden)'),false);
    checks.push({label:`exit cancellation and focus ${width}x${height}`});
  }
  await viewport(390,664); await click('.pause-button'); await click('.pause-exit'); await shot('02-exit-confirmation');
  await button('Leave match'); await wait('.adventure-title');
  assert.equal(await read('window.__nativeDialogs'),0);
  assert.equal((await save()).jeffXp,0,'Abandoned match does not grant rewards.');
  checks.push({label:'touch exit succeeds with native confirmations disabled'});
  const before = await save();
  await chooseFile(`${output}/invalid.json`, '{"not":"a game save"}');
  assert(await read(`document.querySelector('.persist-row').textContent.includes('not a supported')`));
  assert.deepEqual(await save(),before);
  const imported = { ...before, jeffXp: 250, selectedHero: 'cbj', stars: {crawlspace:{apprentice:3}}, heroJobs:{cbj:3} };
  await chooseFile(`${output}/restore.json`, JSON.stringify(imported)); await wait('.adventure-title');
  assert.equal((await save()).jeffXp,250);
  assert.equal((await save()).selectedHero,'cbj');
  assert.deepEqual(await read(`JSON.parse(localStorage.getItem('jbtd-save-v1.bak'))`),before);
  await button('Reset all progress'); await button('Cancel'); assert.equal((await save()).jeffXp,250);
  await send('Page.reload'); await wait('.adventure-title'); assert.equal((await save()).jeffXp,250);
  checks.push({label:'save restore rejects invalid files, backs up, survives reload, and reset cancels safely'});
  await screen('returning title'); await shot('03-restored-title');
  // Realistic blocked storage at startup, without touching another session's save.
  const { identifier } = await send('Page.addScriptToEvaluateOnNewDocument', { source: `Object.defineProperty(window,'localStorage',{get(){throw new DOMException('Blocked','SecurityError');}});` });
  await send('Page.reload'); await wait('.adventure-title');
  assert(await read(`document.querySelector('.persist-row').textContent.includes("Couldn't save")`));
  await click('.adventure-copy .btn.primary'); await wait('.hub');
  await click('.campaign-briefing .map-foot .btn.primary'); await button('Take the call'); await wait('.stage-canvas');
  checks.push({label:'restricted-storage webview still loads and enters a match with an honest save warning'});
  await send('Page.removeScriptToEvaluateOnNewDocument',{identifier});
  assert.deepEqual(errors,[]);
  writeFileSync(`${output}/report.json`,JSON.stringify({pass:true,checks,errors,limitations:'Chromium touch emulation; not a physical iPhone or Snapchat session.'},null,2));
  console.log(JSON.stringify({pass:true,checks:checks.length,errors}));
} catch(error) {
  await shot('failure'); writeFileSync(`${output}/failure.json`,JSON.stringify({message:error.message,checks,errors},null,2));
  console.error(error); process.exitCode=1;
} finally { ws.close(); }
