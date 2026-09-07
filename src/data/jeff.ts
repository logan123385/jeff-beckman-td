export const JEFF = {
  name: 'Jeff Beckman',
  title: 'Jobsite Lead',
  hp: 420,
  speed: 115,
  /** Melee reach. */
  reach: 40,
  /** Enemies within this radius pull Jeff into a fight when he is idle. */
  aggro: 60,
  damage: 22,
  attackRate: 1.3,
  holds: 2,
  armorShred: 0.15,
  shredDuration: 3,
  wrenchTap: { every: 6, stun: 1.5 },
  clamp: { duration: 4, cooldown: 20, radius: 48, slow: 0.5, holds: 4 },
  shutoff: { duration: 4, cooldown: 60, slow: 0.7 },
  respawn: 12,
  toolBelt: { repairPerSec: 18, radius: 90 },
} as const;
