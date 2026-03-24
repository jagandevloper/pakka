class ApiService {
  constructor(configManager, promptManager = null) {
    this.configManager = configManager;
    this.promptManager = promptManager;
    this.systemPrompt = this.loadSystemPrompt();
    this.streamCallback = null;
    this.abortController = null;
  }

  loadSystemPrompt() {
    try {
      const fs = require('fs');
      const path = require('path');
      const promptPath = path.join(__dirname, '../../system-prompt.txt');
      return fs.readFileSync(promptPath, 'utf8').trim();
    } catch (err) {
      console.error('Error loading system prompt:', err);
      return 'Solve the problem shown in this image.';
    }
  }

  /**
   * Set callback for streaming responses
   */
  setStreamCallback(callback) {
    this.streamCallback = callback;
  }

  /**
   * Get the current prompt (from promptManager or default)
   */
  getCurrentPrompt() {
    if (this.promptManager) {
      return this.promptManager.getCurrentPrompt();
    }
    return this.systemPrompt;
  }

  /**
   * Abort current request
   */
  abort() {
    if (this.abortController) {
      this.abortController.abort();
      this.abortController = null;
      console.log('Request aborted');
    }
  }

  async processScreenshot(screenshot, conversationMessages = null) {
    const provider = this.configManager.getCurrentProvider();
    const visionModel = this.configManager.getVisionModel();
    
    if (!provider) {
      throw new Error("Provider not configured");
    }
    if (!visionModel) {
      throw new Error("No model configured for this provider");
    }
    if (visionModel.supportsVision === false) {
      throw new Error(
        `The current model (${visionModel.displayName}) does not support image input. ` +
        `Please switch to a vision-capable model (e.g., Nova 2 Lite, Nemotron Nano VL, or Gemini 2.0 Flash).`
      );
    }

    console.log(`Using vision model: ${visionModel.displayName}`);

    // Use conversation messages if provided, otherwise create single message
    let messages;
    if (conversationMessages) {
      messages = conversationMessages;
    } else {
      const currentPrompt = this.getCurrentPrompt();
      messages = [{
        role: "user",
        content: [
          { type: "text", text: currentPrompt },
          {
            type: "image_url",
            image_url: { url: `data:image/png;base64,${screenshot}` }
          }
        ]
      }];
    }

    const maxRetries = 3;
    let retryCount = 0;
    
    // Create abort controller for this request
    this.abortController = new AbortController();
    
    while (retryCount < maxRetries) {
      let lastError = null;
      let rateLimitedKeys = 0;
      
      for (let i = 0; i < this.configManager.getApiKeysCount(); i++) {
        const keyIndex = (this.configManager.currentApiKeyIndex + i) % this.configManager.getApiKeysCount();
        const apiKey = this.configManager.getApiKeyByIndex(keyIndex);
        
        try {
          console.log(`[Attempt ${retryCount + 1}/${maxRetries}] Trying API Key ${keyIndex + 1}/${this.configManager.getApiKeysCount()}...`);
          
          // Check if streaming is enabled
          const useStreaming = this.streamCallback !== null;
          
          const response = await fetch(`${provider.baseURL}/chat/completions`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${apiKey}`,
              'HTTP-Referer': 'https://github.com/yourusername/oacoder',
              'X-Title': 'OA Coder'
            },
            body: JSON.stringify({
              model: visionModel.name,
              messages: messages,
              max_tokens: 5000,
              stream: useStreaming
            }),
            signal: this.abortController.signal
          });

          if (response.ok) {
            // Log rate limit headers
            const rateLimitRemaining = response.headers.get('x-ratelimit-remaining-requests');
            const rateLimitReset = response.headers.get('x-ratelimit-reset-requests');
            if (rateLimitRemaining !== null) {
              console.log(`  Rate Limit: ${rateLimitRemaining} requests remaining, resets at ${rateLimitReset}`);
            }
            
            // Handle streaming response
            if (useStreaming) {
              const content = await this.handleStreamingResponse(response);
              this.configManager.currentApiKeyIndex = keyIndex;
              this.configManager.rotateToNextKey();
              console.log(`✓ Stream completed with API Key ${keyIndex + 1}/${this.configManager.getApiKeysCount()}`);
              return content;
            }
            
            // Handle regular response
            const data = await response.json();
            
            if (!data || !data.choices || !data.choices[0] || !data.choices[0].message) {
              console.log(`✗ API Key ${keyIndex + 1}: Invalid response structure`, JSON.stringify(data, null, 2));
              lastError = new Error(`Invalid response from API Key ${keyIndex + 1}`);
              continue;
            }
            
            const content = data.choices[0].message.content;
            if (!content) {
              console.log(`✗ API Key ${keyIndex + 1}: Empty content in response`);
              console.log(`Response data:`, JSON.stringify(data, null, 2));
              lastError = new Error(`Empty response from API Key ${keyIndex + 1}`);
              continue;
            }
            
            this.configManager.currentApiKeyIndex = keyIndex;
            this.configManager.rotateToNextKey();
            
            console.log(`✓ Success with API Key ${keyIndex + 1}/${this.configManager.getApiKeysCount()}`);
            return content;
          } else if (response.status === 429) {
            rateLimitedKeys++;
            const rateLimitReset = response.headers.get('x-ratelimit-reset-requests');
            lastError = new Error(`Rate limited (${rateLimitedKeys}/${this.configManager.getApiKeysCount()} keys)`);
            console.log(`⚠ API Key ${keyIndex + 1}: Rate limited (429)${rateLimitReset ? `, resets at ${rateLimitReset}` : ''}`);
          } else {
            const rateLimitRemaining = response.headers.get('x-ratelimit-remaining-requests');
            if (rateLimitRemaining !== null) {
              console.log(`  Rate Limit Info: ${rateLimitRemaining} requests remaining`);
            }
            const errorData = await response.json().catch(() => ({}));
            lastError = new Error(errorData.error?.message || `API Key ${keyIndex + 1} failed: ${response.status}`);
            console.log(lastError.message);
          }
        } catch (err) {
          if (err.name === 'AbortError') {
            throw new Error('Request was cancelled');
          }
          lastError = err;
          console.log(`✗ API Key ${keyIndex + 1} error:`, err.message);
        }
        
        if (i < this.configManager.getApiKeysCount() - 1) {
          await new Promise(resolve => setTimeout(resolve, 500));
        }
      }
      
      if (rateLimitedKeys === this.configManager.getApiKeysCount()) {
        retryCount++;
        
        if (retryCount < maxRetries) {
          const waitTime = Math.pow(2, retryCount) * 2000;
          console.log(`⏳ All keys rate limited. Waiting ${waitTime/1000}s before retry ${retryCount + 1}/${maxRetries}...`);
          await new Promise(resolve => setTimeout(resolve, waitTime));
          return { waitTime, retry: true };
        }
      } else {
        throw lastError || new Error("Request failed");
      }
    }
    
    this.abortController = null;
    throw new Error(`All ${this.configManager.getApiKeysCount()} API keys are rate limited. Please wait a few minutes and try again.`);
  }

  /**
   * Handle streaming response from API
   */
  async handleStreamingResponse(response) {
    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let fullContent = '';
    
    try {
      while (true) {
        const { done, value } = await reader.read();
        
        if (done) break;
        
        const chunk = decoder.decode(value, { stream: true });
        const lines = chunk.split('\n').filter(line => line.trim());
        
        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const data = line.slice(6);
            
            if (data === '[DONE]') continue;
            
            try {
              const parsed = JSON.parse(data);
              const content = parsed.choices?.[0]?.delta?.content || '';
              
              if (content) {
                fullContent += content;
                
                // Call stream callback if set
                if (this.streamCallback) {
                  this.streamCallback(content, fullContent);
                }
              }
            } catch (e) {
              // Skip invalid JSON chunks
            }
          }
        }
      }
    } finally {
      reader.releaseLock();
    }
    
    return fullContent;
  }

  /**
   * Process with provider fallback
   * Tries all providers if current one fails
   */
  async processWithFallback(screenshot, conversationMessages = null) {
    const providers = this.configManager.config?.providers || [];
    let lastError = null;
    
    for (const provider of providers) {
      try {
        // Temporarily switch provider
        const originalProvider = this.configManager.config.currentProvider;
        this.configManager.config.currentProvider = provider.name;
        
        const result = await this.processScreenshot(screenshot, conversationMessages);
        
        return result;
      } catch (error) {
        lastError = error;
        console.log(`Provider ${provider.name} failed:`, error.message);
      }
    }
    
    throw lastError || new Error('All providers failed');
  }

  /**
   * Send a follow-up chat message (text-only, no screenshot)
   * Uses conversation history for context
   */
  async sendChatMessage(message, conversationHistory = []) {
    const provider = this.configManager.getCurrentProvider();
    const model = this.configManager.getCurrentModel();
    
    if (!provider || !model) {
      throw new Error("Provider or model not configured");
    }

    console.log(`Sending chat message with model: ${model.displayName}`);

    // Build messages array from conversation history
    const messages = [];
    
    // Add system prompt first
    const systemPrompt = this.getCurrentPrompt();
    messages.push({
      role: "system",
      content: systemPrompt
    });
    
    // Add conversation history
    for (const entry of conversationHistory) {
      // Add user message (with or without image)
      if (entry.screenshot) {
        messages.push({
          role: "user",
          content: [
            { type: "text", text: entry.userMessage || "Analyze this:" },
            {
              type: "image_url",
              image_url: { url: `data:image/png;base64,${entry.screenshot}` }
            }
          ]
        });
      } else if (entry.userMessage) {
        messages.push({
          role: "user",
          content: entry.userMessage
        });
      }
      
      // Add assistant response
      if (entry.response) {
        messages.push({
          role: "assistant",
          content: entry.response
        });
      }
    }
    
    // Add the new user message
    messages.push({
      role: "user",
      content: message
    });

    // Create abort controller for this request
    this.abortController = new AbortController();
    const useStreaming = this.streamCallback !== null;
    
    try {
      const response = await fetch(`${provider.baseURL}/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.configManager.getCurrentApiKey()}`,
          'HTTP-Referer': 'https://github.com/yourusername/oacoder',
          'X-Title': 'OA Coder'
        },
        body: JSON.stringify({
          model: model.name,
          messages: messages,
          max_tokens: 5000,
          stream: useStreaming
        }),
        signal: this.abortController.signal
      });

      if (response.ok) {
        if (useStreaming) {
          return await this.handleStreamingResponse(response);
        }
        
        const data = await response.json();
        return data.choices?.[0]?.message?.content || '';
      } else {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error?.message || `Chat request failed: ${response.status}`);
      }
    } catch (err) {
      if (err.name === 'AbortError') {
        throw new Error('Request was cancelled');
      }
      throw err;
    } finally {
      this.abortController = null;
    }
  }
}

module.exports = ApiService;
