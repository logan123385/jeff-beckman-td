import { TALENT_BRANCHES, TALENTS, canUnlockTalent } from '../../data/talents';
import { JEFF_LEVEL_CAP, levelFromXp, xpBarCopy } from '../../data/xp';
import type { TalentBranch } from '../../data/types';
import type { App, ScreenView } from '../app';
import { clear, h } from '../dom';

const BRANCHES: TalentBranch[] = ['combat', 'field', 'foreman'];

export function renderTalents(app: App): ScreenView {
  const save = app.save;
  const el = h('div', { class: 'screen skills talents' });

  const render = () => {
    clear(el);
    const owned = new Set(save.data.talents);
    const xp = levelFromXp(save.data.jeffXp);
    el.append(
      h(
        'header',
        { class: 'screen-header sheet' },
        h('button', { class: 'btn link', text: '← Van', onClick: () => app.go({ kind: 'hub' }) }),
        h('h1', { text: 'Hero Talent Tree' }),
        h('span', { class: 'pill big', text: `Lv ${xp.level} · ${save.talentPoints()} point${save.talentPoints() === 1 ? '' : 's'}` }),
        h('button', {
          class: 'btn',
          text: 'Respec (free)',
          disabled: save.data.talents.length === 0,
          onClick: () => {
            save.respecTalents();
            render();
          },
        }),
      ),
      h('p', { class: 'lede', text: 'All heroes share crew XP, gear, and this talent tree. Earn one point per crew level. Wrench Tap and tool-belt repair perks apply specifically to Jeff; general stat perks apply to your selected hero.' }),
      h('div', { class: 'xp-bar' }, h('div', { class: 'fill', style: { width: `${xp.level >= JEFF_LEVEL_CAP ? 100 : (xp.into / xp.need) * 100}%` } }), h('span', { class: 'small', text: xpBarCopy(xp) })),
      h(
        'div',
        { class: 'skill-columns' },
        ...BRANCHES.map((branch) =>
          h(
            'div',
            { class: `skill-col sheet ${branch}` },
            h('h3', { text: TALENT_BRANCHES[branch].name }),
            h('p', { class: 'small muted', text: TALENT_BRANCHES[branch].blurb }),
            ...TALENTS.filter((s) => s.branch === branch).map((s) => {
              const has = owned.has(s.id);
              const can = !has && canUnlockTalent(s.id, owned) && save.talentPoints() > 0;
              return h(
                'button',
                {
                  class: `skill-node ${has ? 'owned' : can ? 'available' : 'locked'}`,
                  disabled: !can,
                  onClick: () => {
                    if (save.unlockTalent(s.id)) render();
                  },
                },
                h('div', { class: 'skill-name', text: s.name }),
                h('div', { class: 'small', text: s.desc }),
                h('div', { class: 'small muted', text: has ? 'Owned' : can ? 'Spend 1 point' : s.tier === 1 ? 'Needs a point' : 'Needs the previous node' }),
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
