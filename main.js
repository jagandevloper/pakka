const { app, BrowserWindow, globalShortcut } = require('electron');
const path = require('path');
const screenshot = require('screenshot-desktop');
const fs = require('fs');

let config;
let currentApiKeyIndex = 0;
let systemPrompt = '';

function loadSystemPrompt() {
  try {
    const promptPath = path.join(__dirname, 'system-prompt.txt');
    systemPrompt = fs.readFileSync(promptPath, 'utf8').trim();
    console.log('System prompt loaded successfully');
  } catch (err) {
    console.error('Error loading system prompt:', err);
    systemPrompt = 'Solve the problem shown in this image.';
  }
}

function loadConfig() {
  try {
    const configPath = path.join(__dirname, 'config.json');
    const configData = fs.readFileSync(configPath, 'utf8');
    config = JSON.parse(configData);
    
    const provider = config.providers.find(p => p.name === config.currentProvider);
    if (!provider) {
      throw new Error("Current provider not found in config.json");
    }
    
    if (!provider.apiKeys || provider.apiKeys.length === 0) {
      throw new Error("API keys are missing in config.json");
    }
    
    // Load current API key index from config if it exists
    currentApiKeyIndex = provider.currentApiKeyIndex || 0;
    if (currentApiKeyIndex >= provider.apiKeys.length) {
      currentApiKeyIndex = 0;
    }
    
    console.log(`Using provider: ${provider.name}, Model: ${provider.models[provider.currentModelIndex].displayName}, API Key Index: ${currentApiKeyIndex + 1}/${provider.apiKeys.length}`);
  } catch (err) {
    console.error("Error reading config:", err);
    app.quit();
  }
}

function saveCurrentApiKeyIndex() {
  try {
    const provider = config.providers.find(p => p.name === config.currentProvider);
    if (provider) {
      provider.currentApiKeyIndex = currentApiKeyIndex;
      const configPath = path.join(__dirname, 'config.json');
      fs.writeFileSync(configPath, JSON.stringify(config, null, 2), 'utf8');
    }
  } catch (err) {
    console.error("Error saving config:", err);
  }
}

function saveCurrentModelIndex() {
  try {
    const provider = config.providers.find(p => p.name === config.currentProvider);
    if (provider) {
      const configPath = path.join(__dirname, 'config.json');
      fs.writeFileSync(configPath, JSON.stringify(config, null, 2), 'utf8');
    }
  } catch (err) {
    console.error("Error saving config:", err);
  }
}

function switchApiKey() {
  const provider = config.providers.find(p => p.name === config.currentProvider);
  if (!provider || !provider.apiKeys) return;
  
  currentApiKeyIndex = (currentApiKeyIndex + 1) % provider.apiKeys.length;
  saveCurrentApiKeyIndex();
  
  console.log(`Switched to API Key ${currentApiKeyIndex + 1}/${provider.apiKeys.length}`);
  if (mainWindow?.webContents) {
    mainWindow.webContents.send('show-notification', `API Key: ${currentApiKeyIndex + 1}/${provider.apiKeys.length}`);
  }
}

function switchModel() {
  const provider = config.providers.find(p => p.name === config.currentProvider);
  if (!provider || !provider.models) return;
  
  provider.currentModelIndex = (provider.currentModelIndex + 1) % provider.models.length;
  saveCurrentModelIndex();
  
  const currentModel = provider.models[provider.currentModelIndex];
  console.log(`Switched to Model: ${currentModel.displayName}`);
  if (mainWindow?.webContents) {
    mainWindow.webContents.send('show-notification', `Model: ${currentModel.displayName}`);
  }
}

function moveWindow(direction) {
  if (!mainWindow) return;
  
  const bounds = mainWindow.getBounds();
  const moveStep = 50;
  
  switch(direction) {
    case 'up':
      mainWindow.setBounds({ ...bounds, y: bounds.y - moveStep });
      break;
    case 'down':
      mainWindow.setBounds({ ...bounds, y: bounds.y + moveStep });
      break;
    case 'left':
      mainWindow.setBounds({ ...bounds, x: bounds.x - moveStep });
      break;
    case 'right':
      mainWindow.setBounds({ ...bounds, x: bounds.x + moveStep });
      break;
  }
}

function copyToClipboard() {
  if (mainWindow?.webContents) {
    mainWindow.webContents.send('copy-content');
  }
}

loadSystemPrompt();
loadConfig();

let mainWindow;
let currentScreenshot = null;
let showWindow = true;
let stage = 0; // 0 = boot up stage, 2 = AI Answered

function updateInstruction(instruction) {
  if (mainWindow?.webContents) {
    mainWindow.webContents.send('update-instruction', instruction);
  }
}

function hideInstruction() {
  if (mainWindow?.webContents) {
    mainWindow.webContents.send('hide-instruction');
  }
}

async function captureScreenshot() {
  try {
    hideInstruction();
    mainWindow.hide();
    await new Promise(res => setTimeout(res, 200));

    const timestamp = Date.now();
    const imagePath = path.join(app.getPath('pictures'), `screenshot_${timestamp}.png`);
    
    // Capture screenshot with format explicitly set to PNG
    await screenshot({ filename: imagePath, format: 'png' });

    const imageBuffer = fs.readFileSync(imagePath);
    const base64Image = imageBuffer.toString('base64');
    
    // Clean up the temporary file
    try {
      fs.unlinkSync(imagePath);
    } catch (err) {
      console.log('Could not delete temp file:', err.message);
    }

    mainWindow.showInactive();
    return base64Image;
  } catch (err) {
    mainWindow.showInactive();
    if (mainWindow.webContents) {
      mainWindow.webContents.send('error', err.message);
    }
    throw err;
  }
}

function showMainWindow() {
  mainWindow.showInactive();
  if (stage == 2) {
    mainWindow.webContents.send('show-app');
    // Enable mouse events when showing content
    mainWindow.setIgnoreMouseEvents(false);
  } else {
    updateInstruction();
    // Keep click-through when just showing instruction banner
    mainWindow.setIgnoreMouseEvents(true, { forward: true });
  }
  showWindow = true;
}

function hideMainWindow() {
  mainWindow.webContents.send('hide-app');
  mainWindow.hide();
  mainWindow.setIgnoreMouseEvents(true, { forward: true });
  showWindow = false;
}

async function processScreenshots() {
  try {
    const provider = config.providers.find(p => p.name === config.currentProvider);
    if (!provider) {
      throw new Error("Provider not found");
    }
    
    const currentModel = provider.models[provider.currentModelIndex];
    
    // Build message with text + single screenshot
    const messages = [
      { type: "text", text: systemPrompt },
      {
        type: "image_url",
        image_url: { url: `data:image/png;base64,${currentScreenshot}` }
      }
    ];

    // Retry logic with exponential backoff
    const maxRetries = 3;
    let retryCount = 0;
    let allKeysRateLimited = false;
    
    while (retryCount < maxRetries) {
      let lastError = null;
      let successFound = false;
      let rateLimitedKeys = 0;
      
      // Try all API keys in cluster
      for (let i = 0; i < provider.apiKeys.length; i++) {
        const keyIndex = (currentApiKeyIndex + i) % provider.apiKeys.length;
        const apiKey = provider.apiKeys[keyIndex];
        
        try {
          console.log(`[Attempt ${retryCount + 1}/${maxRetries}] Trying API Key ${keyIndex + 1}/${provider.apiKeys.length}...`);
          
          // Make the request to OpenRouter API
          const response = await fetch(`${provider.baseURL}/chat/completions`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${apiKey}`,
              'HTTP-Referer': 'https://github.com/yourusername/oacoder',
              'X-Title': 'OA Coder'
            },
            body: JSON.stringify({
              model: currentModel.name,
              messages: [{ role: "user", content: messages }],
              max_tokens: 5000
            })
          });

          if (response.ok) {
            const data = await response.json();
            
            // Validate response structure
            if (!data || !data.choices || !data.choices[0] || !data.choices[0].message) {
              console.log(`✗ API Key ${keyIndex + 1}: Invalid response structure`, JSON.stringify(data, null, 2));
              lastError = new Error(`Invalid response from API Key ${keyIndex + 1}`);
              continue;
            }
            
            const content = data.choices[0].message.content;
            if (!content) {
              console.log(`✗ API Key ${keyIndex + 1}: Empty content in response`);
              lastError = new Error(`Empty response from API Key ${keyIndex + 1}`);
              continue;
            }
            
            // Rotate to next key for next request (round-robin)
            currentApiKeyIndex = (keyIndex + 1) % provider.apiKeys.length;
            saveCurrentApiKeyIndex();
            
            console.log(`✓ Success with API Key ${keyIndex + 1}/${provider.apiKeys.length}. Next request will use key ${currentApiKeyIndex + 1}`);
            
            // Send the text to the renderer
            mainWindow.webContents.send('analysis-result', content);
            stage = 2;
            successFound = true;
            break;
          } else if (response.status === 429) {
            rateLimitedKeys++;
            lastError = new Error(`Rate limited (${rateLimitedKeys}/${provider.apiKeys.length} keys)`);
            console.log(`⚠ API Key ${keyIndex + 1}: Rate limited (429)`);
          } else {
            lastError = new Error(`API Key ${keyIndex + 1} failed: ${response.status} ${response.statusText}`);
            console.log(lastError.message);
          }
        } catch (err) {
          lastError = err;
          console.log(`✗ API Key ${keyIndex + 1} error:`, err.message);
          console.log('Error details:', err);
        }
        
        // Small delay between key attempts to avoid rapid-fire rate limiting
        if (i < provider.apiKeys.length - 1 && !successFound) {
          await new Promise(resolve => setTimeout(resolve, 500));
        }
      }
      
      if (successFound) {
        return; // Success, exit the function
      }
      
      // Check if all keys are rate limited
      if (rateLimitedKeys === provider.apiKeys.length) {
        allKeysRateLimited = true;
        retryCount++;
        
        if (retryCount < maxRetries) {
          const waitTime = Math.pow(2, retryCount) * 2000; // 4s, 8s, 16s
          console.log(`⏳ All keys rate limited. Waiting ${waitTime/1000}s before retry ${retryCount + 1}/${maxRetries}...`);
          
          if (mainWindow?.webContents) {
            mainWindow.webContents.send('show-notification', `Rate limited. Retry in ${waitTime/1000}s...`);
          }
          
          await new Promise(resolve => setTimeout(resolve, waitTime));
        }
      } else {
        // Not all keys are rate limited, so don't retry
        throw lastError || new Error("Request failed");
      }
    }
    
    // All retries exhausted
    if (allKeysRateLimited) {
      throw new Error(`All ${provider.apiKeys.length} API keys are rate limited. Please wait a few minutes and try again.`);
    }
    
  } catch (err) {
    console.error("Error in processScreenshots:", err);
    if (mainWindow.webContents) {
      mainWindow.webContents.send('error', err.message);
    }
  }
}

// Reset everything
function resetProcess() {
  currentScreenshot = null;
  mainWindow.webContents.send('clear-result');
  updateInstruction("Ctrl+Shift+S: Screenshot | Ctrl+Shift+1: API Key | Ctrl+Shift+2: Model | Arrows: Move");
  stage = 0;
  // Back to click-through mode
  mainWindow.setIgnoreMouseEvents(true, { forward: true });
}

function createWindow() {
  stage = 0;
  mainWindow = new BrowserWindow({
    width: 400,
    height: 300,
    minWidth: 300,
    minHeight: 200,
    maxWidth: 1200,
    maxHeight: 900,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false
    },
    frame: false,
    transparent: true,
    alwaysOnTop: true,
    paintWhenInitiallyHidden: true,
    contentProtection: true,
    type: 'toolbar',
    resizable: true,
    skipTaskbar: true,
    focusable: false,
    minimizable: false,
    maximizable: false,
    hasShadow: false
  });

  mainWindow.loadFile('index.html');
  mainWindow.setContentProtection(true);
  mainWindow.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });
  mainWindow.setAlwaysOnTop(true, 'screen-saver', 1);
  
  // Make window click-through when idle (no content displayed)
  mainWindow.setIgnoreMouseEvents(true, { forward: true });

  // Prevent window from hiding when it loses focus - keep it as overlay
  mainWindow.on('blur', () => {
    // Re-assert always on top when focus is lost
    if (showWindow && mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.setAlwaysOnTop(true, 'screen-saver', 1);
    }
  });

  // Prevent minimize
  mainWindow.on('minimize', (event) => {
    event.preventDefault();
    if (showWindow) {
      mainWindow.showInactive();
    }
  });

  // Keep window visible - periodic check every 2 seconds
  setInterval(() => {
    if (showWindow && mainWindow && !mainWindow.isDestroyed()) {
      if (!mainWindow.isVisible()) {
        mainWindow.showInactive();
      }
      mainWindow.setAlwaysOnTop(true, 'screen-saver', 1);
    }
  }, 2000);

  // Ctrl+Shift+S => single screenshot and process immediately
  globalShortcut.register('CommandOrControl+Shift+S', async () => {
    try {
      currentScreenshot = await captureScreenshot();
      await processScreenshots();
    } catch (error) {
      console.error("Ctrl+Shift+S error:", error);
    }
  });

  // Ctrl+Shift+1 => Switch API key
  globalShortcut.register('CommandOrControl+Shift+1', () => {
    switchApiKey();
  });

  // Ctrl+Shift+2 => Switch Model
  globalShortcut.register('CommandOrControl+Shift+2', () => {
    switchModel();
  });

  // Ctrl+Shift+3 => Copy to clipboard
  globalShortcut.register('CommandOrControl+Shift+3', () => {
    copyToClipboard();
  });

  // Ctrl+Shift+Arrow => Move window
  globalShortcut.register('CommandOrControl+Shift+Up', () => {
    moveWindow('up');
  });

  globalShortcut.register('CommandOrControl+Shift+Down', () => {
    moveWindow('down');
  });

  globalShortcut.register('CommandOrControl+Shift+Left', () => {
    moveWindow('left');
  });

  globalShortcut.register('CommandOrControl+Shift+Right', () => {
    moveWindow('right');
  });

  // Ctrl+Shift+R => Refresh/reset
  globalShortcut.register('CommandOrControl+Shift+R', () => {
    resetProcess();
  });

  // Ctrl+Shift+E => Hide/show window
  globalShortcut.register('CommandOrControl+Shift+E', () => {
    if (showWindow) {
      hideMainWindow();
    } else {
      showMainWindow();
    }
  });
     
  // Ctrl+Shift+Q => Quit the application
  globalShortcut.register('CommandOrControl+Shift+Q', () => {
    console.log("Quitting application...");
    app.quit();
  });
}

app.whenReady().then(createWindow);

app.on('window-all-closed', () => {
  globalShortcut.unregisterAll();
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});
