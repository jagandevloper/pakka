const fs = require('fs');
const path = require('path');
const { app, clipboard, dialog } = require('electron');

/**
 * ExportService - Handles exporting responses in various formats
 * Supports Markdown, HTML, plain text, and JSON
 */
class ExportService {
  constructor() {
    this.defaultExportPath = app.getPath('documents');
  }

  /**
   * Generate filename with timestamp
   */
  generateFilename(extension) {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').substring(0, 19);
    return `oacoder-response-${timestamp}.${extension}`;
  }

  /**
   * Export response as Markdown file
   */
  async exportToMarkdown(response, metadata = {}) {
    const content = this.formatMarkdown(response, metadata);
    const filename = this.generateFilename('md');
    
    const result = await dialog.showSaveDialog({
      title: 'Export as Markdown',
      defaultPath: path.join(this.defaultExportPath, filename),
      filters: [{ name: 'Markdown', extensions: ['md'] }]
    });
    
    if (!result.canceled && result.filePath) {
      fs.writeFileSync(result.filePath, content, 'utf8');
      console.log(`Exported to: ${result.filePath}`);
      return { success: true, path: result.filePath };
    }
    
    return { success: false, canceled: true };
  }

  /**
   * Export response as HTML file
   */
  async exportToHTML(response, metadata = {}) {
    const content = this.formatHTML(response, metadata);
    const filename = this.generateFilename('html');
    
    const result = await dialog.showSaveDialog({
      title: 'Export as HTML',
      defaultPath: path.join(this.defaultExportPath, filename),
      filters: [{ name: 'HTML', extensions: ['html'] }]
    });
    
    if (!result.canceled && result.filePath) {
      fs.writeFileSync(result.filePath, content, 'utf8');
      console.log(`Exported to: ${result.filePath}`);
      return { success: true, path: result.filePath };
    }
    
    return { success: false, canceled: true };
  }

  /**
   * Export response as plain text
   */
  async exportToText(response, metadata = {}) {
    const content = this.formatText(response, metadata);
    const filename = this.generateFilename('txt');
    
    const result = await dialog.showSaveDialog({
      title: 'Export as Text',
      defaultPath: path.join(this.defaultExportPath, filename),
      filters: [{ name: 'Text', extensions: ['txt'] }]
    });
    
    if (!result.canceled && result.filePath) {
      fs.writeFileSync(result.filePath, content, 'utf8');
      console.log(`Exported to: ${result.filePath}`);
      return { success: true, path: result.filePath };
    }
    
    return { success: false, canceled: true };
  }

  /**
   * Export response as JSON (with metadata)
   */
  async exportToJSON(response, metadata = {}) {
    const content = {
      timestamp: new Date().toISOString(),
      model: metadata.model || 'unknown',
      prompt: metadata.prompt || 'default',
      response: response,
      ...metadata
    };
    
    const filename = this.generateFilename('json');
    
    const result = await dialog.showSaveDialog({
      title: 'Export as JSON',
      defaultPath: path.join(this.defaultExportPath, filename),
      filters: [{ name: 'JSON', extensions: ['json'] }]
    });
    
    if (!result.canceled && result.filePath) {
      fs.writeFileSync(result.filePath, JSON.stringify(content, null, 2), 'utf8');
      console.log(`Exported to: ${result.filePath}`);
      return { success: true, path: result.filePath };
    }
    
    return { success: false, canceled: true };
  }

  /**
   * Quick export to default location (no dialog)
   */
  quickExport(response, format = 'md', metadata = {}) {
    const filename = this.generateFilename(format);
    const filePath = path.join(this.defaultExportPath, filename);
    
    let content;
    switch (format) {
      case 'md':
        content = this.formatMarkdown(response, metadata);
        break;
      case 'html':
        content = this.formatHTML(response, metadata);
        break;
      case 'txt':
        content = this.formatText(response, metadata);
        break;
      case 'json':
        content = JSON.stringify({ response, ...metadata }, null, 2);
        break;
      default:
        content = response;
    }
    
    fs.writeFileSync(filePath, content, 'utf8');
    console.log(`Quick exported to: ${filePath}`);
    return { success: true, path: filePath };
  }

  /**
   * Copy formatted content to clipboard
   */
  copyToClipboard(response, format = 'text') {
    let content;
    switch (format) {
      case 'markdown':
        content = response;
        break;
      case 'html':
        content = this.formatHTML(response, {});
        break;
      default:
        content = response;
    }
    
    clipboard.writeText(content);
    return true;
  }

  /**
   * Export multiple history entries
   */
  async exportHistory(entries, format = 'md') {
    let content = '';
    
    if (format === 'md') {
      content = '# OA Coder Response History\n\n';
      entries.forEach((entry, index) => {
        content += `## Response ${index + 1}\n`;
        content += `**Time:** ${entry.timestamp}\n`;
        content += `**Model:** ${entry.model}\n\n`;
        content += entry.fullResponse || entry.response;
        content += '\n\n---\n\n';
      });
    } else if (format === 'json') {
      content = JSON.stringify(entries, null, 2);
    }
    
    const filename = `oacoder-history-${Date.now()}.${format}`;
    const result = await dialog.showSaveDialog({
      title: 'Export History',
      defaultPath: path.join(this.defaultExportPath, filename),
      filters: [{ name: format.toUpperCase(), extensions: [format] }]
    });
    
    if (!result.canceled && result.filePath) {
      fs.writeFileSync(result.filePath, content, 'utf8');
      return { success: true, path: result.filePath };
    }
    
    return { success: false, canceled: true };
  }

  /**
   * Format response as Markdown with metadata header
   */
  formatMarkdown(response, metadata) {
    let content = '# OA Coder Response\n\n';
    content += `> Generated: ${new Date().toLocaleString()}\n`;
    
    if (metadata.model) {
      content += `> Model: ${metadata.model}\n`;
    }
    if (metadata.prompt) {
      content += `> Prompt: ${metadata.prompt}\n`;
    }
    
    content += '\n---\n\n';
    content += response;
    content += '\n';
    
    return content;
  }

  /**
   * Format response as HTML
   */
  formatHTML(response, metadata) {
    return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>OA Coder Response</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; max-width: 800px; margin: 40px auto; padding: 0 20px; line-height: 1.6; }
    pre { background: #f5f5f5; padding: 15px; border-radius: 5px; overflow-x: auto; }
    code { background: #f5f5f5; padding: 2px 5px; border-radius: 3px; font-family: 'Consolas', monospace; }
    .meta { color: #666; font-size: 0.9em; border-left: 3px solid #ddd; padding-left: 10px; margin-bottom: 20px; }
  </style>
</head>
<body>
  <h1>OA Coder Response</h1>
  <div class="meta">
    <p>Generated: ${new Date().toLocaleString()}</p>
    ${metadata.model ? `<p>Model: ${metadata.model}</p>` : ''}
    ${metadata.prompt ? `<p>Prompt: ${metadata.prompt}</p>` : ''}
  </div>
  <hr>
  <div class="content">
    ${this.markdownToHTML(response)}
  </div>
</body>
</html>`;
  }

  /**
   * Simple markdown to HTML conversion
   */
  markdownToHTML(markdown) {
    return markdown
      .replace(/```(\w*)\n([\s\S]*?)```/g, '<pre><code class="language-$1">$2</code></pre>')
      .replace(/`([^`]+)`/g, '<code>$1</code>')
      .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
      .replace(/\*([^*]+)\*/g, '<em>$1</em>')
      .replace(/^### (.+)$/gm, '<h3>$1</h3>')
      .replace(/^## (.+)$/gm, '<h2>$1</h2>')
      .replace(/^# (.+)$/gm, '<h1>$1</h1>')
      .replace(/\n/g, '<br>');
  }

  /**
   * Format response as plain text
   */
  formatText(response, metadata) {
    let content = 'OA Coder Response\n';
    content += '='.repeat(50) + '\n\n';
    content += `Generated: ${new Date().toLocaleString()}\n`;
    
    if (metadata.model) {
      content += `Model: ${metadata.model}\n`;
    }
    if (metadata.prompt) {
      content += `Prompt: ${metadata.prompt}\n`;
    }
    
    content += '\n' + '-'.repeat(50) + '\n\n';
    content += response;
    content += '\n';
    
    return content;
  }
}

module.exports = ExportService;
