# OA Coder - Stealth Overlay Screenshot Analyzer

A transparent, stealth overlay application that captures screenshots and analyzes them using AI models.

## 📁 Project Structure

```
oacoder new/
├── src/
│   ├── app.js                      # Main application entry point
│   ├── config/
│   │   └── configManager.js        # Configuration management
│   ├── services/
│   │   ├── apiService.js           # API communication & retry logic
│   │   └── screenshotService.js    # Screenshot capture service
│   ├── ui/
│   │   └── windowManager.js        # Window creation & UI management
│   └── shortcuts/
│       └── shortcutManager.js      # Global keyboard shortcuts
├── config.json                     # API keys and model configuration
├── index.html                      # UI renderer
├── package.json                    # Dependencies
└── README.md                       # Documentation
```

## 🏗️ Architecture

### **Core Modules**

1. **ConfigManager** (`src/config/configManager.js`)
   - Loads and saves configuration
   - Manages API keys rotation
   - Handles model switching
   - Persistent state management

2. **ApiService** (`src/services/apiService.js`)
   - Communicates with OpenRouter API
   - Automatic retry with exponential backoff
   - Rate limit handling (429 errors)
   - Round-robin API key rotation
   - Response validation

3. **ScreenshotService** (`src/services/screenshotService.js`)
   - Captures screenshots in PNG format
   - Base64 encoding
   - Temporary file cleanup
   - Single screenshot management

4. **WindowManager** (`src/ui/windowManager.js`)
   - Creates stealth overlay window
   - Manages window visibility and interactions
   - Click-through when idle
   - IPC communication with renderer
   - Window positioning

5. **ShortcutManager** (`src/shortcuts/shortcutManager.js`)
   - Registers global keyboard shortcuts
   - Coordinates between all services
   - Clean registration/unregistration

6. **App** (`src/app.js`)
   - Main application orchestrator
   - Initializes all modules
   - Lifecycle management
   - Dependency injection

## ⌨️ Keyboard Shortcuts

| Shortcut | Action |
|----------|--------|
| `Ctrl+Shift+S` | Capture screenshot & analyze |
| `Ctrl+Shift+1` | Switch API key |
| `Ctrl+Shift+2` | Switch model |
| `Ctrl+Shift+3` | Copy result to clipboard |
| `Ctrl+Shift+R` | Clear result & reset |
| `Ctrl+Shift+E` | Hide/show overlay |
| `Ctrl+Shift+Q` | Quit application |
| `Ctrl+Shift+Arrows` | Move window position |

## 🚀 Features

### **Stealth Mode**
- ✅ Hidden from taskbar and Alt+Tab
- ✅ Click-through when idle
- ✅ Never steals focus from other apps
- ✅ Transparent overlay design
- ✅ Minimal visual footprint

### **Smart API Management**
- ✅ 9 API keys with automatic rotation
- ✅ Round-robin load balancing
- ✅ Rate limit detection & retry
- ✅ Exponential backoff (4s, 8s, 16s)
- ✅ 500ms delay between key attempts

### **Error Handling**
- ✅ Response validation
- ✅ Graceful error messages
- ✅ Automatic cleanup
- ✅ Detailed console logging

## 🔧 Installation

```bash
npm install
npm start
```

## 📝 Configuration

Edit `config.json` to customize:
- API providers and keys
- Available models
- Default model selection
- Current API key index

## 🎯 Usage Flow

1. Press `Ctrl+Shift+S` to capture screen
2. App hides temporarily, captures screenshot as PNG
3. Tries API keys sequentially with 500ms delay
4. On rate limit, retries with exponential backoff
5. Validates response structure
6. Displays result in overlay
7. Automatically rotates to next API key

## 🛠️ Optimization Features

- **Separation of Concerns**: Each module has single responsibility
- **Dependency Injection**: Clean module dependencies
- **Error Boundaries**: Isolated error handling per module
- **Resource Cleanup**: Automatic temp file deletion
- **Memory Efficient**: Single screenshot storage
- **Performance**: Minimal overhead, fast response

## 📊 Code Quality

- Modular architecture
- Clear naming conventions
- Comprehensive error handling
- Console logging for debugging
- Clean code principles
- DRY (Don't Repeat Yourself)

## 🔐 Security

- API keys stored in config.json (add to .gitignore)
- Content protection enabled
- No data persistence beyond current session
- Screenshot cleanup after encoding
