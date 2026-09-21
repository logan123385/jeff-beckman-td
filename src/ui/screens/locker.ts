import { affixLabel, RARITY_LABEL } from '../../data/loot';
import { JEFF_LEVEL_CAP, levelFromXp, xpBarCopy } from '../../data/xp';
import type { ArmorSlot, KitItem } from '../../data/types';
import type { App, ScreenView } from '../app';
import { clear, h } from '../dom';
import { heroPortrait } from '../portraits';

const ARMOR_SLOTS: ArmorSlot[] = ['chest', 'boots'];
const SLOT_LABEL: Record<ArmorSlot, string> = { chest: 'Chest', boots: 'Boots' };

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
      h('p', { class: 'lede', text: 'First-clear job chests and The Neverending Service Call mileposts drop gear. Shared chest and boots slots. Inventory is 24 — extras salvage into XP.' }),
      h(
        'div',
        { class: 'locker-layout' },
        h(
          'div',
          { class: 'equip-col sheet' },
          h('div', { class: 'locker-jeff' }, heroPortrait(save.data.selectedHero, 96)),
          ...ARMOR_SLOTS.map((slot) => {
            const id = slot === 'chest' ? save.data.chestId : save.data.bootsId;
            const item = id ? save.itemById(id) : undefined;
            const armor = item?.kind === 'armor' ? item : undefined;
            return h(
              'div',
              { class: `equip-slot ${armor ? `rarity-${armor.rarity}` : ''}` },
              h('div', { class: 'eyebrow', text: SLOT_LABEL[slot] }),
              armor
                ? h(
                    'div',
                    {},
                    h('b', { text: armor.name }),
                    h('div', { class: 'small muted', text: RARITY_LABEL[armor.rarity] }),
                    ...armor.affixes.map((a) => h('div', { class: 'small', text: affixLabel(a) })),
                    h('button', { class: 'btn link', text: 'Unequip', onClick: () => { save.unequipArmor(slot); render(); } }),
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

function invCard(app: App, item: KitItem, render: () => void): HTMLElement {
  const equipped =
    (item.kind === 'armor' && item.slot === 'chest' && app.save.data.chestId === item.id) ||
    (item.kind === 'armor' && item.slot === 'boots' && app.save.data.bootsId === item.id);
  const slotLabel = item.kind === 'armor' ? SLOT_LABEL[item.slot] : 'Weapon';
  return h(
    'article',
    { class: `gear-card rarity-${item.rarity} ${equipped ? 'equipped' : ''}` },
    h('div', { class: 'eyebrow', text: `${slotLabel} · ${RARITY_LABEL[item.rarity]}` }),
    h('b', { text: item.name }),
    ...item.affixes.map((a) => h('div', { class: 'small', text: affixLabel(a) })),
    h(
      'div',
      { class: 'btn-row' },
      item.kind === 'armor'
        ? h('button', {
            class: 'btn primary',
            text: equipped ? 'Equipped' : 'Equip',
            disabled: equipped,
            onClick: () => {
              app.save.equipArmor(item.id);
              render();
            },
          })
        : h('span', { class: 'small muted', text: 'Equip from Kit screen' }),
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
