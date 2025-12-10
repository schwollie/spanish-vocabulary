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
    selectionMode: 'spaced', // Default to spaced repetition
    showingAnswer: false,
    learningProgress: {}, // vocabulary key -> { correctCount, lastCorrect, lastWrong, nextReviewDate, lastUpdated }
    lastProgressReset: null // ISO timestamp of last progress reset
};

// Initialize the app
async function init() {
    loadLearningProgress(); // Load progress from localStorage first
    loadSavedPreferences(); // Load saved mode and lection selection
    await loadLections();
    restoreLectionSelection(); // Restore previously selected lections
    initSpeech(); // Initialize speech synthesis
    setupEventListeners();
    setupSpeechListeners(); // Setup speech event listeners
    updateVocabularyCount();
    updateStatistics(); // Update statistics display
    
    // Initialize Firebase Authentication
    try {
        await initFirebaseAuth();
        console.log('✅ Firebase initialized successfully');
    } catch (error) {
        console.error('Failed to initialize Firebase:', error);
    }
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
            savePreferences(); // Save to localStorage
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
    
    // Firebase sync button
    const manualSyncBtn = document.getElementById('manualSyncBtn');
    if (manualSyncBtn) {
        manualSyncBtn.addEventListener('click', handleManualSync);
    }
}

// Start the app when page loads
document.addEventListener('DOMContentLoaded', init);

// ============================================
// PREFERENCE MANAGEMENT - Save/Load User Preferences
// ============================================

function savePreferences() {
    const preferences = {
        mode: state.mode,
        selectionMode: state.selectionMode,
        selectedLections: Array.from(state.selectedLections)
    };
    localStorage.setItem('userPreferences', JSON.stringify(preferences));
}

function loadSavedPreferences() {
    const saved = localStorage.getItem('userPreferences');
    if (saved) {
        try {
            const preferences = JSON.parse(saved);
            state.mode = preferences.mode || 'spanishToGerman';
            state.selectionMode = preferences.selectionMode || 'spaced';
            // selectedLections will be restored after lections are loaded
        } catch (e) {
            console.error('Error loading preferences:', e);
        }
    }
    
    // Update UI to reflect loaded preferences
    updateModeUI();
    updateSelectionModeUI();
}

function restoreLectionSelection() {
    const saved = localStorage.getItem('userPreferences');
    if (saved) {
        try {
            const preferences = JSON.parse(saved);
            if (preferences.selectedLections && Array.isArray(preferences.selectedLections)) {
                // Restore selection, but validate lections still exist
                preferences.selectedLections.forEach(num => {
                    const lection = state.lections.find(l => l.number === num);
                    if (lection) {
                        state.selectedLections.add(num);
                        const checkbox = document.getElementById(`lection-${num}`);
                        if (checkbox) checkbox.checked = true;
                    }
                });
                
                // Update vocabularies with restored selection
                if (state.selectedLections.size > 0) {
                    updateVocabularies();
                }
            }
        } catch (e) {
            console.error('Error restoring lection selection:', e);
        }
    }
}

function updateModeUI() {
    document.querySelectorAll('.mode-btn').forEach(btn => {
        btn.classList.remove('active');
    });
    
    if (state.mode === 'spanishToGerman') {
        document.getElementById('spanishToGerman').classList.add('active');
    } else if (state.mode === 'germanToSpanish') {
        document.getElementById('germanToSpanish').classList.add('active');
    } else {
        document.getElementById('randomMode').classList.add('active');
    }
}

function updateSelectionModeUI() {
    document.querySelectorAll('input[name="selectionMode"]').forEach(radio => {
        radio.checked = (radio.value === state.selectionMode);
    });
}
