const path = require('path');
const { BrowserWindow } = require('electron');

function createMainWindow() {
  const rootDir = path.join(__dirname, '..');
  const win = new BrowserWindow({
    width: 1200,
    height: 780,
    minWidth: 980,
    minHeight: 640,
    backgroundColor: '#f5efe6',
    webPreferences: {
      preload: path.join(rootDir, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  win.loadFile(path.join(rootDir, 'index.html'));
}

module.exports = {
  createMainWindow,
};
