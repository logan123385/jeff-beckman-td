import type { Game } from '../sim/game';

export const COMMENDATIONS = [
  { id: 'clean', name: 'Watertight', description: 'Win without an enemy escaping.' },
  { id: 'compact', name: 'Small footprint', description: 'Win with at most four towers installed at once.' },
  { id: 'toolbox', name: 'Full toolbox', description: 'Win after building every tool type on your truck.' },
] as const;
export type CommendationId = typeof COMMENDATIONS[number]['id'];
export function earnedCommendations(game: Game): CommendationId[] {
  if (game.status !== 'won' || game.endless) return [];
  return COMMENDATIONS.filter(goal => goal.id === 'clean' ? game.stats.escaped === 0
    : goal.id === 'compact' ? game.peakTowerCount <= 4
    : game.allowedTowers.length > 0 && game.allowedTowers.every(id => game.builtTypes.has(id))).map(goal => goal.id);
}
export function commendationKey(map: string, difficulty: string, remaster: string): string {
  return `${map}:${difficulty}:${remaster}`;
}
