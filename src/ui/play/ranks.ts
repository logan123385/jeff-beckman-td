import { ABILITY_KEYS, ABILITY_RANK_CAP, type AbilitySlot } from '../../data/heroes';
import { nextRankBlurb } from '../../sim/combat';
import type { Game } from '../../sim/game';
import { h } from '../dom';
import { skillGlyph } from './icons';

export interface RankHandlers {
  onPick(slot: AbilitySlot): void;
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
  const keys = h('p', { class: 'small muted pause-keys', text: 'Q · E · R · T · C to rank · pick one to keep the job moving' });

  const card = h(
    'div',
    { class: 'rank-card sheet', onClick: (ev) => ev.stopPropagation() },
    h('div', { class: 'eyebrow', text: 'Hero rank' }),
    title,
    lede,
    grid,
    keys,
  );

  const el = h('div', { class: 'rank-overlay overlay hidden' }, card);
  let open = false;

  const paint = () => {
    const leftover = game.pendingRankUps;
    title.textContent = leftover > 1 ? `Level up · ${leftover} picks` : 'Level up';
    lede.textContent = leftover > 1
      ? `${game.heroDef.name} hit level ${game.heroLevel}. Rank ${leftover} skills before the yard moves.`
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
      paint();
      open = true;
      el.classList.remove('hidden');
    },
    hide() {
      open = false;
      el.classList.add('hidden');
    },
    sync() {
      if (open) paint();
    },
    isOpen() {
      return open;
    },
  };
}
