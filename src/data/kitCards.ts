import { HERO_ORDER, type HeroId } from './heroes';
import type { WeaponStance } from './types';
import { defaultFamily, familyStance } from './weapons';

export type CardJob = 'anchor' | 'breaker' | 'crew' | 'sweep' | 'lane' | 'pin' | 'control' | 'spot';

export interface KitCard {
  id: string;
  hero: HeroId;
  stance: WeaponStance;
  job: CardJob;
  name: string;
  verb: string;
  description: string;
}

type CardDef = Omit<KitCard, 'id' | 'hero' | 'stance' | 'job'>;

const MELEE_JOBS: readonly CardJob[] = ['anchor', 'breaker', 'crew', 'sweep'];
const RANGED_JOBS: readonly CardJob[] = ['lane', 'pin', 'control', 'spot'];

const HERO_CARDS: Record<HeroId, { melee: readonly CardDef[]; ranged: readonly CardDef[] }> = {
  jeff: {
    melee: [
      { name: 'Hold the Line', verb: 'Hold', description: '+1 hold' },
      { name: 'Wrench Tap', verb: 'Tap', description: 'every 3rd basic shreds 20% armor 4s' },
      { name: 'Foreman Pulse', verb: 'Pulse', description: 'towers within 160 +12% damage' },
      { name: 'Basin Swing', verb: 'Swing', description: 'basics splash 30% within 44' },
    ],
    ranged: [
      { name: 'Wash the Lane', verb: 'Wash', description: '+1 pierce' },
      { name: 'Pressure Spike', verb: 'Spike', description: 'every 4th basic +60% damage' },
      { name: 'Steam Cloud', verb: 'Cloud', description: 'basics 20% slow for 2s' },
      { name: 'Spotter', verb: 'Spot', description: 'towers within 200 +8% range' },
    ],
  },
  mike: {
    melee: [
      { name: 'Jack Stand', verb: 'Stand', description: '+1 hold' },
      { name: 'Lug Crack', verb: 'Crack', description: 'basics shred 15% armor 3s' },
      { name: 'Jobsite Yell', verb: 'Yell', description: 'towers within 160 +12% attack speed' },
      { name: 'Cross-Bed Swing', verb: 'Swing', description: 'splash 35% within 50' },
    ],
    ranged: [
      { name: 'Skip Plunger', verb: 'Skip', description: '+1 bounce' },
      { name: 'Pinpoint', verb: 'Pin', description: 'focus +10%/hit on one target, max 40%, reset on switch' },
      { name: 'Suction Cup', verb: 'Suction', description: 'basics 18% slow 1.8s' },
      { name: 'Tailgate Call', verb: 'Call', description: 'Logan damage +20% while Mike is deployed' },
    ],
  },
  bob: {
    melee: [
      { name: 'Live Circuit', verb: 'Circuit', description: '+1 hold on the prod' },
      { name: 'Arc Tap', verb: 'Tap', description: '15% chance 0.5s stun' },
      { name: 'Contractor Mark', verb: 'Mark', description: 'held target takes +15% from towers' },
      { name: 'Bus Bar', verb: 'Bar', description: 'splash 25% heat within 40' },
    ],
    ranged: [
      { name: 'Through-Beam', verb: 'Beam', description: 'laser pierce +1' },
      { name: 'Termination Dot', verb: 'Dot', description: 'focus +12%/hit, max 48%' },
      { name: 'Capacitor Hum', verb: 'Hum', description: 'basics 15% slow 2s' },
      { name: 'Range Finder', verb: 'Find', description: 'towers within 180 +10% range' },
    ],
  },
  chris: {
    melee: [
      { name: 'Foot in the Trench', verb: 'Trench', description: '+1 hold' },
      { name: 'Saw Tooth', verb: 'Saw', description: 'shred 18% 3s' },
      { name: 'Caddie Wave', verb: 'Wave', description: 'one 8s helper every 22s while a wave is active' },
      { name: 'Gallery Swing', verb: 'Swing', description: 'splash 30% within 48' },
    ],
    ranged: [
      { name: 'Skip Lie', verb: 'Skip', description: '+1 bounce' },
      { name: 'Pin High', verb: 'High', description: 'every 4th basic +55% damage' },
      { name: 'Sand Bite', verb: 'Bite', description: 'basics 20% slow 2s' },
      { name: 'Gallery Call', verb: 'Call', description: 'towers within 170 +10% attack speed' },
    ],
  },
  becbec: {
    melee: [
      { name: 'Planted Feet', verb: 'Plant', description: '+1 hold' },
      { name: 'Haymaker Cadence', verb: 'Haymaker', description: 'stun every 2nd basic instead of 3rd' },
      { name: 'Crew Captain', verb: 'Captain', description: 'towers within 150 +12% damage' },
      { name: 'Shoulder Check', verb: 'Check', description: 'splash 40% within 52' },
    ],
    ranged: [
      { name: 'Rebar Line', verb: 'Line', description: '+1 pierce' },
      { name: 'Invoice Stamp', verb: 'Stamp', description: 'expose 20% for 4s every 5th hit' },
      { name: 'Dust Cloud', verb: 'Cloud', description: 'basics 16% slow 2s' },
      { name: 'Spotter Yell', verb: 'Yell', description: 'towers within 170 +8% damage' },
    ],
  },
  cbj: {
    melee: [
      { name: 'Tailgate Wall', verb: 'Wall', description: '+1 hold' },
      { name: 'Masher Crack', verb: 'Crack', description: 'shred 14% 3s' },
      { name: 'Convoy Honk', verb: 'Honk', description: 'two 10s helpers on a 28s timer while a wave is active' },
      { name: 'Bed Sweep', verb: 'Sweep', description: 'splash 35% within 50' },
    ],
    ranged: [
      { name: 'Extra Spud', verb: 'Spud', description: '+18 splash radius' },
      { name: 'Loaded Tater', verb: 'Load', description: 'every 4th basic +50% damage + 0.4s stun' },
      { name: 'Grease Slick', verb: 'Slick', description: 'basics 18% slow 2s' },
      { name: 'Dispatch', verb: 'Dispatch', description: 'towers within 180 +10% attack speed' },
    ],
  },
  doni: {
    melee: [
      { name: 'Gaff Set', verb: 'Set', description: '+1 hold' },
      { name: 'Scale Rip', verb: 'Rip', description: 'shred 16% 3s' },
      { name: 'Deckhand', verb: 'Hand', description: 'one 10s helper every 20s while a wave is active' },
      { name: 'Sweep the Gunwale', verb: 'Sweep', description: 'splash 28% within 46' },
    ],
    ranged: [
      { name: 'Long Cast', verb: 'Cast', description: '+25 reach' },
      { name: 'Trophy Hook', verb: 'Hook', description: 'focus +10%/hit, max 40%' },
      { name: 'Chum Line', verb: 'Chum', description: 'basics 20% slow 2.2s' },
      { name: 'Tour Guide', verb: 'Guide', description: 'towers within 180 +8% range' },
    ],
  },
  jayjay: {
    melee: [
      { name: 'Title Belt', verb: 'Belt', description: '+1 hold' },
      { name: 'Main Event', verb: 'Event', description: 'stun every 2nd basic' },
      { name: 'Corner Crew', verb: 'Corner', description: 'one 12s helper every 20s while a wave is active' },
      { name: 'Rope Swing', verb: 'Swing', description: 'splash 35% within 54' },
    ],
    ranged: [
      { name: 'Plate Skip', verb: 'Skip', description: '+1 bounce' },
      { name: 'Bell Judge', verb: 'Judge', description: 'expose 25% for 5s every 5th hit' },
      { name: 'Crowd Hush', verb: 'Hush', description: 'basics 18% slow 2s' },
      { name: 'Ring Announcer', verb: 'Announce', description: 'towers within 190 +10% damage' },
    ],
  },
};

function buildCards(): KitCard[] {
  const cards: KitCard[] = [];
  for (const hero of HERO_ORDER) {
    const defs = HERO_CARDS[hero];
    MELEE_JOBS.forEach((job, i) => {
      cards.push({ id: `${hero}_${job}`, hero, stance: 'melee', job, ...defs.melee[i]! });
    });
    RANGED_JOBS.forEach((job, i) => {
      cards.push({ id: `${hero}_${job}`, hero, stance: 'ranged', job, ...defs.ranged[i]! });
    });
  }
  return cards;
}

export const KIT_CARDS: KitCard[] = buildCards();

const CARD_BY_ID = new Map<string, KitCard>(KIT_CARDS.map(c => [c.id, c]));

export function cardsFor(hero: HeroId, stance: WeaponStance): KitCard[] {
  return KIT_CARDS.filter(c => c.hero === hero && c.stance === stance);
}

export function cardById(id: string): KitCard | undefined {
  return CARD_BY_ID.get(id);
}

export function cardUnlocked(card: KitCard, heroJobs: number): boolean {
  switch (card.job) {
    case 'anchor':
    case 'breaker':
    case 'lane':
    case 'pin':
      return true;
    case 'crew':
    case 'control':
      return heroJobs >= 1;
    case 'sweep':
    case 'spot':
      return heroJobs >= 3;
    default: {
      const _exhaustive: never = card.job;
      return _exhaustive;
    }
  }
}

export function defaultCards(hero: HeroId): [string, string] {
  return familyStance(defaultFamily(hero)) === 'melee'
    ? [`${hero}_anchor`, `${hero}_breaker`]
    : [`${hero}_lane`, `${hero}_pin`];
}
