const fs = require('fs');
const path = require('path');

/**
 * PromptManager - Manages custom prompt templates
 * Allows users to switch between different analysis modes
 */
class PromptManager {
  constructor() {
    this.promptsPath = path.join(__dirname, '../../prompts.json');
    this.currentPromptKey = 'default';
    this.prompts = this.loadPrompts();
  }

  /**
   * Default prompt templates
   */
  getDefaultPrompts() {
    return {
      default: {
        name: 'Default',
        description: 'General analysis',
        prompt: 'Analyze the image and provide a clear, concise answer. If it\'s a coding problem, provide the complete working solution. If it\'s a multiple choice question, identify the correct answer and explain why. Be direct and accurate.'
      },
      coding: {
        name: 'Coding',
        description: 'Solve programming problems',
        prompt: 'This is a coding/programming problem. Analyze the question carefully and provide:\n1. A clear explanation of the approach\n2. Complete, working code solution with comments\n3. Time and space complexity analysis\n4. Any edge cases to consider\n\nUse the most appropriate programming language based on the context, or Python if not specified.'
      },
      mcq: {
        name: 'MCQ',
        description: 'Multiple choice questions',
        prompt: 'This is a multiple choice question. Analyze each option carefully and:\n1. Identify the CORRECT answer clearly\n2. Explain WHY it is correct\n3. Explain why each OTHER option is incorrect\n4. Provide any additional context or tips\n\nFormat: Start with "Answer: [LETTER]" followed by the explanation.'
      },
      math: {
        name: 'Math',
        description: 'Mathematical problems',
        prompt: 'This is a mathematical problem. Solve it step-by-step:\n1. Identify what is being asked\n2. List known values and formulas needed\n3. Show ALL work and calculations\n4. Clearly state the final answer\n5. Verify the answer if possible\n\nUse proper mathematical notation.'
      },
      explain: {
        name: 'Explain',
        description: 'Explain code or concepts',
        prompt: 'Explain the code/concept shown in this image in simple terms:\n1. What does it do? (high-level overview)\n2. How does it work? (step-by-step breakdown)\n3. Key concepts involved\n4. Common use cases\n5. Any potential issues or improvements\n\nUse beginner-friendly language.'
      },
      debug: {
        name: 'Debug',
        description: 'Find and fix bugs',
        prompt: 'Debug the code shown in this image:\n1. Identify ALL bugs and issues\n2. Explain WHY each is a problem\n3. Provide the CORRECTED code\n4. Explain the fixes made\n5. Suggest any improvements\n\nBe thorough - check for logic errors, edge cases, and best practices.'
      },
      optimize: {
        name: 'Optimize',
        description: 'Optimize code performance',
        prompt: 'Optimize the code shown in this image:\n1. Analyze current time/space complexity\n2. Identify performance bottlenecks\n3. Provide optimized solution\n4. Explain the optimizations made\n5. Compare before/after complexity\n\nFocus on algorithmic improvements first, then micro-optimizations.'
      },
      review: {
        name: 'Code Review',
        description: 'Review code quality',
        prompt: 'Perform a code review on the image:\n1. Code quality assessment (1-10)\n2. Issues found (bugs, style, security)\n3. Good practices observed\n4. Specific improvement suggestions\n5. Refactored version if needed\n\nBe constructive and specific.'
      },
      translate: {
        name: 'Translate',
        description: 'Translate text content',
        prompt: 'Translate the text content in this image to English (or to the user\'s specified language). Provide:\n1. Original text (if readable)\n2. Translation\n3. Any context or notes about the translation\n\nMaintain formatting where possible.'
      },
      summarize: {
        name: 'Summarize',
        description: 'Summarize content',
        prompt: 'Summarize the content shown in this image:\n1. Main topic/subject\n2. Key points (bullet list)\n3. Important details\n4. Conclusion or takeaway\n\nBe concise but comprehensive.'
      }
    };
  }

  /**
   * Load prompts from file or use defaults
   */
  loadPrompts() {
    try {
      if (fs.existsSync(this.promptsPath)) {
        const data = fs.readFileSync(this.promptsPath, 'utf8');
        const loaded = JSON.parse(data);
        console.log(`Loaded ${Object.keys(loaded).length} custom prompts`);
        return { ...this.getDefaultPrompts(), ...loaded };
      }
    } catch (err) {
      console.error('Error loading prompts:', err);
    }
    
    return this.getDefaultPrompts();
  }

  /**
   * Save prompts to file
   */
  savePrompts() {
    try {
      fs.writeFileSync(this.promptsPath, JSON.stringify(this.prompts, null, 2), 'utf8');
      console.log('Prompts saved');
      return true;
    } catch (err) {
      console.error('Error saving prompts:', err);
      return false;
    }
  }

  /**
   * Get current prompt text
   */
  getCurrentPrompt() {
    return this.prompts[this.currentPromptKey]?.prompt || this.prompts.default.prompt;
  }

  /**
   * Get current prompt info
   */
  getCurrentPromptInfo() {
    return this.prompts[this.currentPromptKey] || this.prompts.default;
  }

  /**
   * Switch to next prompt template
   */
  switchToNext() {
    const keys = Object.keys(this.prompts);
    const currentIndex = keys.indexOf(this.currentPromptKey);
    const nextIndex = (currentIndex + 1) % keys.length;
    this.currentPromptKey = keys[nextIndex];
    
    const current = this.prompts[this.currentPromptKey];
    console.log(`Switched to prompt: ${current.name}`);
    return `Prompt: ${current.name}`;
  }

  /**
   * Set specific prompt by key
   */
  setPrompt(key) {
    if (this.prompts[key]) {
      this.currentPromptKey = key;
      console.log(`Set prompt to: ${this.prompts[key].name}`);
      return true;
    }
    return false;
  }

  /**
   * Get all available prompts
   */
  getAllPrompts() {
    return Object.entries(this.prompts).map(([key, value]) => ({
      key,
      name: value.name,
      description: value.description,
      isCurrent: key === this.currentPromptKey
    }));
  }

  /**
   * Add custom prompt
   */
  addPrompt(key, name, description, prompt) {
    this.prompts[key] = { name, description, prompt };
    this.savePrompts();
    return true;
  }

  /**
   * Remove custom prompt
   */
  removePrompt(key) {
    if (key !== 'default' && this.prompts[key]) {
      delete this.prompts[key];
      if (this.currentPromptKey === key) {
        this.currentPromptKey = 'default';
      }
      this.savePrompts();
      return true;
    }
    return false;
  }

  /**
   * Edit existing prompt
   */
  editPrompt(key, updates) {
    if (this.prompts[key]) {
      this.prompts[key] = { ...this.prompts[key], ...updates };
      this.savePrompts();
      return true;
    }
    return false;
  }
}

module.exports = PromptManager;
