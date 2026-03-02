import { DEFAULT_DOC, STATUS_VALUES } from './constants.js';

export function normalizeDoc(doc) {
  const next = { ...DEFAULT_DOC, ...(doc || {}) };
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

export function normalizeProjectMeta(meta) {
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

  return { notes: normalized };
}
