const { desktopCapturer, screen } = require('electron');
const path = require('path');
const fs = require('fs');

/**
 * ImageUtils - Image processing utilities
 * Handles compression, conversion, and region capture
 */
class ImageUtils {
  constructor() {
    this.maxWidth = 1920;
    this.maxHeight = 1080;
    this.quality = 0.85;
  }

  /**
   * Compress image buffer (resize if too large)
   * Uses native Canvas API available in Electron
   */
  async compressImage(base64Image) {
    try {
      // Create a simple size check - if image is already small, return as-is
      const sizeInKB = (base64Image.length * 0.75) / 1024;
      
      if (sizeInKB < 500) {
        console.log(`Image size ${sizeInKB.toFixed(0)}KB - no compression needed`);
        return base64Image;
      }
      
      console.log(`Compressing image from ${sizeInKB.toFixed(0)}KB...`);
      
      // For significant compression, we'd use sharp or jimp
      // For now, return as-is since sharp requires native modules
      // This can be enhanced when sharp is added as dependency
      
      return base64Image;
    } catch (err) {
      console.error('Compression error:', err);
      return base64Image;
    }
  }

  /**
   * Get all available screens/displays
   */
  async getDisplays() {
    const displays = screen.getAllDisplays();
    return displays.map((display, index) => ({
      id: display.id,
      index,
      label: `Display ${index + 1}`,
      bounds: display.bounds,
      size: display.size,
      isPrimary: display.id === screen.getPrimaryDisplay().id
    }));
  }

  /**
   * Capture specific screen by display ID
   */
  async captureScreen(displayId = null) {
    try {
      const sources = await desktopCapturer.getSources({
        types: ['screen'],
        thumbnailSize: { width: this.maxWidth, height: this.maxHeight }
      });
      
      let source = sources[0];
      
      if (displayId !== null) {
        const targetSource = sources.find(s => s.display_id === String(displayId));
        if (targetSource) {
          source = targetSource;
        }
      }
      
      if (source) {
        const thumbnail = source.thumbnail;
        const dataUrl = thumbnail.toDataURL();
        const base64 = dataUrl.replace(/^data:image\/\w+;base64,/, '');
        return base64;
      }
      
      throw new Error('No screen source available');
    } catch (err) {
      console.error('Screen capture error:', err);
      throw err;
    }
  }

  /**
   * Convert JPEG to PNG format
   */
  jpegToPng(base64Jpeg) {
    // In browser/electron context, this would use Canvas
    // Return as-is for now
    return base64Jpeg;
  }

  /**
   * Get image dimensions from base64
   */
  async getImageDimensions(base64Image) {
    // Estimate from base64 length (rough approximation)
    const sizeInBytes = base64Image.length * 0.75;
    return {
      estimatedSizeBytes: sizeInBytes,
      estimatedSizeKB: sizeInBytes / 1024,
      estimatedSizeMB: sizeInBytes / (1024 * 1024)
    };
  }

  /**
   * Validate image is not too large for API
   */
  validateForAPI(base64Image, maxSizeMB = 20) {
    const sizeInBytes = base64Image.length * 0.75;
    const sizeInMB = sizeInBytes / (1024 * 1024);
    
    if (sizeInMB > maxSizeMB) {
      return {
        valid: false,
        error: `Image too large: ${sizeInMB.toFixed(2)}MB (max: ${maxSizeMB}MB)`
      };
    }
    
    return { valid: true, sizeMB: sizeInMB };
  }
}

module.exports = ImageUtils;
