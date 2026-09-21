import { ENEMIES } from './enemies';
import type { EnemyDef, EnemyId } from './types';

export function enemyForMap(id: EnemyId, mapId: string): EnemyDef {
  const def = ENEMIES[id];
  if (id !== 'rogueBoiler' || mapId !== 'heatPlant') return def;
  return { ...def, name: 'The First Furnace', hp: def.hp, speed: 20, armor: .3, color: '#ef8f42',
    fantasy: 'The source of the district’s pressure crisis. Its furnace targets your most expensive defense.',
    counters: 'Eruptions overheat towers for 2.5s. Move crew out of the red circle; stun the boss or shield towers to stop the impact. A breach loses the job.' };
}

export function bossAttack(mapId: string): { name: string; duration: number; radius: number; interval: number; targeted: boolean } {
  return mapId === 'heatPlant'
    ? { name: 'FURNACE ERUPTION', duration: 2.4, radius: 95, interval: 9, targeted: true }
    : { name: 'PRESSURE VENT', duration: 2, radius: 110, interval: 8, targeted: false };
}
