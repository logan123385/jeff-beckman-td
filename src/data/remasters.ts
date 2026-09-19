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
};

export const REMASTER_ORDER: Exclude<RemasterId, 'classic'>[] = ['codeInspection', 'frozenMain'];

export function remasterTitle(id: RemasterId): string {
  switch (id) {
    case 'classic':
      return 'Classic';
    case 'codeInspection':
      return REMASTERS.codeInspection.name;
    case 'frozenMain':
      return REMASTERS.frozenMain.name;
    default: {
      const _exhaustive: never = id;
      return _exhaustive;
    }
  }
}
