const path = require('path');
const { STORE_DIR, INDEX_FILE, PROJECT_FILE, HISTORY_DIR, CHARACTERS_FILE } = require('./constants');

function getStoreDir(projectPath) {
  return path.join(projectPath, STORE_DIR);
}

function getIndexPath(projectPath) {
  return path.join(getStoreDir(projectPath), INDEX_FILE);
}

function getProjectPath(projectPath) {
  return path.join(getStoreDir(projectPath), PROJECT_FILE);
}

function getHistoryDir(projectPath, docId) {
  return path.join(getStoreDir(projectPath), HISTORY_DIR, docId);
}

function getCharactersPath(projectPath) {
  return path.join(getStoreDir(projectPath), CHARACTERS_FILE);
}

module.exports = {
  getStoreDir,
  getIndexPath,
  getProjectPath,
  getHistoryDir,
  getCharactersPath,
};
