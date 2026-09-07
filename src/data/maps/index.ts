import type { MapDef } from '../types';
import { BOILER_ROOM } from './boilerRoom';
import { CRAWLSPACE } from './crawlspace';
import { MUNICIPAL_MAIN } from './municipalMain';
import { RADIANT_FLOOR } from './radiantFloor';

export const MAPS: MapDef[] = [CRAWLSPACE, BOILER_ROOM, RADIANT_FLOOR, MUNICIPAL_MAIN];

export function mapById(id: string): MapDef | undefined {
  return MAPS.find((m) => m.id === id);
}

export const WORLD_W = 960;
export const WORLD_H = 600;
