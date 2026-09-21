/** A reproducible active-play strategy with normal resources. Simulation evidence only. */
import { writeFileSync } from 'node:fs';
import { dist } from '../src/core/vec';
import { DIFFICULTIES } from '../src/data/difficulty';
import { MAPS } from '../src/data/maps';
import { TOWERS } from '../src/data/towers';
import { SPECIALIST_KITS } from '../src/data/specialistAbilities';
import { neutralModifiers } from '../src/data/skills';
import type { DifficultyId, TowerId } from '../src/data/types';
import { Game } from '../src/sim/game';
import { isTargetable, scaledCastRange } from '../src/sim/combat';
const records=[];
for (const map of MAPS) {
  const difficulty = (process.argv[3] ?? 'journeyman') as DifficultyId;
  const support = map.allowedTowers.includes('radiant') ? 'radiant' : map.allowedTowers.includes('glycol') ? 'glycol' : null;
  const kit:TowerId[]=['torch','washer','barricade'];
  if(support)kit.push(support);
  if(map.allowedTowers.includes('vent'))kit.push('vent');
  const g=new Game(map,{difficulty:DIFFICULTIES[difficulty],mods:neutralModifiers(),heroId:'cbj',manualStart:true,loadout:kit,seed:7});
  const plan:TowerId[]=['torch','washer','torch',...(support?[support]:[]),...(kit.includes('vent')?['vent' as const]:[]),'barricade','torch','washer'];
  let decisions=0;
  const place=(id:TowerId)=>{
    const range=TOWERS[id].levels[0].range;
    const options=map.slots.map((pos,slot)=>({pos,slot})).filter(s=>!g.towerAt(s.slot));
    const value=(pos:{x:number;y:number})=>g.paths.reduce((sum,path)=>{
      let cover=0; for(let p=0;p<path.length;p+=16) if(dist(path.pointAt(p),pos)<=Math.max(65,range)) cover+=16*(1-.35*p/path.length);
      return sum+cover;
    },0);
    options.sort((a,b)=>value(b.pos)-value(a.pos));
    return options[0] ? g.placeTower(options[0].slot,id):false;
  };
  const invest=()=>{
    if(g.towers.length<2) { place(plan[g.towers.length]!); return; }
    const core=g.towers.slice(0,2);
    for(const t of core) if(t.level<2) { g.upgradeTower(t.id); return; }
    if(g.towers.length<Math.min(5,plan.length)) { place(plan[g.towers.length]!); return; }
    for(const t of g.towers) if(t.level<2) { g.upgradeTower(t.id); return; }
    for(const t of g.towers) if(!t.specialization) { g.specializeTower(t.id,t.def.id==='washer'?'control':'power'); return; }
    for(const t of g.towers) for(const ability of SPECIALIST_KITS[t.def.id]) if((t.abilities?.[ability]?.rank??0)<1) {g.buySpecialistAbility(t.id,ability);return;}
    if(g.towers.length<Math.min(plan.length,map.slots.length)) {place(plan[g.towers.length]!);return;}
    for(const t of [...g.towers].sort((a,b)=>a.level-b.level)) if(g.upgradeTower(t.id)) return;
  };
  for(let tick=0;tick<60*1200 && g.status==='playing';tick++) {
    if(tick%15===0) {
      decisions++; invest();
      while(g.pendingRankUps>0){const slot=([4,0,3,1,2] as const).find(i=>g.abilityRanks[i]<3);if(slot===undefined||!g.rankAbility(slot))break;}
      const core=g.towers[0];
      if(!g.hero.deployed&&g.hero.downed<=0&&core)g.deployHero(g.nearestPathPoint(core.pos));
      if(g.waveIdx===0&&g.towers.length>=2||!g.waveActive&&g.canCallWave)g.callNextWave();
      const threats=g.enemies.filter(isTargetable).sort((a,b)=>(g.paths[a.pathIdx]!.length-a.progress)/Math.max(1,a.def.speed)-(g.paths[b.pathIdx]!.length-b.progress)/Math.max(1,b.def.speed));
      const lead=threats[0];
      if(lead){
        g.reinforce(g.nearestPathPoint(lead.pos));
        if(threats.length>=6||lead.def.traits.includes('boss'))g.torchStrike(lead.pos);
        for(const t of g.towers)g.useTowerAbility(t.id);
        if(core&&g.hero.deployed&&g.hero.hp>g.hero.maxHp*.4&&dist(g.hero.pos,core.pos)>130)g.commandHero(g.nearestPathPoint(core.pos));
        for(const slot of [0,4,1,3,2] as const){
          const target=threats.find(e=>dist(e.pos,g.hero.pos)<=scaledCastRange(g,slot));
          if(slot===2&&g.hero.hp>g.hero.maxHp*.8)continue;
          if(target)g.useAbility(slot,{pos:target.pos,enemyId:target.id});
        }
      }
    }
    g.update(1/60);
  }
  const row={map:map.id,difficulty,status:g.status,lives:g.lives,wave:g.waveIdx,seconds:Math.round(g.time),kills:g.stats.kills,money:g.money,decisions,kit,towers:g.towers.map(t=>({id:t.def.id,slot:t.slot,tier:t.level+1,specialization:t.specialization}))};
  records.push(row); console.log(`${map.id}: ${g.status}, ${g.lives} lives, wave ${g.waveIdx}, ${Math.round(g.time)}s`);
}
writeFileSync(process.argv[2]??'/tmp/jeff-tactical-campaign.json',JSON.stringify({method:'Fixed active-play policy. CBJ, seed 7, legal kits, no gear/perks/extra money. Automated simulation; not human difficulty proof.',records},null,2));
