import type { RemasterId } from './types';

export const REMASTERS: Record<
  Exclude<RemasterId, 'classic'>,
  { id: Exclude<RemasterId, 'classic'>; name: string; blurb: string }
> = {
  codeInspection: {
    id: 'codeInspection',
    name: 'Code Inspection',
    blurb: 'The inspector locked the obvious tools in the truck. Same job, fewer answers.',
  },
  frozenMain: {
    id: 'frozenMain',
    name: 'Frozen Main',
    blurb: 'One life. Freezes last longer. Prestige — never the first time you see a map.',
  },
  cashJob: {
    id: 'cashJob',
    name: 'Cash Job',
    blurb: 'No selling. Truck money only — skills and gear don’t pad the envelope. One leak and you’re packing up.',
  },
  cleanHands: {
    id: 'cleanHands',
    name: 'Clean Hands',
    blurb: 'CHIMPS, in the trade. No selling, no actives, no crew, no torch rain. Truck money only. One leak and the inspector shuts you down.',
  },
};

export const REMASTER_ORDER: Exclude<RemasterId, 'classic'>[] = [
  'codeInspection',
  'frozenMain',
  'cashJob',
  'cleanHands',
];

export function remasterTitle(id: RemasterId): string {
  switch (id) {
    case 'classic':
      return 'Classic';
    case 'codeInspection':
      return REMASTERS.codeInspection.name;
    case 'frozenMain':
      return REMASTERS.frozenMain.name;
    case 'cashJob':
      return REMASTERS.cashJob.name;
    case 'cleanHands':
      return REMASTERS.cleanHands.name;
    default: {
      const _exhaustive: never = id;
      return _exhaustive;
    }
  }
}

export function isOneLife(id: RemasterId): boolean {
  return id === 'frozenMain' || id === 'cashJob' || id === 'cleanHands';
}

export function isNoSell(id: RemasterId): boolean {
  return id === 'cashJob' || id === 'cleanHands';
}

export function isTruckMoney(id: RemasterId): boolean {
  return id === 'cashJob' || id === 'cleanHands';
}

/** No spare-parts actives, Summon Logan, or torch rain. Heroes still work. */
export function isNoPowers(id: RemasterId): boolean {
  return id === 'cleanHands';
}
