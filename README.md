# OA Coder

OA Coder is an Electron application that captures screenshots and leverages AI APIs (OpenRouter) to analyze them. It can solve questions, generate code, or provide detailed answers based on screenshots. The app supports both single screenshot processing and multi-page mode for capturing multiple images before analysis.

## Features

- **Screenshot Capture:** Use global keyboard shortcuts to capture the screen.
- **OpenRouter Integration:** Send captured screenshots to OpenRouter's API with support for multiple free AI models.
- **API Key Rotation:** Automatically switch between multiple API keys to avoid rate limits.
- **Model Switching:** Cycle through different AI models on the fly.
- **Multi-Page Mode:** Combine multiple screenshots for questions spanning several pages.
- **Window Movement:** Move the window using keyboard shortcuts.
- **Customizable UI:** Minimal, transparent, always-on-top window with markdown-rendered responses.
- **Global Shortcuts:** Easily control the application using keyboard shortcuts.

## Prerequisites

- [Node.js](https://nodejs.org/) (v14 or later recommended)
- [npm](https://www.npmjs.com/) or [yarn](https://yarnpkg.com/)
- OpenRouter API keys (get free keys from https://openrouter.ai/)

## Installation

1. **Clone the repository:**

   ```bash
   git clone https://github.com/archangel0x01/oa-coder.git
   cd oa-coder
   ```

2. **Install the dependencies:**
   ```bash
   npm install
   ```

3. **Configure the application:**
   Create a `config.json` file in the project root with your OpenRouter API keys and models. Example:
   ```json
   {
     "providers": [
       {
         "name": "openrouter",
         "apiKeys": [
           "sk-or-v1-YOUR_API_KEY_1",
           "sk-or-v1-YOUR_API_KEY_2"
         ],
         "models": [
           {
             "name": "google/gemini-2.0-flash-exp:free",
             "displayName": "Gemini 2.0 Flash Exp (Free)"
           },
           {
             "name": "google/gemma-3-27b-it:free",
             "displayName": "Gemma 3 27B IT (Free)"
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


## Usage

1. **Start the Application:**
    Run the following command to launch OA Coder:
    ```bash
    npm start
    ```

2. **Global Keyboard Shortcuts:**

    - **Ctrl+Shift+S:** Capture a screenshot and process it immediately. In multi-page mode, this finalizes the session and sends all captured screenshots for processing.
    - **Ctrl+Shift+A:** Capture an additional screenshot in multi-page mode.
    - **Ctrl+Shift+1:** Switch to the next API key (rotates through all configured keys).
    - **Ctrl+Shift+2:** Switch to the next AI model (rotates through all configured models).
    - **Ctrl+Shift+3:** Copy the AI response to clipboard.
    - **Ctrl+Shift+R:** Reset/refresh the buffer (clears all captured screenshots and results).
    - **Ctrl+Shift+E:** Hide/show the application window.
    - **Ctrl+Shift+Arrow Keys:** Move the window (Up/Down/Left/Right by 50px).
    - **Ctrl+Shift+Q:** Quit the application.

3. **Window Features:**
    - The window is resizable (drag edges/corners to resize).
    - Minimal, transparent design with white background.
    - Always stays on top of other windows.
    - Responses are rendered in markdown format.


## Status

This program is still under development. Some features may not be fully implemented, and there might be bugs or incomplete functionality. Your feedback and contributions are welcome as we work towards a more stable release.


**Personal Thoughts**: Inspired by interviewcoder.co but didn't like the idea of gatekeeping **cheating** softwares behind paywalls. Like you're literally cheating wtf man? And this might help incompetent software engineers join the company and eat it from the inside forcing companies to realise that Leetcode isn't the only way people should get hired and there are other alternative ways to assess a candidate's abilities.
