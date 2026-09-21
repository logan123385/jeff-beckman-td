import { dist } from '../core/vec';
import { SPECIALIST_ABILITIES, type SpecialistAbilityId } from '../data/specialistAbilities';
import { applyDamage, heroOnYard, isTargetable, matchesTargetMode } from './combat';
import type { Game } from './game';
import type { Enemy, Tower } from './state';

export function updateSpecialistAbilities(game: Game, tower: Tower, dt: number): void {
  if (!tower.abilities || (tower.build ?? 0) > 0 || tower.frozen > 0 || tower.rebuild > 0 || (tower.overheated ?? 0) > 0) return;
  const center = tower.def.kind === 'barricade' ? tower.rally : tower.pos;
  for (const [key, ability] of Object.entries(tower.abilities)) {
    const id = key as SpecialistAbilityId;
    const def = SPECIALIST_ABILITIES[id];
    ability.cooldown = Math.max(0, ability.cooldown - dt);
    if (ability.cooldown > 0) continue;
    const rank = ability.rank;
    const range = Math.max(90, game.effectiveRange(tower)) * (id === 'deadeye' ? 1.25 : 1);
    const targets = game.enemies.filter(e => !e.dead && !e.escaped && (id === 'expose' || isTargetable(e))
      && matchesTargetMode(tower.def.targets, e) && dist(e.pos, center) <= range + e.def.radius)
      .sort((a, b) => (game.paths[a.pathIdx]!.length - a.progress) - (game.paths[b.pathIdx]!.length - b.progress));
    let fired = false;
    const hit = (e: Enemy, damage: number, type = tower.def.damageType) => {
      applyDamage(game, e, damage * game.mods.towerDamage, type, tower.def.id);
      game.addEffect({ kind: 'beam', from: { ...center }, to: { ...e.pos }, color: def.color, ttl: .3, max: .3 });
    };
    if (id === 'mend') {
      const heal = (unit: { hp: number; maxHp: number; pos: { x: number; y: number } }) => {
        if (unit.hp <= 0 || unit.hp >= unit.maxHp || dist(unit.pos, center) > range) return;
        unit.hp = Math.min(unit.maxHp, unit.hp + 45 * rank); fired = true;
        game.addEffect({ kind: 'text', pos: { x: unit.pos.x, y: unit.pos.y - 30 }, text: '+ REPAIR', color: def.color, ttl: .7, max: .7 });
      };
      if (heroOnYard(game)) heal(game.hero);
      for (const f of game.friendlies) if (f.respawn <= 0) heal(f);
      for (const s of game.heroSummons) if (s.left > 0) heal(s);
      for (const c of game.crew) if (c.timeLeft > 0) heal(c);
      for (const t of game.towers) if ((t.build ?? 0) <= 0 && t.rebuild <= 0 && !t.def.recruits) heal(t);
    } else if (id === 'overclock') {
      if (!targets.length) continue;
      for (const t of game.towers) if ((t.build ?? 0) <= 0 && (t.overheated ?? 0) <= 0 && t.frozen <= 0 && t.rebuild <= 0 && dist(t.pos, center) <= range) {
        t.overclock = { left: 5, strength: Math.max(t.overclock?.strength ?? 0, .2 * rank) }; fired = true;
      }
    } else if (targets.length) {
      fired = true;
      const target = targets[0]!;
      switch (id) {
        case 'incinerate':
          if (!target.burn || target.burn.dps <= 18 * rank * game.mods.towerDamage) target.burn = { dps: 18 * rank * game.mods.towerDamage, left: 4, source: tower.def.id };
          hit(target, 0); break;
        case 'barrage':
          for (const e of game.enemies) if (isTargetable(e) && matchesTargetMode(tower.def.targets, e) && dist(e.pos, target.pos) <= 50 + rank * 8) hit(e, 55 * rank);
          game.addEffect({ kind: 'splash', pos: { ...target.pos }, radius: 50 + rank * 8, color: def.color, ttl: .5, max: .5 });
          break;
        case 'deadeye': hit([...targets].sort((a, b) => b.hp - a.hp)[0]!, 125 * rank); break;
        case 'chain': {
          let previous = target;
          const hitIds = new Set<number>();
          for (let n = 0; n < rank + 2; n++) {
            const next = n === 0 ? target : targets.filter(e => !hitIds.has(e.id) && dist(e.pos, previous.pos) < 105)
              .sort((a, b) => dist(a.pos, previous.pos) - dist(b.pos, previous.pos))[0];
            if (!next) break;
            game.addEffect({ kind: 'beam', from: { ...previous.pos }, to: { ...next.pos }, color: def.color, ttl: .4, max: .4 });
            hit(next, 35 * rank, 'heat'); hitIds.add(next.id); previous = next;
          }
          break;
        }
        case 'freeze':
          for (const e of targets.slice(0, rank + 1)) { e.stun = Math.max(e.stun, e.def.traits.includes('boss') ? .4 : 1 + .5 * rank); hit(e, 0); }
          break;
        case 'corrode':
          for (const e of targets.slice(0, 3)) { e.armorShred = Math.max(e.armorShred, .2 + rank * .15); e.shredTimer = Math.max(e.shredTimer, 6); hit(e, 0); }
          break;
        case 'shockwave':
          fired = false;
          for (const e of targets.filter(e => !e.def.flying)) {
            hit(e, 45 * rank); fired = true;
            if (!e.dead && !e.def.traits.includes('boss')) e.progress = Math.max(0, e.progress - 15 * rank);
          }
          break;
        case 'expose':
          for (const e of targets.slice(0, rank + 2)) {
            e.phased = false; e.revealTimer = Math.max(e.revealTimer ?? 0, 5);
            e.exposed = { left: 5, strength: Math.max(e.exposed?.strength ?? 0, .15 + rank * .1) }; hit(e, 0);
          }
          break;
      }
    }
    if (fired) {
      ability.cooldown = def.cooldown;
      game.addEffect({ kind: 'ring', pos: { ...center }, radius: id === 'mend' || id === 'overclock' ? range : 34, color: def.color, ttl: .5, max: .5 });
      game.addEffect({ kind: 'text', pos: { x: center.x, y: center.y - 55 }, text: def.name.toUpperCase(), color: def.color, ttl: .8, max: .8 });
    }
  }
}
