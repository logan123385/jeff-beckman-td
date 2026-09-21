import { ENEMIES } from './enemies';
import { TOWERS } from './towers';
import type { EnemyDef, MapDef, TowerId } from './types';

export function enemyTraits(def: EnemyDef): string[] {
  return [def.flying ? 'Flying' : 'Ground',
    ...(def.armor > 0 ? [`${Math.round(def.armor * 100)}% armor`] : []),
    ...(def.speed >= 95 ? ['Fast'] : []),
    ...(def.traits.includes('phases') ? ['Phases'] : []),
    ...(def.traits.includes('freezes') ? ['Freezes towers'] : []),
    ...(def.traits.includes('hasteAura') ? ['Haste aura'] : []),
    ...(def.traits.includes('boss') ? ['Boss'] : [])];
}

/** Advice reflects the actual packed tools, including support-only towers that cannot kill fliers. */
export function loadoutWarnings(map: MapDef, kit: readonly TowerId[]): string[] {
  const foes = [...new Set(map.waves.flatMap(w => w.groups.map(g => g.enemy)))].map(id => ENEMIES[id]);
  const tools = kit.map(id => TOWERS[id]);
  const warnings: string[] = [];
  if (foes.some(e => e.flying) && !tools.some(t => t.targets !== 'ground' && t.levels.some(l => l.damage > 0)))
    warnings.push('No damaging anti-air tower packed. Flying enemies bypass your ground defenses.');
  if (foes.some(e => e.armor >= .5) && !tools.some(t => ((t.damageType === 'fire' || t.damageType === 'heat') && t.levels[0].damage > 0) || t.armorBonus || t.levels[0].shred))
    warnings.push('Heavy armor ahead. Pack heat, fire, an armor breaker, or armor stripping.');
  if (tools.length && tools.every(t => t.kind === 'barricade')) warnings.push('All frontline, no covering fire. Add a ranged tower to support your crew.');
  return warnings;
}
