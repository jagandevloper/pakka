/**
 * ConversationManager - Manages multi-turn conversation context
 * Stores previous screenshots and responses for follow-up questions
 */
class ConversationManager {
  constructor() {
    this.history = [];
    this.maxHistory = 10;
    this.isConversationMode = false;
    this.pendingScreenshots = []; // For multi-image mode
  }

  /**
   * Add a screenshot to pending queue (for multi-image mode)
   */
  addPendingScreenshot(screenshot) {
    this.pendingScreenshots.push({
      screenshot,
      timestamp: Date.now()
    });
    return this.pendingScreenshots.length;
  }

  /**
   * Get pending screenshots count
   */
  getPendingCount() {
    return this.pendingScreenshots.length;
  }

  /**
   * Check if there are pending screenshots
   */
  hasPending() {
    return this.pendingScreenshots.length > 0;
  }

  /**
   * Get all pending screenshots and clear the queue
   */
  consumePendingScreenshots() {
    const screenshots = this.pendingScreenshots.map(p => p.screenshot);
    this.pendingScreenshots = [];
    return screenshots;
  }

  /**
   * Clear only pending screenshots
   */
  clearPending() {
    this.pendingScreenshots = [];
  }

  /**
   * Get messages for multi-image processing
   */
  getMultiImageMessages(systemPrompt, screenshots) {
    const content = [
      { type: 'text', text: systemPrompt + '\n\nAnalyze all the following images together as parts of the same question:' }
    ];
    
    screenshots.forEach((screenshot, index) => {
      content.push({
        type: 'image_url',
        image_url: { url: `data:image/png;base64,${screenshot}` }
      });
    });
    
    return [{
      role: 'user',
      content
    }];
  }

  /**
   * Add a screenshot and response to conversation history
   */
  addContext(screenshot, response, userMessage = null) {
    this.history.push({
      screenshot,
      response,
      userMessage,
      timestamp: Date.now()
    });
    
    // Keep only recent history
    if (this.history.length > this.maxHistory) {
      this.history.shift();
    }
    
    console.log(`Conversation history: ${this.history.length}/${this.maxHistory} entries`);
  }

  /**
   * Add a text-only follow-up to conversation history
   */
  addTextMessage(userMessage, response) {
    this.history.push({
      screenshot: null,
      response,
      userMessage,
      timestamp: Date.now()
    });
    
    if (this.history.length > this.maxHistory) {
      this.history.shift();
    }
    
    console.log(`Added text message to history: ${this.history.length}/${this.maxHistory} entries`);
  }

  /**
   * Get the full conversation history for API calls
   */
  getConversationHistory() {
    return this.history.map(entry => ({
      screenshot: entry.screenshot,
      response: entry.response,
      userMessage: entry.userMessage
    }));
  }

  /**
   * Get formatted messages for API including conversation context
   */
  getContextMessages(systemPrompt, currentScreenshot) {
    const messages = [];
    
    // Add conversation history
    if (this.isConversationMode && this.history.length > 0) {
      this.history.forEach((entry, index) => {
        // Previous user message with screenshot
        messages.push({
          role: 'user',
          content: [
            { type: 'text', text: index === 0 ? systemPrompt : 'Continue with this screenshot:' },
            {
              type: 'image_url',
              image_url: { url: `data:image/png;base64,${entry.screenshot}` }
            }
          ]
        });
        
        // Previous assistant response
        messages.push({
          role: 'assistant',
          content: entry.response
        });
      });
      
      // Current screenshot as follow-up
      messages.push({
        role: 'user',
        content: [
          { type: 'text', text: 'Now analyze this follow-up screenshot:' },
          {
            type: 'image_url',
            image_url: { url: `data:image/png;base64,${currentScreenshot}` }
          }
        ]
      });
    } else {
      // Single screenshot mode (original behavior)
      messages.push({
        role: 'user',
        content: [
          { type: 'text', text: systemPrompt },
          {
            type: 'image_url',
            image_url: { url: `data:image/png;base64,${currentScreenshot}` }
          }
        ]
      });
    }
    
    return messages;
  }

  /**
   * Toggle conversation mode on/off
   */
  toggleConversationMode() {
    this.isConversationMode = !this.isConversationMode;
    const status = this.isConversationMode ? 'ON' : 'OFF';
    console.log(`Conversation mode: ${status}`);
    return `Conversation Mode: ${status}`;
  }

  /**
   * Get current mode status
   */
  getStatus() {
    return {
      mode: this.isConversationMode,
      historyCount: this.history.length,
      maxHistory: this.maxHistory,
      pendingCount: this.pendingScreenshots.length
    };
  }

  /**
   * Clear conversation history
   */
  clear() {
    this.history = [];
    this.pendingScreenshots = [];
    console.log('Conversation history cleared');
  }

  /**
   * Get history for display
   */
  getHistory() {
    return this.history.map((entry, index) => ({
      index: index + 1,
      timestamp: new Date(entry.timestamp).toLocaleTimeString(),
      responsePreview: entry.response.substring(0, 100) + '...'
    }));
  }
}

module.exports = ConversationManager;
