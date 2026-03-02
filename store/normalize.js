const fs = require('fs');
const path = require('path');
const { DOC_TEMPLATE, STATUS_VALUES } = require('./constants');
const { countCharacters } = require('./text');

const INDEX_VERSION = 2;

function isJsonSyntaxError(error) {
  return error && error.name === 'SyntaxError';
}

async function backupCorruptFile(filePath) {
  try {
    if (!fs.existsSync(filePath)) {
      return;
    }
    const dir = path.dirname(filePath);
    const base = path.basename(filePath);
    const stamp = Date.now();
    const backupName = `${base}.corrupt-${stamp}`;
    await fs.promises.copyFile(filePath, path.join(dir, backupName));
  } catch (error) {
    // Ignore backup errors.
  }
}

function normalizeDoc(doc) {
  const next = { ...DOC_TEMPLATE, ...(doc || {}) };
  if (!STATUS_VALUES.has(next.status)) {
    next.status = 'draft';
  }
  next.title = String(next.title || '');
  next.synopsis = String(next.synopsis || '');
  next.pov = String(next.pov || '');
  next.pinned = Boolean(next.pinned);
  next.notes = String(next.notes || '');
  next.text = String(next.text || '');
  return next;
}

function asNodeId(value) {
  const id = String(value || '').trim();
  return id || null;
}

function uniqueNodeList(values) {
  if (!Array.isArray(values)) {
    return [];
  }
  const out = [];
  const seen = new Set();
  values.forEach((value) => {
    const id = asNodeId(value);
    if (!id || seen.has(id)) {
      return;
    }
    seen.add(id);
    out.push(id);
  });
  return out;
}

function createUniqueNodeId(preferred, usedIds, prefix = 'node') {
  let base = asNodeId(preferred) || `${prefix}_${Date.now().toString(36)}`;
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

function normalizeDocsMap(rawDocs) {
  const source = rawDocs && typeof rawDocs === 'object' ? rawDocs : {};
  const docs = {};
  Object.keys(source).forEach((key) => {
    const docId = asNodeId(key);
    if (!docId) {
      return;
    }
    const entry = source[key];
    if (!entry || typeof entry !== 'object') {
      return;
    }
    const file = String(entry.file || '').trim();
    if (!file) {
      return;
    }
    docs[docId] = { id: docId, file };
  });
  return docs;
}

function wouldCreateCycle(nodes, parentId, childId) {
  let cursor = parentId;
  const seen = new Set();
  while (cursor) {
    if (cursor === childId) {
      return true;
    }
    if (seen.has(cursor)) {
      return true;
    }
    seen.add(cursor);
    const node = nodes[cursor];
    if (!node) {
      return false;
    }
    cursor = node.parentId || null;
  }
  return false;
}

function detachNode(nodes, rootIds, nodeId) {
  Object.values(nodes).forEach((node) => {
    if (node.type !== 'folder') {
      return;
    }
    node.children = node.children.filter((childId) => childId !== nodeId);
  });
  const rootIndex = rootIds.indexOf(nodeId);
  if (rootIndex >= 0) {
    rootIds.splice(rootIndex, 1);
  }
  if (nodes[nodeId]) {
    nodes[nodeId].parentId = null;
  }
}

function buildDocOrder(index) {
  const order = [];
  const seenDocIds = new Set();
  const visitedNodes = new Set();

  const visit = (nodeId) => {
    if (visitedNodes.has(nodeId)) {
      return;
    }
    visitedNodes.add(nodeId);
    const node = index.nodes[nodeId];
    if (!node) {
      return;
    }
    if (node.type === 'doc') {
      const docId = node.docId;
      if (docId && index.docs[docId] && !seenDocIds.has(docId)) {
        seenDocIds.add(docId);
        order.push(docId);
      }
      return;
    }
    if (node.type === 'folder' && Array.isArray(node.children)) {
      node.children.forEach((childId) => visit(childId));
    }
  };

  index.rootIds.forEach((nodeId) => visit(nodeId));

  Object.values(index.nodes).forEach((node) => {
    if (node.type !== 'doc') {
      return;
    }
    const docId = node.docId;
    if (docId && index.docs[docId] && !seenDocIds.has(docId)) {
      seenDocIds.add(docId);
      order.push(docId);
    }
  });

  Object.keys(index.docs).forEach((docId) => {
    if (!seenDocIds.has(docId)) {
      seenDocIds.add(docId);
      order.push(docId);
    }
  });

  return order;
}

function migrateLegacyIndex(docs, legacyOrder) {
  const nodes = {};
  const rootIds = [];
  const usedIds = new Set();
  const orderedDocIds = uniqueNodeList(legacyOrder).filter((docId) => Boolean(docs[docId]));
  const missingDocIds = Object.keys(docs).filter((docId) => !orderedDocIds.includes(docId));
  const finalDocIds = orderedDocIds.concat(missingDocIds);

  finalDocIds.forEach((docId) => {
    const nodeId = createUniqueNodeId(docId, usedIds, `docnode_${docId}`);
    usedIds.add(nodeId);
    nodes[nodeId] = {
      id: nodeId,
      type: 'doc',
      docId,
      parentId: null,
    };
    rootIds.push(nodeId);
  });

  return { nodes, rootIds };
}

function normalizeIndex(index) {
  const source = index && typeof index === 'object' ? index : {};
  const docs = normalizeDocsMap(source.docs);
  const hasNodes = source.nodes && typeof source.nodes === 'object';

  if (!hasNodes) {
    const migrated = migrateLegacyIndex(docs, source.order);
    const normalized = {
      version: INDEX_VERSION,
      docs,
      nodes: migrated.nodes,
      rootIds: migrated.rootIds,
    };
    normalized.order = buildDocOrder(normalized);
    return normalized;
  }

  const nodes = {};
  const declaredParents = new Map();
  const usedNodeIds = new Set();

  Object.keys(source.nodes).forEach((rawKey) => {
    const rawNode = source.nodes[rawKey];
    if (!rawNode || typeof rawNode !== 'object') {
      return;
    }
    const nodeId = asNodeId(rawNode.id || rawKey);
    if (!nodeId || usedNodeIds.has(nodeId)) {
      return;
    }
    if (rawNode.type === 'folder') {
      nodes[nodeId] = {
        id: nodeId,
        type: 'folder',
        title: String(rawNode.title || 'Folder'),
        parentId: null,
        children: uniqueNodeList(rawNode.children),
      };
      usedNodeIds.add(nodeId);
      const parentId = asNodeId(rawNode.parentId);
      if (parentId) {
        declaredParents.set(nodeId, parentId);
      }
      return;
    }
    if (rawNode.type === 'doc') {
      const docId = asNodeId(rawNode.docId || rawNode.id || rawKey);
      if (!docId || !docs[docId]) {
        return;
      }
      nodes[nodeId] = {
        id: nodeId,
        type: 'doc',
        docId,
        parentId: null,
      };
      usedNodeIds.add(nodeId);
      const parentId = asNodeId(rawNode.parentId);
      if (parentId) {
        declaredParents.set(nodeId, parentId);
      }
      return;
    }
    if (rawNode.type === 'note') {
      const noteId = asNodeId(rawNode.noteId || rawNode.id || rawKey);
      if (!noteId) {
        return;
      }
      nodes[nodeId] = {
        id: nodeId,
        type: 'note',
        noteId,
        parentId: null,
      };
      usedNodeIds.add(nodeId);
      const parentId = asNodeId(rawNode.parentId);
      if (parentId) {
        declaredParents.set(nodeId, parentId);
      }
    }
  });

  const claimed = new Set();
  Object.values(nodes).forEach((node) => {
    if (node.type !== 'folder') {
      return;
    }
    const nextChildren = [];
    node.children.forEach((childId) => {
      if (!nodes[childId] || childId === node.id || claimed.has(childId)) {
        return;
      }
      if (wouldCreateCycle(nodes, node.id, childId)) {
        return;
      }
      nodes[childId].parentId = node.id;
      claimed.add(childId);
      nextChildren.push(childId);
    });
    node.children = nextChildren;
  });

  declaredParents.forEach((parentId, nodeId) => {
    if (claimed.has(nodeId)) {
      return;
    }
    const parent = nodes[parentId];
    const child = nodes[nodeId];
    if (!parent || parent.type !== 'folder' || !child || parent.id === nodeId) {
      return;
    }
    if (wouldCreateCycle(nodes, parent.id, child.id)) {
      return;
    }
    child.parentId = parent.id;
    parent.children.push(child.id);
    claimed.add(child.id);
  });

  let rootIds = uniqueNodeList(source.rootIds).filter((nodeId) => {
    const node = nodes[nodeId];
    return node && !node.parentId;
  });

  Object.values(nodes).forEach((node) => {
    if (node.parentId) {
      return;
    }
    if (!rootIds.includes(node.id)) {
      rootIds.push(node.id);
    }
  });

  const docNodeByDocId = new Map();
  const noteNodeByNoteId = new Map();
  Object.keys(nodes).forEach((nodeId) => {
    const node = nodes[nodeId];
    if (!node || (node.type !== 'doc' && node.type !== 'note')) {
      return;
    }
    if (node.type === 'doc') {
      if (!docs[node.docId]) {
        detachNode(nodes, rootIds, node.id);
        delete nodes[node.id];
        return;
      }
      if (docNodeByDocId.has(node.docId)) {
        detachNode(nodes, rootIds, node.id);
        delete nodes[node.id];
        return;
      }
      docNodeByDocId.set(node.docId, node.id);
      return;
    }
    if (noteNodeByNoteId.has(node.noteId)) {
      detachNode(nodes, rootIds, node.id);
      delete nodes[node.id];
      return;
    }
    noteNodeByNoteId.set(node.noteId, node.id);
  });

  Object.keys(docs).forEach((docId) => {
    if (docNodeByDocId.has(docId)) {
      return;
    }
    const nodeId = createUniqueNodeId(docId, usedNodeIds, `docnode_${docId}`);
    usedNodeIds.add(nodeId);
    nodes[nodeId] = {
      id: nodeId,
      type: 'doc',
      docId,
      parentId: null,
    };
    rootIds.push(nodeId);
  });

  rootIds = uniqueNodeList(rootIds).filter((nodeId) => Boolean(nodes[nodeId]));

  const normalized = {
    version: INDEX_VERSION,
    docs,
    nodes,
    rootIds,
  };
  normalized.order = buildDocOrder(normalized);
  return normalized;
}

function normalizeProject(meta) {
  const incoming = meta && typeof meta === 'object' ? meta : {};
  const notes = Array.isArray(incoming.notes) ? incoming.notes : [];
  const normalized = [];
  const seen = new Set();

  notes.forEach((note) => {
    if (!note || typeof note !== 'object') {
      return;
    }
    const id =
      String(note.id || '').trim() ||
      `note_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`;
    if (seen.has(id)) {
      return;
    }
    seen.add(id);
    normalized.push({
      id,
      title: String(note.title || 'Untitled'),
      content: String(note.content || ''),
      pinned: Boolean(note.pinned),
    });
  });

  if (incoming.synopsis && !seen.has('synopsis')) {
    normalized.unshift({
      id: 'synopsis',
      title: 'Synopsis',
      content: String(incoming.synopsis || ''),
      pinned: false,
    });
    seen.add('synopsis');
  }
  if (incoming.intro && !seen.has('intro')) {
    normalized.unshift({
      id: 'intro',
      title: 'Intro',
      content: String(incoming.intro || ''),
      pinned: false,
    });
    seen.add('intro');
  }
  if (incoming.setting && !seen.has('setting')) {
    normalized.unshift({
      id: 'setting',
      title: 'Setting',
      content: String(incoming.setting || ''),
      pinned: false,
    });
    seen.add('setting');
  }

  return { notes: normalized };
}

function normalizeCharacters(list) {
  const items = Array.isArray(list) ? list : [];
  const normalized = [];
  const seen = new Set();

  items.forEach((item) => {
    if (!item || typeof item !== 'object') {
      return;
    }
    let id = String(item.id || '').trim();
    if (!id) {
      id = `char_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`;
    }
    if (seen.has(id)) {
      id = `${id}_${Math.random().toString(36).slice(2, 6)}`;
    }
    seen.add(id);
    const tags = Array.isArray(item.tags)
      ? item.tags.map((value) => String(value || '').trim()).filter((value) => value)
      : [];
    const links = Array.isArray(item.linkedChapters)
      ? item.linkedChapters.map((value) => String(value || '').trim()).filter((value) => value)
      : [];
    normalized.push({
      id,
      name: String(item.name || '').trim(),
      role: String(item.role || '').trim(),
      description: String(item.description || '').trim(),
      tags,
      linkedChapters: links,
    });
  });

  return normalized;
}

module.exports = {
  isJsonSyntaxError,
  backupCorruptFile,
  normalizeDoc,
  normalizeIndex,
  normalizeProject,
  countCharacters,
  normalizeCharacters,
};
