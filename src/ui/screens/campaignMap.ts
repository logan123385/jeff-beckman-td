import { CAMPAIGN_LOCATIONS } from '../../data/campaign';
import { MAPS } from '../../data/maps';
import type { MapDef } from '../../data/types';
import type { App } from '../app';
import { clear, h, stars } from '../dom';

/** A navigable district map, with real save gates and a single selected mission briefing. */
export function campaignMap(app: App, card: (map: MapDef, index: number, unlocked: boolean) => HTMLElement): HTMLElement {
  const current = MAPS.findIndex((m, i) => app.save.isUnlocked(i) && app.save.starsFor(m.id) === 0);
  let selected = current >= 0 ? current : MAPS.length - 1;
  const details = h('section', { class: 'campaign-briefing', attrs: { 'aria-label': 'Selected mission briefing', 'aria-live': 'polite' } });
  const map = h('div', { class: 'district-map', attrs: { 'aria-label': 'Beckman County campaign map' } }, h('div', { class: 'district-art', html: districtIllustration() }));
  const buttons: HTMLButtonElement[] = [];
  const select = (index: number) => {
    selected = index;
    buttons.forEach((b, i) => { b.classList.toggle('selected', i === index); b.setAttribute('aria-pressed', String(i === index)); });
    const def = MAPS[index]!, info = CAMPAIGN_LOCATIONS[def.id]!;
    clear(details);
    details.append(h('div', { class: 'mission-objective' }, h('span', { class: 'eyebrow', text: `${String(index + 1).padStart(2, '0')} / ${String(MAPS.length).padStart(2, '0')} · ${info.region}` }),
      h('h2', { text: info.objective }), h('p', { text: info.tactic })), card(def, index, app.save.isUnlocked(index)));
  };
  MAPS.forEach((def, i) => {
    const info = CAMPAIGN_LOCATIONS[def.id]!, rating = app.save.starsFor(def.id), unlocked = app.save.isUnlocked(i);
    const button = h('button', { class: `district-node ${rating ? 'cleared' : unlocked ? 'available' : 'unexplored'}`,
      attrs: { 'aria-label': `${i + 1}. ${def.name}. ${rating ? `${rating} of 3 rating` : unlocked ? 'Ready to play' : 'Locked. Preview mission'}`, 'aria-pressed': 'false' },
      style: { left: `${info.x}%`, top: `${info.y}%` }, onClick: () => select(i) },
      h('span', { class: 'district-pin', text: rating ? '⚑' : !unlocked ? '◇' : String(i + 1) }),
      h('span', { class: 'district-name', text: def.name }),
      h('span', { class: 'district-rating' }, rating ? stars(rating) : unlocked ? 'TAKE THE CALL' : 'UNEXPLORED'));
    button.addEventListener('keydown', ev => {
      if (!['ArrowRight', 'ArrowLeft', 'ArrowUp', 'ArrowDown'].includes(ev.key)) return;
      ev.preventDefault();
      const next = (selected + (ev.key === 'ArrowRight' || ev.key === 'ArrowDown' ? 1 : -1) + MAPS.length) % MAPS.length;
      select(next); buttons[next]?.focus({ preventScroll: true });
    });
    buttons.push(button); map.append(button);
  });
  const earned = MAPS.reduce((sum, m) => sum + app.save.starsFor(m.id), 0);
  const complete = MAPS.filter(m => app.save.starsFor(m.id) > 0).length;
  const wrap = h('section', { class: 'campaign-board' },
    h('header', { class: 'campaign-heading' }, h('div', {}, h('div', { class: 'eyebrow', text: 'The district needs a plumber' }), h('h2', { text: 'One county. Nine calls.' })),
      h('div', { class: 'campaign-progress' }, h('b', { text: `${complete} / ${MAPS.length}` }), h('span', { text: 'JOBS CLEARED' }), h('small', { text: `${earned} / ${MAPS.length * 3} campaign 90’s` }))),
    h('div', { class: 'campaign-layout' }, map, details),
    h('div', { class: 'campaign-legend' }, h('span', { text: '⚑ Cleared' }), h('span', { text: '◉ Next call' }), h('span', { text: '◇ Unexplored' }), h('span', { text: 'Select a location to inspect the job · arrow keys navigate' })));
  select(selected);
  return wrap;
}

function districtIllustration(): string {
  const art = new URL('../../../assets/cinematic/beckman-county.jpg', import.meta.url).href;
  const points = MAPS.map(m => CAMPAIGN_LOCATIONS[m.id]!).map(p => [p.x * 10, p.y * 5.9]);
  const road = points.map(([x, y], i) => {
    if (!i) return `M${x} ${y}`;
    const [px, py] = points[i - 1]!;
    return `C${px} ${(py! + y!) / 2} ${x} ${(py! + y!) / 2} ${x} ${y}`;
  }).join(' ');
  return `<svg viewBox="0 0 1000 590" preserveAspectRatio="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
    <defs>
      <linearGradient id="county-shade" x2="0" y2="1"><stop stop-color="#0a2632" stop-opacity=".45"/><stop offset=".23" stop-color="#0a2632" stop-opacity="0"/><stop offset=".8" stop-color="#0a2632" stop-opacity="0"/><stop offset="1" stop-color="#0a2632" stop-opacity=".65"/></linearGradient>
      <radialGradient id="county-mist"><stop stop-color="#dbecd6" stop-opacity=".18"/><stop offset="1" stop-color="#dbecd6" stop-opacity="0"/></radialGradient>
    </defs>
    <image href="${art}" width="1000" height="590" preserveAspectRatio="none"/>
    <rect width="1000" height="590" fill="url(#county-shade)"/>
    <path d="${road}" fill="none" stroke="#16313d" stroke-opacity=".7" stroke-width="10"/>
    <path d="${road}" fill="none" stroke="#e1c794" stroke-opacity=".85" stroke-width="5"/>
    <path d="${road}" fill="none" stroke="#fff0c5" stroke-width="1.5" stroke-dasharray="4 10"/>
    <g class="county-clouds"><ellipse cx="260" cy="260" rx="230" ry="65" fill="url(#county-mist)"/><ellipse cx="780" cy="410" rx="200" ry="48" fill="url(#county-mist)"/></g>
    <g fill="#f9e4b5" font-family="Georgia,serif"><text x="32" y="39" font-size="27" font-weight="bold">Beckman County</text><text x="34" y="57" font-family="sans-serif" font-size="8" letter-spacing="2.4">DEPARTMENT OF KEEPING THINGS RUNNING</text></g>
    <g fill="#eee2bd" opacity=".85" font-size="10" font-family="Georgia,serif" letter-spacing="3"><text x="35" y="564">THE LOWLANDS</text><text x="756" y="564">THE WETLANDS</text></g>
    <g transform="translate(945 505)" stroke="#e4cca0" fill="none"><circle r="23" stroke-opacity=".5"/><path d="M0-28L5 0L0 28L-5 0ZM-28 0L0-5L28 0L0 5Z"/><path d="M0-28L5 0H0Z" fill="#e4cca0"/><text y="-35" text-anchor="middle" fill="#f6e3b4" stroke="none" font-family="Georgia,serif" font-size="11">N</text></g>
    <rect x="8" y="8" width="984" height="574" rx="4" fill="none" stroke="#e8d7b0" stroke-opacity=".22"/>
  </svg>`;
}
