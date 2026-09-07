import { ENEMIES, ENEMY_ORDER } from '../../data/enemies';
import type { App, ScreenView } from '../app';
import { h } from '../dom';
import { enemyPortrait } from '../portraits';

export function renderEncyclopedia(app: App): ScreenView {
  const save = app.save;
  const el = h(
    'div',
    { class: 'screen encyclopedia' },
    h(
      'header',
      { class: 'screen-header' },
      h('button', { class: 'btn link', text: '← Back', onClick: () => app.go({ kind: 'hub' }) }),
      h('h1', { text: 'Field Encyclopedia' }),
      h('span', { class: 'pill big', text: `${ENEMY_ORDER.filter((id) => save.hasSeen(id)).length} / ${ENEMY_ORDER.length} logged` }),
    ),
    h('p', { class: 'muted', text: 'Everything Jeff has met on the job. New threats are called out before the wave they first appear in.' }),
    h(
      'div',
      { class: 'ency-grid' },
      ...ENEMY_ORDER.map((id) => {
        const def = ENEMIES[id];
        const seen = save.hasSeen(id);
        return h(
          'article',
          { class: `ency-card ${seen ? '' : 'unknown'}` },
          h('div', { class: 'ency-portrait' }, enemyPortrait(id, 72, !seen)),
          h(
            'div',
            { class: 'ency-body' },
            h('h3', { text: seen ? def.name : '???' }),
            seen
              ? h(
                  'div',
                  {},
                  h('p', { class: 'small', text: def.fantasy }),
                  h('p', { class: 'small counter', html: `<b>Counter:</b> ${def.counters}` }),
                  h(
                    'div',
                    { class: 'stat-row' },
                    h('span', { class: 'stat', text: `HP ${def.hp}` }),
                    h('span', { class: 'stat', text: `Speed ${def.speed}` }),
                    def.armor > 0 ? h('span', { class: 'stat', text: `Armor ${Math.round(def.armor * 100)}%` }) : null,
                    def.flying ? h('span', { class: 'stat', text: 'Flying' }) : null,
                    h('span', { class: 'stat', text: `$${def.bounty}` }),
                  ),
                )
              : h('p', { class: 'small muted', text: 'Not yet encountered. Take more service calls.' }),
          ),
        );
      }),
    ),
  );
  return { el };
}
