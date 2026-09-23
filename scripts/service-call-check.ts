import { SERVICE_CALL } from '../src/data/maps/serviceCall';
import { runHeadless } from '../tests/harness';
for (const difficulty of ['apprentice','journeyman'] as const) {
 const r=runHeadless(SERVICE_CALL,{difficulty,heroEnabled:true,microJeff:true,callEarly:true,maxSeconds:5400,buildOrder:['jayjay','torch','vent','washer','expansion']});
 console.log(JSON.stringify({difficulty,status:r.game.status,completed:r.game.completedWaves,called:r.game.waveIdx,seconds:Math.round(r.seconds),lives:r.livesLeft,cash:r.game.money,tiers:r.game.towers.map(t=>[t.def.id,t.level+1])}));
}
