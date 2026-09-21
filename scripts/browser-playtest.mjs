/** Production-browser acceptance using real mouse/key events, with no simulation hooks or added resources.
 * Start an isolated agent-browser session on the preview URL, then pass its CDP HTTP port:
 * node scripts/browser-playtest.mjs 52260 /tmp/jeff-playtest
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
  const code = key === 'Escape' ? 'Escape' : key === ' ' ? 'Space' : /^[0-9]$/.test(key) ? `Digit${key}` : `Key${key.toUpperCase()}`;
  await send('Input.dispatchKeyEvent', { type: 'keyDown', key, code, windowsVirtualKeyCode: key === 'Escape' ? 27 : key.toUpperCase().charCodeAt(0) });
  await send('Input.dispatchKeyEvent', { type: 'keyUp', key, code, windowsVirtualKeyCode: key === 'Escape' ? 27 : key.toUpperCase().charCodeAt(0) });
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
  await waitFor('.adventure-title, .hub, .results');
  const priorSave = await read(`JSON.parse(localStorage.getItem('jbtd-save-v1') || 'null')`);
  await send('Emulation.setDeviceMetricsOverride', { width: 1440, height: 960, deviceScaleFactor: 1, mobile: false });
  if (await read(`!!document.querySelector('.adventure-title')`)) await textButton(await read(`document.querySelector('.adventure-copy .btn.primary').textContent`));
  if (await read(`!!document.querySelector('.results')`)) await textButton('Back to the van');
  await textButton('Apprentice'); await shot('01-campaign');
  await click('[aria-label^="9. Heat Plant"]');
  assert(await read(`document.querySelector('.campaign-briefing').textContent.includes('Clear the previous job')`));
  await click('[aria-label^="1. Crawlspace"]');
  await click('.campaign-briefing .map-foot .btn.primary');
  const heroName = process.argv[4] ?? 'Jeff Beckman';
  await click(`[aria-label="Play as ${heroName}"]`);
  await shot('02-loadout'); await textButton('Take the call');
  if (await read(`!!document.querySelector('.coach-skip')`)) await textButton('Skip tutorial');
  await press('i'); await shot('03-scout');
  assert(await read(`document.querySelector('.battle-intel').textContent.includes('×6')`));
  await textButton('Back to defenses');
  await press('p'); await press('i'); await click('.intel-footer .btn.primary');
  assert(await read(`!!document.querySelector('.pause-overlay:not(.hidden)')`), 'Calling a wave from Scout must preserve manual pause.');
  assert.equal((await stats()).wave, '0 / 10', 'No wave starts while manually paused.');
  await press('p');
  const build = async (id, x, y, name) => {
    for (let attempt = 0; attempt < 4; attempt++) {
      if (await read(`!!document.querySelector('.results')`)) return false;
      await rankUp();
      await click(`[data-tower="${id}"]`); await world(x,y);
      await rankUp(); await world(x,y);
      if (await read(`document.querySelector('.kr-hub-name')?.textContent.includes(${JSON.stringify(name)})`)) return;
    }
    // Victory has a short presentation delay; a finishing job no longer accepts builds.
    await delay(1200);
    if (await read(`!!document.querySelector('.results')`)) return false;
    throw new Error(`Confirm ${name} was actually built.`);
  };
  let trained = false, abilityActivated = false, activeUsed = false, ranksPicked = 0, extra = 0, previousWave = '', nextReport = 0;
  await build('washer', 225, 250, 'Pressure Washer');
  await build('barricade', 100, 250, 'Shutoff Valve');
  await press('j'); await world(170, 275);
  assert(await read(`!document.querySelector('.jeff-card').classList.contains('ready-deploy')`), 'Hero must deploy from the truck.');
  await press(' '); await press('f'); await press('f');
  await press('d'); await world(160, 330);
  await press('i');
  const cdBefore = await read(`document.querySelector('.ab-crew .cooldown-number').textContent`);
  assert(Number(cdBefore) > 0, 'D must summon Logan.');
  await delay(1200);
  assert.equal(await read(`document.querySelector('.ab-crew .cooldown-number').textContent`), cdBefore, 'Scouting pauses the summoned companion cooldown.');
  await textButton('Back to defenses');
  // CBJ concentrates upgrades around his tower-damage aura.
  const plan = heroName === 'CBJ' ? [] : [['torch', 320, 340, 'Soldering Torch'], ['washer', 320, 465, 'Pressure Washer'], ['torch',420,280,'Soldering Torch']];
  async function rankUp() {
    while (await read(`!!document.querySelector('.rank-overlay:not(.hidden) .rank-skill:not(:disabled)')`)) {
      await click('.rank-overlay:not(.hidden) .rank-skill:not(:disabled)'); ranksPicked++;
    }
    // A combat hotkey can also legitimately choose a rank when that panel opens mid-input.
    ranksPicked = Math.max(ranksPicked, await read(`document.querySelectorAll('.ability .rank-pips > i.on').length`));
  };
  async function selectTower(x,y,name) {
    for(let retry=0;retry<4;retry++) {
      await rankUp();
      if(await read(`!!document.querySelector('.ability.aiming')`))await press('Escape');
      // Pick the visible tower body, clear of enemies walking along the adjoining lane.
      await world(x+8,y-28);
      const shown = await read(`document.querySelector('.kr-wheel:not(.hidden) .kr-hub-name')?.textContent`);
      // Elite specialization deliberately changes the building's display name.
      if(shown?.includes(name) || name==='Pressure Washer' && shown==='Tidal Artillery')return;
    }
    throw new Error(`Select ${name} through its visible sprite.`);
  }
  const started = Date.now();
  while (Date.now() - started < 240000) {
    await rankUp();
    const state = await stats(); if (state.result) break;
    if (Date.now() > nextReport) { console.log(JSON.stringify({ elapsed: Math.round((Date.now()-started)/1000), ...state, trained, activeUsed, ranksPicked })); nextReport = Date.now() + 15000; }
    if (state.wave !== previousWave) { previousWave = state.wave; await shot(`wave-${state.wave.split(' ')[0]}`); }
    if (await read(`!!document.querySelector('.jeff-card.ready-deploy')`)) { await press('j'); await world(170,275); }
    if (await read(`!!document.querySelector('.ab-crew.ready')`)) { await press('d'); await world(160,330); }
    if (await read(`!!document.querySelector('.ab-strike.ready')`)) { await press('x'); await world(160,250); }
    for (const key of ['q','r','t','c']) {
      await press(key);
      if(heroName==='CBJ' && key==='c' && await read(`!!document.querySelector('.ability.aiming')`))await world(160,250);
    }
    if(await read(`!!document.querySelector('.ability.aiming')`))await press('Escape');
    await rankUp();
    if (!trained || !activeUsed) {
      await selectTower(225,250,'Pressure Washer');
      if (await read(`!!document.querySelector('.kr-wheel:not(.hidden) .kr-spec.power:not(:disabled)')`)) await click('.kr-spec.power');
      if (!activeUsed && await read(`!!document.querySelector('.kr-ability:not(:disabled)')`)) {
        // A live kill may open the mandatory rank panel between selecting a tower and V.
        for(let retry=0;retry<3&&!activeUsed;retry++) {
          await selectTower(225,250,'Pressure Washer'); await press('v');
          activeUsed = await read(`document.querySelector('.kr-ability .kr-cost')?.textContent.endsWith('s')`);
        }
        assert(activeUsed, 'V starts the tower active cooldown through the normal controls.');
      }
      if (!trained && await read(`!!document.querySelector('.kr-wheel:not(.hidden) .kr-specialist-open')`)) {
        await click('.kr-specialist-open');
        if (await read(`!!document.querySelector('[data-ability="barrage"]:not(:disabled)')`)) {
          await click('[data-ability="barrage"]');
          trained = await read(`document.querySelector('[data-ability="barrage"]').getAttribute('aria-label').includes('rank 1 of 3')`);
          assert(trained); await shot('04-ability-trained');
          for (let i=0; i<100; i++) {
            await rankUp();
            const timer = await read(`document.querySelector('[data-ability-timer="barrage"]')?.textContent`);
            if (timer?.startsWith('Ready in')) { abilityActivated = true; await shot('04b-ability-activated'); break; }
            await delay(150);
          }
          assert(abilityActivated, 'Purchased specialist fires against a real target.');
        }
      } else if (!trained && await read(`!!document.querySelector('.kr-wheel:not(.hidden) .kr-up:not(:disabled)')`)) await press('u');
    } else if (plan[extra] && state.cash > 115) {
      const [id,x,y,name] = plan[extra]; if (await build(id,x,y,name) === false) break; extra++;
    } else {
      const [x,y] = [[225,250],[100,250],[320,340],[320,465]][Math.floor((Date.now()-started)/1000)%4];
      await world(x,y);
      if (await read(`!!document.querySelector('.kr-wheel:not(.hidden) .kr-up:not(:disabled)')`)) await press('u');
      if (await read(`!!document.querySelector('.kr-ability:not(:disabled)')`)) await press('v');
    }
    await delay(500);
  }
  await delay(1000);
  const final = await stats(); assert(final.result, `Run must finish: ${JSON.stringify(final)}`);
  assert(trained && abilityActivated && activeUsed && ranksPicked > 0, 'Both tower power systems and hero ranks must work in the same real run.');
  await shot('05-result');
  const saved = await read(`JSON.parse(localStorage.getItem('jbtd-save-v1'))`);
  const won = final.result.toLowerCase().includes('job complete');
  if (won) {
    assert(saved.stars.crawlspace.apprentice > 0);
    if (Object.values(priorSave?.stars?.crawlspace ?? {}).some(stars => stars > 0)) assert.equal(saved.inventory.length, priorSave.inventory.length, 'Replays must not duplicate first-clear gear.');
  }
  await textButton('Back to the van'); await shot('06-campaign-after');
  await send('Page.reload'); await waitFor('.adventure-copy .btn.primary'); await textButton('Back to the Van');
  assert(await read(`document.querySelector('[aria-label^="2. Boiler Room"]').getAttribute('aria-label').includes('Ready to play')`));
  assert.deepEqual(errors, []);
  const report = { pass: true, purpose: 'Production playthrough with ordinary resources', hero: heroName, difficulty: 'apprentice', won, lives: final.lives, abilitiesTrained: trained, abilityActivated, towerActiveUsed: activeUsed, heroRanksPicked: ranksPicked, xp: saved.jeffXp, gear: saved.inventory.length, errors, evidence: output };
  writeFileSync(`${output}/report.json`, JSON.stringify(report, null, 2)); console.log(JSON.stringify(report));
} finally { ws.close(); }
