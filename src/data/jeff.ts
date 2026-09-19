export const JEFF = {
  name: 'Jeff Beckman',
  title: 'Best Plumber in the World',
  hp: 420,
  speed: 118,
  /** Melee reach. */
  reach: 42,
  damage: 22,
  attackRate: 1.35,
  /** Visual + timing window for the wrench follow-through. */
  swingTime: 0.68,
  holds: 2,
  armorShred: 0.18,
  shredDuration: 3.2,
  wrenchTap: { every: 5, stun: 1.7 },
  clamp: { duration: 5, cooldown: 18, radius: 56, slow: 0.55, holds: 5 },
  shutoff: { duration: 5, cooldown: 52, slow: 0.75 },
  pulse: { damage: 38, radius: 84, shred: 0.4, stun: 0.85, cooldown: 14 },
  sleeve: { duration: 7.5, extraHolds: 4, cooldown: 20 },
  coffee: { heal: 110, duration: 6, speed: 1.55, cooldown: 24 },
  respawn: 11,
  toolBelt: { repairPerSec: 22, radius: 96 },
} as const;
