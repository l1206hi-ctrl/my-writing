import { elements } from '../elements.js';
import { formatCountPair } from '../format.js';
import { findDocNodeId } from '../binder.js';
import { state } from '../state.js';
import { getCountsForDoc } from './counts.js';
import { updateCurrentDocLabel } from './layout.js';
import { renderMobilePreview } from './mobile.js';

function getDocMap() {
  return new Map(state.docs.map((doc) => [doc.id, doc]));
}

function appendFolderRow(item, node, depth, rowIndex) {
  const row = document.createElement('div');
  row.className = 'item-row folder-row';
  row.dataset.type = 'folder';
  row.dataset.nodeId = node.id;
  row.dataset.parentId = node.parentId || '';
  row.style.setProperty('--depth', depth);
  row.style.setProperty('--i', rowIndex);
  row.setAttribute('draggable', 'true');
  if (state.selectedBinderNodeId === node.id && !state.selectedDocId) {
    row.classList.add('active');
  }

  const isCollapsed = state.collapsedFolderIds.has(node.id);
  row.classList.toggle('collapsed', isCollapsed);
  const toggle = document.createElement('button');
  toggle.type = 'button';
  toggle.className = 'item-toggle';
  toggle.dataset.action = 'toggle-folder';
  toggle.dataset.nodeId = node.id;
  toggle.setAttribute('aria-label', isCollapsed ? 'Expand folder' : 'Collapse folder');
  toggle.textContent = '>';
  row.appendChild(toggle);

  const name = document.createElement('span');
  name.className = 'item-name';
  name.textContent = node.title || 'Untitled Folder';
  row.appendChild(name);

  const status = document.createElement('span');
  status.className = 'item-status';
  status.textContent = 'folder';
  row.appendChild(status);

  item.appendChild(row);
}

function appendDocRow(item, doc, docNodeId, depth, rowIndex) {
  const row = document.createElement('div');
  row.className = 'item-row';
  row.style.setProperty('--i', rowIndex);
  row.style.setProperty('--depth', depth);
  row.dataset.type = 'doc';
  row.dataset.id = doc.id;
  row.dataset.nodeId = docNodeId || '';
  const binderNode = docNodeId ? state.binder.nodes[docNodeId] : null;
  row.dataset.parentId = binderNode && binderNode.parentId ? binderNode.parentId : '';
  row.dataset.title = doc.title || '';
  row.setAttribute('draggable', 'true');
  row.classList.toggle('pinned', Boolean(doc.pinned));

  if (state.viewMode !== 'project-note') {
    if (state.selectedDocId === doc.id || state.currentDocId === doc.id) {
      row.classList.add('active');
    }
  }

  const name = document.createElement('span');
  name.className = 'item-name';
  name.textContent = doc.title || 'Untitled Chapter';
  row.appendChild(name);

  const pinToggle = document.createElement('button');
  pinToggle.type = 'button';
  pinToggle.className = 'item-pin-toggle';
  pinToggle.dataset.action = 'toggle-pin';
  pinToggle.dataset.docId = doc.id;
  pinToggle.textContent = doc.pinned ? 'Pinned' : 'Pin';
  pinToggle.setAttribute('aria-label', doc.pinned ? 'Unpin chapter' : 'Pin chapter');
  row.appendChild(pinToggle);

  const status = document.createElement('span');
  status.className = 'item-status';
  status.textContent = doc.status || 'draft';
  row.appendChild(status);

  const counts = getCountsForDoc(doc.id);
  if (counts) {
    const badge = document.createElement('span');
    badge.className = 'item-counts';
    badge.textContent = formatCountPair(counts);
    row.appendChild(badge);
  }

  item.appendChild(row);
}

function appendNoteRow(item, node, depth, rowIndex) {
  const row = document.createElement('div');
  row.className = 'item-row note-row';
  row.style.setProperty('--i', rowIndex);
  row.style.setProperty('--depth', depth);
  row.dataset.type = 'note';
  row.dataset.nodeId = node.id;
  row.dataset.noteId = node.noteId || '';
  row.dataset.parentId = node.parentId || '';
  row.dataset.title = node.title || '';
  row.setAttribute('draggable', 'true');
  row.classList.toggle('pinned', Boolean(node.pinned));

  if (state.viewMode === 'project-note' && state.activeProjectNoteId === node.noteId) {
    row.classList.add('active');
  }
  if (state.selectedBinderNodeId === node.id && state.viewMode !== 'project-note') {
    row.classList.add('active');
  }

  const name = document.createElement('span');
  name.className = 'item-name';
  name.textContent = node.title || 'Untitled Note';
  row.appendChild(name);

  const pinToggle = document.createElement('button');
  pinToggle.type = 'button';
  pinToggle.className = 'item-pin-toggle';
  pinToggle.dataset.action = 'toggle-pin';
  pinToggle.dataset.noteId = node.noteId || '';
  pinToggle.textContent = node.pinned ? 'Pinned' : 'Pin';
  pinToggle.setAttribute('aria-label', node.pinned ? 'Unpin note' : 'Pin note');
  row.appendChild(pinToggle);

  const status = document.createElement('span');
  status.className = 'item-status';
  status.textContent = 'note';
  row.appendChild(status);

  item.appendChild(row);
}

function appendRootDropZone(position) {
  const item = document.createElement('li');
  item.className = 'file-item root-drop-zone';
  item.dataset.rootPosition = position;
  item.setAttribute('aria-hidden', 'true');
  item.textContent =
    position === 'top' ? 'Drop here to move to top level (first)' : 'Drop here to move to top level (last)';
  return item;
}

function renderFilteredDocList(query) {
  const results = [];
  const docsById = getDocMap();

  const visitNode = (nodeId, depth = 0) => {
    if (!nodeId || !state.binder || !state.binder.nodes) {
      return;
    }
    const node = state.binder.nodes[nodeId];
    if (!node) {
      return;
    }
    if (node.type === 'folder') {
      const title = String(node.title || '').toLowerCase();
      if (title.includes(query)) {
        results.push({ type: 'folder', node, depth });
      }
      const children = Array.isArray(node.children) ? node.children : [];
      children.forEach((childId) => visitNode(childId, depth + 1));
      return;
    }
    if (node.type === 'doc') {
      const doc = docsById.get(node.docId);
      if (!doc) {
        return;
      }
      const title = String(doc.title || '').toLowerCase();
      const synopsis = String(doc.synopsis || '').toLowerCase();
      const pov = String(doc.pov || '').toLowerCase();
      if (title.includes(query) || synopsis.includes(query) || pov.includes(query)) {
        results.push({ type: 'doc', doc, nodeId: node.id, depth });
      }
      return;
    }
    if (node.type === 'note') {
      const title = String(node.title || '').toLowerCase();
      if (title.includes(query)) {
        results.push({ type: 'note', node, depth });
      }
    }
  };

  (Array.isArray(state.binder && state.binder.rootIds) ? state.binder.rootIds : []).forEach(
    (rootId) => visitNode(rootId, 0)
  );

  if (!results.length) {
    const empty = document.createElement('li');
    empty.className = 'file-item empty';
    empty.textContent = 'No matching items';
    elements.fileList.appendChild(empty);
    return;
  }

  let rowIndex = 0;
  results.forEach((entry) => {
    const item = document.createElement('li');
    item.className = 'file-item';
    if (entry.type === 'folder') {
      appendFolderRow(item, entry.node, entry.depth || 0, rowIndex);
    } else if (entry.type === 'doc') {
      appendDocRow(
        item,
        entry.doc,
        entry.nodeId || findDocNodeId(entry.doc.id),
        entry.depth || 0,
        rowIndex
      );
    } else {
      appendNoteRow(item, entry.node, entry.depth || 0, rowIndex);
    }
    rowIndex += 1;
    elements.fileList.appendChild(item);
  });
}

function docMatchesQuery(doc, query) {
  if (!query) {
    return true;
  }
  const title = String(doc.title || '').toLowerCase();
  const synopsis = String(doc.synopsis || '').toLowerCase();
  const pov = String(doc.pov || '').toLowerCase();
  return title.includes(query) || synopsis.includes(query) || pov.includes(query);
}

function noteMatchesQuery(node, query) {
  if (!query) {
    return true;
  }
  const title = String(node.title || '').toLowerCase();
  return title.includes(query);
}

function collectPinnedRows(query) {
  const rows = [];
  const visited = new Set();
  const docMap = getDocMap();
  const visitNode = (nodeId) => {
    if (!nodeId || visited.has(nodeId)) {
      return;
    }
    visited.add(nodeId);
    const node = state.binder.nodes[nodeId];
    if (!node) {
      return;
    }
    if (node.type === 'folder') {
      node.children.forEach((childId) => visitNode(childId));
      return;
    }
    if (node.type === 'doc') {
      const doc = docMap.get(node.docId);
      if (!doc || !doc.pinned || !docMatchesQuery(doc, query)) {
        return;
      }
      rows.push({ type: 'doc', doc, nodeId: node.id });
      return;
    }
    if (node.type === 'note') {
      if (!node.pinned || !noteMatchesQuery(node, query)) {
        return;
      }
      rows.push({ type: 'note', node });
    }
  };
  state.binder.rootIds.forEach((nodeId) => visitNode(nodeId));
  return rows;
}

function renderPinnedBinderList(query) {
  const rows = collectPinnedRows(query);
  if (!rows.length) {
    const empty = document.createElement('li');
    empty.className = 'file-item empty';
    empty.textContent = 'No pinned items';
    elements.fileList.appendChild(empty);
    return;
  }
  rows.forEach((entry, index) => {
    const item = document.createElement('li');
    item.className = 'file-item';
    if (entry.type === 'doc') {
      appendDocRow(item, entry.doc, entry.nodeId, 0, index);
    } else {
      appendNoteRow(item, entry.node, 0, index);
    }
    elements.fileList.appendChild(item);
  });
}

function renderBinderNode(nodeId, depth, rowCounter, docMap) {
  const node = state.binder.nodes[nodeId];
  if (!node) {
    return null;
  }
  const item = document.createElement('li');
  item.className = 'file-item';
  item.dataset.nodeType = node.type || '';

  if (node.type === 'folder') {
    appendFolderRow(item, node, depth, rowCounter.value);
    rowCounter.value += 1;
    const children = document.createElement('ul');
    children.className = 'file-children';
    const isCollapsed = state.collapsedFolderIds.has(node.id);
    const hasChildFolder = node.children.some((childId) => {
      const childNode = state.binder.nodes[childId];
      return childNode && childNode.type === 'folder';
    });
    item.classList.toggle('folders-only', isCollapsed && hasChildFolder);
    item.classList.toggle('closed', isCollapsed && !hasChildFolder);
    node.children.forEach((childId) => {
      const child = renderBinderNode(childId, depth + 1, rowCounter, docMap);
      if (child) {
        children.appendChild(child);
      }
    });
    item.appendChild(children);
    return item;
  }

  if (node.type === 'doc') {
    const doc = docMap.get(node.docId);
    if (!doc) {
      return null;
    }
    appendDocRow(item, doc, node.id, depth, rowCounter.value);
    rowCounter.value += 1;
    return item;
  }

  if (node.type === 'note') {
    appendNoteRow(item, node, depth, rowCounter.value);
    rowCounter.value += 1;
    return item;
  }

  return null;
}

export function applyDocToUI(doc) {
  elements.docTitle.value = doc.title;
  elements.docSynopsis.value = doc.synopsis;
  elements.docStatus.value = doc.status;
  elements.docPov.value = doc.pov;
  elements.editorText.value = doc.text;
  elements.editorNotes.value = doc.notes;
  renderMobilePreview();
}

export function clearDocUI() {
  elements.docTitle.value = '';
  elements.docSynopsis.value = '';
  elements.docStatus.value = 'draft';
  elements.docPov.value = '';
  elements.editorText.value = '';
  elements.editorNotes.value = '';
  renderMobilePreview();
}

export function updateDocSummaryFromCurrent() {
  if (!state.currentDocId || !state.currentDoc) {
    return;
  }
  const entry = state.docs.find((doc) => doc.id === state.currentDocId);
  if (entry) {
    entry.title = state.currentDoc.title;
    entry.synopsis = state.currentDoc.synopsis;
    entry.status = state.currentDoc.status;
    entry.pinned = Boolean(state.currentDoc.pinned);
    entry.pov = state.currentDoc.pov;
    entry.text = state.currentDoc.text;
  }
  const nodeId = findDocNodeId(state.currentDocId);
  if (nodeId && state.binder.nodes[nodeId]) {
    state.binder.nodes[nodeId].title = state.currentDoc.title;
    state.binder.nodes[nodeId].synopsis = state.currentDoc.synopsis;
    state.binder.nodes[nodeId].status = state.currentDoc.status;
    state.binder.nodes[nodeId].pinned = Boolean(state.currentDoc.pinned);
    state.binder.nodes[nodeId].pov = state.currentDoc.pov;
  }
  updateCurrentDocLabel();
  renderDocList();
  renderBoard();
}

function getNodeDepth(nodeId) {
  const targetId = String(nodeId || '').trim();
  if (!targetId || !state.binder || !state.binder.nodes) {
    return 0;
  }
  let depth = 0;
  let cursor = state.binder.nodes[targetId];
  let guard = 0;
  while (cursor && cursor.parentId && guard < 200) {
    const parent = state.binder.nodes[cursor.parentId];
    if (!parent) {
      break;
    }
    depth += 1;
    cursor = parent;
    guard += 1;
  }
  return depth;
}

function getTrailingFolderOwnerId(folderId) {
  const startId = String(folderId || '').trim();
  if (!startId || !state.binder || !state.binder.nodes || !state.binder.nodes[startId]) {
    return null;
  }
  let current = state.binder.nodes[startId];
  let guard = 0;
  while (current && current.type === 'folder' && guard < 200) {
    const children = Array.isArray(current.children) ? current.children : [];
    const folderChildren = children.filter((childId) => {
      const child = state.binder.nodes[childId];
      return child && child.type === 'folder';
    });
    if (!folderChildren.length) {
      return current.id;
    }
    const nextId = folderChildren[folderChildren.length - 1];
    const next = state.binder.nodes[nextId];
    if (!next || next.id === current.id) {
      return current.id;
    }
    current = next;
    guard += 1;
  }
  return startId;
}

export function renderDocList() {
  elements.fileList.innerHTML = '';
  const query = String(state.chapterFilterQuery || '').trim().toLowerCase();
  if (state.binderPinnedOnly) {
    renderPinnedBinderList(query);
    return;
  }
  if (query) {
    renderFilteredDocList(query);
    return;
  }

  const hasBinder = state.binder && Array.isArray(state.binder.rootIds);
  if (!hasBinder || !state.binder.rootIds.length) {
    const empty = document.createElement('li');
    empty.className = 'file-item empty';
    empty.textContent = 'No items yet';
    elements.fileList.appendChild(empty);
    return;
  }

  const docMap = getDocMap();
  const rowCounter = { value: 0 };
  elements.fileList.appendChild(appendRootDropZone('top'));
  const rootIds = Array.isArray(state.binder.rootIds) ? state.binder.rootIds.slice() : [];
  let compatibilityOwnerId = null;
  for (let index = 0; index < rootIds.length; index += 1) {
    const nodeId = rootIds[index];
    const rootNode = state.binder.nodes[nodeId];
    if (!rootNode) {
      continue;
    }

    if (rootNode.type === 'folder') {
      const nodeElement = renderBinderNode(nodeId, 0, rowCounter, docMap);
      if (nodeElement) {
        elements.fileList.appendChild(nodeElement);
      }
      compatibilityOwnerId = getTrailingFolderOwnerId(rootNode.id);
      continue;
    }

    let fallbackDepth = 0;
    if (compatibilityOwnerId && state.binder.nodes[compatibilityOwnerId]) {
      if (state.collapsedFolderIds.has(compatibilityOwnerId)) {
        continue;
      }
      fallbackDepth = getNodeDepth(compatibilityOwnerId) + 1;
    }

    const item = document.createElement('li');
    item.className = 'file-item';
    item.dataset.nodeType = rootNode.type;
    if (rootNode.type === 'doc') {
      const doc = docMap.get(rootNode.docId);
      if (!doc) {
        continue;
      }
      appendDocRow(item, doc, rootNode.id, fallbackDepth, rowCounter.value);
      rowCounter.value += 1;
      elements.fileList.appendChild(item);
      continue;
    }
    if (rootNode.type === 'note') {
      appendNoteRow(item, rootNode, fallbackDepth, rowCounter.value);
      rowCounter.value += 1;
      elements.fileList.appendChild(item);
    }
  }
  elements.fileList.appendChild(appendRootDropZone('bottom'));

  if (!elements.fileList.children.length) {
    const empty = document.createElement('li');
    empty.className = 'file-item empty';
    empty.textContent = 'No items yet';
    elements.fileList.appendChild(empty);
  }
}

function getBoardPreview(doc) {
  const synopsis = String(doc && doc.synopsis ? doc.synopsis : '').trim();
  if (synopsis) {
    return { text: synopsis, source: 'synopsis' };
  }
  const text = String(doc && doc.text ? doc.text : '')
    .replace(/\s+/g, ' ')
    .trim();
  if (text) {
    const short = text.slice(0, 140);
    return {
      text: short.length < text.length ? `${short}...` : short,
      source: 'draft',
    };
  }
  return { text: 'No synopsis yet.', source: 'empty' };
}

function getBoardDocs() {
  const query = String(state.boardQuery || '').trim().toLowerCase();
  const statusFilter = String(state.boardStatusFilter || 'all').toLowerCase();
  const missingSynopsisOnly = Boolean(state.boardMissingSynopsisOnly);
  const order = Array.isArray(state.binder && state.binder.order)
    ? state.binder.order
    : state.docs.map((doc) => doc.id);
  const orderMap = new Map(order.map((id, index) => [id, index]));
  return state.docs
    .filter((doc) => {
      const title = String(doc.title || '').toLowerCase();
      const synopsis = String(doc.synopsis || '').toLowerCase();
      const pov = String(doc.pov || '').toLowerCase();
      const draft = String(doc.text || '').toLowerCase();
      const hasSynopsis = Boolean(String(doc.synopsis || '').trim());
      if (statusFilter !== 'all' && String(doc.status || 'draft').toLowerCase() !== statusFilter) {
        return false;
      }
      if (missingSynopsisOnly && hasSynopsis) {
        return false;
      }
      if (!query) {
        return true;
      }
      return (
        title.includes(query) ||
        synopsis.includes(query) ||
        pov.includes(query) ||
        draft.includes(query)
      );
    })
    .sort((a, b) => {
      const pinnedDelta = Number(Boolean(b.pinned)) - Number(Boolean(a.pinned));
      if (pinnedDelta !== 0) {
        return pinnedDelta;
      }
      return (orderMap.get(a.id) ?? Number.MAX_SAFE_INTEGER) -
        (orderMap.get(b.id) ?? Number.MAX_SAFE_INTEGER);
    });
}

function updateBoardSummary(visibleDocs, hasFilters) {
  if (!elements.boardSummary) {
    return;
  }
  const total = state.docs.length;
  const pinned = state.docs.filter((doc) => Boolean(doc.pinned)).length;
  const done = state.docs.filter((doc) => String(doc.status || 'draft') === 'done').length;
  const missing = state.docs.filter((doc) => !String(doc.synopsis || '').trim()).length;
  let summary = `Showing ${visibleDocs.length}/${total} chapters | Pinned ${pinned} | Done ${done} | Missing synopsis ${missing}`;
  if (hasFilters) {
    summary += ' | Reorder locked';
  }
  elements.boardSummary.textContent = summary;
}

export function renderBoard() {
  elements.boardGrid.innerHTML = '';
  const filteredDocs = getBoardDocs();
  const hasFilters =
    Boolean(String(state.boardQuery || '').trim()) ||
    String(state.boardStatusFilter || 'all') !== 'all' ||
    Boolean(state.boardMissingSynopsisOnly);
  if (elements.boardSearchInput && elements.boardSearchInput.value !== state.boardQuery) {
    elements.boardSearchInput.value = state.boardQuery;
  }
  if (elements.boardStatusFilter && elements.boardStatusFilter.value !== state.boardStatusFilter) {
    elements.boardStatusFilter.value = state.boardStatusFilter;
  }
  if (elements.boardMissingSynopsisOnly) {
    elements.boardMissingSynopsisOnly.checked = Boolean(state.boardMissingSynopsisOnly);
  }
  if (elements.btnBoardResetFilters) {
    elements.btnBoardResetFilters.disabled = !hasFilters;
  }
  updateBoardSummary(filteredDocs, hasFilters);

  if (!state.docs.length) {
    const empty = document.createElement('div');
    empty.className = 'file-item empty';
    empty.textContent = 'No chapters yet';
    elements.boardGrid.appendChild(empty);
    return;
  }

  if (!filteredDocs.length) {
    const empty = document.createElement('div');
    empty.className = 'file-item empty';
    empty.textContent = 'No matching chapters. Reset filters.';
    elements.boardGrid.appendChild(empty);
    return;
  }

  filteredDocs.forEach((doc) => {
    const card = document.createElement('div');
    card.className = 'board-card';
    card.classList.toggle('pinned', Boolean(doc.pinned));
    card.setAttribute('draggable', hasFilters ? 'false' : 'true');
    card.classList.toggle('reorder-locked', hasFilters);
    card.dataset.id = doc.id;
    const docNodeId = findDocNodeId(doc.id);
    const binderNode = docNodeId ? state.binder.nodes[docNodeId] : null;
    card.dataset.nodeId = docNodeId || '';
    card.dataset.parentId = binderNode && binderNode.parentId ? binderNode.parentId : '';

    const title = document.createElement('div');
    title.className = 'card-title';
    title.textContent = doc.title || 'Untitled Chapter';

    const synopsis = document.createElement('div');
    synopsis.className = 'card-synopsis';
    const preview = getBoardPreview(doc);
    synopsis.textContent = preview.text;
    if (preview.source === 'draft') {
      synopsis.classList.add('from-draft');
    }
    if (preview.source === 'empty') {
      synopsis.classList.add('is-empty');
    }

    const meta = document.createElement('div');
    meta.className = 'card-meta';

    const pinChip = document.createElement('button');
    pinChip.type = 'button';
    pinChip.className = `card-chip card-pin-toggle favorite${doc.pinned ? ' is-active' : ''}`;
    pinChip.dataset.action = 'toggle-pin';
    pinChip.dataset.docId = doc.id;
    pinChip.textContent = doc.pinned ? 'pinned' : 'pin';
    pinChip.setAttribute('aria-label', doc.pinned ? 'Unpin chapter' : 'Pin chapter');
    meta.appendChild(pinChip);

    const status = document.createElement('span');
    status.className = 'card-chip';
    status.textContent = doc.status || 'draft';
    meta.appendChild(status);

    if (doc.pov) {
      const pov = document.createElement('span');
      pov.className = 'card-chip';
      pov.textContent = doc.pov;
      meta.appendChild(pov);
    }
    const counts = getCountsForDoc(doc.id);
    if (counts) {
      const countChip = document.createElement('span');
      countChip.className = 'card-chip count';
      countChip.textContent = `chars ${formatCountPair(counts)}`;
      meta.appendChild(countChip);
    }
    if (!String(doc.synopsis || '').trim()) {
      const missingChip = document.createElement('span');
      missingChip.className = 'card-chip warning';
      missingChip.textContent = 'synopsis missing';
      meta.appendChild(missingChip);
    }

    card.appendChild(title);
    card.appendChild(synopsis);
    card.appendChild(meta);
    elements.boardGrid.appendChild(card);
  });
}
