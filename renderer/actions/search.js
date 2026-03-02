import { SEARCH_DELAY } from '../constants.js';
import { findNoteNodeId } from '../binder.js';
import { elements } from '../elements.js';
import { state } from '../state.js';
import {
  applyViewMode,
  renderGlobalSearchResults,
  renderDocList,
  renderLocalFindResults,
  renderProjectNoteEditor,
  renderProjectNotes,
  setStatus,
} from '../ui.js';
import { loadDoc } from './docs.js';

let globalSearchTimer = null;
const LOCAL_FIND_LIMIT = 400;

function getActiveEditor() {
  if (state.viewMode === 'project-note' && state.activeProjectNoteId) {
    return elements.projectNoteEditor;
  }
  if (state.currentDocId) {
    return elements.editorText;
  }
  return null;
}

function buildLineStarts(text) {
  const starts = [0];
  for (let i = 0; i < text.length; i += 1) {
    if (text.charCodeAt(i) === 10) {
      starts.push(i + 1);
    }
  }
  return starts;
}

function getLineInfo(text, lineStarts, index) {
  let low = 0;
  let high = lineStarts.length - 1;
  while (low <= high) {
    const mid = (low + high) >> 1;
    if (lineStarts[mid] <= index) {
      low = mid + 1;
    } else {
      high = mid - 1;
    }
  }
  const lineIdx = Math.max(0, high);
  const lineStart = lineStarts[lineIdx];
  const nextStart = lineIdx + 1 < lineStarts.length ? lineStarts[lineIdx + 1] : text.length;
  let lineEnd = nextStart;
  if (lineEnd > lineStart && text.charCodeAt(lineEnd - 1) === 10) {
    lineEnd -= 1;
  }
  if (lineEnd > lineStart && text.charCodeAt(lineEnd - 1) === 13) {
    lineEnd -= 1;
  }
  return {
    line: lineIdx + 1,
    col: index - lineStart + 1,
    lineStart,
    lineEnd,
  };
}

function getEditorLineHeight(editor) {
  const computed = window.getComputedStyle(editor);
  const value = Number.parseFloat(computed.lineHeight);
  if (Number.isFinite(value)) {
    return value;
  }
  const fontSize = Number.parseFloat(computed.fontSize);
  if (Number.isFinite(fontSize)) {
    return fontSize * 1.4;
  }
  return 24;
}

function scrollEditorToIndex(editor, index) {
  const value = editor.value || '';
  const clamped = Math.max(0, Math.min(value.length, index));
  const computed = window.getComputedStyle(editor);
  const mirror = document.createElement('div');
  const copyProps = [
    'boxSizing',
    'width',
    'fontFamily',
    'fontSize',
    'fontWeight',
    'fontStyle',
    'fontVariant',
    'letterSpacing',
    'textTransform',
    'textIndent',
    'paddingTop',
    'paddingRight',
    'paddingBottom',
    'paddingLeft',
    'borderTopWidth',
    'borderRightWidth',
    'borderBottomWidth',
    'borderLeftWidth',
    'lineHeight',
    'wordSpacing',
    'tabSize',
  ];
  mirror.style.position = 'absolute';
  mirror.style.left = '-99999px';
  mirror.style.top = '0';
  mirror.style.visibility = 'hidden';
  mirror.style.whiteSpace = 'pre-wrap';
  mirror.style.overflowWrap = 'break-word';
  mirror.style.wordBreak = 'break-word';
  mirror.style.overflow = 'hidden';
  copyProps.forEach((prop) => {
    mirror.style[prop] = computed[prop];
  });
  mirror.style.width = `${editor.clientWidth}px`;
  mirror.textContent = value.slice(0, clamped);
  const marker = document.createElement('span');
  marker.textContent = '\u200b';
  mirror.appendChild(marker);
  document.body.appendChild(mirror);
  const markerTop = marker.offsetTop;
  document.body.removeChild(mirror);

  const lineHeight = getEditorLineHeight(editor);
  const targetTop = Math.max(0, markerTop - editor.clientHeight * 0.45 + lineHeight);
  editor.scrollTop = targetTop;
}

export function handleSearchInput() {
  state.chapterFilterQuery = elements.searchInput.value || '';
  renderDocList();
}

export function handleGlobalSearchInput() {
  const query = elements.globalSearchInput.value.trim();
  state.globalSearchQuery = query;
  if (globalSearchTimer) {
    clearTimeout(globalSearchTimer);
  }
  if (!query) {
    state.globalSearchResults = [];
    renderGlobalSearchResults();
    return;
  }
  globalSearchTimer = setTimeout(async () => {
    if (!state.projectPath) {
      return;
    }
    const activeQuery = state.globalSearchQuery;
    try {
      const results = await window.api.globalSearch(state.projectPath, activeQuery);
      if (state.globalSearchQuery !== activeQuery) {
        return;
      }
      state.globalSearchResults = Array.isArray(results) ? results : [];
      renderGlobalSearchResults();
    } catch (error) {
      state.globalSearchResults = [];
      renderGlobalSearchResults();
      setStatus(error.message || 'Search failed.', true);
    }
  }, SEARCH_DELAY);
}

export function openGlobalSearch() {
  if (!state.projectPath) {
    return;
  }
  elements.globalSearchOverlay.classList.remove('hidden');
  elements.globalSearchInput.focus();
  elements.globalSearchInput.select();
  if (state.globalSearchQuery) {
    handleGlobalSearchInput();
  } else {
    renderGlobalSearchResults();
  }
}

export function closeGlobalSearch() {
  elements.globalSearchOverlay.classList.add('hidden');
}

function buildLocalFindResults(text, query) {
  if (!query) {
    return [];
  }
  const haystack = text.toLowerCase();
  const needle = query.toLowerCase();
  const lineStarts = buildLineStarts(text);
  const results = [];
  let cursor = 0;
  while (results.length < LOCAL_FIND_LIMIT) {
    const start = haystack.indexOf(needle, cursor);
    if (start < 0) {
      break;
    }
    const end = start + needle.length;
    const lineInfo = getLineInfo(text, lineStarts, start);
    results.push({
      start,
      end,
      line: lineInfo.line,
      col: lineInfo.col,
      lineStart: lineInfo.lineStart,
      lineText: text.slice(lineInfo.lineStart, lineInfo.lineEnd),
    });
    cursor = end;
  }
  return results;
}

function refreshLocalFindResults() {
  const editor = getActiveEditor();
  if (!editor) {
    state.localFindResults = [];
    renderLocalFindResults();
    return;
  }
  const query = state.localFindQuery.trim();
  if (!query) {
    state.localFindResults = [];
    renderLocalFindResults();
    return;
  }
  state.localFindResults = buildLocalFindResults(editor.value || '', query);
  renderLocalFindResults();
}

export function refreshCurrentDocFind() {
  if (!elements.localFindOverlay || elements.localFindOverlay.classList.contains('hidden')) {
    return;
  }
  refreshLocalFindResults();
}

export function openCurrentDocFind() {
  const editor = getActiveEditor();
  if (!editor || !elements.localFindOverlay || !elements.localFindInput) {
    setStatus('Open a chapter or project note first.', true);
    return;
  }
  const selected =
    editor.selectionStart !== editor.selectionEnd
      ? editor.value.slice(editor.selectionStart, editor.selectionEnd).trim()
      : '';
  if (!state.localFindQuery && selected && !selected.includes('\n') && selected.length <= 80) {
    state.localFindQuery = selected;
  }
  elements.localFindOverlay.classList.remove('hidden');
  elements.localFindInput.value = state.localFindQuery;
  refreshLocalFindResults();
  elements.localFindInput.focus();
  elements.localFindInput.select();
}

export function closeCurrentDocFind() {
  if (!elements.localFindOverlay) {
    return;
  }
  elements.localFindOverlay.classList.add('hidden');
}

export function handleCurrentDocFindInput() {
  if (!elements.localFindInput) {
    return;
  }
  state.localFindQuery = elements.localFindInput.value || '';
  refreshLocalFindResults();
}

export function openCurrentDocFindResult(index, options = {}) {
  const editor = getActiveEditor();
  if (!editor) {
    return false;
  }
  const target = state.localFindResults[index];
  if (!target) {
    return false;
  }
  const closeOverlay = Boolean(options.closeOverlay);
  const applySelection = () => {
    editor.setSelectionRange(target.start, target.end);
    scrollEditorToIndex(editor, target.start);
    editor.focus();
    setStatus(`Line ${target.line}, Col ${target.col}`);
  };
  if (closeOverlay) {
    closeCurrentDocFind();
    window.requestAnimationFrame(() => {
      window.requestAnimationFrame(applySelection);
    });
  } else {
    applySelection();
  }
  return true;
}

export function findInCurrentDoc(direction = 1) {
  const editor = getActiveEditor();
  if (!editor) {
    setStatus('Open a chapter or project note first.', true);
    return false;
  }
  const query = state.localFindQuery.trim();
  if (!query) {
    openCurrentDocFind();
    return false;
  }
  refreshLocalFindResults();
  if (!state.localFindResults.length) {
    setStatus('No matches in current chapter.', true);
    return false;
  }
  const forward = direction >= 0;
  const startPos = forward ? editor.selectionEnd : editor.selectionStart;
  let nextIndex = -1;
  let wrapped = false;
  if (forward) {
    nextIndex = state.localFindResults.findIndex((entry) => entry.start >= startPos);
    if (nextIndex < 0) {
      nextIndex = 0;
      wrapped = true;
    }
  } else {
    for (let i = state.localFindResults.length - 1; i >= 0; i -= 1) {
      if (state.localFindResults[i].end <= startPos) {
        nextIndex = i;
        break;
      }
    }
    if (nextIndex < 0) {
      nextIndex = state.localFindResults.length - 1;
      wrapped = true;
    }
  }
  openCurrentDocFindResult(nextIndex);
  if (wrapped) {
    const target = state.localFindResults[nextIndex];
    if (target) {
      setStatus(`Line ${target.line}, Col ${target.col} (wrapped).`);
    }
  }
  return true;
}

export async function openGlobalSearchResult(result) {
  if (!result || !result.id) {
    return;
  }
  if (result.type === 'project-note') {
    state.activeProjectNoteId = result.id;
    state.selectedDocId = null;
    state.selectedBinderNodeId = findNoteNodeId(result.id);
    state.viewMode = 'project-note';
    renderDocList();
    renderProjectNotes();
    renderProjectNoteEditor();
    applyViewMode();
    closeGlobalSearch();
    return;
  }
  state.viewMode = 'editor';
  state.activeProjectNoteId = null;
  closeGlobalSearch();
  await loadDoc(result.id);
}
