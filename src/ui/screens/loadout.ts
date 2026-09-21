import { ABILITY_KEYS, HEROES, HERO_ORDER } from '../../data/heroes';
import { skillGlyph } from '../play/icons';
import { availableTowers, loadoutCap, resolveLoadout } from '../../data/loadout';
import { mapById } from '../../data/maps';
import { remasterTitle } from '../../data/remasters';
import { TOWERS } from '../../data/towers';
import type { RemasterId, TowerId } from '../../data/types';
import type { App, ScreenView } from '../app';
import { h } from '../dom';
import { heroPortrait, towerPortrait } from '../portraits';
import { CAMPAIGN_LOCATIONS } from '../../data/campaign';
import { enemyForMap } from '../../data/bosses';
import { enemyTraits, loadoutWarnings } from '../../data/intel';

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
  if (map.endless && !app.save.serviceCallUnlocked()) {
    app.go({ kind: 'hub' });
    return { el: h('div') };
  }

  const available = availableTowers(app.save, map, remaster);
  const cap = loadoutCap(available);
  let picked = resolveLoadout(app.save.data.lastLoadout, available);

  const el = h('div', { class: 'screen loadout' });

  const heroPicker = () => {
    const selected = HEROES[app.save.data.selectedHero];
    return h('section', { class: 'hero-roster sheet', attrs: { 'aria-label': 'Choose your hero' } },
      h('div', { class: 'hero-roster-heading' }, h('div', {}, h('span', { class: 'eyebrow', text: 'Five legends. One service call.' }), h('h2', { text: 'Who’s taking the call?' })), h('span', { class: 'pill', text: 'All heroes available' })),
      h('div', { class: 'hero-roster-grid', attrs: { role: 'group', 'aria-label': 'Playable heroes' } }, ...HERO_ORDER.map(id => {
        const hero = HEROES[id], on = selected.id === id;
        return h('button', { class: `hero-roster-card ${on ? 'selected' : ''}`, attrs: { style: `--hero-color: ${hero.color}`,  'aria-pressed': String(on), 'aria-label': `Play as ${hero.name}` },
          onClick: () => { app.save.setHero(id); paint(); el.querySelector<HTMLButtonElement>(`[aria-label="Play as ${hero.name}"]`)?.focus({ preventScroll: true }); } },
          h('span', { class: 'hero-roster-check', text: on ? 'SELECTED' : 'SELECT HERO' }),
          h('div', { class: 'hero-roster-art' }, heroPortrait(id, 132)),
          h('b', { text: hero.name }), h('span', { class: 'hero-roster-style', text: hero.style }));
      })),
      h('div', { class: 'hero-dossier', attrs: { style: `--hero-color: ${selected.color}`,  'aria-live': 'polite' } },
        h('div', { class: 'hero-dossier-intro' }, h('span', { class: 'eyebrow', text: selected.title }), h('p', { text: selected.description }),
          h('div', { class: 'hero-statline', text: `${selected.hp} HP  ·  ${selected.ranged ? 'Ranged' : 'Melee'}  ·  ${selected.damage} damage  ·  ${selected.reach} reach` })),
        h('div', { class: 'hero-aura-card' }, h('span', { class: 'eyebrow', text: 'Always active aura' }), h('b', { text: selected.aura.name }), h('p', { text: selected.aura.description })),
        h('div', { class: 'hero-kit' }, ...selected.abilities.map((a, index) => h('div', { class: 'hero-kit-skill', title: a.description },
          h('span', { class: 'hero-kit-icon', html: skillGlyph(a.glyph) }), h('div', {}, h('b', { text: a.name }), h('span', { text: a.description })),
          h('span', { class: 'hero-kit-key', text: `${ABILITY_KEYS[index]} · ${a.cooldown}s` })))),
      ));
  };

  const paint = () => {
    el.replaceChildren();
    el.append(
      h(
        'header',
        { class: 'screen-header sheet' },
        h('button', { class: 'btn link', text: '← Van', onClick: () => app.go({ kind: 'hub' }) }),
        h('div', {}, h('div', { class: 'eyebrow', text: map.endless ? 'After hours' : map.subtitle }), h('h1', { text: 'Pack the truck' })),
      ),
      h('section', { class: 'loadout-brief sheet', attrs: { 'aria-label': 'Mission intelligence' } },
        h('div', {}, h('span', { class: 'eyebrow', text: 'Mission intelligence' }), h('h2', { text: map.name }),
          h('p', { text: CAMPAIGN_LOCATIONS[map.id]?.tactic ?? map.blurb })),
        h('div', { class: 'loadout-threats' }, h('b', { text: `${map.endless ? 'Endless waves' : `${map.waves.length} waves`} · ${map.paths.length} ${map.paths.length === 1 ? 'route' : 'routes'} · $${map.startMoney} base budget` }),
          ...[...new Set(map.waves.flatMap(w => w.groups.map(g => g.enemy)))].map(id => {
            const enemy = enemyForMap(id, map.id);
            return h('span', { class: 'pill', text: enemy.name, title: `${enemyTraits(enemy).join(' · ')}. ${enemy.counters}` });
          }))),
      heroPicker(),
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
      ...loadoutWarnings(map, picked).map(text => h('p', { class: 'loadout-warning', text: `⚑ ${text}`, attrs: { role: 'status' } })),
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
