import { HEROES, type HeroId, type HeroAbility } from './heroes';
import { levelFromXp } from './xp';

export type BuildStyle = 'engineer' | 'venom' | 'summoner' | 'blast' | 'hunter';
export interface HeroBuild { nodes: string[]; technique: 'signature' | BuildStyle }
export const EMPTY_BUILD: HeroBuild = { nodes: [], technique: 'signature' };
export const BUILD_STYLES: Record<BuildStyle, { name: string; color: string; passives: [string, string, string]; active: string; description: string }> = {
  engineer: { name: 'Tower support', color: '#f0c779', passives: ['Towers within 175 gain 12% damage while you are deployed.', 'Your support aura also gives towers 10% range.', 'Your support aura also gives towers 12% attack speed.'], active: 'Overtime Order', description: 'For 9 seconds, towers within 200 of you gain 35% attack speed. Your passive support remains active.' },
  venom: { name: 'Corrosion', color: '#b0db72', passives: ['Basic attacks poison the target for 6 heat damage per second for 4 seconds. Reapplying refreshes duration.', 'Poison deals 10 damage per second.', 'Poison lasts 6 seconds and slows its target by 15%.'], active: 'Hazmat Spill', description: 'Click the yard within 260. Create a 130-radius toxic pool for 7 seconds, dealing 18 heat damage per second and slowing ground enemies by 25%.' },
  summoner: { name: 'Reinforcements', color: '#9dc4ed', passives: ['During combat, call a 70-HP helper every 24 seconds. It fights for 10 seconds and holds one ground enemy.', 'Helpers gain 35 HP and deal 50% more damage.', 'Helpers last 15 seconds and arrive every 18 seconds.'], active: 'Crew Dispatch', description: 'Call two helpers at your position for 16 seconds. They fight and block independently of Logan. At most three helpers can be active; this skill replaces the oldest when full.' },
  blast: { name: 'Crowd control', color: '#ffa36e', passives: ['Basic attacks splash 25% of their base damage to other enemies within 48 of the target.', 'Splash radius increases to 68.', 'Splash damage increases to 45% of the basic attack.'], active: 'Pressure Break', description: 'Click the yard within 260. Blast a 120-radius area for 140 heat damage and stun enemies for 1 second. Boss stun is reduced.' },
  hunter: { name: 'Single target', color: '#ee9aac', passives: ['Consecutive basic hits on one target add 8% damage per hit, up to 32%. Switching target resets focus.', 'Focus rises by 12% per hit, up to 48%.', 'Basic attacks deal 25% extra damage against bosses.'], active: 'Priority Contract', description: 'Click a leak within 300. Deliver a 260-heat-damage strike and expose it to 25% extra damage from all sources for 6 seconds.' },
};
export const HERO_PATHS: Record<HeroId, { style: BuildStyle; name: string; technique: string }[]> = {
  jeff: [{ style: 'engineer', name: 'Master Foreman', technique: 'Beckman Standard' }, { style: 'venom', name: 'Pipe Chemist', technique: 'Acid Flush' }, { style: 'summoner', name: 'Crew Chief', technique: 'All Hands on Deck' }],
  mike: [{ style: 'engineer', name: 'Site Supervisor', technique: 'Jobsite Overtime' }, { style: 'blast', name: 'Plunger Demolition', technique: 'Pressure Bomb' }, { style: 'hunter', name: 'Longshot Plumber', technique: 'Pinpoint Plunger' }],
  bob: [{ style: 'venom', name: 'Chemical Systems', technique: 'Toxic Discharge' }, { style: 'hunter', name: 'Precision Systems', technique: 'Termination Order' }, { style: 'summoner', name: 'Personnel Systems', technique: 'Contractor Deployment' }],
  becbec: [{ style: 'blast', name: 'Earthshaker', technique: 'Fault Line' }, { style: 'hunter', name: 'Prizefighter', technique: 'One Punch Invoice' }, { style: 'engineer', name: 'Crew Captain', technique: 'Strongest Shift' }],
  chris: [{ style: 'venom', name: 'Hazmat Golfer', technique: 'Noxious Bunker' }, { style: 'blast', name: 'Sawstorm', technique: 'Demolition Derby' }, { style: 'summoner', name: 'Caddie Captain', technique: 'Bring the Caddies' }],
  cbj: [{ style: 'engineer', name: 'Truck Foreman', technique: 'Trucks on Overtime' }, { style: 'blast', name: 'Tater Artillery', technique: 'Loaded Tater Crater' }, { style: 'summoner', name: 'Convoy Commander', technique: 'Convoy Incoming' }],
  doni: [{ style: 'venom', name: 'Toxic Bait', technique: 'Chum Slick' }, { style: 'hunter', name: 'Trophy Angler', technique: 'The Big One' }, { style: 'engineer', name: 'Tour Operator', technique: 'Premium Guided Tour' }],
  jayjay: [{ style: 'hunter', name: 'Undisputed Champion', technique: 'Main Event' }, { style: 'blast', name: 'Ring Shaker', technique: 'Canvas Breaker' }, { style: 'summoner', name: 'Hype Squad', technique: 'Send in the Corner' }],
};
export function buildBudget(xp: number): number { return Math.min(8, levelFromXp(xp).level); }
export function buildRank(build: HeroBuild, style: BuildStyle): number { return [1, 2, 3, 4].filter(tier => build.nodes.includes(`${style}:${tier}`)).length; }
export function normalizeHeroBuild(hero: HeroId, value: unknown, budget = 8): HeroBuild {
  if (!value || typeof value !== 'object') return { nodes: [], technique: 'signature' };
  const raw = value as { nodes?: unknown; technique?: unknown };
  const nodes: string[] = [];
  const allowed = new Set(HERO_PATHS[hero].map(path => path.style));
  for (const id of Array.isArray(raw.nodes) ? raw.nodes : []) {
    if (typeof id !== 'string' || nodes.includes(id) || nodes.length >= budget) continue;
    const [style, tierText] = id.split(':'); const tier = Number(tierText);
    if (!allowed.has(style as BuildStyle) || ![1, 2, 3, 4].includes(tier) || id !== `${style}:${tier}`) continue;
    if (tier > 1 && !nodes.includes(`${style}:${tier - 1}`)) continue;
    nodes.push(id);
  }
  const technique = allowed.has(raw.technique as BuildStyle) && nodes.includes(`${raw.technique}:4`) ? raw.technique as BuildStyle : 'signature';
  return { nodes, technique };
}
export function buildAbility(hero: HeroId, style: BuildStyle): HeroAbility {
  const path = HERO_PATHS[hero].find(path => path.style === style)!;
  const def = BUILD_STYLES[style];
  return { name: path.technique, short: def.name, description: def.description, cooldown: style === 'hunter' ? 30 : 36,
    glyph: style === 'engineer' ? 'overclock' : style === 'venom' ? 'gas' : style === 'summoner' ? 'crew' : style === 'blast' ? 'slam' : 'crosshair',
    target: ['venom', 'blast', 'hunter'].includes(style), aim: style === 'hunter' ? 'enemy' : 'ground', castRange: style === 'hunter' ? 300 : 260, cast: .9,
    ranks: ['Stronger signature technique.', 'Stronger signature technique.', 'Maximum technique power.'] };
}
export function heroForBuild(hero: HeroId, build: HeroBuild) {
  const def = HEROES[hero];
  if (build.technique === 'signature') return def;
  return { ...def, abilities: [def.abilities[0], def.abilities[1], def.abilities[2], def.abilities[3], buildAbility(hero, build.technique)] as const };
}
