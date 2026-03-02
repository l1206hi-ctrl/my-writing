const fs = require('fs');
const { getStoreDir, getIndexPath, getProjectPath, getCharactersPath } = require('./paths');
const {
  normalizeDoc,
  normalizeIndex,
  normalizeProject,
  isJsonSyntaxError,
  backupCorruptFile,
} = require('./normalize');

async function ensureStore(projectPath) {
  if (!projectPath) {
    return;
  }
  const storeDir = getStoreDir(projectPath);
  await fs.promises.mkdir(storeDir, { recursive: true });
  const indexPath = getIndexPath(projectPath);
  if (!fs.existsSync(indexPath)) {
    const index = normalizeIndex({ order: [], docs: {} });
    await fs.promises.writeFile(indexPath, JSON.stringify(index, null, 2), 'utf-8');
  }
  const projectPathFile = getProjectPath(projectPath);
  if (!fs.existsSync(projectPathFile)) {
    const meta = normalizeProject();
    await fs.promises.writeFile(projectPathFile, JSON.stringify(meta, null, 2), 'utf-8');
  }
  const charactersPath = getCharactersPath(projectPath);
  if (!fs.existsSync(charactersPath)) {
    await fs.promises.writeFile(charactersPath, JSON.stringify([], null, 2), 'utf-8');
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
      return normalizeIndex({ order: [], docs: {} });
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
  await fs.promises.writeFile(indexPath, JSON.stringify(payload, null, 2), 'utf-8');
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
  await fs.promises.writeFile(metaPath, JSON.stringify(payload, null, 2), 'utf-8');
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
  await fs.promises.writeFile(filePath, JSON.stringify(normalized, null, 2), 'utf-8');
  return normalized;
}

module.exports = {
  ensureStore,
  readIndex,
  writeIndex,
  readProject,
  writeProject,
  readDocFile,
  writeDocFile,
};
