import { affixLabel, GEAR_SLOTS, RARITY_LABEL, SLOT_LABEL } from '../../data/loot';
import { JEFF_LEVEL_CAP, levelFromXp, xpBarCopy } from '../../data/xp';
import type { GearItem, GearSlot } from '../../data/types';
import type { App, ScreenView } from '../app';
import { clear, h } from '../dom';
import { heroPortrait } from '../portraits';

export function renderLocker(app: App): ScreenView {
  const save = app.save;
  const el = h('div', { class: 'screen locker' });

  const render = () => {
    clear(el);
    const xp = levelFromXp(save.data.jeffXp);
    el.append(
      h(
        'header',
        { class: 'screen-header sheet' },
        h('button', { class: 'btn link', text: '← Van', onClick: () => app.go({ kind: 'hub' }) }),
        h('h1', { text: 'Crew Locker' }),
        h('span', { class: 'pill big', text: xp.level >= JEFF_LEVEL_CAP ? `Lv ${xp.level} · ${xpBarCopy(xp)}` : `Lv ${xp.level} · ${xp.into} / ${xp.need} XP` }),
      ),
      h('p', { class: 'lede', text: 'First-clear job chests and The Neverending Service Call mileposts drop gear. All heroes share the same five equipped gear slots. Inventory is 24 — extras salvage into XP. Nothing here is exclusive to The Neverending Service Call.' }),
      h(
        'div',
        { class: 'locker-layout' },
        h(
          'div',
          { class: 'equip-col sheet' },
          h('div', { class: 'locker-jeff' }, heroPortrait(save.data.selectedHero, 96)),
          ...GEAR_SLOTS.map((slot) => {
            const id = save.data.equipped[slot];
            const item = id ? save.itemById(id) : undefined;
            return h(
              'div',
              { class: `equip-slot ${item ? `rarity-${item.rarity}` : ''}` },
              h('div', { class: 'eyebrow', text: SLOT_LABEL[slot] }),
              item
                ? h(
                    'div',
                    {},
                    h('b', { text: item.name }),
                    h('div', { class: 'small muted', text: RARITY_LABEL[item.rarity] }),
                    ...item.affixes.map((a) => h('div', { class: 'small', text: affixLabel(a) })),
                    h('button', { class: 'btn link', text: 'Unequip', onClick: () => { save.unequip(slot); render(); } }),
                  )
                : h('div', { class: 'small muted', text: 'Empty' }),
            );
          }),
        ),
        h(
          'div',
          { class: 'inv-col sheet' },
          h('h3', { text: `Inventory · ${save.data.inventory.length} / 24` }),
          save.data.inventory.length === 0
            ? h('p', { class: 'muted', text: 'First-clear a job or clock a The Neverending Service Call milepost. Chests show up on the results card.' })
            : h('div', { class: 'inv-grid' }, ...save.data.inventory.map((item) => invCard(app, item, render))),
        ),
      ),
    );
  };
  render();
  return { el };
}

function invCard(app: App, item: GearItem, render: () => void): HTMLElement {
  const equipped = app.save.data.equipped[item.slot] === item.id;
  return h(
    'article',
    { class: `gear-card rarity-${item.rarity} ${equipped ? 'equipped' : ''}` },
    h('div', { class: 'eyebrow', text: `${SLOT_LABEL[item.slot as GearSlot]} · ${RARITY_LABEL[item.rarity]}` }),
    h('b', { text: item.name }),
    ...item.affixes.map((a) => h('div', { class: 'small', text: affixLabel(a) })),
    h(
      'div',
      { class: 'btn-row' },
      h('button', {
        class: 'btn primary',
        text: equipped ? 'Equipped' : 'Equip',
        disabled: equipped,
        onClick: () => {
          app.save.equip(item.id);
          render();
        },
      }),
      h('button', {
        class: 'btn danger',
        text: 'Salvage',
        onClick: () => {
          if (confirm(`Salvage ${item.name} for XP?`)) {
            app.save.salvage(item.id);
            render();
          }
        },
      }),
    ),
  );
}
