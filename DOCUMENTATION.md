# OA Coder - Complete Project Documentation

> **Version:** 1.0.0  
> **Platform:** Windows (Electron)  
> **Last Updated:** February 2026

---

## Table of Contents

1. [Project Overview](#project-overview)
2. [Features](#features)
3. [Technology Stack](#technology-stack)
4. [Project Architecture](#project-architecture)
5. [Directory Structure](#directory-structure)
6. [Core Modules](#core-modules)
7. [Configuration](#configuration)
8. [Keyboard Shortcuts](#keyboard-shortcuts)
9. [Installation & Setup](#installation--setup)
10. [Usage Guide](#usage-guide)
11. [API Integration](#api-integration)
12. [UI/UX Design](#uiux-design)
13. [Security Considerations](#security-considerations)
14. [Development Notes](#development-notes)
15. [Troubleshooting](#troubleshooting)

---

## Project Overview

**OA Coder** is a stealth overlay Electron desktop application designed to capture screenshots and analyze them using AI models via the OpenRouter API. The application can solve coding problems, answer multiple-choice questions, and provide detailed explanations based on captured screenshots.

### Primary Use Cases
- Solving coding/programming questions from screenshots
- Answering multiple-choice questions
- Analyzing images with AI models
- Multi-page document analysis

### Key Characteristics
- **Stealth Mode:** Hidden from taskbar and Alt+Tab
- **Always-on-Top:** Transparent overlay that stays above other windows
- **Click-Through:** Non-intrusive when idle
- **Global Shortcuts:** Control entirely via keyboard

---

## Features

### Screenshot Capture
- Captures the entire screen in PNG format
- Automatic window hiding during capture
- Base64 encoding for API transmission
- Temporary file cleanup after processing

### AI Integration
- OpenRouter API integration for multiple AI models
- Support for vision-capable models (image analysis)
- Multiple provider support (OpenRouter, Together AI)
- Automatic API key rotation

### Smart API Management
- Round-robin load balancing across API keys
- Rate limit detection (HTTP 429)
- Exponential backoff retry mechanism (4s, 8s, 16s delays)
- 500ms delay between key attempts
- Automatic rotation to next working key

### Window Management
- Resizable overlay window (300x200 to 1200x900)
- Transparent, frameless design
- Click-through when idle, interactive when showing results
- Keyboard-based window movement (50px increments)
- Content protection enabled

### User Interface
- Markdown-rendered responses
- Notification system for status updates
- Error display with recovery instructions
- Minimal visual footprint

---

## Technology Stack

| Component | Technology |
|-----------|------------|
| **Framework** | Electron v39.2.4 |
| **Language** | JavaScript (Node.js) |
| **Package Manager** | npm |
| **AI SDK** | OpenAI SDK v4.24.1 |
| **Screenshot** | screenshot-desktop v1.15.0 |
| **Build Tool** | electron-builder v26.4.0 |
| **Markdown** | marked.js (CDN) |

### Dependencies

```json
{
  "dependencies": {
    "openai": "^4.24.1",
    "screenshot-desktop": "^1.15.0"
  },
  "devDependencies": {
    "electron": "^39.2.4",
    "electron-builder": "^26.4.0"
  }
}
```

---

## Project Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                        OA Coder Application                     │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  ┌─────────────┐    ┌──────────────┐    ┌─────────────────┐    │
│  │   App.js    │───▶│ ConfigManager│    │  ShortcutManager│    │
│  │ (Orchestrator)   │ (Settings)   │    │ (Global Keys)   │    │
│  └─────────────┘    └──────────────┘    └─────────────────┘    │
│         │                  │                    │               │
│         ▼                  ▼                    ▼               │
│  ┌─────────────┐    ┌──────────────┐    ┌─────────────────┐    │
│  │WindowManager│    │  ApiService  │    │ScreenshotService│    │
│  │    (UI)     │◀───│   (API)      │◀───│   (Capture)     │    │
│  └─────────────┘    └──────────────┘    └─────────────────┘    │
│         │                  │                                    │
│         ▼                  ▼                                    │
│  ┌─────────────┐    ┌──────────────┐                           │
│  │ index.html  │    │ OpenRouter   │                           │
│  │ (Renderer)  │    │    API       │                           │
│  └─────────────┘    └──────────────┘                           │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### Data Flow

1. User presses `Ctrl+Shift+S`
2. `ShortcutManager` triggers capture sequence
3. `ScreenshotService` hides window, captures screen, encodes to Base64
4. `ApiService` sends image to AI model via OpenRouter
5. Response is parsed and rendered as Markdown
6. `WindowManager` displays result in overlay

---

## Directory Structure

```
oacoder-new/
├── src/
│   ├── app.js                      # Main application entry point & orchestrator
│   ├── config/
│   │   └── configManager.js        # Configuration management & persistence
│   ├── services/
│   │   ├── apiService.js           # API communication, retry logic, key rotation
│   │   └── screenshotService.js    # Screenshot capture & encoding
│   ├── ui/
│   │   └── windowManager.js        # Window creation, visibility, IPC
│   └── shortcuts/
│       └── shortcutManager.js      # Global keyboard shortcuts registration
├── config.json                     # API keys, models, provider configuration
├── index.html                      # Renderer process UI
├── main.js                         # Legacy entry point (redirects to src/app.js)
├── system-prompt.txt               # AI system prompt configuration
├── package.json                    # Node.js dependencies & scripts
├── README.md                       # Project overview
├── PROJECT_README.md               # Technical documentation
└── test-api-keys.js                # API key testing utility
```

---

## Core Modules

### 1. App (`src/app.js`)

The main orchestrator that initializes and coordinates all modules.

**Responsibilities:**
- Application lifecycle management
- Module initialization in correct order
- Dependency injection between modules
- Cleanup on application exit

**Key Methods:**
- `constructor()` - Instantiates all service classes
- `initialize()` - Loads config, creates window, registers shortcuts
- `cleanup()` - Unregisters shortcuts on exit

```javascript
class OACoderApp {
  constructor() {
    this.configManager = new ConfigManager();
    this.windowManager = new WindowManager();
    this.screenshotService = new ScreenshotService();
    this.apiService = new ApiService(this.configManager);
    this.shortcutManager = null;
  }
  // ...
}
```

---

### 2. ConfigManager (`src/config/configManager.js`)

Handles all configuration-related operations.

**Responsibilities:**
- Load/save configuration from `config.json`
- Manage API key rotation
- Handle model switching
- Provide current provider/model/key access

**Key Methods:**
| Method | Description |
|--------|-------------|
| `load()` | Loads configuration from file |
| `save()` | Persists configuration to file |
| `getCurrentProvider()` | Returns active provider object |
| `getCurrentModel()` | Returns active model object |
| `switchApiKey()` | Rotates to next API key |
| `switchModel()` | Rotates to next model |
| `getVisionModel()` | Returns a vision-capable model |
| `rotateToNextKey()` | Auto-rotate after successful request |

---

### 3. ApiService (`src/services/apiService.js`)

Handles all AI API communication.

**Responsibilities:**
- Send screenshots to OpenRouter API
- Handle rate limiting (429 errors)
- Implement retry with exponential backoff
- Validate API responses
- Load system prompt from file

**System Prompt:**
```
Analyze the image and provide a clear, concise answer. If it's a coding problem, 
provide the complete working solution. If it's a multiple choice question, 
identify the correct answer and explain why. Be direct and accurate.
```

**Retry Logic:**
1. Try each API key sequentially
2. Wait 500ms between key attempts
3. On rate limit (429), track limited keys
4. If all keys limited, wait with exponential backoff:
   - Retry 1: 4 seconds
   - Retry 2: 8 seconds
   - Retry 3: 16 seconds
5. Maximum 3 retry rounds

**API Request Structure:**
```javascript
{
  model: "google/gemma-3-27b-it:free",
  messages: [{
    role: "user",
    content: [
      { type: "text", text: "System prompt..." },
      { type: "image_url", image_url: { url: "data:image/png;base64,..." } }
    ]
  }],
  max_tokens: 5000
}
```

---

### 4. ScreenshotService (`src/services/screenshotService.js`)

Manages screenshot capture and encoding.

**Responsibilities:**
- Capture screen as PNG image
- Hide application window during capture
- Encode image to Base64
- Clean up temporary files
- Store current screenshot in memory

**Capture Flow:**
1. Hide main window
2. Wait 200ms for window to hide
3. Capture screen to temp PNG file
4. Read file and encode to Base64
5. Delete temp file
6. Show main window
7. Return Base64 string

---

### 5. WindowManager (`src/ui/windowManager.js`)

Creates and manages the overlay window.

**Window Configuration:**
```javascript
{
  width: 400, height: 300,
  minWidth: 300, minHeight: 200,
  maxWidth: 1200, maxHeight: 900,
  frame: false,           // Frameless
  transparent: true,      // Transparent background
  alwaysOnTop: true,      // Always on top
  skipTaskbar: true,      // Hidden from taskbar
  focusable: false,       // Never steals focus
  resizable: true,        // User can resize
  type: 'toolbar'         // Toolbar window type
}
```

**Window States:**
| Stage | Description | Mouse Events |
|-------|-------------|--------------|
| 0 | Idle | Click-through (ignored) |
| 2 | Showing results | Interactive (captured) |

**Key Methods:**
| Method | Description |
|--------|-------------|
| `create()` | Creates the BrowserWindow |
| `show()` / `hide()` | Toggle visibility |
| `move(direction)` | Move window 50px in direction |
| `showResult(content)` | Display AI response |
| `showError(error)` | Display error message |
| `showNotification(msg)` | Show temporary notification |
| `copyContent()` | Copy response to clipboard |
| `clear()` | Reset to idle state |

---

### 6. ShortcutManager (`src/shortcuts/shortcutManager.js`)

Registers and manages global keyboard shortcuts.

**Registered Shortcuts:**
| Shortcut | Action | Handler |
|----------|--------|---------|
| `Ctrl+Shift+S` | Screenshot & analyze | Async capture + API call |
| `Ctrl+Shift+1` | Switch API key | ConfigManager.switchApiKey() |
| `Ctrl+Shift+2` | Switch model | ConfigManager.switchModel() |
| `Ctrl+Shift+3` | Copy to clipboard | WindowManager.copyContent() |
| `Ctrl+Shift+R` | Reset/clear | Clear screenshot & window |
| `Ctrl+Shift+E` | Toggle visibility | Show/hide window |
| `Ctrl+Shift+Q` | Quit application | app.quit() |
| `Ctrl+Shift+↑↓←→` | Move window | WindowManager.move() |

---

## Configuration

### config.json Structure

```json
{
  "providers": [
    {
      "name": "openrouter",
      "apiKeys": ["sk-or-v1-...", "sk-or-v1-..."],
      "models": [
        {
          "name": "nvidia/nemotron-nano-12b-v2-vl:free",
          "displayName": "NVIDIA: Nemotron Nano 12B 2 VL (free)",
          "supportsVision": true
        }
      ],
      "currentModelIndex": 0,
      "currentApiKeyIndex": 0,
      "baseURL": "https://openrouter.ai/api/v1"
    }
  ],
  "currentProvider": "openrouter",
  "fallbackToNextProvider": false
}
```

### Available Models (Default)

| Model | Provider | Vision Support |
|-------|----------|----------------|
| NVIDIA Nemotron Nano 12B VL | OpenRouter | ✅ |
| Mistral Small 3.1 24B | OpenRouter | ✅ |
| Google Gemma 3 4B | OpenRouter | ✅ |
| Google Gemma 3 12B | OpenRouter | ✅ |
| Google Gemma 3 27B | OpenRouter | ✅ |
| Google Gemini 2.0 Flash Lite | OpenRouter | ✅ |
| DeepSeek R1 Distill 70B | Together | ❌ |

### system-prompt.txt

Contains the system prompt sent with every API request:
```
Analyze the image and provide a clear, concise answer. If it's a coding problem, 
provide the complete working solution. If it's a multiple choice question, 
identify the correct answer and explain why. Be direct and accurate.
```

---

## Keyboard Shortcuts

### Primary Actions

| Shortcut | Action | Description |
|----------|--------|-------------|
| `Ctrl+Shift+S` | **Screenshot** | Capture screen and analyze |
| `Ctrl+Shift+R` | **Reset** | Clear result and start fresh |
| `Ctrl+Shift+E` | **Toggle** | Hide/show overlay window |
| `Ctrl+Shift+Q` | **Quit** | Exit application |

### Configuration

| Shortcut | Action | Description |
|----------|--------|-------------|
| `Ctrl+Shift+1` | **API Key** | Switch to next API key |
| `Ctrl+Shift+2` | **Model** | Switch to next AI model |
| `Ctrl+Shift+3` | **Copy** | Copy response to clipboard |

### Window Movement

| Shortcut | Action |
|----------|--------|
| `Ctrl+Shift+↑` | Move window up 50px |
| `Ctrl+Shift+↓` | Move window down 50px |
| `Ctrl+Shift+←` | Move window left 50px |
| `Ctrl+Shift+→` | Move window right 50px |

---

## Installation & Setup

### Prerequisites

- **Node.js** v14 or later
- **npm** or yarn
- **OpenRouter API Key(s)** - Free at https://openrouter.ai/

### Installation Steps

```bash
# 1. Clone the repository
git clone https://github.com/archangel0x01/oa-coder.git
cd oa-coder

# 2. Install dependencies
npm install

# 3. Configure API keys (edit config.json)
# Add your OpenRouter API keys to the apiKeys array

# 4. Start the application
npm start

# 5. Build for distribution (optional)
npm run build
```

### Build Configuration

```json
{
  "build": {
    "appId": "com.oacoder.app",
    "win": {
      "target": "nsis",
      "forceCodeSigning": false,
      "signAndEditExecutable": false
    }
  }
}
```

---

## Usage Guide

### Basic Workflow

1. **Start Application:** `npm start`
2. **Capture Screenshot:** Press `Ctrl+Shift+S`
3. **Wait for Analysis:** App captures, sends to AI, displays result
4. **View Result:** Rendered in Markdown format in overlay
5. **Copy Result:** Press `Ctrl+Shift+3` to copy to clipboard
6. **Reset:** Press `Ctrl+Shift+R` to start over

### Window States

| State | Behavior |
|-------|----------|
| **Idle** | Transparent, click-through, shows shortcut hints |
| **Processing** | Hidden during capture, notification shown |
| **Result** | Interactive, displays AI response |
| **Hidden** | Completely invisible |

### Switching Models

When experiencing issues or wanting different responses:
1. Press `Ctrl+Shift+2` to cycle through available models
2. A notification shows the new model name
3. Next screenshot will use the new model

### API Key Rotation

- **Automatic:** Keys rotate after each successful request
- **Manual:** Press `Ctrl+Shift+1` to switch API key
- **Rate Limiting:** Automatically tries next key on 429 error

---

## API Integration

### OpenRouter API

**Endpoint:** `https://openrouter.ai/api/v1/chat/completions`

**Request Headers:**
```
Content-Type: application/json
Authorization: Bearer sk-or-v1-...
HTTP-Referer: https://github.com/yourusername/oacoder
X-Title: OA Coder
```

**Request Body:**
```json
{
  "model": "google/gemma-3-27b-it:free",
  "messages": [{
    "role": "user",
    "content": [
      { "type": "text", "text": "System prompt..." },
      { "type": "image_url", "image_url": { "url": "data:image/png;base64,..." } }
    ]
  }],
  "max_tokens": 5000
}
```

### Rate Limit Handling

| Header | Description |
|--------|-------------|
| `x-ratelimit-remaining-requests` | Requests remaining in current window |
| `x-ratelimit-reset-requests` | Time when rate limit resets |

### Error Handling

| HTTP Status | Action |
|-------------|--------|
| 200 | Success - parse and display result |
| 429 | Rate limited - try next key or wait |
| 4xx | Client error - display error message |
| 5xx | Server error - retry with backoff |

---

## UI/UX Design

### Visual Design

- **Background:** Semi-transparent white (#FFFFFF, 90% opacity)
- **Text:** Dark gray (#333333)
- **Font:** Arial, 13px for content, 10px for notifications
- **Border Radius:** 4px for main box, 3px for code blocks
- **Shadows:** Subtle drop shadows (0 2px 8px rgba(0,0,0,0.1))

### Response Styling

- **Markdown Rendering:** via marked.js library
- **Code Blocks:** Monospace font, light gray background
- **Inline Code:** Consolas font, 12px size
- **Error Messages:** Red accent (#c62828), left border indicator
- **Scrollbar:** Custom styled, 6px width

### IPC Events

| Event | Direction | Purpose |
|-------|-----------|---------|
| `analysis-result` | Main → Renderer | Display AI response |
| `error` | Main → Renderer | Display error message |
| `update-instruction` | Main → Renderer | Update banner text |
| `hide-instruction` | Main → Renderer | Hide banner |
| `show-notification` | Main → Renderer | Show temp notification |
| `copy-content` | Main → Renderer | Copy to clipboard |
| `clear-result` | Main → Renderer | Clear response display |
| `show-app` / `hide-app` | Main → Renderer | Toggle visibility |

---

## Security Considerations

### Data Privacy
- Screenshots are processed in memory only
- Temporary files deleted immediately after encoding
- No persistent storage of images or results
- Content protection enabled on window

### API Security
- API keys stored in local `config.json`
- **Recommendation:** Add `config.json` to `.gitignore`
- Keys transmitted over HTTPS only
- No keys logged or displayed in UI

### Window Security
- Content protection prevents screen capture
- Window hidden from taskbar and Alt+Tab
- Never steals focus from other applications

---

## Development Notes

### Code Principles

- **Separation of Concerns:** Each module handles single responsibility
- **Dependency Injection:** Clean module dependencies
- **Error Boundaries:** Isolated error handling per module
- **DRY:** Don't Repeat Yourself
- **Resource Cleanup:** Automatic temp file deletion

### Console Logging

The application outputs detailed logs for debugging:
```
Using provider: openrouter, Model: Google: Gemma 3 27B (free), API Key Index: 1/3
[Attempt 1/3] Trying API Key 1/3...
  Rate Limit: 10 requests remaining, resets at 2026-02-14T12:00:00Z
✓ Success with API Key 1/3
Switched to API Key 2/3
```

### Module Dependencies

```
app.js
├── ConfigManager (no deps)
├── WindowManager (no deps)
├── ScreenshotService (no deps)
├── ApiService (ConfigManager)
└── ShortcutManager (WindowManager, ScreenshotService, ApiService, ConfigManager)
```

---

## Troubleshooting

### Common Issues

| Issue | Solution |
|-------|----------|
| Application doesn't start | Check `config.json` exists and is valid JSON |
| "No model configured" error | Ensure models array is not empty in config |
| All API keys rate limited | Wait a few minutes or add more API keys |
| Screenshot fails | Ensure screenshot-desktop is installed |
| Window not visible | Press `Ctrl+Shift+E` to show |
| Model doesn't support vision | Switch to vision-capable model (`Ctrl+Shift+2`) |

### Log Locations

- **Console Output:** Run app from terminal to see logs
- **Error Messages:** Displayed in overlay with red accent

### Recovery Steps

1. Wrong model selected: Press `Ctrl+Shift+2` to switch
2. Wrong API key: Press `Ctrl+Shift+1` to rotate
3. Result stuck: Press `Ctrl+Shift+R` to reset
4. Window lost: Press `Ctrl+Shift+E` to toggle visibility
5. App frozen: Press `Ctrl+Shift+Q` to quit

---

## License & Attribution

**Author:** archangel0x01  
**Repository:** https://github.com/archangel0x01/oa-coder

> **Note:** This project is under active development. Some features may not be fully implemented.

---

*Documentation generated February 2026*
