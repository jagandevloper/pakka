class ApiService {
  constructor(configManager) {
    this.configManager = configManager;
    this.systemPrompt = this.loadSystemPrompt();
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

  async processScreenshot(screenshot) {
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

    const messages = [
      { type: "text", text: this.systemPrompt },
      {
        type: "image_url",
        image_url: { url: `data:image/png;base64,${screenshot}` }
      }
    ];

    const maxRetries = 3;
    let retryCount = 0;
    
    while (retryCount < maxRetries) {
      let lastError = null;
      let rateLimitedKeys = 0;
      
      for (let i = 0; i < this.configManager.getApiKeysCount(); i++) {
        const keyIndex = (this.configManager.currentApiKeyIndex + i) % this.configManager.getApiKeysCount();
        const apiKey = this.configManager.getApiKeyByIndex(keyIndex);
        
        try {
          console.log(`[Attempt ${retryCount + 1}/${maxRetries}] Trying API Key ${keyIndex + 1}/${this.configManager.getApiKeysCount()}...`);
          
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
              messages: [{ role: "user", content: messages }],
              max_tokens: 5000
            })
          });

          if (response.ok) {
            // Log rate limit headers
            const rateLimitRemaining = response.headers.get('x-ratelimit-remaining-requests');
            const rateLimitReset = response.headers.get('x-ratelimit-reset-requests');
            if (rateLimitRemaining !== null) {
              console.log(`  Rate Limit: ${rateLimitRemaining} requests remaining, resets at ${rateLimitReset}`);
            }
            
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
    
    throw new Error(`All ${this.configManager.getApiKeysCount()} API keys are rate limited. Please wait a few minutes and try again.`);
  }
}

module.exports = ApiService;
