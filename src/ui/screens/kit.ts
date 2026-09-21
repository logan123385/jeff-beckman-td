import { affixLabel, RARITY_LABEL } from '../../data/loot';
import { HEROES, HERO_ORDER, type HeroId } from '../../data/heroes';
import { cardById, cardUnlocked, cardsFor } from '../../data/kitCards';
import type { ArmorSlot, KitItem } from '../../data/types';
import { familyLabel, familyStance, type WeaponFamilyId } from '../../data/weapons';
import type { HeroKit } from '../../save/save';
import type { App, ScreenView } from '../app';
import { clear, h } from '../dom';
import { heroPortrait } from '../portraits';

const ARMOR_SLOTS: ArmorSlot[] = ['chest', 'boots'];
const SLOT_LABEL: Record<ArmorSlot, string> = { chest: 'Chest', boots: 'Boots' };

export function kitSummary(_hero: HeroId, kit: HeroKit, _jobs: number): string {
  const weapon = weaponName(kit, null);
  const bothEmpty = !kit.cards[0] && !kit.cards[1];
  if (bothEmpty) return `${weapon} · signature basics`;
  const verbs = kit.cards.map((id) => (id ? cardById(id)?.verb : null)).filter(Boolean);
  return `${weapon} · ${verbs.join(' · ')}`;
}

function weaponName(kit: HeroKit, itemById: ((id: string) => KitItem | undefined) | null): string {
  if (kit.weaponId && itemById) {
    const item = itemById(kit.weaponId);
    if (item?.kind === 'weapon') return item.name;
  }
  return familyLabel(kit.family);
}

function kitFooter(kit: HeroKit): string {
  const stance = familyStance(kit.family);
  const bothEmpty = !kit.cards[0] && !kit.cards[1];
  if (bothEmpty) return `${stance} · signature basics`;
  const verbs = kit.cards.map((id) => (id ? cardById(id)?.verb ?? '—' : '—'));
  return `${stance} · ${verbs.join(' · ')}`;
}

export function renderKit(app: App): ScreenView {
  const el = h('div', { class: 'screen kit-screen' });
  let hero = app.save.data.selectedHero;

  const render = () => {
    clear(el);
    const save = app.save;
    const kit = save.heroKit(hero);
    const jobs = save.data.heroJobs[hero] ?? 0;
    const stance = familyStance(kit.family);
    const meleeFamily = `${hero}_melee` as WeaponFamilyId;
    const rangedFamily = `${hero}_ranged` as WeaponFamilyId;
    const weapons = save.data.inventory.filter(
      (item): item is Extract<KitItem, { kind: 'weapon' }> =>
        item.kind === 'weapon' && item.family === kit.family,
    );
    const armorItems = save.data.inventory.filter((item): item is Extract<KitItem, { kind: 'armor' }> => item.kind === 'armor');

    el.append(
      h(
        'header',
        { class: 'screen-header sheet' },
        h('button', { class: 'btn link', text: '← Van', onClick: () => app.go({ kind: 'hub' }) }),
        h('div', {}, h('div', { class: 'eyebrow', text: 'Five slots · one fighter' }), h('h1', { text: 'Kit' })),
        h('span', { class: 'pill', text: `${save.data.servicePoints} points` }),
      ),
      h('p', { class: 'lede kit-jobs-line', text: `Call ${jobs} as ${HEROES[hero].name}. Weapon and cards are per hero; chest and boots are shared.` }),
      h(
        'nav',
        { class: 'build-roster kit-roster', attrs: { 'aria-label': 'Hero kit tabs' } },
        ...HERO_ORDER.map((id) =>
          h(
            'button',
            {
              class: `build-hero ${id === hero ? 'selected' : ''}`,
              attrs: { 'aria-pressed': String(id === hero), 'data-kit-hero': id },
              onClick: () => {
                hero = id;
                render();
                el.querySelector<HTMLButtonElement>(`[data-kit-hero="${id}"]`)?.focus({ preventScroll: true });
              },
            },
            heroPortrait(id, 56),
            h('b', { text: HEROES[id].name }),
          ),
        ),
      ),
      h(
        'section',
        { class: 'sheet kit-slots', attrs: { style: `--hero-color: ${HEROES[hero].color}` } },
        h('div', { class: 'kit-stance-toggle' },
          h('span', { class: 'eyebrow', text: 'Weapon family' }),
          h('div', { class: 'btn-row' },
            h('button', {
              class: `btn ${kit.family === meleeFamily ? 'primary' : ''}`,
              text: familyLabel(meleeFamily),
              attrs: { 'aria-pressed': String(kit.family === meleeFamily) },
              onClick: () => { save.setFamily(hero, meleeFamily); render(); },
            }),
            h('button', {
              class: `btn ${kit.family === rangedFamily ? 'primary' : ''}`,
              text: familyLabel(rangedFamily),
              attrs: { 'aria-pressed': String(kit.family === rangedFamily) },
              onClick: () => { save.setFamily(hero, rangedFamily); render(); },
            }),
          ),
        ),
        h('div', { class: 'kit-weapon-col' },
          h('span', { class: 'eyebrow', text: `${familyLabel(kit.family)} · ${stance}` }),
          h('button', {
            class: `kit-slot weapon ${!kit.weaponId ? 'on' : ''}`,
            onClick: () => { save.equipWeapon(hero, null); render(); },
          },
            h('b', { text: `${familyLabel(kit.family)} · Common` }),
            h('span', { class: 'small muted', text: 'Built-in starter' }),
          ),
          ...weapons.map((weapon) =>
            h('button', {
              class: `kit-slot weapon rarity-${weapon.rarity} ${kit.weaponId === weapon.id ? 'on' : ''}`,
              onClick: () => { save.equipWeapon(hero, weapon.id); render(); },
            },
              h('b', { text: weapon.name }),
              h('span', { class: 'small muted', text: RARITY_LABEL[weapon.rarity] }),
              ...weapon.affixes.map((a) => h('span', { class: 'small', text: affixLabel(a) })),
            ),
          ),
        ),
        h('div', { class: 'kit-armor-row' },
          ...ARMOR_SLOTS.map((slot) => {
            const id = slot === 'chest' ? save.data.chestId : save.data.bootsId;
            const equipped = id ? save.itemById(id) : undefined;
            const armor = equipped?.kind === 'armor' ? equipped : undefined;
            return h('div', { class: 'kit-armor-slot' },
              h('span', { class: 'eyebrow', text: SLOT_LABEL[slot] }),
              armor
                ? h('div', { class: `kit-slot armor rarity-${armor.rarity}` },
                    h('b', { text: armor.name }),
                    h('span', { class: 'small muted', text: RARITY_LABEL[armor.rarity] }),
                    h('button', { class: 'btn link', text: 'Unequip', onClick: () => { save.unequipArmor(slot); render(); } }),
                  )
                : h('p', { class: 'small muted', text: 'Empty — pick from locker finds below' }),
              h('div', { class: 'kit-armor-pick' },
                ...armorItems.filter((item) => item.slot === slot).map((item) =>
                  h('button', {
                    class: `btn ${id === item.id ? 'primary' : ''}`,
                    text: item.name,
                    disabled: id === item.id,
                    onClick: () => { save.equipArmor(item.id); render(); },
                  }),
                ),
              ),
            );
          }),
        ),
        h('div', { class: 'kit-cards' },
          h('span', { class: 'eyebrow', text: 'Stance cards' }),
          h('div', { class: 'kit-card-slots' },
            ...([0, 1] as const).map((slot) => {
              const cardId = kit.cards[slot];
              const card = cardId ? cardById(cardId) : undefined;
              return h('div', { class: 'kit-card-slot' },
                h('span', { class: 'small muted', text: `Slot ${slot + 1}` }),
                card
                  ? h('div', { class: 'kit-slot card on' },
                      h('b', { text: card.name }),
                      h('span', { class: 'small', text: card.verb }),
                      h('button', { class: 'btn link', text: 'Clear', onClick: () => { save.equipCard(hero, slot, null); render(); } }),
                    )
                  : h('p', { class: 'small muted', text: 'Empty' }),
              );
            }),
          ),
          h('div', { class: 'kit-card-pick' },
            ...cardsFor(hero, stance).map((card) => {
              const unlocked = cardUnlocked(card, jobs);
              const slotted = kit.cards.includes(card.id);
              return h('button', {
                class: `kit-card-option ${unlocked ? '' : 'locked'} ${slotted ? 'on' : ''}`,
                disabled: !unlocked,
                title: card.description,
                onClick: () => {
                  const slotIdx = kit.cards.indexOf(card.id);
                  if (slotIdx >= 0) save.equipCard(hero, slotIdx as 0 | 1, null);
                  else {
                    const target: 0 | 1 = kit.cards[0] === null ? 0 : kit.cards[1] === null ? 1 : 0;
                    save.equipCard(hero, target, card.id);
                  }
                  render();
                },
              },
                h('b', { text: card.name }),
                h('span', { class: 'small', text: unlocked ? card.verb : 'Locked' }),
              );
            }),
          ),
        ),
        h('p', { class: 'kit-footer-line muted', text: kitFooter(kit) }),
      ),
      h('div', { class: 'btn-row' },
        h('button', { class: 'btn', text: 'Locker', onClick: () => app.go({ kind: 'locker' }) }),
        h('button', { class: 'btn primary', text: `Take ${HEROES[hero].name}`, onClick: () => { save.setHero(hero); app.go({ kind: 'hub' }); } }),
      ),
    );
  };

  render();
  return { el };
}
