// ============================================
// VOCABULARY MODULE - Vocabulary Card Display and Interaction
// ============================================

// Session pool to track vocabularies available in the current session
// This prevents vocabularies from appearing again after being answered
let sessionPool = [];

// Get remaining count in session pool
function getSessionPoolCount() {
    return sessionPool.length;
}

// Set mode
function setMode(mode) {
    state.mode = mode;
    
    // Update button states
    document.querySelectorAll('.mode-btn').forEach(btn => {
        btn.classList.remove('active');
    });

    if (mode === 'spanishToGerman') {
        document.getElementById('spanishToGerman').classList.add('active');
    } else if (mode === 'germanToSpanish') {
        document.getElementById('germanToSpanish').classList.add('active');
    } else {
        document.getElementById('randomMode').classList.add('active');
    }

    // Save preference
    savePreferences();
    
    // Reload session pool for new direction (recount due vocabularies)
    sessionPool = [];
    initializeSessionPool();
    updateVocabularyCount();
    
    // Reset card to show new direction
    resetCard();
}

// Initialize session pool with due vocabularies
function initializeSessionPool() {
    if (state.vocabularies.length === 0) {
        sessionPool = [];
        return;
    }

    // Filter based on selection mode
    if (state.selectionMode === 'spaced') {
        // In spaced mode: only include vocabularies due for review in current direction
        const currentDirection = state.mode === 'random' ? 'spanishToGerman' : state.mode;
        sessionPool = state.vocabularies.filter(vocab => isVocabularyDue(vocab, currentDirection));
    } else {
        // In random mode: all vocabularies from selected lections (no tracking)
        sessionPool = [...state.vocabularies];
    }
}

// Get next vocabulary
function nextVocabulary() {
    if (state.vocabularies.length === 0) {
        alert('Please select at least one lection!');
        return;
    }

    // Initialize session pool if empty
    if (sessionPool.length === 0) {
        initializeSessionPool();
    }

    // Check if there are vocabularies available in the session
    if (sessionPool.length === 0) {
        const questionText = document.getElementById('questionText');
        const answerSection = document.getElementById('answerSection');
        
        if (state.selectionMode === 'spaced') {
            questionText.textContent = 'No vocabularies due for review right now! 🎉';
        } else {
            questionText.textContent = 'You have completed all vocabularies in this session! 🎉';
        }
        
        answerSection.style.display = 'none';
        hideCardControls();
        state.currentVocab = null;
        state.showingAnswer = false;
        return;
    }

    // Random selection from session pool
    const randomIndex = Math.floor(Math.random() * sessionPool.length);
    state.currentVocab = sessionPool[randomIndex];
    
    // Remove the selected vocabulary from the session pool
    sessionPool.splice(randomIndex, 1);
    
    // Determine direction for this vocabulary if mode is random
    if (state.mode === 'random') {
        state.currentDirection = Math.random() < 0.5 ? 'spanishToGerman' : 'germanToSpanish';
    } else {
        state.currentDirection = state.mode;
    }

    // Reset state for new vocabulary
    state.showingAnswer = false;
    displayVocabulary();
    hideCardControls();
    
    // Update vocabulary count to show remaining
    updateVocabularyCount();
    
    // Auto-speak Spanish if enabled and in ES→DE mode
    autoSpeakIfNeeded();
}

// Display vocabulary
function displayVocabulary() {
    const questionText = document.getElementById('questionText');
    const answerSection = document.getElementById('answerSection');
    const answerText = document.getElementById('answerText');
    const progressBadge = document.getElementById('progressBadge');
    const progressCount = document.getElementById('progressCount');

    // Always hide controls when displaying new vocabulary
    hideCardControls();

    if (!state.currentVocab) {
        questionText.textContent = 'Tap the card to start';
        answerSection.style.display = 'none';
        progressBadge.style.display = 'none';
        return;
    }

    // Set question based on direction
    if (state.currentDirection === 'spanishToGerman') {
        questionText.textContent = state.currentVocab.spanish;
        answerText.textContent = state.currentVocab.german;
    } else {
        questionText.textContent = state.currentVocab.german;
        answerText.textContent = state.currentVocab.spanish;
    }

    // Show progress badge if vocabulary has been answered correctly before (in current direction)
    if (state.selectionMode === 'spaced') {
        const progress = getVocabProgress(state.currentVocab, state.currentDirection);
        if (progress.correctCount > 0) {
            progressCount.textContent = `Phase ${progress.correctCount}`;
            progressBadge.style.display = 'flex';
            progressBadge.title = `Phase ${progress.correctCount} - Next review: ${getIntervalForPhase(progress.correctCount)} days`;
        } else {
            progressBadge.style.display = 'none';
        }
    } else {
        // No progress tracking in random mode
        progressBadge.style.display = 'none';
    }

    // Hide answer initially
    answerSection.style.display = 'none';
}

// Show answer
function showAnswer() {
    // If no vocabulary is loaded, start with the first one
    if (!state.currentVocab) {
        if (state.vocabularies.length === 0) {
            alert('Please select at least one lection!');
            return;
        }
        nextVocabulary();
        return;
    }

    if (state.showingAnswer) {
        return; // Already showing answer
    }

    const answerSection = document.getElementById('answerSection');
    answerSection.style.display = 'block';
    state.showingAnswer = true;
    
    // Show card controls (Wrong/Correct buttons)
    showCardControls();
    
    // Speak answer if it's Spanish (DE→ES mode)
    speakAnswerIfSpanish();
}

// Show card controls
function showCardControls() {
    const cardControls = document.getElementById('cardControls');
    cardControls.style.display = 'flex';
}

// Hide card controls
function hideCardControls() {
    const cardControls = document.getElementById('cardControls');
    cardControls.style.display = 'none';
}

// Handle wrong answer
function handleWrong() {
    // Track the wrong answer only in spaced mode
    if (state.currentVocab && state.selectionMode === 'spaced') {
        const direction = state.currentDirection || state.mode || 'spanishToGerman';
        updateVocabProgress(state.currentVocab, false, direction);
        updateStatistics(); // Update statistics after tracking
    }
    
    // Full state reset
    hideCardControls();
    state.showingAnswer = false;
    state.currentVocab = null;
    
    // Update UI counters
    updateVocabularyCount();
    
    // Move to next vocabulary
    nextVocabulary();
}

// Handle correct answer
function handleCorrect() {
    // Track the correct answer only in spaced mode
    if (state.currentVocab && state.selectionMode === 'spaced') {
        const direction = state.currentDirection || state.mode || 'spanishToGerman';
        updateVocabProgress(state.currentVocab, true, direction);
        updateStatistics(); // Update statistics after tracking
    }
    
    // Full state reset
    hideCardControls();
    state.showingAnswer = false;
    state.currentVocab = null;
    
    // Update UI counters
    updateVocabularyCount();
    
    // Move to next vocabulary
    nextVocabulary();
}

// Reset card
function resetCard() {
    state.currentVocab = null;
    state.showingAnswer = false;
    sessionPool = []; // Clear session pool
    displayVocabulary();
    hideCardControls();
}
