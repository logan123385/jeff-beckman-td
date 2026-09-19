import type { Modifiers, SkillBranch, SkillNode } from './types';

export function neutralModifiers(): Modifiers {
  return {
    towerDamage: 1,
    towerCost: 1,
    towerRange: 1,
    jeffHp: 1,
    jeffSpeed: 1,
    jeffDamage: 1,
    cooldown: 1,
    stunDuration: 1,
    startMoney: 0,
    sellRate: 0.7,
    bounty: 1,
    jeffHolds: 0,
    jeffRepair: 1,
    jeffReach: 1,
    jeffRespawn: 1,
    jeffTapEvery: 1,
  };
}

export const SKILL_BRANCHES: Record<SkillBranch, { name: string; blurb: string }> = {
  tools: { name: 'Tools', blurb: 'Better gear on the truck.' },
  jeff: { name: 'Van', blurb: 'The truck, not Jeff. His hands live on the talent tree and in the locker.' },
  shop: { name: 'Shop', blurb: 'Running a tighter business.' },
};

export const SKILLS: SkillNode[] = [
  { id: 'sharpTools', branch: 'tools', tier: 1, name: 'Sharp Tools', desc: '+10% tower damage', apply: (m) => (m.towerDamage *= 1.1) },
  { id: 'bulkDiscount', branch: 'tools', tier: 2, name: 'Bulk Discount', desc: '-10% tower build & upgrade cost', apply: (m) => (m.towerCost *= 0.9) },
  { id: 'longReach', branch: 'tools', tier: 3, name: 'Long Reach', desc: '+10% tower range', apply: (m) => (m.towerRange *= 1.1) },

  { id: 'sturdyBoots', branch: 'jeff', tier: 1, name: 'Coffee Money', desc: '+50 starting cash on every job', apply: (m) => (m.startMoney += 50) },
  { id: 'quickHands', branch: 'jeff', tier: 2, name: 'Shop Rate', desc: '−8% tower build & upgrade cost', apply: (m) => (m.towerCost *= 0.92) },
  { id: 'heavyWrench', branch: 'jeff', tier: 3, name: 'Tuned Tips', desc: '+8% tower damage', apply: (m) => (m.towerDamage *= 1.08) },

  { id: 'startingFloat', branch: 'shop', tier: 1, name: 'Starting Float', desc: '+80 starting cash on every job', apply: (m) => (m.startMoney += 80) },
  { id: 'scrapValue', branch: 'shop', tier: 2, name: 'Scrap Value', desc: 'Sell towers for 90% instead of 70%', apply: (m) => (m.sellRate = 0.9) },
  { id: 'overtime', branch: 'shop', tier: 3, name: 'Overtime', desc: '+15% bounty per kill', apply: (m) => (m.bounty *= 1.15) },
];

export function buildModifiers(unlocked: Iterable<string>): Modifiers {
  const m = neutralModifiers();
  const set = new Set(unlocked);
  for (const s of SKILLS) if (set.has(s.id)) s.apply(m);
  return m;
}

/** A node can be bought only when the previous tier in its branch is owned. */
export function canUnlock(nodeId: string, unlocked: Set<string>): boolean {
  const node = SKILLS.find((s) => s.id === nodeId);
  if (!node || unlocked.has(nodeId)) return false;
  if (node.tier === 1) return true;
  const prev = SKILLS.find((s) => s.branch === node.branch && s.tier === node.tier - 1);
  return prev !== undefined && unlocked.has(prev.id);
}
