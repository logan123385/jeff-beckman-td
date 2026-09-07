import type { EnemyId, SpawnGroup, WaveDef } from '../types';

export function grp(enemy: EnemyId, count: number, interval: number, delay = 0, path = 0): SpawnGroup {
  return { enemy, count, interval, delay, path };
}

export function wave(...groups: SpawnGroup[]): WaveDef {
  return { groups };
}
