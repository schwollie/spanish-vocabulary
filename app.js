// ============================================
// MAIN APP - Entry Point and Initialization
// ============================================

// Global State Management
const state = {
    lections: [],
    selectedLections: new Set(),
    vocabularies: [],
    currentVocab: null,
    mode: 'spanishToGerman', // 'spanishToGerman', 'germanToSpanish', 'random'
    selectionMode: 'random',
    showingAnswer: false,
    learningProgress: {} // vocabulary key -> { correctCount, lastCorrect, lastWrong }
};

// Initialize the app
async function init() {
    loadLearningProgress(); // Load progress from localStorage first
    await loadLections();
    initSpeech(); // Initialize speech synthesis
    setupEventListeners();
    setupSpeechListeners(); // Setup speech event listeners
    updateVocabularyCount();
    updateStatistics(); // Update statistics display
}

// Setup all event listeners
function setupEventListeners() {
    // Mode buttons
    document.getElementById('spanishToGerman').addEventListener('click', () => {
        setMode('spanishToGerman');
    });

    document.getElementById('germanToSpanish').addEventListener('click', () => {
        setMode('germanToSpanish');
    });

    document.getElementById('randomMode').addEventListener('click', () => {
        setMode('random');
    });

    // Vocabulary card click to show answer
    document.getElementById('vocabCard').addEventListener('click', showAnswer);

    // Control buttons
    document.getElementById('wrongBtn').addEventListener('click', function(e) {
        e.stopPropagation();
        handleWrong();
    });
    document.getElementById('correctBtn').addEventListener('click', function(e) {
        e.stopPropagation();
        handleCorrect();
    });
    document.getElementById('skipBtn').addEventListener('click', nextVocabulary);

    // Selection mode radio buttons
    document.querySelectorAll('input[name="selectionMode"]').forEach(radio => {
        radio.addEventListener('change', (e) => {
            state.selectionMode = e.target.value;
            updateVocabularies(); // Refresh to apply new mode
            updateStatistics(); // Update statistics
        });
    });

    // Lection control buttons
    document.getElementById('selectAllBtn').addEventListener('click', selectAllLections);
    document.getElementById('clearAllBtn').addEventListener('click', clearAllLections);
    
    // Progress reset button
    document.getElementById('resetProgressBtn').addEventListener('click', resetLearningProgress);
    
    // Skip one day button (for spaced repetition)
    const skipDayBtn = document.getElementById('skipOneDayBtn');
    if (skipDayBtn) {
        skipDayBtn.addEventListener('click', skipOneDay);
    }
    
    // Backup/Restore buttons
    document.getElementById('exportAllBtn').addEventListener('click', exportAllData);
    document.getElementById('importAllBtn').addEventListener('click', importAllData);
    document.getElementById('exportProgressBtn').addEventListener('click', exportProgressOnly);
    document.getElementById('importProgressBtn').addEventListener('click', importProgressOnly);
}

// Start the app when page loads
document.addEventListener('DOMContentLoaded', init);
