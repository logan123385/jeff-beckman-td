import type { App, ScreenView } from '../app';
import { h } from '../dom';
import { persistRow } from '../persist';
import { jeffPortrait, towerPortrait } from '../portraits';
import { TOWER_ORDER } from '../../data/towers';
import { HERO_ORDER } from '../../data/heroes';
import { TITLE_ART } from '../../render/art';

export function renderTitle(app: App): ScreenView {
  const hasProgress = app.save.hasAnyProgress();
  const how = h(
    'div',
    {
      class: 'overlay how-overlay hidden',
      attrs: { role: 'dialog', 'aria-modal': 'true', 'aria-label': 'How it works' },
      onClick: () => closeHow(),
    },
    h(
      'div',
      {
        class: 'how-card paper',
        onClick: (ev) => ev.stopPropagation(),
      },
      h(
        'header',
        { class: 'how-card-head' },
        h('div', { class: 'eyebrow', text: 'Field notes' }),
        h('button', { class: 'btn link', text: 'Close', onClick: () => closeHow() }),
      ),
      h('h2', { text: 'How it works' }),
      h('p', { class: 'how-essential', html: '<b>Need to leave?</b> Tap <b>Pause → Main menu → Leave match</b>. Completed progress stays safe; an unfinished match is abandoned. In the endless service call, use <b>Clock out</b> to bank rewards first.' }),
      h(
        'ul',
        {},
        h('li', { html: 'Before a job, <b>pack up to five tools</b> you own. The <b>Supply Store</b> sells every tower from the start for service points. Wins earn more; losses still earn points for the work you completed.' }),
        h('li', { html: '<b>Tap a tool, then a glowing pipe pad</b> to build. Tap a tower to upgrade, sell, or change its aim. Tap <b>Cancel</b> to put a tool away. On a keyboard: <b>1–5</b> select tools, <b>U</b> upgrades, and <b>A</b> cycles aim.' }),
        h('li', { html: '<b>Your hero automatically fights</b> enemies in reach while guarding. <b>Tap a leak</b> to order a hunt. Choose your hero when packing the truck: Jeff, Big Mike, Robo Bob, Mr. Chris, Becbec, CBJ, Doni, or Jayjay. <b>Select your hero</b>, then tap ground to post him somewhere else (right-click also works).' }),
h('li', { html: '<b>Tap the ability buttons</b>, then a target on the battlefield. <b>Q E R T C</b> are the keyboard shortcuts for your hero’s five abilities. Select a tool and press <b>V</b> to fire its active (costs spare parts from pops). <b>X</b> torch rain · <b>D</b> Summon Logan · <b>Space</b> call the wave · <b>F</b> 1×/2×/3× · <b>P</b> pause.' }),
        h('li', { html: '<b>D</b> summons <b>Logan</b> onto a route for 18 seconds — every hero shares him. <b>X</b> drops three fire dumps on a point you pick. Select a barricade and press <b>G</b> to move its hold / rally point. Level-three towers can choose one of two <b>elite specializations</b>.' }),
        h('li', { html: 'Lose a job? Retry it. You still bank a little XP. Nothing is lost for good — you just owe the customer a callback. <b>Big leaks split</b> when they pop (Scale Crab → drips, boulder → lime → crabs). Splash the children. Letting a parent walk off costs the whole family. <b>RUSH</b> waves pack parents tight — the washer earns its keep.' }),
        h('li', { html: 'The <b>first</b> win on a job (and The Neverending Service Call mileposts) drops a <b>chest</b> of shared hero gear. Open <b>Kit</b> to slot weapons, armor, and stance cards before each call. Towers never grind XP.' }),
        h('li', { html: 'After a Classic clear: opt-in <b>Code Inspection</b>, <b>Frozen Main</b>, <b>Cash Job</b> (no selling, truck money only, one leak), and <b>Clean Hands</b> (CHIMPS — no selling, no actives, no Logan, no torch rain, one leak). After the first four service calls: <b>The Neverending Service Call</b> — the true endgame. Later jobs drop more gear. Clock out anytime.' }),
      ),
      h('p', { class: 'small muted', text: 'Progress is saved in this browser on this device. Download save and Restore save let you move it to another browser. For a larger play area on your phone, open in Safari or Chrome and turn your phone sideways.' }),
    ),
  );
  let howFocus: HTMLElement | null = null;
  const closeHow = () => {
    how.classList.add('hidden');
    howFocus?.focus({ preventScroll: true });
  };
  const onHowKey = (event: KeyboardEvent) => {
    if (how.classList.contains('hidden')) return;
    if (event.key === 'Escape') { event.preventDefault(); closeHow(); }
    if (event.key === 'Tab') { event.preventDefault(); how.querySelector('button')?.focus(); }
  };
  document.addEventListener('keydown', onHowKey);

  const el = h(
    'div',
    { class: 'screen title adventure-title', style: { backgroundImage: `linear-gradient(90deg, rgba(7,22,29,.45), rgba(7,22,29,.15) 48%, transparent 75%), url("${TITLE_ART}")` } },
    h('div', { class: 'scene-motes', attrs: { 'aria-hidden': 'true' } }, ...Array.from({ length: 8 }, (_, i) => h('i', { attrs: { style: `--i:${i}` } }))),
    h('header', { class: 'adventure-masthead' }, h('span', { class: 'brand-monogram', text: 'JB' }), h('span', { text: 'BECKMAN PLUMBING', class: 'eyebrow' }), h('span', { text: 'DEFENSE DIVISION', class: 'edition-label' })),
    h(
      'div',
      { class: 'adventure-copy' },
      h('div', { class: 'eyebrow title-chapter', text: 'The legends of Beckman County' }),
      h('h1', { text: 'Jeff Beckman' }),
      h('h2', { text: 'Tower Defense' }),
      h('p', { class: 'adventure-lede', text: 'The pressure is rising. Build your defenses, rally the crew, and choose from eight heroes in a world of rogue boilers and runaway leaks.' }),
      h(
        'div',
        { class: 'btn-row' },
        h('button', {
          class: 'btn primary big',
          text: hasProgress ? 'Back to the Van' : 'Start Shift',
          onClick: () =>
            app.go({ kind: 'hub' }),
        }),
        h('button', { class: 'btn', text: 'How it works', onClick: () => { howFocus = document.activeElement as HTMLElement; document.body.append(how); how.classList.remove('hidden'); how.querySelector('button')?.focus(); } }),
        h('button', { class: 'btn', text: 'Encyclopedia', onClick: () => app.go({ kind: 'encyclopedia' }) }),
      ),
      h('div', { class: 'title-toolkit' }, ...(['torch', 'washer', 'barricade'] as const).map(id => towerPortrait(id, 84)), h('span', { text: 'BUILD. UPGRADE. HOLD THE LINE.' })),
      hasProgress
        ? h('button', {
            class: 'btn link danger',
            text: 'Reset all progress',
            onClick: async () => {
              if (await app.confirmation.show({ title: 'Reset your progress?', message: 'This clears your kit, locker and campaign progress. A backup stays on this device. Download your save first if you want to keep a separate copy.', confirmLabel: 'Reset progress' })) {
                app.save.reset();
                app.go({ kind: 'title' });
              }
            },
          })
        : null,
      persistRow(app.save, app),
    ),
    h('div', { class: 'adventure-hero', attrs: { 'aria-label': 'Jeff Beckman, bearded plumber with black ear gauges and a red pipe wrench' } }, jeffPortrait(460, true), h('div', { class: 'hero-nameplate' }, h('span', { class: 'eyebrow', text: 'Meet your foreman' }), h('b', { text: 'Jeff Beckman' }), h('span', { text: 'Plumber. Protector. Problem solver.' }))),
    h('footer', { class: 'adventure-footer' }, h('span', {}, h('b', { text: '09' }), ' CAMPAIGN MAPS'), h('span', {}, h('b', { text: String(TOWER_ORDER.length) }), ' UNIQUE TOWERS'), h('span', {}, h('b', { text: String(TOWER_ORDER.length * 2) }), ' ELITE SPECIALIZATIONS'), h('span', { class: 'footer-note', text: `${HERO_ORDER.length} PLAYABLE HEROES` })),
    how,
  );
  return { el, dispose: () => { how.remove(); document.removeEventListener('keydown', onHowKey); } };
}
