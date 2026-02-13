const screenshot = require('screenshot-desktop');
const fs = require('fs');
const path = require('path');
const { app } = require('electron');

class ScreenshotService {
  constructor() {
    this.currentScreenshot = null;
  }

  async capture(mainWindow) {
    try {
      mainWindow.hide();
      await new Promise(res => setTimeout(res, 200));

      const timestamp = Date.now();
      const imagePath = path.join(app.getPath('pictures'), `screenshot_${timestamp}.png`);
      
      await screenshot({ filename: imagePath, format: 'png' });

      const imageBuffer = fs.readFileSync(imagePath);
      const base64Image = imageBuffer.toString('base64');
      
      try {
        fs.unlinkSync(imagePath);
      } catch (err) {
        console.log('Could not delete temp file:', err.message);
      }

      this.currentScreenshot = base64Image;
      mainWindow.show();
      return base64Image;
    } catch (err) {
      mainWindow.show();
      throw err;
    }
  }

  clear() {
    this.currentScreenshot = null;
  }

  getCurrent() {
    return this.currentScreenshot;
  }
}

module.exports = ScreenshotService;
