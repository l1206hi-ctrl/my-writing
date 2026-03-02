import { state } from './state.js';

function buildFallbackNoteNodeId(noteId) {
  const id = String(noteId || '').trim();
  return id ? `note_${id}` : null;
}

export function findDocNodeId(docId) {
  const target = String(docId || '').trim();
  if (!target || !state.binder || !state.binder.nodes) {
    return null;
  }
  const node = Object.values(state.binder.nodes).find(
    (entry) => entry && entry.type === 'doc' && entry.docId === target
  );
  return node ? node.id : null;
}

export function findNoteNodeId(noteId) {
  const target = String(noteId || '').trim();
  if (!target || !state.binder || !state.binder.nodes) {
    return null;
  }
  const node = Object.values(state.binder.nodes).find(
    (entry) => entry && entry.type === 'note' && entry.noteId === target
  );
  if (node) {
    return node.id;
  }
  return buildFallbackNoteNodeId(target);
}

export function findNoteNode(noteId) {
  const nodeId = findNoteNodeId(noteId);
  if (!nodeId || !state.binder || !state.binder.nodes) {
    return null;
  }
  return state.binder.nodes[nodeId] || null;
}
