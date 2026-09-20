import { DIFFICULTIES, DIFFICULTY_ORDER } from '../../data/difficulty';
import { MAPS, SERVICE_CALL } from '../../data/maps';
import { REMASTER_ORDER, REMASTERS } from '../../data/remasters';
import { TOWERS } from '../../data/towers';
import { levelFromXp } from '../../data/xp';
import type { MapDef, RemasterId } from '../../data/types';
import { paintYard } from '../../render/yard';
import type { App, ScreenView } from '../app';
import { clear, h, stars } from '../dom';
import { persistRow } from '../persist';
import { jeffPortrait } from '../portraits';

export function renderHub(app: App): ScreenView {
  const save = app.save;
  const el = h('div', { class: 'screen hub' });

  const render = () => {
    clear(el);
    const diff = DIFFICULTIES[save.data.difficulty];
    const nightOpen = save.serviceCallUnlocked();
    const xp = levelFromXp(save.data.jeffXp);
    const metaLocked = !save.hasAnyProgress();
    const metaTip = 'Clear a job first — the truck unlocks after your first call.';
    const persist = persistRow(app.save);
    el.append(
      h(
        'header',
        { class: 'hub-header sheet' },
        h('div', { class: 'hub-jeff' }, jeffPortrait(64)),
        h(
          'div',
          { class: 'hub-copy' },
          h('div', { class: 'eyebrow', text: 'The truck' }),
          h('h1', { text: 'Jeff’s Van' }),
          h(
            'p',
            {
              class: 'lede',
              text: metaLocked
                ? 'First call is Crawlspace Chaos — take the job below. Talents, locker, and 90’s open after you clear a call.'
                : `Lv ${xp.level} · pack five tools before each job. First clears drop chests and XP. The Neverending Service Call opens after the first four calls — later jobs teach new tools for the truck.`,
            },
          ),
        ),
        h(
          'div',
          { class: 'hub-actions' },
          metaBtn(app, 'talents', 'Talent tree', `${save.talentPoints()} pts`, metaLocked, metaTip),
          metaBtn(app, 'locker', 'Locker', `${save.data.inventory.length}`, metaLocked, metaTip),
          metaBtn(app, 'skills', '90’s Perks', `${save.availableStars()} to spend`, metaLocked, metaTip),
          h('button', { class: 'btn', text: 'Encyclopedia', onClick: () => app.go({ kind: 'encyclopedia' }) }),
          h('button', { class: 'btn link', text: 'Title', onClick: () => app.go({ kind: 'title' }) }),
        ),
      ),
    );
    if (persist) el.append(persist);
    el.append(
      h(
        'section',
        { class: 'difficulty sheet' },
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
      ...(nightOpen ? [nightCard(app, true, true)] : []),
      h(
        'section',
        { class: 'map-grid' },
        ...MAPS.map((map, i) => campaignCard(app, map, i, save.isUnlocked(i), metaLocked && map.id === 'crawlspace')),
        nightOpen ? false : nightCard(app, false, false),
      ),
    );
  };
  render();
  return { el };
}

function metaBtn(
  app: App,
  kind: 'talents' | 'locker' | 'skills',
  label: string,
  pill: string,
  locked: boolean,
  tip: string,
): HTMLElement {
  return h(
    'button',
    {
      class: `btn ${locked ? 'meta-locked' : ''}`,
      disabled: locked,
      title: locked ? tip : undefined,
      onClick: () => {
        if (locked) return;
        app.go({ kind });
      },
    },
    label,
    h('span', { class: 'pill', text: pill }),
  );
}

function campaignCard(app: App, map: MapDef, index: number, unlocked: boolean, featured = false): HTMLElement {
  const save = app.save;
  const best = save.starsFor(map.id);
  const onDiff = save.starsOn(map.id, save.data.difficulty);
  const remastersOpen = best > 0;
  return h(
    'article',
    { class: `map-card job-ticket sheet ${unlocked ? '' : 'locked'} ${featured ? 'first-call' : ''}` },
    h('div', { class: 'map-swatch', style: { background: map.palette.bg, borderColor: map.palette.accent } }, mapThumb(map)),
    h(
      'div',
      { class: 'map-body' },
      h(
        'div',
        { class: 'ticket-top' },
        h('div', { class: 'eyebrow', text: featured ? 'First call' : map.subtitle }),
        h('span', { class: 'call-stamp', text: unlocked ? (best > 0 ? 'Cleared' : 'Open') : 'Locked' }),
      ),
      h('h3', { text: map.name }),
      h('p', { class: 'small', text: map.blurb }),
      h(
        'div',
        { class: 'map-meta' },
        h('span', { class: 'small muted', text: `${map.waves.length} waves` }),
      ),
      h(
        'div',
        { class: 'tool-row' },
        ...map.allowedTowers.slice(0, 8).map((id) =>
          h('span', { class: 'tool-chip', style: { borderColor: TOWERS[id].color }, text: toolLabel(TOWERS[id].name) }),
        ),
        map.allowedTowers.length > 8 ? h('span', { class: 'tool-chip more', text: `+${map.allowedTowers.length - 8}` }) : null,
      ),
      h(
        'div',
        { class: 'map-foot' },
        h('div', {}, stars(best), h('span', { class: 'small muted', text: onDiff > 0 ? ` · ${onDiff} 90’s on ${DIFFICULTIES[save.data.difficulty].name}` : best > 0 ? ` · not yet on ${DIFFICULTIES[save.data.difficulty].name}` : '' })),
        unlocked
          ? h('button', {
              class: `btn primary ${featured ? 'big' : ''}`,
              text: best > 0 ? 'Replay Classic' : featured ? 'Take the first call' : 'Take the call',
              onClick: () => app.go({ kind: 'loadout', mapId: map.id, remaster: 'classic' }),
            })
          : h('span', { class: 'pill', text: index === 0 ? 'Take the call' : 'Clear the previous job' }),
      ),
      remastersOpen
        ? h(
            'div',
            { class: 'remaster-row' },
            ...REMASTER_ORDER.map((id) => remasterBtn(app, map, id)),
          )
        : unlocked
          ? h('p', { class: 'small muted', text: 'Clear Classic once to unlock Code Inspection, Frozen Main, Cash Job, and Clean Hands.' })
          : null,
    ),
  );
}

function remasterBtn(app: App, map: MapDef, id: Exclude<RemasterId, 'classic'>): HTMLElement {
  const done = app.save.remasterCleared(map.id, id);
  const info = REMASTERS[id];
  return h('button', {
    class: `btn remaster ${done ? 'done' : ''}`,
    title: info.blurb,
    text: done ? `${info.name} ✓` : info.name,
    onClick: () => app.go({ kind: 'loadout', mapId: map.id, remaster: id }),
  });
}

function toolLabel(name: string): string {
  const parts = name.split(' ');
  return parts.length <= 2 ? name : parts.slice(0, 2).join(' ');
}

function nightCard(app: App, open: boolean, featured: boolean): HTMLElement {
  const best = app.save.data.serviceCallBest;
  return h(
    'article',
    { class: `map-card job-ticket sheet night ${featured ? 'featured' : ''} ${open ? '' : 'locked'}` },
    h('div', { class: 'map-swatch', style: { background: SERVICE_CALL.palette.bg, borderColor: SERVICE_CALL.palette.accent } }, mapThumb(SERVICE_CALL)),
    h(
      'div',
      { class: 'map-body' },
      h(
        'div',
        { class: 'ticket-top' },
        h('div', { class: 'eyebrow', text: featured ? 'Endgame' : SERVICE_CALL.subtitle }),
        h('span', { class: 'call-stamp', text: open ? (best > 0 ? `Wave ${best}` : 'Open') : 'Locked' }),
      ),
      h('h3', { text: SERVICE_CALL.name }),
      h('p', { class: 'small', text: SERVICE_CALL.blurb }),
      h(
        'div',
        { class: 'map-meta' },
        h('span', { class: 'small muted', text: best > 0 ? `Longest service call: wave ${best}` : 'No record yet' }),
        h('span', { class: 'small muted', text: 'Mutators · milestone crates · soft clock-out' }),
      ),
      h(
        'div',
        { class: 'map-foot' },
        h('span', { class: 'small muted', text: 'Same kit as the campaign. Gear you find here works everywhere.' }),
        open
          ? h('button', { class: 'btn primary', text: 'Clock in', onClick: () => app.go({ kind: 'loadout', mapId: SERVICE_CALL.id, remaster: 'classic' }) })
          : h('span', { class: 'pill', text: 'Clear the first four service calls' }),
      ),
    ),
  );
}

function mapThumb(map: MapDef): HTMLCanvasElement {
  const c = document.createElement('canvas');
  const w = 176;
  const hgt = 220;
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  c.width = w * dpr;
  c.height = hgt * dpr;
  c.style.width = `${w}px`;
  c.style.height = `${hgt}px`;
  const ctx = c.getContext('2d')!;
  ctx.scale(dpr, dpr);
  ctx.save();
  ctx.filter = 'brightness(1.18) saturate(1.12)';
  const zoom = Math.min(w / 960, hgt / 600);
  ctx.translate((w - 960 * zoom) / 2, (hgt - 600 * zoom) / 2);
  ctx.scale(zoom, zoom);
  paintYard(ctx, map);
  ctx.filter = 'none';
  ctx.fillStyle = map.palette.accent;
  for (const s of map.slots) {
    ctx.beginPath();
    ctx.arc(s.x, s.y, 7, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
  return c;
}
