import { TOWER_ORDER } from './towers';
import type { TowerId } from './types';
import type { Game } from '../sim/game';

export const STARTER_TOWERS: TowerId[] = ['torch', 'washer', 'barricade'];
export const WELCOME_POINTS = 100;
/** Permanent licenses; battlefield construction still uses the map's cash. */
export const TOWER_PRICES: Record<TowerId, number> = Object.fromEntries(TOWER_ORDER.map((id, index) => [id,
  STARTER_TOWERS.includes(id) ? 0 : 80 + Math.floor((index - 3) / 3) * 35,
])) as Record<TowerId, number>;

/** Reward completed play, including partial failures, but not idle entry/exit. */
export function servicePointsForRun(game: Game): number {
  if (!['won', 'lost', 'retired'].includes(game.status)) return 0;
  const completed = Math.max(0, game.completedWaves), kills = Math.max(0, game.stats.kills);
  if (!completed && !kills) return 0;
  const difficulty = game.difficulty.id === 'master' ? 1.35 : game.difficulty.id === 'journeyman' ? 1.15 : 1;
  const work = completed * 6 + Math.min(kills, 300) * .25;
  return Math.max(1, Math.round((game.status === 'won' ? 45 + work : work * (game.status === 'retired' ? .8 : .5)) * difficulty));
}
