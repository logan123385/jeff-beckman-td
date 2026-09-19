import { vec } from '../../core/vec';
import type { MapDef } from '../types';
import { grp, wave } from './helpers';

export const CRAWLSPACE: MapDef = {
  id: 'crawlspace',
  name: 'Crawlspace Chaos',
  subtitle: 'Service Call #1',
  blurb: 'A leaky crawlspace under a split-level. Drips everywhere. Learn to bunch them with a barricade and hose them down.',
  paths: [
    [
      vec(-30, 120),
      vec(160, 120),
      vec(160, 400),
      vec(480, 400),
      vec(480, 160),
      vec(760, 160),
      vec(760, 460),
      vec(990, 460),
    ],
  ],
  slots: [
    vec(100, 250),
    vec(225, 250),
    vec(320, 340),
    vec(320, 465),
    vec(420, 280),
    vec(545, 280),
    vec(620, 100),
    vec(620, 225),
    vec(700, 340),
    vec(825, 340),
    vec(860, 400),
  ],
  jeffStart: vec(330, 220),
  startMoney: 230,
  lives: 20,
  allowedTowers: ['torch', 'washer', 'barricade'],
  inspectionBan: ['washer'],
  waves: [
    wave(grp('drip', 6, 1.2)),
    wave(grp('drip', 10, 1.0)),
    wave(grp('drip', 8, 0.9), grp('drip', 8, 0.9, 10)),
    wave(grp('drip', 12, 0.8), grp('pressureSpike', 1, 1, 12)),
    wave(grp('drip', 10, 0.8), grp('sludge', 2, 4, 6)),
    wave(grp('drip', 14, 0.7), grp('pressureSpike', 2, 3, 10)),
    wave(grp('sludge', 4, 3), grp('drip', 10, 0.8, 5)),
    wave(grp('drip', 16, 0.6), grp('pressureSpike', 3, 2.5, 8)),
    wave(grp('sludge', 5, 2.5), grp('drip', 12, 0.8, 4), grp('pressureSpike', 2, 2, 14)),
    wave(grp('drip', 20, 0.5), grp('sludge', 6, 2.5, 6), grp('pressureSpike', 4, 2, 12)),
  ],
  palette: { bg: '#2b2620', wall: '#3d3630', pipe: '#6d6a66', pipeDark: '#4a4744', accent: '#c9a26b' },
};
