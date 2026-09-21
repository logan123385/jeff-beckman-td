import type { HeroDef } from './heroes';

/** The former workshop crew now take the field as fully controlled heroes. */
export const CREW_HEROES = {
  cbj: {
    id: 'cbj', name: 'CBJ', title: 'A full tank. A full plate.', style: 'Ranged quartermaster',
    description: 'Keep the crew fed and the defenses firing. Lob loaded taters into the lane, set up a tailgate lunch, and unload an entire truck of potatoes.',
    color: '#efbb68', hp: 540, speed: 110, reach: 155, damage: 28, attackRate: 1, swingTime: .78, holds: 1, armor: .12, ranged: true, respawn: 12,
    aura: { name: 'trucks n taters', description: 'Within 125: towers deal 10% more damage, and living friendly NPCs and Logan recover 6 health each second. Dinner is on CBJ.', radius: 125 },
    abilities: [
      { name: 'Loaded Tater', short: 'Heavy splash shot', description: 'Click a leak within 260. Lob a 90-damage tater that bursts across a 42-radius area.', cooldown: 17, glyph: 'tater', target: true, aim: 'enemy', castRange: 260, cast: .8,
        ranks: ['A heavier helping. Wider splash.', 'More filling. Quicker reload.', 'Fully loaded. Extra everything.'] },
      { name: 'Tailgate Slam', short: 'Shove + stun', description: 'Slam the tailgate: ground enemies within 110 take 55 damage, a brief stun, and a backward shove. Bosses resist the push.', cooldown: 24, glyph: 'slam', cast: .9,
        ranks: ['Harder slam. Wider shove.', 'A longer stun.', 'The whole truck shakes.'] },
      { name: 'Lunch Break', short: 'Healing station · 9s', description: 'Set out lunch for 9 seconds. Allies within 110 recover 18 health per second; damaged barricades recover 30.', cooldown: 28, glyph: 'crate', cast: .85,
        ranks: ['Bigger servings. Faster healing.', 'Lunch stays out longer.', 'Nobody leaves hungry.'] },
      { name: 'Diesel Rush', short: 'Rapid throws + hustle', description: 'For 8 seconds, throw 50% faster and move 22% faster. Every throw keeps its full wind-up and follow-through.', cooldown: 26, glyph: 'truck', cast: .7,
        ranks: ['Keep the engine running longer.', 'An even longer rush.', 'A full tank of overtime.'] },
      { name: 'Fully Loaded', short: 'Nine-tater bombardment', description: 'Click the yard within 280. Nine taters rain across a 90-radius area over 4.5 seconds, each dealing 34 splash damage.', cooldown: 42, glyph: 'rain', target: true, aim: 'ground', castRange: 280, cast: 1.05,
        ranks: ['Heavier potatoes.', 'A wider delivery zone.', 'The entire truckload.'] },
    ],
  },
  doni: {
    id: 'doni', name: 'Doni', title: 'Every leak is a keeper.', style: 'Ranged lane controller',
    description: 'Work the river with a hooked line. Reel threats away from the exit, net an entire bend, then land the big one with a three-target fishing combo.',
    color: '#71d5ce', hp: 420, speed: 126, reach: 170, damage: 24, attackRate: 1.1, swingTime: .76, holds: 1, armor: .08, ranged: true, respawn: 11,
    aura: { name: 'guided fishing tour', description: 'Within 130: ground enemies move 12% slower and take 10% more damage from every source. Doni knows where the fish are.', radius: 130 },
    abilities: [
      { name: 'Set the Hook', short: 'Reel back + stun', description: 'Click a leak within 300. A heavy hook deals 85 damage on contact, pulls ground enemies backward and stuns them for 1.2 seconds. Bosses resist the pull.', cooldown: 19, glyph: 'hook', target: true, aim: 'enemy', castRange: 300, cast: .9,
        ranks: ['A sharper hook. Longer reach.', 'More damage on the line.', 'A trophy-sized catch.'] },
      { name: 'Cast a Wide Net', short: 'Ground slow zone · 6s', description: 'Click the yard within 260. Spread a 100-radius net for 6 seconds: ground enemies move 55% slower and take 8 damage per second.', cooldown: 26, glyph: 'net', target: true, aim: 'ground', castRange: 260, cast: 1,
        ranks: ['Wider net. Stronger knots.', 'More time in the net.', 'Nothing slips through.'] },
      { name: 'Shore Lunch', short: 'Heal + guard', description: 'Recover 130 health, heal living allies within 120 for 60, and take 35% less damage for 5 seconds.', cooldown: 29, glyph: 'coffee', cast: .85,
        ranks: ['A bigger lunch for everyone.', 'More healing. Longer guard.', 'Back to the river, refreshed.'] },
      { name: 'River Current', short: 'Sweeping wave', description: 'Wash ground enemies within 130 backward and deal 50 water damage. Bosses resist the push.', cooldown: 25, glyph: 'current', cast: .95,
        ranks: ['A stronger current. Wider sweep.', 'More force in the water.', 'The river takes over.'] },
      { name: 'The Big One', short: 'Three ricocheting hooks', description: 'Click a leak within 300. A heavy hook hits three different targets for 150, 105, and 73 damage; each ground hit reels its catch backward and stuns.', cooldown: 40, glyph: 'hook', target: true, aim: 'enemy', castRange: 300, cast: 1.2,
        ranks: ['A heavier catch.', 'Harder ricochets.', 'A story worth telling.'] },
    ],
  },
  jayjay: {
    id: 'jayjay', name: 'Jayjay', title: 'The undisputed service champion.', style: 'Frontline heavyweight',
    description: 'Walk straight into the crowd and own the ring. Peel armor from nearby leaks, protect the crew, and finish a three-punch combination with a knockout.',
    color: '#f2a196', hp: 680, speed: 108, reach: 48, damage: 42, attackRate: .83, swingTime: .88, holds: 4, armor: .24, ranged: false, respawn: 14,
    aura: { name: 'would beat ronda rousey in a 1v1 easily', description: 'Within 110: ground enemies lose 15% armor, and friendly NPCs and Logan take 20% less damage. The confidence is contagious.', radius: 110 },
    abilities: [
      { name: 'Opening Bell', short: 'Heavy stunning punch', description: 'Click a ground leak within 80. Land a 115-damage punch and stun it for 1.4 seconds.', cooldown: 17, glyph: 'fist', target: true, aim: 'enemy', castRange: 80, cast: .88,
        ranks: ['A heavier opener. Longer reach.', 'Harder hit. Longer stun.', 'Start the round with authority.'] },
      { name: 'Canvas Slam', short: 'Ground shockwave', description: 'Shake the ring: ground enemies within 115 take 70 damage and are stunned for one second.', cooldown: 25, glyph: 'slam', cast: 1.1,
        ranks: ['A wider shockwave.', 'More damage. Longer stun.', 'The whole ring feels it.'] },
      { name: 'Square Up', short: 'Hold five + guard', description: 'For 8 seconds, hold up to five enemies and take an additional 35% less damage.', cooldown: 29, glyph: 'taunt', cast: .8,
        ranks: ['Stay squared up longer.', 'Another moment in the ring.', 'The line belongs to Jayjay.'] },
      { name: 'Second Round', short: 'Heal + faster punches', description: 'Recover 190 health and punch 30% faster for 8 seconds, with complete accelerated attack cycles.', cooldown: 33, glyph: 'heart', cast: .85,
        ranks: ['A bigger recovery.', 'A longer second wind.', 'Ready to go the distance.'] },
      { name: 'Unanimous Decision', short: 'Three-hit knockout combo', description: 'Deliver three complete punches to ground enemies within 75, each dealing 75 damage. The final contact stuns for 1.7 seconds.', cooldown: 38, glyph: 'combo', cast: 1.8,
        ranks: ['Every punch lands harder.', 'A longer final stun.', 'Three rounds. No doubt.'] },
    ],
  },
} satisfies Record<'cbj' | 'doni' | 'jayjay', HeroDef>;
