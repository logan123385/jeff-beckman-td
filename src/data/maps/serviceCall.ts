import { vec } from '../../core/vec';
import { TOWER_ORDER } from '../towers';
import type { MapDef } from '../types';
import { grp, wave } from './helpers';

/** Dedicated The Neverending Service Call survival yard — after the campaign slice, soft-exit, no exclusive kit. */
export const SERVICE_CALL: MapDef = {
  id: 'serviceCall',
  name: 'The Neverending Service Call',
  subtitle: 'Endless dispatch',
  blurb: 'The true endgame. Pack five tools you already earned — nothing exclusive lives here. Mutators rotate, milestone crates drop gear, and cleared calls pay for increasingly powerful equipment. Clock out whenever you want.',
  endless: true,
  paths: [
    [
      vec(-30, 180),
      vec(280, 180),
      vec(280, 420),
      vec(700, 420),
      vec(700, 140),
      vec(990, 140),
    ],
    [
      vec(-30, 500),
      vec(180, 500),
      vec(180, 300),
      vec(520, 300),
      vec(520, 80),
      vec(990, 80),
    ],
  ],
  slots: [
    vec(140, 110),
    vec(140, 250),
    vec(100, 420),
    vec(100, 560),
    vec(230, 250),
    vec(360, 250),
    vec(360, 360),
    vec(360, 490),
    vec(600, 360),
    vec(600, 490),
    vec(780, 220),
    vec(780, 70),
    vec(620, 220),
    vec(440, 180),
    vec(850, 220),
  ],
  jeffStart: vec(400, 240),
  startMoney: 650,
  lives: 20,
  allowedTowers: [...TOWER_ORDER],
  waves: [
    wave(grp('drip', 10, 0.9, 0, 0), grp('drip', 8, 1.0, 2, 1)),
    wave(grp('drip', 12, 0.75, 0, 0), grp('sludge', 2, 3, 6, 1)),
    wave(grp('scaleCrab', 4, 2.2, 0, 1), grp('steamWisp', 5, 1.6, 4, 0)),
    wave(grp('pressureSpike', 3, 2, 0, 0), grp('airlock', 4, 2, 4, 1), grp('drip', 10, 0.7, 8, 0)),
    wave(grp('frozenMain', 2, 6, 0, 1), grp('steamWisp', 6, 1.4, 4, 0), grp('sludge', 3, 3, 8, 0)),
  ],
  palette: { bg: '#12161c', wall: '#1c2430', pipe: '#5a6e7a', pipeDark: '#3a4850', accent: '#90caf9' },
};
