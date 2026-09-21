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
    heroRate: 1,
    onHitHeat: 0,
    crewHp: 1, crewDamage: 1, crewRespawn: 1,
  };
}

export const SKILL_BRANCHES: Record<SkillBranch, { name: string; blurb: string }> = {
  crew: { name: 'Crew', blurb: 'Train, equip, and protect the people on the line.' },
  tools: { name: 'Tools', blurb: 'Better gear on the truck.' },
  jeff: { name: 'Field Support', blurb: 'Keep your hero ready with field care, faster skills, and harder hits.' },
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
  { id: 'crewTraining', branch: 'crew', tier: 1, name: 'First Day Ready', desc: '+12% recruit health', apply: m => m.crewHp *= 1.12 },
  { id: 'crewArmor', branch: 'crew', tier: 2, name: 'Safety First', desc: '+25% recruit health', apply: m => m.crewHp *= 1.25 },
  { id: 'crewPractice', branch: 'crew', tier: 2, name: 'Tool Practice', desc: '+20% recruit damage', apply: m => m.crewDamage *= 1.2 },
  { id: 'crewReturn', branch: 'crew', tier: 3, name: 'Back on Site', desc: 'Recruits respawn 20% faster', apply: m => m.crewRespawn *= 0.8 },
  { id: 'qualitySteel', branch: 'tools', tier: 2, name: 'Quality Steel', desc: '+15% tower damage instead of discounted equipment', apply: m => m.towerDamage *= 1.15 },
  { id: 'rapidResponse', branch: 'jeff', tier: 2, name: 'Rapid Response', desc: 'Hero skill cooldowns reduced by 12%', apply: m => m.cooldown *= 0.88 },
  { id: 'premiumRates', branch: 'shop', tier: 2, name: 'Premium Rates', desc: '+12% kill bounties instead of larger refunds', apply: m => m.bounty *= 1.12 },

];

for (const branch of ['tools', 'jeff', 'shop', 'crew'] as const) {
  const paths: Record<SkillBranch, [string, string, string]> = {
    tools: ['Long-range Engineering', 'Demolition License', 'Master Toolsmith'],
    jeff: ['Field Medic', 'Fast Hands', 'Beckman Standard'],
    shop: ['Service Retainer', 'Salvage Contract', 'Lifetime Warranty'],
    crew: ['Heavy Workwear', 'Veteran Hands', 'Union Strong'],
  };
  SKILLS.push(
    { id: `${branch}PathA`, branch, tier: 4, cost: 2, name: paths[branch][0],
      desc: branch === 'tools' ? '+15% tower range' : branch === 'jeff' ? '+25% hero health' : branch === 'shop' ? '+150 starting cash' : '+35% recruit health',
      apply: m => { if (branch === 'tools') m.towerRange *= 1.15; else if (branch === 'jeff') m.jeffHp *= 1.25; else if (branch === 'shop') m.startMoney += 150; else m.crewHp *= 1.35; } },
    { id: `${branch}PathB`, branch, tier: 4, cost: 2, name: paths[branch][1],
      desc: branch === 'tools' ? '+22% tower damage' : branch === 'jeff' ? 'Skill cooldowns reduced by 20%' : branch === 'shop' ? '+20% kill bounties' : '+30% recruit damage',
      apply: m => { if (branch === 'tools') m.towerDamage *= 1.22; else if (branch === 'jeff') m.cooldown *= 0.8; else if (branch === 'shop') m.bounty *= 1.2; else m.crewDamage *= 1.3; } },
    { id: `${branch}Mastery`, branch, tier: 5, cost: 3, name: paths[branch][2],
      desc: branch === 'tools' ? '+15% damage and 8% range' : branch === 'jeff' ? '+25% hero damage and 12% movement' : branch === 'shop' ? 'All tower investments cost 12% less' : '+20% recruit health and damage; 15% faster respawns',
      apply: m => { if (branch === 'tools') { m.towerDamage *= 1.15; m.towerRange *= 1.08; } else if (branch === 'jeff') { m.jeffDamage *= 1.25; m.jeffSpeed *= 1.12; } else if (branch === 'shop') m.towerCost *= 0.88; else { m.crewHp *= 1.2; m.crewDamage *= 1.2; m.crewRespawn *= 0.85; } } },
  );
}
for (const node of SKILLS) if (node.tier === 2 || node.tier === 4) node.choiceGroup = `${node.branch}:${node.tier}`;

export function skillCost(id: string): number { return SKILLS.find(s => s.id === id)?.cost ?? 1; }

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
  if (node.choiceGroup && SKILLS.some(s => s.choiceGroup === node.choiceGroup && unlocked.has(s.id))) return false;
  if (node.tier === 1) return true;
  return SKILLS.some(s => s.branch === node.branch && s.tier === node.tier - 1 && unlocked.has(s.id));
}
