import type { SoundPreset } from '../../audio/bus';
import { h } from '../dom';

export interface PauseHandlers {
  onResume(): void;
  onCycleSound(): void;
  soundLabel(): string;
  onQuit(): void;
  onClockOut?: () => void;
  autoPause: () => boolean;
  onToggleAutoPause(): void;
}

/** Wood/brass pause card — Resume, Soft/Full/Off, Quit. */
export function createPausePanel(handlers: PauseHandlers): {
  el: HTMLElement;
  show(): void;
  hide(): void;
  syncSound(): void;
} {
  const soundBtn = h('button', { class: 'btn big pause-sound' });
  const autoBtn = h('button', { class: 'btn big pause-auto' });
  const syncSound = () => {
    soundBtn.textContent = handlers.soundLabel();
  };
  const syncAuto = () => {
    autoBtn.textContent = handlers.autoPause() ? 'Auto-pause waves on' : 'Auto-pause waves off';
  };
  syncSound();
  syncAuto();
  soundBtn.addEventListener('click', () => {
    handlers.onCycleSound();
    syncSound();
  });
  autoBtn.addEventListener('click', () => {
    handlers.onToggleAutoPause();
    syncAuto();
  });

  const card = h(
    'div',
    {
      class: 'pause-card sheet',
      onClick: (ev) => ev.stopPropagation(),
    },
    h('div', { class: 'eyebrow', text: 'On break' }),
    h('h2', { text: 'Paused' }),
    h('p', { class: 'small muted', text: 'Take a breather. The crew is holding your place.' }),
    h(
      'div',
      { class: 'pause-actions' },
      h('button', { class: 'btn primary big', text: 'Resume', onClick: () => handlers.onResume() }),
      soundBtn,
      autoBtn,
      handlers.onClockOut ? h('button', { class: 'btn pause-clock', text: 'Clock out · bank rewards', onClick: handlers.onClockOut }) : null,
      h('button', { class: 'btn pause-exit', text: 'Main menu', onClick: () => handlers.onQuit() }),
    ),
    h('p', { class: 'small muted pause-keys', text: 'P or Esc to resume · double-tap a tower to upgrade · tap pads to keep placing' }),
  );

  const el = h(
    'div',
    {
      class: 'pause-overlay overlay hidden',
      onClick: () => handlers.onResume(),
    },
    card,
  );

  return {
    el,
    show() {
      syncSound();
      el.classList.remove('hidden');
    },
    hide() {
      el.classList.add('hidden');
    },
    syncSound,
  };
}

export function pauseSoundLabel(preset: SoundPreset): string {
  switch (preset) {
    case 'off':
      return 'Sound off';
    case 'soft':
      return 'Sound soft';
    case 'full':
      return 'Sound full';
    default: {
      const _exhaustive: never = preset;
      return _exhaustive;
    }
  }
}
