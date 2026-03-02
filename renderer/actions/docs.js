import { AUTO_SAVE_DELAY } from '../constants.js';
import { findDocNodeId, findNoteNodeId } from '../binder.js';
import { elements } from '../elements.js';
import { requestText } from '../modal.js';
import { normalizeDoc, normalizeProjectMeta } from '../normalize.js';
import { resetProjectState, state } from '../state.js';
import {
  clearLastDoc,
  clearLastProject,
  loadLastDoc,
  loadLastProject,
  saveLastDoc,
  saveLastProject,
} from '../storage.js';
import {
  applyDocToUI,
  applyViewMode,
  clearDocUI,
  clearProjectMetaUI,
  refreshCurrentCounts,
  refreshSelectionCounts,
  renderBoard,
  renderGlobalSearchResults,
  renderHistoryList,
  renderDocList,
  setDirty,
  setStatus,
  updateActionState,
  updateCountDisplay,
  updateCurrentDocLabel,
  updateDocSummaryFromCurrent,
  updateProjectInfo,
  clearCharacterFormUI,
  renderMobilePreview,
  setMobilePreviewVisible,
} from '../ui.js';
import { refreshCharacters } from './characters.js';
import { loadProjectMeta } from './projectNotes.js';

let autoSaveTimer = null;
let saveQueue = Promise.resolve();

function queueSave(task) {
  saveQueue = saveQueue.then(() => task(), () => task());
  return saveQueue;
}

function buildFallbackBinder(docs) {
  const nodes = {};
  const rootIds = [];
  const order = [];
  docs.forEach((doc) => {
    if (!doc || !doc.id) {
      return;
    }
    const nodeId = doc.id;
    nodes[nodeId] = {
      id: nodeId,
      type: 'doc',
      docId: doc.id,
      parentId: null,
      title: doc.title || '',
      synopsis: doc.synopsis || '',
      status: doc.status || 'draft',
      pinned: Boolean(doc.pinned),
      pov: doc.pov || '',
    };
    rootIds.push(nodeId);
    order.push(doc.id);
  });
  return { rootIds, nodes, order };
}

function normalizeBinderPayload(payload, docs) {
  if (!payload || typeof payload !== 'object') {
    return buildFallbackBinder(docs);
  }
  const docMap = new Map(
    (Array.isArray(docs) ? docs : []).filter(Boolean).map((doc) => [doc.id, doc])
  );
  const nodes = {};
  const sourceNodes = payload.nodes && typeof payload.nodes === 'object' ? payload.nodes : {};

  Object.keys(sourceNodes).forEach((nodeId) => {
    const node = sourceNodes[nodeId];
    if (!node || typeof node !== 'object') {
      return;
    }
    if (node.type === 'folder') {
      nodes[nodeId] = {
        id: nodeId,
        type: 'folder',
        title: String(node.title || 'Folder'),
        parentId: typeof node.parentId === 'string' && node.parentId ? node.parentId : null,
        children: Array.isArray(node.children) ? node.children.filter(Boolean) : [],
      };
      return;
    }
    if (node.type === 'doc') {
      const docId = String(node.docId || '').trim();
      if (!docId || !docMap.has(docId)) {
        return;
      }
      const doc = docMap.get(docId);
      nodes[nodeId] = {
        id: nodeId,
        type: 'doc',
        docId,
        parentId: typeof node.parentId === 'string' && node.parentId ? node.parentId : null,
        title: doc.title || '',
        synopsis: doc.synopsis || '',
        status: doc.status || 'draft',
        pinned: Boolean(doc.pinned),
        pov: doc.pov || '',
      };
    }
    if (node.type === 'note') {
      const noteId = String(node.noteId || '').trim();
      if (!noteId) {
        return;
      }
      nodes[nodeId] = {
        id: nodeId,
        type: 'note',
        noteId,
        parentId: typeof node.parentId === 'string' && node.parentId ? node.parentId : null,
        title: String(node.title || 'Untitled Note'),
        pinned: Boolean(node.pinned),
      };
    }
  });

  const existingNodeIds = new Set(Object.keys(nodes));
  Object.values(nodes).forEach((node) => {
    if (node.type !== 'folder') {
      return;
    }
    node.children = node.children.filter((id) => existingNodeIds.has(id) && id !== node.id);
  });

  const rootIds = Array.isArray(payload.rootIds)
    ? payload.rootIds.filter((id) => existingNodeIds.has(id))
    : [];

  Object.values(nodes).forEach((node) => {
    if (!node.parentId || !nodes[node.parentId]) {
      node.parentId = null;
      if (!rootIds.includes(node.id)) {
        rootIds.push(node.id);
      }
    }
  });

  if (!rootIds.length && docMap.size) {
    return buildFallbackBinder(docs);
  }

  const order = Array.isArray(payload.order)
    ? payload.order.filter((docId) => docMap.has(docId))
    : [];
  docs.forEach((doc) => {
    if (doc && doc.id && !order.includes(doc.id)) {
      order.push(doc.id);
    }
  });

  return { rootIds, nodes, order };
}

function cleanupCollapsedFolders() {
  const next = new Set();
  state.collapsedFolderIds.forEach((folderId) => {
    const node = state.binder.nodes[folderId];
    if (node && node.type === 'folder') {
      next.add(folderId);
    }
  });
  state.collapsedFolderIds = next;
}

export { findNoteNodeId } from '../binder.js';

function expandAncestors(nodeId) {
  let cursorId = nodeId;
  let guard = 0;
  while (cursorId && guard < 200) {
    const node = state.binder.nodes[cursorId];
    if (!node || !node.parentId) {
      return;
    }
    state.collapsedFolderIds.delete(node.parentId);
    cursorId = node.parentId;
    guard += 1;
  }
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
    selectedNode.type === 'doc' &&
    selectedNode.parentId &&
    state.binder.nodes[selectedNode.parentId] &&
    state.binder.nodes[selectedNode.parentId].type === 'folder'
  ) {
    return selectedNode.parentId;
  }
  if (!state.selectedDocId) {
    return null;
  }
  const selectedDocNodeId = findDocNodeId(state.selectedDocId);
  if (!selectedDocNodeId) {
    return null;
  }
  const selectedDocNode = state.binder.nodes[selectedDocNodeId];
  if (!selectedDocNode || !selectedDocNode.parentId) {
    return null;
  }
  const parent = state.binder.nodes[selectedDocNode.parentId];
  return parent && parent.type === 'folder' ? parent.id : null;
}

function buildConvertedNoteContent(doc) {
  const text = String(doc.text || '').trim();
  const notes = String(doc.notes || '').trim();
  if (text && notes) {
    return `${text}\n\n---\n\n${notes}`;
  }
  if (text) {
    return text;
  }
  if (notes) {
    return notes;
  }
  return '';
}

function createUniqueNoteId(meta) {
  const existing = new Set(
    (meta && Array.isArray(meta.notes) ? meta.notes : [])
      .map((note) => String(note && note.id ? note.id : '').trim())
      .filter(Boolean)
  );
  let id = `note_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`;
  while (existing.has(id)) {
    id = `note_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`;
  }
  return id;
}

export function scheduleAutoSave() {
  if (!state.currentDocId) {
    return;
  }
  setDirty(true);
  if (autoSaveTimer) {
    clearTimeout(autoSaveTimer);
  }
  autoSaveTimer = setTimeout(() => {
    saveDoc({ silent: true });
  }, AUTO_SAVE_DELAY);
}

export async function saveDoc(options = {}) {
  if (!state.projectPath || !state.currentDocId || !state.currentDoc) {
    return false;
  }
  const docId = state.currentDocId;
  const projectPath = state.projectPath;
  const payload = normalizeDoc(state.currentDoc);
  const countsSnapshot = { ...state.currentCounts };
  return queueSave(async () => {
    try {
      const forceHistory = options.forceHistory ?? !options.silent;
      await window.api.writeDoc(projectPath, docId, payload, {
        forceHistory,
      });
      if (state.projectPath !== projectPath) {
        return true;
      }
      const previous = state.docStats.get(docId) || {
        withSpaces: 0,
        withoutSpaces: 0,
      };
      state.docStats.set(docId, { ...countsSnapshot });
      state.totalCounts.withSpaces += countsSnapshot.withSpaces - previous.withSpaces;
      state.totalCounts.withoutSpaces +=
        countsSnapshot.withoutSpaces - previous.withoutSpaces;
      if (state.currentDocId === docId) {
        setDirty(false);
      }
      updateCountDisplay();
      if (!options.silent && state.currentDocId === docId) {
        setStatus('Saved.');
      }
      return true;
    } catch (error) {
      if (state.currentDocId === docId) {
        setStatus(error.message || 'Save failed.', true);
      }
      return false;
    }
  });
}

export async function refreshDocs() {
  if (!state.projectPath) {
    return;
  }
  let docs = [];
  try {
    const nextDocs = await window.api.listDocs(state.projectPath);
    docs = Array.isArray(nextDocs) ? nextDocs : [];
  } catch (error) {
    state.docs = [];
    state.binder = { rootIds: [], nodes: {}, order: [] };
    state.selectedBinderNodeId = null;
    renderDocList();
    renderBoard();
    updateActionState();
    setStatus(error.message || 'Unable to read project index.', true);
    return;
  }

  state.docs = docs;
  try {
    const binder = await window.api.listBinder(state.projectPath);
    state.binder = normalizeBinderPayload(binder, state.docs);
  } catch (error) {
    state.binder = buildFallbackBinder(state.docs);
  }
  cleanupCollapsedFolders();

  if (state.selectedDocId) {
    const exists = state.docs.some((doc) => doc.id === state.selectedDocId);
    if (!exists) {
      state.selectedDocId = null;
    }
  }
  if (state.selectedBinderNodeId && !state.binder.nodes[state.selectedBinderNodeId]) {
    state.selectedBinderNodeId = null;
  }
  if (state.selectedDocId) {
    const selectedNodeId = findDocNodeId(state.selectedDocId);
    if (selectedNodeId) {
      state.selectedBinderNodeId = selectedNodeId;
    }
  }
  if (state.activeProjectNoteId) {
    const selectedNoteNodeId = findNoteNodeId(state.activeProjectNoteId);
    if (selectedNoteNodeId && state.binder.nodes[selectedNoteNodeId]) {
      state.selectedBinderNodeId = selectedNoteNodeId;
    }
  }
  renderDocList();
  renderBoard();
  updateActionState();
}

export async function refreshDocStats() {
  if (!state.projectPath) {
    return;
  }
  try {
    const stats = await window.api.projectStats(state.projectPath);
    state.totalCounts = stats && stats.totals ? stats.totals : { withSpaces: 0, withoutSpaces: 0 };
    const map = new Map();
    if (stats && Array.isArray(stats.perDoc)) {
      stats.perDoc.forEach((entry) => {
        if (entry && entry.id) {
          map.set(entry.id, {
            withSpaces: Number(entry.withSpaces) || 0,
            withoutSpaces: Number(entry.withoutSpaces) || 0,
          });
        }
      });
    }
    state.docStats = map;
    updateCountDisplay();
    renderDocList();
  } catch (error) {
    // Ignore stats errors.
  }
}

export async function applyProject(project, statusMessage) {
  if (!project) {
    return;
  }
  setMobilePreviewVisible(false);
  resetProjectState(project);
  elements.searchInput.value = '';
  if (elements.localFindInput) {
    elements.localFindInput.value = '';
  }
  if (elements.localFindOverlay) {
    elements.localFindOverlay.classList.add('hidden');
  }
  if (elements.globalSearchInput) {
    elements.globalSearchInput.value = '';
  }
  clearDocUI();
  clearProjectMetaUI();
  clearCharacterFormUI();
  setDirty(false);
  updateProjectInfo();
  updateCurrentDocLabel();
  renderGlobalSearchResults();
  renderHistoryList();
  await refreshDocs();
  await refreshDocStats();
  await loadProjectMeta();
  await refreshCharacters();
  saveLastProject(project.path);
  const restored = await restoreLastDocForProject();
  if (!restored && statusMessage) {
    setStatus(statusMessage);
  }
  applyViewMode();
}

export async function loadDoc(docId, options = {}) {
  if (!state.projectPath || !docId) {
    return false;
  }
  if (autoSaveTimer) {
    clearTimeout(autoSaveTimer);
    autoSaveTimer = null;
  }
  if (state.dirty) {
    const ok = await saveDoc({ silent: true });
    if (!ok) {
      return false;
    }
  }
  let doc = null;
  try {
    doc = await window.api.readDoc(state.projectPath, docId);
  } catch (error) {
    setStatus(error.message || 'Unable to load chapter.', true);
    return false;
  }
  if (!doc) {
    setStatus('Unable to load chapter.', true);
    return false;
  }
  state.currentDocId = docId;
  state.currentDoc = normalizeDoc(doc);
  state.selectedDocId = docId;
  state.selectedBinderNodeId = findDocNodeId(docId);
  if (state.selectedBinderNodeId) {
    expandAncestors(state.selectedBinderNodeId);
  }
  applyDocToUI(state.currentDoc);
  saveLastDoc(state.projectPath, docId);
  setDirty(false);
  refreshCurrentCounts();
  refreshSelectionCounts();
  updateCurrentDocLabel();
  renderDocList();
  renderBoard();
  applyViewMode();
  const statusMessage = options.statusMessage || 'Loaded.';
  setStatus(statusMessage);
  updateActionState();
  return true;
}

export function handleDocFieldChange(field, value) {
  if (!state.currentDoc) {
    return;
  }
  state.currentDoc[field] = value;
  if (field === 'text') {
    refreshCurrentCounts();
    refreshSelectionCounts();
  }
  updateDocSummaryFromCurrent();
  renderMobilePreview();
  scheduleAutoSave();
}

export async function createChapter() {
  if (!state.projectPath) {
    setStatus('Open or create a project first.', true);
    return;
  }
  const title = String(
    await requestText({
      title: 'Chapter title',
      placeholder: 'New Chapter',
      value: 'New Chapter',
      confirmLabel: 'Create',
    })
  ).trim();
  if (!title) {
    return;
  }
  try {
    const parentId = getPreferredParentFolderId();
    if (parentId) {
      state.collapsedFolderIds.delete(parentId);
    }
    const doc = await window.api.createDoc(state.projectPath, title, parentId);
    if (!doc) {
      return;
    }
    state.viewMode = 'editor';
    await refreshDocs();
    await refreshDocStats();
    await loadDoc(doc.id, { statusMessage: 'Chapter created.' });
  } catch (error) {
    setStatus(error.message || 'Unable to create chapter.', true);
  }
}

export async function createFolder() {
  if (!state.projectPath) {
    setStatus('Open or create a project first.', true);
    return;
  }
  const title = String(
    await requestText({
      title: 'Folder title',
      placeholder: 'New Folder',
      value: 'New Folder',
      confirmLabel: 'Create',
    })
  ).trim();
  if (!title) {
    return;
  }
  try {
    const parentId = getPreferredParentFolderId();
    if (parentId) {
      state.collapsedFolderIds.delete(parentId);
    }
    const folder = await window.api.createFolder(state.projectPath, title, parentId);
    if (!folder) {
      return;
    }
    await refreshDocs();
    state.selectedDocId = null;
    state.selectedBinderNodeId = folder.id || null;
    state.activeProjectNoteId = null;
    if (state.selectedBinderNodeId) {
      state.collapsedFolderIds.delete(state.selectedBinderNodeId);
    }
    renderDocList();
    updateActionState();
    setStatus('Folder created.');
  } catch (error) {
    setStatus(error.message || 'Unable to create folder.', true);
  }
}

export function toggleFolderCollapsed(nodeId) {
  const targetId = String(nodeId || '').trim();
  if (!targetId) {
    return;
  }
  const node = state.binder && state.binder.nodes ? state.binder.nodes[targetId] : null;
  if (!node || node.type !== 'folder') {
    return;
  }
  if (state.collapsedFolderIds.has(targetId)) {
    state.collapsedFolderIds.delete(targetId);
  } else {
    state.collapsedFolderIds.add(targetId);
  }
  renderDocList();
}

export async function moveBinderNode(nodeId, parentId = null, targetIndex = null, options = {}) {
  if (!state.projectPath || !nodeId) {
    return false;
  }
  try {
    const moved = await window.api.moveBinderNode(
      state.projectPath,
      nodeId,
      parentId,
      targetIndex
    );
    if (!moved) {
      return false;
    }
    await refreshDocs();
    if (!options.silent) {
      setStatus('Moved.');
    }
    return true;
  } catch (error) {
    setStatus(error.message || 'Move failed.', true);
    return false;
  }
}

export async function convertDocToProjectNote(docId = state.selectedDocId) {
  const targetDocId = String(docId || '').trim();
  if (!state.projectPath || !targetDocId) {
    return false;
  }
  if (state.currentDocId === targetDocId && state.dirty) {
    const ok = await saveDoc({ silent: true });
    if (!ok) {
      return false;
    }
  }
  let rawDoc = null;
  try {
    rawDoc = await window.api.readDoc(state.projectPath, targetDocId);
  } catch (error) {
    setStatus(error.message || 'Unable to read chapter.', true);
    return false;
  }
  if (!rawDoc) {
    setStatus('Unable to read chapter.', true);
    return false;
  }
  const doc = normalizeDoc(rawDoc);
  const noteTitle = String(doc.title || '').trim() || 'Untitled Note';

  let meta = null;
  try {
    meta = normalizeProjectMeta(await window.api.readProjectMeta(state.projectPath));
  } catch (error) {
    meta = normalizeProjectMeta();
  }
  const noteId = createUniqueNoteId(meta);
  meta.notes.push({
    id: noteId,
    title: noteTitle,
    content: buildConvertedNoteContent(doc),
  });

  try {
    await window.api.writeProjectMeta(state.projectPath, meta);
    await window.api.deleteDoc(state.projectPath, targetDocId);
  } catch (error) {
    setStatus(error.message || 'Convert failed.', true);
    return false;
  }

  if (state.currentDocId === targetDocId) {
    state.currentDocId = null;
    state.currentDoc = null;
    clearLastDoc(state.projectPath);
    clearDocUI();
    setDirty(false);
    refreshCurrentCounts();
    refreshSelectionCounts();
  }

  state.selectedDocId = null;
  state.activeProjectNoteId = noteId;
  state.viewMode = 'project-note';

  await refreshDocs();
  await refreshDocStats();
  await loadProjectMeta();
  state.selectedBinderNodeId = findNoteNodeId(noteId);
  renderDocList();
  renderBoard();
  applyViewMode();
  updateCurrentDocLabel();
  updateActionState();
  setStatus('Converted to note.');
  return true;
}

export async function renameFolder(folderId = state.selectedBinderNodeId) {
  const targetId = String(folderId || '').trim();
  if (!state.projectPath || !targetId) {
    return;
  }
  const folder =
    state.binder && state.binder.nodes ? state.binder.nodes[targetId] : null;
  if (!folder || folder.type !== 'folder') {
    return;
  }
  const currentTitle = String(folder.title || '');
  const input = await requestText({
    title: 'Rename folder',
    placeholder: currentTitle || 'Folder',
    value: currentTitle || '',
    confirmLabel: 'Rename',
  });
  if (!input) {
    return;
  }
  const trimmed = input.trim();
  if (!trimmed || trimmed === currentTitle) {
    return;
  }
  try {
    await window.api.renameFolder(state.projectPath, targetId, trimmed);
    await refreshDocs();
    setStatus('Folder renamed.');
  } catch (error) {
    setStatus(error.message || 'Rename failed.', true);
  }
}

export async function deleteFolder(folderId = state.selectedBinderNodeId) {
  const targetId = String(folderId || '').trim();
  if (!state.projectPath || !targetId) {
    return;
  }
  const folder =
    state.binder && state.binder.nodes ? state.binder.nodes[targetId] : null;
  if (!folder || folder.type !== 'folder') {
    return;
  }
  const confirmDelete = window.confirm(
    'Delete this folder? Items inside will move up one level.'
  );
  if (!confirmDelete) {
    return;
  }
  try {
    const parentId = String(folder.parentId || '').trim() || null;
    await window.api.deleteFolder(state.projectPath, targetId);
    if (state.selectedBinderNodeId === targetId) {
      state.selectedBinderNodeId = parentId;
      state.selectedDocId = null;
      state.activeProjectNoteId = null;
      state.viewMode = 'editor';
      updateActionState();
      applyViewMode();
    }
    await refreshDocs();
    setStatus('Folder deleted.');
  } catch (error) {
    setStatus(error.message || 'Delete failed.', true);
  }
}

export async function renameSelectedDoc() {
  if (!state.projectPath || !state.selectedDocId) {
    return;
  }
  const selected = state.docs.find((doc) => doc.id === state.selectedDocId);
  const currentTitle = selected ? selected.title : '';
  const input = await requestText({
    title: 'Rename chapter',
    placeholder: currentTitle || 'Untitled Chapter',
    value: currentTitle || '',
    confirmLabel: 'Rename',
  });
  if (!input) {
    return;
  }
  const trimmed = input.trim();
  if (!trimmed || trimmed === currentTitle) {
    return;
  }
  try {
    if (state.currentDocId === state.selectedDocId && state.currentDoc) {
      state.currentDoc.title = trimmed;
      elements.docTitle.value = trimmed;
      updateDocSummaryFromCurrent();
      await saveDoc({ silent: true });
    } else {
      const doc = await window.api.readDoc(state.projectPath, state.selectedDocId);
      if (!doc) {
        return;
      }
      const updated = normalizeDoc(doc);
      updated.title = trimmed;
      await window.api.writeDoc(state.projectPath, state.selectedDocId, updated, {
        forceHistory: true,
      });
    }
    await refreshDocs();
    renderBoard();
    setStatus('Renamed.');
  } catch (error) {
    setStatus(error.message || 'Rename failed.', true);
  }
}

export async function deleteSelectedDoc() {
  if (!state.projectPath || !state.selectedDocId) {
    return;
  }
  const confirmDelete = window.confirm('Delete this chapter?');
  if (!confirmDelete) {
    return;
  }
  try {
    await window.api.deleteDoc(state.projectPath, state.selectedDocId);
    if (state.currentDocId === state.selectedDocId) {
      state.currentDocId = null;
      state.currentDoc = null;
      clearLastDoc(state.projectPath);
      clearDocUI();
      refreshCurrentCounts();
      refreshSelectionCounts();
    }
    if (
      state.selectedBinderNodeId &&
      state.binder.nodes[state.selectedBinderNodeId] &&
      state.binder.nodes[state.selectedBinderNodeId].type === 'doc' &&
      state.binder.nodes[state.selectedBinderNodeId].docId === state.selectedDocId
    ) {
      state.selectedBinderNodeId = null;
    }
    state.selectedDocId = null;
    await refreshDocs();
    await refreshDocStats();
    updateCurrentDocLabel();
    applyViewMode();
    setStatus('Deleted.');
  } catch (error) {
    setStatus(error.message || 'Delete failed.', true);
  }
}

export function toggleBoardMode() {
  state.viewMode = state.viewMode === 'board' ? 'editor' : 'board';
  applyViewMode();
  if (state.viewMode === 'board') {
    renderBoard();
  }
}

export function toggleBinderPinnedOnly(force) {
  const next = typeof force === 'boolean' ? force : !state.binderPinnedOnly;
  state.binderPinnedOnly = next;
  renderDocList();
  updateActionState();
  applyViewMode();
}

export async function toggleDocPinned(docId = state.currentDocId || state.selectedDocId) {
  const targetDocId = String(docId || '').trim();
  if (!state.projectPath || !targetDocId) {
    return false;
  }

  const listEntry = state.docs.find((doc) => doc.id === targetDocId);
  const currentPinned =
    state.currentDocId === targetDocId && state.currentDoc
      ? Boolean(state.currentDoc.pinned)
      : Boolean(listEntry && listEntry.pinned);
  const nextPinned = !currentPinned;

  try {
    if (state.currentDocId === targetDocId && state.currentDoc) {
      state.currentDoc.pinned = nextPinned;
      updateDocSummaryFromCurrent();
      await saveDoc({ silent: true });
      updateActionState();
      applyViewMode();
    } else {
      const doc = await window.api.readDoc(state.projectPath, targetDocId);
      if (!doc) {
        setStatus('Unable to load chapter.', true);
        return false;
      }
      const updated = normalizeDoc(doc);
      updated.pinned = nextPinned;
      await window.api.writeDoc(state.projectPath, targetDocId, updated, {
        forceHistory: false,
      });
      await refreshDocs();
    }
    setStatus(nextPinned ? 'Pinned chapter.' : 'Unpinned chapter.');
    return true;
  } catch (error) {
    setStatus(error.message || 'Unable to update pin.', true);
    return false;
  }
}

export function toggleFocusMode(force) {
  const next = typeof force === 'boolean' ? force : !state.focusMode;
  if (next && !state.projectPath) {
    setStatus('Open or create a project first.', true);
    return;
  }
  state.focusMode = next;
  applyViewMode();
  updateActionState();
  setStatus(next ? 'Focus mode on.' : 'Focus mode off.');
}

export function toggleMobilePreview(force) {
  if (!state.projectPath) {
    setStatus('Open or create a project first.', true);
    return;
  }
  const target = typeof force === 'boolean' ? force : !state.mobilePreviewOpen;
  setMobilePreviewVisible(target);
  if (target) {
    renderMobilePreview();
  }
}

export async function exportProject(format = 'doc') {
  if (!state.projectPath) {
    setStatus('Open or create a project first.', true);
    return;
  }
  let statusLabel = 'export';
  if (format === 'pdf') {
    statusLabel = 'PDF export';
  }
  setStatus(`${statusLabel.charAt(0).toUpperCase() + statusLabel.slice(1)} running...`);
  try {
    const result = await window.api.exportProject(state.projectPath, format);
    if (!result) {
      setStatus('Export cancelled.');
      return;
    }
    setStatus('Export saved.');
  } catch (error) {
    setStatus(error.message || 'Export failed.', true);
  }
}

export async function restoreLastDocForProject() {
  if (!state.projectPath) {
    return false;
  }
  const lastDoc = loadLastDoc(state.projectPath);
  if (!lastDoc) {
    return false;
  }
  const exists = state.docs.some((doc) => doc.id === lastDoc);
  if (!exists) {
    clearLastDoc(state.projectPath);
    return false;
  }
  const loaded = await loadDoc(lastDoc, { statusMessage: 'Last chapter restored.' });
  return Boolean(loaded);
}

export async function restoreLastProject() {
  if (state.projectPath) {
    return;
  }
  const lastPath = loadLastProject();
  if (!lastPath) {
    return;
  }
  try {
    const project = await window.api.openProjectFromPath(lastPath);
    if (!project) {
      clearLastProject();
      return;
    }
    await applyProject(project, 'Project restored.');
  } catch (error) {
    clearLastProject();
  }
}
