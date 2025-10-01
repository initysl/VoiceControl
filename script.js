class VoiceScrollController {
  constructor(config = {}) {
    // Configuration with defaults
    this.config = {
      idleDuration: config.idleDuration || 10000,
      debounceDelay: config.debounceDelay || 500,
      scrollAmount: config.scrollAmount || 100,
      lang: config.lang || 'en-US',
      ...config
    };

    // DOM elements
    this.elements = {
      micBtn: document.getElementById('microphone'),
      micIcon: document.querySelector('.mic'),
      micRec: document.querySelector('.mic-rec')
    };

    // State management
    this.state = {
      isListening: false,
      lastCommand: '',
      lastCommandTime: 0
    };

    // Recognition instance
    this.recognition = null;
    this.idleTimeout = null;

    // Noise words to filter out
    this.noiseWords = new Set([
      'uh', 'um', 'like', 'you know', 'so', 
      'ohhh', 'heyy', 'haaaa', 'shhshshh'
    ]);

    // Command definitions
    this.commands = {
      up: {
        description: 'Scroll up',
        action: () => this.smoothScroll(window.scrollY - this.config.scrollAmount)
      },
      down: {
        description: 'Scroll down',
        action: () => this.smoothScroll(window.scrollY + this.config.scrollAmount)
      },
      top: {
        description: 'Scroll to the top of the page',
        action: () => this.smoothScroll(0)
      },
      bottom: {
        description: 'Scroll to the bottom of the page',
        action: () => this.smoothScroll(document.body.scrollHeight)
      },
      fly: {
        description: 'Scroll up half a page',
        action: () => this.smoothScroll(window.scrollY - window.innerHeight / 2)
      },
      jump: {
        description: 'Scroll down half a page',
        action: () => this.smoothScroll(window.scrollY + window.innerHeight / 2)
      }
    };

    this.init();
  }

  init() {
    if (!this.validateBrowserSupport()) {
      console.error('Speech recognition is not supported in this browser');
      this.disableMicButton();
      return;
    }

    if (!this.validateDOMElements()) {
      console.error('Required DOM elements not found');
      return;
    }

    this.attachEventListeners();
  }

  validateBrowserSupport() {
    return !!(
      window.SpeechRecognition ||
      window.webkitSpeechRecognition ||
      window.mozSpeechRecognition ||
      window.msSpeechRecognition
    );
  }


  validateDOMElements() {
    return Object.values(this.elements).every(el => el !== null);
  }

  disableMicButton() {
    if (this.elements.micBtn) {
      this.elements.micBtn.disabled = true;
      this.elements.micBtn.title = 'Speech recognition not supported';
    }
  }


  attachEventListeners() {
    this.elements.micBtn.addEventListener('click', () => this.toggleRecognition());
  }


  toggleRecognition() {
    if (this.state.isListening) {
      this.stopRecognition();
    } else {
      this.startRecognition();
    }
  }


  startRecognition() {
    try {
      const SpeechRecognition = 
        window.SpeechRecognition ||
        window.webkitSpeechRecognition ||
        window.mozSpeechRecognition ||
        window.msSpeechRecognition;

      this.recognition = new SpeechRecognition();
      this.recognition.lang = this.config.lang;
      this.recognition.continuous = true;
      this.recognition.interimResults = false;
      this.recognition.maxAlternatives = 1;

      this.setupRecognitionHandlers();
      this.recognition.start();
      
      this.updateUIState(true);
      this.showCommandsList();
      this.resetIdleTimeout();

      console.log('Speech recognition started');
    } catch (error) {
      console.error('Failed to start speech recognition:', error);
      this.handleRecognitionError(error);
    }
  }

  setupRecognitionHandlers() {
    this.recognition.onresult = (event) => this.handleRecognitionResult(event);
    this.recognition.onerror = (event) => this.handleRecognitionError(event);
    this.recognition.onend = () => this.handleRecognitionEnd();
  }

  handleRecognitionResult(event) {
    this.resetIdleTimeout();

    const transcript = event.results[event.results.length - 1][0].transcript;
    const cleanedWords = this.cleanTranscript(transcript);

    cleanedWords.forEach(word => this.processCommand(word));
  }

  cleanTranscript(transcript) {
    return transcript
      .toLowerCase()
      .trim()
      .split(/\s+/)
      .filter(word => !this.noiseWords.has(word));
  }

  processCommand(word) {
    const command = this.findMatchingCommand(word);

    if (command && this.canExecuteCommand(command)) {
      this.executeCommand(command);
    } else if (command) {
      console.log(`Command "${command}" debounced`);
    } else {
      console.log(`Unknown command: "${word}"`);
    }
  }

  findMatchingCommand(word) {
    return Object.keys(this.commands).find(cmd => 
      new RegExp(`\\b${cmd}\\b`, 'i').test(word)
    );
  }


  canExecuteCommand(command) {
    const now = Date.now();
    const timeSinceLastCommand = now - this.state.lastCommandTime;

    return (
      command !== this.state.lastCommand || 
      timeSinceLastCommand > this.config.debounceDelay
    );
  }

  executeCommand(command) {
    try {
      this.commands[command].action();
      this.state.lastCommand = command;
      this.state.lastCommandTime = Date.now();
      console.log(`Command executed: "${command}"`);
    } catch (error) {
      console.error(`Error executing command "${command}":`, error);
    }
  }


  smoothScroll(position) {
    window.scrollTo({
      top: Math.max(0, position),
      behavior: 'smooth'
    });
  }

  /**
   * Handle recognition errors
   */
  handleRecognitionError(event) {
    const errorMessage = event?.error || 'Unknown error';
    console.error('Speech recognition error:', errorMessage);

    // Handle specific error types
    if (errorMessage === 'not-allowed') {
      alert('Microphone access denied. Please grant permission to use voice commands.');
      this.stopRecognition();
    }
  }


  handleRecognitionEnd() {
    if (this.state.isListening) {
      // Restart recognition if it ended unexpectedly
      try {
        this.recognition.start();
      } catch (error) {
        console.error('Failed to restart recognition:', error);
        this.stopRecognition();
      }
    }
  }

  stopRecognition() {
    if (this.recognition) {
      this.recognition.stop();
      this.recognition = null;
    }

    this.clearIdleTimeout();
    this.updateUIState(false);
    
    console.log('Speech recognition stopped');
  }

  updateUIState(isActive) {
    this.state.isListening = isActive;
    
    if (isActive) {
      this.elements.micIcon.classList.add('active');
    } else {
      this.elements.micIcon.classList.remove('active');
    }
  }

  showCommandsList() {
    const commandsText = Object.entries(this.commands)
      .map(([cmd, info]) => `- ${cmd}: ${info.description}`)
      .join('\n');

    alert(`Available Voice Commands:\n\n${commandsText}`);
  }

  resetIdleTimeout() {
    this.clearIdleTimeout();
    this.idleTimeout = setTimeout(
      () => this.stopRecognition(),
      this.config.idleDuration
    );
  }


  clearIdleTimeout() {
    if (this.idleTimeout) {
      clearTimeout(this.idleTimeout);
      this.idleTimeout = null;
    }
  }


  destroy() {
    this.stopRecognition();
    this.elements.micBtn.removeEventListener('click', this.toggleRecognition);
    this.recognition = null;
  }
}

// Initialize the voice scroll controller
const voiceScroll = new VoiceScrollController({
  idleDuration: 10000,
  debounceDelay: 500,
  scrollAmount: 100,
  lang: 'en-US'
});

