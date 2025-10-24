// ============================================
// SPEECH MODULE - Text-to-Speech Functionality
// ============================================

// Speech synthesis state
const speechState = {
    synthesis: null,
    utterance: null,
    enabled: true,
    volume: 0.8,
    isSupported: false
};

// Initialize speech synthesis
function initSpeech() {
    // Check if speech synthesis is supported
    if ('speechSynthesis' in window) {
        speechState.synthesis = window.speechSynthesis;
        speechState.isSupported = true;
        console.log('Speech synthesis is supported');
        
        // Load saved settings
        loadSpeechSettings();
    } else {
        console.warn('Speech synthesis not supported');
        speechState.isSupported = false;
        disableSpeechUI();
    }
}

// Load speech settings from localStorage
function loadSpeechSettings() {
    const savedEnabled = localStorage.getItem('speechEnabled');
    const savedVolume = localStorage.getItem('speechVolume');
    
    if (savedEnabled !== null) {
        speechState.enabled = savedEnabled === 'true';
        document.getElementById('speechEnabled').checked = speechState.enabled;
    }
    
    if (savedVolume !== null) {
        speechState.volume = parseFloat(savedVolume);
        const volumePercent = Math.round(speechState.volume * 100);
        document.getElementById('speechVolume').value = volumePercent;
        document.getElementById('volumeValue').textContent = volumePercent + '%';
    }
    
    updateSpeechButton();
}

// Save speech settings to localStorage
function saveSpeechSettings() {
    localStorage.setItem('speechEnabled', speechState.enabled);
    localStorage.setItem('speechVolume', speechState.volume);
}

// Disable speech UI if not supported
function disableSpeechUI() {
    const speechBtn = document.getElementById('speechBtn');
    const speechEnabled = document.getElementById('speechEnabled');
    const speechVolume = document.getElementById('speechVolume');
    
    speechBtn.classList.add('disabled');
    speechBtn.disabled = true;
    speechEnabled.disabled = true;
    speechVolume.disabled = true;
}

// Update speech button appearance
function updateSpeechButton() {
    const speechBtn = document.getElementById('speechBtn');
    if (speechState.enabled) {
        speechBtn.classList.add('active');
    } else {
        speechBtn.classList.remove('active');
    }
}

// Speak Spanish text
function speakSpanish(text) {
    if (!speechState.isSupported || !speechState.enabled || !text) {
        return;
    }
    
    // Cancel any ongoing speech
    if (speechState.synthesis.speaking) {
        speechState.synthesis.cancel();
    }
    
    // Create new utterance
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = 'es-ES'; // Spanish (Spain)
    utterance.rate = 0.9; // Slightly slower for learning
    utterance.pitch = 1.0;
    utterance.volume = speechState.volume;
    
    // Try to use a Spanish voice if available
    const voices = speechState.synthesis.getVoices();
    const spanishVoice = voices.find(voice => 
        voice.lang.startsWith('es') || voice.lang.includes('Spanish')
    );
    
    if (spanishVoice) {
        utterance.voice = spanishVoice;
    }
    
    // Speak the text
    speechState.synthesis.speak(utterance);
}

// Manual speech trigger (for the button)
function speakCurrentVocabulary() {
    if (!state.currentVocab) {
        return;
    }
    
    // Always speak the Spanish text
    speakSpanish(state.currentVocab.spanish);
}

// Setup speech event listeners
function setupSpeechListeners() {
    // Speech toggle button
    document.getElementById('speechBtn').addEventListener('click', function() {
        if (!speechState.isSupported) return;
        speakCurrentVocabulary();
    });
    
    // Enable/disable toggle
    document.getElementById('speechEnabled').addEventListener('change', function(e) {
        speechState.enabled = e.target.checked;
        updateSpeechButton();
        saveSpeechSettings();
    });
    
    // Volume slider
    document.getElementById('speechVolume').addEventListener('input', function(e) {
        const volumePercent = parseInt(e.target.value);
        speechState.volume = volumePercent / 100;
        document.getElementById('volumeValue').textContent = volumePercent + '%';
        saveSpeechSettings();
    });
    
    // Load voices when they become available (some browsers load them asynchronously)
    if (speechState.isSupported) {
        if (speechState.synthesis.getVoices().length === 0) {
            speechState.synthesis.addEventListener('voiceschanged', function() {
                console.log('Voices loaded:', speechState.synthesis.getVoices().length);
            });
        }
    }
}

// Auto-speak Spanish when appropriate
function autoSpeakIfNeeded() {
    if (!speechState.enabled || !state.currentVocab) {
        return;
    }
    
    // Speak Spanish in these cases:
    // 1. ES→DE mode: Speak when question is shown
    // 2. DE→ES mode: Speak when answer is shown (since Spanish is the answer)
    
    if (state.currentDirection === 'spanishToGerman') {
        // Spanish is the question, speak it
        speakSpanish(state.currentVocab.spanish);
    }
}

// Speak answer if it's Spanish
function speakAnswerIfSpanish() {
    if (!speechState.enabled || !state.currentVocab) {
        return;
    }
    
    // If the answer is Spanish (DE→ES mode), speak it
    if (state.currentDirection === 'germanToSpanish') {
        speakSpanish(state.currentVocab.spanish);
    }
}
