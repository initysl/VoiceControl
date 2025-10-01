class VoiceScrollController {
  constructor(config = {}) {
    this.config = {
      idleDuration: config.idleDuration || 10000,
      debounceDelay: config.debounceDelay || 500,
      scrollAmount: config.scrollAmount || 100,
      lang: config.lang || 'en-US',
      ...config
    };

    this.elements = {
      micBtn: document.getElementById('microphone'),
      micIcon: document.querySelector('.mic'),
      statusIndicator: document.getElementById('statusIndicator')
    };

    this.state = {
      isListening: false,
      lastCommand: '',
      lastCommandTime: 0
    };

    this.recognition = null;
    this.idleTimeout = null;

    this.noiseWords = new Set([
      'uh', 'um', 'like', 'you know', 'so', 
      'ohhh', 'heyy', 'haaaa', 'shhshshh', 'the', 'a', 'an'
    ]);

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
      },
      stop: {
        description: 'Stop voice control',
        action: () => this.stopRecognition()
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
    return this.elements.micBtn && this.elements.micIcon;
  }

  disableMicButton() {
    if (this.elements.micBtn) {
      this.elements.micBtn.disabled = true;
      this.elements.micBtn.title = 'Speech recognition not supported in this browser';
      this.elements.micBtn.style.opacity = '0.5';
    }
  }

  attachEventListeners() {
    this.elements.micBtn.addEventListener('click', () => this.toggleRecognition());
    
    this.elements.micBtn.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        this.toggleRecognition();
      }
    });
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

      console.log('Voice control started');
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

    const result = event.results[event.results.length - 1];
    const transcript = result[0].transcript;
    const confidence = result[0].confidence;
    
    console.log('Heard: "' + transcript + '" (confidence: ' + (confidence * 100).toFixed(1) + '%)');
    
    const cleanedWords = this.cleanTranscript(transcript);
    cleanedWords.forEach(word => this.processCommand(word));
  }

  cleanTranscript(transcript) {
    return transcript
      .toLowerCase()
      .trim()
      .split(/\s+/)
      .filter(word => word.length > 0 && !this.noiseWords.has(word));
  }

  processCommand(word) {
    const command = this.findMatchingCommand(word);

    if (command && this.canExecuteCommand(command)) {
      this.executeCommand(command);
    } else if (command) {
      console.log('Command "' + command + '" debounced');
    }
  }

  findMatchingCommand(word) {
    return Object.keys(this.commands).find(cmd => 
      new RegExp('\\b' + cmd + '\\b', 'i').test(word)
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
      console.log('Command executed: "' + command + '"');
      
      this.showCommandFeedback(command);
    } catch (error) {
      console.error('Error executing command "' + command + '":', error);
    }
  }

  showCommandFeedback(command) {
    this.elements.micIcon.style.color = '#22c55e';
    setTimeout(() => {
      if (this.state.isListening) {
        this.elements.micIcon.style.color = '#ff4444';
      }
    }, 300);
  }

  smoothScroll(position) {
    window.scrollTo({
      top: Math.max(0, Math.min(position, document.body.scrollHeight)),
      behavior: 'smooth'
    });
  }

  handleRecognitionError(event) {
    const errorMessage = event?.error || 'Unknown error';
    console.error('Speech recognition error:', errorMessage);

    switch(errorMessage) {
      case 'not-allowed':
      case 'permission-denied':
        alert('Microphone access denied. Please grant permission to use voice commands.');
        this.stopRecognition();
        break;
      case 'no-speech':
        console.log('No speech detected');
        break;
      case 'audio-capture':
        alert('No microphone found. Please check your microphone connection.');
        this.stopRecognition();
        break;
      case 'network':
        console.log('Network error occurred');
        break;
      default:
        console.log('Recognition error:', errorMessage);
    }
  }

  handleRecognitionEnd() {
    if (this.state.isListening) {
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
    
    console.log('Voice control stopped');
  }

  updateUIState(isActive) {
    this.state.isListening = isActive;
    
    if (isActive) {
      this.elements.micIcon.classList.add('active');
      this.elements.micIcon.style.color = '#ff4444';
      this.elements.micBtn.setAttribute('aria-pressed', 'true');
      if (this.elements.statusIndicator) {
        this.elements.statusIndicator.classList.add('show');
      }
    } else {
      this.elements.micIcon.classList.remove('active');
      this.elements.micIcon.style.color = '';
      this.elements.micBtn.setAttribute('aria-pressed', 'false');
      if (this.elements.statusIndicator) {
        this.elements.statusIndicator.classList.remove('show');
      }
    }
  }

  showCommandsList() {
    const commandsText = Object.entries(this.commands)
      .map(([cmd, info]) => cmd.toUpperCase() + ': ' + info.description)
      .join('\n');

    const message = 'Voice Control Active\n\nAvailable Commands:\n\n' + commandsText + '\n\nSpeak clearly and wait for the scrolling to complete before the next command.';
    
    if (window.confirm(message + '\n\nClick OK to continue or Cancel to stop.')) {
      return;
    } else {
      this.stopRecognition();
    }
  }

  resetIdleTimeout() {
    this.clearIdleTimeout();
    this.idleTimeout = setTimeout(
      () => {
        console.log('Voice control stopped due to inactivity');
        this.stopRecognition();
      },
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
    if (this.elements.micBtn) {
      this.elements.micBtn.removeEventListener('click', this.toggleRecognition);
    }
    this.recognition = null;
  }
}

let voiceScroll;

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initVoiceControl);
} else {
  initVoiceControl();
}

function initVoiceControl() {
  voiceScroll = new VoiceScrollController({
    idleDuration: 15000,
    debounceDelay: 500,
    scrollAmount: 100,
    lang: 'en-US'
  });
}

window.addEventListener('beforeunload', () => {
  if (voiceScroll) {
    voiceScroll.destroy();
  }
});
