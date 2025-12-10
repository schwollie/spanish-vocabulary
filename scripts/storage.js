// ============================================
// STORAGE MODULE - LocalStorage Management & Learning Progress
// ============================================

// Spaced Repetition Intervals (phase -> days until next review)
const SPACED_INTERVALS = {
    0: 0,      // New vocabulary - show immediately
    1: 1,      // 1 day
    2: 3,      // 3 days
    3: 7,      // 1 week
    4: 14,     // 2 weeks
    5: 29,     // ~1 month
    6: 50,     // ~1.5 months
    7: 70,     // ~2.5 months
    8: 100,    // ~3 months
    9: 300     // ~10 months (for phase >= 9)
};

const DEFAULT_PROGRESS_TIMESTAMP = '1970-01-01T00:00:00.000Z';

function normalizeProgressEntry(entry = {}) {
    const normalized = { ...entry };
    normalized.correctCount = typeof normalized.correctCount === 'number' ? normalized.correctCount : 0;
    normalized.lastCorrect = normalized.lastCorrect || null;
    normalized.lastWrong = normalized.lastWrong || null;
    normalized.nextReviewDate = normalized.nextReviewDate || null;
    normalized.lastUpdated = normalized.lastUpdated || normalized.lastCorrect || normalized.lastWrong || normalized.nextReviewDate || DEFAULT_PROGRESS_TIMESTAMP;
    return normalized;
}

function normalizeLearningProgressData(rawProgress) {
    if (!rawProgress || typeof rawProgress !== 'object') {
        return {};
    }

    const normalized = {};
    Object.entries(rawProgress).forEach(([key, entry]) => {
        if (!entry || typeof entry !== 'object') {
            return;
        }
        normalized[key] = normalizeProgressEntry(entry);
    });
    return normalized;
}

function getIntervalForPhase(phase) {
    if (phase >= 9) return SPACED_INTERVALS[9];
    return SPACED_INTERVALS[phase] || 0;
}

// Learning progress functions
function getVocabKey(vocab, direction) {
    // Create a unique key for the vocabulary including direction
    // Direction-specific: ES→DE and DE→ES tracked separately
    return `${vocab.spanish}||${vocab.german}||${direction}`;
}

function loadLearningProgress() {
    const progressData = localStorage.getItem('vocabularyProgress');
    if (progressData) {
        try {
            state.learningProgress = normalizeLearningProgressData(JSON.parse(progressData));
            localStorage.setItem('vocabularyProgress', JSON.stringify(state.learningProgress));
        } catch (e) {
            console.error('Error loading learning progress:', e);
            state.learningProgress = {};
        }
    } else {
        state.learningProgress = {};
    }
    
    // Load last reset timestamp
    const lastReset = localStorage.getItem('lastProgressReset');
    if (lastReset) {
        state.lastProgressReset = lastReset;
    }
    
    // Load last local update timestamp
    const lastUpdate = localStorage.getItem('lastLocalUpdate');
    if (lastUpdate) {
        state.lastLocalUpdate = lastUpdate;
    }
}

function saveLearningProgress() {
    try {
        const now = new Date().toISOString();
        state.lastLocalUpdate = now;
        
        const progressData = JSON.stringify(state.learningProgress);
        localStorage.setItem('vocabularyProgress', progressData);
        localStorage.setItem('lastLocalUpdate', now);
        
        // Sync to Firebase if authenticated (async, don't wait)
        setTimeout(() => {
            if (typeof window.syncProgressToFirebase === 'function') {
                window.syncProgressToFirebase();
            }
        }, 100);
    } catch (e) {
        console.error('Error saving learning progress:', e);
        // Check if quota exceeded
        if (e.name === 'QuotaExceededError') {
            alert('Storage quota exceeded. Your progress could not be saved.');
        }
    }
}

function getVocabProgress(vocab, direction) {
    const key = getVocabKey(vocab, direction);
    if (state.learningProgress[key]) {
        state.learningProgress[key] = normalizeProgressEntry(state.learningProgress[key]);
        return state.learningProgress[key];
    }
    return {
        correctCount: 0,
        lastCorrect: null,
        lastWrong: null,
        nextReviewDate: null,
        lastUpdated: null
    };
}

function updateVocabProgress(vocab, isCorrect, direction) {
    const key = getVocabKey(vocab, direction);
    const now = new Date();
    
    state.learningProgress[key] = normalizeProgressEntry(state.learningProgress[key]);
    const progress = state.learningProgress[key];
    
    if (isCorrect) {
        progress.correctCount++;
        progress.lastCorrect = now.toISOString();
        
        // Calculate next review date based on phase
        const phase = progress.correctCount;
        const daysUntilReview = getIntervalForPhase(phase);
        const nextReview = new Date(now);
        nextReview.setDate(nextReview.getDate() + daysUntilReview);
        progress.nextReviewDate = nextReview.toISOString();
    } else {
        // Reset to phase 0 on wrong answer
        progress.correctCount = 0;
        progress.lastWrong = now.toISOString();
        progress.nextReviewDate = now.toISOString(); // Available immediately
    }
    
    progress.lastUpdated = now.toISOString();
    
    saveLearningProgress();
}

function updateStatistics() {
    const totalLearned = Object.keys(state.learningProgress).filter(
        key => state.learningProgress[key].correctCount > 0
    ).length;
    
    const totalReviews = Object.values(state.learningProgress).reduce(
        (sum, progress) => sum + progress.correctCount, 0
    );
    
    document.getElementById('totalLearned').textContent = totalLearned;
    document.getElementById('totalReviews').textContent = totalReviews;
    
    // Update phase counts
    updatePhaseCountDisplay();
}

function resetLearningProgress() {
    if (confirm('Are you sure you want to reset all learning progress? This cannot be undone.')) {
        state.learningProgress = {};
        localStorage.removeItem('vocabularyProgress');

             // Delete from Firebase
        if (typeof window.deleteAllProgressFromFirebase === 'function') {
            console.log('🔄 Deleting all progress from Firebase');
            window.deleteAllProgressFromFirebase();
        }

        updateStatistics();
        displayVocabulary(); // Refresh display to hide progress badge
        
   
        
        alert('Learning progress has been reset.');
    }
}

// ============================================
// EXPORT / IMPORT FUNCTIONS
// ============================================

function exportAllData() {
    try {
        const exportData = {
            version: '1.0',
            exportDate: new Date().toISOString(),
            lections: getAllLections(),
            progress: state.learningProgress
        };
        
        const dataStr = JSON.stringify(exportData, null, 2);
        const dataBlob = new Blob([dataStr], { type: 'application/json' });
        const url = URL.createObjectURL(dataBlob);
        
        const link = document.createElement('a');
        link.href = url;
        link.download = `spanish-vocabulary-backup-${new Date().toISOString().split('T')[0]}.json`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
        
        alert('Data exported successfully!');
    } catch (e) {
        console.error('Error exporting data:', e);
        alert('Error exporting data: ' + e.message);
    }
}

function importAllData() {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json';
    
    input.onchange = (e) => {
        const file = e.target.files[0];
        if (!file) return;
        
        const reader = new FileReader();
        reader.onload = (event) => {
            try {
                const importData = JSON.parse(event.target.result);
                
                // Validate import data structure
                if (!importData.version || !importData.lections || !importData.progress) {
                    throw new Error('Invalid backup file format');
                }
                
                // Confirm before overwriting
                if (!confirm('This will replace ALL current data (lections and progress). Continue?')) {
                    return;
                }
                
                // Import lections
                localStorage.setItem('lections', JSON.stringify(importData.lections));
                
                // Import progress
                const normalizedProgress = normalizeLearningProgressData(importData.progress);
                localStorage.setItem('vocabularyProgress', JSON.stringify(normalizedProgress));
                state.learningProgress = normalizedProgress;
                
                alert('Data imported successfully! The page will now reload.');
                location.reload();
            } catch (e) {
                console.error('Error importing data:', e);
                alert('Error importing data: ' + e.message);
            }
        };
        reader.readAsText(file);
    };
    
    input.click();
}

function exportProgressOnly() {
    try {
        const exportData = {
            version: '1.0',
            exportDate: new Date().toISOString(),
            progress: state.learningProgress
        };
        
        const dataStr = JSON.stringify(exportData, null, 2);
        const dataBlob = new Blob([dataStr], { type: 'application/json' });
        const url = URL.createObjectURL(dataBlob);
        
        const link = document.createElement('a');
        link.href = url;
        link.download = `spanish-vocabulary-progress-${new Date().toISOString().split('T')[0]}.json`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
        
        alert('Progress exported successfully!');
    } catch (e) {
        console.error('Error exporting progress:', e);
        alert('Error exporting progress: ' + e.message);
    }
}

function importProgressOnly() {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json';
    
    input.onchange = (e) => {
        const file = e.target.files[0];
        if (!file) return;
        
        const reader = new FileReader();
        reader.onload = (event) => {
            try {
                const importData = JSON.parse(event.target.result);
                
                // Validate import data structure
                if (!importData.version || !importData.progress) {
                    throw new Error('Invalid progress file format');
                }
                
                // Confirm before overwriting
                if (!confirm('This will replace your current learning progress. Continue?')) {
                    return;
                }
                
                // Import progress
                const normalizedProgress = normalizeLearningProgressData(importData.progress);
                localStorage.setItem('vocabularyProgress', JSON.stringify(normalizedProgress));
                state.learningProgress = normalizedProgress;
                
                updateStatistics();
                if (state.currentVocab) {
                    displayVocabulary();
                }
                
                alert('Progress imported successfully!');
            } catch (e) {
                console.error('Error importing progress:', e);
                alert('Error importing progress: ' + e.message);
            }
        };
        reader.readAsText(file);
    };
    
    input.click();
}

// Check if a vocabulary is due for review
function isVocabularyDue(vocab, direction) {
    const progress = getVocabProgress(vocab, direction);
    
    // If vocabulary has never been reviewed, it's always due
    if (progress.correctCount === 0 && !progress.nextReviewDate) {
        return true;
    }
    
    // Check if next review date has passed (applies to all phases)
    if (!progress.nextReviewDate) {
        return true; // No review date set, consider it due
    }
    
    const now = new Date();
    const nextReview = new Date(progress.nextReviewDate);
    return now >= nextReview;
}

// Skip 1 day forward (for testing/adjustment)
function skipOneDay() {
    const now = new Date();
    now.setDate(now.getDate() - 1);
    
    let updatedCount = 0;
    for (const key in state.learningProgress) {
        const progress = state.learningProgress[key];
        if (progress.nextReviewDate) {
            const nextReview = new Date(progress.nextReviewDate);
            nextReview.setDate(nextReview.getDate() - 1);
            progress.nextReviewDate = nextReview.toISOString();
            updatedCount++;
        }
    }
    
    saveLearningProgress();
    
    if (state.selectionMode === 'spaced') {
        updateVocabularies();
    }
    
    alert(`Advanced ${updatedCount} vocabularies by 1 day.`);
}

// Get count of vocabularies due for review in current direction
function getDueVocabulariesCount(direction) {
    if (!state.vocabularies || state.vocabularies.length === 0) {
        return 0;
    }
    
    // Only calculate due count in spaced repetition mode
    if (state.selectionMode !== 'spaced') {
        return 0; // Not applicable in random mode
    }
    
    // Count vocabularies that are due in the specified direction
    return state.vocabularies.filter(vocab => isVocabularyDue(vocab, direction)).length;
}

// Get count of vocabularies per phase for current direction
function getVocabulariesByPhase(direction) {
    if (!state.vocabularies || state.vocabularies.length === 0) {
        return {};
    }
    
    const phaseCounts = {};
    for (let i = 0; i <= 9; i++) {
        phaseCounts[i] = 0;
    }
    
    state.vocabularies.forEach(vocab => {
        const progress = getVocabProgress(vocab, direction);
        const phase = Math.min(progress.correctCount, 9); // Cap at phase 9+
        phaseCounts[phase]++;
    });
    
    return phaseCounts;
}

// Update phase count display
function updatePhaseCountDisplay() {
    if (state.selectionMode !== 'spaced') {
        // Hide counts in non-spaced modes
        for (let i = 0; i <= 9; i++) {
            const countEl = document.getElementById(`phase-count-${i}`);
            if (countEl) countEl.style.display = 'none';
        }
        return;
    }
    
    const currentDirection = state.mode === 'random' ? 'spanishToGerman' : state.mode;
    const phaseCounts = getVocabulariesByPhase(currentDirection);
    
    for (let i = 0; i <= 9; i++) {
        const countEl = document.getElementById(`phase-count-${i}`);
        if (countEl) {
            countEl.textContent = phaseCounts[i] || 0;
            countEl.style.display = 'inline';
        }
    }
}
