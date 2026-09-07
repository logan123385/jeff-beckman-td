import type { App, ScreenView } from '../app';
import { h } from '../dom';
import { jeffPortrait } from '../portraits';

export function renderTitle(app: App): ScreenView {
  const hasProgress = app.save.totalStars() > 0;
  const el = h(
    'div',
    { class: 'screen title' },
    h(
      'div',
      { class: 'title-card' },
      h('div', { class: 'title-portrait' }, jeffPortrait(120)),
      h('div', { class: 'eyebrow', text: 'Beckman Plumbing & Hydronics presents' }),
      h('h1', { text: 'Jeff Beckman' }),
      h('h2', { text: 'Tower Defense' }),
      h('p', { class: 'tagline', text: '“That’s not supposed to hiss.”' }),
      h(
        'div',
        { class: 'btn-row' },
        h('button', { class: 'btn primary big', text: hasProgress ? 'Back to the Van' : 'Start Shift', onClick: () => app.go({ kind: 'hub' }) }),
        h('button', { class: 'btn', text: 'Encyclopedia', onClick: () => app.go({ kind: 'encyclopedia' }) }),
      ),
      h(
        'div',
        { class: 'how' },
        h('h3', { text: 'How it works' }),
        h(
          'ul',
          {},
          h('li', { html: 'Click a <b>pipe node</b> to build a tower. Click a tower to upgrade or sell.' }),
          h('li', { html: '<b>Right-click</b> anywhere (or select Jeff then click) to send Jeff. He patches, stuns, and holds — towers do the heavy lifting.' }),
          h('li', { html: '<b>Q</b> Pipe Clamp · <b>E</b> Emergency Shutoff · <b>Space</b> call the next wave early for bonus cash · <b>F</b> fast-forward · <b>P</b> pause.' }),
          h('li', { html: 'Lose a job? Retry it. Nothing is lost for good — you just owe the customer a callback.' }),
        ),
      ),
      hasProgress
        ? h('button', {
            class: 'btn link danger',
            text: 'Reset all progress',
            onClick: () => {
              if (confirm('Wipe stars, skills and encyclopedia? This cannot be undone.')) {
                app.save.reset();
                app.go({ kind: 'title' });
              }
            },
          })
        : null,
    ),
  );
  return { el };
}
