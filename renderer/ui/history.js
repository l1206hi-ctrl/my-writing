import { elements } from '../elements.js';
import { state } from '../state.js';

const dateFormatter = new Intl.DateTimeFormat(undefined, {
  year: 'numeric',
  month: 'short',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
});

function formatTimestamp(value) {
  if (!Number.isFinite(value)) {
    return 'Unknown time';
  }
  return dateFormatter.format(new Date(value));
}

export function renderHistoryList() {
  elements.historyList.innerHTML = '';
  if (!state.historyEntries.length) {
    const empty = document.createElement('div');
    empty.className = 'history-empty';
    empty.textContent = 'No history yet';
    elements.historyList.appendChild(empty);
    return;
  }
  state.historyEntries.forEach((entry) => {
    const row = document.createElement('div');
    row.className = 'history-item';
    row.dataset.id = entry.id;

    const meta = document.createElement('div');
    meta.className = 'history-meta';

    const title = document.createElement('div');
    title.className = 'history-title';
    title.textContent = entry.label || 'Snapshot';

    const time = document.createElement('div');
    time.className = 'history-time';
    time.textContent = formatTimestamp(entry.timestamp);

    meta.appendChild(title);
    meta.appendChild(time);

    const restore = document.createElement('button');
    restore.type = 'button';
    restore.className = 'mini ghost';
    restore.textContent = 'Restore';
    restore.dataset.action = 'restore';
    restore.dataset.id = entry.id;

    row.appendChild(meta);
    row.appendChild(restore);
    elements.historyList.appendChild(row);
  });
}
