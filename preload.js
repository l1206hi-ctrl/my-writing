const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('api', {
  createProject: (name) => ipcRenderer.invoke('project:create', name),
  openProject: () => ipcRenderer.invoke('project:open'),
  openProjectFromPath: (projectPath) =>
    ipcRenderer.invoke('project:openFromPath', projectPath),
  listDocs: (projectPath) => ipcRenderer.invoke('project:listDocs', projectPath),
  listBinder: (projectPath) => ipcRenderer.invoke('project:listBinder', projectPath),
  readDoc: (projectPath, docId) => ipcRenderer.invoke('project:readDoc', projectPath, docId),
  writeDoc: (projectPath, docId, doc, options = {}) =>
    ipcRenderer.invoke('project:writeDoc', projectPath, docId, doc, options),
  createDoc: (projectPath, title, parentId = null) =>
    ipcRenderer.invoke('project:createDoc', projectPath, title, parentId),
  createFolder: (projectPath, title, parentId = null) =>
    ipcRenderer.invoke('project:createFolder', projectPath, title, parentId),
  renameFolder: (projectPath, folderId, title) =>
    ipcRenderer.invoke('project:renameFolder', projectPath, folderId, title),
  deleteFolder: (projectPath, folderId) =>
    ipcRenderer.invoke('project:deleteFolder', projectPath, folderId),
  deleteDoc: (projectPath, docId) => ipcRenderer.invoke('project:deleteDoc', projectPath, docId),
  updateDocOrder: (projectPath, orderList) =>
    ipcRenderer.invoke('project:updateOrder', projectPath, orderList),
  moveBinderNode: (projectPath, nodeId, parentId = null, targetIndex = null) =>
    ipcRenderer.invoke('project:moveBinderNode', projectPath, nodeId, parentId, targetIndex),
  projectStats: (projectPath) => ipcRenderer.invoke('project:stats', projectPath),
  searchDocs: (projectPath, query) =>
    ipcRenderer.invoke('project:searchDocs', projectPath, query),
  globalSearch: (projectPath, query) =>
    ipcRenderer.invoke('project:globalSearch', projectPath, query),
  readProjectMeta: (projectPath) => ipcRenderer.invoke('project:readMeta', projectPath),
  writeProjectMeta: (projectPath, meta) =>
    ipcRenderer.invoke('project:writeMeta', projectPath, meta),
  repairProjectStore: (projectPath) =>
    ipcRenderer.invoke('project:repairStore', projectPath),
  exportProject: (projectPath, format) =>
    ipcRenderer.invoke('project:export', projectPath, format),
  listCharacters: (projectPath) =>
    ipcRenderer.invoke('project:listCharacters', projectPath),
  createCharacter: (projectPath, data) =>
    ipcRenderer.invoke('project:createCharacter', projectPath, data),
  updateCharacter: (projectPath, data) =>
    ipcRenderer.invoke('project:updateCharacter', projectPath, data),
  deleteCharacter: (projectPath, characterId) =>
    ipcRenderer.invoke('project:deleteCharacter', projectPath, characterId),
  listHistory: (projectPath, docId) =>
    ipcRenderer.invoke('project:listHistory', projectPath, docId),
  restoreHistory: (projectPath, docId, versionId) =>
    ipcRenderer.invoke('project:restoreHistory', projectPath, docId, versionId),
});
