const fs = require('fs');
const path = require('path');

const SKIP_DIRS = new Set(['.git', 'node_modules']);
const ALLOWED_EXT = new Set(['.md', '.txt', '.rtf', '.markdown']);
const META_FILE = '.inkfold.json';

function toPosix(value) {
  return value.split(path.sep).join('/');
}

function fromPosix(value) {
  if (!value) {
    return '';
  }
  return value.split('/').join(path.sep);
}

function normalizeRelPath(value) {
  const normalized = String(value || '')
    .trim()
    .replace(/\\/g, '/')
    .replace(/^\/+/, '')
    .replace(/\/+$/, '');
  if (!normalized) {
    return '';
  }
  if (normalized.split('/').some((part) => part === '..')) {
    throw new Error('Invalid path.');
  }
  return normalized;
}

function ensureSimpleName(value) {
  const name = String(value || '').trim();
  if (!name || /[\\/]/.test(name)) {
    throw new Error('Invalid name.');
  }
  return name;
}

function isSafeProjectChild(projectPath, targetPath) {
  const relative = path.relative(projectPath, targetPath);
  if (!relative || relative.startsWith('..') || path.isAbsolute(relative)) {
    return false;
  }
  return true;
}

function readMeta(projectPath) {
  const metaPath = path.join(projectPath, META_FILE);
  if (!fs.existsSync(metaPath)) {
    return { order: {} };
  }
  try {
    const parsed = JSON.parse(fs.readFileSync(metaPath, 'utf-8'));
    if (!parsed || typeof parsed !== 'object') {
      return { order: {} };
    }
    if (!parsed.order || typeof parsed.order !== 'object') {
      parsed.order = {};
    }
    return parsed;
  } catch (error) {
    return { order: {} };
  }
}

async function writeMeta(projectPath, meta) {
  const metaPath = path.join(projectPath, META_FILE);
  await fs.promises.writeFile(metaPath, JSON.stringify(meta, null, 2), 'utf-8');
}

function applyOrder(items, orderList) {
  if (!Array.isArray(orderList) || orderList.length === 0) {
    return items.sort((a, b) => a.name.localeCompare(b.name));
  }
  const map = new Map(items.map((item) => [item.name, item]));
  const ordered = [];
  for (const name of orderList) {
    const item = map.get(name);
    if (item) {
      ordered.push(item);
      map.delete(name);
    }
  }
  const rest = Array.from(map.values()).sort((a, b) => a.name.localeCompare(b.name));
  return ordered.concat(rest);
}

function ensureOrderEntry(meta, parentRelPath) {
  if (!meta.order[parentRelPath]) {
    meta.order[parentRelPath] = [];
  }
  return meta.order[parentRelPath];
}

function addToOrder(meta, parentRelPath, name) {
  const list = ensureOrderEntry(meta, parentRelPath);
  if (!list.includes(name)) {
    list.push(name);
  }
}

function removeFromOrder(meta, parentRelPath, name) {
  const list = meta.order[parentRelPath];
  if (!Array.isArray(list)) {
    return;
  }
  meta.order[parentRelPath] = list.filter((item) => item !== name);
}

function renameInOrder(meta, parentRelPath, oldName, newName) {
  const list = meta.order[parentRelPath];
  if (!Array.isArray(list)) {
    return;
  }
  meta.order[parentRelPath] = list.map((item) => (item === oldName ? newName : item));
}

function renameOrderPaths(meta, oldRel, newRel) {
  const updated = {};
  for (const [key, value] of Object.entries(meta.order)) {
    let newKey = key;
    if (key === oldRel || key.startsWith(`${oldRel}/`)) {
      newKey = newRel + key.slice(oldRel.length);
    }
    updated[newKey] = value;
  }
  meta.order = updated;
}

function removeOrderPaths(meta, relPath) {
  for (const key of Object.keys(meta.order)) {
    if (key === relPath || key.startsWith(`${relPath}/`)) {
      delete meta.order[key];
    }
  }
}

function buildTree(projectPath, relDir, meta) {
  const absDir = path.join(projectPath, fromPosix(relDir));
  let entries = [];
  try {
    entries = fs.readdirSync(absDir, { withFileTypes: true });
  } catch (error) {
    return [];
  }

  const items = [];
  for (const entry of entries) {
    if (entry.isDirectory()) {
      if (SKIP_DIRS.has(entry.name)) {
        continue;
      }
      const relPath = relDir ? `${relDir}/${entry.name}` : entry.name;
      const fullPath = path.join(absDir, entry.name);
      const children = buildTree(projectPath, relPath, meta);
      items.push({
        type: 'folder',
        name: entry.name,
        path: fullPath,
        relPath,
        parentRelPath: relDir,
        children,
      });
      continue;
    }

    if (entry.name === META_FILE) {
      continue;
    }

    const ext = path.extname(entry.name).toLowerCase();
    if (ALLOWED_EXT.size > 0 && !ALLOWED_EXT.has(ext)) {
      continue;
    }
    const fullPath = path.join(absDir, entry.name);
    const relPath = relDir ? `${relDir}/${entry.name}` : entry.name;
    items.push({
      type: 'file',
      name: entry.name,
      path: fullPath,
      relPath,
      parentRelPath: relDir,
    });
  }

  return applyOrder(items, meta.order[relDir] || []);
}

function listProjectTree(projectPath) {
  const meta = readMeta(projectPath);
  return buildTree(projectPath, '', meta);
}

function collectFileItems(projectPath, relDir, items) {
  const absDir = path.join(projectPath, fromPosix(relDir));
  let entries = [];
  try {
    entries = fs.readdirSync(absDir, { withFileTypes: true });
  } catch (error) {
    return;
  }
  for (const entry of entries) {
    if (entry.isDirectory()) {
      if (SKIP_DIRS.has(entry.name)) {
        continue;
      }
      const nextRel = relDir ? `${relDir}/${entry.name}` : entry.name;
      collectFileItems(projectPath, nextRel, items);
      continue;
    }
    if (entry.name === META_FILE) {
      continue;
    }
    const ext = path.extname(entry.name).toLowerCase();
    if (ALLOWED_EXT.size > 0 && !ALLOWED_EXT.has(ext)) {
      continue;
    }
    const fullPath = path.join(absDir, entry.name);
    const relPath = relDir ? `${relDir}/${entry.name}` : entry.name;
    items.push({ path: fullPath, relPath });
  }
}

function buildPreview(content, matchIndex) {
  const lineStart = Math.max(0, content.lastIndexOf('\n', matchIndex) + 1);
  let lineEnd = content.indexOf('\n', matchIndex);
  if (lineEnd === -1) {
    lineEnd = content.length;
  }
  let line = content.slice(lineStart, lineEnd).trim();
  const relative = matchIndex - lineStart;
  if (line.length > 160) {
    const sliceStart = Math.max(0, relative - 40);
    const sliceEnd = Math.min(line.length, sliceStart + 120);
    let trimmed = line.slice(sliceStart, sliceEnd);
    if (sliceStart > 0) {
      trimmed = `...${trimmed}`;
    }
    if (sliceEnd < line.length) {
      trimmed = `${trimmed}...`;
    }
    line = trimmed;
  }
  return line;
}

function normalizeContent(value) {
  return String(value || '').replace(/\r\n/g, '\n').replace(/\r/g, '\n');
}

function countCharacters(content) {
  const normalized = normalizeContent(content);
  return {
    withSpaces: normalized.length,
    withoutSpaces: normalized.replace(/\s/g, '').length,
  };
}

function countLine(content, index) {
  return content.slice(0, index).split(/\r?\n/).length;
}

module.exports = {
  SKIP_DIRS,
  ALLOWED_EXT,
  META_FILE,
  toPosix,
  fromPosix,
  normalizeRelPath,
  ensureSimpleName,
  isSafeProjectChild,
  readMeta,
  writeMeta,
  applyOrder,
  ensureOrderEntry,
  addToOrder,
  removeFromOrder,
  renameInOrder,
  renameOrderPaths,
  removeOrderPaths,
  buildTree,
  listProjectTree,
  collectFileItems,
  buildPreview,
  normalizeContent,
  countCharacters,
  countLine,
};
