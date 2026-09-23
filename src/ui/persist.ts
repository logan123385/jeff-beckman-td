import type { SaveStore } from '../save/save';
import { MAX_SAVE_BYTES } from '../save/save';
import type { App } from './app';
import { h } from './dom';

export function persistWarning(save: SaveStore): string | null {
  if (!save.lastWriteOk) return "Couldn't save progress on this device. This tab still has the run — download a copy before you close it.";
  if (save.staleWriteSkipped) return 'Another tab saved newer progress. This tab did not overwrite it — reload to pick up that record.';
  if (save.recoveredFromBackup) return 'Restored from a backup copy. Download your save if this looks right.';
  return null;
}

export function downloadSaveFile(save: SaveStore): void {
  const blob = new Blob([save.exportJson()], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'jbtd-save.json';
  document.body.append(a);
  a.click();
  a.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 60_000);
}

export function persistRow(save: SaveStore, app?: App): HTMLElement | null {
  const warn = persistWarning(save);
  const status = h('p', { class: 'persist-warn', attrs: { role: 'status', 'aria-live': 'polite' } });
  const input = h('input', { attrs: { type: 'file', accept: '.json,application/json', 'aria-label': 'Choose a saved game', hidden: '' } });
  input.addEventListener('change', async () => {
    const file = input.files?.[0];
    input.value = '';
    if (!file || !app) return;
    if (file.size > MAX_SAVE_BYTES) { status.textContent = 'That file is too large to be a game save.'; return; }
    try {
      const raw = await file.text();
      if (!input.isConnected) return;
      if (!await app.confirmation.show({ title: 'Restore this save?', message: 'This replaces progress on this device with the file you chose. Your current save is backed up first.', confirmLabel: 'Restore save' })) return;
      const result = save.importJson(raw);
      if (result.ok) app.go({ kind: 'title' });
      else status.textContent = result.message;
    } catch { status.textContent = 'Could not read that file. Your current progress is unchanged.'; }
  });
  const actions = h(
    'div',
    { class: 'persist-actions' },
    save.hasAnyProgress()
      ? h('button', {
          class: 'btn small-btn',
          text: 'Download save',
          title: 'Keep a copy of your campaign, towers, kit, and locker. Restore it in another browser.',
          onClick: () => downloadSaveFile(save),
        })
      : null,
    app ? h('button', { class: 'btn small-btn', text: 'Restore save', onClick: () => input.click() }) : null,
    input,
  );
  if (!warn && !save.hasAnyProgress() && !app) return null;
  return h(
    'div',
    { class: `persist-row${warn ? ' warn' : ''}` },
    warn ? h('p', { class: 'persist-warn', text: warn }) : null,
    actions,
    status,
  );
}
