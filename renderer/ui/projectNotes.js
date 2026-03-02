import { elements } from '../elements.js';
import { normalizeProjectMeta } from '../normalize.js';
import { state } from '../state.js';
import { refreshCurrentCounts, refreshSelectionCounts } from './counts.js';
import { updateCurrentDocLabel } from './layout.js';

export function applyProjectMeta(meta) {
  const normalized = normalizeProjectMeta(meta);
  state.projectMeta = normalized;
  if (
    !state.openProjectNoteId ||
    !normalized.notes.some((note) => note.id === state.openProjectNoteId)
  ) {
    state.openProjectNoteId = normalized.notes.length > 0 ? normalized.notes[0].id : null;
  }
  if (
    state.activeProjectNoteId &&
    !normalized.notes.some((note) => note.id === state.activeProjectNoteId)
  ) {
    state.activeProjectNoteId = null;
  }
  renderProjectNotes();
  renderProjectNoteEditor();
}

export function clearProjectMetaUI() {
  state.projectMeta = normalizeProjectMeta();
  state.openProjectNoteId = null;
  renderProjectNotes();
}

export function renderProjectNotes() {
  elements.projectNotesList.innerHTML = '';
  if (!state.projectMeta || !Array.isArray(state.projectMeta.notes)) {
    return;
  }
  const filtered = state.projectMeta.notes;

  if (!filtered.length) {
    const empty = document.createElement('div');
    empty.className = 'file-item empty';
    empty.textContent = 'No notes yet';
    elements.projectNotesList.appendChild(empty);
    return;
  }

  filtered.forEach((note) => {
    const wrapper = document.createElement('div');
    wrapper.className = 'project-note';
    wrapper.dataset.id = note.id;
    if (state.activeProjectNoteId === note.id) {
      wrapper.classList.add('active');
    }

    const header = document.createElement('div');
    header.className = 'note-header';

    const toggle = document.createElement('button');
    toggle.type = 'button';
    toggle.className = 'note-toggle';
    toggle.textContent = note.title || 'Untitled';
    header.appendChild(toggle);

    const actions = document.createElement('div');
    actions.className = 'note-actions';

    const rename = document.createElement('button');
    rename.type = 'button';
    rename.className = 'note-action note-rename';
    rename.textContent = 'Rename';
    actions.appendChild(rename);

    const remove = document.createElement('button');
    remove.type = 'button';
    remove.className = 'note-action note-delete danger';
    remove.textContent = 'Delete';
    actions.appendChild(remove);

    header.appendChild(actions);
    wrapper.appendChild(header);

    elements.projectNotesList.appendChild(wrapper);
  });
}

export function renderProjectNoteEditor() {
  if (!state.projectMeta || !Array.isArray(state.projectMeta.notes)) {
    elements.projectNoteTitle.textContent = 'Project Note';
    elements.projectNoteEditor.value = '';
    return;
  }
  const target = state.projectMeta.notes.find((note) => note.id === state.activeProjectNoteId);
  if (!target) {
    elements.projectNoteTitle.textContent = 'Project Note';
    elements.projectNoteEditor.value = '';
    return;
  }
  elements.projectNoteTitle.textContent = target.title || 'Untitled';
  elements.projectNoteEditor.value = target.content || '';
  refreshCurrentCounts();
  refreshSelectionCounts();
  updateCurrentDocLabel();
}
