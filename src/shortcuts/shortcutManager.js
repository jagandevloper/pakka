const { globalShortcut } = require('electron');

class ShortcutManager {
  constructor(windowManager, screenshotService, apiService, configManager) {
    this.windowManager = windowManager;
    this.screenshotService = screenshotService;
    this.apiService = apiService;
    this.configManager = configManager;
  }

  registerAll() {
    // Ctrl+Shift+S => Screenshot and process
    globalShortcut.register('CommandOrControl+Shift+S', async () => {
      try {
        this.windowManager.hideInstruction();
        const screenshot = await this.screenshotService.capture(this.windowManager.getWindow());
        
        const result = await this.apiService.processScreenshot(screenshot);
        
        if (result.retry) {
          this.windowManager.showNotification(`Rate limited. Retry in ${result.waitTime/1000}s...`);
        } else {
          this.windowManager.showResult(result);
        }
      } catch (error) {
        console.error("Screenshot error:", error);
        this.windowManager.showError(error.message);
      }
    });

    // Ctrl+Shift+1 => Switch API key
    globalShortcut.register('CommandOrControl+Shift+1', () => {
      const message = this.configManager.switchApiKey();
      if (message) this.windowManager.showNotification(message);
    });

    // Ctrl+Shift+2 => Switch Model
    globalShortcut.register('CommandOrControl+Shift+2', () => {
      const message = this.configManager.switchModel();
      if (message) this.windowManager.showNotification(message);
    });

    // Ctrl+Shift+3 => Copy to clipboard
    globalShortcut.register('CommandOrControl+Shift+3', () => {
      this.windowManager.copyContent();
    });

    // Ctrl+Shift+Arrow => Move window
    globalShortcut.register('CommandOrControl+Shift+Up', () => {
      this.windowManager.move('up');
    });

    globalShortcut.register('CommandOrControl+Shift+Down', () => {
      this.windowManager.move('down');
    });

    globalShortcut.register('CommandOrControl+Shift+Left', () => {
      this.windowManager.move('left');
    });

    globalShortcut.register('CommandOrControl+Shift+Right', () => {
      this.windowManager.move('right');
    });

    // Ctrl+Shift+R => Reset
    globalShortcut.register('CommandOrControl+Shift+R', () => {
      this.screenshotService.clear();
      this.windowManager.clear();
    });

    // Ctrl+Shift+E => Hide/show window
    globalShortcut.register('CommandOrControl+Shift+E', () => {
      if (this.windowManager.isShowing()) {
        this.windowManager.hide();
      } else {
        this.windowManager.show();
      }
    });

    // Ctrl+Shift+Q => Quit
    globalShortcut.register('CommandOrControl+Shift+Q', () => {
      console.log("Quitting application...");
      require('electron').app.quit();
    });
  }

  unregisterAll() {
    globalShortcut.unregisterAll();
  }
}

module.exports = ShortcutManager;
