const { BrowserWindow } = require('electron');
const path = require('path');

class WindowManager {
  constructor() {
    this.mainWindow = null;
    this.showWindow = true;
    this.stage = 0; // 0 = idle, 2 = showing results
  }

  create() {
    this.stage = 0;
    this.mainWindow = new BrowserWindow({
      width: 400,
      height: 300,
      minWidth: 300,
      minHeight: 200,
      maxWidth: 1200,
      maxHeight: 900,
      webPreferences: {
        nodeIntegration: true,
        contextIsolation: false
      },
      frame: false,
      transparent: true,
      alwaysOnTop: true,
      paintWhenInitiallyHidden: true,
      contentProtection: true,
      type: 'toolbar',
      resizable: true,
      skipTaskbar: true,
      focusable: false,
      minimizable: false,
      maximizable: false,
      hasShadow: false
    });

    this.mainWindow.loadFile(path.join(__dirname, '../../index.html'));
    this.mainWindow.setContentProtection(true);
    this.mainWindow.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });
    this.mainWindow.setAlwaysOnTop(true, 'screen-saver', 1);
    this.mainWindow.setIgnoreMouseEvents(true, { forward: true });

    // Prevent window from hiding when it loses focus - keep it as overlay
    this.mainWindow.on('blur', () => {
      if (this.showWindow && this.mainWindow && !this.mainWindow.isDestroyed()) {
        this.mainWindow.setAlwaysOnTop(true, 'screen-saver', 1);
      }
    });

    // Prevent minimize
    this.mainWindow.on('minimize', (event) => {
      event.preventDefault();
      if (this.showWindow) {
        this.mainWindow.showInactive();
      }
    });

    // Keep window visible - periodic check every 2 seconds
    this.visibilityInterval = setInterval(() => {
      if (this.showWindow && this.mainWindow && !this.mainWindow.isDestroyed()) {
        if (!this.mainWindow.isVisible()) {
          this.mainWindow.showInactive();
        }
        this.mainWindow.setAlwaysOnTop(true, 'screen-saver', 1);
      }
    }, 2000);

    return this.mainWindow;
  }

  updateInstruction(instruction) {
    if (this.mainWindow?.webContents) {
      this.mainWindow.webContents.send('update-instruction', instruction);
    }
  }

  hideInstruction() {
    if (this.mainWindow?.webContents) {
      this.mainWindow.webContents.send('hide-instruction');
    }
  }

  showNotification(message) {
    if (this.mainWindow?.webContents) {
      this.mainWindow.webContents.send('show-notification', message);
    }
  }

  showResult(content) {
    if (this.mainWindow?.webContents) {
      this.mainWindow.webContents.send('analysis-result', content);
      this.mainWindow.setIgnoreMouseEvents(false);
      this.stage = 2;
    }
  }

  showError(error) {
    if (this.mainWindow?.webContents) {
      this.mainWindow.webContents.send('error', error);
      this.mainWindow.setIgnoreMouseEvents(false);
    }
  }

  show() {
    this.mainWindow.showInactive();
    if (this.stage === 2) {
      this.mainWindow.webContents.send('show-app');
      this.mainWindow.setIgnoreMouseEvents(false);
    } else {
      this.updateInstruction("Ctrl+Shift+S: Screenshot | Ctrl+Shift+1: API Key | Ctrl+Shift+2: Model | Arrows: Move");
      this.mainWindow.setIgnoreMouseEvents(true, { forward: true });
    }
    this.showWindow = true;
  }

  hide() {
    this.mainWindow.hide();
    this.mainWindow.setIgnoreMouseEvents(true, { forward: true });
    this.mainWindow.webContents.send('hide-app');
    this.showWindow = false;
  }

  move(direction) {
    if (!this.mainWindow) return;
    
    const bounds = this.mainWindow.getBounds();
    const moveStep = 50;
    
    switch(direction) {
      case 'up':
        this.mainWindow.setBounds({ ...bounds, y: bounds.y - moveStep });
        break;
      case 'down':
        this.mainWindow.setBounds({ ...bounds, y: bounds.y + moveStep });
        break;
      case 'left':
        this.mainWindow.setBounds({ ...bounds, x: bounds.x - moveStep });
        break;
      case 'right':
        this.mainWindow.setBounds({ ...bounds, x: bounds.x + moveStep });
        break;
    }
  }

  copyContent() {
    if (this.mainWindow?.webContents) {
      this.mainWindow.webContents.send('copy-content');
    }
  }

  clear() {
    if (this.mainWindow?.webContents) {
      this.mainWindow.webContents.send('clear-result');
      this.updateInstruction("Ctrl+Shift+S: Screenshot | Ctrl+Shift+1: API Key | Ctrl+Shift+2: Model | Arrows: Move");
      this.stage = 0;
      this.mainWindow.setIgnoreMouseEvents(true, { forward: true });
    }
  }

  getWindow() {
    return this.mainWindow;
  }

  isShowing() {
    return this.showWindow;
  }
}

module.exports = WindowManager;
