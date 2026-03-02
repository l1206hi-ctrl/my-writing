import { elements } from '../elements.js';
import { formatCount, getCharCounts } from '../format.js';
import { state } from '../state.js';

export function updateCountDisplay() {
  elements.countWithSpaces.textContent = formatCount(state.currentCounts.withSpaces);
  elements.countWithoutSpaces.textContent = formatCount(state.currentCounts.withoutSpaces);
  elements.selectionWithSpaces.textContent = formatCount(state.selectionCounts.withSpaces);
  elements.selectionWithoutSpaces.textContent = formatCount(state.selectionCounts.withoutSpaces);
  elements.selectionRow.classList.toggle('empty', !state.selectionActive);

  const displayTotals = getDisplayTotalCounts();
  elements.totalWithSpaces.textContent = formatCount(displayTotals.withSpaces);
  elements.totalWithoutSpaces.textContent = formatCount(displayTotals.withoutSpaces);
}

export function getDisplayTotalCounts() {
  const totals = { ...state.totalCounts };
  if (state.viewMode === 'project-note' || !state.currentDocId) {
    return totals;
  }
  const savedCounts = state.docStats.get(state.currentDocId);
  if (!savedCounts) {
    totals.withSpaces += state.currentCounts.withSpaces;
    totals.withoutSpaces += state.currentCounts.withoutSpaces;
    return totals;
  }
  totals.withSpaces += state.currentCounts.withSpaces - savedCounts.withSpaces;
  totals.withoutSpaces += state.currentCounts.withoutSpaces - savedCounts.withoutSpaces;
  return totals;
}

export function refreshCurrentCounts() {
  const editor =
    state.viewMode === 'project-note' && state.activeProjectNoteId
      ? elements.projectNoteEditor
      : state.currentDocId
      ? elements.editorText
      : null;
  if (!editor) {
    state.currentCounts = { withSpaces: 0, withoutSpaces: 0 };
    updateCountDisplay();
    return;
  }
  state.currentCounts = getCharCounts(editor.value);
  updateCountDisplay();
}

export function refreshSelectionCounts() {
  const editor =
    state.viewMode === 'project-note' && state.activeProjectNoteId
      ? elements.projectNoteEditor
      : state.currentDocId
      ? elements.editorText
      : null;
  if (!editor) {
    state.selectionCounts = { withSpaces: 0, withoutSpaces: 0 };
    state.selectionActive = false;
    updateCountDisplay();
    return;
  }
  const start = editor.selectionStart;
  const end = editor.selectionEnd;
  if (!Number.isFinite(start) || !Number.isFinite(end) || start === end) {
    state.selectionCounts = { withSpaces: 0, withoutSpaces: 0 };
    state.selectionActive = false;
    updateCountDisplay();
    return;
  }
  const selection = editor.value.slice(start, end);
  state.selectionCounts = getCharCounts(selection);
  state.selectionActive = true;
  updateCountDisplay();
}

export function getCountsForDoc(docId) {
  if (!docId) {
    return null;
  }
  if (state.currentDocId === docId) {
    return state.currentCounts;
  }
  return state.docStats.get(docId) || null;
}
