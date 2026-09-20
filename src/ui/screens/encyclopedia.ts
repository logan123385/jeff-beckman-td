import { ENEMIES, ENEMY_ORDER, TRAIT_LABEL } from '../../data/enemies';
import { LEAK_PROPERTIES, PROPERTY_HINT, PROPERTY_LABEL } from '../../data/leakProperties';
import { leakRbe, SPLIT_CHAIN } from '../../data/splits';
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
      { class: 'screen-header sheet' },
      h('button', { class: 'btn link', text: '← Van', onClick: () => app.go({ kind: 'hub' }) }),
      h('h1', { text: 'Field Encyclopedia' }),
      h('span', { class: 'pill big', text: `${ENEMY_ORDER.filter((id) => save.hasSeen(id)).length} / ${ENEMY_ORDER.length} logged` }),
    ),
    h('p', { class: 'lede', text: 'Everything Jeff has met on the job. New threats are called out before the wave they first appear in. Later calls stack leak properties on top of the base gremlin. Big leaks split when they pop — splash the children.' }),
    h(
      'section',
      { class: 'prop-guide sheet' },
      h('h2', { text: 'Stacked leak properties' }),
      h('p', { class: 'small muted', text: 'Like lead and ceramic bloons, these flags combine. A pressurized mineral-lined sludge is all three problems at once. Nothing here is invisible — Inspection Camera still marks and pops airlocks.' }),
      h(
        'div',
        { class: 'prop-grid' },
        ...LEAK_PROPERTIES.map((id) =>
          h(
            'article',
            { class: `prop-card prop-${id}` },
            h('h3', { text: PROPERTY_LABEL[id] }),
            h('p', { class: 'small', text: PROPERTY_HINT[id] }),
          ),
        ),
      ),
    ),
    h(
      'section',
      { class: 'prop-guide sheet' },
      h('h2', { text: 'Layered pops' }),
      h('p', { class: 'small muted', text: 'Kill the jacket, not the job. A Scale Crab sheds two Drips. A Sediment Boulder becomes Lime Scale, then crabs, then drips. Pressurized mains shed one extra child. Letting a parent walk off costs the whole family — pop them on the pipe, then splash. RUSH waves pack the parents tight so the children flood if you miss.' }),
      h(
        'div',
        { class: 'prop-grid' },
        ...SPLIT_CHAIN.filter((row) => save.hasSeen(row.parent)).map((row) =>
          h(
            'article',
            { class: 'prop-card prop-split' },
            h('h3', { text: ENEMIES[row.parent].name }),
            h('p', { class: 'small', text: `${row.label} · ${leakRbe(row.parent)} lives if they walk` }),
          ),
        ),
      ),
    ),
    h(
      'div',
      { class: 'ency-grid' },
      ...ENEMY_ORDER.map((id) => {
        const def = ENEMIES[id];
        const seen = save.hasSeen(id);
        return h(
          'article',
          { class: `ency-card sheet ${seen ? '' : 'unknown'}` },
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
                    ...def.traits.map((trait) => h('span', { class: 'stat', text: TRAIT_LABEL[trait] })),
                    def.traits.includes('splits') ? h('span', { class: 'stat', text: `${leakRbe(id)} lives if they walk` }) : null,
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
