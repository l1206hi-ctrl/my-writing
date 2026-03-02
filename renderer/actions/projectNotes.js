import { PROJECT_SAVE_DELAY } from '../constants.js';
import { findNoteNode, findNoteNodeId } from '../binder.js';
import { requestText } from '../modal.js';
import { normalizeDoc, normalizeProjectMeta } from '../normalize.js';
import { state } from '../state.js';
import {
  applyProjectMeta,
  applyViewMode,
  clearProjectMetaUI,
  renderDocList,
  renderProjectNoteEditor,
  renderProjectNotes,
  setStatus,
  updateActionState,
} from '../ui.js';

let projectSaveTimer = null;

function clearProjectSaveTimer() {
  if (!projectSaveTimer) {
    return;
  }
  clearTimeout(projectSaveTimer);
  projectSaveTimer = null;
}

function getPreferredParentFolderId() {
  if (!state.binder || !state.binder.nodes) {
    return null;
  }
  const selectedNode = state.selectedBinderNodeId
    ? state.binder.nodes[state.selectedBinderNodeId]
    : null;
  if (selectedNode && selectedNode.type === 'folder') {
    return selectedNode.id;
  }
  if (
    selectedNode &&
    selectedNode.parentId &&
    state.binder.nodes[selectedNode.parentId] &&
    state.binder.nodes[selectedNode.parentId].type === 'folder'
  ) {
    return selectedNode.parentId;
  }
  return null;
}

async function refreshBinderForNotes(preferredNoteId = null) {
  const { refreshDocs } = await import('./docs.js');
  await refreshDocs();
  state.selectedDocId = null;
  if (preferredNoteId) {
    const nodeId = findNoteNodeId(preferredNoteId);
    if (nodeId && state.binder.nodes[nodeId]) {
      state.selectedBinderNodeId = nodeId;
    }
  }
  renderDocList();
  updateActionState();
}

export async function loadProjectMeta() {
  if (!state.projectPath) {
    return;
  }
  try {
    const meta = await window.api.readProjectMeta(state.projectPath);
    applyProjectMeta(meta);
  } catch (error) {
    setStatus(error.message || 'Unable to load project notes.', true);
    clearProjectMetaUI();
  }
}

export function scheduleProjectSave() {
  if (!state.projectPath || !state.projectMeta) {
    return;
  }
  clearProjectSaveTimer();
  const projectPathSnapshot = String(state.projectPath || '').trim();
  const metaSnapshot = normalizeProjectMeta(state.projectMeta);
  projectSaveTimer = setTimeout(() => {
    projectSaveTimer = null;
    saveProjectMeta({
      silent: true,
      fromTimer: true,
      projectPath: projectPathSnapshot,
      meta: metaSnapshot,
      suppressErrorIfProjectChanged: true,
    });
  }, PROJECT_SAVE_DELAY);
}

export async function saveProjectMeta(options = {}) {
  if (!options.fromTimer) {
    clearProjectSaveTimer();
  }
  const projectPath = String(options.projectPath || state.projectPath || '').trim();
  const payload = options.meta ? normalizeProjectMeta(options.meta) : state.projectMeta;
  if (!projectPath || !payload) {
    return;
  }
  try {
    await window.api.writeProjectMeta(projectPath, payload);
    if (!options.silent && projectPath === state.projectPath) {
      setStatus('Project notes saved.');
    }
  } catch (error) {
    if (options.suppressErrorIfProjectChanged && projectPath !== state.projectPath) {
      return;
    }
    setStatus(error.message || 'Project notes save failed.', true);
  }
}

export function handleProjectNoteChange(noteId, value) {
  if (!state.projectMeta || !Array.isArray(state.projectMeta.notes)) {
    state.projectMeta = normalizeProjectMeta();
  }
  const target = state.projectMeta.notes.find((note) => note.id === noteId);
  if (!target) {
    return;
  }
  target.content = value;
  scheduleProjectSave();
}

export async function toggleProjectNotePinned(noteId = state.activeProjectNoteId) {
  const targetId = String(noteId || '').trim();
  if (!state.projectPath || !targetId) {
    return false;
  }
  try {
    if (!state.projectMeta || !Array.isArray(state.projectMeta.notes)) {
      state.projectMeta = normalizeProjectMeta(await window.api.readProjectMeta(state.projectPath));
    }
    const target = state.projectMeta.notes.find((note) => note.id === targetId);
    if (!target) {
      return false;
    }
    target.pinned = !Boolean(target.pinned);
    const node = findNoteNode(targetId);
    if (node) {
      node.pinned = Boolean(target.pinned);
    }
    renderProjectNotes();
    renderProjectNoteEditor();
    renderDocList();
    updateActionState();
    applyViewMode();
    await saveProjectMeta({ silent: true });
    setStatus(target.pinned ? 'Pinned note.' : 'Unpinned note.');
    return true;
  } catch (error) {
    setStatus(error.message || 'Unable to update note pin.', true);
    return false;
  }
}

export async function createProjectNote() {
  if (!state.projectPath) {
    return;
  }
  const title = String(
    await requestText({
      title: 'New note title',
      placeholder: 'World lore',
      value: '',
      confirmLabel: 'Add',
    })
  ).trim();
  if (!title) {
    return;
  }
  const preferredParentId = getPreferredParentFolderId();
  if (!state.projectMeta) {
    state.projectMeta = normalizeProjectMeta();
  }
  const id = `note_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 5)}`;
  state.projectMeta.notes.push({ id, title, content: '', pinned: false });
  state.activeProjectNoteId = id;
  state.openProjectNoteId = id;
  state.viewMode = 'project-note';
  renderProjectNotes();
  renderProjectNoteEditor();
  applyViewMode();
  await saveProjectMeta({ silent: true });
  await refreshBinderForNotes(id);
  if (preferredParentId) {
    const { moveBinderNode } = await import('./docs.js');
    const noteNodeId = findNoteNodeId(id);
    if (noteNodeId) {
      await moveBinderNode(noteNodeId, preferredParentId, null, { silent: true });
      await refreshBinderForNotes(id);
    }
  }
  setStatus('Note created.');
}

export async function renameProjectNote(noteId = state.activeProjectNoteId) {
  if (!state.projectPath) {
    setStatus('Open a project first.', true);
    return false;
  }
  let targetId = String(noteId || '').trim();
  if (!targetId && state.selectedBinderNodeId && state.binder && state.binder.nodes) {
    const node = state.binder.nodes[state.selectedBinderNodeId];
    if (node && node.type === 'note' && node.noteId) {
      targetId = String(node.noteId || '').trim();
    }
  }
  if (!targetId) {
    setStatus('Select a note first.', true);
    return false;
  }
  if (!state.projectMeta || !Array.isArray(state.projectMeta.notes)) {
    try {
      state.projectMeta = normalizeProjectMeta(await window.api.readProjectMeta(state.projectPath));
    } catch (error) {
      setStatus(error.message || 'Unable to load project notes.', true);
      return false;
    }
  }
  const target = state.projectMeta.notes.find((note) => note.id === targetId);
  if (!target) {
    setStatus('Note not found.', true);
    return false;
  }
  const title = String(
    await requestText({
      title: 'Rename note',
      placeholder: target.title || 'Untitled',
      value: target.title || '',
      confirmLabel: 'Rename',
    })
  ).trim();
  if (!title) {
    return false;
  }
  if (title === String(target.title || '').trim()) {
    return false;
  }
  target.title = title;
  const node = findNoteNode(targetId);
  if (node) {
    node.title = title;
  }
  if (!state.activeProjectNoteId) {
    state.activeProjectNoteId = targetId;
  }
  renderProjectNotes();
  renderProjectNoteEditor();
  renderDocList();
  updateActionState();
  applyViewMode();
  await saveProjectMeta({ silent: true });
  await refreshBinderForNotes(targetId);
  setStatus('Note renamed.');
  return true;
}

export async function deleteProjectNote(noteId = state.activeProjectNoteId) {
  let targetId = String(noteId || '').trim();
  if (!targetId && state.selectedBinderNodeId && state.binder && state.binder.nodes) {
    const node = state.binder.nodes[state.selectedBinderNodeId];
    if (node && node.type === 'note' && node.noteId) {
      targetId = String(node.noteId).trim();
    }
  }
  if (!targetId) {
    return false;
  }
  if (!state.projectMeta || !Array.isArray(state.projectMeta.notes)) {
    try {
      state.projectMeta = normalizeProjectMeta(await window.api.readProjectMeta(state.projectPath));
    } catch (error) {
      setStatus(error.message || 'Unable to load project notes.', true);
      return false;
    }
  }
  const target = state.projectMeta.notes.find((note) => note.id === targetId);
  if (!target) {
    return false;
  }
  const label = String(target.title || 'Untitled').trim() || 'Untitled';
  const shouldDelete = window.confirm(`Delete note "${label}"?`);
  if (!shouldDelete) {
    return false;
  }

  state.projectMeta.notes = state.projectMeta.notes.filter((note) => note.id !== targetId);
  if (state.openProjectNoteId === targetId) {
    state.openProjectNoteId =
      state.projectMeta.notes.length > 0 ? state.projectMeta.notes[0].id : null;
  }
  if (state.activeProjectNoteId === targetId) {
    state.activeProjectNoteId =
      state.projectMeta.notes.length > 0 ? state.projectMeta.notes[0].id : null;
    if (!state.activeProjectNoteId) {
      state.viewMode = state.currentDocId ? 'editor' : 'editor';
    }
  }
  renderProjectNotes();
  renderProjectNoteEditor();
  applyViewMode();
  await saveProjectMeta({ silent: true });
  await refreshBinderForNotes(state.activeProjectNoteId);
  setStatus('Note deleted.');
  return true;
}

export async function convertProjectNoteToChapter(noteId = state.activeProjectNoteId) {
  const targetId = String(noteId || '').trim();
  if (!state.projectPath || !targetId || !state.projectMeta) {
    return false;
  }
  const target = state.projectMeta.notes.find((note) => note.id === targetId);
  if (!target) {
    return false;
  }

  const noteNode = findNoteNode(targetId);
  const parentId =
    noteNode &&
    noteNode.parentId &&
    state.binder.nodes[noteNode.parentId] &&
    state.binder.nodes[noteNode.parentId].type === 'folder'
      ? noteNode.parentId
      : null;

  let created = null;
  try {
    created = await window.api.createDoc(
      state.projectPath,
      String(target.title || '').trim() || 'New Chapter',
      parentId
    );
    if (!created || !created.id) {
      return false;
    }
    const raw = await window.api.readDoc(state.projectPath, created.id);
    const updated = normalizeDoc(raw);
    updated.text = String(target.content || '');
    updated.notes = '';
    await window.api.writeDoc(state.projectPath, created.id, updated, {
      forceHistory: true,
    });

    state.projectMeta.notes = state.projectMeta.notes.filter((note) => note.id !== targetId);
    await saveProjectMeta({ silent: true });
  } catch (error) {
    setStatus(error.message || 'Convert failed.', true);
    return false;
  }

  if (state.activeProjectNoteId === targetId) {
    state.activeProjectNoteId = null;
  }
  state.viewMode = 'editor';

  const { loadDoc, refreshDocStats, refreshDocs } = await import('./docs.js');
  await refreshDocs();
  await refreshDocStats();
  await loadProjectMeta();
  await loadDoc(created.id, { statusMessage: 'Converted to chapter.' });
  return true;
}
