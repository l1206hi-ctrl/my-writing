const { dialog, ipcMain } = require('electron');
const fs = require('fs');
const path = require('path');
const store = require('../projectStore');
const { ensureSimpleName } = require('./projectUtils');
const { exportProject } = require('./exportProject');

function registerIpcHandlers() {
  ipcMain.handle('project:create', async (_event, projectName) => {
    const result = await dialog.showOpenDialog({
      properties: ['openDirectory', 'createDirectory'],
    });
    if (result.canceled || result.filePaths.length === 0) {
      return null;
    }
    const baseDir = result.filePaths[0];
    const rawName = String(projectName || '').trim();
    const name = rawName ? ensureSimpleName(rawName) : '';
    const projectPath = name ? path.join(baseDir, name) : baseDir;

    if (name) {
      if (fs.existsSync(projectPath)) {
        throw new Error('Project folder already exists.');
      }
      await fs.promises.mkdir(projectPath, { recursive: true });
    }
    await store.ensureStore(projectPath);
    return { path: projectPath, name: path.basename(projectPath) };
  });

  ipcMain.handle('project:open', async () => {
    const result = await dialog.showOpenDialog({
      properties: ['openDirectory'],
    });
    if (result.canceled || result.filePaths.length === 0) {
      return null;
    }
    const projectPath = result.filePaths[0];
    await store.ensureStore(projectPath);
    return { path: projectPath, name: path.basename(projectPath) };
  });

  ipcMain.handle('project:openFromPath', async (_event, projectPath) => {
    const targetPath = String(projectPath || '').trim();
    if (!targetPath) {
      return null;
    }
    let stats = null;
    try {
      stats = await fs.promises.stat(targetPath);
    } catch (error) {
      return null;
    }
    if (!stats.isDirectory()) {
      return null;
    }
    await store.ensureStore(targetPath);
    return { path: targetPath, name: path.basename(targetPath) };
  });

  ipcMain.handle('project:listDocs', async (_event, projectPath) => {
    if (!projectPath) {
      return [];
    }
    return store.listDocs(projectPath);
  });

  ipcMain.handle('project:listBinder', async (_event, projectPath) => {
    if (!projectPath) {
      return { rootIds: [], nodes: {}, order: [] };
    }
    return store.listBinder(projectPath);
  });

  ipcMain.handle('project:readDoc', async (_event, projectPath, docId) => {
    if (!projectPath || !docId) {
      return null;
    }
    return store.readDoc(projectPath, docId);
  });

  ipcMain.handle('project:writeDoc', async (_event, projectPath, docId, doc, options = {}) => {
    if (!projectPath || !docId) {
      return null;
    }
    return store.writeDoc(projectPath, docId, doc, options);
  });

  ipcMain.handle('project:createDoc', async (_event, projectPath, title, parentId = null) => {
    if (!projectPath) {
      return null;
    }
    return store.createDoc(projectPath, title, { parentId });
  });

  ipcMain.handle('project:createFolder', async (_event, projectPath, title, parentId = null) => {
    if (!projectPath) {
      return null;
    }
    return store.createFolder(projectPath, title, parentId);
  });

  ipcMain.handle('project:renameFolder', async (_event, projectPath, folderId, title) => {
    if (!projectPath || !folderId) {
      return null;
    }
    return store.renameFolder(projectPath, folderId, title);
  });

  ipcMain.handle('project:deleteFolder', async (_event, projectPath, folderId) => {
    if (!projectPath || !folderId) {
      return false;
    }
    return store.deleteFolder(projectPath, folderId);
  });

  ipcMain.handle('project:deleteDoc', async (_event, projectPath, docId) => {
    if (!projectPath || !docId) {
      return null;
    }
    return store.deleteDoc(projectPath, docId);
  });

  ipcMain.handle('project:updateOrder', async (_event, projectPath, orderList) => {
    if (!projectPath) {
      return null;
    }
    return store.updateOrder(projectPath, orderList);
  });

  ipcMain.handle(
    'project:moveBinderNode',
    async (_event, projectPath, nodeId, parentId = null, targetIndex = null) => {
      if (!projectPath || !nodeId) {
        return false;
      }
      return store.moveBinderNode(projectPath, nodeId, parentId, targetIndex);
    }
  );

  ipcMain.handle('project:stats', async (_event, projectPath) => {
    if (!projectPath) {
      return { totals: { withSpaces: 0, withoutSpaces: 0 }, perDoc: [] };
    }
    return store.getStats(projectPath);
  });

  ipcMain.handle('project:searchDocs', async (_event, projectPath, query) => {
    if (!projectPath) {
      return [];
    }
    return store.searchDocs(projectPath, query);
  });

  ipcMain.handle('project:globalSearch', async (_event, projectPath, query) => {
    if (!projectPath) {
      return [];
    }
    return store.searchGlobal(projectPath, query);
  });

  ipcMain.handle('project:listHistory', async (_event, projectPath, docId) => {
    if (!projectPath || !docId) {
      return [];
    }
    return store.listHistory(projectPath, docId);
  });

  ipcMain.handle('project:restoreHistory', async (_event, projectPath, docId, versionId) => {
    if (!projectPath || !docId || !versionId) {
      return null;
    }
    return store.restoreHistory(projectPath, docId, versionId);
  });

  ipcMain.handle('project:readMeta', async (_event, projectPath) => {
    if (!projectPath) {
      return null;
    }
    return store.readProject(projectPath);
  });

  ipcMain.handle('project:writeMeta', async (_event, projectPath, meta) => {
    if (!projectPath) {
      return null;
    }
    return store.writeProject(projectPath, meta);
  });

  ipcMain.handle('project:export', async (_event, projectPath, format) => {
    if (!projectPath) {
      return null;
    }
    return exportProject(projectPath, format);
  });

  ipcMain.handle('project:listCharacters', async (_event, projectPath) => {
    if (!projectPath) {
      return [];
    }
    return store.readCharacters(projectPath);
  });

  ipcMain.handle('project:createCharacter', async (_event, projectPath, data) => {
    if (!projectPath || !data) {
      return null;
    }
    return store.createCharacter(projectPath, data);
  });

  ipcMain.handle('project:updateCharacter', async (_event, projectPath, data) => {
    if (!projectPath || !data) {
      return null;
    }
    return store.updateCharacter(projectPath, data);
  });

  ipcMain.handle('project:deleteCharacter', async (_event, projectPath, characterId) => {
    if (!projectPath || !characterId) {
      return false;
    }
    return store.deleteCharacter(projectPath, characterId);
  });
}

module.exports = {
  registerIpcHandlers,
};
