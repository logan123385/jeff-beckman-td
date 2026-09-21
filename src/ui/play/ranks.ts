import { ABILITY_KEYS, ABILITY_RANK_CAP, type AbilitySlot } from '../../data/heroes';
import { nextRankBlurb } from '../../sim/combat';
import type { Game } from '../../sim/game';
import { h } from '../dom';
import { skillGlyph } from './icons';

export interface RankHandlers {
  onPick(slot: AbilitySlot): void;
  onClose(): void;
}

/** Wood/brass rank-up card — pick one of five skills to star (cap 3). */
export function createRankPanel(game: Game, handlers: RankHandlers): {
  el: HTMLElement;
  show(): void;
  hide(): void;
  sync(): void;
  isOpen(): boolean;
} {
  const title = h('h2', { text: 'Level up' });
  const lede = h('p', { class: 'small muted rank-lede' });
  const grid = h('div', { class: 'rank-grid' });
  const keys = h('p', { class: 'small muted pause-keys', text: 'Q · E · R · T · C to rank · Esc to decide later' });

  const card = h(
    'div',
    { class: 'rank-card sheet', onClick: (ev) => ev.stopPropagation() },
    h('div', { class: 'eyebrow', text: 'Hero rank' }),
    title,
    lede,
    grid,
    keys,
    h('button', { class: 'btn rank-later', text: 'Continue fighting', onClick: () => handlers.onClose() }),
  );

  const el = h('div', { class: 'rank-overlay overlay hidden', attrs: { role: 'dialog', 'aria-modal': 'true', 'aria-label': 'Hero ranks' } }, card);
  let open = false;
  let focusedBefore: HTMLElement | null = null;
  el.addEventListener('keydown', event => {
    if (event.key !== 'Tab') return;
    const buttons = [...el.querySelectorAll<HTMLButtonElement>('button:not(:disabled)')];
    const first = buttons[0], last = buttons.at(-1);
    if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
    else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
  });

  const paint = () => {
    const leftover = game.pendingRankUps;
    title.textContent = leftover > 1 ? `Level up · ${leftover} picks` : 'Level up';
    lede.textContent = leftover > 1
      ? `${game.heroDef.name} hit level ${game.heroLevel}. Rank ${leftover} skills. The yard waits while this panel is open.`
      : `${game.heroDef.name} hit level ${game.heroLevel}. Rank one skill — stronger, faster, a little more reach.`;
    grid.replaceChildren();
    game.heroDef.abilities.forEach((ability, i) => {
      const slot = i as AbilitySlot;
      const rank = game.abilityRanks[slot] ?? 0;
      const maxed = rank >= ABILITY_RANK_CAP;
      const next = nextRankBlurb(game, slot);
      const pips = h('span', { class: 'rank-pips big', attrs: { 'aria-hidden': 'true' } });
      for (let n = 0; n < ABILITY_RANK_CAP; n++) {
        pips.append(h('span', { class: n < rank ? 'rank-pip on' : 'rank-pip' }));
      }
      const btn = h(
        'button',
        {
          class: `rank-skill${maxed ? ' maxed' : ''}`,
          disabled: maxed || leftover <= 0,
          title: maxed ? `${ability.name} is fully ranked.` : `${ability.name} · ${next ?? ''}`,
          attrs: { 'aria-label': maxed ? `${ability.name}, max rank` : `Rank ${ability.name}` },
          onClick: () => {
            if (maxed || leftover <= 0) return;
            handlers.onPick(slot);
          },
        },
        h('span', { class: 'rank-key', text: ABILITY_KEYS[slot]! }),
        h('span', { class: 'ab-glyph rank-glyph', html: skillGlyph(ability.glyph) }),
        h('b', { class: 'rank-name', text: ability.name }),
        pips,
        h('span', { class: 'rank-meta', text: maxed ? 'MAX' : `Rank ${rank} → ${rank + 1}` }),
        h('span', { class: 'rank-next', text: maxed ? 'Fully ranked.' : next ?? '+18% power · −7% cooldown' }),
      );
      grid.append(btn);
    });
  };

  return {
    el,
    show() {
      if (open) return;
      focusedBefore = document.activeElement instanceof HTMLElement ? document.activeElement : null;
      paint();
      open = true;
      el.classList.remove('hidden');
      el.querySelector<HTMLButtonElement>('.rank-skill:not(:disabled)')?.focus({ preventScroll: true });
    },
    hide() {
      const wasOpen = open;
      open = false;
      el.classList.add('hidden');
      if (wasOpen) focusedBefore?.focus({ preventScroll: true });
    },
    sync() {
      if (open) { paint(); el.querySelector<HTMLButtonElement>('.rank-skill:not(:disabled)')?.focus({ preventScroll: true }); }
    },
    isOpen() {
      return open;
    },
  };
}
