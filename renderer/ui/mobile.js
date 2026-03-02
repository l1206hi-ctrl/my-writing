import { elements } from '../elements.js';
import { state } from '../state.js';

function buildMobilePreviewBody(doc) {
  if (!doc) {
    return 'Start writing...';
  }
  const trimmedText = String(doc.text || '').trim();
  const trimmedNotes = String(doc.notes || '').trim();
  const sections = [];
  if (trimmedText) {
    sections.push(trimmedText);
  }
  if (trimmedNotes) {
    sections.push(`Notes:\n${trimmedNotes}`);
  }
  if (!sections.length) {
    return 'Start writing...';
  }
  return sections.join('\n\n');
}

export function renderMobilePreview() {
  if (!elements.mobilePreviewTitle || !elements.mobilePreviewText) {
    return;
  }
  const titleText = state.currentDoc && state.currentDoc.title ? state.currentDoc.title.trim() : '';
  elements.mobilePreviewTitle.textContent = titleText || 'No chapter selected';
  elements.mobilePreviewText.textContent = buildMobilePreviewBody(state.currentDoc);
}

export function setMobilePreviewVisible(visible) {
  state.mobilePreviewOpen = Boolean(visible);
  if (!elements.mobilePreviewOverlay) {
    return;
  }
  elements.mobilePreviewOverlay.classList.toggle('hidden', !state.mobilePreviewOpen);
}
