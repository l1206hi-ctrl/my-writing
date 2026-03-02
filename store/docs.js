const fs = require('fs');
const path = require('path');
const { getStoreDir } = require('./paths');
const { normalizeDoc, countCharacters } = require('./normalize');
const { readIndex, writeIndex, readDocFile, writeDocFile, readProject } = require('./io');
const { maybeSaveHistorySnapshot } = require('./history');

function generateId(prefix = 'id') {
  const stamp = Date.now().toString(36);
  const rand = Math.random().toString(36).slice(2, 6);
  return `${prefix}_${stamp}_${rand}`;
}

function createUniqueNodeId(index, preferredId, prefix = 'node') {
  const usedIds = new Set(Object.keys(index.nodes || {}));
  let base = String(preferredId || '').trim();
  if (!base) {
    base = generateId(prefix);
  }
  if (!usedIds.has(base)) {
    return base;
  }
  let attempt = 1;
  let candidate = `${base}_${attempt}`;
  while (usedIds.has(candidate)) {
    attempt += 1;
    candidate = `${base}_${attempt}`;
  }
  return candidate;
}

function isFolder(index, nodeId) {
  if (!nodeId || !index.nodes || !index.nodes[nodeId]) {
    return false;
  }
  return index.nodes[nodeId].type === 'folder';
}

function removeNodeReference(index, nodeId) {
  if (!index || !nodeId) {
    return;
  }
  if (Array.isArray(index.rootIds)) {
    index.rootIds = index.rootIds.filter((id) => id !== nodeId);
  }
  Object.values(index.nodes || {}).forEach((node) => {
    if (!node || node.type !== 'folder' || !Array.isArray(node.children)) {
      return;
    }
    node.children = node.children.filter((id) => id !== nodeId);
  });
}

function attachNode(index, nodeId, parentId) {
  const node = index.nodes[nodeId];
  if (!node) {
    return;
  }
  if (isFolder(index, parentId)) {
    const parent = index.nodes[parentId];
    if (!Array.isArray(parent.children)) {
      parent.children = [];
    }
    parent.children.push(nodeId);
    node.parentId = parentId;
    return;
  }
  if (!Array.isArray(index.rootIds)) {
    index.rootIds = [];
  }
  index.rootIds.push(nodeId);
  node.parentId = null;
}

function findDocNodeIds(index, docId) {
  return Object.keys(index.nodes || {}).filter((nodeId) => {
    const node = index.nodes[nodeId];
    return node && node.type === 'doc' && node.docId === docId;
  });
}

function getSiblingList(index, parentId) {
  if (parentId && isFolder(index, parentId)) {
    const parent = index.nodes[parentId];
    if (!Array.isArray(parent.children)) {
      parent.children = [];
    }
    return parent.children;
  }
  if (!Array.isArray(index.rootIds)) {
    index.rootIds = [];
  }
  return index.rootIds;
}

function isFolderDescendant(index, folderId, candidateChildId) {
  const start = index.nodes[folderId];
  if (!start || start.type !== 'folder') {
    return false;
  }
  const stack = Array.isArray(start.children) ? start.children.slice() : [];
  const seen = new Set();
  while (stack.length) {
    const nextId = stack.pop();
    if (!nextId || seen.has(nextId)) {
      continue;
    }
    if (nextId === candidateChildId) {
      return true;
    }
    seen.add(nextId);
    const node = index.nodes[nextId];
    if (node && node.type === 'folder' && Array.isArray(node.children)) {
      node.children.forEach((childId) => stack.push(childId));
    }
  }
  return false;
}

async function buildDocMetaMap(projectPath, index) {
  const storeDir = getStoreDir(projectPath);
  const map = new Map();
  const orderList = Array.isArray(index.order) ? index.order : [];
  for (const docId of orderList) {
    if (!docId || map.has(docId)) {
      continue;
    }
    const entry = index.docs[docId];
    if (!entry || !entry.file) {
      continue;
    }
    const filePath = path.join(storeDir, entry.file);
    let doc = null;
    try {
      doc = await readDocFile(filePath, { allowMissing: true });
    } catch (error) {
      doc = normalizeDoc();
    }
    map.set(docId, {
      title: doc.title,
      synopsis: doc.synopsis,
      status: doc.status,
      pinned: Boolean(doc.pinned),
      pov: doc.pov,
    });
  }
  return map;
}

async function listDocs(projectPath) {
  const index = await readIndex(projectPath);
  const storeDir = getStoreDir(projectPath);
  const docs = [];

  for (const id of index.order) {
    const entry = index.docs[id];
    if (!entry || !entry.file) {
      continue;
    }
    const filePath = path.join(storeDir, entry.file);
    const doc = await readDocFile(filePath, { allowMissing: true });
    docs.push({
      id,
      file: entry.file,
      path: filePath,
      title: doc.title,
      synopsis: doc.synopsis,
      status: doc.status,
      pinned: Boolean(doc.pinned),
      pov: doc.pov,
      text: doc.text,
    });
  }

  return docs;
}

async function listBinder(projectPath) {
  const index = await readIndex(projectPath);
  const metaMap = await buildDocMetaMap(projectPath, index);
  let projectMeta = null;
  try {
    projectMeta = await readProject(projectPath);
  } catch (error) {
    projectMeta = { notes: [] };
  }
  const notes = projectMeta && Array.isArray(projectMeta.notes) ? projectMeta.notes : [];
  const noteMap = new Map();
  notes.forEach((note) => {
    if (!note || !note.id) {
      return;
    }
    const noteId = String(note.id);
    noteMap.set(noteId, {
      id: noteId,
      title: String(note.title || 'Untitled Note'),
      pinned: Boolean(note.pinned),
    });
  });

  let indexChanged = false;
  const noteNodeByNoteId = new Map();
  Object.keys(index.nodes || {}).forEach((nodeId) => {
    const node = index.nodes[nodeId];
    if (!node || node.type !== 'note') {
      return;
    }
    const noteId = String(node.noteId || '').trim();
    if (!noteId || !noteMap.has(noteId) || noteNodeByNoteId.has(noteId)) {
      removeNodeReference(index, nodeId);
      delete index.nodes[nodeId];
      indexChanged = true;
      return;
    }
    noteNodeByNoteId.set(noteId, nodeId);
  });

  noteMap.forEach((note) => {
    if (noteNodeByNoteId.has(note.id)) {
      return;
    }
    const nodeId = createUniqueNodeId(index, `note_${note.id}`, 'note');
    index.nodes[nodeId] = {
      id: nodeId,
      type: 'note',
      noteId: note.id,
      parentId: null,
    };
    const roots = getSiblingList(index, null);
    roots.push(nodeId);
    indexChanged = true;
  });

  if (indexChanged) {
    await writeIndex(projectPath, index);
  }

  const nodes = {};

  Object.keys(index.nodes || {}).forEach((nodeId) => {
    const node = index.nodes[nodeId];
    if (!node) {
      return;
    }
    if (node.type === 'folder') {
      nodes[nodeId] = {
        id: node.id,
        type: 'folder',
        title: String(node.title || 'Folder'),
        parentId: node.parentId || null,
        children: Array.isArray(node.children) ? node.children.slice() : [],
      };
      return;
    }
    if (node.type === 'doc') {
      const docId = node.docId;
      const meta = metaMap.get(docId) || normalizeDoc();
      nodes[nodeId] = {
        id: node.id,
        type: 'doc',
        docId,
        parentId: node.parentId || null,
        title: meta.title,
        synopsis: meta.synopsis,
        status: meta.status,
        pinned: Boolean(meta.pinned),
        pov: meta.pov,
      };
      return;
    }
    if (node.type === 'note') {
      const noteId = String(node.noteId || '').trim();
      const note = noteMap.get(noteId);
      if (!note) {
        return;
      }
      nodes[nodeId] = {
        id: node.id,
        type: 'note',
        noteId,
        parentId: node.parentId || null,
        title: note.title,
        pinned: Boolean(note.pinned),
      };
    }
  });

  return {
    rootIds: Array.isArray(index.rootIds) ? index.rootIds.slice() : [],
    nodes,
    order: Array.isArray(index.order) ? index.order.slice() : [],
  };
}

async function readDoc(projectPath, docId) {
  const index = await readIndex(projectPath);
  const entry = index.docs[docId];
  if (!entry || !entry.file) {
    return null;
  }
  const filePath = path.join(getStoreDir(projectPath), entry.file);
  return readDocFile(filePath);
}

async function writeDoc(projectPath, docId, doc, options = {}) {
  const index = await readIndex(projectPath);
  const entry = index.docs[docId];
  if (!entry || !entry.file) {
    return null;
  }
  const filePath = path.join(getStoreDir(projectPath), entry.file);
  const normalized = await writeDocFile(filePath, doc);
  await maybeSaveHistorySnapshot(projectPath, docId, normalized, options);
  return normalized;
}

async function createDoc(projectPath, title = 'New Chapter', options = {}) {
  const index = await readIndex(projectPath);
  let id = generateId('doc');
  while (index.docs[id]) {
    id = generateId('doc');
  }
  const file = `${id}.json`;
  index.docs[id] = { id, file };
  const nodeId = createUniqueNodeId(index, id, `docnode_${id}`);
  index.nodes[nodeId] = {
    id: nodeId,
    type: 'doc',
    docId: id,
    parentId: null,
  };
  const requestedParentId =
    typeof options === 'string' ? options : options && options.parentId;
  const parentId = String(requestedParentId || '').trim() || null;
  attachNode(index, nodeId, parentId);
  await writeIndex(projectPath, index);
  const doc = normalizeDoc({ title });
  const filePath = path.join(getStoreDir(projectPath), file);
  await writeDocFile(filePath, doc);
  return { id, nodeId, parentId: index.nodes[nodeId].parentId, file, path: filePath, ...doc };
}

async function createFolder(projectPath, title = 'New Folder', parentId = null) {
  const index = await readIndex(projectPath);
  let id = generateId('folder');
  while (index.nodes[id]) {
    id = generateId('folder');
  }
  const folder = {
    id,
    type: 'folder',
    title: String(title || '').trim() || 'New Folder',
    parentId: null,
    children: [],
  };
  index.nodes[id] = folder;
  const targetParentId = String(parentId || '').trim() || null;
  attachNode(index, id, targetParentId);
  await writeIndex(projectPath, index);
  return { ...folder };
}

async function renameFolder(projectPath, folderId, title = 'Folder') {
  const index = await readIndex(projectPath);
  const targetId = String(folderId || '').trim();
  const folder = index.nodes[targetId];
  if (!targetId || !folder || folder.type !== 'folder') {
    return null;
  }
  folder.title = String(title || '').trim() || 'Folder';
  await writeIndex(projectPath, index);
  return { ...folder };
}

async function deleteFolder(projectPath, folderId) {
  const index = await readIndex(projectPath);
  const targetId = String(folderId || '').trim();
  const folder = index.nodes[targetId];
  if (!targetId || !folder || folder.type !== 'folder') {
    return false;
  }

  const parentId = isFolder(index, folder.parentId) ? folder.parentId : null;
  const siblings = getSiblingList(index, parentId);
  let insertAt = siblings.indexOf(targetId);
  if (insertAt < 0) {
    insertAt = siblings.length;
  }
  removeNodeReference(index, targetId);

  const children = Array.isArray(folder.children) ? folder.children.slice() : [];
  children.forEach((childId) => {
    const child = index.nodes[childId];
    if (!child || childId === targetId) {
      return;
    }
    if (!siblings.includes(childId)) {
      siblings.splice(insertAt, 0, childId);
      insertAt += 1;
    }
    child.parentId = parentId;
  });

  delete index.nodes[targetId];
  await writeIndex(projectPath, index);
  return true;
}

async function deleteDoc(projectPath, docId) {
  const index = await readIndex(projectPath);
  const entry = index.docs[docId];
  if (!entry || !entry.file) {
    return null;
  }
  const filePath = path.join(getStoreDir(projectPath), entry.file);
  try {
    await fs.promises.rm(filePath, { force: true });
  } catch (error) {
    // Ignore file delete errors.
  }
  delete index.docs[docId];
  findDocNodeIds(index, docId).forEach((nodeId) => {
    removeNodeReference(index, nodeId);
    delete index.nodes[nodeId];
  });
  await writeIndex(projectPath, index);
  return true;
}

async function updateOrder(projectPath, orderList) {
  const index = await readIndex(projectPath);
  if (!Array.isArray(orderList)) {
    return null;
  }
  const filtered = orderList.filter((id) => typeof id === 'string' && index.docs[id]);
  const desiredDocOrder = filtered.concat(
    Object.keys(index.docs).filter((id) => !filtered.includes(id))
  );

  const rootDocNodeMap = new Map();
  const rootFolderIds = [];
  (Array.isArray(index.rootIds) ? index.rootIds : []).forEach((nodeId) => {
    const node = index.nodes[nodeId];
    if (!node) {
      return;
    }
    if (node.type === 'doc' && node.docId) {
      rootDocNodeMap.set(node.docId, node.id);
      return;
    }
    rootFolderIds.push(nodeId);
  });

  if (rootDocNodeMap.size === Object.keys(index.docs).length) {
    const reorderedRootDocs = desiredDocOrder
      .map((docId) => rootDocNodeMap.get(docId))
      .filter(Boolean);
    index.rootIds = reorderedRootDocs.concat(rootFolderIds);
  }

  await writeIndex(projectPath, index);
  return true;
}

async function moveBinderNode(projectPath, nodeId, targetParentId = null, targetIndex = null) {
  const index = await readIndex(projectPath);
  const movingId = String(nodeId || '').trim();
  if (!movingId || !index.nodes[movingId]) {
    return false;
  }
  const movingNode = index.nodes[movingId];
  const nextParentId = String(targetParentId || '').trim() || null;
  if (nextParentId && !isFolder(index, nextParentId)) {
    return false;
  }
  if (nextParentId && nextParentId === movingId) {
    return false;
  }
  if (movingNode.type === 'folder' && nextParentId && isFolderDescendant(index, movingId, nextParentId)) {
    return false;
  }

  const previousSiblings = getSiblingList(index, movingNode.parentId || null);
  const previousIndex = previousSiblings.indexOf(movingId);
  removeNodeReference(index, movingId);

  const siblings = getSiblingList(index, nextParentId);
  let insertAt = Number.parseInt(String(targetIndex ?? ''), 10);
  if (!Number.isFinite(insertAt)) {
    insertAt = siblings.length;
  }
  if (previousSiblings === siblings && previousIndex >= 0 && previousIndex < insertAt) {
    insertAt -= 1;
  }
  insertAt = Math.max(0, Math.min(siblings.length, insertAt));
  siblings.splice(insertAt, 0, movingId);
  movingNode.parentId = nextParentId;

  await writeIndex(projectPath, index);
  return true;
}

async function getStats(projectPath) {
  const index = await readIndex(projectPath);
  const storeDir = getStoreDir(projectPath);
  const totals = { withSpaces: 0, withoutSpaces: 0 };
  const perDoc = [];

  for (const id of index.order) {
    const entry = index.docs[id];
    if (!entry || !entry.file) {
      continue;
    }
    const filePath = path.join(storeDir, entry.file);
    const doc = await readDocFile(filePath);
    const counts = countCharacters(doc.text);
    totals.withSpaces += counts.withSpaces;
    totals.withoutSpaces += counts.withoutSpaces;
    perDoc.push({ id, ...counts });
  }

  return { totals, perDoc };
}

module.exports = {
  listDocs,
  readDoc,
  writeDoc,
  createDoc,
  createFolder,
  renameFolder,
  deleteFolder,
  deleteDoc,
  updateOrder,
  moveBinderNode,
  getStats,
  listBinder,
};
