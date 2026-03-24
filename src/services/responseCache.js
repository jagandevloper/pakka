const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const { app } = require('electron');

/**
 * ResponseCache - Caches responses and maintains history
 * Provides fast retrieval for similar screenshots
 */
class ResponseCache {
  constructor() {
    this.cache = new Map();
    this.history = [];
    this.maxCacheSize = 50;
    this.maxHistorySize = 100;
    this.historyPath = path.join(app.getPath('userData'), 'response-history.json');
    this.loadHistory();
  }

  /**
   * Generate hash for image to use as cache key
   */
  generateHash(base64Image) {
    return crypto.createHash('md5').update(base64Image.substring(0, 10000)).digest('hex');
  }

  /**
   * Get cached response for image
   */
  get(base64Image) {
    const hash = this.generateHash(base64Image);
    const cached = this.cache.get(hash);
    
    if (cached) {
      console.log(`Cache hit for hash: ${hash.substring(0, 8)}...`);
      return cached.response;
    }
    
    return null;
  }

  /**
   * Store response in cache
   */
  set(base64Image, response, model) {
    const hash = this.generateHash(base64Image);
    
    // Manage cache size
    if (this.cache.size >= this.maxCacheSize) {
      const oldest = this.cache.keys().next().value;
      this.cache.delete(oldest);
    }
    
    const entry = {
      response,
      model,
      timestamp: Date.now(),
      hash
    };
    
    this.cache.set(hash, entry);
    this.addToHistory(base64Image, response, model);
    
    console.log(`Cached response with hash: ${hash.substring(0, 8)}...`);
  }

  /**
   * Add entry to persistent history
   */
  addToHistory(screenshot, response, model) {
    const entry = {
      id: Date.now(),
      timestamp: new Date().toISOString(),
      model: model || 'unknown',
      response,
      screenshotPreview: screenshot.substring(0, 100) // Store small preview
    };
    
    this.history.unshift(entry);
    
    // Trim history
    if (this.history.length > this.maxHistorySize) {
      this.history = this.history.slice(0, this.maxHistorySize);
    }
    
    this.saveHistory();
  }

  /**
   * Load history from disk
   */
  loadHistory() {
    try {
      if (fs.existsSync(this.historyPath)) {
        const data = fs.readFileSync(this.historyPath, 'utf8');
        this.history = JSON.parse(data);
        console.log(`Loaded ${this.history.length} history entries`);
      }
    } catch (err) {
      console.error('Error loading history:', err);
      this.history = [];
    }
  }

  /**
   * Save history to disk
   */
  saveHistory() {
    try {
      // Save without full screenshots to keep file size small
      const historyToSave = this.history.map(entry => ({
        ...entry,
        screenshotPreview: undefined // Don't save screenshot data
      }));
      fs.writeFileSync(this.historyPath, JSON.stringify(historyToSave, null, 2), 'utf8');
    } catch (err) {
      console.error('Error saving history:', err);
    }
  }

  /**
   * Get history entries for display
   */
  getHistory(limit = 20) {
    return this.history.slice(0, limit).map((entry, index) => ({
      index: index + 1,
      id: entry.id,
      timestamp: entry.timestamp,
      model: entry.model,
      responsePreview: entry.response.substring(0, 150) + '...',
      fullResponse: entry.response
    }));
  }

  /**
   * Get specific history entry
   */
  getHistoryEntry(id) {
    return this.history.find(entry => entry.id === id);
  }

  /**
   * Get history item by ID (for loading in UI)
   */
  getHistoryItem(id) {
    const numId = typeof id === 'string' ? parseInt(id, 10) : id;
    return this.history.find(entry => entry.id === numId);
  }

  /**
   * Add a text-only response to history (without screenshot)
   */
  addToHistory(response, model) {
    const entry = {
      id: Date.now(),
      timestamp: new Date().toISOString(),
      model: model || 'unknown',
      response,
      screenshotPreview: ''
    };
    
    this.history.unshift(entry);
    
    if (this.history.length > this.maxHistorySize) {
      this.history = this.history.slice(0, this.maxHistorySize);
    }
    
    this.saveHistory();
  }

  /**
   * Clear cache
   */
  clearCache() {
    this.cache.clear();
    console.log('Cache cleared');
  }

  /**
   * Clear history
   */
  clearHistory() {
    this.history = [];
    this.saveHistory();
    console.log('History cleared');
  }

  /**
   * Get stats
   */
  getStats() {
    return {
      cacheSize: this.cache.size,
      maxCacheSize: this.maxCacheSize,
      historySize: this.history.length,
      maxHistorySize: this.maxHistorySize
    };
  }

  /**
   * Search history by keyword
   */
  searchHistory(keyword) {
    const lowerKeyword = keyword.toLowerCase();
    return this.history.filter(entry =>
      entry.response.toLowerCase().includes(lowerKeyword)
    );
  }
}

module.exports = ResponseCache;
