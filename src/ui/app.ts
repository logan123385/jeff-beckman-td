import { SaveStore } from '../save/save';
import { clear } from './dom';
import { renderEncyclopedia } from './screens/encyclopedia';
import { renderHub } from './screens/hub';
import { renderPlay } from './screens/play';
import { renderSkills } from './screens/skills';
import { renderTitle } from './screens/title';

export type Screen =
  | { kind: 'title' }
  | { kind: 'hub' }
  | { kind: 'skills' }
  | { kind: 'encyclopedia' }
  | { kind: 'play'; mapId: string };

export interface ScreenView {
  el: HTMLElement;
  dispose?: () => void;
}

export class App {
  readonly save = new SaveStore();
  private current: ScreenView | null = null;

  constructor(private readonly root: HTMLElement) {}

  go(screen: Screen): void {
    this.current?.dispose?.();
    clear(this.root);
    let view: ScreenView;
    switch (screen.kind) {
      case 'title':
        view = renderTitle(this);
        break;
      case 'hub':
        view = renderHub(this);
        break;
      case 'skills':
        view = renderSkills(this);
        break;
      case 'encyclopedia':
        view = renderEncyclopedia(this);
        break;
      case 'play':
        view = renderPlay(this, screen.mapId);
        break;
      default: {
        const _exhaustive: never = screen;
        return _exhaustive;
      }
    }
    this.current = view;
    this.root.append(view.el);
  }
}
