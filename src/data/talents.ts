import type { Modifiers, TalentBranch, TalentNode } from './types';

export const TALENT_BRANCHES: Record<TalentBranch, { name: string; blurb: string }> = {
  combat: { name: 'Combat', blurb: 'The wrench does more of the talking.' },
  field: { name: 'Field', blurb: 'Stay on your feet and keep the valves alive.' },
  foreman: { name: 'Foreman', blurb: 'Run the job like you own the truck.' },
};

export const TALENTS: TalentNode[] = [
  { id: 'ironGrip', branch: 'combat', tier: 1, name: 'Iron Grip', desc: 'Hold +1 extra leak in melee', apply: (m) => (m.jeffHolds += 1) },
  { id: 'wreckingTap', branch: 'combat', tier: 2, name: 'Wrecking Tap', desc: 'Wrench Tap every 4 swings instead of 5', apply: (m) => (m.jeffTapEvery *= 4 / 5) },
  { id: 'closer', branch: 'combat', tier: 3, name: 'Get Closer', desc: '+20% melee reach and +15% wrench damage', apply: (m) => { m.jeffReach *= 1.2; m.jeffDamage *= 1.15; } },
  { id: 'bossBreaker', branch: 'combat', tier: 4, name: 'Boss Breaker', desc: '+20% Jeff damage', apply: (m) => (m.jeffDamage *= 1.2) },

  { id: 'longStride', branch: 'field', tier: 1, name: 'Long Stride', desc: '+15% move speed', apply: (m) => (m.jeffSpeed *= 1.15) },
  { id: 'ironLungs', branch: 'field', tier: 2, name: 'Iron Lungs', desc: '+20% Jeff health', apply: (m) => (m.jeffHp *= 1.2) },
  { id: 'firstAid', branch: 'field', tier: 3, name: 'First Aid Kit', desc: '+50% barricade repair from the belt', apply: (m) => (m.jeffRepair *= 1.5) },
  { id: 'neverDown', branch: 'field', tier: 4, name: 'Never Down Long', desc: 'Get back up 40% faster', apply: (m) => (m.jeffRespawn *= 0.6) },

  { id: 'crewCall', branch: 'foreman', tier: 1, name: 'Crew Call', desc: '+60 starting cash', apply: (m) => (m.startMoney += 60) },
  { id: 'leftover', branch: 'foreman', tier: 2, name: 'Leftover Fittings', desc: '+12% bounty', apply: (m) => (m.bounty *= 1.12) },
  { id: 'clampWork', branch: 'foreman', tier: 3, name: 'Clamp Work', desc: '−15% ability cooldowns', apply: (m) => (m.cooldown *= 0.85) },
  { id: 'shutoffPro', branch: 'foreman', tier: 4, name: 'Shutoff Pro', desc: '+35% stun duration', apply: (m) => (m.stunDuration *= 1.35) },
];

export function applyTalents(m: Modifiers, unlocked: Iterable<string>): void {
  const set = new Set(unlocked);
  for (const t of TALENTS) if (set.has(t.id)) t.apply(m);
}

export function canUnlockTalent(nodeId: string, unlocked: Set<string>): boolean {
  const node = TALENTS.find((s) => s.id === nodeId);
  if (!node || unlocked.has(nodeId)) return false;
  if (node.tier === 1) return true;
  const prev = TALENTS.find((s) => s.branch === node.branch && s.tier === node.tier - 1);
  return prev !== undefined && unlocked.has(prev.id);
}
