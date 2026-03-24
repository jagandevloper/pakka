const { BrowserWindow } = require('electron');
const path = require('path');

class WindowManager {
  constructor() {
    this.mainWindow = null;
    this.showWindow = true;
    this.stage = 0; // 0 = idle, 1 = processing, 2 = showing results, 3 = settings, 4 = history
    this.darkMode = false;
    this.transparency = 95;
    this.settingsManager = null;
  }

  create(settingsManager = null) {
    this.settingsManager = settingsManager;
    this.stage = 0;
    
    // Get window settings
    const width = settingsManager?.get('windowWidth') || 400;
    const height = settingsManager?.get('windowHeight') || 300;
    
    this.mainWindow = new BrowserWindow({
      width: width,
      height: height,
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
    
    // Initialize dark mode from settings
    if (settingsManager) {
      const theme = settingsManager.get('theme');
      this.darkMode = theme === 'dark' || (theme === 'auto' && this.isSystemDarkMode());
      
      // Initialize transparency from settings
      const transparency = settingsManager.get('transparency');
      if (transparency !== undefined && transparency !== null) {
        this.mainWindow.setOpacity(transparency);
      }
    }

    return this.mainWindow;
  }
  
  isSystemDarkMode() {
    try {
      const { nativeTheme } = require('electron');
      return nativeTheme.shouldUseDarkColors;
    } catch {
      return false;
    }
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
  
  /**
   * Update result during streaming
   */
  updateStreamingResult(content) {
    if (this.mainWindow?.webContents) {
      this.mainWindow.webContents.send('streaming-update', content);
      if (this.stage !== 2) {
        this.mainWindow.setIgnoreMouseEvents(false);
        this.stage = 2;
      }
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
  
  /**
   * Toggle dark mode
   */
  toggleDarkMode() {
    this.darkMode = !this.darkMode;
    if (this.mainWindow?.webContents) {
      this.mainWindow.webContents.send('toggle-dark-mode', this.darkMode);
    }
    this.showNotification(`Theme: ${this.darkMode ? 'Dark' : 'Light'}`);
    
    // Save preference
    if (this.settingsManager) {
      this.settingsManager.set('theme', this.darkMode ? 'dark' : 'light');
    }
  }

  /**
   * Adjust transparency by delta (negative = more opaque, positive = more transparent)
   */
  adjustTransparency(delta) {
    if (!this.transparency) this.transparency = 95;
    this.transparency = Math.max(20, Math.min(100, this.transparency + delta));
    
    if (this.mainWindow) {
      this.mainWindow.setOpacity(this.transparency / 100);
    }
    this.showNotification(`Transparency: ${this.transparency}%`);
    
    // Notify renderer to update UI
    if (this.mainWindow?.webContents) {
      this.mainWindow.webContents.send('transparency-changed', this.transparency);
    }
  }
  
  /**
   * Show history panel
   */
  showHistory(history) {
    if (this.mainWindow?.webContents) {
      this.mainWindow.webContents.send('show-history', history);
      this.mainWindow.setIgnoreMouseEvents(false);
      this.stage = 4;
    }
  }
  
  /**
   * Show settings panel
   */
  showSettings(settings) {
    if (this.mainWindow?.webContents) {
      this.mainWindow.webContents.send('show-settings', settings);
      this.mainWindow.setIgnoreMouseEvents(false);
      this.stage = 3;
    }
  }

  /**
   * Set window opacity/transparency
   */
  setOpacity(value) {
    if (this.mainWindow && !this.mainWindow.isDestroyed()) {
      // Clamp value between 0.2 and 1.0
      const opacity = Math.max(0.2, Math.min(1.0, value));
      this.mainWindow.setOpacity(opacity);
      console.log(`Window opacity set to ${opacity}`);
    }
  }

  /**
   * Get current opacity
   */
  getOpacity() {
    if (this.mainWindow && !this.mainWindow.isDestroyed()) {
      return this.mainWindow.getOpacity();
    }
    return 1.0;
  }
}

module.exports = WindowManager;
