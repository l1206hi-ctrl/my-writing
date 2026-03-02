import { elements } from '../elements.js';
import { state } from '../state.js';

function appendHighlightedText(container, text, ranges) {
  container.textContent = '';
  if (!text) {
    return;
  }
  if (!ranges.length) {
    container.textContent = text;
    return;
  }
  let cursor = 0;
  ranges
    .slice()
    .sort((a, b) => a.start - b.start)
    .forEach((range) => {
      const start = Math.max(cursor, Math.max(0, range.start));
      const end = Math.min(text.length, Math.max(start, range.end));
      if (start > cursor) {
        container.appendChild(document.createTextNode(text.slice(cursor, start)));
      }
      if (end > start) {
        const mark = document.createElement('mark');
        mark.className = 'search-hit';
        if (Number.isFinite(range.findIndex)) {
          mark.dataset.findIndex = String(range.findIndex);
        }
        mark.textContent = text.slice(start, end);
        container.appendChild(mark);
      }
      cursor = end;
    });
  if (cursor < text.length) {
    container.appendChild(document.createTextNode(text.slice(cursor)));
  }
}

function groupLocalFindResults(matches) {
  const groups = [];
  matches.forEach((match, index) => {
    const last = groups.length > 0 ? groups[groups.length - 1] : null;
    if (last && last.line === match.line) {
      last.matches.push({ ...match, index });
      return;
    }
    groups.push({
      line: match.line,
      lineText: match.lineText || '',
      matches: [{ ...match, index }],
    });
  });
  return groups;
}

export function renderLocalFindResults() {
  if (!elements.localFindResults) {
    return;
  }
  elements.localFindResults.innerHTML = '';
  const query = state.localFindQuery.trim();
  if (!query) {
    const empty = document.createElement('div');
    empty.className = 'search-item empty';
    empty.textContent = 'Type to find matches in the current chapter.';
    elements.localFindResults.appendChild(empty);
    return;
  }
  if (!state.localFindResults.length) {
    const empty = document.createElement('div');
    empty.className = 'search-item empty';
    empty.textContent = 'No matches found';
    elements.localFindResults.appendChild(empty);
    return;
  }
  const grouped = groupLocalFindResults(state.localFindResults);
  grouped.forEach((group) => {
    const item = document.createElement('div');
    item.className = 'search-item';
    item.dataset.index = String(group.matches[0].index);

    const pathLabel = document.createElement('div');
    pathLabel.className = 'search-path';
    if (group.matches.length === 1) {
      pathLabel.textContent = `Line ${group.line} - Col ${group.matches[0].col}`;
    } else {
      const prefix = document.createElement('span');
      prefix.textContent = `Line ${group.line} - Cols `;
      pathLabel.appendChild(prefix);
      group.matches.forEach((match, idx) => {
        const col = document.createElement('span');
        col.className = 'local-find-col';
        col.dataset.findIndex = String(match.index);
        col.textContent = String(match.col);
        pathLabel.appendChild(col);
        if (idx < group.matches.length - 1) {
          pathLabel.appendChild(document.createTextNode(', '));
        }
      });
    }

    const preview = document.createElement('div');
    preview.className = 'search-preview';
    const displayText = group.lineText.length > 0 ? group.lineText : ' ';
    const ranges = group.matches.map((match) => ({
      start: match.start - match.lineStart,
      end: match.end - match.lineStart,
      findIndex: match.index,
    }));
    appendHighlightedText(preview, displayText, ranges);

    item.appendChild(pathLabel);
    item.appendChild(preview);
    elements.localFindResults.appendChild(item);
  });
}

export function renderGlobalSearchResults() {
  elements.globalSearchResults.innerHTML = '';
  if (!state.globalSearchQuery) {
    return;
  }
  const fieldLabels = {
    text: 'Text',
    notes: 'Notes',
    synopsis: 'Synopsis',
    title: 'Title',
    pov: 'POV',
    'project-note': 'Project Note',
    'project-note-title': 'Project Note Title',
  };
  if (!state.globalSearchResults.length) {
    const empty = document.createElement('div');
    empty.className = 'search-item empty';
    empty.textContent = 'No matches found';
    elements.globalSearchResults.appendChild(empty);
    return;
  }
  state.globalSearchResults.forEach((result) => {
    const item = document.createElement('div');
    item.className = 'search-item';
    item.dataset.id = result.id;
    item.dataset.type = result.type || 'doc';
    item.dataset.field = result.field || '';

    const pathLabel = document.createElement('div');
    pathLabel.className = 'search-path';
    const fieldName = result.field ? fieldLabels[result.field] || result.field : '';
    const fieldLabel = fieldName ? ` - ${fieldName}` : '';
    const lineLabel = result.line ? ` - Line ${result.line}` : '';
    pathLabel.textContent = `${result.title || 'Untitled'}${fieldLabel}${lineLabel}`;

    const preview = document.createElement('div');
    preview.className = 'search-preview';
    preview.textContent = result.preview || '';

    item.appendChild(pathLabel);
    item.appendChild(preview);
    elements.globalSearchResults.appendChild(item);
  });
}
