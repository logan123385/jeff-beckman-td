import type { SaveStore } from '../save/save';
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
  URL.revokeObjectURL(url);
}

export function persistRow(save: SaveStore): HTMLElement | null {
  const warn = persistWarning(save);
  const actions = h(
    'div',
    { class: 'persist-actions' },
    save.hasAnyProgress()
      ? h('button', {
          class: 'btn small-btn',
          text: 'Download save',
          title: 'Keep a JSON copy of stars, XP, perks, and locker.',
          onClick: () => downloadSaveFile(save),
        })
      : null,
  );
  if (!warn && !save.hasAnyProgress()) return null;
  return h(
    'div',
    { class: `persist-row${warn ? ' warn' : ''}` },
    warn ? h('p', { class: 'persist-warn', text: warn }) : null,
    actions,
  );
}
