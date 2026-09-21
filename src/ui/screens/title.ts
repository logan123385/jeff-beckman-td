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
      onClick: () => how.classList.add('hidden'),
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
        h('button', { class: 'btn link', text: 'Close', onClick: () => how.classList.add('hidden') }),
      ),
      h('h2', { text: 'How it works' }),
      h(
        'ul',
        {},
        h('li', { html: 'Before a job, <b>pack five tools</b> from what the truck has learned. Early calls have a smaller bag. Later jobs teach new tools.' }),
        h('li', { html: 'Click a <b>pipe node</b> to build (keys <b>1–5</b> match the tray). Click a tower to upgrade (<b>U</b>) or sell. Shooters cycle aim with <b>A</b>: First, Strong, Close, Last, <b>Weak</b>.' }),
        h('li', { html: '<b>Your hero automatically fights</b> enemies in reach while guarding. <b>Tap a leak</b> to order a hunt. Choose your hero when packing the truck: Jeff, Big Mike, Robo Bob, Mr. Chris, Becbec, CBJ, Doni, or Jayjay. <b>Select your hero</b>, then tap ground to post him somewhere else (right-click also works).' }),
h('li', { html: '<b>Q</b> <b>E</b> <b>R</b> <b>T</b> <b>C</b> are your selected hero’s five abilities. Select a tool and press <b>V</b> to fire its active (costs spare parts from pops). <b>X</b> torch rain · <b>D</b> Summon Logan · <b>Space</b> call the wave · <b>F</b> 1×/2×/3× · <b>P</b> pause.' }),
        h('li', { html: '<b>D</b> summons <b>Logan</b> onto a route for 18 seconds — every hero shares him. <b>X</b> drops three fire dumps on a point you pick. Select a barricade and press <b>G</b> to move its hold / rally point. Level-three towers can choose one of two <b>elite specializations</b>.' }),
        h('li', { html: 'Lose a job? Retry it. You still bank a little XP. Nothing is lost for good — you just owe the customer a callback. <b>Big leaks split</b> when they pop (Scale Crab → drips, boulder → lime → crabs). Splash the children. Letting a parent walk off costs the whole family. <b>RUSH</b> waves pack parents tight — the washer earns its keep.' }),
        h('li', { html: 'The <b>first</b> win on a job (and The Neverending Service Call mileposts) drops a <b>chest</b> of shared hero gear. The crew levels up and spends points on a <b>talent tree</b>. Towers never grind XP.' }),
        h('li', { html: 'After a Classic clear: opt-in <b>Code Inspection</b>, <b>Frozen Main</b>, <b>Cash Job</b> (no selling, truck money only, one leak), and <b>Clean Hands</b> (CHIMPS — no selling, no actives, no Logan, no torch rain, one leak). After the first four service calls: <b>The Neverending Service Call</b> — the true endgame. Later jobs drop more gear. Clock out anytime.' }),
      ),
    ),
  );

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
        h('button', { class: 'btn', text: 'How it works', onClick: () => how.classList.remove('hidden') }),
        h('button', { class: 'btn', text: 'Encyclopedia', onClick: () => app.go({ kind: 'encyclopedia' }) }),
      ),
      h('div', { class: 'title-toolkit' }, ...(['torch', 'washer', 'barricade'] as const).map(id => towerPortrait(id, 84)), h('span', { text: 'BUILD. UPGRADE. HOLD THE LINE.' })),
      hasProgress
        ? h('button', {
            class: 'btn link danger',
            text: 'Reset all progress',
            onClick: () => {
              if (confirm('Wipe 90’s, talents, locker, skills and encyclopedia? A backup copy stays on this device. Download your save first if you might want it back.')) {
                app.save.reset();
                app.go({ kind: 'title' });
              }
            },
          })
        : null,
      persistRow(app.save),
    ),
    h('div', { class: 'adventure-hero', attrs: { 'aria-label': 'Jeff Beckman, bearded plumber with black ear gauges and a red pipe wrench' } }, jeffPortrait(460, true), h('div', { class: 'hero-nameplate' }, h('span', { class: 'eyebrow', text: 'Meet your foreman' }), h('b', { text: 'Jeff Beckman' }), h('span', { text: 'Plumber. Protector. Problem solver.' }))),
    h('footer', { class: 'adventure-footer' }, h('span', {}, h('b', { text: '09' }), ' CAMPAIGN MAPS'), h('span', {}, h('b', { text: String(TOWER_ORDER.length) }), ' UNIQUE TOWERS'), h('span', {}, h('b', { text: String(TOWER_ORDER.length * 2) }), ' ELITE SPECIALIZATIONS'), h('span', { class: 'footer-note', text: `${HERO_ORDER.length} PLAYABLE HEROES` })),
    how,
  );
  return { el };
}
