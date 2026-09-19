import { affixLabel, chestBlurb, RARITY_LABEL } from '../../data/loot';
import type { RunReward } from '../../data/progress';
import { remasterTitle } from '../../data/remasters';
import { TOWERS, TOWER_ORDER } from '../../data/towers';
import type { Game } from '../../sim/game';
import { h, stars } from '../dom';

export interface ResultsHandlers {
  onRetry(): void;
  onNext: (() => void) | null;
  onHub(): void;
}

/** End-of-job card, including the Stage 0 "damage share" instrumentation the plan asks for. */
export function renderResults(game: Game, earnedStars: number, handlers: ResultsHandlers, reward?: RunReward): HTMLElement {
  const won = game.status === 'won';
  const retired = game.status === 'retired';
  const towerTotal = TOWER_ORDER.reduce((s, id) => s + game.stats.towerDamage[id], 0);
  const total = towerTotal + game.stats.jeffDamage;
  const jeffPct = total > 0 ? (game.stats.jeffDamage / total) * 100 : 0;
  const towerRows = TOWER_ORDER.filter((id) => game.stats.towerDamage[id] > 0)
    .sort((a, b) => game.stats.towerDamage[b] - game.stats.towerDamage[a])
    .map((id) => {
      const pct = total > 0 ? (game.stats.towerDamage[id] / total) * 100 : 0;
      return h(
        'div',
        { class: 'share-row' },
        h('span', { class: 'share-name' }, h('span', { class: 'swatch', style: { background: TOWERS[id].color } }), ` ${TOWERS[id].name}`),
        h('div', { class: 'bar' }, h('div', { class: 'fill', style: { width: `${pct}%`, background: TOWERS[id].color } })),
        h('span', { class: 'share-pct', text: `${pct.toFixed(0)}%` }),
      );
    });

  const eyebrow = retired ? 'Clocked out' : won ? 'Job complete' : 'Callback needed';
  const headline = retired
    ? `Night ${game.waveIdx}.`
    : won
      ? game.lives >= (game.remaster === 'frozenMain' ? 1 : Math.round(game.map.lives * game.difficulty.livesMult))
        ? 'Clean sheet.'
        : 'Customer’s happy.'
      : 'The basement flooded.';
  const blurb = retired
    ? `Soft exit from Night Shift on ${game.difficulty.name}. XP and crates bank. Same kit — no exclusive power.`
    : won
      ? `${game.map.name} · ${remasterTitle(game.remaster)} · ${game.difficulty.name}.`
      : game.endless
        ? `Made it to wave ${game.waveIdx}. Clock out next time if you want to keep a cleaner record — XP still banks.`
        : `Made it to wave ${game.waveIdx} of ${game.map.waves.length}. No harm done — you still bank a little XP. Take the callback.`;

  return h(
    'div',
    { class: 'overlay' },
    h(
      'div',
      { class: `results sheet ${won || retired ? 'won' : 'lost'}` },
      h('div', { class: 'eyebrow', text: eyebrow }),
      h('h2', { text: headline }),
      h('p', { class: 'muted', text: blurb }),
      won && game.remaster === 'classic' && earnedStars > 0 ? h('div', { class: 'result-stars' }, stars(earnedStars)) : null,
      won && game.remaster !== 'classic' && earnedStars > 0
        ? h('p', { class: 'small', text: 'First remaster clear — +1 Journeyman Star.' })
        : null,
      won && game.remaster !== 'classic' && earnedStars === 0
        ? h('p', { class: 'small muted', text: 'Already inspected. No extra star or chest this time.' })
        : null,
      won && game.remaster === 'classic' && reward && reward.chests.length === 0 && reward.items.length === 0
        ? h('p', { class: 'small muted', text: 'First-clear chest already claimed. XP still banks.' })
        : null,
      reward
        ? h(
            'div',
            { class: 'loot-block' },
            h('div', { class: 'small muted', text: reward.leveledTo ? `Jeff hit level ${reward.leveledTo}.` : 'Experience' }),
            h('b', { text: `+${reward.xp} XP` }),
            reward.salvagedXp > 0 ? h('span', { class: 'small muted', text: ` · locker full, salvaged +${reward.salvagedXp} XP` }) : null,
            reward.chests.length > 0
              ? h('div', { class: 'small muted', text: reward.chests.map(chestBlurb).join(' · ') })
              : null,
            ...reward.items.map((item) =>
              h(
                'div',
                { class: `loot-item rarity-${item.rarity}` },
                h('b', { text: item.name }),
                h('span', { class: 'small muted', text: ` ${RARITY_LABEL[item.rarity]}` }),
                h('div', { class: 'small', text: item.affixes.map(affixLabel).join(' · ') }),
              ),
            ),
          )
        : null,
      h(
        'div',
        { class: 'result-stats' },
        stat('Lives kept', `${game.lives}`),
        stat('Kills', `${game.stats.kills}`),
        stat('Leaks escaped', `${game.stats.escaped}`),
        stat(game.endless ? 'Wave' : 'Cash earned', game.endless ? `${game.waveIdx}` : `$${game.stats.moneyEarned}`),
        stat('Time', `${Math.floor(game.time / 60)}:${String(Math.floor(game.time % 60)).padStart(2, '0')}`),
      ),
      h(
        'div',
        { class: 'share' },
        h('h4', { text: 'Who did the work?' }),
        h(
          'div',
          { class: 'share-row jeff' },
          h('span', { class: 'share-name', text: 'Jeff' }),
          h('div', { class: 'bar' }, h('div', { class: 'fill', style: { width: `${jeffPct}%`, background: '#a5d6a7' } })),
          h('span', { class: 'share-pct', text: `${jeffPct.toFixed(0)}%` }),
        ),
        ...towerRows,
        h('p', { class: 'small muted', text: jeffPct > 50 ? 'Jeff carried this one. Towers should be doing more of the work — try investing earlier.' : 'Towers did the heavy lifting; Jeff plugged the gaps. That’s the job.' }),
      ),
      h(
        'div',
        { class: 'btn-row' },
        h('button', { class: 'btn', text: retired || won ? 'Replay' : 'Retry', onClick: handlers.onRetry }),
        handlers.onNext ? h('button', { class: 'btn primary', text: 'Next service call →', onClick: handlers.onNext }) : null,
        h('button', { class: 'btn', text: 'Back to the van', onClick: handlers.onHub }),
      ),
    ),
  );
}

function stat(label: string, value: string): HTMLElement {
  return h('div', { class: 'stat-box' }, h('div', { class: 'small muted', text: label }), h('b', { text: value }));
}
