import type { App, ScreenView } from '../app';
import { h } from '../dom';

/** @deprecated Retired — redirects to Kit. */
export function renderBuilds(app: App): ScreenView {
  app.go({ kind: 'kit' });
  return { el: h('div') };
}
