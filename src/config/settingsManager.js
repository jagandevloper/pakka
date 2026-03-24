const fs = require('fs');
const path = require('path');
const { app } = require('electron');

/**
 * SettingsManager - Manages application settings
 * Persists user preferences across sessions
 */
class SettingsManager {
  constructor() {
    this.settingsPath = path.join(app.getPath('userData'), 'settings.json');
    this.settings = this.getDefaultSettings();
    this.load();
  }

  /**
   * Default settings
   */
  getDefaultSettings() {
    return {
      // Appearance
      theme: 'auto', // 'light', 'dark', 'auto'
      opacity: 90,
      fontSize: 13,
      fontFamily: 'Arial',
      
      // Window
      windowWidth: 400,
      windowHeight: 300,
      windowX: null,
      windowY: null,
      alwaysOnTop: true,
      
      // Behavior
      autoCopyResults: false,
      autoSpeakResults: false,
      showNotifications: true,
      hideOnCapture: true,
      captureDelay: 200,
      
      // API
      defaultProvider: 'openrouter',
      maxRetries: 3,
      retryDelay: 2000,
      timeout: 60000,
      
      // Screenshot
      compressionEnabled: false,
      maxImageWidth: 1920,
      maxImageHeight: 1080,
      imageQuality: 85,
      
      // Prompts
      defaultPrompt: 'default',
      
      // TTS
      ttsEnabled: false,
      ttsRate: 1.0,
      ttsPitch: 1.0,
      ttsVolume: 1.0,
      ttsVoice: null,
      
      // History
      maxHistorySize: 100,
      saveHistory: true,
      
      // Shortcuts (customizable)
      shortcuts: {
        capture: 'CommandOrControl+Shift+S',
        addCapture: 'CommandOrControl+Shift+A',
        switchKey: 'CommandOrControl+Shift+1',
        switchModel: 'CommandOrControl+Shift+2',
        copy: 'CommandOrControl+Shift+3',
        switchPrompt: 'CommandOrControl+Shift+T',
        reset: 'CommandOrControl+Shift+R',
        toggle: 'CommandOrControl+Shift+E',
        quit: 'CommandOrControl+Shift+Q',
        voice: 'CommandOrControl+Shift+V',
        history: 'CommandOrControl+Shift+H',
        settings: 'CommandOrControl+Shift+,'
      },
      
      // Advanced
      debugMode: false,
      logLevel: 'info' // 'debug', 'info', 'warn', 'error'
    };
  }

  /**
   * Load settings from file
   */
  load() {
    try {
      if (fs.existsSync(this.settingsPath)) {
        const data = fs.readFileSync(this.settingsPath, 'utf8');
        const loaded = JSON.parse(data);
        this.settings = { ...this.getDefaultSettings(), ...loaded };
        console.log('Settings loaded');
      }
    } catch (err) {
      console.error('Error loading settings:', err);
      this.settings = this.getDefaultSettings();
    }
    return this.settings;
  }

  /**
   * Save settings to file
   */
  save() {
    try {
      fs.writeFileSync(this.settingsPath, JSON.stringify(this.settings, null, 2), 'utf8');
      console.log('Settings saved');
      return true;
    } catch (err) {
      console.error('Error saving settings:', err);
      return false;
    }
  }

  /**
   * Get a setting value
   */
  get(key) {
    return this.settings[key];
  }

  /**
   * Set a setting value
   */
  set(key, value) {
    if (key in this.settings) {
      this.settings[key] = value;
      this.save();
      return true;
    }
    return false;
  }

  /**
   * Get all settings
   */
  getAll() {
    return { ...this.settings };
  }

  /**
   * Update multiple settings at once
   */
  update(updates) {
    Object.entries(updates).forEach(([key, value]) => {
      if (key in this.settings) {
        this.settings[key] = value;
      }
    });
    this.save();
  }

  /**
   * Reset to defaults
   */
  reset() {
    this.settings = this.getDefaultSettings();
    this.save();
    return this.settings;
  }

  /**
   * Reset specific setting to default
   */
  resetSetting(key) {
    const defaults = this.getDefaultSettings();
    if (key in defaults) {
      this.settings[key] = defaults[key];
      this.save();
      return true;
    }
    return false;
  }

  /**
   * Get settings by category
   */
  getCategory(category) {
    const categories = {
      appearance: ['theme', 'opacity', 'fontSize', 'fontFamily'],
      window: ['windowWidth', 'windowHeight', 'windowX', 'windowY', 'alwaysOnTop'],
      behavior: ['autoCopyResults', 'autoSpeakResults', 'showNotifications', 'hideOnCapture', 'captureDelay'],
      api: ['defaultProvider', 'maxRetries', 'retryDelay', 'timeout'],
      screenshot: ['compressionEnabled', 'maxImageWidth', 'maxImageHeight', 'imageQuality'],
      tts: ['ttsEnabled', 'ttsRate', 'ttsPitch', 'ttsVolume', 'ttsVoice'],
      history: ['maxHistorySize', 'saveHistory'],
      shortcuts: ['shortcuts'],
      advanced: ['debugMode', 'logLevel']
    };

    const keys = categories[category] || [];
    const result = {};
    keys.forEach(key => {
      result[key] = this.settings[key];
    });
    return result;
  }

  /**
   * Export settings to file
   */
  exportSettings(filePath) {
    try {
      fs.writeFileSync(filePath, JSON.stringify(this.settings, null, 2), 'utf8');
      return true;
    } catch (err) {
      console.error('Error exporting settings:', err);
      return false;
    }
  }

  /**
   * Import settings from file
   */
  importSettings(filePath) {
    try {
      const data = fs.readFileSync(filePath, 'utf8');
      const imported = JSON.parse(data);
      this.settings = { ...this.getDefaultSettings(), ...imported };
      this.save();
      return true;
    } catch (err) {
      console.error('Error importing settings:', err);
      return false;
    }
  }

  /**
   * Validate settings
   */
  validate() {
    const errors = [];
    
    if (this.settings.opacity < 10 || this.settings.opacity > 100) {
      errors.push('Opacity must be between 10 and 100');
    }
    if (this.settings.fontSize < 8 || this.settings.fontSize > 24) {
      errors.push('Font size must be between 8 and 24');
    }
    if (this.settings.captureDelay < 0 || this.settings.captureDelay > 2000) {
      errors.push('Capture delay must be between 0 and 2000ms');
    }
    
    return { valid: errors.length === 0, errors };
  }
}

module.exports = SettingsManager;
