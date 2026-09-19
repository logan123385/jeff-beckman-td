import type { Difficulty, DifficultyId } from './types';

export const DIFFICULTIES: Record<DifficultyId, Difficulty> = {
  apprentice: {
    id: 'apprentice',
    name: 'Apprentice',
    blurb: 'Learn the trade. A little room to miss — still not a free win.',
    hpMult: 0.88,
    livesMult: 1,
    speedMult: 1,
    bountyMult: 1,
  },
  journeyman: {
    id: 'journeyman',
    name: 'Journeyman',
    blurb: 'The intended service call. Later waves fatten up — don’t get greedy.',
    hpMult: 1,
    livesMult: 1,
    speedMult: 1,
    bountyMult: 1,
  },
  master: {
    id: 'master',
    name: 'Master',
    blurb: 'Fast, thick leaks and half the lives. Bring the whole truck.',
    hpMult: 1.42,
    livesMult: 0.5,
    speedMult: 1.1,
    bountyMult: 0.88,
  },
};

export const DIFFICULTY_ORDER: DifficultyId[] = ['apprentice', 'journeyman', 'master'];
