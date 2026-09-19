import type { App, ScreenView } from '../app';
import { h } from '../dom';
import { jeffPortrait } from '../portraits';

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
        h('li', { html: '<b>Tap a leak</b> to send Jeff’s wrench — every tap is an attack order, Diablo-style. <b>Select Jeff</b>, then tap empty ground to move (right-click also works on desktop). Towers still do the heavy lifting.' }),
        h('li', { html: '<b>Q</b> Pipe Clamp · <b>E</b> Shutoff · <b>R</b> Manometer Pulse · <b>T</b> Isolation Sleeve · <b>C</b> Coffee · <b>Space</b> call the wave · <b>F</b> fast-forward · <b>P</b> pause.' }),
        h('li', { html: 'Lose a job? Retry it. You still bank a little XP. Nothing is lost for good — you just owe the customer a callback.' }),
        h('li', { html: 'The <b>first</b> win on a job (and Night Shift mileposts) drops a <b>chest</b> of gear for Jeff. He levels up and spends points on a <b>talent tree</b>. Towers never grind XP.' }),
        h('li', { html: 'After a Classic clear: opt-in <b>Code Inspection</b> and <b>Frozen Main</b>. After the first four service calls: <b>Night Shift</b> — the true endgame. Later jobs drop more gear. Clock out anytime.' }),
      ),
    ),
  );

  const el = h(
    'div',
    { class: 'screen title' },
    h('div', { class: 'title-pipes', attrs: { 'aria-hidden': 'true' } }),
    h('div', { class: 'title-steam', attrs: { 'aria-hidden': 'true' } }),
    h(
      'div',
      { class: 'title-card work-order sheet' },
      h('div', { class: 'title-stamp', text: 'Licensed · Bonded', attrs: { 'aria-hidden': 'true' } }),
      h('div', { class: 'title-portrait' }, jeffPortrait(120)),
      h('div', { class: 'eyebrow', text: 'Beckman Plumbing & Hydronics presents' }),
      h('h1', { text: 'Jeff Beckman' }),
      h('h2', { text: 'Tower Defense' }),
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
      h('p', { class: 'company-foot', text: 'Hydronic heating · Service calls · Night shift' }),
      hasProgress
        ? h('button', {
            class: 'btn link danger',
            text: 'Reset all progress',
            onClick: () => {
              if (confirm('Wipe stars, talents, locker, skills and encyclopedia? This cannot be undone.')) {
                app.save.reset();
                app.go({ kind: 'title' });
              }
            },
          })
        : null,
    ),
    how,
  );
  return { el };
}
