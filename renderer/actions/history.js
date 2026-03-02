import { elements } from '../elements.js';
import { normalizeDoc } from '../normalize.js';
import { state } from '../state.js';
import {
  applyDocToUI,
  refreshCurrentCounts,
  refreshSelectionCounts,
  renderHistoryList,
  setDirty,
  setStatus,
  updateDocSummaryFromCurrent,
} from '../ui.js';
import { refreshDocStats } from './docs.js';

export async function openHistory() {
  if (!state.projectPath || !state.currentDocId) {
    return;
  }
  try {
    const entries = await window.api.listHistory(state.projectPath, state.currentDocId);
    state.historyEntries = Array.isArray(entries)
      ? entries.map((entry) => ({
          ...entry,
          label: 'Snapshot',
        }))
      : [];
  } catch (error) {
    state.historyEntries = [];
  }
  renderHistoryList();
  elements.historyOverlay.classList.remove('hidden');
}

export function closeHistory() {
  elements.historyOverlay.classList.add('hidden');
}

export async function restoreHistory(versionId) {
  if (!state.projectPath || !state.currentDocId || !versionId) {
    return;
  }
  const confirmRestore = window.confirm('Restore this version? Unsaved changes will be lost.');
  if (!confirmRestore) {
    return;
  }
  try {
    const doc = await window.api.restoreHistory(state.projectPath, state.currentDocId, versionId);
    if (!doc) {
      setStatus('Restore failed.', true);
      return;
    }
    state.currentDoc = normalizeDoc(doc);
    applyDocToUI(state.currentDoc);
    setDirty(false);
    refreshCurrentCounts();
    refreshSelectionCounts();
    updateDocSummaryFromCurrent();
    await refreshDocStats();
    setStatus('Version restored.');
    closeHistory();
  } catch (error) {
    setStatus(error.message || 'Restore failed.', true);
  }
}
