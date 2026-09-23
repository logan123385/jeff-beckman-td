import { h } from './dom';

export interface ConfirmationOptions {
  title: string;
  message: string;
  confirmLabel: string;
  cancelLabel?: string;
}

/** Uses the game's UI, including in webviews that suppress window.confirm. */
export class ConfirmationDialog {
  private settle: ((confirmed: boolean) => void) | null = null;

  show(options: ConfirmationOptions): Promise<boolean> {
    this.close();
    const before = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    return new Promise(resolve => {
      const cancel = h('button', { class: 'btn primary', text: options.cancelLabel ?? 'Cancel', onClick: () => finish(false) });
      const accept = h('button', { class: 'btn danger', text: options.confirmLabel, onClick: () => finish(true) });
      const overlay = h('div', { class: 'confirmation-overlay overlay', attrs: { role: 'dialog', 'aria-modal': 'true', 'aria-labelledby': 'confirm-title', 'aria-describedby': 'confirm-message' } },
        h('section', { class: 'confirmation-card sheet' },
          h('span', { class: 'eyebrow', text: 'Beckman dispatch' }),
          h('h2', { text: options.title, attrs: { id: 'confirm-title' } }),
          h('p', { text: options.message, attrs: { id: 'confirm-message' } }),
          h('div', { class: 'confirmation-actions' }, cancel, accept)));
      const keydown = (event: KeyboardEvent) => {
        event.stopPropagation();
        if (event.key === 'Escape') { event.preventDefault(); finish(false); }
        if (event.key === 'Tab') {
          event.preventDefault();
          (document.activeElement === cancel ? accept : cancel).focus({ preventScroll: true });
        }
      };
      const finish = (confirmed: boolean) => {
        if (this.settle !== finish) return;
        this.settle = null;
        document.removeEventListener('keydown', keydown, true);
        overlay.remove();
        if (before?.isConnected) before.focus({ preventScroll: true });
        resolve(confirmed);
      };
      this.settle = finish;
      overlay.addEventListener('click', event => { if (event.target === overlay) finish(false); });
      document.body.append(overlay);
      document.addEventListener('keydown', keydown, true);
      cancel.focus({ preventScroll: true });
    });
  }

  close(): void { this.settle?.(false); }
}
