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
  // Original vector cartography. Repeated symbols are deliberately small, with the mission pins carrying navigation.
  const trees = Array.from({ length: 100 }, (_, i) => {
    const x = 30 + ((i * 137 + (i % 3) * 57) % 945), y = 115 + ((i * 83) % 420);
    if (x > 590 && y < 175 || x > 690 && y > 380) return '';
    return `<use href="#county-pine" x="${x}" y="${y}" opacity="${.25 + (i % 5) * .08}" transform="rotate(${(i % 5) - 2} ${x} ${y})"/>`;
  }).join('');
  const houses = [[105, 395], [154, 413], [260, 258], [310, 272], [146, 126], [191, 142], [395, 103], [450, 118], [807, 164], [860, 188], [628, 280], [692, 300]]
    .map(([x, y]) => `<use href="#county-house" x="${x}" y="${y}"/>`).join('');
  const road = 'M120 425 Q155 340 290 307 Q355 230 170 165 Q280 62 430 142 Q550 208 670 100 Q797 75 850 200 Q820 308 660 313 Q635 428 830 437 Q755 556 490 472';
  return `<svg viewBox="0 0 1000 590" preserveAspectRatio="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
    <defs>
      <radialGradient id="county-land"><stop stop-color="#7e9262"/><stop offset="1" stop-color="#3d6450"/></radialGradient>
      <linearGradient id="county-water" x2="1" y2="1"><stop stop-color="#8dbfb4"/><stop offset="1" stop-color="#356e76"/></linearGradient>
      <pattern id="county-grain" width="31" height="29" patternUnits="userSpaceOnUse"><circle cx="3" cy="8" r="1" fill="#fff2be" opacity=".12"/><path d="M20 21h4" stroke="#102f26" opacity=".15"/></pattern>
      <g id="county-pine"><ellipse cy="12" rx="13" ry="5" fill="#173d31" opacity=".4"/><path d="M-2 0h4v15h-4" fill="#624d31"/><path d="M0-25L-15 7H15ZM0-34L-12-7H12Z" fill="#294f38" stroke="#8d9e60" stroke-width="1.2"/></g>
      <g id="county-house"><path d="M-15 0v22l30 4V0" fill="#cebe8b" stroke="#3d5039" stroke-width="2"/><path d="M-22 0L0-17L24 0Z" fill="#855b44" stroke="#3a4533" stroke-width="2"/><path d="M-3 12h7v12M-10 6h5v5M7 6h5v5" fill="#5a7866"/><path d="M11-10v-12h5v16" fill="#bda986"/></g>
      <g id="county-mountain"><path d="M-75 56L0-72L84 56Z" fill="#798c81" stroke="#4c6b60" stroke-width="3"/><path d="M0-72L-30-20L-5-30L9-9L25-27L42-10Z" fill="#e2e7cb"/><path d="M0-70L12 55H80Z" fill="#405f58" opacity=".35"/></g>
    </defs>
    <rect width="1000" height="590" fill="url(#county-land)"/>
    <path d="M0 396Q194 457 275 365T509 425T701 402T1000 470V590H0Z" fill="#a3ad6e" opacity=".35"/>
    <path d="M0 195Q133 103 304 165T590 95T1000 145V0H0Z" fill="#a4ac74" opacity=".35"/>
    <path d="M488-30C395 72 533 169 479 257S314 330 428 454S489 567 420 640" fill="none" stroke="#294b3d" stroke-width="64" opacity=".35"/>
    <path d="M488-30C395 72 533 169 479 257S314 330 428 454S489 567 420 640" fill="none" stroke="#a0b394" stroke-width="54"/>
    <path d="M488-30C395 72 533 169 479 257S314 330 428 454S489 567 420 640" fill="none" stroke="url(#county-water)" stroke-width="43"/>
    <path d="M491-30C398 72 536 169 482 257S317 330 431 454S492 567 423 640" fill="none" stroke="#e0efd0" stroke-opacity=".3" stroke-width="2" stroke-dasharray="22 12"/>
    <use href="#county-mountain" x="620" y="40"/><use href="#county-mountain" x="740" y="56"/><use href="#county-mountain" x="825" y="41"/>
    ${trees}
    <path d="${road}" fill="none" stroke="#334e36" stroke-opacity=".5" stroke-width="17"/>
    <path d="${road}" fill="none" stroke="#c9b47d" stroke-width="12"/>
    <path d="${road}" fill="none" stroke="#ede0ad" stroke-width="2" stroke-dasharray="4 9"/>
    <path d="M469 150l55 25M462 161l55 25" stroke="#66593c" stroke-width="8"/>
    ${houses}
    <g transform="translate(808 405)"><path d="M-45 20V-20H40V20Z" fill="#8d8671" stroke="#42594b" stroke-width="3"/><path d="M-49-20L-28-40L-8-20L12-40L42-20" fill="#654f40" stroke="#42594b" stroke-width="3"/><path d="M26-20V-61H38V-20" fill="#9a8064"/><path d="M-34-5h13v12h-13M-10-5h13v12h-13M14-5h13v12H14" fill="#d9bd76"/></g>
    <g transform="translate(490 446)"><path d="M-55 18V-25L-30-42H34L58-25V18Z" fill="#614e3d" stroke="#3b4535" stroke-width="3"/><path d="M-35-31v-53h15v46M16-38v-65h18v70" fill="#9c7050" stroke="#4c4835" stroke-width="3"/><path d="M-18 18V-2Q0-30 18-2V18Z" fill="#eda752"/><path d="M-9 18V0Q0-13 9 0V18" fill="#ffe0a2"/></g>
    <rect width="1000" height="590" fill="url(#county-grain)"/>
    <g fill="#e6e2b9" font-family="Georgia,serif"><text x="44" y="49" font-size="30" font-weight="bold">Beckman County</text><text x="46" y="71" font-family="sans-serif" font-size="9" letter-spacing="3">DEPARTMENT OF KEEPING THINGS RUNNING</text></g>
    <g fill="#c2d0a3" opacity=".75" font-size="11" font-family="Georgia,serif" letter-spacing="3"><text x="40" y="555">THE LOWLANDS</text><text x="592" y="226">HIGH COUNTRY</text><text x="689" y="567">THE WORKS</text></g>
    <g transform="translate(928 507)" stroke="#d7cf9d" fill="none"><circle r="28" stroke-opacity=".5"/><path d="M0-34L7 0L0 34L-7 0ZM-34 0L0-7L34 0L0 7Z"/><path d="M0-34L7 0H0Z" fill="#d7cf9d"/><text y="-42" text-anchor="middle" fill="#ece1b1" stroke="none" font-family="Georgia,serif" font-size="13">N</text></g>
    <rect x="9" y="9" width="982" height="572" rx="12" fill="none" stroke="#ece1b1" stroke-opacity=".2"/>
  </svg>`;
}
