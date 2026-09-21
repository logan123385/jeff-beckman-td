import {
  baseProfile,
  implicitFor,
  type AttackProfile,
  type WeaponFamilyId,
} from '../data/weapons';
import type { GearAffix, Rarity } from '../data/types';

export function resolveAttackProfile(
  family: WeaponFamilyId,
  rarity: Rarity,
  affixes: GearAffix[],
): AttackProfile {
  const base = baseProfile(family);
  const impl = implicitFor(family, rarity);
  const out: AttackProfile = {
    ...base,
    ...impl,
    pierce: base.pierce + (impl.pierce ?? 0),
    bounce: base.bounce + (impl.bounce ?? 0),
    holds: base.holds + (impl.holds ?? 0),
    splash: impl.splash ?? base.splash,
    splashRadius: impl.splashRadius ?? base.splashRadius,
    pull: base.pull + (impl.pull ?? 0),
    stun: impl.stun ?? base.stun,
    stunChance: impl.stunChance ?? base.stunChance,
    shred: impl.shred ?? base.shred,
    reach: impl.reach ? base.reach + impl.reach : base.reach,
  };
  for (const a of affixes) {
    if (a.key === 'jeffHolds') out.holds += a.amount;
    if (a.key === 'jeffReach') out.reach *= 1 + a.amount;
    if (a.key === 'jeffDamage') out.damage *= 1 + a.amount;
    if (a.key === 'heroRate') out.attackRate *= 1 + a.amount;
  }
  return out;
}
