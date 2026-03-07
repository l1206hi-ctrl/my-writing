const fs = require('fs');
const path = require('path');
const { getStoreDir, getIndexPath, getProjectPath, getCharactersPath } = require('./paths');
const {
  normalizeDoc,
  normalizeIndex,
  normalizeProject,
  isJsonSyntaxError,
  backupCorruptFile,
} = require('./normalize');

const RESERVED_STORE_FILES = new Set(['index.json', 'project.json', 'characters.json']);

function makeTempPath(filePath) {
  const dir = path.dirname(filePath);
  const base = path.basename(filePath);
  const rand = Math.random().toString(16).slice(2, 10);
  return path.join(dir, `${base}.tmp-${process.pid}-${Date.now()}-${rand}`);
}

async function writeFileAtomic(filePath, data, encoding = 'utf-8') {
  const tempPath = makeTempPath(filePath);
  let wroteTemp = false;
  try {
    await fs.promises.writeFile(tempPath, data, encoding);
    wroteTemp = true;
    await fs.promises.rename(tempPath, filePath);
  } catch (error) {
    if (wroteTemp) {
      try {
        await fs.promises.rm(tempPath, { force: true });
      } catch (_cleanupError) {
        // Ignore cleanup errors.
      }
    }
    throw error;
  }
}

async function writeJsonAtomic(filePath, payload) {
  await writeFileAtomic(filePath, JSON.stringify(payload, null, 2), 'utf-8');
}

function makeEmptyIndex() {
  return normalizeIndex({ order: [], docs: {} });
}

async function ensureStore(projectPath) {
  if (!projectPath) {
    return;
  }
  const storeDir = getStoreDir(projectPath);
  await fs.promises.mkdir(storeDir, { recursive: true });
  const indexPath = getIndexPath(projectPath);
  if (!fs.existsSync(indexPath)) {
    await writeJsonAtomic(indexPath, makeEmptyIndex());
  }
  const projectPathFile = getProjectPath(projectPath);
  if (!fs.existsSync(projectPathFile)) {
    await writeJsonAtomic(projectPathFile, normalizeProject());
  }
  const charactersPath = getCharactersPath(projectPath);
  if (!fs.existsSync(charactersPath)) {
    await writeJsonAtomic(charactersPath, []);
  }
}

async function readIndex(projectPath) {
  await ensureStore(projectPath);
  const indexPath = getIndexPath(projectPath);
  try {
    const raw = await fs.promises.readFile(indexPath, 'utf-8');
    return normalizeIndex(JSON.parse(raw));
  } catch (error) {
    if (error && error.code === 'ENOENT') {
      return makeEmptyIndex();
    }
    if (isJsonSyntaxError(error)) {
      await backupCorruptFile(indexPath);
      throw new Error('Project index is corrupted.');
    }
    throw error;
  }
}

async function writeIndex(projectPath, index) {
  const indexPath = getIndexPath(projectPath);
  const payload = normalizeIndex(index);
  await writeJsonAtomic(indexPath, payload);
}

async function readProject(projectPath) {
  await ensureStore(projectPath);
  const metaPath = getProjectPath(projectPath);
  try {
    const raw = await fs.promises.readFile(metaPath, 'utf-8');
    return normalizeProject(JSON.parse(raw));
  } catch (error) {
    if (error && error.code === 'ENOENT') {
      return normalizeProject();
    }
    if (isJsonSyntaxError(error)) {
      await backupCorruptFile(metaPath);
      throw new Error('Project notes file is corrupted.');
    }
    throw error;
  }
}

async function writeProject(projectPath, meta) {
  await ensureStore(projectPath);
  const metaPath = getProjectPath(projectPath);
  const payload = normalizeProject(meta);
  await writeJsonAtomic(metaPath, payload);
  return payload;
}

async function readDocFile(filePath, options = {}) {
  try {
    const raw = await fs.promises.readFile(filePath, 'utf-8');
    return normalizeDoc(JSON.parse(raw));
  } catch (error) {
    if (error && error.code === 'ENOENT') {
      if (options.allowMissing) {
        return normalizeDoc();
      }
      throw new Error('Document file is missing.');
    }
    if (isJsonSyntaxError(error)) {
      await backupCorruptFile(filePath);
      throw new Error('Document file is corrupted.');
    }
    throw error;
  }
}

async function writeDocFile(filePath, doc) {
  const normalized = normalizeDoc(doc);
  await writeJsonAtomic(filePath, normalized);
  return normalized;
}

async function isCorruptedJsonFile(filePath) {
  try {
    const raw = await fs.promises.readFile(filePath, 'utf-8');
    JSON.parse(raw);
    return false;
  } catch (error) {
    if (error && error.code === 'ENOENT') {
      return false;
    }
    if (isJsonSyntaxError(error)) {
      return true;
    }
    throw error;
  }
}

function createRecoveredDocFromId(docId) {
  const label = String(docId || 'untitled')
    .replace(/^doc[_-]?/i, '')
    .replace(/[_-]+/g, ' ')
    .trim();
  const title = label ? `Recovered ${label}` : 'Recovered chapter';
  return normalizeDoc({ title });
}

async function listStoreDocFiles(projectPath) {
  const storeDir = getStoreDir(projectPath);
  let entries = [];
  try {
    entries = await fs.promises.readdir(storeDir, { withFileTypes: true });
  } catch (error) {
    return [];
  }
  return entries
    .filter((entry) => entry && entry.isFile() && entry.name.endsWith('.json'))
    .map((entry) => entry.name)
    .filter((fileName) => !RESERVED_STORE_FILES.has(fileName))
    .filter((fileName) => path.extname(fileName).toLowerCase() === '.json');
}

async function rebuildIndexFromStore(projectPath) {
  const files = await listStoreDocFiles(projectPath);
  const docs = {};
  const nodes = {};
  const rootIds = [];
  files
    .slice()
    .sort((a, b) => a.localeCompare(b))
    .forEach((fileName) => {
      const docId = path.basename(fileName, '.json');
      if (!docId) {
        return;
      }
      docs[docId] = { id: docId, file: fileName };
      let nodeId = docId;
      let attempt = 1;
      while (nodes[nodeId]) {
        nodeId = `${docId}_${attempt}`;
        attempt += 1;
      }
      nodes[nodeId] = {
        id: nodeId,
        type: 'doc',
        docId,
        parentId: null,
      };
      rootIds.push(nodeId);
    });
  return normalizeIndex({ docs, nodes, rootIds });
}

async function repairStore(projectPath) {
  await ensureStore(projectPath);
  const repaired = [];

  const indexPath = getIndexPath(projectPath);
  if (await isCorruptedJsonFile(indexPath)) {
    await backupCorruptFile(indexPath);
    const rebuilt = await rebuildIndexFromStore(projectPath);
    await writeJsonAtomic(indexPath, rebuilt);
    repaired.push('index.json');
  }

  const projectMetaPath = getProjectPath(projectPath);
  if (await isCorruptedJsonFile(projectMetaPath)) {
    await backupCorruptFile(projectMetaPath);
    await writeJsonAtomic(projectMetaPath, normalizeProject());
    repaired.push('project.json');
  }

  const charactersPath = getCharactersPath(projectPath);
  if (await isCorruptedJsonFile(charactersPath)) {
    await backupCorruptFile(charactersPath);
    await writeJsonAtomic(charactersPath, []);
    repaired.push('characters.json');
  }

  const storeDir = getStoreDir(projectPath);
  const docFiles = await listStoreDocFiles(projectPath);
  for (const fileName of docFiles) {
    const filePath = path.join(storeDir, fileName);
    if (!(await isCorruptedJsonFile(filePath))) {
      continue;
    }
    await backupCorruptFile(filePath);
    const docId = path.basename(fileName, '.json');
    await writeJsonAtomic(filePath, createRecoveredDocFromId(docId));
    repaired.push(fileName);
  }

  return { repaired };
}

module.exports = {
  writeFileAtomic,
  writeJsonAtomic,
  ensureStore,
  readIndex,
  writeIndex,
  readProject,
  writeProject,
  readDocFile,
  writeDocFile,
  repairStore,
};
