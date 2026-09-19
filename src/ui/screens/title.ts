import type { App, ScreenView } from '../app';
import { h } from '../dom';
import { jeffPortrait, towerPortrait } from '../portraits';
import { WATERWORKS_ART } from '../../render/art';

export function renderTitle(app: App): ScreenView {
  const hasProgress = app.save.hasAnyProgress();
  const firstShift = app.save.needsTutorial();
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
        h('li', { html: 'Click a <b>pipe node</b> to build (keys <b>1–5</b> match the tray). Click a tower to upgrade (<b>U</b>) or sell. Shooters cycle aim with <b>A</b>: First, Strong, Close, Last.' }),
        h('li', { html: '<b>Your hero automatically fights</b> enemies in reach while guarding. <b>Tap a leak</b> to order a hunt. Choose Jeff, Big Mike, Robo Bob, Mr. Chris, or Becbec when packing the truck. <b>Select your hero</b>, then tap ground to post him somewhere else (right-click also works).' }),
        h('li', { html: '<b>Q</b> <b>E</b> <b>R</b> <b>T</b> <b>C</b> are your selected hero’s five abilities. <b>Space</b> call the wave · <b>F</b> fast-forward · <b>P</b> pause.' }),
        h('li', { html: '<b>D</b> calls two support crew onto a route for 18 seconds. Select a barricade and press <b>G</b> to move its rally point. Level-three towers can choose one of two <b>elite specializations</b>.' }),
        h('li', { html: 'Lose a job? Retry it. You still bank a little XP. Nothing is lost for good — you just owe the customer a callback.' }),
        h('li', { html: 'The <b>first</b> win on a job (and The Neverending Service Call mileposts) drops a <b>chest</b> of shared hero gear. The crew levels up and spends points on a <b>talent tree</b>. Towers never grind XP.' }),
        h('li', { html: 'After a Classic clear: opt-in <b>Code Inspection</b> and <b>Frozen Main</b>. After the first four service calls: <b>The Neverending Service Call</b> — the true endgame. Later jobs drop more gear. Clock out anytime.' }),
      ),
    ),
  );

  const el = h(
    'div',
    { class: 'screen title adventure-title', style: { backgroundImage: `linear-gradient(90deg, rgba(13,31,29,.96) 0%, rgba(16,34,28,.89) 40%, rgba(21,40,25,.2) 100%), url("${WATERWORKS_ART}")` } },
    h('header', { class: 'adventure-masthead' }, h('span', { class: 'brand-monogram', text: 'JB' }), h('span', { text: 'BECKMAN PLUMBING', class: 'eyebrow' }), h('span', { text: 'DEFENSE DIVISION', class: 'edition-label' })),
    h(
      'div',
      { class: 'adventure-copy' },
      h('div', { class: 'eyebrow', text: 'A wrench. A plan. One last line of defense.' }),
      h('h1', { text: 'Jeff Beckman' }),
      h('h2', { text: 'Tower Defense' }),
      h('p', { class: 'adventure-lede', text: 'The pressure is rising. Build your defenses, rally the crew, and choose from five heroes in a world of rogue boilers and runaway leaks.' }),
      h(
        'div',
        { class: 'btn-row' },
        h('button', {
          class: 'btn primary big',
          text: hasProgress ? 'Back to the Van' : 'Start Shift',
          onClick: () =>
            app.go(firstShift ? { kind: 'loadout', mapId: 'crawlspace', remaster: 'classic' } : { kind: 'hub' }),
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
              if (confirm('Wipe 90’s, talents, locker, skills and encyclopedia? This cannot be undone.')) {
                app.save.reset();
                app.go({ kind: 'title' });
              }
            },
          })
        : null,
    ),
    h('div', { class: 'adventure-hero', attrs: { 'aria-label': 'Jeff Beckman, bearded plumber with black ear gauges and a red pipe wrench' } }, jeffPortrait(460, true), h('div', { class: 'hero-nameplate' }, h('span', { class: 'eyebrow', text: 'Meet your foreman' }), h('b', { text: 'Jeff Beckman' }), h('span', { text: 'Plumber. Protector. Problem solver.' }))),
    h('footer', { class: 'adventure-footer' }, h('span', {}, h('b', { text: '09' }), ' CAMPAIGN MAPS'), h('span', {}, h('b', { text: '27' }), ' UNIQUE TOWERS'), h('span', {}, h('b', { text: '54' }), ' ELITE SPECIALIZATIONS'), h('span', { class: 'footer-note', text: 'The Neverending Service Call' })),
    how,
  );
  return { el };
}
