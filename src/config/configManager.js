const fs = require('fs');
const path = require('path');

class ConfigManager {
  constructor() {
    this.config = null;
    this.currentApiKeyIndex = 0;
    this.configPath = path.join(__dirname, '../../config.json');
  }

  load() {
    try {
      const configData = fs.readFileSync(this.configPath, 'utf8');
      this.config = JSON.parse(configData);
      
      const provider = this.getCurrentProvider();
      if (!provider) {
        throw new Error("Current provider not found in config.json");
      }
      
      if (!provider.apiKeys || provider.apiKeys.length === 0) {
        throw new Error("API keys are missing in config.json");
      }
      
      this.currentApiKeyIndex = provider.currentApiKeyIndex || 0;
      if (this.currentApiKeyIndex >= provider.apiKeys.length) {
        this.currentApiKeyIndex = 0;
      }
      
      console.log(`Using provider: ${provider.name}, Model: ${this.getCurrentModel().displayName}, API Key Index: ${this.currentApiKeyIndex + 1}/${provider.apiKeys.length}`);
      return true;
    } catch (err) {
      console.error("Error reading config:", err);
      return false;
    }
  }

  save() {
    try {
      fs.writeFileSync(this.configPath, JSON.stringify(this.config, null, 2), 'utf8');
      return true;
    } catch (err) {
      console.error("Error saving config:", err);
      return false;
    }
  }

  getCurrentProvider() {
    return this.config?.providers.find(p => p.name === this.config.currentProvider);
  }

  getCurrentModel() {
    const provider = this.getCurrentProvider();
    return provider?.models[provider.currentModelIndex];
  }

  getCurrentApiKey() {
    const provider = this.getCurrentProvider();
    return provider?.apiKeys[this.currentApiKeyIndex];
  }

  switchApiKey() {
    const provider = this.getCurrentProvider();
    if (!provider || !provider.apiKeys) return null;
    
    this.currentApiKeyIndex = (this.currentApiKeyIndex + 1) % provider.apiKeys.length;
    provider.currentApiKeyIndex = this.currentApiKeyIndex;
    this.save();
    
    console.log(`Switched to API Key ${this.currentApiKeyIndex + 1}/${provider.apiKeys.length}`);
    return `API Key: ${this.currentApiKeyIndex + 1}/${provider.apiKeys.length}`;
  }

  switchModel() {
    const provider = this.getCurrentProvider();
    if (!provider || !provider.models) return null;
    
    provider.currentModelIndex = (provider.currentModelIndex + 1) % provider.models.length;
    this.save();
    
    const currentModel = this.getCurrentModel();
    console.log(`Switched to Model: ${currentModel.displayName}`);
    return `Model: ${currentModel.displayName}`;
  }

  /**
   * Switch to a specific provider by name
   */
  switchProvider(providerName) {
    if (!this.config?.providers) return null;
    
    const provider = this.config.providers.find(p => p.name === providerName);
    if (!provider) return null;
    
    this.config.currentProvider = providerName;
    this.currentApiKeyIndex = provider.currentApiKeyIndex || 0;
    this.save();
    
    console.log(`Switched to Provider: ${providerName}`);
    return `Provider: ${providerName}`;
  }

  rotateToNextKey() {
    const provider = this.getCurrentProvider();
    if (!provider || !provider.apiKeys) return;
    
    this.currentApiKeyIndex = (this.currentApiKeyIndex + 1) % provider.apiKeys.length;
    provider.currentApiKeyIndex = this.currentApiKeyIndex;
    this.save();
  }

  getApiKeyByIndex(index) {
    const provider = this.getCurrentProvider();
    return provider?.apiKeys[index];
  }

  getApiKeysCount() {
    const provider = this.getCurrentProvider();
    return provider?.apiKeys.length || 0;
  }

  /**
   * Returns a vision-capable model for the current provider.
   * Falls back to the current model if none is explicitly marked.
   */
  getVisionModel() {
    const provider = this.getCurrentProvider();
    if (!provider || !provider.models) return null;

    // Prefer a model explicitly marked supportsVision: true
    const visionModel = provider.models.find(m => m.supportsVision === true);
    if (visionModel) return visionModel;

    // Fallback: return current model (may or may not support vision)
    return this.getCurrentModel();
  }
}

module.exports = ConfigManager;
