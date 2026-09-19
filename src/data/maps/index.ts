import type { MapDef } from '../types';
import { ATTIC } from './attic';
import { BOILER_ROOM } from './boilerRoom';
import { CRAWLSPACE } from './crawlspace';
import { HEAT_PLANT } from './heatPlant';
import { LIFT_STATION } from './liftStation';
import { MECHANICAL_ROOM } from './mechanicalRoom';
import { MUNICIPAL_MAIN } from './municipalMain';
import { NIGHT_SHIFT } from './nightShift';
import { RADIANT_FLOOR } from './radiantFloor';
import { SNOWMELT } from './snowmelt';

/** First four calls unlock Night Shift. Later jobs teach new tools and drop more gear. */
export const CORE_MAPS: MapDef[] = [CRAWLSPACE, BOILER_ROOM, RADIANT_FLOOR, MUNICIPAL_MAIN];
export const MAPS: MapDef[] = [...CORE_MAPS, SNOWMELT, ATTIC, LIFT_STATION, MECHANICAL_ROOM, HEAT_PLANT];
export { NIGHT_SHIFT };

export function mapById(id: string): MapDef | undefined {
  if (id === NIGHT_SHIFT.id) return NIGHT_SHIFT;
  return MAPS.find((m) => m.id === id);
}

export const WORLD_W = 960;
export const WORLD_H = 600;
