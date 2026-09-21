import { BUILD_STYLES, HERO_PATHS, buildBudget, buildRank } from '../../data/heroBuilds';
import { HEROES, HERO_ORDER } from '../../data/heroes';
import { levelFromXp, xpBarCopy } from '../../data/xp';
import type { App, ScreenView } from '../app';
import { h } from '../dom';
import { heroPortrait } from '../portraits';

export function renderBuilds(app: App): ScreenView {
  const el = h('div', { class: 'screen hero-builds' });
  let hero = app.save.data.selectedHero;
  const render = () => {
    const def = HEROES[hero], build = app.save.heroBuild(hero), budget = buildBudget(app.save.data.jeffXp);
    el.replaceChildren(h('header', { class: 'screen-header sheet' },
      h('button', { class: 'btn link', text: '← Van', onClick: () => app.go({ kind: 'hub' }) }),
      h('div', {}, h('span', { class: 'eyebrow', text: 'Career paths' }), h('h1', { text: 'Build your legend' })),
      h('span', { class: 'pill build-points', text: `${budget - build.nodes.length} / ${budget} points available` }),
      h('button', { class: 'btn', text: 'Respec hero · free', disabled: !build.nodes.length, onClick: () => { app.save.resetBuild(hero); render(); } })),
      h('p', { class: 'lede', text: 'Each hero has an independent build. Start with one point; crew levels give every hero more, up to eight. Mix paths, unlock alternate C skills, and respec freely between jobs.' }),
      h('nav', { class: 'build-roster', attrs: { 'aria-label': 'Hero builds' } }, ...HERO_ORDER.map(id => h('button', {
        class: `build-hero ${id === hero ? 'selected' : ''}`, attrs: { 'aria-pressed': String(id === hero), 'data-build-hero': id },
        onClick: () => { hero = id; render(); el.querySelector<HTMLButtonElement>(`[data-build-hero="${id}"]`)?.focus({ preventScroll: true }); },
      }, heroPortrait(id, 72), h('b', { text: HEROES[id].name })))),
      h('section', { class: 'sheet build-dossier', attrs: { style: `--hero-color: ${def.color}` } },
        heroPortrait(hero, 130), h('div', {}, h('span', { class: 'eyebrow', text: def.title }), h('h2', { text: `${def.name} · ${def.style}` }),
          h('p', { text: `Aura: ${def.aura.name}` }), h('p', { class: 'small muted', text: `${xpBarCopy(levelFromXp(app.save.data.jeffXp))}. ${build.nodes.length} point${build.nodes.length === 1 ? '' : 's'} invested in this hero.` }))),
      h('div', { class: 'build-paths' }, ...HERO_PATHS[hero].map(path => {
        const style = BUILD_STYLES[path.style], rank = buildRank(build, path.style);
        return h('section', { class: 'sheet build-path', attrs: { style: `--path-color: ${style.color}` } },
          h('span', { class: 'eyebrow', text: style.name }), h('h2', { text: path.name }),
          ...[1, 2, 3, 4].map(tier => {
            const id = `${path.style}:${tier}`, owned = build.nodes.includes(id), can = !owned && tier === rank + 1 && build.nodes.length < budget;
            return h('button', { class: `build-node ${owned ? 'owned' : can ? 'available' : 'locked'}`, disabled: !can,
              attrs: { 'data-build-node': id }, onClick: () => { app.save.unlockBuildNode(hero, id); render(); el.querySelector<HTMLButtonElement>('[data-build-hero][aria-pressed="true"]')?.focus({ preventScroll: true }); } },
              h('span', { class: 'node-number', text: owned ? '✓' : String(tier) }),
              h('div', {}, h('b', { text: tier === 4 ? path.technique : `${path.name} ${['I', 'II', 'III'][tier - 1]}` }),
                h('p', { text: tier === 4 ? style.description : style.passives[tier - 1] }),
                h('small', { text: owned ? tier === 4 ? 'C technique unlocked' : 'Passive active' : can ? 'Unlock · 1 point' : tier > rank + 1 ? 'Requires the previous node' : 'Earn another crew level' })));
          }));
      })),
      h('section', { class: 'sheet technique-picker', attrs: { 'aria-label': 'Equipped C skill' } }, h('h2', { text: 'Choose your C skill' }),
        h('p', { class: 'small muted', text: 'Your Q, E, R and T skills remain available. Choose one unlocked C skill for this build.' }),
        h('div', { class: 'btn-row' }, ...[{ style: 'signature' as const, technique: def.abilities[4].name }, ...HERO_PATHS[hero].filter(path => buildRank(build, path.style) === 4)].map(path => h('button', {
          class: `btn ${build.technique === path.style ? 'primary' : ''}`, text: path.technique, attrs: { 'aria-pressed': String(build.technique === path.style), 'data-technique': path.style },
          onClick: () => { app.save.equipTechnique(hero, path.style); render(); el.querySelector<HTMLButtonElement>(`[data-technique="${path.style}"]`)?.focus({ preventScroll: true }); },
        })))),
      h('div', { class: 'btn-row' }, h('button', { class: 'btn primary', text: `Take ${def.name}`, onClick: () => { app.save.setHero(hero); app.go({ kind: 'hub' }); } }),
        h('button', { class: 'btn', text: 'Shared crew training', onClick: () => app.go({ kind: 'crewTalents' }) })));
  };
  render(); return { el };
}
