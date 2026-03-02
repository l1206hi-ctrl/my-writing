const fs = require('fs');
const { getCharactersPath } = require('./paths');
const { ensureStore } = require('./io');
const { normalizeCharacters, isJsonSyntaxError, backupCorruptFile } = require('./normalize');

async function readCharacters(projectPath) {
  if (!projectPath) {
    return [];
  }
  await ensureStore(projectPath);
  const filePath = getCharactersPath(projectPath);
  try {
    const raw = await fs.promises.readFile(filePath, 'utf-8');
    return normalizeCharacters(JSON.parse(raw));
  } catch (error) {
    if (error && error.code === 'ENOENT') {
      return [];
    }
    if (isJsonSyntaxError(error)) {
      await backupCorruptFile(filePath);
      throw new Error('Character list is corrupted.');
    }
    throw error;
  }
}

async function writeCharacters(projectPath, characters) {
  if (!projectPath) {
    return [];
  }
  await ensureStore(projectPath);
  const filePath = getCharactersPath(projectPath);
  const normalized = normalizeCharacters(characters);
  await fs.promises.writeFile(filePath, JSON.stringify(normalized, null, 2), 'utf-8');
  return normalized;
}

function mergeCharacter(entry, updates) {
  const base = { ...entry, ...(updates || {}) };
  const normalized = normalizeCharacters([base]);
  return normalized[0];
}

async function createCharacter(projectPath, payload) {
  if (!projectPath || !payload) {
    return null;
  }
  const characters = await readCharacters(projectPath);
  const [entry] = normalizeCharacters([payload]);
  characters.push(entry);
  await writeCharacters(projectPath, characters);
  return entry;
}

async function updateCharacter(projectPath, payload) {
  if (!projectPath || !payload || !payload.id) {
    return null;
  }
  const characters = await readCharacters(projectPath);
  const index = characters.findIndex((item) => item.id === payload.id);
  if (index === -1) {
    return null;
  }
  characters[index] = mergeCharacter(characters[index], payload);
  await writeCharacters(projectPath, characters);
  return characters[index];
}

async function deleteCharacter(projectPath, characterId) {
  if (!projectPath || !characterId) {
    return false;
  }
  const characters = await readCharacters(projectPath);
  const filtered = characters.filter((item) => item.id !== characterId);
  if (filtered.length === characters.length) {
    return false;
  }
  await writeCharacters(projectPath, filtered);
  return true;
}

module.exports = {
  readCharacters,
  writeCharacters,
  createCharacter,
  updateCharacter,
  deleteCharacter,
};
