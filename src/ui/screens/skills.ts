import { SKILLS, SKILL_BRANCHES, canUnlock, skillCost } from '../../data/skills';
import type { SkillBranch } from '../../data/types';
import type { App, ScreenView } from '../app';
import { clear, h, ninetyIcon } from '../dom';

const BRANCHES: SkillBranch[] = ['tools', 'jeff', 'crew', 'shop'];
export function renderSkills(app: App): ScreenView {
  const save = app.save;
  const el = h('div', { class: 'screen skills perk-workshop' });
  const render = () => {
    clear(el); const owned = new Set<string>();
    el.append(h('header', { class: 'screen-header sheet' },
      h('button', { class: 'btn link', text: '← Van', onClick: () => app.go({ kind: 'hub' }) }),
      h('div', {}, h('div', { class: 'eyebrow', text: 'Craft your strategy' }), h('h1', { text: 'The 90’s Workshop' })),
      h('span', { class: 'currency-balance' }, ninetyIcon(38), h('b', { text: `${save.availableStars()} 90’s` }), h('span', { class: 'small', text: 'available' })),
      h('button', { class: 'btn', text: 'Rebuild perks · free', disabled: save.spentStars() === 0, onClick: () => { save.respec(); render(); } })),
      h('p', { class: 'lede', text: 'Earn 1–3 90’s per call: 3 for no lives lost, 2 for keeping at least half, 1 for surviving. Your best rating counts. Each fork is a choice—pick one perk, then continue down the branch. Rebuild freely.' }),
      h('div', { class: 'skill-columns' }, ...BRANCHES.map((branch, bi) => h('section', { class: `skill-col sheet ${branch}`, style: { animationDelay: `${bi * 80}ms` } },
        h('div', { class: 'branch-emblem', text: ['⚒', '✚', '♟', '⚙'][bi] }), h('h3', { text: SKILL_BRANCHES[branch].name }), h('p', { class: 'small muted', text: SKILL_BRANCHES[branch].blurb }),
        ...[1, 2, 3, 4, 5].map(tier => h('div', { class: `perk-tier tier-${tier}` }, ...SKILLS.filter(s => s.branch === branch && s.tier === tier).map(s => {
          const has = owned.has(s.id), cost = skillCost(s.id), pathOpen = canUnlock(s.id, owned), can = pathOpen && save.availableStars() >= cost;
          const other = !!s.choiceGroup && SKILLS.some(n => n.choiceGroup === s.choiceGroup && owned.has(n.id));
          return h('button', { class: `skill-node ${has ? 'owned' : can ? 'available' : 'locked'}`, disabled: !can,
            title: `${s.desc} · ${cost} 90’s`, onClick: () => { if (save.unlockSkill(s.id)) render(); } },
            h('span', { class: 'perk-rank', text: `${tier}` }), h('div', { class: 'skill-name', text: s.name }), h('div', { class: 'small', text: s.desc }),
            h('div', { class: 'perk-cost' }, has ? h('b', { text: '✓ Equipped' }) : other ? h('span', { text: 'Other path chosen' }) : h('span', {}, ninetyIcon(17), `${cost} 90’s`, !pathOpen ? ' · earlier tier required' : '')));
        }))),
      ))));
  }; render(); return { el };
}
