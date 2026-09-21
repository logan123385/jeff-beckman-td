import type { MapDef } from '../types';
import { ATTIC } from './attic';
import { BOILER_ROOM } from './boilerRoom';
import { CRAWLSPACE } from './crawlspace';
import { HEAT_PLANT } from './heatPlant';
import { LIFT_STATION } from './liftStation';
import { MECHANICAL_ROOM } from './mechanicalRoom';
import { MUNICIPAL_MAIN } from './municipalMain';
import { SERVICE_CALL } from './serviceCall';
import { RADIANT_FLOOR } from './radiantFloor';
import { SNOWMELT } from './snowmelt';

/** First four calls unlock The Neverending Service Call. Later jobs teach new tools and drop more gear. */
export const CORE_MAPS: MapDef[] = [CRAWLSPACE, BOILER_ROOM, RADIANT_FLOOR, MUNICIPAL_MAIN];
export const MAPS: MapDef[] = [...CORE_MAPS, SNOWMELT, ATTIC, LIFT_STATION, MECHANICAL_ROOM, HEAT_PLANT];
export { SERVICE_CALL };

export function mapById(id: string): MapDef | undefined {
  if (id === SERVICE_CALL.id) return SERVICE_CALL;
  return MAPS.find((m) => m.id === id);
}

export const WORLD_W = 960;
export const WORLD_H = 600;
