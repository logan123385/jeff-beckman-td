import type { App, ScreenView } from '../app';
import { h } from '../dom';

/** @deprecated Retired — redirects to Kit. */
export function renderSkills(app: App): ScreenView {
  app.go({ kind: 'kit' });
  return { el: h('div') };
}
