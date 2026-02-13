const { app, BrowserWindow } = require('electron');
const ConfigManager = require('./config/configManager');
const WindowManager = require('./ui/windowManager');
const ScreenshotService = require('./services/screenshotService');
const ApiService = require('./services/apiService');
const ShortcutManager = require('./shortcuts/shortcutManager');

class OACoderApp {
  constructor() {
    this.configManager = new ConfigManager();
    this.windowManager = new WindowManager();
    this.screenshotService = new ScreenshotService();
    this.apiService = new ApiService(this.configManager);
    this.shortcutManager = null;
  }

  initialize() {
    // Load configuration
    if (!this.configManager.load()) {
      console.error("Failed to load configuration. Exiting...");
      app.quit();
      return false;
    }

    // Create main window
    this.windowManager.create();

    // Register shortcuts
    this.shortcutManager = new ShortcutManager(
      this.windowManager,
      this.screenshotService,
      this.apiService,
      this.configManager
    );
    this.shortcutManager.registerAll();

    return true;
  }

  cleanup() {
    if (this.shortcutManager) {
      this.shortcutManager.unregisterAll();
    }
  }
}

// Application lifecycle
let oaCoderApp;

app.whenReady().then(() => {
  oaCoderApp = new OACoderApp();
  oaCoderApp.initialize();
});

app.on('window-all-closed', () => {
  if (oaCoderApp) {
    oaCoderApp.cleanup();
  }
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    if (oaCoderApp) {
      oaCoderApp.initialize();
    }
  }
});

module.exports = OACoderApp;
