import type { RemasterId, TowerId } from '../data/types';
import { SaveStore } from '../save/save';
import { clear } from './dom';
import { renderEncyclopedia } from './screens/encyclopedia';
import { renderHub } from './screens/hub';
import { renderLoadout } from './screens/loadout';
import { renderLocker } from './screens/locker';
import { renderPlay } from './screens/play';
import { renderSkills } from './screens/skills';
import { renderTalents } from './screens/talents';
import { renderTitle } from './screens/title';

export type Screen =
  | { kind: 'title' }
  | { kind: 'hub' }
  | { kind: 'skills' }
  | { kind: 'talents' }
  | { kind: 'locker' }
  | { kind: 'encyclopedia' }
  | { kind: 'loadout'; mapId: string; remaster?: RemasterId }
  | { kind: 'play'; mapId: string; remaster?: RemasterId; loadout?: TowerId[] };

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
        if (!this.save.hasAnyProgress()) {
          view = renderHub(this);
          break;
        }
        view = renderSkills(this);
        break;
      case 'talents':
        if (!this.save.hasAnyProgress()) {
          view = renderHub(this);
          break;
        }
        view = renderTalents(this);
        break;
      case 'locker':
        if (!this.save.hasAnyProgress()) {
          view = renderHub(this);
          break;
        }
        view = renderLocker(this);
        break;
      case 'encyclopedia':
        view = renderEncyclopedia(this);
        break;
      case 'loadout':
        view = renderLoadout(this, screen.mapId, screen.remaster ?? 'classic');
        break;
      case 'play':
        view = renderPlay(this, screen.mapId, screen.remaster ?? 'classic', screen.loadout);
        break;
      default: {
        const _exhaustive: never = screen;
        return _exhaustive;
      }
    }
    this.current = view;
    this.root.append(view.el);
  }

  dispose(): void {
    this.current?.dispose?.();
    this.current = null;
    clear(this.root);
  }
}
