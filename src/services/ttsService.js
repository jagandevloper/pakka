/**
 * TTSService - Text-to-Speech service
 * Uses Web Speech API for voice output
 */
class TTSService {
  constructor() {
    this.enabled = false;
    this.speaking = false;
    this.rate = 1.0;
    this.pitch = 1.0;
    this.volume = 1.0;
    this.voice = null;
    this.availableVoices = [];
  }

  /**
   * Initialize voices (must be called from renderer process)
   */
  initVoices() {
    if (typeof speechSynthesis !== 'undefined') {
      this.availableVoices = speechSynthesis.getVoices();
      
      // Try to set a good default English voice
      this.voice = this.availableVoices.find(v => 
        v.lang.startsWith('en') && v.name.includes('Google')
      ) || this.availableVoices.find(v => 
        v.lang.startsWith('en')
      ) || this.availableVoices[0];
      
      console.log(`TTS initialized with ${this.availableVoices.length} voices`);
      return this.availableVoices;
    }
    return [];
  }

  /**
   * Speak text
   */
  speak(text) {
    if (typeof speechSynthesis === 'undefined') {
      console.error('Speech synthesis not available');
      return false;
    }

    // Stop any current speech
    this.stop();

    // Clean text for speech (remove code blocks, markdown)
    const cleanText = this.cleanTextForSpeech(text);
    
    const utterance = new SpeechSynthesisUtterance(cleanText);
    utterance.rate = this.rate;
    utterance.pitch = this.pitch;
    utterance.volume = this.volume;
    
    if (this.voice) {
      utterance.voice = this.voice;
    }

    utterance.onstart = () => {
      this.speaking = true;
      console.log('TTS started');
    };

    utterance.onend = () => {
      this.speaking = false;
      console.log('TTS finished');
    };

    utterance.onerror = (event) => {
      this.speaking = false;
      console.error('TTS error:', event.error);
    };

    speechSynthesis.speak(utterance);
    return true;
  }

  /**
   * Stop speaking
   */
  stop() {
    if (typeof speechSynthesis !== 'undefined') {
      speechSynthesis.cancel();
      this.speaking = false;
    }
  }

  /**
   * Pause speaking
   */
  pause() {
    if (typeof speechSynthesis !== 'undefined') {
      speechSynthesis.pause();
    }
  }

  /**
   * Resume speaking
   */
  resume() {
    if (typeof speechSynthesis !== 'undefined') {
      speechSynthesis.resume();
    }
  }

  /**
   * Toggle enabled state
   */
  toggle() {
    this.enabled = !this.enabled;
    if (!this.enabled) {
      this.stop();
    }
    return `Voice: ${this.enabled ? 'ON' : 'OFF'}`;
  }

  /**
   * Set voice by name
   */
  setVoice(voiceName) {
    const voice = this.availableVoices.find(v => v.name === voiceName);
    if (voice) {
      this.voice = voice;
      console.log(`Voice set to: ${voiceName}`);
      return true;
    }
    return false;
  }

  /**
   * Set speech rate (0.1 to 10)
   */
  setRate(rate) {
    this.rate = Math.max(0.1, Math.min(10, rate));
  }

  /**
   * Set pitch (0 to 2)
   */
  setPitch(pitch) {
    this.pitch = Math.max(0, Math.min(2, pitch));
  }

  /**
   * Set volume (0 to 1)
   */
  setVolume(volume) {
    this.volume = Math.max(0, Math.min(1, volume));
  }

  /**
   * Clean text for better speech output
   */
  cleanTextForSpeech(text) {
    return text
      // Remove code blocks
      .replace(/```[\s\S]*?```/g, 'Code block omitted.')
      // Remove inline code
      .replace(/`[^`]+`/g, '')
      // Remove markdown headers
      .replace(/^#{1,6}\s+/gm, '')
      // Remove markdown bold/italic
      .replace(/\*{1,2}([^*]+)\*{1,2}/g, '$1')
      // Remove markdown links
      .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
      // Remove URLs
      .replace(/https?:\/\/[^\s]+/g, 'link')
      // Clean up multiple spaces
      .replace(/\s+/g, ' ')
      // Limit length for long responses
      .substring(0, 5000)
      .trim();
  }

  /**
   * Get available voices
   */
  getVoices() {
    return this.availableVoices.map(v => ({
      name: v.name,
      lang: v.lang,
      local: v.localService,
      default: v.default
    }));
  }

  /**
   * Get current status
   */
  getStatus() {
    return {
      enabled: this.enabled,
      speaking: this.speaking,
      rate: this.rate,
      pitch: this.pitch,
      volume: this.volume,
      voice: this.voice?.name || 'default'
    };
  }
}

// Export for both Node.js and browser
if (typeof module !== 'undefined' && module.exports) {
  module.exports = TTSService;
}
