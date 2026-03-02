import { LAST_DOC_KEY, LAST_PROJECT_KEY } from './constants.js';

export function saveLastProject(projectPath) {
  if (!projectPath) {
    return;
  }
  localStorage.setItem(LAST_PROJECT_KEY, projectPath);
}

export function loadLastProject() {
  return localStorage.getItem(LAST_PROJECT_KEY) || '';
}

export function clearLastProject() {
  localStorage.removeItem(LAST_PROJECT_KEY);
}

function loadLastDocMap() {
  try {
    const raw = localStorage.getItem(LAST_DOC_KEY);
    const data = raw ? JSON.parse(raw) : {};
    return data && typeof data === 'object' ? data : {};
  } catch (error) {
    return {};
  }
}

function saveLastDocMap(data) {
  localStorage.setItem(LAST_DOC_KEY, JSON.stringify(data));
}

export function saveLastDoc(projectPath, docId) {
  if (!projectPath || !docId) {
    return;
  }
  const data = loadLastDocMap();
  data[projectPath] = docId;
  saveLastDocMap(data);
}

export function loadLastDoc(projectPath) {
  if (!projectPath) {
    return '';
  }
  const data = loadLastDocMap();
  return typeof data[projectPath] === 'string' ? data[projectPath] : '';
}

export function clearLastDoc(projectPath) {
  if (!projectPath) {
    return;
  }
  const data = loadLastDocMap();
  if (data[projectPath]) {
    delete data[projectPath];
    saveLastDocMap(data);
  }
}
