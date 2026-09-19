import { availableTowers, loadoutCap, resolveLoadout } from '../../data/loadout';
import { mapById } from '../../data/maps';
import { remasterTitle } from '../../data/remasters';
import { TOWERS } from '../../data/towers';
import type { RemasterId, TowerId } from '../../data/types';
import type { App, ScreenView } from '../app';
import { h } from '../dom';
import { towerPortrait } from '../portraits';

export function renderLoadout(app: App, mapId: string, remaster: RemasterId = 'classic'): ScreenView {
  const map = mapById(mapId);
  if (!map) {
    app.go({ kind: 'hub' });
    return { el: h('div') };
  }
  if (remaster !== 'classic' && app.save.starsFor(map.id) <= 0) {
    app.go({ kind: 'hub' });
    return { el: h('div') };
  }
  if (map.endless && !app.save.nightShiftUnlocked()) {
    app.go({ kind: 'hub' });
    return { el: h('div') };
  }

  const available = availableTowers(app.save, map, remaster);
  const cap = loadoutCap(available);
  let picked = resolveLoadout(app.save.data.lastLoadout, available);

  const el = h('div', { class: 'screen loadout' });

  const paint = () => {
    el.replaceChildren();
    el.append(
      h(
        'header',
        { class: 'screen-header sheet' },
        h('button', { class: 'btn link', text: '← Van', onClick: () => app.go({ kind: 'hub' }) }),
        h('div', {}, h('div', { class: 'eyebrow', text: map.endless ? 'After hours' : map.subtitle }), h('h1', { text: 'Pack the truck' })),
      ),
      h(
        'p',
        { class: 'lede' },
        map.endless
          ? 'Same kit as the campaign — pick five tools you already earned. Nothing exclusive lives here.'
          : `Pick ${cap} tool${cap === 1 ? '' : 's'} for ${map.name}. ${remaster !== 'classic' ? remasterTitle(remaster) + ' changes what is legal. ' : ''}Later jobs teach new tools for the truck.`,
      ),
      h(
        'div',
        { class: 'kit-bar plate' },
        h('span', { class: 'eyebrow', text: 'On the truck' }),
        h('b', { text: `${picked.length} / ${cap}` }),
        ...picked.map((id) => h('span', { class: 'kit-chip', style: { borderColor: TOWERS[id].color }, text: TOWERS[id].name })),
      ),
      h(
        'div',
        { class: 'loadout-groups' },
        ...byRole(available).map((group) =>
          h(
            'section',
            { class: 'loadout-group' },
            h('h2', { class: 'loadout-role', text: group.role }),
            h(
              'div',
              { class: 'loadout-grid' },
              ...group.ids.map((id) => {
                const def = TOWERS[id];
                const on = picked.includes(id);
                const full = !on && picked.length >= cap;
                return h(
                  'button',
                  {
                    class: `loadout-card ${on ? 'on' : ''} ${full ? 'full' : ''}`,
                    disabled: full,
                    title: def.blurb,
                    onClick: () => {
                      if (on) picked = picked.filter((x) => x !== id);
                      else if (picked.length < cap) picked = [...picked, id];
                      paint();
                    },
                  },
                  towerPortrait(id, 72),
                  h('b', { text: def.name }),
                  h('span', { class: 'small muted', text: `$${def.levels[0].cost} to plant` }),
                  h('span', { class: 'swatch', style: { background: def.color } }),
                );
              }),
            ),
          ),
        ),
      ),
      h(
        'div',
        { class: 'btn-row loadout-actions' },
        h('button', {
          class: 'btn',
          text: 'Fill remaining',
          onClick: () => {
            picked = resolveLoadout(picked, available);
            paint();
          },
        }),
        h('button', {
          class: 'btn primary big',
          text: picked.length === cap ? (map.endless ? 'Clock in' : 'Take the call') : `Pick ${cap - picked.length} more`,
          disabled: picked.length !== cap,
          onClick: () => {
            app.save.setLoadout(picked);
            app.go({ kind: 'play', mapId: map.id, remaster, loadout: picked });
          },
        }),
      ),
    );
  };

  paint();
  return { el };
}

function byRole(ids: readonly TowerId[]): { role: string; ids: TowerId[] }[] {
  const order: string[] = [];
  const buckets = new Map<string, TowerId[]>();
  for (const id of ids) {
    const role = TOWERS[id].role;
    const bucket = buckets.get(role);
    if (bucket) bucket.push(id);
    else {
      buckets.set(role, [id]);
      order.push(role);
    }
  }
  return order.map((role) => ({ role, ids: buckets.get(role)! }));
}
