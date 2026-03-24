const { globalShortcut, clipboard } = require('electron');

class ShortcutManager {
  constructor(windowManager, screenshotService, apiService, configManager, services = {}) {
    this.windowManager = windowManager;
    this.screenshotService = screenshotService;
    this.apiService = apiService;
    this.configManager = configManager;
    
    // Additional services
    this.conversationManager = services.conversationManager;
    this.responseCache = services.responseCache;
    this.promptManager = services.promptManager;
    this.exportService = services.exportService;
    this.settingsManager = services.settingsManager;
    this.imageUtils = services.imageUtils;
    
    // State
    this.lastResponse = null;
    this.lastScreenshot = null;
  }

  registerAll() {
    // Ctrl+Shift+S => Screenshot and process
    globalShortcut.register('CommandOrControl+Shift+S', async () => {
      await this.handleCapture();
    });

    // Ctrl+Shift+A => Add screenshot (multi-page mode)
    globalShortcut.register('CommandOrControl+Shift+A', async () => {
      await this.handleAddCapture();
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

    // Ctrl+Shift+T => Switch prompt template
    globalShortcut.register('CommandOrControl+Shift+T', () => {
      if (this.promptManager) {
        const message = this.promptManager.switchToNext();
        this.windowManager.showNotification(message);
      }
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
      if (this.conversationManager) {
        this.conversationManager.clear();
      }
      this.lastResponse = null;
      this.lastScreenshot = null;
    });

    // Ctrl+Shift+E => Hide/show window
    globalShortcut.register('CommandOrControl+Shift+E', () => {
      if (this.windowManager.isShowing()) {
        this.windowManager.hide();
      } else {
        this.windowManager.show();
      }
    });

    // Ctrl+Shift+H => Show history
    globalShortcut.register('CommandOrControl+Shift+H', () => {
      if (this.responseCache) {
        const history = this.responseCache.getHistory(10);
        this.windowManager.showHistory(history);
      }
    });

    // Ctrl+Shift+M => Export as Markdown
    globalShortcut.register('CommandOrControl+Shift+M', async () => {
      if (this.lastResponse && this.exportService) {
        const result = await this.exportService.exportToMarkdown(this.lastResponse, {
          model: this.configManager.getCurrentModel()?.displayName,
          prompt: this.promptManager?.getCurrentPromptInfo()?.name
        });
        if (result.success) {
          this.windowManager.showNotification('Exported to Markdown');
        }
      } else {
        this.windowManager.showNotification('No response to export');
      }
    });

    // Ctrl+Shift+D => Toggle dark mode
    globalShortcut.register('CommandOrControl+Shift+D', () => {
      this.windowManager.toggleDarkMode();
    });

    // Ctrl+Shift+[ => Decrease transparency (more opaque)
    globalShortcut.register('CommandOrControl+Shift+[', () => {
      this.windowManager.adjustTransparency(-10);
    });

    // Ctrl+Shift+] => Increase transparency (more transparent)
    globalShortcut.register('CommandOrControl+Shift+]', () => {
      this.windowManager.adjustTransparency(10);
    });

    // Ctrl+Shift+, => Show settings
    globalShortcut.register('CommandOrControl+Shift+,', () => {
      this.windowManager.showSettings(this.settingsManager?.getAll());
    });

    // Ctrl+Shift+Q => Quit
    globalShortcut.register('CommandOrControl+Shift+Q', () => {
      console.log("Quitting application...");
      require('electron').app.quit();
    });

    console.log('All shortcuts registered');
  }

  /**
   * Handle main screenshot capture and processing
   */
  async handleCapture() {
    try {
      this.windowManager.hideInstruction();
      
      const screenshot = await this.screenshotService.capture(this.windowManager.getWindow());
      this.lastScreenshot = screenshot;
      
      this.windowManager.showNotification('Processing...');
      
      // Check if we have pending screenshots for multi-image mode
      let messages = null;
      const currentPrompt = this.promptManager?.getCurrentPrompt() || this.apiService.systemPrompt;
      
      if (this.conversationManager?.hasPending()) {
        // Multi-image mode: combine pending screenshots with current one
        const pendingScreenshots = this.conversationManager.consumePendingScreenshots();
        const allScreenshots = [...pendingScreenshots, screenshot];
        messages = this.conversationManager.getMultiImageMessages(currentPrompt, allScreenshots);
        this.windowManager.showNotification(`Processing ${allScreenshots.length} images...`);
      } else if (this.conversationManager?.isConversationMode) {
        // Conversation mode with history
        messages = this.conversationManager.getContextMessages(currentPrompt, screenshot);
      } else {
        // Check cache for single image
        if (this.responseCache) {
          const cached = this.responseCache.get(screenshot);
          if (cached) {
            this.windowManager.showNotification('From cache');
            this.windowManager.showResult(cached);
            this.lastResponse = cached;
            return;
          }
        }
      }

      const result = await this.apiService.processScreenshot(screenshot, messages);
      
      if (result.retry) {
        this.windowManager.showNotification(`Rate limited. Retry in ${result.waitTime/1000}s...`);
      } else {
        this.windowManager.showResult(result);
        this.lastResponse = result;
        
        // Cache the response (only for single images)
        if (this.responseCache && !messages) {
          this.responseCache.set(screenshot, result, this.configManager.getCurrentModel()?.displayName);
        }
        
        // Add to conversation history
        if (this.conversationManager) {
          this.conversationManager.addContext(screenshot, result);
        }
        
        // Auto copy if enabled
        if (this.settingsManager?.get('autoCopyResults')) {
          clipboard.writeText(result);
          this.windowManager.showNotification('Copied to clipboard');
        }
      }
    } catch (error) {
      console.error("Screenshot error:", error);
      this.windowManager.showError(error.message);
    }
  }

  /**
   * Handle adding screenshot to multi-page session
   */
  async handleAddCapture() {
    if (!this.conversationManager) {
      this.windowManager.showNotification('Conversation mode not available');
      return;
    }

    try {
      const screenshot = await this.screenshotService.capture(this.windowManager.getWindow());
      
      // Add to pending screenshots queue
      const count = this.conversationManager.addPendingScreenshot(screenshot);
      this.windowManager.showNotification(`Image ${count} added. Press Ctrl+Shift+S to analyze all.`);
      
      this.lastScreenshot = screenshot;
    } catch (error) {
      console.error("Add capture error:", error);
      this.windowManager.showError(error.message);
    }
  }

  unregisterAll() {
    globalShortcut.unregisterAll();
    console.log('All shortcuts unregistered');
  }
}

module.exports = ShortcutManager;
