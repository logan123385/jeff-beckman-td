import { JEFF } from './jeff';

export const HERO_ORDER = ['jeff', 'mike', 'bob', 'chris', 'becbec'] as const;
export type HeroId = typeof HERO_ORDER[number];
export type AbilitySlot = 0 | 1 | 2 | 3 | 4;
export const ABILITY_KEYS = ['Q', 'E', 'R', 'T', 'C'] as const;
export const ABILITY_RANK_CAP = 3;
// Retain the original save/test-facing cooldown fields while all four kits use the same controls.
export const COOLDOWN_FIELDS = ['clampCooldown', 'shutoffCooldown', 'pulseCooldown', 'sleeveCooldown', 'coffeeCooldown'] as const;
export interface HeroAbility {
  name: string; description: string; short: string; cooldown: number;
  glyph: string; target?: boolean; aim?: 'enemy' | 'ground'; castRange?: number; cast: number;
  /** Blurb for ranking 0→1, 1→2, 2→3. */
  ranks: readonly [string, string, string];
}
export interface HeroDef {
  id: HeroId; name: string; title: string; style: string; description: string; color: string;
  hp: number; speed: number; reach: number; damage: number; attackRate: number;
  swingTime: number; holds: number; armor: number; ranged: boolean;
  aura: { name: string; description: string; radius: number };
  abilities: readonly [HeroAbility, HeroAbility, HeroAbility, HeroAbility, HeroAbility];
}
export const HEROES: Record<HeroId, HeroDef> = {
  jeff: {
    ...JEFF, id: 'jeff', style: 'Frontline guardian', description: 'Wrench through armor, hold the line, and keep the entire crew on their feet.',
    color: '#e6c16b', armor: 0, ranged: false,
    aura: { name: 'Greatest Plumber to Ever Live', description: 'Within 110: friendly NPCs recover 2% health each second and take 15% less damage. Jeff repairs nearby barricades.', radius: 110 },
    abilities: [
      { name: 'Pipe Clamp', short: 'Hold + slow', description: 'Clamp nearby ground enemies for 5 seconds and slow them by 55%.', cooldown: JEFF.clamp.cooldown, glyph: 'clamp', cast: .72,
        ranks: ['Wider bite. Holds one extra leak.', 'Longer clamp. The slow bites harder.', 'Maximum hold. Nothing wriggles free.'] },
      { name: 'Emergency Shutoff', short: 'Global slowdown', description: 'Slow every enemy by 75% and pause incoming spawns for 5 seconds.', cooldown: JEFF.shutoff.cooldown, glyph: 'valve', cast: .72,
        ranks: ['The yard stays quiet a beat longer.', 'Deeper slow. Spawns wait longer.', 'Full freeze. The whole job holds its breath.'] },
      { name: 'Manometer Pulse', short: 'Shred + stun', description: 'Deal 38 damage, shred armor, and stun enemies around Jeff.', cooldown: JEFF.pulse.cooldown, glyph: 'pulse', cast: .72,
        ranks: ['Harder hit. Wider burst.', 'Sharper shred. Longer stun.', 'Maximum pulse. Armor comes off.'] },
      { name: 'Isolation Sleeve', short: '+4 enemy holds', description: 'Hold four additional enemies for 7.5 seconds.', cooldown: JEFF.sleeve.cooldown, glyph: 'shield', cast: .72,
        ranks: ['Hold one extra leak.', 'Lasts longer. You are the barricade.', 'Maximum sleeve. The line does not move.'] },
      { name: 'Coffee', short: 'Heal + hustle', description: 'Recover 110 health and move 55% faster for 6 seconds.', cooldown: JEFF.coffee.cooldown, glyph: 'coffee', cast: .72,
        ranks: ['Bigger gulp. Faster on your feet.', 'Longer hustle. More health back.', 'Maximum brew. Jeff does not walk — he arrives.'] },
    ],
  },
  mike: {
    id: 'mike', name: 'Big Mike', title: 'Plungers. Horsepower. Royalty.', style: 'Mobile ranged support',
    description: 'Lob plunger javelins from the roof of a blue and cream service truck. Reposition to rally your towers, then bury a lane in plungers.',
    color: '#84bff0', hp: 520, speed: 98, reach: 195, damage: 39, attackRate: .85, swingTime: .92, holds: 1, armor: .12, ranged: true,
    aura: { name: 'The Truck King', description: 'Within 145: towers attack 12% faster and reach 8% farther. Park near a cluster of defenses to lead the convoy.', radius: 145 },
    abilities: [
      { name: 'Plunger Volley', short: '3 heavy javelins', description: 'Click a leak within 280. Throw three 52-damage plungers; each splashes a small area.', cooldown: 18, glyph: 'volley', target: true, aim: 'enemy', castRange: 280, cast: .92,
        ranks: ['Heavier javelins. Quicker reload.', 'Tighter splash. The truck throws harder.', 'Maximum volley. Three royal plungers.'] },
      { name: 'Make Way!', short: 'Horn + knockback', description: 'Sound the truck horn: deal 48 damage, stun, and push ground enemies backward within 130. Bosses resist the push.', cooldown: 25, glyph: 'horn', cast: .85,
        ranks: ['Louder horn. Wider shove.', 'Longer stun. The lane clears.', 'Maximum blast. Get off the road.'] },
      { name: 'Tailgate Supply', short: 'Repair station · 8s', description: 'Drop a supply crate for 8 seconds. Allies in 100 recover 18 health per second; damaged barricades recover 30.', cooldown: 27, glyph: 'crate', cast: .8,
        ranks: ['Stronger crate. Allies mend faster.', 'Lasts longer. The tailgate stays open.', 'Maximum supply. A rolling workshop.'] },
      { name: 'Full Throttle', short: 'Speed + rapid throws', description: 'For 8 seconds, drive 65% faster and throw 50% faster. Attacks finish their full throw before the next begins.', cooldown: 25, glyph: 'truck', cast: .7,
        ranks: ['Quicker throws. The truck surges.', 'Longer overdrive.', 'Maximum throttle. Convoy speed.'] },
      { name: 'Royal Rain', short: 'Plunger bombardment', description: 'Click the yard within 280. Nine plungers rain into a 90-radius area over 4.5 seconds, each dealing 32 splash damage.', cooldown: 42, glyph: 'rain', target: true, aim: 'ground', castRange: 280, cast: 1.05,
        ranks: ['Heavier plungers from the sky.', 'Wider bombardment.', 'Maximum rain. The yard disappears.'] },
    ],
  },
  bob: {
    id: 'bob', name: 'Robo Bob', title: 'Human judgment. Laser consequences.', style: 'Precision ranged destroyer',
    description: 'A cyborg with a hand cannon. Burn armored threats, expose phased enemies, and line up a devastating beam through a packed lane.',
    color: '#72e3e9', hp: 360, speed: 110, reach: 175, damage: 27, attackRate: 1.18, swingTime: .72, holds: 1, armor: .2, ranged: true,
    aura: { name: "Orbs Aren't Real", description: 'Within 135: phased enemies stay visible and flying enemies lose 20% speed. Bob refuses to acknowledge evasive nonsense.', radius: 135 },
    abilities: [
      { name: "You're Fired", short: 'Piercing thermal beam', description: 'Click a leak within 300. Charge a 420-range beam through it, dealing 140 heat to every enemy in the path.', cooldown: 36, glyph: 'laser', target: true, aim: 'enemy', castRange: 300, cast: 1.2,
        ranks: ['Hotter beam. Longer reach.', 'Deeper shred. The lane cooks.', 'Maximum fire. Everything in the path burns.'] },
      { name: 'System Reboot', short: 'Heal + armor', description: 'Restore 130 health and reduce incoming damage by an additional 35% for 8 seconds.', cooldown: 30, glyph: 'reboot', cast: .85,
        ranks: ['Bigger heal. Thicker armor.', 'Lasts longer.', 'Maximum reboot. Bob does not stay down.'] },
      { name: 'EMP Notice', short: 'Area stun + reveal', description: 'An expanding EMP hits enemies in 145 for 40 heat damage, reveals phased enemies, and stuns for 2.5 seconds.', cooldown: 24, glyph: 'emp', cast: .8,
        ranks: ['Wider EMP. Harder stun.', 'Longer reveal. Phased leaks stay seen.', 'Maximum notice. The yard lights up.'] },
      { name: 'Overclock', short: 'Rapid laser fire · 8s', description: 'For 8 seconds, charge and fire the hand cannon 65% faster with complete accelerated attack cycles.', cooldown: 26, glyph: 'overclock', cast: .7,
        ranks: ['Faster cannon.', 'Lasts longer.', 'Maximum overclock. Full automatic.'] },
      { name: 'Performance Review', short: 'Expose 3 priority targets', description: 'Mark the three toughest enemies within 280 for 9 seconds. All sources deal 30% more damage to them.', cooldown: 32, glyph: 'crosshair', cast: .9,
        ranks: ['Marks hit harder.', 'Lasts longer. Priority stays painted.', 'Maximum review. A fourth target joins the list.'] },
    ],
  },
  becbec: {
    id: 'becbec', name: 'Becbec', title: 'No tools required.', style: 'Heavy melee brawler',
    description: 'Bare hands and overwhelming strength. Break armor with a haymaker, smash a crowd into the ground, and stand firm while your crew cleans up.',
    color: '#efa0cf', hp: 590, speed: 122, reach: 43, damage: 32, attackRate: 1.18, swingTime: .73, holds: 3, armor: .16, ranged: false,
    aura: { name: 'Stronger Together', description: 'Within 120: friendly NPCs and support crew deal 20% more damage. Her presence turns a crew into a wrecking team.', radius: 120 },
    abilities: [
      { name: 'Haymaker', short: 'Armor-breaking punch', description: 'Click a ground leak within 75. 110 damage, 45% armor shred, and a 1.8-second stun.', cooldown: 16, glyph: 'fist', target: true, aim: 'enemy', castRange: 75, cast: .85,
        ranks: ['Harder punch. Longer reach.', 'Deeper shred. Longer stun.', 'Maximum haymaker. One punch, problem solved.'] },
      { name: 'Seismic Slam', short: 'Ground shockwave', description: 'Slam both fists into the ground. Enemies within 105 take 65 damage and are stunned for 1.2 seconds.', cooldown: 24, glyph: 'slam', cast: 1.05,
        ranks: ['Wider shockwave. Harder hit.', 'Longer stun.', 'Maximum slam. The floor gives up.'] },
      { name: 'Bring It On', short: 'Hold five + guard', description: 'For 7 seconds, hold up to five nearby enemies and reduce incoming damage by an additional 35%.', cooldown: 28, glyph: 'taunt', cast: .8,
        ranks: ['Hold the line longer.', 'Thicker guard.', 'Maximum taunt. Five leaks, no problem.'] },
      { name: 'Iron Will', short: 'Restore + fortify', description: 'Recover 160 health and reduce incoming damage by an additional 35% for 6 seconds.', cooldown: 32, glyph: 'heart', cast: .8,
        ranks: ['Bigger restore.', 'Longer fortify.', 'Maximum will. She does not break.'] },
      { name: 'Knuckle Storm', short: 'Five-hit punch combo', description: 'Unleash five complete rapid punches, each dealing 35 damage to nearby ground enemies. The final punch stuns.', cooldown: 36, glyph: 'combo', cast: 2,
        ranks: ['Each punch hits harder.', 'The finale stuns longer.', 'Maximum storm. Five hits, nobody standing.'] },
    ],
  },
  chris: {
    id: 'chris', name: 'Mr. Chris', title: 'Saw teeth. Tee times. Tiny accomplice.', style: 'Melee skirmisher & summoner',
    description: 'Carve into crowds with a reciprocating saw, bank a golf shot through enemies, and unleash Logan to scramble after stragglers.',
    color: '#c3d78a', hp: 430, speed: 136, reach: 44, damage: 19, attackRate: 1.65, swingTime: .57, holds: 2, armor: .08, ranged: false,
    aura: { name: 'Strongest Boy in the 8th Grade', description: 'Within 85: ground enemies move 15% slower and suffer 4 heat damage per second. Hallway gravity. Nobody walks past him at full speed.', radius: 85 },
    abilities: [
      { name: 'Unleash Logan', short: 'Tiny gremlin ally · 18s', description: 'Summon Logan for 18 seconds. He scurries after nearby ground enemies, holds one, and bites and batters with rapid attacks.', cooldown: 28, glyph: 'logan', cast: .85,
        ranks: ['Logan lasts longer. Tougher boy.', 'Faster bites. More health.', 'Maximum Logan. Strongest boy on the yard.'] },
      { name: 'FORE!', short: '3 ricocheting golf hits', description: 'Click a leak within 280. The ball bounces to two more targets, dealing 70, 49, and 34 damage.', cooldown: 20, glyph: 'golf', target: true, aim: 'enemy', castRange: 280, cast: 1.05,
        ranks: ['Heavier ball. Longer reach.', 'Harder ricochets.', 'Maximum drive. Three brutal hops.'] },
      { name: 'Reciprocating Rampage', short: 'Sweeping saw combo', description: 'Carve three sweeping saw cuts through nearby ground enemies for 30 damage each. Every cut strips armor.', cooldown: 22, glyph: 'saw', cast: 1.25,
        ranks: ['Each cut hits harder.', 'Deeper shred.', 'Maximum rampage. The hallway is a saw lane.'] },
      { name: 'Clear the Room', short: 'Lingering gas cloud · 7s', description: 'Leave a 110-radius cloud for 7 seconds. Ground enemies take 12 heat damage per second and move 40% slower.', cooldown: 30, glyph: 'gas', cast: .8,
        ranks: ['Thicker cloud. Harder heat.', 'Lasts longer. Deeper slow.', 'Maximum gas. Nobody walks through.'] },
      { name: 'Second Wind', short: 'Heal + lifesteal', description: 'Recover 100 health. For 8 seconds, saw attacks are 30% faster and return 45% of damage dealt as health.', cooldown: 28, glyph: 'wind', cast: .7,
        ranks: ['Bigger heal. Faster saw.', 'Longer lifesteal.', 'Maximum wind. Chris does not clock out.'] },
    ],
  },
};
export function isHeroId(value: unknown): value is HeroId { return HERO_ORDER.includes(value as HeroId); }
