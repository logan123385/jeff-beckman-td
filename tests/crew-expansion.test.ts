import { describe, expect, it } from 'vitest';
import { DIFFICULTIES } from '../src/data/difficulty';
import { CRAWLSPACE } from '../src/data/maps/crawlspace';
import { SERVICE_CALL } from '../src/data/maps/serviceCall';
import { SKILLS, neutralModifiers } from '../src/data/skills';
import { TOWERS, TOWER_ORDER } from '../src/data/towers';
import { chestsForRun, xpForRun } from '../src/data/progress';
import { SaveStore, starsForClear } from '../src/save/save';
import { Game } from '../src/sim/game';
import { damageFriendly } from '../src/sim/friendlies';
import { damageBarricade } from '../src/sim/towers';

function field() {
  return new Game({ ...CRAWLSPACE, paths: [[{x:20,y:200},{x:920,y:200}]], slots:[{x:300,y:150},{x:400,y:150},{x:500,y:150}],
    allowedTowers: TOWER_ORDER, startMoney: 1000000 }, {difficulty: DIFFICULTIES.journeyman, mods:neutralModifiers(), manualStart:true, heroEnabled:false});
}
function step(g:Game,s:number) { for(let i=0;i<Math.ceil(s*60);i++) g.update(1/60); }

describe('Real recruit towers',()=>{
  it('recruits do not hold or punch while the shop is still installing', () => {
    const g = field();
    g.placeTower(0, 'jayjay');
    expect((g.towers[0]!.build ?? 0)).toBeGreaterThan(0.5);
    const f = g.friendlies[0]!;
    const e = g.spawnEnemy('sludge', 0, 280);
    e.pos = { ...f.pos };
    e.def = { ...e.def, dps: 0, speed: 0 };
    e.hp = e.maxHp = 10000;
    const hp = e.hp;
    step(g, 0.5);
    expect((g.towers[0]!.build ?? 0)).toBeGreaterThan(0);
    expect(e.heldBy).toBeNull();
    expect(e.hp).toBe(hp);
    expect(f.swing).toBe(0);
  });
  it('four tool-bearing apprentices walk from the workshop, expanding to six at tier six',()=>{
    const g=field();g.placeTower(0,'apprentices');const t=g.towers[0]!;
    expect(g.friendlies).toHaveLength(4);expect(g.friendlies.every(f=>f.pos.y===150)).toBe(true);
    step(g,.2);expect(g.friendlies.some(f=>f.moving && f.pos.y>150 && f.pos.y<200)).toBe(true);
    for(let i=0;i<5;i++) expect(g.upgradeTower(t.id)).toBe(true);
    expect(g.friendlies).toHaveLength(6);expect(g.friendlies.every(f=>f.tier===5)).toBe(true);
    expect(g.friendlies[0]!.maxHp).toBeGreaterThan(1000);
    expect(g.upgradeTower(t.id)).toBe(false);
  });
  it('Jayjay is a single armored tank; CBJ and Doni have distinct health and attack speeds',()=>{
    const g=field();g.placeTower(0,'jayjay');g.placeTower(1,'cbjDoni');
    const [jay,cbj,doni]=g.friendlies;
    expect(g.friendlies.map(f=>f.role)).toEqual(['jayjay','cbj','doni']);
    expect(jay!.maxHp).toBeGreaterThan(doni!.maxHp);expect(jay!.holds).toBe(3);
    expect(cbj!.rate).toBeGreaterThan(doni!.rate);expect(doni!.damage).toBeGreaterThan(cbj!.damage);
    const hp=jay!.hp;damageFriendly(g,jay!,100);expect(hp-jay!.hp).toBeCloseTo(75);
  });
  it('Doni deals damage at contact and NYEH appears only on a connected punch',()=>{
    const g=field();g.placeTower(0,'cbjDoni');step(g,2);
    const cbj=g.friendlies[0]!,doni=g.friendlies[1]!; cbj.respawn=30;
    const e=g.spawnEnemy('sludge',0,doni.pos.x-20);e.pos={x:doni.pos.x+5,y:doni.pos.y};e.def={...e.def,dps:0,speed:0};e.hp=e.maxHp=10000;
    const hp=e.hp;step(g,.1);expect(e.hp).toBe(hp);expect(doni.swing).toBeGreaterThan(0);
    step(g,.3);expect(e.hp).toBeLessThan(hp);expect(g.effects.some(v=>v.kind==='text'&&v.text==='NYEH!')).toBe(true);
  });
  it('death releases enemies, respawn walks back, and selling removes every recruit',()=>{
    const g=field();g.placeTower(0,'jayjay');step(g,2);const f=g.friendlies[0]!,t=g.towers[0]!;
    const e=g.spawnEnemy('sludge',0,280);step(g,.1);expect(e.heldBy).toEqual({kind:'friendly',id:f.id});
    damageFriendly(g,f,100000);expect(e.heldBy).toBeNull();expect(f.respawn).toBe(14);
    e.dead=true;step(g,14.1);expect(f.hp).toBe(f.maxHp);expect(f.pos.y).toBeLessThan(f.home.y);
    g.sellTower(t.id);expect(g.friendlies).toHaveLength(0);
  });
  it('rally orders release holds without teleporting the crew',()=>{
    const g=field();g.placeTower(0,'apprentices');step(g,2);const before={...g.friendlies[0]!.pos};
    expect(g.setRally(g.towers[0]!.id,{x:400,y:200})).toBe(true);
    expect(g.friendlies[0]!.pos).toEqual(before);step(g,.2);expect(g.friendlies[0]!.pos.x).toBeGreaterThan(before.x);
  });
  it('recruit workshops rebuild after a blowout and idle the crew until they stand back up',()=>{
    const g=field();g.placeTower(0,'apprentices');step(g,2);
    const t=g.towers[0]!,f=g.friendlies[0]!;
    const e=g.spawnEnemy('sludge',0,280);e.pos={...f.pos};e.def={...e.def,dps:0,speed:0};e.hp=e.maxHp=10000;
    step(g,.5);expect(f.targetId).not.toBeNull();
    damageBarricade(g,t,1e9);expect(t.rebuild).toBeGreaterThan(7);
    step(g,.1);expect(f.targetId).toBeNull();expect(t.rebuild).toBeGreaterThan(0);expect(t.rebuild).toBeLessThan(8);
    step(g,8);expect(t.rebuild).toBeLessThanOrEqual(0);expect(t.hp).toBe(t.maxHp);
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
  it('grades lives, awards best ratings once, gates choices and spends real node costs',()=>{
    expect([starsForClear(20,20),starsForClear(19,20),starsForClear(10,20),starsForClear(9,20),starsForClear(0,20)]).toEqual([3,2,2,1,0]);
    const save=new SaveStore(null);save.recordClear('crawlspace','journeyman',3);save.recordClear('crawlspace','journeyman',1);
    expect(save.availableStars()).toBe(3);expect(save.unlockSkill('crewArmor')).toBe(false);
    expect(save.unlockSkill('crewTraining')).toBe(true);expect(save.unlockSkill('crewPractice')).toBe(true);expect(save.unlockSkill('crewArmor')).toBe(false);
    expect(save.unlockSkill('crewReturn')).toBe(true);expect(save.availableStars()).toBe(0);
    save.recordClear('boilerRoom','journeyman',3);expect(save.unlockSkill('crewPathA')).toBe(true);expect(save.availableStars()).toBe(1);
    expect(save.unlockSkill('crewMastery')).toBe(false);save.respec();expect(save.availableStars()).toBe(6);expect(save.data.skills).toHaveLength(0);
    expect(SKILLS).toHaveLength(28);
  });
  it('migrates the old endless best without losing existing progression',()=>{
    const storage={length:1,clear:()=>{},key:()=>null,getItem:()=>JSON.stringify({version:1,nightShiftBest:42,skills:['sharpTools']}),setItem:()=>{},removeItem:()=>{}};
    const save=new SaveStore(storage);expect(save.data.serviceCallBest).toBe(42);expect(save.data.skills).toContain('sharpTools');
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
