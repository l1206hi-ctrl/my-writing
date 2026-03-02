const path = require('path');
const { getStoreDir } = require('./paths');
const { readIndex, readDocFile, readProject } = require('./io');
const { buildPreview, countLine, normalizeContent } = require('./text');

function pushMatches(results, { id, title, field, content, type = 'doc' }, keywordLower) {
  const text = normalizeContent(content);
  const lowerText = text.toLowerCase();
  let indexMatch = lowerText.indexOf(keywordLower);
  while (indexMatch !== -1) {
    results.push({
      type,
      id,
      title,
      field,
      line: countLine(text, indexMatch),
      preview: buildPreview(text, indexMatch),
    });
    if (results.length >= 200) {
      return true;
    }
    indexMatch = lowerText.indexOf(keywordLower, indexMatch + keywordLower.length);
  }
  return false;
}

async function searchDocs(projectPath, query) {
  const keyword = String(query || '').trim();
  if (!keyword) {
    return [];
  }
  const index = await readIndex(projectPath);
  const lower = keyword.toLowerCase();
  const results = [];

  for (const id of index.order) {
    const entry = index.docs[id];
    if (!entry || !entry.file) {
      continue;
    }
    const filePath = path.join(getStoreDir(projectPath), entry.file);
    const doc = await readDocFile(filePath);
    const text = normalizeContent(doc.text);
    const lowerText = text.toLowerCase();
    let indexMatch = lowerText.indexOf(lower);
    while (indexMatch !== -1) {
      results.push({
        id,
        title: doc.title || 'Untitled',
        line: countLine(text, indexMatch),
        preview: buildPreview(text, indexMatch),
      });
      if (results.length >= 200) {
        return results;
      }
      indexMatch = lowerText.indexOf(lower, indexMatch + lower.length);
    }
  }

  return results;
}

async function searchGlobal(projectPath, query) {
  const keyword = String(query || '').trim();
  if (!keyword) {
    return [];
  }
  const index = await readIndex(projectPath);
  const lower = keyword.toLowerCase();
  const results = [];

  for (const id of index.order) {
    const entry = index.docs[id];
    if (!entry || !entry.file) {
      continue;
    }
    const filePath = path.join(getStoreDir(projectPath), entry.file);
    const doc = await readDocFile(filePath);
    const title = doc.title || 'Untitled';
    if (pushMatches(results, { id, title, field: 'text', content: doc.text }, lower)) {
      return results;
    }
    if (pushMatches(results, { id, title, field: 'notes', content: doc.notes }, lower)) {
      return results;
    }
    if (
      pushMatches(results, { id, title, field: 'synopsis', content: doc.synopsis }, lower)
    ) {
      return results;
    }
    if (pushMatches(results, { id, title, field: 'title', content: doc.title }, lower)) {
      return results;
    }
    if (pushMatches(results, { id, title, field: 'pov', content: doc.pov }, lower)) {
      return results;
    }
  }

  const project = await readProject(projectPath);
  if (project && Array.isArray(project.notes)) {
    for (const note of project.notes) {
      if (!note) {
        continue;
      }
      const noteTitle = String(note.title || 'Untitled');
      if (
        pushMatches(
          results,
          { id: note.id, title: noteTitle, field: 'project-note', content: note.content, type: 'project-note' },
          lower
        )
      ) {
        return results;
      }
      if (
        pushMatches(
          results,
          { id: note.id, title: noteTitle, field: 'project-note-title', content: note.title, type: 'project-note' },
          lower
        )
      ) {
        return results;
      }
    }
  }

  return results;
}

module.exports = {
  searchDocs,
  searchGlobal,
};
