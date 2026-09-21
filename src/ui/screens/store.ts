import { TOWERS, TOWER_ORDER } from '../../data/towers';
import { TOWER_PRICES } from '../../data/store';
import type { App, ScreenView } from '../app';
import { h } from '../dom';
import { towerPortrait } from '../portraits';

export function renderStore(app: App): ScreenView {
  const el = h('div', { class: 'screen supply-store' });
  let filter: 'all' | 'affordable' | 'owned' = 'all', notice = 'Every tower is available from day one. Buy a permanent license with service points; install it in battle with cash.';
  const paint = () => {
    const save = app.save, points = save.data.servicePoints;
    const visible = TOWER_ORDER.filter(id => filter === 'all' || (filter === 'owned' ? save.data.ownedTowers.includes(id) : !save.data.ownedTowers.includes(id) && TOWER_PRICES[id] <= points));
    el.replaceChildren(h('header', { class: 'screen-header sheet' }, h('button', { class: 'btn link', text: '← Van', onClick: () => app.go({ kind: 'hub' }) }),
      h('div', {}, h('span', { class: 'eyebrow', text: 'Beckman supply co.' }), h('h1', { text: 'Build a better truck' })),
      h('span', { class: 'pill big service-points', text: `${points} service points` })),
      h('p', { class: 'lede', text: notice, attrs: { role: 'status' } }),
      h('p', { class: 'small muted', text: 'Wins pay the full service rate. Losses pay half the work completed; even partial combat earns points. Replays pay too. You keep your three starter tools and every purchase.' }),
      h('nav', { class: 'btn-row', attrs: { 'aria-label': 'Store filter' } }, ...(['all', 'affordable', 'owned'] as const).map(id => h('button', {
        class: `btn ${filter === id ? 'primary' : ''}`, text: id === 'all' ? 'All towers' : id === 'affordable' ? 'Affordable' : 'Owned', attrs: { 'aria-pressed': String(filter === id) }, onClick: () => { filter = id; paint(); },
      }))),
      h('div', { class: 'store-grid' }, ...visible.map(id => {
        const def = TOWERS[id], owned = save.data.ownedTowers.includes(id), price = TOWER_PRICES[id];
        return h('article', { class: `store-card sheet ${owned ? 'owned' : ''}`, attrs: { 'data-store-tower': id, style: `--tower-color: ${def.color}` } },
          h('div', { class: 'store-art' }, towerPortrait(id, 112)), h('span', { class: 'eyebrow', text: def.role }), h('h2', { text: def.name }),
          h('p', { text: def.blurb }), h('span', { class: 'small muted', text: `$${def.levels[0].cost} battlefield installation · ${def.targets === 'both' ? 'Ground & air' : def.targets === 'ground' ? 'Ground' : 'Air'}` }),
          h('button', { class: `btn ${!owned && points >= price ? 'primary' : ''}`, disabled: owned || points < price, attrs: { 'data-buy-tower': id },
            text: owned ? '✓ Owned' : points >= price ? `Buy · ${price} points` : `${price} points · need ${price - points} more`,
            onClick: () => { if (save.buyTower(id)) notice = `${def.name} is now on your truck. Pack it for any job; inspection bans still apply.`; paint(); } }));
      })),
      visible.length ? '' : h('p', { class: 'sheet empty', text: 'No new license at this balance. Play another job to earn service points, or browse All towers.' }));
  };
  paint(); return { el };
}
