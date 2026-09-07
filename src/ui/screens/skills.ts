import { SKILLS, SKILL_BRANCHES, canUnlock } from '../../data/skills';
import type { SkillBranch } from '../../data/types';
import type { App, ScreenView } from '../app';
import { clear, h } from '../dom';

const BRANCHES: SkillBranch[] = ['tools', 'jeff', 'shop'];

export function renderSkills(app: App): ScreenView {
  const save = app.save;
  const el = h('div', { class: 'screen skills' });

  const render = () => {
    clear(el);
    const owned = new Set(save.data.skills);
    el.append(
      h(
        'header',
        { class: 'screen-header' },
        h('button', { class: 'btn link', text: '← Van', onClick: () => app.go({ kind: 'hub' }) }),
        h('h1', { text: 'Journeyman Stars' }),
        h('span', { class: 'pill big', text: `${save.availableStars()} / ${save.totalStars()} stars available` }),
        h('button', {
          class: 'btn',
          text: 'Respec (free)',
          disabled: save.spentStars() === 0,
          onClick: () => {
            save.respec();
            render();
          },
        }),
      ),
      h('p', { class: 'muted', text: 'Stars come from clearing jobs (up to 3 per job, best run counts). Spend them here; nothing is ever lost, and you can move them around any time.' }),
      h(
        'div',
        { class: 'skill-columns' },
        ...BRANCHES.map((branch) =>
          h(
            'div',
            { class: `skill-col ${branch}` },
            h('h3', { text: SKILL_BRANCHES[branch].name }),
            h('p', { class: 'small muted', text: SKILL_BRANCHES[branch].blurb }),
            ...SKILLS.filter((s) => s.branch === branch).map((s) => {
              const has = owned.has(s.id);
              const can = !has && canUnlock(s.id, owned) && save.availableStars() > 0;
              return h(
                'button',
                {
                  class: `skill-node ${has ? 'owned' : can ? 'available' : 'locked'}`,
                  disabled: !can,
                  onClick: () => {
                    if (save.unlockSkill(s.id)) render();
                  },
                },
                h('div', { class: 'skill-name', text: s.name }),
                h('div', { class: 'small', text: s.desc }),
                h('div', { class: 'small muted', text: has ? 'Owned' : can ? 'Unlock for 1 ★' : s.tier === 1 ? 'Needs a star' : 'Needs the previous node' }),
              );
            }),
          ),
        ),
      ),
    );
  };
  render();
  return { el };
}
