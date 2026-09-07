import type { Difficulty, DifficultyId } from './types';

export const DIFFICULTIES: Record<DifficultyId, Difficulty> = {
  apprentice: {
    id: 'apprentice',
    name: 'Apprentice',
    blurb: 'Learn the trade. Enemies are a little soft.',
    hpMult: 0.85,
    livesMult: 1,
  },
  journeyman: {
    id: 'journeyman',
    name: 'Journeyman',
    blurb: 'The intended service call.',
    hpMult: 1,
    livesMult: 1,
  },
  master: {
    id: 'master',
    name: 'Master',
    blurb: 'Tough enemies, fewer lives. Still no iron panic.',
    hpMult: 1.3,
    livesMult: 0.5,
  },
};

export const DIFFICULTY_ORDER: DifficultyId[] = ['apprentice', 'journeyman', 'master'];
