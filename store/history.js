const fs = require('fs');
const path = require('path');
const { HISTORY_LIMIT, HISTORY_INTERVAL } = require('./constants');
const { getHistoryDir, getStoreDir } = require('./paths');
const { normalizeDoc } = require('./normalize');
const { readIndex, writeDocFile, writeJsonAtomic } = require('./io');

async function listHistoryEntries(historyDir) {
  if (!fs.existsSync(historyDir)) {
    return [];
  }
  const files = await fs.promises.readdir(historyDir);
  return files
    .filter((name) => name.endsWith('.json'))
    .map((name) => {
      const base = path.basename(name, '.json');
      const timestamp = Number(base);
      return Number.isFinite(timestamp) ? { id: base, timestamp, file: name } : null;
    })
    .filter(Boolean)
    .sort((a, b) => b.timestamp - a.timestamp);
}

async function maybeSaveHistorySnapshot(projectPath, docId, doc, options = {}) {
  const historyDir = getHistoryDir(projectPath, docId);
  await fs.promises.mkdir(historyDir, { recursive: true });
  const entries = await listHistoryEntries(historyDir);
  const latest = entries[0];
  const now = Date.now();
  if (!options.forceHistory && latest && now - latest.timestamp < HISTORY_INTERVAL) {
    return;
  }
  const payload = normalizeDoc(doc);
  if (latest) {
    try {
      const lastRaw = await fs.promises.readFile(path.join(historyDir, latest.file), 'utf-8');
      const lastDoc = JSON.parse(lastRaw);
      if (JSON.stringify(payload) === JSON.stringify(lastDoc)) {
        return;
      }
    } catch (error) {
      // Ignore compare errors.
    }
  }
  const stamp = String(now);
  const filePath = path.join(historyDir, `${stamp}.json`);
  await writeJsonAtomic(filePath, payload);
  const updated = await listHistoryEntries(historyDir);
  if (updated.length > HISTORY_LIMIT) {
    const overflow = updated.slice(HISTORY_LIMIT);
    await Promise.all(
      overflow.map((entry) =>
        fs.promises.rm(path.join(historyDir, entry.file), { force: true })
      )
    );
  }
}

async function listHistory(projectPath, docId) {
  const historyDir = getHistoryDir(projectPath, docId);
  const entries = await listHistoryEntries(historyDir);
  return entries.map((entry) => ({ id: entry.id, timestamp: entry.timestamp }));
}

async function restoreHistory(projectPath, docId, versionId) {
  const historyDir = getHistoryDir(projectPath, docId);
  const filePath = path.join(historyDir, `${versionId}.json`);
  if (!fs.existsSync(filePath)) {
    return null;
  }
  try {
    const raw = await fs.promises.readFile(filePath, 'utf-8');
    const doc = normalizeDoc(JSON.parse(raw));
    const index = await readIndex(projectPath);
    const entry = index.docs[docId];
    if (!entry || !entry.file) {
      return null;
    }
    const targetPath = path.join(getStoreDir(projectPath), entry.file);
    await writeDocFile(targetPath, doc);
    return doc;
  } catch (error) {
    return null;
  }
}

module.exports = {
  listHistoryEntries,
  maybeSaveHistorySnapshot,
  listHistory,
  restoreHistory,
};
