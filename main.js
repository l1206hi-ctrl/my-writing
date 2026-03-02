const { app, BrowserWindow } = require('electron');
const { createMainWindow } = require('./main/window');
const { registerIpcHandlers } = require('./main/ipc');

registerIpcHandlers();

app.whenReady().then(() => {
  app.setAppUserModelId('inkfold.local');
  createMainWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createMainWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});
