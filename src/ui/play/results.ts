import { TOWERS, TOWER_ORDER } from '../../data/towers';
import type { Game } from '../../sim/game';
import { h, stars } from '../dom';

export interface ResultsHandlers {
  onRetry(): void;
  onNext: (() => void) | null;
  onHub(): void;
}

/** End-of-job card, including the Stage 0 "damage share" instrumentation the plan asks for. */
export function renderResults(game: Game, earnedStars: number, handlers: ResultsHandlers): HTMLElement {
  const won = game.status === 'won';
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

  return h(
    'div',
    { class: 'overlay' },
    h(
      'div',
      { class: `results ${won ? 'won' : 'lost'}` },
      h('div', { class: 'eyebrow', text: won ? 'Job complete' : 'Callback needed' }),
      h('h2', { text: won ? (game.lives >= Math.round(game.map.lives * game.difficulty.livesMult) ? 'Clean sheet.' : 'Customer’s happy.') : 'The basement flooded.' }),
      h('p', { class: 'muted', text: won ? `${game.map.name} cleared on ${game.difficulty.name}.` : `Made it to wave ${game.waveIdx} of ${game.totalWaves}. No harm done — take the callback and try a different layout.` }),
      won ? h('div', { class: 'result-stars' }, stars(earnedStars)) : null,
      h(
        'div',
        { class: 'result-stats' },
        stat('Lives kept', `${game.lives}`),
        stat('Kills', `${game.stats.kills}`),
        stat('Leaks escaped', `${game.stats.escaped}`),
        stat('Cash earned', `$${game.stats.moneyEarned}`),
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
        h('button', { class: 'btn', text: won ? 'Replay' : 'Retry', onClick: handlers.onRetry }),
        handlers.onNext ? h('button', { class: 'btn primary', text: 'Next service call →', onClick: handlers.onNext }) : null,
        h('button', { class: 'btn', text: 'Back to the van', onClick: handlers.onHub }),
      ),
    ),
  );
}

function stat(label: string, value: string): HTMLElement {
  return h('div', { class: 'stat-box' }, h('div', { class: 'small muted', text: label }), h('b', { text: value }));
}
