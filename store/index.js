const { ensureStore, readProject, writeProject } = require('./io');
const {
  listDocs,
  listBinder,
  readDoc,
  writeDoc,
  createDoc,
  createFolder,
  renameFolder,
  deleteFolder,
  deleteDoc,
  updateOrder,
  moveBinderNode,
  getStats,
} = require('./docs');
const { searchDocs, searchGlobal } = require('./search');
const { listHistory, restoreHistory } = require('./history');
const {
  readCharacters,
  createCharacter,
  updateCharacter,
  deleteCharacter,
} = require('./characters');

module.exports = {
  ensureStore,
  listDocs,
  listBinder,
  readDoc,
  writeDoc,
  createDoc,
  createFolder,
  renameFolder,
  deleteFolder,
  deleteDoc,
  updateOrder,
  moveBinderNode,
  getStats,
  searchDocs,
  searchGlobal,
  readProject,
  writeProject,
  listHistory,
  restoreHistory,
  readCharacters,
  createCharacter,
  updateCharacter,
  deleteCharacter,
};
