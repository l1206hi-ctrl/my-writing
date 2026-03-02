import {
  DOC_META_COLLAPSED_KEY,
  FONT_KEY,
  FONT_MAX,
  FONT_MIN,
  SIDEBAR_WIDTH_KEY,
  SIDEBAR_WIDTH_MAX,
  SIDEBAR_WIDTH_MIN,
} from '../constants.js';
import { elements } from '../elements.js';
import { state } from '../state.js';

let chapterResizeObserver = null;
let chapterResizeHandler = null;

export function initChapterScrollSizing() {
  if (!elements.chapterScroll) {
    return;
  }
  const update = () => {
    const width = elements.chapterScroll.clientWidth;
    if (width > 0) {
      elements.chapterScroll.style.setProperty('--chapter-list-max', `${width}px`);
    }
  };
  update();
  if (chapterResizeObserver) {
    chapterResizeObserver.disconnect();
  }
  chapterResizeObserver = new ResizeObserver(update);
  chapterResizeObserver.observe(elements.chapterScroll);
  if (!chapterResizeHandler) {
    chapterResizeHandler = update;
    window.addEventListener('resize', chapterResizeHandler);
  }
}

function clampSidebarWidth(value) {
  if (!Number.isFinite(value)) {
    return SIDEBAR_WIDTH_MIN;
  }
  return Math.min(SIDEBAR_WIDTH_MAX, Math.max(SIDEBAR_WIDTH_MIN, value));
}

export function setSidebarWidth(value) {
  const width = clampSidebarWidth(value);
  document.documentElement.style.setProperty('--sidebar-width', `${width}px`);
  try {
    localStorage.setItem(SIDEBAR_WIDTH_KEY, String(width));
  } catch (error) {
    // ignore storage failures
  }
}

export function loadSidebarWidth() {
  try {
    const saved = Number.parseInt(localStorage.getItem(SIDEBAR_WIDTH_KEY), 10);
    if (Number.isFinite(saved)) {
      setSidebarWidth(saved);
      return;
    }
  } catch (error) {
    // ignore storage errors
  }
  setSidebarWidth(SIDEBAR_WIDTH_MIN);
}

export function applyFontSize(size) {
  const clamped = Math.min(FONT_MAX, Math.max(FONT_MIN, size));
  state.fontSize = clamped;
  document.documentElement.style.setProperty('--editor-size', `${clamped}px`);
  elements.fontSizeLabel.textContent = `${clamped}px`;
  elements.btnFontSmaller.disabled = clamped <= FONT_MIN;
  elements.btnFontLarger.disabled = clamped >= FONT_MAX;
  localStorage.setItem(FONT_KEY, String(clamped));
}

export function loadFontSize() {
  const saved = Number.parseInt(localStorage.getItem(FONT_KEY), 10);
  applyFontSize(Number.isFinite(saved) ? saved : state.fontSize);
}

function updateDocMetaToggleButton() {
  if (!elements.btnToggleDocMeta) {
    return;
  }
  const isCollapsed = Boolean(state.docMetaCollapsed);
  elements.btnToggleDocMeta.textContent = '>';
  elements.btnToggleDocMeta.classList.toggle('is-collapsed', isCollapsed);
  elements.btnToggleDocMeta.setAttribute(
    'aria-label',
    isCollapsed ? 'Show chapter details' : 'Hide chapter details'
  );
  elements.btnToggleDocMeta.title = isCollapsed
    ? 'Show chapter details'
    : 'Hide chapter details';
}

export function setDocMetaCollapsed(collapsed, options = {}) {
  const next = Boolean(collapsed);
  state.docMetaCollapsed = next;
  if (elements.docMeta) {
    elements.docMeta.classList.toggle('collapsed', next);
  }
  updateDocMetaToggleButton();
  if (options.persist === false) {
    return;
  }
  try {
    localStorage.setItem(DOC_META_COLLAPSED_KEY, next ? '1' : '0');
  } catch (error) {
    // ignore storage errors
  }
}

export function toggleDocMetaCollapsed() {
  setDocMetaCollapsed(!state.docMetaCollapsed);
}

export function loadDocMetaCollapsed() {
  try {
    const saved = localStorage.getItem(DOC_META_COLLAPSED_KEY);
    setDocMetaCollapsed(saved === '1', { persist: false });
    return;
  } catch (error) {
    // ignore storage errors
  }
  setDocMetaCollapsed(false, { persist: false });
}

export function setStatus(message, isError = false) {
  elements.statusText.textContent = message;
  elements.statusText.classList.toggle('error', isError);
  elements.statusHint.textContent = message;
}

export function setDirty(isDirty) {
  state.dirty = isDirty;
  elements.statusDot.classList.toggle('dirty', isDirty);
  updateActionState();
}

export function updateProjectInfo() {
  elements.projectName.textContent = state.projectName || 'No project loaded';
  elements.projectPath.textContent = state.projectPath || 'Select or create a folder';
}

export function updateCurrentDocLabel() {
  if (state.viewMode === 'project-note' && state.activeProjectNoteId && state.projectMeta) {
    const note = state.projectMeta.notes.find((item) => item.id === state.activeProjectNoteId);
    if (note) {
      elements.currentFile.textContent = note.title || 'Project Note';
      return;
    }
  }
  if (!state.currentDoc) {
    elements.currentFile.textContent = 'No chapter selected';
    return;
  }
  elements.currentFile.textContent = state.currentDoc.title || 'Untitled Chapter';
}

export function updateActionState() {
  const hasProject = Boolean(state.projectPath);
  elements.btnNewFile.disabled = !hasProject;
  if (elements.btnBinderPinnedOnly) {
    elements.btnBinderPinnedOnly.disabled = !hasProject;
  }
  if (elements.btnFocus) {
    elements.btnFocus.disabled = !hasProject;
  }
  if (elements.btnNewFolder) {
    elements.btnNewFolder.disabled = !hasProject;
  }
  if (elements.btnNewNote) {
    elements.btnNewNote.disabled = !hasProject;
  }
  if (elements.btnFindInChapter) {
    const hasTarget =
      (state.viewMode === 'project-note' && Boolean(state.activeProjectNoteId)) ||
      Boolean(state.currentDocId);
    elements.btnFindInChapter.disabled = !hasProject || !hasTarget;
  }
  if (elements.btnGlobalSearch) {
    elements.btnGlobalSearch.disabled = !hasProject;
  }
  if (elements.btnHistory) {
    elements.btnHistory.disabled = !hasProject || !state.currentDocId;
  }
  if (elements.btnToggleDocMeta) {
    elements.btnToggleDocMeta.disabled = !hasProject || !state.currentDocId;
  }
  if (elements.btnTogglePin) {
    const canPinTarget =
      (state.viewMode === 'editor' && Boolean(state.currentDocId)) ||
      (state.viewMode === 'project-note' && Boolean(state.activeProjectNoteId));
    elements.btnTogglePin.disabled = !hasProject || !canPinTarget;
  }
  elements.btnSave.disabled = !hasProject || !state.currentDocId || !state.dirty;
  if (elements.searchInput) {
    elements.searchInput.disabled = false;
    elements.searchInput.placeholder = hasProject
      ? 'Filter binder'
      : 'Open project first (you can still type)';
  }
  elements.btnAddProjectNote.disabled = !hasProject;
}

export function applyViewMode() {
  const isBoard = state.viewMode === 'board';
  const isProjectNote = state.viewMode === 'project-note';
  const isFocus = Boolean(state.focusMode);
  document.body.classList.toggle('mode-board', isBoard);
  document.body.classList.toggle('mode-project-note', isProjectNote);
  document.body.classList.toggle('mode-focus', isFocus);
  elements.boardView.classList.toggle('visible', isBoard);
  elements.boardView.classList.toggle('hidden', !isBoard);
  elements.projectNoteView.classList.toggle('visible', isProjectNote);
  elements.projectNoteView.classList.toggle('hidden', !isProjectNote);
  const showDoc = state.viewMode === 'editor';
  const hideDoc = !showDoc || !state.currentDocId;
  const hidePinButton =
    (state.viewMode !== 'editor' || !state.currentDocId) &&
    (state.viewMode !== 'project-note' || !state.activeProjectNoteId);
  elements.editorView.classList.toggle('hidden', hideDoc);
  elements.docMeta.classList.toggle('hidden', hideDoc);
  if (elements.btnToggleDocMeta) {
    elements.btnToggleDocMeta.classList.toggle('hidden', hideDoc);
  }
  if (elements.btnTogglePin) {
    elements.btnTogglePin.classList.toggle('hidden', hidePinButton);
  }
  elements.emptyState.classList.toggle(
    'visible',
    !isBoard && !isProjectNote && !state.currentDocId
  );
  if (elements.btnToggleBoard) {
    elements.btnToggleBoard.textContent = isBoard ? 'Editor' : 'Board';
  }
  if (elements.btnFocus) {
    elements.btnFocus.textContent = isFocus ? 'Exit Focus' : 'Focus';
  }
  if (elements.btnBinderPinnedOnly) {
    elements.btnBinderPinnedOnly.textContent = state.binderPinnedOnly ? 'Pinned' : 'Pin';
    elements.btnBinderPinnedOnly.classList.toggle('active', state.binderPinnedOnly);
  }
  if (elements.btnTogglePin) {
    const pinned = state.viewMode === 'project-note'
      ? Boolean(
          state.projectMeta &&
            Array.isArray(state.projectMeta.notes) &&
            state.projectMeta.notes.find((note) => note.id === state.activeProjectNoteId)?.pinned
        )
      : Boolean(state.currentDoc && state.currentDoc.pinned);
    elements.btnTogglePin.textContent = pinned ? 'Pinned' : 'Pin';
    elements.btnTogglePin.classList.toggle('active', pinned);
  }
}
