import { describe, expect, it } from 'vitest';
import { DIFFICULTIES } from '../src/data/difficulty';
import { CRAWLSPACE } from '../src/data/maps/crawlspace';
import { SERVICE_CALL } from '../src/data/maps/serviceCall';
import { SKILLS, neutralModifiers } from '../src/data/skills';
import { TOWERS, TOWER_ORDER } from '../src/data/towers';
import { chestsForRun, xpForRun } from '../src/data/progress';
import { SaveStore, starsForClear } from '../src/save/save';
import { Game } from '../src/sim/game';
import { resolveLoadout } from '../src/data/loadout';
import type { TowerId } from '../src/data/types';
import { MAPS } from '../src/data/maps';

function field() {
  return new Game({ ...CRAWLSPACE, paths: [[{x:20,y:200},{x:920,y:200}]], slots:[{x:300,y:150},{x:400,y:150},{x:500,y:150}],
    allowedTowers: TOWER_ORDER, startMoney: 1000000 }, {difficulty: DIFFICULTIES.journeyman, mods:neutralModifiers(), manualStart:true, heroEnabled:false});
}
function step(g:Game,s:number) { for(let i=0;i<Math.ceil(s*60);i++) g.update(1/60); }

describe('Retired crew towers and saved loadouts', () => {
  it.each(['apprentices', 'jayjay', 'cbjDoni'])('%s is absent from every playable catalogue and cannot be built', retired => {
    expect(TOWER_ORDER).not.toContain(retired);
    expect(TOWERS).not.toHaveProperty(retired);
    for (const map of [...MAPS, SERVICE_CALL]) expect(map.allowedTowers).not.toContain(retired);
    const g = field(); const money = g.money;
    expect(g.placeTower(0, retired as TowerId)).toBe(false);
    expect(g.towers).toHaveLength(0); expect(g.money).toBe(money);
  });
  it('filters retired saved picks, refills a legal bag, and preserves earned progress', () => {
    const storage = { length: 1, clear() {}, key() { return null; }, getItem() { return JSON.stringify({
      version: 1, selectedHero: 'doni', lastLoadout: ['apprentices', 'jayjay', 'cbjDoni', 'torch'],
      stars: { crawlspace: { journeyman: 3 } }, skills: ['sharpTools'], jeffXp: 500, serviceCallBest: 42,
    }); }, setItem() {}, removeItem() {} };
    const save = new SaveStore(storage);
    expect(save.data.lastLoadout).toEqual(['torch']);
    expect(resolveLoadout(save.data.lastLoadout, CRAWLSPACE.allowedTowers)).toEqual(['torch', 'washer', 'barricade']);
    expect(save.starsFor('crawlspace')).toBe(3);
    expect(save.data.jeffXp).toBe(500); expect(save.data.serviceCallBest).toBe(42); expect(save.data.selectedHero).toBe('doni');
    expect(save.data.inventory.some(i => i.kind === 'armor' && i.name === 'Veteran Vest')).toBe(true);
  });
});

describe('Six tiers and ongoing investment',()=>{
  it.each(TOWER_ORDER)('%s has expensive late upgrades, preserves its choice, and supports mastery',id=>{
    const g=field();const catalog=JSON.stringify(TOWERS[id]);g.placeTower(0,id);const t=g.towers[0]!;
    for(let i=1;i<6;i++){expect(g.upgradeTower(t.id)).toBe(true);if(i===2)expect(g.specializeTower(t.id,'power')).toBe(true);}
    expect(t.level).toBe(5);expect(t.specialization).toBe('power');expect(t.def.levels[5]!.cost).toBeGreaterThan(t.def.levels[2].cost*10);
    const value=g.sellValue(t),cost=g.masteryCost(t);expect(g.reinforceTower(t.id)).toBe(true);
    expect(g.masteryCost(t)).toBeGreaterThan(cost);expect(g.sellValue(t)).toBeGreaterThan(value);expect(JSON.stringify(TOWERS[id])).toBe(catalog);
  });
});

describe('90’s workshop',()=>{
  it('grades lives and awards best ratings once',()=>{
    expect([starsForClear(20,20),starsForClear(19,20),starsForClear(10,20),starsForClear(9,20),starsForClear(0,20)]).toEqual([3,2,2,1,0]);
    const save=new SaveStore(null);save.recordClear('crawlspace','journeyman',3);save.recordClear('crawlspace','journeyman',1);
    expect(save.availableStars()).toBe(3);
    save.recordClear('boilerRoom','journeyman',3);expect(save.availableStars()).toBe(6);
    expect(SKILLS).toHaveLength(28);
  });
  it('migrates the old endless best and skill-tree saves into v2 kit data',()=>{
    const storage={length:1,clear:()=>{},key:()=>null,getItem:()=>JSON.stringify({version:1,nightShiftBest:42,skills:['sharpTools']}),setItem:()=>{},removeItem:()=>{}};
    const save=new SaveStore(storage);expect(save.data.serviceCallBest).toBe(42);
    expect(save.data.inventory.some(i => i.kind === 'armor' && i.name === 'Veteran Vest')).toBe(true);
  });
});

describe('Neverending call pacing',()=>{
  it('does not auto-stack waves while enemies are alive; a cleared call pays exactly once',()=>{
    const g=new Game(SERVICE_CALL,{difficulty:DIFFICULTIES.apprentice,mods:neutralModifiers(),heroEnabled:false,manualStart:true});
    g.callNextWave();step(g,10);for(const e of g.enemies)e.def={...e.def,speed:0};step(g,32);expect(g.waveIdx).toBe(1);expect(g.completedWaves).toBe(0);
    for(const e of g.enemies)e.dead=true;
    const cash=g.money;step(g,.1);expect(g.completedWaves).toBe(1);expect(g.money).toBe(cash+97);
    step(g,1);expect(g.money).toBe(cash+97);
  });
  it('calling waves early and retiring cannot manufacture cleared-wave rewards',()=>{
    const g=new Game(SERVICE_CALL,{difficulty:DIFFICULTIES.apprentice,mods:neutralModifiers(),manualStart:true});
    for(let i=0;i<20;i++)g.callNextWave();g.retire();expect(g.completedWaves).toBe(0);expect(chestsForRun(g,0)).toEqual([]);expect(xpForRun(g,0)).toBe(0);
  });
  it('refuses a second call while a service-call wave is still on the floor',()=>{
    const g=new Game(SERVICE_CALL,{difficulty:DIFFICULTIES.apprentice,mods:neutralModifiers(),heroEnabled:false,manualStart:true});
    g.callNextWave();
    expect(g.waveActive).toBe(true);
    const wave=g.waveIdx,cash=g.money;
    expect(g.callNextWave()).toBe(0);
    expect(g.waveIdx).toBe(wave);
    expect(g.money).toBe(cash);
  });
});
