import { DIFFICULTIES, DIFFICULTY_ORDER } from '../../data/difficulty';
import { MAPS } from '../../data/maps';
import { TOWERS } from '../../data/towers';
import type { App, ScreenView } from '../app';
import { clear, h, stars } from '../dom';
import { jeffPortrait } from '../portraits';

export function renderHub(app: App): ScreenView {
  const save = app.save;
  const el = h('div', { class: 'screen hub' });

  const render = () => {
    clear(el);
    const diff = DIFFICULTIES[save.data.difficulty];
    el.append(
      h(
        'header',
        { class: 'hub-header' },
        h('div', { class: 'hub-jeff' }, jeffPortrait(64)),
        h(
          'div',
          {},
          h('h1', { text: 'Jeff’s Van' }),
          h('p', { class: 'muted', text: 'Pick a service call. Every job earns Journeyman Stars, kept forever.' }),
        ),
        h(
          'div',
          { class: 'hub-actions' },
          h(
            'button',
            { class: 'btn', onClick: () => app.go({ kind: 'skills' }) },
            `★ Journeyman Stars`,
            h('span', { class: 'pill', text: `${save.availableStars()} to spend` }),
          ),
          h('button', { class: 'btn', text: 'Encyclopedia', onClick: () => app.go({ kind: 'encyclopedia' }) }),
          h('button', { class: 'btn link', text: 'Title', onClick: () => app.go({ kind: 'title' }) }),
        ),
      ),
      h(
        'section',
        { class: 'difficulty' },
        h('span', { class: 'label', text: 'Difficulty' }),
        ...DIFFICULTY_ORDER.map((id) =>
          h('button', {
            class: `chip ${id === save.data.difficulty ? 'on' : ''}`,
            text: DIFFICULTIES[id].name,
            title: DIFFICULTIES[id].blurb,
            onClick: () => {
              save.setDifficulty(id);
              render();
            },
          }),
        ),
        h('span', { class: 'muted small', text: diff.blurb }),
      ),
      h(
        'section',
        { class: 'map-grid' },
        ...MAPS.map((map, i) => {
          const unlocked = save.isUnlocked(i);
          const best = save.starsFor(map.id);
          const onDiff = save.starsOn(map.id, save.data.difficulty);
          return h(
            'article',
            { class: `map-card ${unlocked ? '' : 'locked'}` },
            h('div', { class: 'map-swatch', style: { background: map.palette.bg, borderColor: map.palette.accent } }, mapThumb(map)),
            h(
              'div',
              { class: 'map-body' },
              h('div', { class: 'eyebrow', text: map.subtitle }),
              h('h3', { text: map.name }),
              h('p', { class: 'small', text: map.blurb }),
              h(
                'div',
                { class: 'map-meta' },
                h('span', { class: 'small muted', text: `${map.waves.length} waves` }),
                h('span', { class: 'small muted', text: `Tools: ${map.allowedTowers.map((t) => TOWERS[t].name.split(' ')[0]).join(', ')}` }),
              ),
              h(
                'div',
                { class: 'map-foot' },
                h('div', {}, stars(best), h('span', { class: 'small muted', text: onDiff > 0 ? ` · ${onDiff}★ on ${diff.name}` : best > 0 ? ` · not yet on ${diff.name}` : '' })),
                unlocked
                  ? h('button', { class: 'btn primary', text: best > 0 ? 'Replay' : 'Take the call', onClick: () => app.go({ kind: 'play', mapId: map.id }) })
                  : h('span', { class: 'pill', text: 'Clear the previous job' }),
              ),
            ),
          );
        }),
      ),
    );
  };
  render();
  return { el };
}

/** Tiny path preview for the map card. */
function mapThumb(map: (typeof MAPS)[number]): HTMLCanvasElement {
  const c = document.createElement('canvas');
  const w = 160;
  const hgt = 100;
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  c.width = w * dpr;
  c.height = hgt * dpr;
  c.style.width = `${w}px`;
  c.style.height = `${hgt}px`;
  const ctx = c.getContext('2d')!;
  ctx.scale(dpr, dpr);
  const sx = w / 960;
  const sy = hgt / 600;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  for (const path of map.paths) {
    ctx.strokeStyle = map.palette.pipe;
    ctx.lineWidth = 5;
    ctx.beginPath();
    path.forEach((p, i) => (i === 0 ? ctx.moveTo(p.x * sx, p.y * sy) : ctx.lineTo(p.x * sx, p.y * sy)));
    ctx.stroke();
  }
  ctx.fillStyle = map.palette.accent;
  for (const s of map.slots) {
    ctx.beginPath();
    ctx.arc(s.x * sx, s.y * sy, 2, 0, Math.PI * 2);
    ctx.fill();
  }
  return c;
}
