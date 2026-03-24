const { app, BrowserWindow, ipcMain } = require('electron');
const ConfigManager = require('./config/configManager');
const SettingsManager = require('./config/settingsManager');
const WindowManager = require('./ui/windowManager');
const ScreenshotService = require('./services/screenshotService');
const ApiService = require('./services/apiService');
const ShortcutManager = require('./shortcuts/shortcutManager');
const ConversationManager = require('./services/conversationManager');
const ResponseCache = require('./services/responseCache');
const PromptManager = require('./services/promptManager');
const ExportService = require('./services/exportService');
const ImageUtils = require('./utils/imageUtils');

class OACoderApp {
  constructor() {
    this.configManager = new ConfigManager();
    this.settingsManager = new SettingsManager();
    this.windowManager = new WindowManager();
    this.screenshotService = new ScreenshotService();
    this.conversationManager = new ConversationManager();
    this.responseCache = new ResponseCache();
    this.promptManager = new PromptManager();
    this.exportService = new ExportService();
    this.imageUtils = new ImageUtils();
    this.apiService = new ApiService(this.configManager, this.promptManager);
    this.shortcutManager = null;
    this.lastResponse = null;
    this.lastScreenshot = null;
  }

  initialize() {
    // Load configuration
    if (!this.configManager.load()) {
      console.error("Failed to load configuration. Exiting...");
      app.quit();
      return false;
    }

    // Create main window with settings
    this.windowManager.create(this.settingsManager);

    // Set up streaming callback for real-time response display
    this.apiService.setStreamCallback((chunk, fullContent) => {
      this.windowManager.updateStreamingResult(fullContent);
    });

    // Register shortcuts with all services
    this.shortcutManager = new ShortcutManager(
      this.windowManager,
      this.screenshotService,
      this.apiService,
      this.configManager,
      {
        conversationManager: this.conversationManager,
        responseCache: this.responseCache,
        promptManager: this.promptManager,
        exportService: this.exportService,
        settingsManager: this.settingsManager,
        imageUtils: this.imageUtils
      }
    );
    this.shortcutManager.registerAll();

    // Set up IPC handlers
    this.setupIpcHandlers();

    return true;
  }

  setupIpcHandlers() {
    // Request current model info
    ipcMain.on('request-current-model', (event) => {
      const model = this.configManager.getCurrentModel() || { name: '', displayName: 'Not selected' };
      event.sender.send('model-changed', model);
    });

    // Request all models and providers
    ipcMain.on('request-models', (event) => {
      const data = {
        providers: this.configManager.config?.providers || [],
        currentProvider: this.configManager.config?.currentProvider || '',
        currentModel: this.configManager.getCurrentModel() || { name: '', displayName: 'Not selected' }
      };
      event.sender.send('show-models', data);
    });

    // Select provider
    ipcMain.on('select-provider', (event, providerName) => {
      this.configManager.switchProvider(providerName);
      const model = this.configManager.getCurrentModel();
      event.sender.send('provider-changed', {
        provider: providerName,
        model: model || { name: '', displayName: 'Not selected' }
      });
      this.windowManager.showNotification(`Provider: ${providerName}`);
    });

    // Select model
    ipcMain.on('select-model', (event, modelIndex) => {
      const provider = this.configManager.getCurrentProvider();
      if (provider && provider.models && provider.models[modelIndex]) {
        provider.currentModelIndex = modelIndex;
        const model = provider.models[modelIndex];
        event.sender.send('model-changed', model);
        this.windowManager.showNotification(`Model: ${model.displayName}`);
      }
    });

    // Handle chat message
    ipcMain.on('chat-message', async (event, message) => {
      try {
        event.sender.send('processing-started');
        this.windowManager.showNotification('Processing...');
        
        // Get conversation history
        const history = this.conversationManager.getConversationHistory();
        
        // Send chat message
        const response = await this.apiService.sendChatMessage(message, history);
        
        // Add to conversation history
        this.conversationManager.addTextMessage(message, response);
        
        // Store for export
        this.lastResponse = response;
        
        // Show result
        this.windowManager.showResult(response);
        
        // Cache if needed
        if (this.responseCache) {
          this.responseCache.addToHistory(response, this.configManager.getCurrentModel()?.displayName);
        }
        
        event.sender.send('processing-ended');
      } catch (error) {
        console.error('Chat message error:', error);
        this.windowManager.showError(error.message);
        event.sender.send('processing-ended');
      }
    });

    // Copy result
    ipcMain.on('copy-result', () => {
      this.windowManager.copyContent();
    });

    // Export result
    ipcMain.on('export-result', async () => {
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

    // Reset view - just hide the window, don't clear content
    ipcMain.on('reset-view', () => {
      this.windowManager.hide();
    });

    // Setting changed
    ipcMain.on('setting-changed', (event, { key, value }) => {
      if (this.settingsManager) {
        this.settingsManager.set(key, value);
      }
    });

    // Load history item
    ipcMain.on('load-history-item', (event, id) => {
      if (this.responseCache) {
        const item = this.responseCache.getHistoryItem(id);
        if (item) {
          this.windowManager.showResult(item.response);
          this.lastResponse = item.response;
        }
      }
    });

    // Set transparency
    ipcMain.on('set-transparency', (event, value) => {
      this.windowManager.setOpacity(value);
      if (this.settingsManager) {
        this.settingsManager.set('transparency', value);
      }
    });

    // Request settings panel
    ipcMain.on('request-settings', (event) => {
      this.windowManager.showSettings(this.settingsManager?.getAll());
    });

    // Capture screen (same as Ctrl+Shift+S)
    ipcMain.on('capture-screen', async () => {
      if (this.shortcutManager) {
        await this.shortcutManager.handleCapture();
      }
    });
  }

  cleanup() {
    if (this.shortcutManager) {
      this.shortcutManager.unregisterAll();
    }
    // Remove all IPC listeners
    ipcMain.removeAllListeners();
  }

  // Expose services for external access
  getServices() {
    return {
      configManager: this.configManager,
      settingsManager: this.settingsManager,
      windowManager: this.windowManager,
      screenshotService: this.screenshotService,
      apiService: this.apiService,
      conversationManager: this.conversationManager,
      responseCache: this.responseCache,
      promptManager: this.promptManager,
      exportService: this.exportService,
      imageUtils: this.imageUtils
    };
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
